import { randomUUID } from 'node:crypto';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  BullError,
  BULL_STATUS_LABELS,
  SEMEN_ENTRY_TYPE_LABELS,
  SEMEN_TYPE_LABELS,
  isValidBullStatus,
  isValidSemenEntryType,
  isValidSemenType,
  type CreateBullInput,
  type UpdateBullInput,
  type ListBullsQuery,
  type CreateSemenBatchInput,
  type UpdateSemenBatchInput,
  type BullItem,
  type BullWithBatches,
  type SemenBatchItem,
  type BullCatalogItem,
  type BullUsageHistoryItem,
  type ImportBullsResult,
  type BullStatusValue,
  type SemenEntryTypeValue,
  type SemenTypeValue,
  type BreedCompositionEntry,
  type GeneticProofEntry,
} from './bulls.types';
import { parseBullFile } from './bulls-csv-parser';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toBullItem(row: any): BullItem {
  const status = row.status as BullStatusValue;
  const semenBatches = row.semenBatches ?? [];
  const semenStock = semenBatches.reduce((sum: number, b: any) => sum + (b.currentDoses ?? 0), 0);

  return {
    id: row.id,
    organizationId: row.organizationId,
    farmId: row.farmId,
    name: row.name,
    registryNumber: row.registryNumber ?? null,
    registryAssociation: row.registryAssociation ?? null,
    breedName: row.breedName,
    breedComposition: (row.breedComposition as BreedCompositionEntry[]) ?? null,
    isOwnAnimal: row.isOwnAnimal,
    animalId: row.animalId ?? null,
    animalEarTag: row.animal?.earTag ?? null,
    ownerName: row.ownerName ?? null,
    ownerContact: row.ownerContact ?? null,
    stayStartDate: row.stayStartDate
      ? (row.stayStartDate as Date).toISOString().slice(0, 10)
      : null,
    stayEndDate: row.stayEndDate ? (row.stayEndDate as Date).toISOString().slice(0, 10) : null,
    status,
    statusLabel: BULL_STATUS_LABELS[status] ?? status,
    ptaMilkKg: row.ptaMilkKg ?? null,
    ptaFatKg: row.ptaFatKg ?? null,
    ptaFatPct: row.ptaFatPct ?? null,
    ptaProteinKg: row.ptaProteinKg ?? null,
    ptaProteinPct: row.ptaProteinPct ?? null,
    typeScore: row.typeScore ?? null,
    productiveLife: row.productiveLife ?? null,
    calvingEase: row.calvingEase ?? null,
    scc: row.scc ?? null,
    geneticProofs: (row.geneticProofs as GeneticProofEntry[]) ?? null,
    photoUrl: row.photoUrl ?? null,
    notes: row.notes ?? null,
    semenStock,
    deletedAt: row.deletedAt ? (row.deletedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toSemenBatchItem(row: any): SemenBatchItem {
  const entryType = row.entryType as SemenEntryTypeValue;
  const semenType = (row.semenType as SemenTypeValue) ?? 'SEXED_FEMALE';
  return {
    id: row.id,
    organizationId: row.organizationId,
    bullId: row.bullId,
    batchNumber: row.batchNumber,
    centralName: row.centralName ?? null,
    entryType,
    entryTypeLabel: SEMEN_ENTRY_TYPE_LABELS[entryType] ?? entryType,
    semenType,
    semenTypeLabel: SEMEN_TYPE_LABELS[semenType] ?? semenType,
    entryDate: (row.entryDate as Date).toISOString().slice(0, 10),
    expiryDate: row.expiryDate ? (row.expiryDate as Date).toISOString().slice(0, 10) : null,
    initialDoses: row.initialDoses,
    currentDoses: row.currentDoses,
    costPerDose: row.costPerDose,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const BULL_INCLUDE = {
  animal: { select: { earTag: true } },
  semenBatches: true,
};

const BULL_INCLUDE_LIST = {
  animal: { select: { earTag: true } },
  semenBatches: { select: { currentDoses: true } },
};

// ─── Validation ─────────────────────────────────────────────────────

function validateCreateInput(input: CreateBullInput): void {
  if (!input.name?.trim()) {
    throw new BullError('Nome do touro é obrigatório', 400);
  }
  if (!input.breedName?.trim()) {
    throw new BullError('Raça é obrigatória', 400);
  }
  if (input.status && !isValidBullStatus(input.status)) {
    throw new BullError('Status inválido', 400);
  }
  if (input.breedComposition) {
    const totalPct = input.breedComposition.reduce((sum, c) => sum + c.percentage, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new BullError('A soma das porcentagens da composição racial deve ser 100%', 400);
    }
  }
}

// ─── CREATE BULL (CA1/CA2) ──────────────────────────────────────────

export async function createBull(
  ctx: RlsContext,
  farmId: string,
  input: CreateBullInput,
): Promise<BullItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Check unique name
    const existing = await (tx as any).bull.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BullError('Já existe um touro com este nome na organização', 409);
    }

    // If own animal, validate animal exists
    if (input.isOwnAnimal && input.animalId) {
      const animal = await (tx as any).animal.findFirst({
        where: { id: input.animalId, farmId, deletedAt: null, sex: 'MALE' },
        select: { id: true },
      });
      if (!animal) {
        throw new BullError('Animal não encontrado ou não é macho', 404);
      }

      // Check if animal is already linked to another bull
      const existingBull = await (tx as any).bull.findFirst({
        where: { animalId: input.animalId, deletedAt: null },
      });
      if (existingBull) {
        throw new BullError('Este animal já está vinculado a outro registro de touro', 409);
      }
    }

    const row = await (tx as any).bull.create({
      data: {
        id: randomUUID(),
        organizationId: ctx.organizationId,
        farmId,
        name: input.name.trim(),
        registryNumber: input.registryNumber ?? null,
        registryAssociation: input.registryAssociation ?? null,
        breedName: input.breedName.trim(),
        breedComposition: input.breedComposition ?? undefined,
        isOwnAnimal: input.isOwnAnimal ?? false,
        animalId: input.isOwnAnimal && input.animalId ? input.animalId : null,
        ownerName: input.ownerName ?? null,
        ownerContact: input.ownerContact ?? null,
        stayStartDate: input.stayStartDate ? new Date(input.stayStartDate) : null,
        stayEndDate: input.stayEndDate ? new Date(input.stayEndDate) : null,
        status: input.status ?? 'ACTIVE',
        ptaMilkKg: input.ptaMilkKg ?? null,
        ptaFatKg: input.ptaFatKg ?? null,
        ptaFatPct: input.ptaFatPct ?? null,
        ptaProteinKg: input.ptaProteinKg ?? null,
        ptaProteinPct: input.ptaProteinPct ?? null,
        typeScore: input.typeScore ?? null,
        productiveLife: input.productiveLife ?? null,
        calvingEase: input.calvingEase ?? null,
        scc: input.scc ?? null,
        geneticProofs: input.geneticProofs ?? undefined,
        photoUrl: input.photoUrl ?? null,
        notes: input.notes ?? null,
      },
      include: BULL_INCLUDE,
    });

    return toBullItem(row);
  });
}

// ─── LIST BULLS (CA1/CA2) ──────────────────────────────────────────

export async function listBulls(
  ctx: RlsContext,
  farmId: string,
  query: ListBullsQuery,
): Promise<{ data: BullItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId, deletedAt: null };

    if (query.status && isValidBullStatus(query.status)) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { breedName: { contains: query.search, mode: 'insensitive' } },
        { registryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).bull.findMany({
        where,
        include: BULL_INCLUDE_LIST,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      (tx as any).bull.count({ where }),
    ]);

    return {
      data: rows.map(toBullItem),
      total,
    };
  });
}

