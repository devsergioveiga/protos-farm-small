import { Money, FEBRABAN_BANK_MAP } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  BankAccountError,
  BANK_ACCOUNT_TYPE_LABELS,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
  type ListBankAccountsQuery,
  type StatementQuery,
  type BankAccountOutput,
  type StatementTransactionOutput,
  type DashboardOutput,
  type ExportFormat,
} from './bank-accounts.types';

// ─── Helpers ────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function toBankAccountOutput(row: any): BankAccountOutput {
  const bankCode = row.bankCode as string;
  const bankInfo = FEBRABAN_BANK_MAP.get(bankCode);
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    type: row.type as string,
    bankCode,
    bankName: bankInfo?.name ?? bankCode,
    agency: row.agency as string,
    agencyDigit: (row.agencyDigit as string) ?? null,
    accountNumber: row.accountNumber as string,
    accountDigit: (row.accountDigit as string) ?? null,
    producerId: (row.producerId as string) ?? null,
    notes: (row.notes as string) ?? null,
    isActive: row.isActive as boolean,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    balance: {
      initialBalance: Money.fromPrismaDecimal(row.balance?.initialBalance ?? 0).toNumber(),
      currentBalance: Money.fromPrismaDecimal(row.balance?.currentBalance ?? 0).toNumber(),
    },
    farms: (row.farms ?? []).map((f: any) => ({
      id: f.farmId ?? f.farm?.id ?? f.id,
      name: f.farm?.name ?? f.name ?? '',
    })),
    producer: row.producer
      ? {
          id: row.producer.id as string,
          name: row.producer.name as string,
        }
      : null,
  };
}

function toTransactionOutput(row: any): StatementTransactionOutput {
  return {
    id: row.id as string,
    bankAccountId: row.bankAccountId as string,
    type: row.type as string,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    description: row.description as string,
    referenceType: (row.referenceType as string) ?? null,
    referenceId: (row.referenceId as string) ?? null,
    transactionDate: (row.transactionDate as Date).toISOString(),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

const BANK_ACCOUNT_INCLUDE = {
  balance: true,
  farms: {
    include: {
      farm: { select: { id: true, name: true } },
    },
  },
  producer: { select: { id: true, name: true } },
};

// ─── createBankAccount ───────────────────────────────────────────────

export async function createBankAccount(
  ctx: RlsContext,
  input: CreateBankAccountInput,
): Promise<BankAccountOutput> {
  const {
    name,
    type,
    bankCode,
    agency,
    agencyDigit,
    accountNumber,
    accountDigit,
    producerId,
    farmIds,
    initialBalance,
    notes,
  } = input;

  // Validate bankCode
  if (!FEBRABAN_BANK_MAP.has(bankCode)) {
    throw new BankAccountError(`Código bancário inválido: ${bankCode}`, 400);
  }

  const account = await withRlsContext(ctx, async (tx) => {
    // (a) Create BankAccount
    const created = await (tx as any).bankAccount.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        type,
        bankCode,
        agency,
        agencyDigit: agencyDigit ?? null,
        accountNumber,
        accountDigit: accountDigit ?? null,
        producerId: producerId ?? null,
        notes: notes ?? null,
      },
    });

    // (b) Create BankAccountFarm junction records
    if (farmIds && farmIds.length > 0) {
      await (tx as any).bankAccountFarm.createMany({
        data: farmIds.map((farmId) => ({
          bankAccountId: created.id,
          farmId,
        })),
      });
    }

    // (c) Create BankAccountBalance
    const initialMoney = Money(initialBalance);
    await (tx as any).bankAccountBalance.create({
      data: {
        bankAccountId: created.id,
        organizationId: ctx.organizationId,
        initialBalance: initialMoney.toDecimal(),
        currentBalance: initialMoney.toDecimal(),
      },
    });

    // (d) If initialBalance > 0, create OPENING_BALANCE FinancialTransaction
    if (!initialMoney.isZero()) {
      await (tx as any).financialTransaction.create({
        data: {
          organizationId: ctx.organizationId,
          bankAccountId: created.id,
          type: 'CREDIT',
          amount: initialMoney.toDecimal(),
          description: 'Saldo inicial',
          referenceType: 'OPENING_BALANCE',
          transactionDate: new Date(),
        },
      });
    }

    // Fetch the full account with relations
    return (tx as any).bankAccount.findUnique({
      where: { id: created.id },
      include: BANK_ACCOUNT_INCLUDE,
    });
  });

  return toBankAccountOutput(account);
}

// ─── listBankAccounts ────────────────────────────────────────────────

