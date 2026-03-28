// ─── Payroll Rubricas Service ─────────────────────────────────────────

import { withRlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import type {
  CreateRubricaInput,
  UpdateRubricaInput,
  RubricaListQuery,
  RubricaOutput,
} from './payroll-rubricas.types';

// ─── Error class ──────────────────────────────────────────────────────

export class PayrollRubricaError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PayrollRubricaError';
  }
}

// ─── System rubrica definitions ───────────────────────────────────────

const SYSTEM_RUBRICAS: CreateRubricaInput[] = [
  {
    code: 'INSS',
    name: 'INSS',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'SYSTEM' as const,
    formulaType: 'SYSTEM_INSS' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'IRRF',
    name: 'IRRF',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'SYSTEM' as const,
    formulaType: 'SYSTEM_IRRF' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'FGTS',
    name: 'FGTS',
    rubricaType: 'INFORMATIVO' as const,
    calculationType: 'SYSTEM' as const,
    formulaType: 'SYSTEM_FGTS' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'SAL_FAMILIA',
    name: 'Salário-Família',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'SYSTEM' as const,
    formulaType: 'SYSTEM_SALARY_FAMILY' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'FUNRURAL',
    name: 'FUNRURAL',
    rubricaType: 'INFORMATIVO' as const,
    calculationType: 'SYSTEM' as const,
    formulaType: 'SYSTEM_FUNRURAL' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'SALARIO_BASE',
    name: 'Salário Base',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'FIXED_VALUE' as const,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'HE_50',
    name: 'Hora Extra 50%',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.5,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'HE_100',
    name: 'Hora Extra 100%',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 1.0,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'NOTURNO',
    name: 'Adicional Noturno',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.25,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'INSALUBRIDADE',
    name: 'Insalubridade',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'PERICULOSIDADE',
    name: 'Periculosidade',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.3,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
  {
    code: 'VT',
    name: 'Vale Transporte',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.06,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'MORADIA',
    name: 'Desconto Moradia',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.2,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'ALIMENTACAO',
    name: 'Desconto Alimentação',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'PERCENTAGE' as const,
    rate: 0.25,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'ADIANTAMENTO',
    name: 'Adiantamento Salarial',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'FIXED_VALUE' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'FALTAS',
    name: 'Desconto por Faltas',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'FORMULA' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'PENSAO',
    name: 'Pensão Alimentícia',
    rubricaType: 'DESCONTO' as const,
    calculationType: 'FIXED_VALUE' as const,
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
  },
  {
    code: 'COMISSAO',
    name: 'Comissão',
    rubricaType: 'PROVENTO' as const,
    calculationType: 'PERCENTAGE' as const,
    incideINSS: true,
    incideFGTS: true,
    incideIRRF: true,
  },
];

// ─── Service ──────────────────────────────────────────────────────────

export const payrollRubricasService = {
  async list(
    orgId: string,
    query: RubricaListQuery,
  ): Promise<{ items: RubricaOutput[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId: orgId,
    };

    if (query.rubricaType !== undefined) {
      where.rubricaType = query.rubricaType;
    }

    // Default: show only active rubricas unless explicitly overridden
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    } else {
      where.isActive = true;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return Promise.all([
        tx.payrollRubrica.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        }),
        tx.payrollRubrica.count({ where }),
      ]);
    });

    return { items: items as RubricaOutput[], total };
  },

  async getById(orgId: string, id: string): Promise<RubricaOutput> {
    const rubrica = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollRubrica.findFirst({
        where: { id, organizationId: orgId },
      });
    });

    if (!rubrica) {
      throw new PayrollRubricaError('Rubrica não encontrada', 404);
    }

    return rubrica as RubricaOutput;
  },

  async create(orgId: string, data: CreateRubricaInput, userId: string): Promise<RubricaOutput> {
    // Validate: only seed can create SYSTEM calculationType
    if (data.calculationType === 'SYSTEM') {
      throw new PayrollRubricaError(
        'Não é permitido criar rubricas do tipo SYSTEM manualmente',
        400,
      );
    }

    // Validate: if PERCENTAGE, rate is required
    if (data.calculationType === 'PERCENTAGE' && data.rate === undefined) {
      throw new PayrollRubricaError(
        'Taxa (rate) é obrigatória para rubricas do tipo PERCENTAGE',
        400,
      );
    }

    // Validate: if FORMULA, baseFormula is required
    if (data.calculationType === 'FORMULA' && !data.baseFormula) {
      throw new PayrollRubricaError(
        'Fórmula base (baseFormula) é obrigatória para rubricas do tipo FORMULA',
        400,
      );
    }

    return withRlsContext({ organizationId: orgId }, async (tx) => {
      // Check code uniqueness within org
      const existing = await tx.payrollRubrica.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: data.code } },
        select: { id: true },
      });
      if (existing) {
        throw new PayrollRubricaError(
          `Já existe uma rubrica com o código "${data.code}" nesta organização`,
          409,
        );
      }

      const rubrica = await tx.payrollRubrica.create({
        data: {
          organizationId: orgId,
          code: data.code,
          name: data.name,
          rubricaType: data.rubricaType,
          calculationType: data.calculationType,
          formulaType: data.formulaType ?? null,
          baseFormula: data.baseFormula ?? null,
          rate: data.rate !== undefined ? data.rate : null,
          fixedValue: data.fixedValue !== undefined ? data.fixedValue : null,
          incideINSS: data.incideINSS ?? false,
          incideFGTS: data.incideFGTS ?? false,
          incideIRRF: data.incideIRRF ?? false,
          eSocialCode: data.eSocialCode ?? null,
          isSystem: false,
          isActive: true,
          createdBy: userId,
        },
      });

      return rubrica as RubricaOutput;
    });
  },

  async update(orgId: string, id: string, data: UpdateRubricaInput): Promise<RubricaOutput> {
    const existing = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollRubrica.findFirst({
        where: { id, organizationId: orgId },
      });
    });

    if (!existing) {
      throw new PayrollRubricaError('Rubrica não encontrada', 404);
    }

    // Block editing system rubricas
    if (existing.isSystem) {
      throw new PayrollRubricaError('Rubrica de sistema não pode ser editada', 403);
    }

    return withRlsContext({ organizationId: orgId }, async (tx) => {
      const updated = await tx.payrollRubrica.update({
        where: { id },
        data: {
          name: data.name,
          rubricaType: data.rubricaType,
          calculationType: data.calculationType,
          formulaType: data.formulaType ?? undefined,
          baseFormula: data.baseFormula ?? undefined,
          rate: data.rate !== undefined ? data.rate : undefined,
          fixedValue: data.fixedValue !== undefined ? data.fixedValue : undefined,
          incideINSS: data.incideINSS,
          incideFGTS: data.incideFGTS,
          incideIRRF: data.incideIRRF,
          eSocialCode: data.eSocialCode ?? undefined,
          isActive: data.isActive,
        },
      });

      return updated as RubricaOutput;
    });
  },

  async deactivate(orgId: string, id: string): Promise<RubricaOutput> {
    const existing = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollRubrica.findFirst({
        where: { id, organizationId: orgId },
      });
    });

    if (!existing) {
      throw new PayrollRubricaError('Rubrica não encontrada', 404);
    }

    // Block deactivating system rubricas
    if (existing.isSystem) {
      throw new PayrollRubricaError('Rubrica de sistema não pode ser desativada', 403);
    }

    return withRlsContext({ organizationId: orgId }, async (tx) => {
      const updated = await tx.payrollRubrica.update({
        where: { id },
        data: { isActive: false },
      });

      return updated as RubricaOutput;
    });
  },

  async seedSystemRubricas(orgId: string, userId: string): Promise<void> {
    // Check if org already has system rubricas
    const existing = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollRubrica.findFirst({
        where: { organizationId: orgId, isSystem: true },
        select: { id: true },
      });
    });

    if (existing) {
      return; // Already seeded
    }

    // Create all system rubricas
    await withRlsContext({ organizationId: orgId }, async (tx) => {
      for (const rubrica of SYSTEM_RUBRICAS) {
        // Check if code already exists (could be a custom rubrica with same code)
        const codeExists = await tx.payrollRubrica.findUnique({
          where: { organizationId_code: { organizationId: orgId, code: rubrica.code } },
          select: { id: true },
        });

        if (!codeExists) {
          await tx.payrollRubrica.create({
            data: {
              organizationId: orgId,
              code: rubrica.code,
              name: rubrica.name,
              rubricaType: rubrica.rubricaType,
              calculationType: rubrica.calculationType,
              formulaType: rubrica.formulaType ?? null,
              baseFormula: rubrica.baseFormula ?? null,
              rate: rubrica.rate !== undefined ? rubrica.rate : null,
              fixedValue: rubrica.fixedValue !== undefined ? rubrica.fixedValue : null,
              incideINSS: rubrica.incideINSS ?? false,
              incideFGTS: rubrica.incideFGTS ?? false,
              incideIRRF: rubrica.incideIRRF ?? false,
              eSocialCode: rubrica.eSocialCode ?? null,
              isSystem: true,
              isActive: true,
              createdBy: userId,
            },
          });
        }
      }
    });
  },

  // Helper: check if org has any rubricas (used by list to decide whether to seed)
  async hasRubricas(orgId: string): Promise<boolean> {
    const item = await prisma.payrollRubrica.findFirst({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return !!item;
  },
};
