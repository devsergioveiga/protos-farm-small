/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { withRlsContext } from '../../database/rls';
import type { RlsContext } from '../../database/rls';
import { logAudit } from '../../shared/audit/audit.service';
import { parseOfx } from './ofx-parser';
import { detectCsvColumns, parseCsv } from './csv-parser';
import { ReconciliationError } from './reconciliation.types';
import { Money } from '@protos-farm/shared';
import type {
  ImportPreviewResponse,
  ImportConfirmInput,
  ImportResult,
  ListImportsQuery,
  ImportOutput,
  ParsedStatementLine,
  ConfidenceLevel,
  MatchCandidate,
  StatementLineWithMatches,
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

// ─── Matching Engine ────────────────────────────────────────────────────

/**
 * scoreMatch — pure function scoring a statement line against a candidate record.
 * Scoring:
 *  - Value: exact=50, within 1%=30, within 5%=10, else=0
 *  - Date: +-1 day=40, +-5 days=20, else=0
 *  - Description: first 8 chars substring (case insensitive)=10, else=0
 */
export function scoreMatch(
  statementLine: { amount: number; date: Date; memo: string },
  candidate: { amount: number; date: Date; description: string },
): number {
  // Value score
  const valueDiff = Math.abs(statementLine.amount - candidate.amount);
  const relDiff =
    candidate.amount !== 0 ? valueDiff / Math.abs(candidate.amount) : valueDiff === 0 ? 0 : 1;

  let valueScore = 0;
  if (relDiff === 0) {
    valueScore = 50;
  } else if (relDiff < 0.01) {
    valueScore = 30;
  } else if (relDiff < 0.05) {
    valueScore = 10;
  }

  // Date score
  const dayDiff = Math.abs((statementLine.date.getTime() - candidate.date.getTime()) / 86400000);
  let dateScore = 0;
  if (dayDiff <= 1) {
    dateScore = 40;
  } else if (dayDiff <= 5) {
    dateScore = 20;
  }

  // Description score: first 8 chars substring match (case insensitive)
  const memoFirst8 = statementLine.memo.slice(0, 8).toLowerCase();
  const descFirst8 = candidate.description.slice(0, 8).toLowerCase();
  const descScore = descFirst8.includes(memoFirst8) || memoFirst8.includes(descFirst8) ? 10 : 0;

  return valueScore + dateScore + descScore;
}

/** Convert numeric score to ConfidenceLevel */
export function toConfidence(score: number): ConfidenceLevel {
  if (score >= 95) return 'EXATO';
  if (score >= 70) return 'PROVAVEL';
  return 'SEM_MATCH';
}

// ─── Get Import Lines With Matches ──────────────────────────────────────

export async function getImportLinesWithMatches(
  ctx: RequestContext,
  importId: string,
  statusFilter?: string,
): Promise<StatementLineWithMatches[]> {
  return withRlsContext(ctx, async (tx) => {
    // Verify import exists in org
    const imp = await (tx as any).bankStatementImport.findFirst({
      where: { id: importId, organizationId: ctx.organizationId },
      select: { id: true, bankAccountId: true },
    });
    if (!imp) {
      throw new ReconciliationError('Import não encontrado', 404);
    }

    const whereStatus: any = { importId };
    if (statusFilter) {
      whereStatus.status = statusFilter;
    }

    const lines = await (tx as any).bankStatementLine.findMany({
      where: whereStatus,
      orderBy: { date: 'asc' },
    });

    const result: StatementLineWithMatches[] = [];

    for (const line of lines) {
      const lineAmount =
        typeof line.amount === 'object' && 'toNumber' in line.amount
          ? line.amount.toNumber()
          : Number(line.amount);
      const lineDate = line.date instanceof Date ? line.date : new Date(line.date);

      // Only score PENDING lines for matches
      let matches: MatchCandidate[] = [];
      if (line.status === 'PENDING') {
        const windowDays = 10;
        const windowAmount = lineAmount * 0.2;
        const dateLow = new Date(lineDate);
        dateLow.setDate(dateLow.getDate() - windowDays);
        const dateHigh = new Date(lineDate);
        dateHigh.setDate(dateHigh.getDate() + windowDays);
        const amountLow = lineAmount - windowAmount;
        const amountHigh = lineAmount + windowAmount;

        const [payables, receivables, transfers] = await Promise.all([
          (tx as any).payableInstallment.findMany({
            where: {
              organizationId: ctx.organizationId,
              status: 'PENDING',
              dueDate: { gte: dateLow, lte: dateHigh },
              amount: { gte: amountLow, lte: amountHigh },
            },
            take: 20,
            select: { id: true, amount: true, dueDate: true, description: true },
          }),
          (tx as any).receivableInstallment.findMany({
            where: {
              organizationId: ctx.organizationId,
              status: 'PENDING',
              dueDate: { gte: dateLow, lte: dateHigh },
              amount: { gte: amountLow, lte: amountHigh },
            },
            take: 20,
            select: { id: true, amount: true, dueDate: true, description: true },
          }),
          (tx as any).transfer.findMany({
            where: {
              organizationId: ctx.organizationId,
              transferDate: { gte: dateLow, lte: dateHigh },
              amount: { gte: amountLow, lte: amountHigh },
            },
            take: 20,
            select: { id: true, amount: true, transferDate: true, description: true },
          }),
        ]);

        const scoredCandidates: MatchCandidate[] = [
          ...payables.map((p: any) => {
            const amt = typeof p.amount === 'object' ? p.amount.toNumber() : Number(p.amount);
            const score = scoreMatch(
              { amount: lineAmount, date: lineDate, memo: line.memo },
              { amount: amt, date: p.dueDate, description: p.description ?? '' },
            );
            return {
              type: 'PAYABLE' as const,
              referenceId: p.id,
              description: p.description ?? '',
              amount: amt,
              date: p.dueDate,
              score,
              confidence: toConfidence(score),
            };
          }),
          ...receivables.map((r: any) => {
            const amt = typeof r.amount === 'object' ? r.amount.toNumber() : Number(r.amount);
            const score = scoreMatch(
              { amount: lineAmount, date: lineDate, memo: line.memo },
              { amount: amt, date: r.dueDate, description: r.description ?? '' },
            );
            return {
              type: 'RECEIVABLE' as const,
              referenceId: r.id,
              description: r.description ?? '',
              amount: amt,
              date: r.dueDate,
              score,
              confidence: toConfidence(score),
            };
          }),
          ...transfers.map((t: any) => {
            const amt = typeof t.amount === 'object' ? t.amount.toNumber() : Number(t.amount);
            const score = scoreMatch(
              { amount: lineAmount, date: lineDate, memo: line.memo },
              { amount: amt, date: t.transferDate, description: t.description ?? '' },
            );
            return {
              type: 'TRANSFER' as const,
              referenceId: t.id,
              description: t.description ?? '',
              amount: amt,
              date: t.transferDate,
              score,
              confidence: toConfidence(score),
            };
          }),
        ];

        // Sort by score desc, keep top 3
        matches = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, 3);
      }

      result.push({
        id: line.id,
        trnType: line.trnType,
        amount: lineAmount,
        date: lineDate.toISOString(),
        memo: line.memo,
        status: line.status,
        matches,
      });
    }

    // Group: EXATO first, then PROVAVEL, then SEM_MATCH, then RECONCILED/IGNORED
    const exato = result.filter((l) => l.matches[0]?.confidence === 'EXATO');
    const provavel = result.filter((l) => l.matches[0]?.confidence === 'PROVAVEL');
    const semMatch = result.filter(
      (l) => l.status === 'PENDING' && (!l.matches[0] || l.matches[0].confidence === 'SEM_MATCH'),
    );
    const others = result.filter((l) => l.status !== 'PENDING');

    return [...exato, ...provavel, ...semMatch, ...others];
  });
}

