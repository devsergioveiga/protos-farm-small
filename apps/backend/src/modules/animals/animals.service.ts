import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalError,
  ANIMAL_SEXES,
  ANIMAL_CATEGORIES,
  ANIMAL_ORIGINS,
  GENEALOGY_CLASSES,
  BODY_CONDITION_SCORE_MIN,
  BODY_CONDITION_SCORE_MAX,
  BREED_CATEGORIES,
  GIROLANDO_GRADES,
  SEX_ALIASES,
  ORIGIN_ALIASES,
  CATEGORY_ALIASES,
  COLUMN_AUTO_MAP,
  type AnimalSexType,
  type AnimalCategoryType,
  ANIMAL_SORT_FIELDS,
  SPECIAL_FILTERS,
  ANIMAL_CSV_HEADERS,
  ANIMAL_SEX_LABELS_PT,
  ANIMAL_ORIGIN_LABELS_PT,
  type SpecialFilter,
  type AnimalSortField,
  type CreateAnimalInput,
  type UpdateAnimalInput,
  type ListAnimalsQuery,
  type BreedCompositionInput,
  type CreateBreedInput,
  type AnimalColumnMapping,
  type AnimalBulkPreviewRow,
  type AnimalBulkPreviewResult,
  type AnimalBulkImportInput,
  type AnimalBulkImportResult,
  type AnimalBulkImportResultItem,
} from './animals.types';
import { parseAnimalFile } from './animal-file-parser';

// ─── Helpers ────────────────────────────────────────────────────────

