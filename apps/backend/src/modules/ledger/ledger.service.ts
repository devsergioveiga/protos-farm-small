// ─── Ledger Service ──────────────────────────────────────────────────────────
// Ledger (razao), trial balance (balancete), and daily book (livro diario)
// reports with PDF/CSV/XLSX export.

import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma';
import type { Response } from 'express';
import type {
  LedgerOutput,
  LedgerFilters,
  TrialBalanceOutput,
  TrialBalanceFilters,
  TrialBalanceRow,
  DailyBookOutput,
  DailyBookFilters,
} from './ledger.types';
import { LedgerError } from './ledger.types';

// ─── getLedger ─────────────────────────────────────────────────────────────────
// Returns per-account ledger with running balance via SQL window function.

type LedgerLineRaw = {
  entryId: string;
  entryNumber: number | bigint;
  entryDate: Date;
  description: string;
  side: string;
  amount: string;
  runningBalance: string;
};

export async function getLedger(
  organizationId: string,
  filters: LedgerFilters,
): Promise<LedgerOutput> {
  // Fetch account info
  const account = await prisma.chartOfAccount.findFirst({
    where: { id: filters.accountId, organizationId },
    select: { id: true, code: true, name: true, nature: true },
  });

  if (!account) {
    throw new LedgerError('Conta não encontrada', 'NOT_FOUND', 404);
  }

  // Compute previous balance from AccountBalance of the month before start
  const startDate = new Date(filters.startDate);
  const prevMonth = startDate.getMonth(); // 0-based: 1 = January, so month - 1
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth; // convert to 1-based
  const prevYear = prevMonth === 0 ? startDate.getFullYear() - 1 : startDate.getFullYear();

  // Find fiscal year containing prevYear
  const prevFiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      organizationId,
      startDate: { lte: new Date(`${prevYear}-12-31`) },
      endDate: { gte: new Date(`${prevYear}-01-01`) },
    },
    select: { id: true },
  });

  let previousBalance = new Decimal(0);
  if (prevFiscalYear) {
    const prevBalance = await prisma.accountBalance.findFirst({
      where: {
        organizationId,
        accountId: filters.accountId,
        fiscalYearId: prevFiscalYear.id,
        month: prevMonthNum,
      },
      select: { closingBalance: true },
    });
    if (prevBalance) {
      previousBalance = new Decimal(prevBalance.closingBalance.toString());
    }
  }

  const previousBalanceDecimal = previousBalance;
  const accountNature = account.nature;

  // Raw SQL with window function for running balance
  const startDateStr = filters.startDate;
  const endDateStr = filters.endDate;

  const lines = await prisma.$queryRaw<LedgerLineRaw[]>`
    SELECT
      je.id AS "entryId",
      je."entryNumber" AS "entryNumber",
      je."entryDate" AS "entryDate",
      je.description AS "description",
      jel.side AS "side",
      jel.amount::text AS "amount",
      (${previousBalanceDecimal.toString()}::decimal + SUM(
        CASE WHEN ${accountNature} = 'DEVEDORA'
          THEN CASE jel.side WHEN 'DEBIT' THEN jel.amount ELSE -jel.amount END
          ELSE CASE jel.side WHEN 'CREDIT' THEN jel.amount ELSE -jel.amount END
        END
      ) OVER (ORDER BY je."entryDate", je."entryNumber", jel."lineOrder"))::text AS "runningBalance"
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalEntryId"
    WHERE je."organizationId" = ${organizationId}
      AND jel."accountId" = ${filters.accountId}
      AND je.status = 'POSTED'
      AND je."entryDate" BETWEEN ${startDateStr}::date AND ${endDateStr}::date
    ORDER BY je."entryDate", je."entryNumber", jel."lineOrder"
  `;

  const formattedLines = lines.map((l) => ({
    entryId: l.entryId,
    entryNumber: Number(l.entryNumber),
    entryDate:
      l.entryDate instanceof Date ? l.entryDate.toISOString().slice(0, 10) : String(l.entryDate),
    description: l.description,
    side: l.side as 'DEBIT' | 'CREDIT',
    amount: l.amount,
    runningBalance: l.runningBalance,
  }));

  const finalBalance =
    formattedLines.length > 0
      ? formattedLines[formattedLines.length - 1].runningBalance
      : previousBalance.toString();

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    nature: account.nature,
    periodStart: filters.startDate,
    periodEnd: filters.endDate,
    previousBalance: previousBalance.toFixed(2),
    lines: formattedLines,
    finalBalance,
  };
}