// ─── Confirm Reconciliation ─────────────────────────────────────────────

export async function confirmReconciliation(
  ctx: RequestContext,
  statementLineId: string,
  reconciliationId: string,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const line = await (tx as any).bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId: ctx.organizationId },
    });
    if (!line) {
      throw new ReconciliationError('Linha não encontrada', 404);
    }

    const reconciliation = await (tx as any).reconciliation.findFirst({
      where: { id: reconciliationId, statementLineId },
    });
    if (!reconciliation) {
      throw new ReconciliationError('Reconciliação não encontrada', 404);
    }

    // Update reconciliation: set confirmedBy + confirmedAt
    await (tx as any).reconciliation.update({
      where: { id: reconciliationId },
      data: { confirmedBy: ctx.userId, confirmedAt: new Date() },
    });

    // Update statement line status to RECONCILED
    await (tx as any).bankStatementLine.update({
      where: { id: statementLineId },
      data: { status: 'RECONCILED' },
    });

    // Update the referenced record
    if (reconciliation.referenceType === 'PAYABLE') {
      await (tx as any).payable.update({
        where: { id: reconciliation.referenceId },
        data: { reconciled: true, reconciledAt: new Date() },
      });
    } else if (reconciliation.referenceType === 'RECEIVABLE') {
      await (tx as any).receivable.update({
        where: { id: reconciliation.referenceId },
        data: { reconciled: true, reconciledAt: new Date() },
      });
    }
  });

  await logAudit({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    actorRole: ctx.userRole as any,
    action: 'RECONCILIATION_CONFIRMED',
    targetType: 'BankStatementLine',
    targetId: statementLineId,
    organizationId: ctx.organizationId,
    metadata: { reconciliationId },
  });
}

