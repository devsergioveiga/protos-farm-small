import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma';
import {
  DepreciationError,
  type CreateDepreciationConfigInput,
  type UpdateDepreciationConfigInput,
  type DepreciationReportQuery,
  type RlsContext,
} from './depreciation.types';

// ─── Config CRUD ──────────────────────────────────────────────────────

export async function createConfig(rls: RlsContext, input: CreateDepreciationConfigInput) {
  // Validate asset exists and belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, organizationId: rls.organizationId, deletedAt: null },
    select: { id: true, classification: true },
  });

  if (!asset) {
    throw new DepreciationError('Ativo não encontrado', 404);
  }

  // Reject non-depreciable classifications
  if (
    asset.classification === 'NON_DEPRECIABLE_CPC27' ||
    asset.classification === 'FAIR_VALUE_CPC29'
  ) {
    throw new DepreciationError('Ativo nao depreciavel', 400);
  }

  return prisma.depreciationConfig.create({
    data: {
      organizationId: rls.organizationId,
      assetId: input.assetId,
      method: (input.method as never) ?? 'STRAIGHT_LINE',
      fiscalAnnualRate:
        input.fiscalAnnualRate != null ? new Decimal(input.fiscalAnnualRate) : undefined,
      managerialAnnualRate:
        input.managerialAnnualRate != null ? new Decimal(input.managerialAnnualRate) : undefined,
      usefulLifeMonths: input.usefulLifeMonths ?? undefined,
      residualValue:
        input.residualValue != null ? new Decimal(input.residualValue) : new Decimal(0),
      totalHours: input.totalHours != null ? new Decimal(input.totalHours) : undefined,
      totalUnits: input.totalUnits != null ? new Decimal(input.totalUnits) : undefined,
      accelerationFactor:
        input.accelerationFactor != null ? new Decimal(input.accelerationFactor) : undefined,
      activeTrack: (input.activeTrack as never) ?? 'FISCAL',
    },
    include: {
      asset: {
        select: { id: true, name: true, assetType: true, assetTag: true, classification: true },
      },
    },
  });
}

export async function getConfig(rls: RlsContext, assetId: string) {
  return prisma.depreciationConfig.findFirst({
    where: { assetId, organizationId: rls.organizationId },
    include: {
      asset: {
        select: { id: true, name: true, assetType: true, assetTag: true, classification: true },
      },
    },
  });
}

export async function updateConfig(
  rls: RlsContext,
  assetId: string,
  input: UpdateDepreciationConfigInput,
) {
  const existing = await prisma.depreciationConfig.findFirst({
    where: { assetId, organizationId: rls.organizationId },
  });

  if (!existing) {
    throw new DepreciationError('Configuração de depreciação não encontrada', 404);
  }

  return prisma.depreciationConfig.update({
    where: { assetId },
    data: {
      method: (input.method as never) ?? undefined,
      fiscalAnnualRate:
        input.fiscalAnnualRate != null ? new Decimal(input.fiscalAnnualRate) : undefined,
      managerialAnnualRate:
        input.managerialAnnualRate != null ? new Decimal(input.managerialAnnualRate) : undefined,
      usefulLifeMonths: input.usefulLifeMonths ?? undefined,
      residualValue: input.residualValue != null ? new Decimal(input.residualValue) : undefined,
      totalHours: input.totalHours != null ? new Decimal(input.totalHours) : undefined,
      totalUnits: input.totalUnits != null ? new Decimal(input.totalUnits) : undefined,
      accelerationFactor:
        input.accelerationFactor != null ? new Decimal(input.accelerationFactor) : undefined,
      activeTrack: (input.activeTrack as never) ?? undefined,
    },
    include: {
      asset: {
        select: { id: true, name: true, assetType: true, assetTag: true, classification: true },
      },
    },
  });
}

export async function deleteConfig(rls: RlsContext, assetId: string) {
  const existing = await prisma.depreciationConfig.findFirst({
    where: { assetId, organizationId: rls.organizationId },
  });

  if (!existing) {
    throw new DepreciationError('Configuração de depreciação não encontrada', 404);
  }

  return prisma.depreciationConfig.delete({ where: { assetId } });
}