// ─── getTrialBalance ─────────────────────────────────────────────────────────
// Returns 3-column trial balance with group totals and balance validation.

export async function getTrialBalance(
  organizationId: string,
  filters: TrialBalanceFilters,
): Promise<TrialBalanceOutput> {
  // Verify fiscal year exists
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new LedgerError('Exercício fiscal não encontrado', 'FISCAL_YEAR_NOT_FOUND', 404);
  }

  // Find the accounting period for the given month
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      organizationId,
      fiscalYearId: filters.fiscalYearId,
      month: filters.month,
    },
    select: { id: true, month: true, year: true },
  });

  if (!period) {
    throw new LedgerError('Período contábil não encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  // Fetch all active COA accounts for the org
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      nature: true,
      level: true,
      isSynthetic: true,
      parentId: true,
    },
    orderBy: { code: 'asc' },
  });

  // Fetch AccountBalance rows for this fiscal year + month
  const balances = await prisma.accountBalance.findMany({
    where: {
      organizationId,
      fiscalYearId: filters.fiscalYearId,
      month: filters.month,
    },
    select: {
      accountId: true,
      openingBalance: true,
      debitTotal: true,
      creditTotal: true,
      closingBalance: true,
    },
  });

  const balanceMap = new Map<
    string,
    { openingBalance: Decimal; debitTotal: Decimal; creditTotal: Decimal; closingBalance: Decimal }
  >();
  for (const b of balances) {
    balanceMap.set(b.accountId, {
      openingBalance: new Decimal(b.openingBalance.toString()),
      debitTotal: new Decimal(b.debitTotal.toString()),
      creditTotal: new Decimal(b.creditTotal.toString()),
      closingBalance: new Decimal(b.closingBalance.toString()),
    });
  }

  // Build account map
  type AccountInfo = {
    id: string;
    code: string;
    name: string;
    accountType: string;
    nature: string;
    level: number;
    isSynthetic: boolean;
    parentId: string | null;
  };

  const accountMap = new Map<string, AccountInfo>();
  for (const acct of allAccounts) {
    accountMap.set(acct.id, {
      ...acct,
      accountType: acct.accountType as string,
      nature: acct.nature as string,
    });
  }

  // Compute aggregate values for each account (synthetic = sum of children recursively)
  type AccountValues = {
    previousBalance: Decimal;
    debitMovement: Decimal;
    creditMovement: Decimal;
    currentBalance: Decimal;
  };

  function getAccountValues(accountId: string, visited: Set<string> = new Set()): AccountValues {
    if (visited.has(accountId)) {
      return {
        previousBalance: new Decimal(0),
        debitMovement: new Decimal(0),
        creditMovement: new Decimal(0),
        currentBalance: new Decimal(0),
      };
    }
    visited.add(accountId);

    const acct = accountMap.get(accountId);
    if (!acct) {
      return {
        previousBalance: new Decimal(0),
        debitMovement: new Decimal(0),
        creditMovement: new Decimal(0),
        currentBalance: new Decimal(0),
      };
    }

    if (!acct.isSynthetic) {
      // Analytic account: get from balanceMap
      const bal = balanceMap.get(accountId);
      if (!bal) {
        return {
          previousBalance: new Decimal(0),
          debitMovement: new Decimal(0),
          creditMovement: new Decimal(0),
          currentBalance: new Decimal(0),
        };
      }
      return {
        previousBalance: bal.openingBalance,
        debitMovement: bal.debitTotal,
        creditMovement: bal.creditTotal,
        currentBalance: bal.closingBalance,
      };
    }

    // Synthetic account: aggregate children
    const children = allAccounts.filter((a) => a.parentId === accountId);
    let prevBal = new Decimal(0);
    let debitMov = new Decimal(0);
    let creditMov = new Decimal(0);
    let currBal = new Decimal(0);

    for (const child of children) {
      const childVals = getAccountValues(child.id, new Set(visited));
      prevBal = prevBal.plus(childVals.previousBalance);
      debitMov = debitMov.plus(childVals.debitMovement);
      creditMov = creditMov.plus(childVals.creditMovement);
      currBal = currBal.plus(childVals.currentBalance);
    }

    return {
      previousBalance: prevBal,
      debitMovement: debitMov,
      creditMovement: creditMov,
      currentBalance: currBal,
    };
  }

  // Build rows — only include accounts that have activity or have balance
  const rows: TrialBalanceRow[] = [];
  const analyticIds = new Set<string>();

  for (const acct of allAccounts) {
    const vals = getAccountValues(acct.id);
    const hasActivity =
      !vals.previousBalance.isZero() ||
      !vals.debitMovement.isZero() ||
      !vals.creditMovement.isZero() ||
      !vals.currentBalance.isZero();

    if (!hasActivity) continue;

    if (!acct.isSynthetic) {
      analyticIds.add(acct.id);
    }

    rows.push({
      accountId: acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.accountType as string,
      nature: acct.nature as string,
      level: acct.level,
      isSynthetic: acct.isSynthetic,
      previousBalance: vals.previousBalance.toFixed(2),
      debitMovement: vals.debitMovement.toFixed(2),
      creditMovement: vals.creditMovement.toFixed(2),
      currentBalance: vals.currentBalance.toFixed(2),
    });
  }

  // Grand totals from analytic accounts only (avoid double-counting synthetics)
  let prevBalDebit = new Decimal(0);
  let prevBalCredit = new Decimal(0);
  let movDebit = new Decimal(0);
  let movCredit = new Decimal(0);
  let currBalDebit = new Decimal(0);
  let currBalCredit = new Decimal(0);

  for (const acctId of analyticIds) {
    const acct = accountMap.get(acctId);
    if (!acct) continue;
    const vals = getAccountValues(acctId);

    // previousBalance: split into debit/credit by nature
    if (acct.nature === 'DEVEDORA') {
      if (vals.previousBalance.gte(0)) {
        prevBalDebit = prevBalDebit.plus(vals.previousBalance);
      } else {
        prevBalCredit = prevBalCredit.plus(vals.previousBalance.abs());
      }
      if (vals.currentBalance.gte(0)) {
        currBalDebit = currBalDebit.plus(vals.currentBalance);
      } else {
        currBalCredit = currBalCredit.plus(vals.currentBalance.abs());
      }
    } else {
      if (vals.previousBalance.gte(0)) {
        prevBalCredit = prevBalCredit.plus(vals.previousBalance);
      } else {
        prevBalDebit = prevBalDebit.plus(vals.previousBalance.abs());
      }
      if (vals.currentBalance.gte(0)) {
        currBalCredit = currBalCredit.plus(vals.currentBalance);
      } else {
        currBalDebit = currBalDebit.plus(vals.currentBalance.abs());
      }
    }

    movDebit = movDebit.plus(vals.debitMovement);
    movCredit = movCredit.plus(vals.creditMovement);
  }

  const isBalanced = movDebit.toFixed(2) === movCredit.toFixed(2);

  return {
    periodId: period.id,
    periodMonth: period.month,
    periodYear: period.year,
    rows,
    grandTotals: {
      previousBalanceDebit: prevBalDebit.toFixed(2),
      previousBalanceCredit: prevBalCredit.toFixed(2),
      movementDebit: movDebit.toFixed(2),
      movementCredit: movCredit.toFixed(2),
      currentBalanceDebit: currBalDebit.toFixed(2),
      currentBalanceCredit: currBalCredit.toFixed(2),
    },
    isBalanced,
  };
}