// ─── Reject Match ───────────────────────────────────────────────────────

export async function rejectMatch(
  ctx: RequestContext,
  statementLineId: string,
  reconciliationId: string,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const line = await (tx as any).bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId: ctx.organizationId },
    });
    if (!line) {
      throw new ReconciliationError('Linha não encontrada', 404);
    }

    await (tx as any).reconciliation.delete({
      where: { id: reconciliationId },
    });

    // Keep line as PENDING (do not update status)
  });

  await logAudit({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    actorRole: ctx.userRole as any,
    action: 'RECONCILIATION_REJECTED',
    targetType: 'BankStatementLine',
    targetId: statementLineId,
    organizationId: ctx.organizationId,
    metadata: { reconciliationId },
  });
}

// ─── Manual Link (N:N) ──────────────────────────────────────────────────

export async function manualLink(
  ctx: RequestContext,
  statementLineId: string,
  links: Array<{ referenceType: string; referenceId: string; amount: number }>,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const line = await (tx as any).bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId: ctx.organizationId },
    });
    if (!line) {
      throw new ReconciliationError('Linha não encontrada', 404);
    }

    const lineAmount =
      typeof line.amount === 'object' && 'toNumber' in line.amount
        ? line.amount.toNumber()
        : Number(line.amount);

    // Validate N:N sum using Money arithmetic
    const linkedSum = links.reduce((sum, l) => sum.add(Money(l.amount)), Money(0));
    const lineMoneyAmount = Money(lineAmount);
    if (!linkedSum.equals(lineMoneyAmount)) {
      throw new ReconciliationError('Soma selecionada nao coincide com o valor do extrato', 400);
    }

    // Create Reconciliation record for each link
    for (const link of links) {
      await (tx as any).reconciliation.create({
        data: {
          organizationId: ctx.organizationId,
          statementLineId,
          referenceType: link.referenceType,
          referenceId: link.referenceId,
          referenceAmount: link.amount,
          score: 100,
          confidence: 'EXATO',
          confirmedBy: ctx.userId,
          confirmedAt: new Date(),
        },
      });

      // Mark linked CP/CR as reconciled
      if (link.referenceType === 'PAYABLE') {
        await (tx as any).payable.update({
          where: { id: link.referenceId },
          data: { reconciled: true, reconciledAt: new Date() },
        });
      } else if (link.referenceType === 'RECEIVABLE') {
        await (tx as any).receivable.update({
          where: { id: link.referenceId },
          data: { reconciled: true, reconciledAt: new Date() },
        });
      }
    }

    // Mark statement line as RECONCILED
    await (tx as any).bankStatementLine.update({
      where: { id: statementLineId },
      data: { status: 'RECONCILED' },
    });
  });

  await logAudit({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    actorRole: ctx.userRole as any,
    action: 'RECONCILIATION_MANUAL_LINK',
    targetType: 'BankStatementLine',
    targetId: statementLineId,
    organizationId: ctx.organizationId,
    metadata: { links },
  });
}

