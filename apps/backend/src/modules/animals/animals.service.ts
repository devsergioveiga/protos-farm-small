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
  type AnimalSexType,
  type AnimalCategoryType,
  type CreateAnimalInput,
  type UpdateAnimalInput,
  type ListAnimalsQuery,
  type BreedCompositionInput,
  type CreateBreedInput,
} from './animals.types';

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

// ─── List Animals ───────────────────────────────────────────────────

export async function listAnimals(ctx: RlsContext, farmId: string, query: ListAnimalsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
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

    if (query.breedId) {
      where.compositions = { some: { breedId: query.breedId } };
    }

    const [animals, total] = await Promise.all([
      tx.animal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          compositions: { include: { breed: { select: { id: true, name: true, code: true } } } },
          sire: { select: { id: true, earTag: true, name: true } },
          dam: { select: { id: true, earTag: true, name: true } },
        },
      }),
      tx.animal.count({ where }),
    ]);

    const data = animals.map((a) => ({
      ...a,
      entryWeightKg: a.entryWeightKg ? Number(a.entryWeightKg) : null,
      breedSummary:
        a.compositions.length > 0
          ? a.compositions.map((c) => `${c.breed.name} ${Number(c.percentage)}%`).join(' + ')
          : null,
    }));

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