export function suggestCategory(sex: string, birthDate?: string | null): AnimalCategoryType {
  if (!birthDate) {
    return sex === 'MALE' ? 'BEZERRO' : 'BEZERRA';
  }

  const birth = new Date(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (sex === 'MALE') {
    if (months < 12) return 'BEZERRO';
    if (months < 24) return 'NOVILHO';
    return 'TOURO_REPRODUTOR';
  } else {
    if (months < 12) return 'BEZERRA';
    if (months < 24) return 'NOVILHA';
    return 'VACA_SECA';
  }
}

export function detectGirolandoGrade(
  compositions: Array<{ breedName: string; percentage: number }>,
): string | null {
  if (compositions.length !== 2) return null;

  const holandesa = compositions.find((c) => c.breedName === 'Holandesa');
  const gir = compositions.find((c) => c.breedName === 'Gir Leiteiro');

  if (!holandesa || !gir) return null;

  const key = holandesa.percentage.toFixed(2);
  return GIROLANDO_GRADES[key] ?? null;
}

export function validateBreedComposition(compositions: BreedCompositionInput[]): void {
  if (!compositions || compositions.length === 0) return;

  const total = compositions.reduce((sum, c) => sum + c.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new AnimalError(
      `Soma das composições raciais deve ser 100%. Atual: ${total.toFixed(2)}%`,
      422,
    );
  }

  const breedIds = compositions.map((c) => c.breedId);
  if (new Set(breedIds).size !== breedIds.length) {
    throw new AnimalError('Raça duplicada na composição', 422);
  }

  for (const c of compositions) {
    if (c.percentage <= 0 || c.percentage > 100) {
      throw new AnimalError('Percentual da raça deve estar entre 0 e 100', 422);
    }
  }
}

function validateSex(sex: string): void {
  if (!(ANIMAL_SEXES as readonly string[]).includes(sex)) {
    throw new AnimalError(`Sexo inválido: ${sex}`, 400);
  }
}

function validateCategory(category: string): void {
  if (!(ANIMAL_CATEGORIES as readonly string[]).includes(category)) {
    throw new AnimalError(`Categoria inválida: ${category}`, 400);
  }
}

function validateOrigin(origin: string): void {
  if (!(ANIMAL_ORIGINS as readonly string[]).includes(origin)) {
    throw new AnimalError(`Origem inválida: ${origin}`, 400);
  }
}

function validateGenealogyClass(cls: string): void {
  if (!(GENEALOGY_CLASSES as readonly string[]).includes(cls)) {
    throw new AnimalError(`Classe genealógica inválida: ${cls}`, 400);
  }
}

function validateBodyConditionScore(score: number | undefined): void {
  if (score != null && (score < BODY_CONDITION_SCORE_MIN || score > BODY_CONDITION_SCORE_MAX)) {
    throw new AnimalError(
      `Escore de condição corporal deve estar entre ${BODY_CONDITION_SCORE_MIN} e ${BODY_CONDITION_SCORE_MAX}`,
      400,
    );
  }
}

// ─── Create Animal ──────────────────────────────────────────────────

export async function createAnimal(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateAnimalInput,
) {
  validateSex(input.sex);
  if (input.category) validateCategory(input.category);
  if (input.origin) validateOrigin(input.origin);
  validateBodyConditionScore(input.bodyConditionScore);

  if (input.compositions && input.compositions.length > 0) {
    validateBreedComposition(input.compositions);
  }

  if (input.genealogicalRecords) {
    for (const rec of input.genealogicalRecords) {
      validateGenealogyClass(rec.genealogyClass);
    }
  }

  const categorySuggested = suggestCategory(input.sex, input.birthDate);
  const category = input.category ?? categorySuggested;

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate earTag
    const existing = await tx.animal.findFirst({
      where: { farmId, earTag: input.earTag, deletedAt: null },
    });
    if (existing) {
      throw new AnimalError(`Brinco '${input.earTag}' já cadastrado nesta fazenda`, 422);
    }

    // Validate sire/dam exist in same farm
    if (input.sireId) {
      const sire = await tx.animal.findFirst({
        where: { id: input.sireId, farmId, deletedAt: null },
      });
      if (!sire) throw new AnimalError('Pai não encontrado nesta fazenda', 404);
      if (sire.sex !== 'MALE') throw new AnimalError('Pai deve ser macho', 422);
    }
    if (input.damId) {
      const dam = await tx.animal.findFirst({
        where: { id: input.damId, farmId, deletedAt: null },
      });
      if (!dam) throw new AnimalError('Mãe não encontrada nesta fazenda', 404);
      if (dam.sex !== 'FEMALE') throw new AnimalError('Mãe deve ser fêmea', 422);
    }

    // Detect Girolando grade
    let girolandoGrade: string | null = null;
    if (input.compositions && input.compositions.length > 0) {
      const breedIds = input.compositions.map((c) => c.breedId);
      const breeds = await tx.breed.findMany({ where: { id: { in: breedIds } } });
      const compositionsWithNames = input.compositions.map((c) => ({
        breedName: breeds.find((b) => b.id === c.breedId)?.name ?? '',
        percentage: c.percentage,
      }));
      girolandoGrade = detectGirolandoGrade(compositionsWithNames);
    }

    const animal = await tx.animal.create({
      data: {
        farmId,
        earTag: input.earTag,
        rfidTag: input.rfidTag ?? null,
        name: input.name ?? null,
        sex: input.sex as AnimalSexType,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        birthDateEstimated: input.birthDateEstimated ?? false,
        category: category as AnimalCategoryType,
        categorySuggested: categorySuggested as AnimalCategoryType,
        origin: (input.origin ?? 'BORN') as 'BORN' | 'PURCHASED',
        entryWeightKg: input.entryWeightKg ?? null,
        bodyConditionScore: input.bodyConditionScore ?? null,
        sireId: input.sireId ?? null,
        damId: input.damId ?? null,
        photoUrl: input.photoUrl ?? null,
        notes: input.notes ?? null,
        isCompositionEstimated: input.isCompositionEstimated ?? false,
        createdBy: userId,
        compositions: input.compositions
          ? {
              create: input.compositions.map((c) => ({
                breedId: c.breedId,
                percentage: c.percentage,
                fraction: c.fraction ?? null,
              })),
            }
          : undefined,
        genealogicalRecords: input.genealogicalRecords
          ? {
              create: input.genealogicalRecords.map((r) => ({
                genealogyClass: r.genealogyClass as
                  | 'PO'
                  | 'PC_OC'
                  | 'PC_OD'
                  | 'GC_01'
                  | 'GC_02'
                  | 'GC_03'
                  | 'PA'
                  | 'LA'
                  | 'CCG'
                  | 'SRD',
                registrationNumber: r.registrationNumber ?? null,
                associationName: r.associationName ?? null,
                registrationDate: r.registrationDate ? new Date(r.registrationDate) : null,
                girolando_grade: girolandoGrade ?? r.girolando_grade ?? null,
                notes: r.notes ?? null,
              })),
            }
          : undefined,
      },
      include: {
        compositions: { include: { breed: true } },
        genealogicalRecords: true,
        sire: { select: { id: true, earTag: true, name: true } },
        dam: { select: { id: true, earTag: true, name: true } },
      },
    });

    return animal;
  });
}

// ─── Where Builder ──────────────────────────────────────────────────