// ─── GET BULL (with semen batches) ─────────────────────────────────

export async function getBull(
  ctx: RlsContext,
  farmId: string,
  bullId: string,
): Promise<BullWithBatches> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).bull.findFirst({
      where: { id: bullId, farmId, deletedAt: null },
      include: BULL_INCLUDE,
    });
    if (!row) {
      throw new BullError('Touro não encontrado', 404);
    }
    const item = toBullItem(row);
    return {
      ...item,
      semenBatches: (row.semenBatches ?? []).map(toSemenBatchItem),
    };
  });
}

// ─── UPDATE BULL ───────────────────────────────────────────────────

export async function updateBull(
  ctx: RlsContext,
  farmId: string,
  bullId: string,
  input: UpdateBullInput,
): Promise<BullItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).bull.findFirst({
      where: { id: bullId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new BullError('Touro não encontrado', 404);
    }

    if (input.status && !isValidBullStatus(input.status)) {
      throw new BullError('Status inválido', 400);
    }

    if (input.breedComposition) {
      const totalPct = input.breedComposition.reduce((sum, c) => sum + c.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new BullError('A soma das porcentagens da composição racial deve ser 100%', 400);
      }
    }

    // Check unique name if changing
    if (input.name && input.name.trim() !== existing.name) {
      const dup = await (tx as any).bull.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          deletedAt: null,
          id: { not: bullId },
        },
      });
      if (dup) {
        throw new BullError('Já existe um touro com este nome na organização', 409);
      }
    }

    // If linking to own animal, validate
    if (input.isOwnAnimal && input.animalId) {
      const animal = await (tx as any).animal.findFirst({
        where: { id: input.animalId, farmId, deletedAt: null, sex: 'MALE' },
        select: { id: true },
      });
      if (!animal) {
        throw new BullError('Animal não encontrado ou não é macho', 404);
      }

      const existingBull = await (tx as any).bull.findFirst({
        where: { animalId: input.animalId, deletedAt: null, id: { not: bullId } },
      });
      if (existingBull) {
        throw new BullError('Este animal já está vinculado a outro registro de touro', 409);
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.registryNumber !== undefined) data.registryNumber = input.registryNumber;
    if (input.registryAssociation !== undefined)
      data.registryAssociation = input.registryAssociation;
    if (input.breedName !== undefined) data.breedName = input.breedName.trim();
    if (input.breedComposition !== undefined)
      data.breedComposition = input.breedComposition ?? undefined;
    if (input.isOwnAnimal !== undefined) data.isOwnAnimal = input.isOwnAnimal;
    if (input.animalId !== undefined) data.animalId = input.animalId;
    if (input.ownerName !== undefined) data.ownerName = input.ownerName;
    if (input.ownerContact !== undefined) data.ownerContact = input.ownerContact;
    if (input.stayStartDate !== undefined) {
      data.stayStartDate = input.stayStartDate ? new Date(input.stayStartDate) : null;
    }
    if (input.stayEndDate !== undefined) {
      data.stayEndDate = input.stayEndDate ? new Date(input.stayEndDate) : null;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.ptaMilkKg !== undefined) data.ptaMilkKg = input.ptaMilkKg;
    if (input.ptaFatKg !== undefined) data.ptaFatKg = input.ptaFatKg;
    if (input.ptaFatPct !== undefined) data.ptaFatPct = input.ptaFatPct;
    if (input.ptaProteinKg !== undefined) data.ptaProteinKg = input.ptaProteinKg;
    if (input.ptaProteinPct !== undefined) data.ptaProteinPct = input.ptaProteinPct;
    if (input.typeScore !== undefined) data.typeScore = input.typeScore;
    if (input.productiveLife !== undefined) data.productiveLife = input.productiveLife;
    if (input.calvingEase !== undefined) data.calvingEase = input.calvingEase;
    if (input.scc !== undefined) data.scc = input.scc;
    if (input.geneticProofs !== undefined) data.geneticProofs = input.geneticProofs ?? undefined;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).bull.update({
      where: { id: bullId },
      data,
      include: BULL_INCLUDE,
    });

    return toBullItem(row);
  });
}