// ─── getDailyBook ────────────────────────────────────────────────────────────
// Returns all POSTED entries in chronological order with sequential numbering.

export async function getDailyBook(
  organizationId: string,
  filters: DailyBookFilters,
): Promise<DailyBookOutput> {
  const where: Record<string, unknown> = {
    organizationId,
    status: 'POSTED',
    entryDate: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    },
  };

  if (filters.entryType) {
    where.entryType = filters.entryType;
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: { code: true, name: true },
          },
        },
        orderBy: { lineOrder: 'asc' },
      },
    },
    orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
  });

  // Optional amount filter
  const minAmount = filters.minAmount ? new Decimal(filters.minAmount) : null;
  const maxAmount = filters.maxAmount ? new Decimal(filters.maxAmount) : null;

  const filteredEntries = entries.filter((entry) => {
    if (!minAmount && !maxAmount) return true;
    return entry.lines.some((l) => {
      const amt = new Decimal(l.amount.toString());
      if (minAmount && amt.lt(minAmount)) return false;
      if (maxAmount && amt.gt(maxAmount)) return false;
      return true;
    });
  });

  return {
    periodStart: filters.startDate,
    periodEnd: filters.endDate,
    entries: filteredEntries.map((entry) => ({
      entryId: entry.id,
      entryNumber: entry.entryNumber,
      entryDate:
        entry.entryDate instanceof Date
          ? entry.entryDate.toISOString().slice(0, 10)
          : String(entry.entryDate),
      description: entry.description,
      entryType: entry.entryType,
      lines: entry.lines.map((l) => ({
        accountCode: l.account.code,
        accountName: l.account.name,
        side: l.side,
        amount: l.amount.toString(),
        description: l.description,
      })),
    })),
    totalEntries: filteredEntries.length,
  };
}

