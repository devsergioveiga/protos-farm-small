import { Money } from '@protos-farm/shared';
import ExcelJS from 'exceljs';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PAYABLE_DFC_MAP,
  RECEIVABLE_DFC_MAP,
  type CashflowQuery,
  type CashflowProjection,
  type ProjectionPoint,
  type DfcEntry,
  type DfcSummary,
  type DfcCategory,
} from './cashflow.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ─────────────────────────────────────────────────────────

const PT_BR_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function monthLabel(year: number, month: number): string {
  const m = PT_BR_MONTHS[month - 1] ?? String(month);
  const y = String(year).slice(-2);
  return `${m} ${y}`;
}

function yearMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonthsUtc(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function recurrenceIntervalMonths(freq: string): number {
  if (freq === 'WEEKLY') return 0; // handled separately
  if (freq === 'BIWEEKLY') return 0;
  if (freq === 'MONTHLY') return 1;
  return 1;
}

function recurrenceIntervalDays(freq: string): number | null {
  if (freq === 'WEEKLY') return 7;
  if (freq === 'BIWEEKLY') return 14;
  return null;
}

// ─── getProjection ────────────────────────────────────────────────────

export async function getProjection(
  ctx: RlsContext,
  query: CashflowQuery,
): Promise<CashflowProjection> {
  const { farmId } = query;

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const endDate = new Date(todayUtc.getTime() + 365 * 86400000);

  return withRlsContext(ctx, async (tx) => {
    // ── Current consolidated balance ──────────────────────────────────
    const bankAccountWhere: any = {
      organizationId: ctx.organizationId,
      isActive: true,
    };
    if (farmId) {
      bankAccountWhere.farms = { some: { farmId } };
    }

    const activeAccounts = await (tx as any).bankAccount.findMany({
      where: bankAccountWhere,
      include: { balance: true },
    });

    let currentBalance = Money(0);
    for (const acc of activeAccounts) {
      currentBalance = currentBalance.add(
        Money.fromPrismaDecimal(acc.balance?.currentBalance ?? 0),
      );
    }
    const currentBalanceNum = currentBalance.toNumber();

    // ── Query open PayableInstallments ────────────────────────────────
    const payableInstWhere: any = {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { gte: todayUtc, lte: endDate },
      payable: { organizationId: ctx.organizationId },
    };
    if (farmId) {
      payableInstWhere.payable = { ...payableInstWhere.payable, farmId };
    }

    const payableInsts = await (tx as any).payableInstallment.findMany({
      where: payableInstWhere,
      include: {
        payable: {
          select: {
            category: true,
            recurrenceFrequency: true,
            recurrenceEndDate: true,
          },
        },
      },
    });

    // ── Query open ReceivableInstallments ─────────────────────────────
    const receivableInstWhere: any = {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { gte: todayUtc, lte: endDate },
      receivable: { organizationId: ctx.organizationId },
    };
    if (farmId) {
      receivableInstWhere.receivable = { ...receivableInstWhere.receivable, farmId };
    }

    const receivableInsts = await (tx as any).receivableInstallment.findMany({
      where: receivableInstWhere,
      include: {
        receivable: {
          select: {
            category: true,
            recurrenceFrequency: true,
            recurrenceEndDate: true,
          },
        },
      },
    });

    // ── Query Checks A_COMPENSAR ──────────────────────────────────────
    const checksWhere: any = {
      organizationId: ctx.organizationId,
      status: 'A_COMPENSAR',
      expectedCompensationDate: { gte: todayUtc, lte: endDate },
    };
    if (farmId) {
      checksWhere.bankAccount = { farms: { some: { farmId } } };
    }

    const checks = await (tx as any).check.findMany({
      where: checksWhere,
      select: { type: true, amount: true, expectedCompensationDate: true },
    });

    // ── Also handle recurring CP/CR: project virtual installments ─────
    // For installments with recurrenceFrequency, check if recurrenceEndDate is beyond
    // the last existing installment and project future virtual amounts.
    // Collect parent IDs that have recurring payables
    const recurringPayableParents = new Map<
      string,
      {
        category: string;
        recurrenceFrequency: string;
        recurrenceEndDate: Date;
        lastDueDate: Date;
        amount: any;
      }
    >();

    for (const inst of payableInsts) {
      const p = inst.payable;
      if (p?.recurrenceFrequency && p?.recurrenceEndDate) {
        const parentKey = `${inst.payableId ?? inst.id}`;
        const existing = recurringPayableParents.get(parentKey);
        const thisDue = inst.dueDate as Date;
        if (!existing || thisDue > existing.lastDueDate) {
          recurringPayableParents.set(parentKey, {
            category: p.category,
            recurrenceFrequency: p.recurrenceFrequency,
            recurrenceEndDate: p.recurrenceEndDate as Date,
            lastDueDate: thisDue,
            amount: inst.amount,
          });
        }
      }
    }

    const recurringReceivableParents = new Map<
      string,
      {
        category: string;
        recurrenceFrequency: string;
        recurrenceEndDate: Date;
        lastDueDate: Date;
        amount: any;
      }
    >();

    for (const inst of receivableInsts) {
      const r = inst.receivable;
      if (r?.recurrenceFrequency && r?.recurrenceEndDate) {
        const parentKey = `${inst.receivableId ?? inst.id}`;
        const existing = recurringReceivableParents.get(parentKey);
        const thisDue = inst.dueDate as Date;
        if (!existing || thisDue > existing.lastDueDate) {
          recurringReceivableParents.set(parentKey, {
            category: r.category,
            recurrenceFrequency: r.recurrenceFrequency,
            recurrenceEndDate: r.recurrenceEndDate as Date,
            lastDueDate: thisDue,
            amount: inst.amount,
          });
        }
      }
    }

    // ── Build monthly buckets ─────────────────────────────────────────
    type Bucket = {
      inflows: ReturnType<typeof Money>;
      outflows: ReturnType<typeof Money>;
      checksPending: ReturnType<typeof Money>;
      inflowsByCategory: Map<string, ReturnType<typeof Money>>;
      outflowsByCategory: Map<string, ReturnType<typeof Money>>;
    };

    const buckets = new Map<string, Bucket>();

    function getOrCreateBucket(key: string): Bucket {
      if (!buckets.has(key)) {
        buckets.set(key, {
          inflows: Money(0),
          outflows: Money(0),
          checksPending: Money(0),
          inflowsByCategory: new Map(),
          outflowsByCategory: new Map(),
        });
      }
      return buckets.get(key)!;
    }

    // Add payable installments
    for (const inst of payableInsts) {
      const dueDate = inst.dueDate as Date;
      const key = yearMonthKey(dueDate);
      const bucket = getOrCreateBucket(key);
      const amt = Money.fromPrismaDecimal(inst.amount);
      bucket.outflows = bucket.outflows.add(amt);
      const cat = (inst.payable?.category as string) ?? 'OTHER';
      const existing = bucket.outflowsByCategory.get(cat) ?? Money(0);
      bucket.outflowsByCategory.set(cat, existing.add(amt));
    }

    // Add receivable installments
    for (const inst of receivableInsts) {
      const dueDate = inst.dueDate as Date;
      const key = yearMonthKey(dueDate);
      const bucket = getOrCreateBucket(key);
      const amt = Money.fromPrismaDecimal(inst.amount);
      bucket.inflows = bucket.inflows.add(amt);
      const cat = (inst.receivable?.category as string) ?? 'OTHER';
      const existing = bucket.inflowsByCategory.get(cat) ?? Money(0);
      bucket.inflowsByCategory.set(cat, existing.add(amt));
    }

    // Add virtual recurring payable projections
    for (const [, parent] of recurringPayableParents) {
      const { recurrenceFrequency, recurrenceEndDate, lastDueDate, amount, category } = parent;
      const intervalDays = recurrenceIntervalDays(recurrenceFrequency);
      const intervalMonths = recurrenceIntervalMonths(recurrenceFrequency);
      const amt = Money.fromPrismaDecimal(amount);

      if (intervalDays !== null) {
        // Day-based recurrence (WEEKLY, BIWEEKLY)
        let nextDate = new Date(lastDueDate.getTime() + intervalDays * 86400000);
        while (nextDate <= recurrenceEndDate && nextDate <= endDate) {
          const key = yearMonthKey(nextDate);
          const bucket = getOrCreateBucket(key);
          bucket.outflows = bucket.outflows.add(amt);
          const existing = bucket.outflowsByCategory.get(category) ?? Money(0);
          bucket.outflowsByCategory.set(category, existing.add(amt));
          nextDate = new Date(nextDate.getTime() + intervalDays * 86400000);
        }
      } else {
        // Month-based recurrence (MONTHLY)
        let nextDate = addMonthsUtc(lastDueDate, intervalMonths);
        while (nextDate <= recurrenceEndDate && nextDate <= endDate) {
          const key = yearMonthKey(nextDate);
          const bucket = getOrCreateBucket(key);
          bucket.outflows = bucket.outflows.add(amt);
          const existing = bucket.outflowsByCategory.get(category) ?? Money(0);
          bucket.outflowsByCategory.set(category, existing.add(amt));
          nextDate = addMonthsUtc(nextDate, intervalMonths);
        }
      }
    }

    // Add virtual recurring receivable projections
    for (const [, parent] of recurringReceivableParents) {
      const { recurrenceFrequency, recurrenceEndDate, lastDueDate, amount, category } = parent;
      const intervalDays = recurrenceIntervalDays(recurrenceFrequency);
      const intervalMonths = recurrenceIntervalMonths(recurrenceFrequency);
      const amt = Money.fromPrismaDecimal(amount);

      if (intervalDays !== null) {
        let nextDate = new Date(lastDueDate.getTime() + intervalDays * 86400000);
        while (nextDate <= recurrenceEndDate && nextDate <= endDate) {
          const key = yearMonthKey(nextDate);
          const bucket = getOrCreateBucket(key);
          bucket.inflows = bucket.inflows.add(amt);
          const existing = bucket.inflowsByCategory.get(category) ?? Money(0);
          bucket.inflowsByCategory.set(category, existing.add(amt));
          nextDate = new Date(nextDate.getTime() + intervalDays * 86400000);
        }
      } else {
        let nextDate = addMonthsUtc(lastDueDate, intervalMonths);
        while (nextDate <= recurrenceEndDate && nextDate <= endDate) {
          const key = yearMonthKey(nextDate);
          const bucket = getOrCreateBucket(key);
          bucket.inflows = bucket.inflows.add(amt);
          const existing = bucket.inflowsByCategory.get(category) ?? Money(0);
          bucket.inflowsByCategory.set(category, existing.add(amt));
          nextDate = addMonthsUtc(nextDate, intervalMonths);
        }
      }
    }

    // Add checks A_COMPENSAR
    for (const ch of checks) {
      const compDate = ch.expectedCompensationDate as Date;
      const key = yearMonthKey(compDate);
      const bucket = getOrCreateBucket(key);
      const amt = Money.fromPrismaDecimal(ch.amount);
      bucket.checksPending = bucket.checksPending.add(amt);
      if (ch.type === 'EMITIDO') {
        bucket.outflows = bucket.outflows.add(amt);
      } else {
        // RECEBIDO
        bucket.inflows = bucket.inflows.add(amt);
      }
    }

    // ── Build 12-month projection points ─────────────────────────────
    const projectionPoints: ProjectionPoint[] = [];
    let realisticBalance = currentBalance;
    let optimisticBalance = currentBalance;
    let pessimisticBalance = currentBalance;
    let negativeBalanceDate: string | null = null;
    let negativeBalanceAmount: number | null = null;

    // Track per-category monthly amounts for DFC
    const dfcOutflows = new Map<string, number[]>(); // category -> 12 monthly amounts
    const dfcInflows = new Map<string, number[]>(); // category -> 12 monthly amounts

    for (let i = 0; i < 12; i++) {
      const monthDate = addMonthsUtc(todayUtc, i);
      const key = yearMonthKey(monthDate);
      const year = monthDate.getUTCFullYear();
      const month = monthDate.getUTCMonth() + 1;

      const bucket = buckets.get(key);
      const inflows = bucket?.inflows ?? Money(0);
      const outflows = bucket?.outflows ?? Money(0);
      const checksPending = bucket?.checksPending ?? Money(0);

      // Realistic: raw
      realisticBalance = realisticBalance.add(inflows).subtract(outflows);

      // Optimistic: inflows * 1.10, outflows * 0.95
      const optInflows = Money(inflows.toNumber() * 1.1);
      const optOutflows = Money(outflows.toNumber() * 0.95);
      optimisticBalance = optimisticBalance.add(optInflows).subtract(optOutflows);

      // Pessimistic: inflows * 0.90, outflows * 1.15
      const pesInflows = Money(inflows.toNumber() * 0.9);
      const pesOutflows = Money(outflows.toNumber() * 1.15);
      pessimisticBalance = pessimisticBalance.add(pesInflows).subtract(pesOutflows);

      const realisticNum = realisticBalance.toNumber();

      // Detect first negative balance
      if (negativeBalanceDate === null && realisticNum < 0) {
        negativeBalanceDate = key;
        negativeBalanceAmount = realisticNum;
      }

      projectionPoints.push({
        date: key,
        label: monthLabel(year, month),
        balanceRealistic: realisticNum,
        balanceOptimistic: optimisticBalance.toNumber(),
        balancePessimistic: pessimisticBalance.toNumber(),
        inflows: inflows.toNumber(),
        outflows: outflows.toNumber(),
        checksPending: checksPending.toNumber(),
      });

      // Accumulate DFC data
      if (bucket) {
        for (const [cat, amt] of bucket.outflowsByCategory) {
          if (!dfcOutflows.has(cat)) dfcOutflows.set(cat, Array(12).fill(0));
          dfcOutflows.get(cat)![i] = (dfcOutflows.get(cat)![i] ?? 0) + amt.toNumber();
        }
        for (const [cat, amt] of bucket.inflowsByCategory) {
          if (!dfcInflows.has(cat)) dfcInflows.set(cat, Array(12).fill(0));
          dfcInflows.get(cat)![i] = (dfcInflows.get(cat)![i] ?? 0) + amt.toNumber();
        }
      }
    }

    // ── Build DFC summary ─────────────────────────────────────────────
    const dfcOutflowEntries: DfcEntry[] = [];
    for (const [cat, monthly] of dfcOutflows) {
      const dfcClass: DfcCategory = PAYABLE_DFC_MAP[cat] ?? 'OPERACIONAL';
      dfcOutflowEntries.push({
        category: cat,
        dfcClass,
        monthlyAmounts: monthly,
        total: monthly.reduce((a, b) => a + b, 0),
      });
    }

    const dfcInflowEntries: DfcEntry[] = [];
    for (const [cat, monthly] of dfcInflows) {
      const dfcClass: DfcCategory = RECEIVABLE_DFC_MAP[cat] ?? 'OPERACIONAL';
      dfcInflowEntries.push({
        category: cat,
        dfcClass,
        monthlyAmounts: monthly,
        total: monthly.reduce((a, b) => a + b, 0),
      });
    }

    const dfcTotals = {
      OPERACIONAL: { totalInflows: 0, totalOutflows: 0 },
      INVESTIMENTO: { totalInflows: 0, totalOutflows: 0 },
      FINANCIAMENTO: { totalInflows: 0, totalOutflows: 0 },
    };

    for (const entry of dfcInflowEntries) {
      dfcTotals[entry.dfcClass].totalInflows += entry.total;
    }
    for (const entry of dfcOutflowEntries) {
      dfcTotals[entry.dfcClass].totalOutflows += entry.total;
    }

    const dfc: DfcSummary = {
      inflows: dfcInflowEntries,
      outflows: dfcOutflowEntries,
      operacional: {
        totalInflows: dfcTotals.OPERACIONAL.totalInflows,
        totalOutflows: dfcTotals.OPERACIONAL.totalOutflows,
        net: dfcTotals.OPERACIONAL.totalInflows - dfcTotals.OPERACIONAL.totalOutflows,
      },
      investimento: {
        totalInflows: dfcTotals.INVESTIMENTO.totalInflows,
        totalOutflows: dfcTotals.INVESTIMENTO.totalOutflows,
        net: dfcTotals.INVESTIMENTO.totalInflows - dfcTotals.INVESTIMENTO.totalOutflows,
      },
      financiamento: {
        totalInflows: dfcTotals.FINANCIAMENTO.totalInflows,
        totalOutflows: dfcTotals.FINANCIAMENTO.totalOutflows,
        net: dfcTotals.FINANCIAMENTO.totalInflows - dfcTotals.FINANCIAMENTO.totalOutflows,
      },
    };

    return {
      currentBalance: currentBalanceNum,
      projectionPoints,
      negativeBalanceDate,
      negativeBalanceAmount,
      dfc,
    };
  });
}

// ─── getNegativeBalanceAlert ──────────────────────────────────────────

export async function getNegativeBalanceAlert(
  ctx: RlsContext,
  farmId?: string,
): Promise<{ date: string; amount: number } | null> {
  const projection = await getProjection(ctx, { farmId });
  if (projection.negativeBalanceDate === null) {
    return null;
  }
  return {
    date: projection.negativeBalanceDate,
    amount: projection.negativeBalanceAmount!,
  };
}

// ─── formatBRL ───────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── exportProjectionPdf ──────────────────────────────────────────────

export async function exportProjectionPdf(ctx: RlsContext, query: CashflowQuery): Promise<Buffer> {
  const projection = await getProjection(ctx, query);
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Fluxo de Caixa - Projecao 12 Meses', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Saldo atual: ${formatBRL(projection.currentBalance)}`, { align: 'center' });
    doc.moveDown(1);

    // Alert
    if (projection.negativeBalanceDate) {
      doc
        .fontSize(10)
        .fillColor('red')
        .text(
          `ALERTA: Saldo negativo previsto em ${projection.negativeBalanceDate} (${formatBRL(projection.negativeBalanceAmount!)})`,
          { align: 'center' },
        );
      doc.fillColor('black');
      doc.moveDown(0.5);
    }

    // Table header
    const colWidths = [60, 100, 100, 110, 90, 90];
    const headers = [
      'Mes',
      'Saldo Realista',
      'Saldo Otimista',
      'Saldo Pessimista',
      'Entradas',
      'Saidas',
    ];
    let x = 40;
    const headerY = doc.y;

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, headerY, { width: colWidths[i], align: 'right' });
      x += colWidths[i];
    });
    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica').fontSize(8);
    for (const pt of projection.projectionPoints) {
      let rx = 40;
      const rowY = doc.y;
      const cols = [
        pt.label,
        formatBRL(pt.balanceRealistic),
        formatBRL(pt.balanceOptimistic),
        formatBRL(pt.balancePessimistic),
        formatBRL(pt.inflows),
        formatBRL(pt.outflows),
      ];

      if (pt.balanceRealistic < 0) {
        doc.fillColor('red');
      }

      cols.forEach((c, i) => {
        doc.text(c, rx, rowY, { width: colWidths[i], align: 'right' });
        rx += colWidths[i];
      });
      doc.fillColor('black');
      doc.moveDown(0.2);
    }

    doc.moveDown(1);

    // DFC section
    doc.fontSize(12).font('Helvetica-Bold').text('Demonstrativo de Fluxo de Caixa (DFC)');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');

    const dfcRows = [
      ['Operacional - Entradas', formatBRL(projection.dfc.operacional.totalInflows)],
      ['Operacional - Saidas', formatBRL(projection.dfc.operacional.totalOutflows)],
      ['Operacional - Resultado', formatBRL(projection.dfc.operacional.net)],
      ['Investimento - Entradas', formatBRL(projection.dfc.investimento.totalInflows)],
      ['Investimento - Saidas', formatBRL(projection.dfc.investimento.totalOutflows)],
      ['Investimento - Resultado', formatBRL(projection.dfc.investimento.net)],
      ['Financiamento - Entradas', formatBRL(projection.dfc.financiamento.totalInflows)],
      ['Financiamento - Saidas', formatBRL(projection.dfc.financiamento.totalOutflows)],
      ['Financiamento - Resultado', formatBRL(projection.dfc.financiamento.net)],
    ];

    for (const row of dfcRows) {
      doc.text(`${row[0]}: ${row[1]}`);
    }

    doc.end();
  });
}