function buildAnimalsWhere(farmId: string, query: ListAnimalsQuery): Record<string, unknown> {
  const where: Record<string, unknown> = { farmId, deletedAt: null };

  if (query.search) {
    where.OR = [
      { earTag: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
      { rfidTag: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.sex) where.sex = query.sex;
  if (query.category) where.category = query.category;
  if (query.origin) where.origin = query.origin;
  if (query.lotId) where.lotId = query.lotId;

  if (query.locationId) {
    where.lot = { locationId: query.locationId };
  }

  if (query.breedId) {
    where.compositions = { some: { breedId: query.breedId } };
  }

  // Weight range
  if (query.minWeightKg != null || query.maxWeightKg != null) {
    const weightFilter: Record<string, unknown> = {};
    if (query.minWeightKg != null) weightFilter.gte = query.minWeightKg;
    if (query.maxWeightKg != null) weightFilter.lte = query.maxWeightKg;
    where.entryWeightKg = weightFilter;
  }

  // Birth date range (explicit dates + age-based)
  const birthDateFilter: Record<string, unknown> = {};

  if (query.birthDateFrom) birthDateFilter.gte = new Date(query.birthDateFrom);
  if (query.birthDateTo) birthDateFilter.lte = new Date(query.birthDateTo);

  // minAgeDays → animal has at least X days → birthDate <= today - X
  if (query.minAgeDays != null) {
    const maxBirthDate = new Date();
    maxBirthDate.setDate(maxBirthDate.getDate() - query.minAgeDays);
    const existing = birthDateFilter.lte as Date | undefined;
    if (!existing || maxBirthDate < existing) {
      birthDateFilter.lte = maxBirthDate;
    }
  }

  // maxAgeDays → animal has at most X days → birthDate >= today - X
  if (query.maxAgeDays != null) {
    const minBirthDate = new Date();
    minBirthDate.setDate(minBirthDate.getDate() - query.maxAgeDays);
    const existing = birthDateFilter.gte as Date | undefined;
    if (!existing || minBirthDate > existing) {
      birthDateFilter.gte = minBirthDate;
    }
  }

  if (Object.keys(birthDateFilter).length > 0) {
    where.birthDate = birthDateFilter;
  }

  // Category-based special filters
  if (query.specialFilter === 'LACTATING') where.category = 'VACA_LACTACAO';
  if (query.specialFilter === 'DRY') where.category = 'VACA_SECA';
  if (query.specialFilter === 'CULLING') where.category = 'DESCARTE';

  return where;
}

// ─── Special Filter ID Resolution ──────────────────────────────────

import type { TxClient } from '../../database/rls';
import { Prisma } from '@prisma/client';

async function getSpecialFilterIds(
  tx: TxClient,
  farmId: string,
  specialFilter: SpecialFilter,
): Promise<string[] | null> {
  if (specialFilter === 'PREGNANT') {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT a.id
        FROM animals a
        JOIN animal_reproductive_records r ON r."animalId" = a.id
        WHERE a."farmId" = ${farmId}
          AND a."deletedAt" IS NULL
          AND r.type = 'PREGNANCY'
          AND NOT EXISTS (
            SELECT 1 FROM animal_reproductive_records r2
            WHERE r2."animalId" = a.id
              AND r2.type = 'CALVING'
              AND r2."eventDate" > r."eventDate"
          )
      `,
    );
    return rows.map((r) => r.id);
  }

  if (specialFilter === 'EMPTY') {
    const pregnantRows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT a.id
        FROM animals a
        JOIN animal_reproductive_records r ON r."animalId" = a.id
        WHERE a."farmId" = ${farmId}
          AND a."deletedAt" IS NULL
          AND r.type = 'PREGNANCY'
          AND NOT EXISTS (
            SELECT 1 FROM animal_reproductive_records r2
            WHERE r2."animalId" = a.id
              AND r2.type = 'CALVING'
              AND r2."eventDate" > r."eventDate"
          )
      `,
    );
    const pregnantIds = pregnantRows.map((r) => r.id);

    const emptyRows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT a.id
        FROM animals a
        WHERE a."farmId" = ${farmId}
          AND a."deletedAt" IS NULL
          AND a.sex = 'FEMALE'
          ${pregnantIds.length > 0 ? Prisma.sql`AND a.id NOT IN (${Prisma.join(pregnantIds)})` : Prisma.empty}
      `,
    );
    return emptyRows.map((r) => r.id);
  }

  if (specialFilter === 'WITHDRAWAL') {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT a.id
        FROM animals a
        JOIN animal_health_records h ON h."animalId" = a.id
        WHERE a."farmId" = ${farmId}
          AND a."deletedAt" IS NULL
          AND h."withdrawalDays" IS NOT NULL
          AND h."eventDate" + INTERVAL '1 day' * h."withdrawalDays" > CURRENT_DATE
      `,
    );
    return rows.map((r) => r.id);
  }

  return null;
}

// ─── List Animals ───────────────────────────────────────────────────

export async function listAnimals(ctx: RlsContext, farmId: string, query: ListAnimalsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const sortBy: AnimalSortField =
    query.sortBy && (ANIMAL_SORT_FIELDS as readonly string[]).includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return withRlsContext(ctx, async (tx) => {
    const where = buildAnimalsWhere(farmId, query);

    // Resolve complex special filters (PREGNANT, EMPTY, WITHDRAWAL) via raw SQL
    if (
      query.specialFilter &&
      (SPECIAL_FILTERS as readonly string[]).includes(query.specialFilter) &&
      !['LACTATING', 'DRY', 'CULLING'].includes(query.specialFilter)
    ) {
      const ids = await getSpecialFilterIds(tx, farmId, query.specialFilter);
      if (ids !== null) {
        where.id = { in: ids };
      }
    }

    const [animals, total, aggregate] = await Promise.all([
      tx.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          compositions: { include: { breed: { select: { id: true, name: true, code: true } } } },
          sire: { select: { id: true, earTag: true, name: true } },
          dam: { select: { id: true, earTag: true, name: true } },
          lot: { select: { id: true, name: true } },
        },
      }),
      tx.animal.count({ where }),
      tx.animal.aggregate({
        where,
        _avg: { entryWeightKg: true },
      }),
    ]);

    const data = animals.map((a) => ({
      ...a,
      entryWeightKg: a.entryWeightKg ? Number(a.entryWeightKg) : null,
      breedSummary:
        a.compositions.length > 0
          ? a.compositions.map((c) => `${c.breed.name} ${Number(c.percentage)}%`).join(' + ')
          : null,
    }));

    const avgWeight = aggregate._avg.entryWeightKg;

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      groupStats: {
        totalCount: total,
        averageWeightKg: avgWeight != null ? Number(Number(avgWeight).toFixed(1)) : null,
      },
    };
  });
}