// ─── Ignore Statement Line ──────────────────────────────────────────────

export async function ignoreStatementLine(
  ctx: RequestContext,
  statementLineId: string,
): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const line = await (tx as any).bankStatementLine.findFirst({
      where: { id: statementLineId, organizationId: ctx.organizationId },
    });
    if (!line) {
      throw new ReconciliationError('Linha não encontrada', 404);
    }

    await (tx as any).bankStatementLine.update({
      where: { id: statementLineId },
      data: { status: 'IGNORED' },
    });
  });

  await logAudit({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    actorRole: ctx.userRole as any,
    action: 'RECONCILIATION_IGNORED',
    targetType: 'BankStatementLine',
    targetId: statementLineId,
    organizationId: ctx.organizationId,
    metadata: {},
  });
}

// ─── Search Candidates ──────────────────────────────────────────────────

export async function searchCandidates(
  ctx: RequestContext,
  query: { search?: string; bankAccountId?: string },
): Promise<MatchCandidate[]> {
  return withRlsContext(ctx, async (tx) => {
    const { search } = query;
    const searchCondition = search
      ? { description: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [payables, receivables, transfers] = await Promise.all([
      (tx as any).payableInstallment.findMany({
        where: { organizationId: ctx.organizationId, status: 'PENDING', ...searchCondition },
        take: 10,
        orderBy: { dueDate: 'desc' },
        select: { id: true, amount: true, dueDate: true, description: true },
      }),
      (tx as any).receivableInstallment.findMany({
        where: { organizationId: ctx.organizationId, status: 'PENDING', ...searchCondition },
        take: 10,
        orderBy: { dueDate: 'desc' },
        select: { id: true, amount: true, dueDate: true, description: true },
      }),
      (tx as any).transfer.findMany({
        where: { organizationId: ctx.organizationId, ...searchCondition },
        take: 10,
        orderBy: { transferDate: 'desc' },
        select: { id: true, amount: true, transferDate: true, description: true },
      }),
    ]);

    const results: MatchCandidate[] = [
      ...payables.map((p: any) => ({
        type: 'PAYABLE' as const,
        referenceId: p.id,
        description: p.description ?? '',
        amount: typeof p.amount === 'object' ? p.amount.toNumber() : Number(p.amount),
        date: p.dueDate,
        score: 0,
        confidence: 'SEM_MATCH' as ConfidenceLevel,
      })),
      ...receivables.map((r: any) => ({
        type: 'RECEIVABLE' as const,
        referenceId: r.id,
        description: r.description ?? '',
        amount: typeof r.amount === 'object' ? r.amount.toNumber() : Number(r.amount),
        date: r.dueDate,
        score: 0,
        confidence: 'SEM_MATCH' as ConfidenceLevel,
      })),
      ...transfers.map((t: any) => ({
        type: 'TRANSFER' as const,
        referenceId: t.id,
        description: t.description ?? '',
        amount: typeof t.amount === 'object' ? t.amount.toNumber() : Number(t.amount),
        date: t.transferDate,
        score: 0,
        confidence: 'SEM_MATCH' as ConfidenceLevel,
      })),
    ];

    return results.slice(0, 20);
  });
}

// ─── Reconciliation Report ──────────────────────────────────────────────

interface ReportSummary {
  pending: number;
  reconciled: number;
  ignored: number;
  totalPending: number;
  totalReconciled: number;
  totalIgnored: number;
}

export async function getReconciliationReport(
  ctx: RequestContext,
  importId: string,
  format: 'csv' | 'pdf' = 'csv',
): Promise<{ summary: ReportSummary; buffer: Buffer }> {
  return withRlsContext(ctx, async (tx) => {
    const imp = await (tx as any).bankStatementImport.findFirst({
      where: { id: importId, organizationId: ctx.organizationId },
      include: { bankAccount: { select: { name: true } } },
    });
    if (!imp) {
      throw new ReconciliationError('Import não encontrado', 404);
    }

    const lines = await (tx as any).bankStatementLine.findMany({
      where: { importId },
      include: {
        reconciliations: {
          select: { referenceType: true, referenceId: true, confidence: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Build summary
    let pending = 0,
      reconciled = 0,
      ignored = 0;
    let totalPending = 0,
      totalReconciled = 0,
      totalIgnored = 0;

    for (const line of lines) {
      const amt = typeof line.amount === 'object' ? line.amount.toNumber() : Number(line.amount);
      if (line.status === 'PENDING') {
        pending++;
        totalPending += amt;
      } else if (line.status === 'RECONCILED') {
        reconciled++;
        totalReconciled += amt;
      } else if (line.status === 'IGNORED') {
        ignored++;
        totalIgnored += amt;
      }
    }

    const summary: ReportSummary = {
      pending,
      reconciled,
      ignored,
      totalPending,
      totalReconciled,
      totalIgnored,
    };

    if (format === 'csv') {
      const rows: string[] = ['Data,Tipo,Valor,Descricao,Status,Match'];
      for (const line of lines) {
        const amt = typeof line.amount === 'object' ? line.amount.toNumber() : Number(line.amount);
        const matchDesc = line.reconciliations?.[0]?.referenceType ?? '';
        const dateStr = (line.date instanceof Date ? line.date : new Date(line.date))
          .toISOString()
          .split('T')[0];
        rows.push(
          `${dateStr},${line.trnType},${amt.toFixed(2)},"${line.memo}",${line.status},"${matchDesc}"`,
        );
      }
      const buffer = Buffer.from(rows.join('\n'), 'utf-8');
      return { summary, buffer };
    }

    // PDF format using pdfkit
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('RELATÓRIO DE CONCILIAÇÃO BANCÁRIA', { align: 'center' });
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Conta: ${imp.bankAccount?.name ?? ''}`, { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Importado em: ${new Date(imp.createdAt).toLocaleDateString('pt-BR')}`, {
          align: 'center',
        });
      doc.moveDown(0.5);

      const pageWidth = doc.page.width - 100;
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // Summary table
      doc.fontSize(11).font('Helvetica-Bold').text('RESUMO');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      doc.text(`Pendentes: ${pending} linhas — R$ ${totalPending.toFixed(2)}`);
      doc.text(`Conciliados: ${reconciled} linhas — R$ ${totalReconciled.toFixed(2)}`);
      doc.text(`Ignorados: ${ignored} linhas — R$ ${totalIgnored.toFixed(2)}`);
      doc.moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // Detail rows
      doc.fontSize(11).font('Helvetica-Bold').text('DETALHES');
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');

      for (const line of lines) {
        const amt = typeof line.amount === 'object' ? line.amount.toNumber() : Number(line.amount);
        const dateStr = (line.date instanceof Date ? line.date : new Date(line.date))
          .toISOString()
          .split('T')[0];
        const matchDesc = line.reconciliations?.[0]?.referenceType ?? 'N/A';
        doc.text(
          `${dateStr}  ${line.trnType}  R$ ${amt.toFixed(2)}  ${line.memo}  [${line.status}]  Match: ${matchDesc}`,
        );
      }

      doc.end();
    });

    return { summary, buffer };
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