// ─── DELETE BULL (soft delete) ─────────────────────────────────────

export async function deleteBull(ctx: RlsContext, farmId: string, bullId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).bull.findFirst({
      where: { id: bullId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new BullError('Touro não encontrado', 404);
    }

    await (tx as any).bull.update({
      where: { id: bullId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── CREATE SEMEN BATCH (CA4) ──────────────────────────────────────

export async function createSemenBatch(
  ctx: RlsContext,
  farmId: string,
  bullId: string,
  input: CreateSemenBatchInput,
): Promise<SemenBatchItem> {
  if (!input.batchNumber?.trim()) {
    throw new BullError('Número do lote é obrigatório', 400);
  }
  if (!input.entryDate) {
    throw new BullError('Data de entrada é obrigatória', 400);
  }
  if (!input.initialDoses || input.initialDoses <= 0) {
    throw new BullError('Quantidade de doses deve ser maior que zero', 400);
  }
  if (input.entryType && !isValidSemenEntryType(input.entryType)) {
    throw new BullError('Tipo de entrada inválido', 400);
  }
  if (input.semenType && !isValidSemenType(input.semenType)) {
    throw new BullError('Tipo de sêmen inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate bull
    const bull = await (tx as any).bull.findFirst({
      where: { id: bullId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!bull) {
      throw new BullError('Touro não encontrado', 404);
    }

    const row = await (tx as any).semenBatch.create({
      data: {
        id: randomUUID(),
        organizationId: ctx.organizationId,
        bullId,
        batchNumber: input.batchNumber.trim(),
        centralName: input.centralName ?? null,
        entryType: input.entryType ?? 'PURCHASE',
        semenType: input.semenType ?? 'SEXED_FEMALE',
        entryDate: new Date(input.entryDate),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        initialDoses: input.initialDoses,
        currentDoses: input.initialDoses,
        costPerDose: input.costPerDose ?? 0,
        notes: input.notes ?? null,
      },
    });

    return toSemenBatchItem(row);
  });
}

// ─── UPDATE SEMEN BATCH ────────────────────────────────────────────

export async function updateSemenBatch(
  ctx: RlsContext,
  batchId: string,
  input: UpdateSemenBatchInput,
): Promise<SemenBatchItem> {
  if (input.entryType && !isValidSemenEntryType(input.entryType)) {
    throw new BullError('Tipo de entrada inválido', 400);
  }
  if (input.semenType && !isValidSemenType(input.semenType)) {
    throw new BullError('Tipo de sêmen inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).semenBatch.findFirst({
      where: { id: batchId },
    });
    if (!existing) {
      throw new BullError('Lote de sêmen não encontrado', 404);
    }

    const data: any = {};
    if (input.batchNumber !== undefined) data.batchNumber = input.batchNumber.trim();
    if (input.centralName !== undefined) data.centralName = input.centralName;
    if (input.entryType !== undefined) data.entryType = input.entryType;
    if (input.semenType !== undefined) data.semenType = input.semenType;
    if (input.entryDate !== undefined) data.entryDate = new Date(input.entryDate);
    if (input.expiryDate !== undefined) {
      data.expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
    }
    if (input.costPerDose !== undefined) data.costPerDose = input.costPerDose;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).semenBatch.update({
      where: { id: batchId },
      data,
    });

    return toSemenBatchItem(row);
  });
}

// ─── USE SEMEN (CA4) ──────────────────────────────────────────────

export async function useSemen(
  ctx: RlsContext,
  batchId: string,
  dosesUsed: number,
): Promise<SemenBatchItem> {
  if (!dosesUsed || dosesUsed <= 0) {
    throw new BullError('Quantidade de doses deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).semenBatch.findFirst({
      where: { id: batchId },
    });
    if (!existing) {
      throw new BullError('Lote de sêmen não encontrado', 404);
    }

    if (existing.currentDoses < dosesUsed) {
      throw new BullError(
        `Doses insuficientes. Disponível: ${existing.currentDoses}, solicitado: ${dosesUsed}`,
        400,
      );
    }

    const row = await (tx as any).semenBatch.update({
      where: { id: batchId },
      data: {
        currentDoses: existing.currentDoses - dosesUsed,
      },
    });

    return toSemenBatchItem(row);
  });
}

// ─── BULL CATALOG (CA5) ────────────────────────────────────────────

export async function getBullCatalog(
  ctx: RlsContext,
  farmId: string,
  query: ListBullsQuery,
): Promise<{ data: BullCatalogItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId, deletedAt: null };

    if (query.status && isValidBullStatus(query.status)) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { breedName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).bull.findMany({
        where,
        include: {
          semenBatches: { select: { currentDoses: true } },
        },
        orderBy: { ptaMilkKg: { sort: 'desc', nulls: 'last' } },
        skip,
        take: limit,
      }),
      (tx as any).bull.count({ where }),
    ]);

    const data: BullCatalogItem[] = rows.map((row: any) => {
      const status = row.status as BullStatusValue;
      const semenStock = (row.semenBatches ?? []).reduce(
        (sum: number, b: any) => sum + (b.currentDoses ?? 0),
        0,
      );

      return {
        id: row.id,
        name: row.name,
        breedName: row.breedName,
        registryNumber: row.registryNumber ?? null,
        registryAssociation: row.registryAssociation ?? null,
        status,
        statusLabel: BULL_STATUS_LABELS[status] ?? status,
        ptaMilkKg: row.ptaMilkKg ?? null,
        ptaFatKg: row.ptaFatKg ?? null,
        ptaFatPct: row.ptaFatPct ?? null,
        ptaProteinKg: row.ptaProteinKg ?? null,
        ptaProteinPct: row.ptaProteinPct ?? null,
        typeScore: row.typeScore ?? null,
        productiveLife: row.productiveLife ?? null,
        calvingEase: row.calvingEase ?? null,
        scc: row.scc ?? null,
        semenStock,
        farmId: row.farmId,
      };
    });

    return { data, total };
  });
}