export async function listBankAccounts(
  ctx: RlsContext,
  query: ListBankAccountsQuery = {},
): Promise<BankAccountOutput[]> {
  const { farmId, type, bankCode, isActive } = query;

  const where: any = { organizationId: ctx.organizationId };

  if (farmId) {
    where.farms = { some: { farmId } };
  }
  if (type) {
    where.type = type;
  }
  if (bankCode) {
    where.bankCode = bankCode;
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  } else {
    where.isActive = true;
  }

  const accounts = await withRlsContext(ctx, async (tx) => {
    return (tx as any).bankAccount.findMany({
      where,
      include: BANK_ACCOUNT_INCLUDE,
      orderBy: { name: 'asc' },
    });
  });

  return accounts.map(toBankAccountOutput);
}

// ─── getBankAccount ──────────────────────────────────────────────────

export async function getBankAccount(ctx: RlsContext, id: string): Promise<BankAccountOutput> {
  const account = await withRlsContext(ctx, async (tx) => {
    return (tx as any).bankAccount.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: BANK_ACCOUNT_INCLUDE,
    });
  });

  if (!account) {
    throw new BankAccountError('Conta bancária não encontrada', 404);
  }

  return toBankAccountOutput(account);
}

// ─── updateBankAccount ───────────────────────────────────────────────

export async function updateBankAccount(
  ctx: RlsContext,
  id: string,
  input: UpdateBankAccountInput,
): Promise<BankAccountOutput> {
  const { farmIds, ...rest } = input;

  const account = await withRlsContext(ctx, async (tx) => {
    // Verify account exists
    const existing = await (tx as any).bankAccount.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new BankAccountError('Conta bancária não encontrada', 404);
    }

    // Update account fields
    await (tx as any).bankAccount.update({
      where: { id },
      data: rest,
    });

    // Replace farmIds if provided
    if (farmIds !== undefined) {
      await (tx as any).bankAccountFarm.deleteMany({ where: { bankAccountId: id } });
      if (farmIds.length > 0) {
        await (tx as any).bankAccountFarm.createMany({
          data: farmIds.map((farmId) => ({ bankAccountId: id, farmId })),
        });
      }
    }

    return (tx as any).bankAccount.findUnique({
      where: { id },
      include: BANK_ACCOUNT_INCLUDE,
    });
  });

  return toBankAccountOutput(account);
}

// ─── deleteBankAccount ───────────────────────────────────────────────

export async function deleteBankAccount(ctx: RlsContext, id: string): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).bankAccount.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new BankAccountError('Conta bancária não encontrada', 404);
    }

    await (tx as any).bankAccount.update({
      where: { id },
      data: { isActive: false },
    });
  });
}

// ─── getStatement ────────────────────────────────────────────────────

export async function getStatement(
  ctx: RlsContext,
  accountId: string,
  query: StatementQuery = {},
): Promise<StatementTransactionOutput[]> {
  const { from, to, type } = query;

  const where: any = {
    organizationId: ctx.organizationId,
    bankAccountId: accountId,
  };

  if (from || to) {
    where.transactionDate = {};
    if (from) {
      where.transactionDate.gte = new Date(from);
    }
    if (to) {
      // Include the whole day
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      where.transactionDate.lte = toDate;
    }
  }

  if (type) {
    where.type = type;
  }

  const transactions = await withRlsContext(ctx, async (tx) => {
    return (tx as any).financialTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });
  });

  return transactions.map(toTransactionOutput);
}

// ─── exportStatement ────────────────────────────────────────────────

export async function exportStatement(
  ctx: RlsContext,
  accountId: string,
  query: StatementQuery & { format: ExportFormat },
): Promise<Buffer> {
  const { format, ...statementQuery } = query;
  const transactions = await getStatement(ctx, accountId, statementQuery);
  const account = await getBankAccount(ctx, accountId);

  switch (format) {
    case 'pdf':
      return exportStatementPdf(account, transactions, statementQuery);
    case 'xlsx':
      return exportStatementExcel(account, transactions);
    case 'csv':
      return exportStatementCsv(transactions);
    default:
      throw new BankAccountError('Formato inválido. Use: pdf, xlsx ou csv', 400);
  }
}

// ─── exportStatementPdf ──────────────────────────────────────────────

