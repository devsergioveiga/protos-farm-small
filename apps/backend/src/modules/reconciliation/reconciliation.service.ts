/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { withRlsContext } from '../../database/rls';
import type { RlsContext } from '../../database/rls';
import { logAudit } from '../../shared/audit/audit.service';
import { parseOfx } from './ofx-parser';
import { detectCsvColumns, parseCsv } from './csv-parser';
import { ReconciliationError } from './reconciliation.types';
import type {
  ImportPreviewResponse,
  ImportConfirmInput,
  ImportResult,
  ListImportsQuery,
  ImportOutput,
  ParsedStatementLine,
} from './reconciliation.types';

// ─── Types ─────────────────────────────────────────────────────────────

interface RequestContext extends RlsContext {
  userId: string;
  userEmail: string;
  userRole: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function computeLineHash(bankAccountId: string, date: Date, amount: number, memo: string): string {
  const raw = `${bankAccountId}|${date.toISOString()}|${amount}|${memo}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildParsedLines(
  fileBuffer: Buffer,
  fileName: string,
): {
  fileType: 'OFX' | 'CSV';
  lines: ParsedStatementLine[];
  bankId?: string;
  acctId?: string;
} {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const content = fileBuffer.toString('latin1');

  if (ext === 'ofx') {
    const doc = parseOfx(content);
    const lines: ParsedStatementLine[] = doc.transactions.map((t) => ({
      trnType: t.trnamt >= 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(t.trnamt),
      date: t.dtposted,
      memo: t.memo,
      fitId: t.fitid || undefined,
    }));
    return { fileType: 'OFX', lines, bankId: doc.bankId, acctId: doc.acctId };
  }

  if (ext === 'csv') {
    const detected = detectCsvColumns(content);
    const lines = parseCsv(content, detected.suggestedMapping);
    return { fileType: 'CSV', lines };
  }

  throw new ReconciliationError('Formato de arquivo não suportado. Use OFX ou CSV.', 400);
}

// ─── Preview ───────────────────────────────────────────────────────────

export async function previewFile(
  fileBuffer: Buffer,
  fileName: string,
  ctx: RequestContext,
): Promise<ImportPreviewResponse> {
  const { fileType, lines, bankId, acctId } = buildParsedLines(fileBuffer, fileName);
  const content = fileBuffer.toString('latin1');
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  let bankAccountId: string | undefined;
  let bankAccountName: string | undefined;

  // Auto-detect bank account from OFX BANKID+ACCTID
  if (fileType === 'OFX' && bankId && acctId) {
    const account = await withRlsContext(ctx, async (tx) => {
      return (tx as any).bankAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          bankCode: bankId,
          accountNumber: { contains: acctId.replace(/-/g, '') },
          isActive: true,
        },
        select: { id: true, name: true },
      });
    });

    if (account) {
      bankAccountId = account.id;
      bankAccountName = account.name;
    }
  }

  let detectedColumns;
  if (ext === 'csv') {
    detectedColumns = detectCsvColumns(content);
  }

  return {
    fileType,
    bankAccountId,
    bankAccountName,
    detectedColumns,
    lines,
    totalLines: lines.length,
  };
}

// ─── Confirm Import ─────────────────────────────────────────────────────

export async function confirmImport(
  ctx: RequestContext,
  previewData: { fileBuffer: Buffer; fileName: string },
  input: ImportConfirmInput,
): Promise<ImportResult> {
  const { fileBuffer, fileName } = previewData;
  const { bankAccountId, selectedLineIndices, columnMapping } = input;

  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const content = fileBuffer.toString('latin1');

  let allLines: ParsedStatementLine[];
  let fileType: 'OFX' | 'CSV';

  if (ext === 'ofx') {
    const doc = parseOfx(content);
    allLines = doc.transactions.map((t) => ({
      trnType: t.trnamt >= 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(t.trnamt),
      date: t.dtposted,
      memo: t.memo,
      fitId: t.fitid || undefined,
    }));
    fileType = 'OFX';
  } else if (ext === 'csv') {
    const mapping = columnMapping ?? detectCsvColumns(content).suggestedMapping;
    allLines = parseCsv(content, mapping);
    fileType = 'CSV';
  } else {
    throw new ReconciliationError('Formato de arquivo não suportado', 400);
  }

  // Filter selected lines
  const linesToImport =
    selectedLineIndices && selectedLineIndices.length > 0
      ? selectedLineIndices.map((i) => allLines[i]).filter(Boolean)
      : allLines;

  const totalLines = linesToImport.length;

  // Build statement line records with hash for duplicate detection
  const lineRecords = linesToImport.map((line) => ({
    organizationId: ctx.organizationId,
    bankAccountId,
    fitId: line.fitId ?? null,
    lineHash: computeLineHash(bankAccountId, line.date, line.amount, line.memo),
    trnType: line.trnType,
    amount: line.amount,
    date: line.date,
    memo: line.memo,
    status: 'PENDING' as const,
  }));

  const result = await withRlsContext(ctx, async (tx) => {
    // Verify bank account exists in org
    const bankAccount = await (tx as any).bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
      select: { id: true, name: true },
    });

    if (!bankAccount) {
      throw new ReconciliationError('Conta bancária não encontrada', 404);
    }

    // Create import record first (to get importId)
    const importRecord = await (tx as any).bankStatementImport.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        fileName,
        fileType,
        importedBy: ctx.userId,
        totalLines,
        importedLines: 0, // will update after createMany
        skippedLines: 0,
      },
    });

    // Create lines with skipDuplicates using unique constraint [bankAccountId, lineHash]
    const createResult = await (tx as any).bankStatementLine.createManyAndReturn({
      data: lineRecords.map((lr) => ({ ...lr, importId: importRecord.id })),
      skipDuplicates: true,
    });

    const importedLines = createResult.length;
    const skippedLines = totalLines - importedLines;

    // Update import record with final counts
    await (tx as any).bankStatementImport.update({
      where: { id: importRecord.id },
      data: { importedLines, skippedLines },
    });

    return {
      importId: importRecord.id,
      totalLines,
      importedLines,
      skippedLines,
    };
  });

  await logAudit({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    actorRole: ctx.userRole as any,
    action: 'BANK_STATEMENT_IMPORT',
    targetType: 'BankStatementImport',
    targetId: result.importId,
    organizationId: ctx.organizationId,
    metadata: {
      fileName,
      fileType,
      totalLines: result.totalLines,
      importedLines: result.importedLines,
      skippedLines: result.skippedLines,
    },
  });

  return result;
}

// ─── List Imports ───────────────────────────────────────────────────────

export async function listImports(
  ctx: RequestContext,
  query: ListImportsQuery,
): Promise<{ data: ImportOutput[]; total: number }> {
  const { bankAccountId, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };
    if (bankAccountId) {
      where.bankAccountId = bankAccountId;
    }

    const [total, imports] = await Promise.all([
      (tx as any).bankStatementImport.count({ where }),
      (tx as any).bankStatementImport.findMany({
        where,
        include: {
          bankAccount: { select: { name: true } },
          lines: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data: ImportOutput[] = imports.map((imp: any) => {
      const pendingLines = imp.lines.filter((l: any) => l.status === 'PENDING').length;
      const reconciledLines = imp.lines.filter((l: any) => l.status === 'RECONCILED').length;

      return {
        id: imp.id,
        bankAccountId: imp.bankAccountId,
        bankAccountName: imp.bankAccount?.name ?? '',
        fileName: imp.fileName,
        fileType: imp.fileType,
        importedBy: imp.importedBy,
        importedByName: imp.importedBy, // user name not always available without join
        totalLines: imp.totalLines,
        importedLines: imp.importedLines,
        skippedLines: imp.skippedLines,
        pendingLines,
        reconciledLines,
        createdAt: imp.createdAt.toISOString(),
      };
    });

    return { data, total };
  });
}

// ─── Get Import Detail ──────────────────────────────────────────────────

export async function getImportDetail(
  ctx: RequestContext,
  importId: string,
): Promise<ImportOutput> {
  return withRlsContext(ctx, async (tx) => {
    const imp = await (tx as any).bankStatementImport.findFirst({
      where: { id: importId, organizationId: ctx.organizationId },
      include: {
        bankAccount: { select: { name: true } },
        lines: {
          select: { status: true },
        },
      },
    });

    if (!imp) {
      throw new ReconciliationError('Import não encontrado', 404);
    }

    const pendingLines = imp.lines.filter((l: any) => l.status === 'PENDING').length;
    const reconciledLines = imp.lines.filter((l: any) => l.status === 'RECONCILED').length;

    return {
      id: imp.id,
      bankAccountId: imp.bankAccountId,
      bankAccountName: imp.bankAccount?.name ?? '',
      fileName: imp.fileName,
      fileType: imp.fileType,
      importedBy: imp.importedBy,
      importedByName: imp.importedBy,
      totalLines: imp.totalLines,
      importedLines: imp.importedLines,
      skippedLines: imp.skippedLines,
      pendingLines,
      reconciledLines,
      createdAt: imp.createdAt.toISOString(),
    };
  });
}