// ─── exportLedgerCsv ────────────────────────────────────────────────────────
// Returns CSV string with BOM, semicolon separator (Brazilian standard).

export async function exportLedgerCsv(
  organizationId: string,
  filters: LedgerFilters,
): Promise<string> {
  const ledger = await getLedger(organizationId, filters);

  const BOM = '\uFEFF';
  const header = 'Data;Numero;Historico;Debito;Credito;Saldo';

  const rows = ledger.lines.map((l) => {
    const date = l.entryDate; // already YYYY-MM-DD; convert to DD/MM/YYYY for Brazilian format
    const [year, month, day] = date.split('-');
    const brDate = `${day}/${month}/${year}`;
    const debit = l.side === 'DEBIT' ? l.amount : '';
    const credit = l.side === 'CREDIT' ? l.amount : '';
    const desc = l.description.replace(/;/g, ',');
    return `${brDate};${l.entryNumber};${desc};${debit};${credit};${l.runningBalance}`;
  });

  return `${BOM}${header}\n${rows.join('\n')}`;
}

// ─── exportLedgerPdf ────────────────────────────────────────────────────────
// Pipes pdfkit document to response.

export async function exportLedgerPdf(
  organizationId: string,
  filters: LedgerFilters,
  res: Response,
): Promise<void> {
  const ledger = await getLedger(organizationId, filters);
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  // Header
  doc.fontSize(14).font('Helvetica-Bold').text('RAZÃO CONTÁBIL', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(11)
    .font('Helvetica')
    .text(`Conta: ${ledger.accountCode} — ${ledger.accountName}`, { align: 'center' });
  doc
    .fontSize(10)
    .text(`Período: ${ledger.periodStart} a ${ledger.periodEnd}`, { align: 'center' });
  doc.moveDown(0.5);

  // Saldo anterior
  doc.font('Helvetica-Bold').fontSize(10).text(`Saldo Anterior: ${ledger.previousBalance}`);
  doc.moveDown(0.3);

  // Table header
  doc.font('Helvetica-Bold').fontSize(9);
  const colX = { date: 40, num: 100, desc: 140, debit: 340, credit: 410, balance: 490 };
  doc.text('Data', colX.date, doc.y);
  doc.text('Nº', colX.num, doc.y - doc.currentLineHeight());
  doc.text('Histórico', colX.desc, doc.y - doc.currentLineHeight());
  doc.text('Débito', colX.debit, doc.y - doc.currentLineHeight());
  doc.text('Crédito', colX.credit, doc.y - doc.currentLineHeight());
  doc.text('Saldo', colX.balance, doc.y - doc.currentLineHeight());
  doc.moveDown(0.2);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.2);

  // Lines
  doc.font('Helvetica').fontSize(8);
  for (const line of ledger.lines) {
    const [yr, mo, dy] = line.entryDate.split('-');
    const brDate = `${dy}/${mo}/${yr}`;
    const y = doc.y;
    doc.text(brDate, colX.date, y, { width: 55 });
    doc.text(String(line.entryNumber), colX.num, y, { width: 35 });
    doc.text(line.description, colX.desc, y, { width: 190 });
    doc.text(line.side === 'DEBIT' ? line.amount : '', colX.debit, y, {
      width: 65,
      align: 'right',
    });
    doc.text(line.side === 'CREDIT' ? line.amount : '', colX.credit, y, {
      width: 75,
      align: 'right',
    });
    doc.text(line.runningBalance, colX.balance, y, { width: 65, align: 'right' });
    doc.moveDown(0.5);

    // New page if near bottom
    if (doc.y > 760) {
      doc.addPage();
    }
  }

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10).text(`Saldo Final: ${ledger.finalBalance}`);

  doc.end();
}

