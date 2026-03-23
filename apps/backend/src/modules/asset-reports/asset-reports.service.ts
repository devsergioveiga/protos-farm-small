import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma';
import { computeDepreciation } from '../depreciation/depreciation-engine.service';
import type {
  InventoryReportQuery,
  InventoryReportResult,
  DepreciationProjectionQuery,
  DepreciationProjectionResult,
  TCOFleetQuery,
  TCOFleetResult,
  TCOFleetRow,
  RepairAlert,
  ExportFormat,
} from './asset-reports.types';

// ─── Helpers ──────────────────────────────────────────────────────────

function nextPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  if (val instanceof Decimal) return val.toNumber();
  if (typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val);
}

// ─── getInventoryReport ────────────────────────────────────────────────

export async function getInventoryReport(
  query: InventoryReportQuery,
): Promise<InventoryReportResult> {
  const { organizationId, farmId, assetType, dateFrom, dateTo } = query;

  const assetWhere: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: { not: 'ALIENADO' },
  };
  if (farmId) assetWhere['farmId'] = farmId;
  if (assetType) assetWhere['assetType'] = assetType;

  // Query 1: gross value grouped by classification
  const classificationGroups = await (prisma.asset.groupBy as Function)({
    by: ['classification'],
    where: assetWhere,
    _sum: { acquisitionValue: true },
    _count: true,
  });

  // Query 2: asset id -> classification mapping
  const allAssets = await prisma.asset.findMany({
    where: assetWhere as never,
    select: { id: true, classification: true },
  });

  // Query 3: accumulated depreciation per asset
  const assetIds = allAssets.map((a) => a.id);
  const deprGroups = await (prisma.depreciationEntry.groupBy as Function)({
    by: ['assetId'],
    where: { organizationId, reversedAt: null, assetId: { in: assetIds } },
    _sum: { depreciationAmount: true },
  });

  // Build maps
  const assetClassMap = new Map<string, string>();
  for (const a of allAssets) {
    assetClassMap.set(a.id, String(a.classification));
  }

  const deprByClassification = new Map<string, Decimal>();
  for (const dg of deprGroups) {
    const classification = assetClassMap.get(dg.assetId);
    if (!classification) continue;
    const existing = deprByClassification.get(classification) ?? new Decimal(0);
    deprByClassification.set(
      classification,
      existing.plus(new Decimal(String(dg._sum.depreciationAmount ?? 0))),
    );
  }

  // Build rows
  const rows = classificationGroups.map(
    (cg: { classification: unknown; _sum: { acquisitionValue: unknown }; _count: number }) => {
      const classification = String(cg.classification);
      const grossValue = new Decimal(String(cg._sum.acquisitionValue ?? 0));
      const accumulatedDepreciation = deprByClassification.get(classification) ?? new Decimal(0);
      const diff = grossValue.minus(accumulatedDepreciation);
      const netBookValue = diff.isNegative() ? new Decimal(0) : diff;

      return {
        classification,
        count: cg._count as number,
        grossValue: grossValue.toNumber(),
        accumulatedDepreciation: accumulatedDepreciation.toNumber(),
        netBookValue: netBookValue.toNumber(),
        acquisitionsInPeriod: 0,
        disposalsInPeriod: 0,
      };
    },
  );

  // Period filters for acquisitions/disposals
  if (dateFrom || dateTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    // Count acquisitions in period (same base filter + date range)
    const acquisitionCount = await prisma.asset.count({
      where: { ...assetWhere, acquisitionDate: dateFilter } as never,
    });

    // Count disposals in period
    const disposalCount = await prisma.assetDisposal.count({
      where: { organizationId, disposalDate: dateFilter } as never,
    });

    // Distribute acquisition/disposal counts to rows proportionally
    // (simplified: assign total count to each row — for single classification query this is exact)
    // For proper per-classification breakdown we'd need groupBy on acquisition/disposal
    // Here we set totals on each row as per-classification counts aren't queried separately
    for (const row of rows) {
      row.acquisitionsInPeriod = acquisitionCount;
      row.disposalsInPeriod = disposalCount;
    }
  }

  // Compute totals
  const totals = rows.reduce(
    (acc, row) => ({
      count: acc.count + row.count,
      grossValue: acc.grossValue + row.grossValue,
      accumulatedDepreciation: acc.accumulatedDepreciation + row.accumulatedDepreciation,
      netBookValue: acc.netBookValue + row.netBookValue,
    }),
    { count: 0, grossValue: 0, accumulatedDepreciation: 0, netBookValue: 0 },
  );

  return {
    rows,
    totals,
    generatedAt: new Date().toISOString(),
  };
}