// ─── Get Animal ─────────────────────────────────────────────────────

export async function getAnimal(ctx: RlsContext, farmId: string, animalId: string) {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      include: {
        compositions: { include: { breed: true } },
        genealogicalRecords: true,
        sire: { select: { id: true, earTag: true, name: true } },
        dam: { select: { id: true, earTag: true, name: true } },
        sireOffspring: {
          select: { id: true, earTag: true, name: true, sex: true },
          where: { deletedAt: null },
        },
        damOffspring: {
          select: { id: true, earTag: true, name: true, sex: true },
          where: { deletedAt: null },
        },
      },
    });

    if (!animal) {
      throw new AnimalError('Animal não encontrado', 404);
    }

    return {
      ...animal,
      entryWeightKg: animal.entryWeightKg ? Number(animal.entryWeightKg) : null,
      offspring: [...animal.sireOffspring, ...animal.damOffspring],
    };
  });
}

// ─── Update Animal ──────────────────────────────────────────────────

export async function updateAnimal(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  input: UpdateAnimalInput,
) {
  if (input.sex) validateSex(input.sex);
  if (input.category) validateCategory(input.category);
  if (input.origin) validateOrigin(input.origin);
  validateBodyConditionScore(input.bodyConditionScore);

  if (input.compositions && input.compositions.length > 0) {
    validateBreedComposition(input.compositions);
  }

  if (input.genealogicalRecords) {
    for (const rec of input.genealogicalRecords) {
      validateGenealogyClass(rec.genealogyClass);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
    });
    if (!existing) throw new AnimalError('Animal não encontrado', 404);

    // Check duplicate earTag if changing
    if (input.earTag && input.earTag !== existing.earTag) {
      const dup = await tx.animal.findFirst({
        where: { farmId, earTag: input.earTag, deletedAt: null, id: { not: animalId } },
      });
      if (dup) throw new AnimalError(`Brinco '${input.earTag}' já cadastrado nesta fazenda`, 422);
    }

    // Validate sire/dam
    if (input.sireId) {
      const sire = await tx.animal.findFirst({
        where: { id: input.sireId, farmId, deletedAt: null },
      });
      if (!sire) throw new AnimalError('Pai não encontrado nesta fazenda', 404);
      if (sire.sex !== 'MALE') throw new AnimalError('Pai deve ser macho', 422);
    }
    if (input.damId) {
      const dam = await tx.animal.findFirst({
        where: { id: input.damId, farmId, deletedAt: null },
      });
      if (!dam) throw new AnimalError('Mãe não encontrada nesta fazenda', 404);
      if (dam.sex !== 'FEMALE') throw new AnimalError('Mãe deve ser fêmea', 422);
    }

    const sex = input.sex ?? existing.sex;
    const birthDate =
      input.birthDate !== undefined ? input.birthDate : existing.birthDate?.toISOString();
    const categorySuggested = suggestCategory(sex, birthDate);

    // Detect Girolando grade if compositions provided
    let girolandoGrade: string | null = null;
    if (input.compositions && input.compositions.length > 0) {
      const breedIds = input.compositions.map((c) => c.breedId);
      const breeds = await tx.breed.findMany({ where: { id: { in: breedIds } } });
      const compositionsWithNames = input.compositions.map((c) => ({
        breedName: breeds.find((b) => b.id === c.breedId)?.name ?? '',
        percentage: c.percentage,
      }));
      girolandoGrade = detectGirolandoGrade(compositionsWithNames);
    }

    // Full-replace compositions if provided
    if (input.compositions) {
      await tx.animalBreedComposition.deleteMany({ where: { animalId } });
      if (input.compositions.length > 0) {
        await tx.animalBreedComposition.createMany({
          data: input.compositions.map((c) => ({
            animalId,
            breedId: c.breedId,
            percentage: c.percentage,
            fraction: c.fraction ?? null,
          })),
        });
      }
    }

    // Full-replace genealogical records if provided
    if (input.genealogicalRecords) {
      await tx.animalGenealogicalRecord.deleteMany({ where: { animalId } });
      if (input.genealogicalRecords.length > 0) {
        await tx.animalGenealogicalRecord.createMany({
          data: input.genealogicalRecords.map((r) => ({
            animalId,
            genealogyClass: r.genealogyClass as
              | 'PO'
              | 'PC_OC'
              | 'PC_OD'
              | 'GC_01'
              | 'GC_02'
              | 'GC_03'
              | 'PA'
              | 'LA'
              | 'CCG'
              | 'SRD',
            registrationNumber: r.registrationNumber ?? null,
            associationName: r.associationName ?? null,
            registrationDate: r.registrationDate ? new Date(r.registrationDate) : null,
            girolando_grade: girolandoGrade ?? r.girolando_grade ?? null,
            notes: r.notes ?? null,
          })),
        });
      }
    }

    const updateData: Record<string, unknown> = {
      categorySuggested,
    };

    if (input.earTag !== undefined) updateData.earTag = input.earTag;
    if (input.rfidTag !== undefined) updateData.rfidTag = input.rfidTag;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.sex !== undefined) updateData.sex = input.sex;
    if (input.birthDate !== undefined)
      updateData.birthDate = input.birthDate ? new Date(input.birthDate) : null;
    if (input.birthDateEstimated !== undefined)
      updateData.birthDateEstimated = input.birthDateEstimated;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.origin !== undefined) updateData.origin = input.origin;
    if (input.entryWeightKg !== undefined) updateData.entryWeightKg = input.entryWeightKg;
    if (input.bodyConditionScore !== undefined)
      updateData.bodyConditionScore = input.bodyConditionScore;
    if (input.sireId !== undefined) updateData.sireId = input.sireId;
    if (input.damId !== undefined) updateData.damId = input.damId;
    if (input.photoUrl !== undefined) updateData.photoUrl = input.photoUrl;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isCompositionEstimated !== undefined)
      updateData.isCompositionEstimated = input.isCompositionEstimated;

    const animal = await tx.animal.update({
      where: { id: animalId },
      data: updateData,
      include: {
        compositions: { include: { breed: true } },
        genealogicalRecords: true,
        sire: { select: { id: true, earTag: true, name: true } },
        dam: { select: { id: true, earTag: true, name: true } },
      },
    });

    return {
      ...animal,
      entryWeightKg: animal.entryWeightKg ? Number(animal.entryWeightKg) : null,
    };
  });
}

