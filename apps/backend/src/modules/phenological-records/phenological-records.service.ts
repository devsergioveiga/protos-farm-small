import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PhenoRecordError,
  type PhenoRecordItem,
  type CreatePhenoRecordInput,
  type ListPhenoRecordsQuery,
} from './phenological-records.types';

function toItem(row: Record<string, unknown>): PhenoRecordItem {
  const plot = row.fieldPlot as Record<string, unknown> | undefined;
  const recorder = row.recorder as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: (plot?.name as string) ?? '',
    crop: row.crop as string,
    stageCode: row.stageCode as string,
    stageName: row.stageName as string,
    recordedAt: (row.recordedAt as Date).toISOString(),
    recordedBy: row.recordedBy as string,
    recorderName: (recorder?.name as string) ?? '',
    notes: (row.notes as string) ?? null,
  };
}

const INCLUDE = {
  fieldPlot: { select: { name: true } },
  recorder: { select: { name: true } },
};

export async function listPhenoRecords(
  ctx: RlsContext,
  query: ListPhenoRecordsQuery = {},
): Promise<PhenoRecordItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {};
    if (query.fieldPlotId) where.fieldPlotId = query.fieldPlotId;
    if (query.crop) where.crop = query.crop;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const rows = await tx.plotPhenologicalRecord.findMany({
      where: where as any,
      include: INCLUDE,
      orderBy: { recordedAt: 'desc' },
      take: query.limit ?? 100,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

export async function getCurrentStage(
  ctx: RlsContext,
  fieldPlotId: string,
  crop?: string,
): Promise<PhenoRecordItem | null> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { fieldPlotId };
    if (crop) where.crop = crop;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const row = await tx.plotPhenologicalRecord.findFirst({
      where: where as any,
      include: INCLUDE,
      orderBy: { recordedAt: 'desc' },
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!row) return null;
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function createPhenoRecord(
  ctx: RlsContext,
  userId: string,
  input: CreatePhenoRecordInput,
): Promise<PhenoRecordItem> {
  if (!input.fieldPlotId?.trim()) {
    throw new PhenoRecordError('Talhão é obrigatório', 400);
  }
  if (!input.crop?.trim()) {
    throw new PhenoRecordError('Cultura é obrigatória', 400);
  }
  if (!input.stageCode?.trim()) {
    throw new PhenoRecordError('Código da fase é obrigatório', 400);
  }
  if (!input.stageName?.trim()) {
    throw new PhenoRecordError('Nome da fase é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate plot exists
    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) {
      throw new PhenoRecordError('Talhão não encontrado', 404);
    }

    const row = await tx.plotPhenologicalRecord.create({
      data: {
        fieldPlotId: input.fieldPlotId,
        crop: input.crop.trim(),
        stageCode: input.stageCode.trim(),
        stageName: input.stageName.trim(),
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
        recordedBy: userId,
        notes: input.notes?.trim() ?? null,
      },
      include: INCLUDE,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deletePhenoRecord(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plotPhenologicalRecord.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new PhenoRecordError('Registro fenológico não encontrado', 404);
    }
    await tx.plotPhenologicalRecord.delete({ where: { id } });
  });
}