async function exportStatementPdf(
  account: BankAccountOutput,
  transactions: StatementTransactionOutput[],
  query: StatementQuery,
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100;

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').text('EXTRATO BANCÁRIO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(account.name, { align: 'center' });
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`${account.bankName} — Ag. ${account.agency} / Conta ${account.accountNumber}`, {
        align: 'center',
      });
    doc.moveDown(0.5);

    // Period
    const periodText =
      query.from || query.to
        ? `Período: ${query.from ?? '—'} a ${query.to ?? '—'}`
        : 'Todos os lançamentos';
    doc.fontSize(9).text(periodText, { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Data', 50, doc.y, { width: 80, continued: true });
    doc.text('Descrição', 130, doc.y, { width: 200, continued: true });
    doc.text('Tipo', 330, doc.y, { width: 60, continued: true });
    doc.text('Valor (R$)', 390, doc.y, { width: 120, align: 'right' });
    doc.moveDown(0.3);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.3);

    // Data rows
    let totalCredits = Money(0);
    let totalDebits = Money(0);

    doc.font('Helvetica').fontSize(8);
    for (const tx of transactions) {
      const date = new Date(tx.transactionDate).toLocaleDateString('pt-BR');
      const amount = Money(tx.amount);
      if (tx.type === 'CREDIT') {
        totalCredits = totalCredits.add(amount);
      } else {
        totalDebits = totalDebits.add(amount);
      }

      const y = doc.y;
      doc.text(date, 50, y, { width: 80, continued: true });
      doc.text(tx.description, 130, y, { width: 200, continued: true });
      doc.text(tx.type === 'CREDIT' ? 'Crédito' : 'Débito', 330, y, { width: 60, continued: true });
      doc.text(amount.toBRL(), 390, y, { width: 120, align: 'right' });
      doc.moveDown(0.3);
    }

    // Footer
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Total Créditos: ${totalCredits.toBRL()}`, 50);
    doc.text(`Total Débitos: ${totalDebits.toBRL()}`, 50);
    const net = totalCredits.subtract(totalDebits);
    doc.text(`Saldo Líquido: ${net.toBRL()}`, 50);

    doc.end();
  });
}

// ─── exportStatementExcel ────────────────────────────────────────────

async function exportStatementExcel(
  account: BankAccountOutput,
  transactions: StatementTransactionOutput[],
): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Extrato');

  // Account info header
  ws.addRow([
    account.name,
    account.bankName,
    `Ag. ${account.agency} / Conta ${account.accountNumber}`,
  ]);
  ws.addRow([]);

  // Bold headers
  const headerRow = ws.addRow(['Data', 'Descrição', 'Tipo', 'Valor (R$)']);
  headerRow.font = { bold: true };

  ws.columns = [
    { key: 'date', width: 14 },
    { key: 'description', width: 40 },
    { key: 'type', width: 12 },
    { key: 'amount', width: 16 },
  ];

  // Data rows
  for (const tx of transactions) {
    ws.addRow([
      new Date(tx.transactionDate).toLocaleDateString('pt-BR'),
      tx.description,
      tx.type === 'CREDIT' ? 'Crédito' : 'Débito',
      Money(tx.amount).toBRL(),
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── exportStatementCsv ──────────────────────────────────────────────

function exportStatementCsv(transactions: StatementTransactionOutput[]): Buffer {
  const BOM = '\uFEFF';
  const separator = ';';
  const headers = ['Data', 'Descrição', 'Tipo', 'Valor'].join(separator);

  const rows = transactions.map((tx) => {
    const date = new Date(tx.transactionDate).toLocaleDateString('pt-BR');
    const description = `"${tx.description.replace(/"/g, '""')}"`;
    const type = tx.type === 'CREDIT' ? 'Crédito' : 'Débito';
    const amount = Money(tx.amount).toBRL();
    return [date, description, type, amount].join(separator);
  });

  const csv = [BOM + headers, ...rows].join('\n');
  return Buffer.from(csv, 'utf-8');
}

// ─── getDashboard ────────────────────────────────────────────────────

export async function getDashboard(ctx: RlsContext): Promise<DashboardOutput> {
  const accounts = await withRlsContext(ctx, async (tx) => {
    return (tx as any).bankAccount.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: { balance: true },
    });
  });

  let totalBalance = Money(0);
  const byTypeMap = new Map<string, { total: typeof totalBalance; count: number }>();

  for (const acc of accounts) {
    const currentBalance = Money.fromPrismaDecimal(acc.balance?.currentBalance ?? 0);
    totalBalance = totalBalance.add(currentBalance);

    const type = acc.type as string;
    const existing = byTypeMap.get(type);
    if (existing) {
      existing.total = existing.total.add(currentBalance);
      existing.count += 1;
    } else {
      byTypeMap.set(type, { total: currentBalance, count: 1 });
    }
  }

  const byType = Array.from(byTypeMap.entries()).map(([type, { total, count }]) => ({
    type,
    typeLabel: BANK_ACCOUNT_TYPE_LABELS[type as keyof typeof BANK_ACCOUNT_TYPE_LABELS] ?? type,
    totalBalance: total.toNumber(),
    count,
  }));

  return {
    totalBalance: totalBalance.toNumber(),
    accountCount: accounts.length as number,
    byType,
  };
}