// ─── Soft Delete Animal ─────────────────────────────────────────────

export async function softDeleteAnimal(ctx: RlsContext, farmId: string, animalId: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
    });
    if (!existing) throw new AnimalError('Animal não encontrado', 404);

    await tx.animal.update({
      where: { id: animalId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Summary ────────────────────────────────────────────────────────

export async function getAnimalsSummary(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const animals = await tx.animal.findMany({
      where: { farmId, deletedAt: null },
      select: { category: true, sex: true },
    });

    const byCategory: Record<string, number> = {};
    const bySex: Record<string, number> = {};

    for (const a of animals) {
      byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
      bySex[a.sex] = (bySex[a.sex] ?? 0) + 1;
    }

    return {
      total: animals.length,
      byCategory,
      bySex,
    };
  });
}

// ─── Export CSV ──────────────────────────────────────────────────

export async function exportAnimalsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListAnimalsQuery,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const where = buildAnimalsWhere(farmId, query);

    if (
      query.specialFilter &&
      (SPECIAL_FILTERS as readonly string[]).includes(query.specialFilter) &&
      !['LACTATING', 'DRY', 'CULLING'].includes(query.specialFilter)
    ) {
      const ids = await getSpecialFilterIds(tx, farmId, query.specialFilter);
      if (ids !== null) {
        where.id = { in: ids };
      }
    }

    const animals = await tx.animal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        compositions: { include: { breed: { select: { name: true } } } },
        sire: { select: { earTag: true, name: true } },
        dam: { select: { earTag: true, name: true } },
        lot: { select: { name: true } },
      },
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(ANIMAL_CSV_HEADERS.join(';'));

    for (const a of animals) {
      const birthDate = a.birthDate ? new Date(a.birthDate).toLocaleDateString('pt-BR') : '';
      const breeds =
        a.compositions.length > 0
          ? a.compositions.map((c) => `${c.breed.name} ${Number(c.percentage)}%`).join(' + ')
          : '';
      const sireLabel = a.sire ? `${a.sire.earTag}${a.sire.name ? ` (${a.sire.name})` : ''}` : '';
      const damLabel = a.dam ? `${a.dam.earTag}${a.dam.name ? ` (${a.dam.name})` : ''}` : '';

      const cols = [
        a.earTag,
        a.name ?? '',
        ANIMAL_SEX_LABELS_PT[a.sex] ?? a.sex,
        birthDate,
        a.category,
        ANIMAL_ORIGIN_LABELS_PT[a.origin] ?? a.origin,
        breeds,
        a.entryWeightKg != null ? Number(a.entryWeightKg).toString() : '',
        a.bodyConditionScore != null ? Number(a.bodyConditionScore).toString() : '',
        (a.lot as { name: string } | null)?.name ?? '',
        sireLabel,
        damLabel,
        a.rfidTag ?? '',
        a.notes ?? '',
      ];

      lines.push(cols.join(';'));
    }

    return BOM + lines.join('\n');
  });
}

