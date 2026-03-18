import type { DiseaseCategory, DiseaseSeverity, AffectedSystem } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  DiseaseError,
  DISEASE_CATEGORIES,
  DISEASE_CATEGORY_LABELS,
  DISEASE_SEVERITY_LEVELS,
  DISEASE_SEVERITY_LABELS,
  AFFECTED_SYSTEMS,
  AFFECTED_SYSTEM_LABELS,
  type CreateDiseaseInput,
  type UpdateDiseaseInput,
  type ListDiseasesQuery,
  type DiseaseItem,
} from './diseases.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): DiseaseItem {
  const category = row.category as string;
  const severity = (row.severity as string) ?? null;
  const affectedSystem = (row.affectedSystem as string) ?? null;

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    scientificName: (row.scientificName as string) ?? null,
    code: (row.code as string) ?? null,
    category,
    categoryLabel: DISEASE_CATEGORY_LABELS[category] ?? category,
    severity,
    severityLabel: severity ? (DISEASE_SEVERITY_LABELS[severity] ?? severity) : null,
    affectedSystem,
    affectedSystemLabel: affectedSystem
      ? (AFFECTED_SYSTEM_LABELS[affectedSystem] ?? affectedSystem)
      : null,
    symptoms: (row.symptoms as string) ?? null,
    quarantineDays: (row.quarantineDays as number) ?? null,
    isNotifiable: (row.isNotifiable as boolean) ?? false,
    photoUrl: (row.photoUrl as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreateDiseaseInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.name?.trim()) {
      throw new DiseaseError('Nome da doença é obrigatório', 400);
    }
    if (!input.category) {
      throw new DiseaseError('Categoria é obrigatória', 400);
    }
  }
  if (input.category !== undefined) {
    if (!DISEASE_CATEGORIES.includes(input.category as (typeof DISEASE_CATEGORIES)[number])) {
      throw new DiseaseError(`Categoria inválida. Use: ${DISEASE_CATEGORIES.join(', ')}`, 400);
    }
  }
  if (input.severity !== undefined && input.severity !== null) {
    if (
      !DISEASE_SEVERITY_LEVELS.includes(input.severity as (typeof DISEASE_SEVERITY_LEVELS)[number])
    ) {
      throw new DiseaseError(
        `Severidade inválida. Use: ${DISEASE_SEVERITY_LEVELS.join(', ')}`,
        400,
      );
    }
  }
  if (input.affectedSystem !== undefined && input.affectedSystem !== null) {
    if (!AFFECTED_SYSTEMS.includes(input.affectedSystem as (typeof AFFECTED_SYSTEMS)[number])) {
      throw new DiseaseError(`Sistema afetado inválido. Use: ${AFFECTED_SYSTEMS.join(', ')}`, 400);
    }
  }
  if (input.quarantineDays !== undefined && input.quarantineDays !== null) {
    if (!Number.isInteger(input.quarantineDays) || input.quarantineDays < 0) {
      throw new DiseaseError('Dias de quarentena deve ser um número inteiro positivo', 400);
    }
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createDisease(
  ctx: RlsContext,
  input: CreateDiseaseInput,
): Promise<DiseaseItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.disease.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new DiseaseError('Já existe uma doença com esse nome', 409);
    }

    const row = await tx.disease.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        scientificName: input.scientificName?.trim() || null,
        code: input.code?.trim() || null,
        category: input.category as DiseaseCategory,
        severity: (input.severity as DiseaseSeverity) || null,
        affectedSystem: (input.affectedSystem as AffectedSystem) || null,
        symptoms: input.symptoms?.trim() || null,
        quarantineDays: input.quarantineDays ?? null,
        isNotifiable: input.isNotifiable ?? false,
        photoUrl: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listDiseases(
  ctx: RlsContext,
  query: ListDiseasesQuery,
): Promise<{
  data: DiseaseItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.isNotifiable !== undefined) {
      where.isNotifiable = query.isNotifiable;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { scientificName: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [rows, total] = await Promise.all([
      tx.disease.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      tx.disease.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getDisease(ctx: RlsContext, diseaseId: string): Promise<DiseaseItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.disease.findFirst({
      where: {
        id: diseaseId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new DiseaseError('Doença não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateDisease(
  ctx: RlsContext,
  diseaseId: string,
  input: UpdateDiseaseInput,
): Promise<DiseaseItem> {
  validateInput(input as CreateDiseaseInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.disease.findFirst({
      where: {
        id: diseaseId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new DiseaseError('Doença não encontrada', 404);
    }

    if (input.name !== undefined) {
      const duplicate = await tx.disease.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          deletedAt: null,
          id: { not: diseaseId },
        },
      });
      if (duplicate) {
        throw new DiseaseError('Já existe uma doença com esse nome', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.scientificName !== undefined)
      data.scientificName = input.scientificName?.trim() || null;
    if (input.code !== undefined) data.code = input.code?.trim() || null;
    if (input.category !== undefined) data.category = input.category;
    if (input.severity !== undefined) data.severity = input.severity || null;
    if (input.affectedSystem !== undefined) data.affectedSystem = input.affectedSystem || null;
    if (input.symptoms !== undefined) data.symptoms = input.symptoms?.trim() || null;
    if (input.quarantineDays !== undefined) data.quarantineDays = input.quarantineDays ?? null;
    if (input.isNotifiable !== undefined) data.isNotifiable = input.isNotifiable;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.disease.update({
      where: { id: diseaseId },
      data,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteDisease(ctx: RlsContext, diseaseId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.disease.findFirst({
      where: {
        id: diseaseId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new DiseaseError('Doença não encontrada', 404);
    }

    await tx.disease.update({
      where: { id: diseaseId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── CATEGORIES ─────────────────────────────────────────────────────

export function listCategories(): { value: string; label: string }[] {
  return DISEASE_CATEGORIES.map((c) => ({ value: c, label: DISEASE_CATEGORY_LABELS[c] }));
}

export function listSeverityLevels(): { value: string; label: string }[] {
  return DISEASE_SEVERITY_LEVELS.map((s) => ({ value: s, label: DISEASE_SEVERITY_LABELS[s] }));
}

export function listAffectedSystems(): { value: string; label: string }[] {
  return AFFECTED_SYSTEMS.map((s) => ({ value: s, label: AFFECTED_SYSTEM_LABELS[s] }));
}

// ─── SEED ───────────────────────────────────────────────────────────

export const SEED_DISEASES: Omit<CreateDiseaseInput, 'organizationId'>[] = [
  {
    name: 'Mastite clínica',
    category: 'INFECTIOUS',
    severity: 'MODERATE',
    affectedSystem: 'MAMMARY',
    symptoms: 'Leite alterado (grumos, sangue, aquoso), úbere inchado, dor à palpação, febre',
    isNotifiable: false,
  },
  {
    name: 'Mastite subclínica',
    category: 'INFECTIOUS',
    severity: 'MILD',
    affectedSystem: 'MAMMARY',
    symptoms: 'Aumento de CCS, sem sinais visíveis, redução de produção',
    isNotifiable: false,
  },
  {
    name: 'Metrite',
    category: 'REPRODUCTIVE',
    severity: 'MODERATE',
    affectedSystem: 'REPRODUCTIVE',
    symptoms: 'Secreção uterina fétida, febre, redução de apetite, queda na produção',
    isNotifiable: false,
  },
  {
    name: 'Endometrite',
    category: 'REPRODUCTIVE',
    severity: 'MILD',
    affectedSystem: 'REPRODUCTIVE',
    symptoms: 'Secreção uterina purulenta, infertilidade, repetição de cio',
    isNotifiable: false,
  },
  {
    name: 'Retenção de placenta',
    category: 'REPRODUCTIVE',
    severity: 'MODERATE',
    affectedSystem: 'REPRODUCTIVE',
    symptoms: 'Placenta visível após 12h do parto, odor fétido, febre',
    isNotifiable: false,
  },
  {
    name: 'Cetose/Acetonemia',
    category: 'METABOLIC',
    severity: 'MODERATE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Redução de apetite, queda na produção, hálito cetônico, perda de peso',
    isNotifiable: false,
  },
  {
    name: 'Acidose ruminal',
    category: 'METABOLIC',
    severity: 'SEVERE',
    affectedSystem: 'DIGESTIVE',
    symptoms: 'Diarreia aquosa, desidratação, atonia ruminal, decúbito',
    isNotifiable: false,
  },
  {
    name: 'Deslocamento de abomaso',
    category: 'METABOLIC',
    severity: 'SEVERE',
    affectedSystem: 'DIGESTIVE',
    symptoms: 'Redução de apetite, queda na produção, som metálico (ping) à auscultação',
    isNotifiable: false,
  },
  {
    name: 'Hipocalcemia (febre do leite)',
    category: 'METABOLIC',
    severity: 'SEVERE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Decúbito, tremores musculares, orelhas frias, pupilas dilatadas',
    isNotifiable: false,
  },
  {
    name: 'Laminite/Pododermatite',
    category: 'LOCOMOTOR',
    severity: 'MODERATE',
    affectedSystem: 'LOCOMOTOR',
    symptoms: 'Claudicação, relutância em caminhar, postura arqueada, lesões no casco',
    isNotifiable: false,
  },
  {
    name: 'Pneumonia',
    category: 'INFECTIOUS',
    severity: 'SEVERE',
    affectedSystem: 'RESPIRATORY',
    symptoms: 'Tosse, secreção nasal, febre, dispneia, redução de apetite',
    isNotifiable: false,
  },
  {
    name: 'Diarreia neonatal',
    category: 'INFECTIOUS',
    severity: 'SEVERE',
    affectedSystem: 'DIGESTIVE',
    symptoms: 'Diarreia aquosa em bezerros, desidratação rápida, apatia, fraqueza',
    isNotifiable: false,
  },
  {
    name: 'Tristeza parasitária (babesiose/anaplasmose)',
    category: 'PARASITIC',
    severity: 'SEVERE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Febre alta, anemia, icterícia, hemoglobinúria, apatia',
    isNotifiable: false,
  },
  {
    name: 'Verminose',
    category: 'PARASITIC',
    severity: 'MODERATE',
    affectedSystem: 'DIGESTIVE',
    symptoms: 'Emagrecimento, pelo arrepiado, diarreia, edema submandibular, anemia',
    isNotifiable: false,
  },
  {
    name: 'Papilomatose',
    category: 'INFECTIOUS',
    severity: 'MILD',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Verrugas (papilomas) na pele, tetos, vulva',
    isNotifiable: false,
  },
  {
    name: 'Ceratoconjuntivite',
    category: 'INFECTIOUS',
    severity: 'MODERATE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Lacrimejamento, opacidade da córnea, fotofobia, úlcera ocular',
    isNotifiable: false,
  },
  {
    name: 'Timpanismo',
    category: 'METABOLIC',
    severity: 'SEVERE',
    affectedSystem: 'DIGESTIVE',
    symptoms: 'Distensão abdominal esquerda, dispneia, salivação, inquietude',
    isNotifiable: false,
  },
  {
    name: 'Fotossensibilização',
    category: 'NUTRITIONAL',
    severity: 'MODERATE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Lesões de pele em áreas despigmentadas, edema, necrose cutânea',
    isNotifiable: false,
  },
  {
    name: 'Brucelose',
    scientificName: 'Brucella abortus',
    category: 'INFECTIOUS',
    severity: 'SEVERE',
    affectedSystem: 'REPRODUCTIVE',
    symptoms: 'Aborto no terço final da gestação, retenção de placenta, infertilidade',
    isNotifiable: true,
    quarantineDays: 30,
  },
  {
    name: 'Tuberculose bovina',
    scientificName: 'Mycobacterium bovis',
    category: 'INFECTIOUS',
    severity: 'SEVERE',
    affectedSystem: 'RESPIRATORY',
    symptoms: 'Emagrecimento progressivo, tosse crônica, linfadenopatia',
    isNotifiable: true,
    quarantineDays: 30,
  },
  {
    name: 'Raiva',
    scientificName: 'Lyssavirus',
    category: 'INFECTIOUS',
    severity: 'SEVERE',
    affectedSystem: 'SYSTEMIC',
    symptoms: 'Alteração comportamental, salivação, paralisia, agressividade ou apatia',
    isNotifiable: true,
  },
];
