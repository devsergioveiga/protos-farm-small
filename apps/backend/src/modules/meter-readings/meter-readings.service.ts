import { Decimal } from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  MeterReadingError,
  type CreateMeterReadingInput,
  type ListMeterReadingsQuery,
} from './meter-readings.types';

// ─── Service functions ────────────────────────────────────────────────

export async function createMeterReading(
  ctx: RlsContext & { userId: string },
  input: CreateMeterReadingInput,
) {
  if (!input.assetId) throw new MeterReadingError('Ativo é obrigatório', 400);
  if (!input.readingDate) throw new MeterReadingError('Data da leitura é obrigatória', 400);
  if (!input.readingType) throw new MeterReadingError('Tipo de leitura é obrigatório', 400);
  if (input.value == null) throw new MeterReadingError('Valor da leitura é obrigatório', 400);

  const validTypes = ['HOURMETER', 'ODOMETER'];
  if (!validTypes.includes(input.readingType)) {
    throw new MeterReadingError('Tipo de leitura inválido. Use HOURMETER ou ODOMETER', 400);
  }

  return prisma.$transaction(async (tx) => {
    // Verify asset belongs to org
    const asset = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!asset) throw new MeterReadingError('Ativo não encontrado', 404);

    // Anti-regression check
    const lastReading = await tx.meterReading.findFirst({
      where: { assetId: input.assetId, readingType: input.readingType },
      orderBy: { readingDate: 'desc' },
      select: { value: true },
    });

    const newValue = new Decimal(String(input.value));

    if (lastReading != null) {
      const lastValue = new Decimal(String(lastReading.value));
      if (newValue.lte(lastValue)) {
        const unit = input.readingType === 'HOURMETER' ? 'h' : 'km';
        throw new MeterReadingError(
          `Leitura nao pode ser menor ou igual a ultima registrada (${lastValue.toFixed(2)} ${unit}).`,
          400,
        );
      }
    }

    // Create reading
    const reading = await tx.meterReading.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: input.assetId,
        readingDate: new Date(input.readingDate),
        readingType: input.readingType,
        value: newValue.toDecimalPlaces(2).toString(),
        previousValue: lastReading ? String(lastReading.value) : null,
        createdBy: ctx.userId,
      },
    });

    // Update Asset snapshot
    const snapshotField =
      input.readingType === 'HOURMETER' ? 'currentHourmeter' : 'currentOdometer';
    await tx.asset.update({
      where: { id: input.assetId },
      data: { [snapshotField]: newValue.toDecimalPlaces(2).toString() },
    });

    return { ...reading, asset: { name: asset.name } };
  });
}

export async function listMeterReadings(ctx: RlsContext, query: ListMeterReadingsQuery) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId };

  if (query.assetId) where['assetId'] = query.assetId;
  if (query.readingType) where['readingType'] = query.readingType;

  const [data, total] = await Promise.all([
    prisma.meterReading.findMany({
      where: where as never,
      include: { asset: { select: { name: true } } },
      orderBy: { readingDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.meterReading.count({ where: where as never }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLatestReadings(ctx: RlsContext, assetId: string) {
  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!asset) throw new MeterReadingError('Ativo não encontrado', 404);

  const [latestHourmeter, latestOdometer] = await Promise.all([
    prisma.meterReading.findFirst({
      where: { assetId, readingType: 'HOURMETER' },
      orderBy: { readingDate: 'desc' },
    }),
    prisma.meterReading.findFirst({
      where: { assetId, readingType: 'ODOMETER' },
      orderBy: { readingDate: 'desc' },
    }),
  ]);

  return {
    hourmeter: latestHourmeter ?? null,
    odometer: latestOdometer ?? null,
  };
}