// ─── Breeds ─────────────────────────────────────────────────────────

export async function listBreeds(ctx: RlsContext) {
  return withRlsContext(ctx, async (tx) => {
    const breeds = await tx.breed.findMany({
      orderBy: { name: 'asc' },
    });
    return breeds;
  });
}

export async function createBreed(ctx: RlsContext, input: CreateBreedInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new AnimalError('Nome da raça é obrigatório', 400);
  }

  if (input.category && !(BREED_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new AnimalError(`Categoria da raça inválida: ${input.category}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.breed.findFirst({
      where: { name: input.name, organizationId: ctx.organizationId },
    });
    if (existing) {
      throw new AnimalError(`Raça '${input.name}' já existe`, 422);
    }

    const breed = await tx.breed.create({
      data: {
        name: input.name.trim(),
        code: input.code?.trim() ?? null,
        species: input.species ?? 'BOVINO',
        category: input.category ?? 'DUPLA_APTIDAO',
        isDefault: false,
        organizationId: ctx.organizationId,
      },
    });

    return breed;
  });
}

export async function deleteBreed(ctx: RlsContext, breedId: string) {
  return withRlsContext(ctx, async (tx) => {
    const breed = await tx.breed.findFirst({
      where: { id: breedId },
    });
    if (!breed) throw new AnimalError('Raça não encontrada', 404);

    if (breed.isDefault) {
      throw new AnimalError('Não é possível excluir raça padrão do sistema', 422);
    }

    if (breed.organizationId !== ctx.organizationId) {
      throw new AnimalError('Não é possível excluir raça de outra organização', 403);
    }

    // Check if breed is in use
    const usage = await tx.animalBreedComposition.count({
      where: { breedId },
    });
    if (usage > 0) {
      throw new AnimalError(
        'Raça em uso por animais. Remova as composições antes de excluir.',
        422,
      );
    }

    await tx.breed.delete({ where: { id: breedId } });
  });
}

// ─── Bulk Import Helpers ────────────────────────────────────────────

export function resolveEnumValue(
  raw: string | number | null | undefined,
  aliases: Record<string, string>,
  validValues: readonly string[],
): string | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '') return null;

  // Direct match (case-insensitive)
  const upper = normalized.toUpperCase();
  if ((validValues as readonly string[]).includes(upper)) return upper;

  // Alias match
  const aliased = aliases[normalized];
  if (aliased && (validValues as readonly string[]).includes(aliased)) return aliased;

  return null;
}

export function parseDate(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '') return null;

  // DD/MM/YYYY format
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const d = new Date(`${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // YYYY-MM-DD format
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(`${str}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return null;
}

function autoMapColumns(columnHeaders: string[]): AnimalColumnMapping {
  const mapping: AnimalColumnMapping = {};
  for (const header of columnHeaders) {
    const normalized = header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const mappedKey = COLUMN_AUTO_MAP[normalized];
    if (mappedKey && !mapping[mappedKey]) {
      mapping[mappedKey] = header;
    }
  }
  return mapping;
}

function getVal(
  row: Record<string, string | number | null>,
  mapping: AnimalColumnMapping,
  field: keyof AnimalColumnMapping,
): string | number | null {
  const col = mapping[field];
  if (!col) return null;
  return row[col] ?? null;
}

function strVal(v: string | number | null): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function numVal(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Bulk Preview ───────────────────────────────────────────────────

export async function previewBulkImportAnimals(
  ctx: RlsContext,
  farmId: string,
  buffer: Buffer,
  filename: string,
): Promise<AnimalBulkPreviewResult> {
  const parsed = await parseAnimalFile(buffer, filename);
  const mapping = autoMapColumns(parsed.columnHeaders);

  // Load breeds and existing earTags
  return withRlsContext(ctx, async (tx) => {
    const breeds = await tx.breed.findMany({
      where: {
        OR: [{ isDefault: true }, { organizationId: ctx.organizationId }],
      },
    });

    const existingAnimals = await tx.animal.findMany({
      where: { farmId, deletedAt: null },
      select: { earTag: true },
    });
    const existingEarTags = new Set(existingAnimals.map((a) => a.earTag.toLowerCase()));

    const seenEarTags = new Map<string, number>();
    const rows: AnimalBulkPreviewRow[] = [];

    for (const row of parsed.rows) {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Parse fields
      const earTag = strVal(getVal(row.raw, mapping, 'earTag'));
      const name = strVal(getVal(row.raw, mapping, 'name'));
      const rawSex = strVal(getVal(row.raw, mapping, 'sex'));
      const rawBirthDate = getVal(row.raw, mapping, 'birthDate');
      const rawCategory = strVal(getVal(row.raw, mapping, 'category'));
      const rawOrigin = strVal(getVal(row.raw, mapping, 'origin'));
      const rawWeight = numVal(getVal(row.raw, mapping, 'entryWeightKg'));
      const rawBcs = numVal(getVal(row.raw, mapping, 'bodyConditionScore'));
      const sireEarTag = strVal(getVal(row.raw, mapping, 'sireEarTag'));
      const damEarTag = strVal(getVal(row.raw, mapping, 'damEarTag'));
      const rfidTag = strVal(getVal(row.raw, mapping, 'rfidTag'));
      const notes = strVal(getVal(row.raw, mapping, 'notes'));

      // Breed composition
      const rawBreed1 = strVal(getVal(row.raw, mapping, 'breed1'));
      const rawBreed2 = strVal(getVal(row.raw, mapping, 'breed2'));
      const rawBreed3 = strVal(getVal(row.raw, mapping, 'breed3'));
      const rawPct1 = numVal(getVal(row.raw, mapping, 'pct1'));
      const rawPct2 = numVal(getVal(row.raw, mapping, 'pct2'));
      const rawPct3 = numVal(getVal(row.raw, mapping, 'pct3'));

      // Validate earTag
      if (!earTag) {
        errors.push('Brinco é obrigatório');
      } else {
        const lower = earTag.toLowerCase();
        if (existingEarTags.has(lower)) {
          warnings.push('Brinco já existe na fazenda');
        }
        const prevRow = seenEarTags.get(lower);
        if (prevRow !== undefined) {
          warnings.push(`Brinco duplicado no arquivo (linha ${prevRow + 1})`);
        }
        seenEarTags.set(lower, row.index);
      }

      // Resolve sex
      const sex = rawSex ? resolveEnumValue(rawSex, SEX_ALIASES, ANIMAL_SEXES) : null;
      if (!sex) {
        errors.push('Sexo é obrigatório (M/F, Macho/Fêmea)');
      }

      // Parse birthDate
      const birthDate = parseDate(rawBirthDate);
      if (rawBirthDate && !birthDate) {
        warnings.push('Data de nascimento inválida (use DD/MM/AAAA ou AAAA-MM-DD)');
      }

      // Resolve category/origin
      const category = rawCategory
        ? resolveEnumValue(rawCategory, CATEGORY_ALIASES, ANIMAL_CATEGORIES)
        : null;
      if (rawCategory && !category) {
        warnings.push(`Categoria "${rawCategory}" não reconhecida`);
      }

      const origin = rawOrigin ? resolveEnumValue(rawOrigin, ORIGIN_ALIASES, ANIMAL_ORIGINS) : null;
      if (rawOrigin && !origin) {
        warnings.push(`Origem "${rawOrigin}" não reconhecida`);
      }

      // Resolve breeds
      const resolvedBreeds: Array<{ breedId: string; breedName: string; percentage: number }> = [];
      const breedEntries = [
        { name: rawBreed1, pct: rawPct1 },
        { name: rawBreed2, pct: rawPct2 },
        { name: rawBreed3, pct: rawPct3 },
      ];

      const parsedBreeds: Array<{ name: string; pct: number }> = [];

      for (const entry of breedEntries) {
        if (!entry.name) continue;
        const breed = breeds.find(
          (b) =>
            b.name.toLowerCase() === entry.name!.toLowerCase() ||
            b.code?.toLowerCase() === entry.name!.toLowerCase(),
        );
        const pct = entry.pct ?? (breedEntries.filter((e) => e.name).length === 1 ? 100 : 0);
        parsedBreeds.push({ name: entry.name, pct });
        if (breed) {
          resolvedBreeds.push({ breedId: breed.id, breedName: breed.name, percentage: pct });
        } else {
          errors.push(`Raça "${entry.name}" não encontrada`);
        }
      }

      // Validate breed percentages sum
      if (resolvedBreeds.length > 0) {
        const total = resolvedBreeds.reduce((sum, b) => sum + b.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
          errors.push(`Soma dos percentuais raciais: ${total.toFixed(1)}% (deve ser 100%)`);
        }
      }

      // Suggest category
      const suggestedCategory = sex ? suggestCategory(sex, birthDate) : undefined;

      // Detect girolando grade
      const girolandoGrade =
        resolvedBreeds.length > 0
          ? detectGirolandoGrade(
              resolvedBreeds.map((b) => ({ breedName: b.breedName, percentage: b.percentage })),
            )
          : null;

      rows.push({
        index: row.index,
        parsed: {
          earTag: earTag ?? undefined,
          name: name ?? undefined,
          sex: sex ?? undefined,
          birthDate: birthDate ?? undefined,
          category: category ?? undefined,
          origin: origin ?? undefined,
          breeds: parsedBreeds.length > 0 ? parsedBreeds : undefined,
          entryWeightKg: rawWeight ?? undefined,
          bodyConditionScore: rawBcs ?? undefined,
          sireEarTag: sireEarTag ?? undefined,
          damEarTag: damEarTag ?? undefined,
          rfidTag: rfidTag ?? undefined,
          notes: notes ?? undefined,
        },
        derived: {
          suggestedCategory,
          girolandoGrade,
          resolvedBreeds: resolvedBreeds.length > 0 ? resolvedBreeds : undefined,
        },
        validation: {
          valid: errors.length === 0,
          errors,
          warnings,
        },
      });
    }

    const validCount = rows.filter((r) => r.validation.valid).length;

    return {
      filename,
      totalRows: rows.length,
      validCount,
      invalidCount: rows.length - validCount,
      columnHeaders: parsed.columnHeaders,
      rows,
    };
  });
}

// ─── Bulk Execute ───────────────────────────────────────────────────

export async function executeBulkImportAnimals(
  ctx: RlsContext,
  farmId: string,
  buffer: Buffer,
  filename: string,
  input: AnimalBulkImportInput,
  actorId: string,
): Promise<AnimalBulkImportResult> {
  // Re-parse and re-preview to get validated rows
  const preview = await previewBulkImportAnimals(ctx, farmId, buffer, filename);

  const selectedSet = new Set(input.selectedIndices);
  const items: AnimalBulkImportResultItem[] = [];
  const warnings: string[] = [];

  // Map earTag → animalId for sire/dam resolution within batch
  const batchEarTagMap = new Map<string, string>();

  // Process selected rows sequentially
  for (const row of preview.rows) {
    if (!selectedSet.has(row.index)) continue;

    if (!row.validation.valid) {
      items.push({
        index: row.index,
        status: 'skipped',
        earTag: row.parsed.earTag,
        reason: row.validation.errors.join('; '),
      });
      continue;
    }

    try {
      // Resolve sire/dam by earTag
      let sireId: string | undefined;
      let damId: string | undefined;

      if (row.parsed.sireEarTag) {
        // Check batch first, then DB
        const batchSire = batchEarTagMap.get(row.parsed.sireEarTag.toLowerCase());
        if (batchSire) {
          sireId = batchSire;
        } else {
          const dbSire = await withRlsContext(ctx, async (tx) => {
            return tx.animal.findFirst({
              where: {
                farmId,
                earTag: { equals: row.parsed.sireEarTag!, mode: 'insensitive' },
                deletedAt: null,
              },
              select: { id: true, sex: true },
            });
          });
          if (dbSire) {
            if (dbSire.sex !== 'MALE') {
              warnings.push(`Linha ${row.index + 1}: pai "${row.parsed.sireEarTag}" não é macho`);
            } else {
              sireId = dbSire.id;
            }
          }
        }
      }

      if (row.parsed.damEarTag) {
        const batchDam = batchEarTagMap.get(row.parsed.damEarTag.toLowerCase());
        if (batchDam) {
          damId = batchDam;
        } else {
          const dbDam = await withRlsContext(ctx, async (tx) => {
            return tx.animal.findFirst({
              where: {
                farmId,
                earTag: { equals: row.parsed.damEarTag!, mode: 'insensitive' },
                deletedAt: null,
              },
              select: { id: true, sex: true },
            });
          });
          if (dbDam) {
            if (dbDam.sex !== 'FEMALE') {
              warnings.push(`Linha ${row.index + 1}: mãe "${row.parsed.damEarTag}" não é fêmea`);
            } else {
              damId = dbDam.id;
            }
          }
        }
      }

      const createInput: CreateAnimalInput = {
        earTag: row.parsed.earTag!,
        name: row.parsed.name,
        sex: row.parsed.sex!,
        birthDate: row.parsed.birthDate,
        category: row.parsed.category ?? row.derived.suggestedCategory,
        origin: row.parsed.origin,
        entryWeightKg: row.parsed.entryWeightKg,
        bodyConditionScore: row.parsed.bodyConditionScore,
        sireId,
        damId,
        rfidTag: row.parsed.rfidTag,
        notes: row.parsed.notes,
        isCompositionEstimated: true,
        compositions: row.derived.resolvedBreeds?.map((b) => ({
          breedId: b.breedId,
          percentage: b.percentage,
        })),
      };

      const animal = await createAnimal(ctx, farmId, actorId, createInput);
      batchEarTagMap.set(row.parsed.earTag!.toLowerCase(), animal.id);

      items.push({
        index: row.index,
        status: 'imported',
        animalId: animal.id,
        earTag: row.parsed.earTag,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erro desconhecido';
      items.push({
        index: row.index,
        status: 'skipped',
        earTag: row.parsed.earTag,
        reason,
      });
    }
  }

  const imported = items.filter((i) => i.status === 'imported').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;

  return { imported, skipped, items, warnings };
}