// ─── exportTrialBalancePdf ───────────────────────────────────────────────────
// Pipes trial balance PDF to response.

export async function exportTrialBalancePdf(
  organizationId: string,
  filters: TrialBalanceFilters,
  res: Response,
): Promise<void> {
  const balance = await getTrialBalance(organizationId, filters);
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
  doc.pipe(res);

  // Header
  doc.fontSize(14).font('Helvetica-Bold').text('BALANCETE DE VERIFICAÇÃO', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Período: ${String(balance.periodMonth).padStart(2, '0')}/${balance.periodYear}`, {
      align: 'center',
    });
  doc.fontSize(9).text(`Balancete ${balance.isBalanced ? 'EQUILIBRADO' : 'DESEQUILIBRADO'}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  // Table header
  const colX = {
    code: 40,
    name: 90,
    prevDeb: 250,
    prevCred: 320,
    movDeb: 390,
    movCred: 460,
    currDeb: 530,
    currCred: 600,
  };
  doc.font('Helvetica-Bold').fontSize(8);
  const headerY = doc.y;
  doc.text('Código', colX.code, headerY, { width: 45 });
  doc.text('Conta', colX.name, headerY, { width: 155 });
  doc.text('Saldo Ant D', colX.prevDeb, headerY, { width: 65, align: 'right' });
  doc.text('Saldo Ant C', colX.prevCred, headerY, { width: 65, align: 'right' });
  doc.text('Mov Déb', colX.movDeb, headerY, { width: 65, align: 'right' });
  doc.text('Mov Cré', colX.movCred, headerY, { width: 65, align: 'right' });
  doc.text('Saldo Atu D', colX.currDeb, headerY, { width: 65, align: 'right' });
  doc.text('Saldo Atu C', colX.currCred, headerY, { width: 65, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(750, doc.y).stroke();
  doc.moveDown(0.2);

  // Rows
  doc.font('Helvetica').fontSize(7);
  for (const row of balance.rows) {
    const y = doc.y;
    const indent = (row.level - 1) * 6;
    const prevBal = new Decimal(row.previousBalance);
    const currBal = new Decimal(row.currentBalance);

    doc.text(row.accountCode, colX.code + indent, y, { width: 45 });
    doc.text(row.accountName, colX.name + indent, y, { width: 155 - indent });
    doc.text(
      prevBal.gte(0) && row.nature === 'DEVEDORA' ? prevBal.toFixed(2) : '',
      colX.prevDeb,
      y,
      { width: 65, align: 'right' },
    );
    doc.text(
      prevBal.gte(0) && row.nature === 'CREDORA' ? prevBal.toFixed(2) : '',
      colX.prevCred,
      y,
      { width: 65, align: 'right' },
    );
    doc.text(row.debitMovement, colX.movDeb, y, { width: 65, align: 'right' });
    doc.text(row.creditMovement, colX.movCred, y, { width: 65, align: 'right' });
    doc.text(
      currBal.gte(0) && row.nature === 'DEVEDORA' ? currBal.toFixed(2) : '',
      colX.currDeb,
      y,
      { width: 65, align: 'right' },
    );
    doc.text(
      currBal.gte(0) && row.nature === 'CREDORA' ? currBal.toFixed(2) : '',
      colX.currCred,
      y,
      { width: 65, align: 'right' },
    );
    doc.moveDown(0.4);

    if (doc.y > 550) {
      doc.addPage({ layout: 'landscape' });
    }
  }

  // Totals
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(750, doc.y).stroke();
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(8);
  const totY = doc.y;
  const gt = balance.grandTotals;
  doc.text('TOTAL', colX.code, totY);
  doc.text(gt.previousBalanceDebit, colX.prevDeb, totY, { width: 65, align: 'right' });
  doc.text(gt.previousBalanceCredit, colX.prevCred, totY, { width: 65, align: 'right' });
  doc.text(gt.movementDebit, colX.movDeb, totY, { width: 65, align: 'right' });
  doc.text(gt.movementCredit, colX.movCred, totY, { width: 65, align: 'right' });
  doc.text(gt.currentBalanceDebit, colX.currDeb, totY, { width: 65, align: 'right' });
  doc.text(gt.currentBalanceCredit, colX.currCred, totY, { width: 65, align: 'right' });

  doc.end();
}

// ─── exportTrialBalanceXlsx ──────────────────────────────────────────────────
// Returns ExcelJS workbook piped to response.

export async function exportTrialBalanceXlsx(
  organizationId: string,
  filters: TrialBalanceFilters,
  res: Response,
): Promise<void> {
  const balance = await getTrialBalance(organizationId, filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Protos Farm';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Balancete');

  sheet.columns = [
    { header: 'Código', key: 'code', width: 15 },
    { header: 'Conta', key: 'name', width: 35 },
    { header: 'Nível', key: 'level', width: 8 },
    { header: 'Tipo', key: 'isSynthetic', width: 12 },
    { header: 'Saldo Anterior (D)', key: 'prevBalDebit', width: 20 },
    { header: 'Saldo Anterior (C)', key: 'prevBalCredit', width: 20 },
    { header: 'Mov. Débito', key: 'movDebit', width: 18 },
    { header: 'Mov. Crédito', key: 'movCredit', width: 18 },
    { header: 'Saldo Atual (D)', key: 'currBalDebit', width: 20 },
    { header: 'Saldo Atual (C)', key: 'currBalCredit', width: 20 },
  ];

  // Bold header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' },
  };

  const currencyFormat = '#,##0.00';

  for (const row of balance.rows) {
    const prevBal = new Decimal(row.previousBalance);
    const currBal = new Decimal(row.currentBalance);

    const dataRow = sheet.addRow({
      code: row.accountCode,
      name: '  '.repeat(row.level - 1) + row.accountName,
      level: row.level,
      isSynthetic: row.isSynthetic ? 'Sintética' : 'Analítica',
      prevBalDebit: row.nature === 'DEVEDORA' && prevBal.gte(0) ? prevBal.toNumber() : 0,
      prevBalCredit: row.nature === 'CREDORA' && prevBal.gte(0) ? prevBal.toNumber() : 0,
      movDebit: parseFloat(row.debitMovement),
      movCredit: parseFloat(row.creditMovement),
      currBalDebit: row.nature === 'DEVEDORA' && currBal.gte(0) ? currBal.toNumber() : 0,
      currBalCredit: row.nature === 'CREDORA' && currBal.gte(0) ? currBal.toNumber() : 0,
    });

    // Bold synthetic rows
    if (row.isSynthetic) {
      dataRow.font = { bold: true };
    }

    // Apply number formats
    [
      'prevBalDebit',
      'prevBalCredit',
      'movDebit',
      'movCredit',
      'currBalDebit',
      'currBalCredit',
    ].forEach((key) => {
      dataRow.getCell(key).numFmt = currencyFormat;
    });
  }

  // Totals row
  const gt = balance.grandTotals;
  const totalsRow = sheet.addRow({
    code: 'TOTAL',
    name: '',
    level: '',
    isSynthetic: '',
    prevBalDebit: parseFloat(gt.previousBalanceDebit),
    prevBalCredit: parseFloat(gt.previousBalanceCredit),
    movDebit: parseFloat(gt.movementDebit),
    movCredit: parseFloat(gt.movementCredit),
    currBalDebit: parseFloat(gt.currentBalanceDebit),
    currBalCredit: parseFloat(gt.currentBalanceCredit),
  });
  totalsRow.font = { bold: true };
  totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF8' } };
  [
    'prevBalDebit',
    'prevBalCredit',
    'movDebit',
    'movCredit',
    'currBalDebit',
    'currBalCredit',
  ].forEach((key) => {
    totalsRow.getCell(key).numFmt = currencyFormat;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  res.write(Buffer.from(buffer));
  res.end();
}

// ─── exportDailyBookPdf ──────────────────────────────────────────────────────
// Pipes daily book PDF to response with "Termo de Abertura" and "Termo de Encerramento".

export async function exportDailyBookPdf(
  organizationId: string,
  filters: DailyBookFilters,
  res: Response,
): Promise<void> {
  const dailyBook = await getDailyBook(organizationId, filters);
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  // Termo de Abertura
  doc.fontSize(12).font('Helvetica-Bold').text('TERMO DE ABERTURA', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(
      `Livro Diário — Período: ${dailyBook.periodStart} a ${dailyBook.periodEnd}. ` +
        `Total de lançamentos: ${dailyBook.totalEntries}.`,
      { align: 'justify' },
    );
  doc.moveDown(1);

  // Entries
  for (const entry of dailyBook.entries) {
    const [yr, mo, dy] = entry.entryDate.split('-');
    const brDate = `${dy}/${mo}/${yr}`;

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Lançamento Nº ${entry.entryNumber} — ${brDate} — ${entry.description}`, {
      continued: false,
    });
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(8);
    for (const line of entry.lines) {
      const side = line.side === 'DEBIT' ? 'D' : 'C';
      doc.text(
        `  ${side}  ${line.accountCode} — ${line.accountName}  R$ ${line.amount}${line.description ? ' — ' + line.description : ''}`,
      );
    }
    doc.moveDown(0.5);

    if (doc.y > 750) {
      doc.addPage();
    }
  }

  // Termo de Encerramento
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').text('TERMO DE ENCERRAMENTO', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(
      `Encerramento do Livro Diário referente ao período de ${dailyBook.periodStart} a ${dailyBook.periodEnd}. ` +
        `Total de ${dailyBook.totalEntries} lançamentos registrados.`,
      { align: 'justify' },
    );

  doc.end();
}