// ─── BULL USAGE HISTORY (CA6 — placeholder) ────────────────────────

export async function getBullUsageHistory(
  ctx: RlsContext,
  bullId: string,
): Promise<BullUsageHistoryItem[]> {
  void ctx;
  void bullId;
  return [];
}

// ─── IMPORT BULLS CSV (CA7) ────────────────────────────────────────

export async function importBullsCsv(
  ctx: RlsContext,
  farmId: string,
  file: Express.Multer.File,
): Promise<ImportBullsResult> {
  const parsed = await parseBullFile(file.buffer, file.originalname);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    throw new BullError(`Erro ao processar arquivo: ${parsed.errors.join('; ')}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [...parsed.errors];

    for (const row of parsed.rows) {
      // Check if bull already exists
      const existing = await (tx as any).bull.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: row.name,
          deletedAt: null,
        },
      });

      if (existing) {
        skipped++;
        errors.push(`Linha ${row.index + 1}: Touro "${row.name}" já existe, ignorado`);
        continue;
      }

      const bullId = randomUUID();

      await (tx as any).bull.create({
        data: {
          id: bullId,
          organizationId: ctx.organizationId,
          farmId,
          name: row.name,
          breedName: row.breedName,
          registryNumber: row.registryNumber,
          registryAssociation: row.registryAssociation,
          ptaMilkKg: row.ptaMilkKg,
          ptaFatKg: row.ptaFatKg,
          ptaProteinKg: row.ptaProteinKg,
          status: 'ACTIVE',
        },
      });

      // Create semen batch if batch data provided
      if (row.batchNumber && row.doses && row.doses > 0) {
        await (tx as any).semenBatch.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId,
            bullId,
            batchNumber: row.batchNumber,
            centralName: row.centralName,
            entryType: 'PURCHASE',
            entryDate: new Date(),
            initialDoses: row.doses,
            currentDoses: row.doses,
            costPerDose: row.costPerDose ?? 0,
          },
        });
      }

      imported++;
    }

    return { imported, skipped, errors };
  });
}

// ─── EXPORT BULLS CSV ──────────────────────────────────────────────

export async function exportBullsCsv(ctx: RlsContext, farmId: string): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).bull.findMany({
      where: { farmId, deletedAt: null },
      include: {
        semenBatches: { select: { currentDoses: true } },
      },
      orderBy: { name: 'asc' },
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(
      'Nome;Raça;Registro;Associação;Status;PTA Leite (kg);PTA Gordura (kg);PTA Gordura (%);PTA Proteína (kg);PTA Proteína (%);Tipo;Vida Produtiva;Facilidade Parto;CCS;Doses Disponíveis',
    );

    for (const row of rows) {
      const status = BULL_STATUS_LABELS[row.status as BullStatusValue] ?? row.status;
      const semenStock = (row.semenBatches ?? []).reduce(
        (sum: number, b: any) => sum + (b.currentDoses ?? 0),
        0,
      );

      lines.push(
        [
          row.name,
          row.breedName,
          row.registryNumber ?? '',
          row.registryAssociation ?? '',
          status,
          row.ptaMilkKg ?? '',
          row.ptaFatKg ?? '',
          row.ptaFatPct ?? '',
          row.ptaProteinKg ?? '',
          row.ptaProteinPct ?? '',
          row.typeScore ?? '',
          row.productiveLife ?? '',
          row.calvingEase ?? '',
          row.scc ?? '',
          semenStock,
        ].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