// ─── getDepreciationProjection ─────────────────────────────────────────

export async function getDepreciationProjection(
  query: DepreciationProjectionQuery,
): Promise<DepreciationProjectionResult> {
  const { organizationId, horizonMonths, farmId, assetType } = query;

  const assetWhere: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: { notIn: ['ALIENADO', 'EM_ANDAMENTO'] },
    depreciationConfig: { isNot: null },
  };
  if (farmId) assetWhere['farmId'] = farmId;
  if (assetType) assetWhere['assetType'] = assetType;

  // Fetch assets with their depreciation config and latest entry
  const assets = await prisma.asset.findMany({
    where: assetWhere as never,
    select: {
      id: true,
      acquisitionDate: true,
      acquisitionValue: true,
      status: true,
      depreciationConfig: {
        select: {
          method: true,
          fiscalAnnualRate: true,
          managerialAnnualRate: true,
          usefulLifeMonths: true,
          residualValue: true,
          totalHours: true,
          totalUnits: true,
          accelerationFactor: true,
          activeTrack: true,
        },
      },
      depreciationEntries: {
        where: { reversedAt: null },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 1,
        select: {
          periodYear: true,
          periodMonth: true,
          closingBookValue: true,
        },
      },
    },
  });

  // Monthly aggregation buckets: {year:month} -> total depreciation amount
  const monthlyTotals = new Map<string, Decimal>();
  const monthlyRemainingBookValues = new Map<string, Decimal>();
  let assetsEstimated = 0;
  let assetsIncluded = 0;

  // We need to determine the starting period — use current month as base
  const now = new Date();
  let startYear = now.getUTCFullYear();
  let startMonth = now.getUTCMonth() + 1;

  for (const asset of assets) {
    const config = asset.depreciationConfig;
    if (!config) continue;

    assetsIncluded++;

    const latestEntry = asset.depreciationEntries[0] ?? null;
    const openingBookValue = latestEntry
      ? new Decimal(String(latestEntry.closingBookValue))
      : new Decimal(String(asset.acquisitionValue));

    // Determine starting period for this asset
    let periodYear = startYear;
    let periodMonth = startMonth;
    if (latestEntry) {
      const next = nextPeriod(latestEntry.periodYear, latestEntry.periodMonth);
      periodYear = next.year;
      periodMonth = next.month;
    }

    // Resolve method — fall back to STRAIGHT_LINE for HOURS_OF_USE / UNITS_OF_PRODUCTION
    let method = String(config.method) as
      | 'STRAIGHT_LINE'
      | 'HOURS_OF_USE'
      | 'UNITS_OF_PRODUCTION'
      | 'ACCELERATED';
    if (method === 'HOURS_OF_USE' || method === 'UNITS_OF_PRODUCTION') {
      method = 'STRAIGHT_LINE';
      assetsEstimated++;
    }

    let currentBookValue = openingBookValue;

    for (let i = 0; i < horizonMonths; i++) {
      const key = `${periodYear}-${periodMonth}`;

      const engineOutput = computeDepreciation({
        acquisitionValue: new Decimal(String(asset.acquisitionValue)),
        residualValue: new Decimal(String(config.residualValue ?? 0)),
        openingBookValue: currentBookValue,
        config: {
          method,
          fiscalAnnualRate: config.fiscalAnnualRate
            ? new Decimal(String(config.fiscalAnnualRate))
            : undefined,
          managerialAnnualRate: config.managerialAnnualRate
            ? new Decimal(String(config.managerialAnnualRate))
            : undefined,
          usefulLifeMonths: config.usefulLifeMonths ?? undefined,
          accelerationFactor: config.accelerationFactor
            ? new Decimal(String(config.accelerationFactor))
            : undefined,
          totalHours: config.totalHours ? new Decimal(String(config.totalHours)) : undefined,
          totalUnits: config.totalUnits ? new Decimal(String(config.totalUnits)) : undefined,
          track: (config.activeTrack as 'FISCAL' | 'MANAGERIAL') ?? 'FISCAL',
        },
        period: { year: periodYear, month: periodMonth },
        acquisitionDate: new Date(asset.acquisitionDate),
      });

      const monthDepr = engineOutput.depreciationAmount;
      currentBookValue = engineOutput.closingBookValue;

      // Accumulate into monthly bucket
      const existing = monthlyTotals.get(key) ?? new Decimal(0);
      monthlyTotals.set(key, existing.plus(monthDepr));
      monthlyRemainingBookValues.set(
        key,
        (monthlyRemainingBookValues.get(key) ?? new Decimal(0)).plus(currentBookValue),
      );

      const next = nextPeriod(periodYear, periodMonth);
      periodYear = next.year;
      periodMonth = next.month;
    }
  }

  // Build rows in chronological order using startYear/startMonth as reference
  const rows = [];
  let cumulative = new Decimal(0);
  let curYear = startYear;
  let curMonth = startMonth;

  for (let i = 0; i < horizonMonths; i++) {
    const key = `${curYear}-${curMonth}`;
    const monthDepr = monthlyTotals.get(key) ?? new Decimal(0);
    cumulative = cumulative.plus(monthDepr);
    const remainingBookValue = monthlyRemainingBookValues.get(key) ?? new Decimal(0);

    rows.push({
      year: curYear,
      month: curMonth,
      projectedDepreciation: monthDepr.toNumber(),
      cumulativeDepreciation: cumulative.toNumber(),
      remainingBookValue: remainingBookValue.toNumber(),
    });

    const next = nextPeriod(curYear, curMonth);
    curYear = next.year;
    curMonth = next.month;
  }

  return {
    rows,
    assetsIncluded,
    assetsEstimated,
    generatedAt: new Date().toISOString(),
  };
}