// ─── Report ────────────────────────────────────────────────────────────

export async function getReport(query: DepreciationReportQuery) {
  const { organizationId, periodYear, periodMonth, track, assetId, page = 1, limit = 20 } = query;

  const where = {
    organizationId,
    periodYear,
    periodMonth,
    ...(track ? { track: track as never } : {}),
    ...(assetId ? { assetId } : {}),
    reversedAt: null,
  };

  const [entries, total] = await Promise.all([
    prisma.depreciationEntry.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ asset: { name: 'asc' } }, { createdAt: 'desc' }],
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetType: true,
            assetTag: true,
          },
        },
        run: {
          select: { id: true, triggeredBy: true, startedAt: true },
        },
        ccItems: {
          include: {
            costCenter: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.depreciationEntry.count({ where }),
  ]);

  return { entries, total, page, limit };
}

export async function exportReport(
  query: DepreciationReportQuery,
  format: 'csv' | 'xlsx',
): Promise<Buffer> {
  const { organizationId, periodYear, periodMonth, track } = query;

  const entries = await prisma.depreciationEntry.findMany({
    where: {
      organizationId,
      periodYear,
      periodMonth,
      ...(track ? { track: track as never } : {}),
      reversedAt: null,
    },
    orderBy: { asset: { name: 'asc' } },
    include: {
      asset: {
        select: { name: true, assetType: true, assetTag: true },
      },
      ccItems: {
        include: {
          costCenter: { select: { name: true } },
        },
      },
    },
  });

  if (format === 'csv') {
    const headers = 'Ativo,Tipo,Tag,Valor Anterior,Depreciacao,Valor Atual,Centro de Custo,Track';
    const rows = entries.map((e) => {
      const ccNames = e.ccItems.map((cc) => cc.costCenter.name).join('; ');
      return [
        `"${e.asset.name}"`,
        e.asset.assetType,
        e.asset.assetTag,
        e.openingBookValue.toString(),
        e.depreciationAmount.toString(),
        e.closingBookValue.toString(),
        `"${ccNames}"`,
        e.track,
      ].join(',');
    });
    const csv = [headers, ...rows].join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  // XLSX format
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Depreciação');

  sheet.columns = [
    { header: 'Ativo', key: 'name', width: 30 },
    { header: 'Tipo', key: 'assetType', width: 15 },
    { header: 'Tag', key: 'assetTag', width: 12 },
    { header: 'Valor Anterior', key: 'openingBookValue', width: 18 },
    { header: 'Depreciação', key: 'depreciationAmount', width: 18 },
    { header: 'Valor Atual', key: 'closingBookValue', width: 18 },
    { header: 'Centro de Custo', key: 'costCenter', width: 25 },
    { header: 'Track', key: 'track', width: 12 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };

  const currencyFormat = '#,##0.00';
  entries.forEach((e) => {
    const ccNames = e.ccItems.map((cc) => cc.costCenter.name).join('; ');
    const row = sheet.addRow({
      name: e.asset.name,
      assetType: e.asset.assetType,
      assetTag: e.asset.assetTag,
      openingBookValue: parseFloat(e.openingBookValue.toString()),
      depreciationAmount: parseFloat(e.depreciationAmount.toString()),
      closingBookValue: parseFloat(e.closingBookValue.toString()),
      costCenter: ccNames,
      track: e.track,
    });

    // Apply currency format to numeric columns
    row.getCell('openingBookValue').numFmt = currencyFormat;
    row.getCell('depreciationAmount').numFmt = currencyFormat;
    row.getCell('closingBookValue').numFmt = currencyFormat;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function getLastRun(
  organizationId: string,
  periodYear: number,
  periodMonth: number,
  track?: string,
) {
  return prisma.depreciationRun.findFirst({
    where: {
      organizationId,
      periodYear,
      periodMonth,
      ...(track ? { track: track as never } : {}),
    },
    orderBy: { startedAt: 'desc' },
  });
}