// ─── exportProjectionExcel ────────────────────────────────────────────

export async function exportProjectionExcel(
  ctx: RlsContext,
  query: CashflowQuery,
): Promise<Buffer> {
  const projection = await getProjection(ctx, query);
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Projecao
  const sheet1 = workbook.addWorksheet('Projecao');
  sheet1.columns = [
    { header: 'Mes', key: 'label', width: 12 },
    { header: 'Saldo Realista', key: 'balanceRealistic', width: 18 },
    { header: 'Saldo Otimista', key: 'balanceOptimistic', width: 18 },
    { header: 'Saldo Pessimista', key: 'balancePessimistic', width: 18 },
    { header: 'Entradas', key: 'inflows', width: 15 },
    { header: 'Saidas', key: 'outflows', width: 15 },
    { header: 'Cheques Pendentes', key: 'checksPending', width: 20 },
  ];

  const brlFmt = 'R$ #,##0.00';

  for (const pt of projection.projectionPoints) {
    const row = sheet1.addRow({
      label: pt.label,
      balanceRealistic: pt.balanceRealistic,
      balanceOptimistic: pt.balanceOptimistic,
      balancePessimistic: pt.balancePessimistic,
      inflows: pt.inflows,
      outflows: pt.outflows,
      checksPending: pt.checksPending,
    });
    // Format monetary cells
    [
      'balanceRealistic',
      'balanceOptimistic',
      'balancePessimistic',
      'inflows',
      'outflows',
      'checksPending',
    ].forEach((col) => {
      const cell = row.getCell(col);
      cell.numFmt = brlFmt;
    });
    // Highlight negative realistic balance
    if (pt.balanceRealistic < 0) {
      row.getCell('balanceRealistic').font = { color: { argb: 'FFCC0000' } };
    }
  }

  // Sheet 2: DFC
  const sheet2 = workbook.addWorksheet('DFC');
  sheet2.columns = [
    { header: 'Classe DFC', key: 'classe', width: 20 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Total 12M', key: 'total', width: 18 },
  ];

  for (const entry of projection.dfc.inflows) {
    const row = sheet2.addRow({
      classe: entry.dfcClass,
      tipo: 'Entrada',
      categoria: entry.category,
      total: entry.total,
    });
    row.getCell('total').numFmt = brlFmt;
  }
  for (const entry of projection.dfc.outflows) {
    const row = sheet2.addRow({
      classe: entry.dfcClass,
      tipo: 'Saida',
      categoria: entry.category,
      total: entry.total,
    });
    row.getCell('total').numFmt = brlFmt;
  }

  // Summary rows
  sheet2.addRow({});
  const classes: DfcCategory[] = ['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO'];
  for (const cls of classes) {
    const data =
      projection.dfc[cls.toLowerCase() as 'operacional' | 'investimento' | 'financiamento'];
    const summaryRow = sheet2.addRow({
      classe: cls,
      tipo: 'Resultado',
      categoria: 'TOTAL',
      total: data.net,
    });
    summaryRow.getCell('total').numFmt = brlFmt;
    summaryRow.font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