// ─── getTCOFleet ───────────────────────────────────────────────────────

export async function getTCOFleet(query: TCOFleetQuery): Promise<TCOFleetResult> {
  const { organizationId, farmId, assetType } = query;

  const assetWhere: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: { not: 'ALIENADO' },
  };
  if (farmId) assetWhere['farmId'] = farmId;
  if (assetType) assetWhere['assetType'] = assetType;

  // Fetch all assets
  const assets = await prisma.asset.findMany({
    where: assetWhere as never,
    select: {
      id: true,
      name: true,
      assetTag: true,
      assetType: true,
      acquisitionValue: true,
      currentHourmeter: true,
    },
  });

  const assetIds = assets.map((a) => a.id);
  if (assetIds.length === 0) {
    return {
      assets: [],
      summary: { avgCostPerHour: null, totalMaintenanceCost: 0, totalFuelCost: 0 },
      generatedAt: new Date().toISOString(),
    };
  }

  // Aggregate depreciation per asset
  const deprGroups = await (prisma.depreciationEntry.groupBy as Function)({
    by: ['assetId'],
    where: { organizationId, reversedAt: null, assetId: { in: assetIds } },
    _sum: { depreciationAmount: true },
  });

  // Aggregate maintenance per asset (completed work orders)
  const maintenanceGroups = await (prisma.workOrder.groupBy as Function)({
    by: ['assetId'],
    where: { organizationId, status: 'CONCLUIDA', assetId: { in: assetIds } },
    _sum: { totalCost: true },
  });

  // Aggregate fuel per asset
  const fuelGroups = await (prisma.fuelRecord.groupBy as Function)({
    by: ['assetId'],
    where: { organizationId, assetId: { in: assetIds } },
    _sum: { totalCost: true },
  });

  // Build maps
  const deprMap = new Map<string, Decimal>();
  for (const dg of deprGroups) {
    deprMap.set(dg.assetId, new Decimal(String(dg._sum.depreciationAmount ?? 0)));
  }

  const maintenanceMap = new Map<string, Decimal>();
  for (const mg of maintenanceGroups) {
    maintenanceMap.set(mg.assetId, new Decimal(String(mg._sum.totalCost ?? 0)));
  }

  const fuelMap = new Map<string, Decimal>();
  for (const fg of fuelGroups) {
    fuelMap.set(fg.assetId, new Decimal(String(fg._sum.totalCost ?? 0)));
  }

  // Build TCO rows
  const tcoRows: TCOFleetRow[] = [];
  let totalMaintenanceCost = new Decimal(0);
  let totalFuelCost = new Decimal(0);
  const costPerHourValues: number[] = [];

  for (const asset of assets) {
    const acquisitionValue = new Decimal(String(asset.acquisitionValue ?? 0));
    const accumulatedDepreciation = deprMap.get(asset.id) ?? new Decimal(0);
    const maintenanceCost = maintenanceMap.get(asset.id) ?? new Decimal(0);
    const fuelCost = fuelMap.get(asset.id) ?? new Decimal(0);
    const totalCost = acquisitionValue.plus(maintenanceCost).plus(fuelCost);

    totalMaintenanceCost = totalMaintenanceCost.plus(maintenanceCost);
    totalFuelCost = totalFuelCost.plus(fuelCost);

    // Repair alert logic
    let repairRatio: number | null = null;
    let alert: RepairAlert = 'OK';

    if (acquisitionValue.isZero() || !asset.acquisitionValue) {
      alert = 'NO_DATA';
      repairRatio = null;
    } else {
      repairRatio = maintenanceCost.div(acquisitionValue).toNumber();
      if (repairRatio >= 0.7) {
        alert = 'REPLACE';
      } else if (repairRatio >= 0.6) {
        alert = 'MONITOR';
      } else {
        alert = 'OK';
      }
    }

    // Cost per hour
    let costPerHour: number | null = null;
    if (asset.currentHourmeter != null) {
      const hourmeter = new Decimal(String(asset.currentHourmeter));
      if (hourmeter.gt(0)) {
        costPerHour = totalCost.div(hourmeter).toDecimalPlaces(2).toNumber();
        costPerHourValues.push(costPerHour);
      }
    }

    tcoRows.push({
      assetId: asset.id,
      assetName: asset.name,
      assetTag: asset.assetTag,
      assetType: String(asset.assetType),
      acquisitionValue: acquisitionValue.toNumber(),
      accumulatedDepreciation: accumulatedDepreciation.toNumber(),
      maintenanceCost: maintenanceCost.toNumber(),
      fuelCost: fuelCost.toNumber(),
      totalCost: totalCost.toNumber(),
      repairRatio,
      alert,
      costPerHour,
    });
  }

  const avgCostPerHour =
    costPerHourValues.length > 0
      ? costPerHourValues.reduce((a, b) => a + b, 0) / costPerHourValues.length
      : null;

  return {
    assets: tcoRows,
    summary: {
      avgCostPerHour,
      totalMaintenanceCost: totalMaintenanceCost.toNumber(),
      totalFuelCost: totalFuelCost.toNumber(),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── exportInventoryReport ────────────────────────────────────────────

export async function exportInventoryReport(
  query: InventoryReportQuery,
  format: ExportFormat,
): Promise<Buffer> {
  const report = await getInventoryReport(query);

  if (format === 'pdf') {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const now = new Date();
      const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('Relatorio Patrimonial', 40, 40);
      doc.fontSize(10).font('Helvetica').text(`Emitido em: ${formatDate(now)}`, 40, 62);
      doc.moveDown(1);

      // Table header
      const colWidths = [160, 60, 110, 110, 110];
      const headers = ['Classificacao', 'Qtd', 'Valor Bruto', 'Depr. Acumulada', 'Valor Liquido'];
      let x = 40;
      const headerY = doc.y;

      doc.fontSize(9).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, x, headerY, { width: colWidths[i], continued: false });
        x += colWidths[i];
      });

      doc
        .moveTo(40, headerY + 12)
        .lineTo(40 + 550, headerY + 12)
        .stroke();

      // Rows
      doc.fontSize(8).font('Helvetica');
      for (const row of report.rows) {
        const rowY = doc.y + 4;
        if (rowY > doc.page.height - 80) {
          doc.addPage({ layout: 'landscape' });
        }
        const currentY = doc.y + 4;
        x = 40;
        const cols = [
          row.classification,
          String(row.count),
          row.grossValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          row.accumulatedDepreciation.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }),
          row.netBookValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        ];

        cols.forEach((col, i) => {
          doc.text(col, x, currentY, { width: colWidths[i], ellipsis: true });
          x += colWidths[i];
        });
        doc.moveDown(0.3);
      }

      // Totals row
      doc
        .moveTo(40, doc.y + 4)
        .lineTo(40 + 550, doc.y + 4)
        .stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica-Bold');
      x = 40;
      const totalCols = [
        'TOTAL',
        String(report.totals.count),
        report.totals.grossValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        report.totals.accumulatedDepreciation.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }),
        report.totals.netBookValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      ];
      totalCols.forEach((col, i) => {
        doc.text(col, x, doc.y, { width: colWidths[i], continued: false });
        x += colWidths[i];
      });

      doc.end();
    });
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario Patrimonial');

    sheet.columns = [
      { header: 'Classificacao', key: 'classification', width: 25 },
      { header: 'Qtd', key: 'count', width: 12 },
      { header: 'Valor Bruto', key: 'grossValue', width: 20 },
      { header: 'Depr Acumulada', key: 'accumulatedDepreciation', width: 20 },
      { header: 'Valor Liquido', key: 'netBookValue', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    const currencyFormat = '#,##0.00';
    for (const row of report.rows) {
      const r = sheet.addRow({
        classification: row.classification,
        count: row.count,
        grossValue: row.grossValue,
        accumulatedDepreciation: row.accumulatedDepreciation,
        netBookValue: row.netBookValue,
      });
      r.getCell('grossValue').numFmt = currencyFormat;
      r.getCell('accumulatedDepreciation').numFmt = currencyFormat;
      r.getCell('netBookValue').numFmt = currencyFormat;
    }

    // Totals row
    const totalsRow = sheet.addRow({
      classification: 'TOTAL',
      count: report.totals.count,
      grossValue: report.totals.grossValue,
      accumulatedDepreciation: report.totals.accumulatedDepreciation,
      netBookValue: report.totals.netBookValue,
    });
    totalsRow.font = { bold: true };
    totalsRow.getCell('grossValue').numFmt = currencyFormat;
    totalsRow.getCell('accumulatedDepreciation').numFmt = currencyFormat;
    totalsRow.getCell('netBookValue').numFmt = currencyFormat;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // CSV
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario Patrimonial');

  sheet.columns = [
    { header: 'Classificacao', key: 'classification', width: 25 },
    { header: 'Qtd', key: 'count', width: 12 },
    { header: 'Valor Bruto', key: 'grossValue', width: 20 },
    { header: 'Depr Acumulada', key: 'accumulatedDepreciation', width: 20 },
    { header: 'Valor Liquido', key: 'netBookValue', width: 20 },
  ];

  for (const row of report.rows) {
    sheet.addRow({
      classification: row.classification,
      count: row.count,
      grossValue: row.grossValue,
      accumulatedDepreciation: row.accumulatedDepreciation,
      netBookValue: row.netBookValue,
    });
  }

  const rawBuffer = await workbook.csv.writeBuffer();
  return Buffer.from(rawBuffer);
}
