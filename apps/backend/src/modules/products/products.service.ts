import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  ProductError,
  PRODUCT_NATURES,
  PRODUCT_TYPES,
  SERVICE_TYPES,
  PRODUCT_STATUSES,
  CHARGE_UNITS,
  TYPICAL_FREQUENCIES,
  TOXICITY_CLASSES,
  ENVIRONMENTAL_CLASSES,
  NUTRIENT_FORMS,
  SOLUBILITY_OPTIONS,
  THERAPEUTIC_CLASSES,
  ADMINISTRATION_ROUTES,
  STORAGE_CONDITIONS,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductItem,
  type CompositionItem,
  type ManufacturerItem,
  type ListProductsQuery,
  type ListProductsResult,
  type WithdrawalPeriodInput,
  type SprayCompatibilityInput,
} from './products.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function validateCreate(input: CreateProductInput): void {
  if (!input.name?.trim()) {
    throw new ProductError('Nome é obrigatório', 400);
  }
  if (!input.nature || !(PRODUCT_NATURES as readonly string[]).includes(input.nature)) {
    throw new ProductError(`Natureza inválida. Use: ${PRODUCT_NATURES.join(', ')}`, 400);
  }
  if (!input.type?.trim()) {
    throw new ProductError('Tipo é obrigatório', 400);
  }

  const validTypes = input.nature === 'PRODUCT' ? PRODUCT_TYPES : SERVICE_TYPES;
  if (!(validTypes as readonly string[]).includes(input.type)) {
    throw new ProductError(
      `Tipo inválido para ${input.nature}. Tipos válidos: ${validTypes.join(', ')}`,
      400,
    );
  }

  if (input.status && !(PRODUCT_STATUSES as readonly string[]).includes(input.status)) {
    throw new ProductError(`Status inválido. Use: ${PRODUCT_STATUSES.join(', ')}`, 400);
  }

  // Validações específicas de serviço
  if (input.nature === 'SERVICE') {
    if (input.chargeUnit && !(CHARGE_UNITS as readonly string[]).includes(input.chargeUnit)) {
      throw new ProductError(`Unidade de cobrança inválida. Use: ${CHARGE_UNITS.join(', ')}`, 400);
    }
    if (
      input.typicalFrequency &&
      !(TYPICAL_FREQUENCIES as readonly string[]).includes(input.typicalFrequency)
    ) {
      throw new ProductError(`Frequência inválida. Use: ${TYPICAL_FREQUENCIES.join(', ')}`, 400);
    }
    if (input.unitCost != null && input.unitCost < 0) {
      throw new ProductError('Custo unitário não pode ser negativo', 400);
    }
  }

  // Validações de composição
  if (input.compositions) {
    for (const comp of input.compositions) {
      if (!comp.activeIngredient?.trim()) {
        throw new ProductError('Princípio ativo é obrigatório em cada composição', 400);
      }
    }
  }

  // US-092 CA1/CA2: Alertas de estoque
  if (input.reorderPoint != null && input.reorderPoint < 0) {
    throw new ProductError('Ponto de reposição não pode ser negativo', 400);
  }
  if (input.safetyStock != null && input.safetyStock < 0) {
    throw new ProductError('Estoque de segurança não pode ser negativo', 400);
  }
  if (
    input.expiryAlertDays != null &&
    (input.expiryAlertDays < 1 || !Number.isInteger(input.expiryAlertDays))
  ) {
    throw new ProductError('Dias para alerta de validade deve ser um inteiro positivo', 400);
  }

  // CA8-CA12: validações por tipo
  validateTypeSpecificFields(input);
}

function validateTypeSpecificFields(input: CreateProductInput | UpdateProductInput): void {
  // CA8: Defensivos
  if (
    input.toxicityClass &&
    !(TOXICITY_CLASSES as readonly string[]).includes(input.toxicityClass)
  ) {
    throw new ProductError(
      `Classe toxicológica inválida. Use: ${TOXICITY_CLASSES.join(', ')}`,
      400,
    );
  }
  if (
    input.environmentalClass &&
    !(ENVIRONMENTAL_CLASSES as readonly string[]).includes(input.environmentalClass)
  ) {
    throw new ProductError(
      `Classe ambiental inválida. Use: ${ENVIRONMENTAL_CLASSES.join(', ')}`,
      400,
    );
  }
  if (input.withdrawalPeriods) {
    for (const wp of input.withdrawalPeriods) {
      if (!wp.crop?.trim())
        throw new ProductError('Cultura é obrigatória no período de carência', 400);
      if (wp.days == null || wp.days < 0 || !Number.isInteger(wp.days)) {
        throw new ProductError('Dias de carência deve ser um inteiro não-negativo', 400);
      }
    }
  }

  // CA9: Fertilizantes
  if (input.nutrientForm && !(NUTRIENT_FORMS as readonly string[]).includes(input.nutrientForm)) {
    throw new ProductError(`Forma do nutriente inválida. Use: ${NUTRIENT_FORMS.join(', ')}`, 400);
  }
  if (input.solubility && !(SOLUBILITY_OPTIONS as readonly string[]).includes(input.solubility)) {
    throw new ProductError(`Solubilidade inválida. Use: ${SOLUBILITY_OPTIONS.join(', ')}`, 400);
  }

  // CA11: Medicamentos veterinários
  if (
    input.therapeuticClass &&
    !(THERAPEUTIC_CLASSES as readonly string[]).includes(input.therapeuticClass)
  ) {
    throw new ProductError(
      `Classe terapêutica inválida. Use: ${THERAPEUTIC_CLASSES.join(', ')}`,
      400,
    );
  }
  if (
    input.administrationRoute &&
    !(ADMINISTRATION_ROUTES as readonly string[]).includes(input.administrationRoute)
  ) {
    throw new ProductError(
      `Via de administração inválida. Use: ${ADMINISTRATION_ROUTES.join(', ')}`,
      400,
    );
  }
  if (
    input.storageCondition &&
    !(STORAGE_CONDITIONS as readonly string[]).includes(input.storageCondition)
  ) {
    throw new ProductError(
      `Condição de armazenamento inválida. Use: ${STORAGE_CONDITIONS.join(', ')}`,
      400,
    );
  }
  if (
    input.milkWithdrawalHours != null &&
    (input.milkWithdrawalHours < 0 || !Number.isInteger(input.milkWithdrawalHours))
  ) {
    throw new ProductError('Carência leite deve ser um inteiro não-negativo (horas)', 400);
  }
  if (
    input.slaughterWithdrawalDays != null &&
    (input.slaughterWithdrawalDays < 0 || !Number.isInteger(input.slaughterWithdrawalDays))
  ) {
    throw new ProductError('Carência abate deve ser um inteiro não-negativo (dias)', 400);
  }

  // CA12: Sementes
  if (input.germinationPct != null && (input.germinationPct < 0 || input.germinationPct > 100)) {
    throw new ProductError('Germinação deve ser entre 0 e 100%', 400);
  }
  if (input.purityPct != null && (input.purityPct < 0 || input.purityPct > 100)) {
    throw new ProductError('Pureza deve ser entre 0 e 100%', 400);
  }
}

function validateUpdate(input: UpdateProductInput): void {
  if (input.name !== undefined && !input.name?.trim()) {
    throw new ProductError('Nome não pode ser vazio', 400);
  }
  if (input.nature && !(PRODUCT_NATURES as readonly string[]).includes(input.nature)) {
    throw new ProductError(`Natureza inválida. Use: ${PRODUCT_NATURES.join(', ')}`, 400);
  }
  if (input.type) {
    const nature = input.nature; // nature may not be in update, validated with existing
    if (nature) {
      const validTypes = nature === 'PRODUCT' ? PRODUCT_TYPES : SERVICE_TYPES;
      if (!(validTypes as readonly string[]).includes(input.type)) {
        throw new ProductError(`Tipo inválido para ${nature}`, 400);
      }
    }
  }
  if (input.status && !(PRODUCT_STATUSES as readonly string[]).includes(input.status)) {
    throw new ProductError(`Status inválido. Use: ${PRODUCT_STATUSES.join(', ')}`, 400);
  }
  if (input.chargeUnit && !(CHARGE_UNITS as readonly string[]).includes(input.chargeUnit)) {
    throw new ProductError(`Unidade de cobrança inválida. Use: ${CHARGE_UNITS.join(', ')}`, 400);
  }
  if (
    input.typicalFrequency &&
    !(TYPICAL_FREQUENCIES as readonly string[]).includes(input.typicalFrequency)
  ) {
    throw new ProductError(`Frequência inválida. Use: ${TYPICAL_FREQUENCIES.join(', ')}`, 400);
  }
  if (input.unitCost != null && input.unitCost < 0) {
    throw new ProductError('Custo unitário não pode ser negativo', 400);
  }
  if (input.compositions) {
    for (const comp of input.compositions) {
      if (!comp.activeIngredient?.trim()) {
        throw new ProductError('Princípio ativo é obrigatório em cada composição', 400);
      }
    }
  }
  validateTypeSpecificFields(input);
}

function toCompositionItem(row: Record<string, unknown>): CompositionItem {
  return {
    id: row.id as string,
    activeIngredient: row.activeIngredient as string,
    concentration: (row.concentration as string) ?? null,
    function: (row.function as string) ?? null,
  };
}

function toItem(row: Record<string, unknown>): ProductItem {
  const manufacturer = row.manufacturer as Record<string, unknown> | null;
  const measurementUnit = row.measurementUnit as Record<string, unknown> | null;
  const cultivar = row.cultivar as Record<string, unknown> | null;
  const compositions = (row.compositions as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    nature: row.nature as string,
    name: row.name as string,
    type: row.type as string,
    category: (row.category as string) ?? null,
    status: row.status as string,
    notes: (row.notes as string) ?? null,
    commercialName: (row.commercialName as string) ?? null,
    manufacturer: manufacturer
      ? {
          id: manufacturer.id as string,
          name: manufacturer.name as string,
          cnpj: (manufacturer.cnpj as string) ?? null,
        }
      : null,
    measurementUnitId: (row.measurementUnitId as string) ?? null,
    measurementUnitAbbreviation: measurementUnit ? (measurementUnit.abbreviation as string) : null,
    barcode: (row.barcode as string) ?? null,
    photoUrl: (row.photoUrl as string) ?? null,
    technicalSheetUrl: (row.technicalSheetUrl as string) ?? null,
    chargeUnit: (row.chargeUnit as string) ?? null,
    unitCost: row.unitCost ? Number(row.unitCost) : null,
    typicalFrequency: (row.typicalFrequency as string) ?? null,
    requiresScheduling: (row.requiresScheduling as boolean) ?? false,
    linkedActivity: (row.linkedActivity as string) ?? null,
    compositions: compositions.map(toCompositionItem),
    // CA8: Defensivos
    toxicityClass: (row.toxicityClass as string) ?? null,
    mapaRegistration: (row.mapaRegistration as string) ?? null,
    environmentalClass: (row.environmentalClass as string) ?? null,
    actionMode: (row.actionMode as string) ?? null,
    chemicalGroup: (row.chemicalGroup as string) ?? null,
    withdrawalPeriods: (row.withdrawalPeriods as WithdrawalPeriodInput[]) ?? null,
    // CA9: Fertilizantes
    npkFormulation: (row.npkFormulation as string) ?? null,
    nutrientForm: (row.nutrientForm as string) ?? null,
    solubility: (row.solubility as string) ?? null,
    nutrientComposition: (row.nutrientComposition as Record<string, number>) ?? null,
    // CA10: Foliares
    nutritionalComposition: (row.nutritionalComposition as Record<string, number>) ?? null,
    sprayCompatibility: (row.sprayCompatibility as SprayCompatibilityInput) ?? null,
    // CA11: Medicamentos veterinários
    therapeuticClass: (row.therapeuticClass as string) ?? null,
    administrationRoute: (row.administrationRoute as string) ?? null,
    milkWithdrawalHours: (row.milkWithdrawalHours as number) ?? null,
    slaughterWithdrawalDays: (row.slaughterWithdrawalDays as number) ?? null,
    vetMapaRegistration: (row.vetMapaRegistration as string) ?? null,
    requiresPrescription: (row.requiresPrescription as boolean) ?? false,
    storageCondition: (row.storageCondition as string) ?? null,
    // CA12: Sementes
    cultivarId: (row.cultivarId as string) ?? null,
    cultivarName: cultivar ? (cultivar.name as string) : null,
    sieveSize: (row.sieveSize as string) ?? null,
    industrialTreatment: (row.industrialTreatment as string) ?? null,
    germinationPct: row.germinationPct ? Number(row.germinationPct) : null,
    purityPct: row.purityPct ? Number(row.purityPct) : null,
    // US-092 CA1/CA2
    reorderPoint: row.reorderPoint != null ? Number(row.reorderPoint) : null,
    safetyStock: row.safetyStock != null ? Number(row.safetyStock) : null,
    expiryAlertDays: (row.expiryAlertDays as number) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const PRODUCT_INCLUDE = {
  manufacturer: true,
  measurementUnit: { select: { id: true, abbreviation: true, name: true } },
  cultivar: { select: { id: true, name: true, crop: true } },
  compositions: true,
} as const;

// ─── Manufacturer helper ────────────────────────────────────────────

async function findOrCreateManufacturer(
  tx: any,
  organizationId: string,
  name: string,
  cnpj?: string | null,
): Promise<string> {
  const existing = await tx.manufacturer.findFirst({
    where: { organizationId, name: name.trim() },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.manufacturer.create({
    data: {
      organizationId,
      name: name.trim(),
      cnpj: cnpj?.trim() || null,
    },
  });
  return created.id;
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createProduct(
  ctx: RlsContext,
  input: CreateProductInput,
): Promise<ProductItem> {
  validateCreate(input);

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate
    const existing = await tx.product.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        nature: input.nature as any,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ProductError('Já existe um cadastro com este nome e natureza', 409);
    }

    // Validate measurementUnitId exists
    if (input.measurementUnitId) {
      const unit = await tx.measurementUnit.findFirst({
        where: { id: input.measurementUnitId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!unit) {
        throw new ProductError('Unidade de medida não encontrada', 404);
      }
    }

    // Find or create manufacturer
    let manufacturerId: string | null = null;
    if (input.manufacturerName?.trim()) {
      manufacturerId = await findOrCreateManufacturer(
        tx,
        ctx.organizationId,
        input.manufacturerName,
        input.manufacturerCnpj,
      );
    }

    const row = await tx.product.create({
      data: {
        organizationId: ctx.organizationId,
        nature: input.nature as any,
        name: input.name.trim(),
        type: input.type,
        category: input.category?.trim() || null,
        status: (input.status as any) || 'ACTIVE',
        notes: input.notes?.trim() || null,
        commercialName: input.commercialName?.trim() || null,
        manufacturerId,
        measurementUnitId: input.measurementUnitId || null,
        barcode: input.barcode?.trim() || null,
        photoUrl: input.photoUrl?.trim() || null,
        technicalSheetUrl: input.technicalSheetUrl?.trim() || null,
        chargeUnit: input.nature === 'SERVICE' ? input.chargeUnit || null : null,
        unitCost: input.nature === 'SERVICE' && input.unitCost != null ? input.unitCost : null,
        typicalFrequency: input.nature === 'SERVICE' ? input.typicalFrequency || null : null,
        requiresScheduling:
          input.nature === 'SERVICE' ? (input.requiresScheduling ?? false) : false,
        linkedActivity: input.nature === 'SERVICE' ? input.linkedActivity?.trim() || null : null,
        // CA8: Defensivos
        toxicityClass: input.toxicityClass || null,
        mapaRegistration: input.mapaRegistration?.trim() || null,
        environmentalClass: input.environmentalClass || null,
        actionMode: input.actionMode?.trim() || null,
        chemicalGroup: input.chemicalGroup?.trim() || null,
        withdrawalPeriods: (input.withdrawalPeriods as any) ?? undefined,
        // CA9: Fertilizantes
        npkFormulation: input.npkFormulation?.trim() || null,
        nutrientForm: input.nutrientForm || null,
        solubility: input.solubility || null,
        nutrientComposition: (input.nutrientComposition as any) ?? undefined,
        // CA10: Foliares
        nutritionalComposition: (input.nutritionalComposition as any) ?? undefined,
        sprayCompatibility: (input.sprayCompatibility as any) ?? undefined,
        // CA11: Medicamentos veterinários
        therapeuticClass: input.therapeuticClass || null,
        administrationRoute: input.administrationRoute || null,
        milkWithdrawalHours: input.milkWithdrawalHours ?? null,
        slaughterWithdrawalDays: input.slaughterWithdrawalDays ?? null,
        vetMapaRegistration: input.vetMapaRegistration?.trim() || null,
        requiresPrescription: input.requiresPrescription ?? false,
        storageCondition: input.storageCondition || null,
        // CA12: Sementes
        cultivarId: input.cultivarId || null,
        sieveSize: input.sieveSize?.trim() || null,
        industrialTreatment: input.industrialTreatment?.trim() || null,
        germinationPct: input.germinationPct != null ? input.germinationPct : null,
        purityPct: input.purityPct != null ? input.purityPct : null,
        // US-092 CA1/CA2
        reorderPoint: input.reorderPoint != null ? input.reorderPoint : null,
        safetyStock: input.safetyStock != null ? input.safetyStock : null,
        expiryAlertDays: input.expiryAlertDays != null ? input.expiryAlertDays : null,
        compositions: input.compositions?.length
          ? {
              create: input.compositions.map((c) => ({
                activeIngredient: c.activeIngredient.trim(),
                concentration: c.concentration?.trim() || null,
                function: c.function?.trim() || null,
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listProducts(
  ctx: RlsContext,
  query: ListProductsQuery,
): Promise<ListProductsResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.nature) where.nature = query.nature;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.manufacturerId) where.manufacturerId = query.manufacturerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { commercialName: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.product.findMany({
        where: where as any,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      tx.product.count({ where: where as any }),
    ]);

    return {
      data: (rows as unknown as Record<string, unknown>[]).map(toItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getProduct(ctx: RlsContext, id: string): Promise<ProductItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!row) {
      throw new ProductError('Produto/serviço não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateProduct(
  ctx: RlsContext,
  id: string,
  input: UpdateProductInput,
): Promise<ProductItem> {
  validateUpdate(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: { compositions: true },
    });
    if (!existing) {
      throw new ProductError('Produto/serviço não encontrado', 404);
    }

    const nature = input.nature ?? existing.nature;

    // Validate type against nature
    if (input.type) {
      const validTypes = nature === 'PRODUCT' ? PRODUCT_TYPES : SERVICE_TYPES;
      if (!(validTypes as readonly string[]).includes(input.type)) {
        throw new ProductError(`Tipo inválido para ${nature}`, 400);
      }
    }

    // Check duplicate name
    if (
      input.name &&
      (input.name.trim() !== existing.name || (input.nature && input.nature !== existing.nature))
    ) {
      const dup = await tx.product.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          nature: (input.nature ?? existing.nature) as any,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ProductError('Já existe um cadastro com este nome e natureza', 409);
      }
    }

    // Validate measurementUnitId
    if (input.measurementUnitId) {
      const unit = await tx.measurementUnit.findFirst({
        where: { id: input.measurementUnitId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!unit) {
        throw new ProductError('Unidade de medida não encontrada', 404);
      }
    }

    // Find or create manufacturer
    let manufacturerId: string | null | undefined;
    if (input.manufacturerName !== undefined) {
      if (input.manufacturerName?.trim()) {
        manufacturerId = await findOrCreateManufacturer(
          tx as any,
          ctx.organizationId,
          input.manufacturerName,
          input.manufacturerCnpj,
        );
      } else {
        manufacturerId = null;
      }
    }

    // Build data
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.nature !== undefined) data.nature = input.nature;
    if (input.type !== undefined) data.type = input.type;
    if (input.category !== undefined) data.category = input.category?.trim() || null;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.commercialName !== undefined)
      data.commercialName = input.commercialName?.trim() || null;
    if (manufacturerId !== undefined) data.manufacturerId = manufacturerId;
    if (input.measurementUnitId !== undefined)
      data.measurementUnitId = input.measurementUnitId || null;
    if (input.barcode !== undefined) data.barcode = input.barcode?.trim() || null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
    if (input.technicalSheetUrl !== undefined)
      data.technicalSheetUrl = input.technicalSheetUrl?.trim() || null;
    if (input.chargeUnit !== undefined) data.chargeUnit = input.chargeUnit || null;
    if (input.unitCost !== undefined)
      data.unitCost = input.unitCost != null ? input.unitCost : null;
    if (input.typicalFrequency !== undefined)
      data.typicalFrequency = input.typicalFrequency || null;
    if (input.requiresScheduling !== undefined) data.requiresScheduling = input.requiresScheduling;
    if (input.linkedActivity !== undefined)
      data.linkedActivity = input.linkedActivity?.trim() || null;
    // CA8: Defensivos
    if (input.toxicityClass !== undefined) data.toxicityClass = input.toxicityClass || null;
    if (input.mapaRegistration !== undefined)
      data.mapaRegistration = input.mapaRegistration?.trim() || null;
    if (input.environmentalClass !== undefined)
      data.environmentalClass = input.environmentalClass || null;
    if (input.actionMode !== undefined) data.actionMode = input.actionMode?.trim() || null;
    if (input.chemicalGroup !== undefined) data.chemicalGroup = input.chemicalGroup?.trim() || null;
    if (input.withdrawalPeriods !== undefined)
      data.withdrawalPeriods = input.withdrawalPeriods ?? null;
    // CA9: Fertilizantes
    if (input.npkFormulation !== undefined)
      data.npkFormulation = input.npkFormulation?.trim() || null;
    if (input.nutrientForm !== undefined) data.nutrientForm = input.nutrientForm || null;
    if (input.solubility !== undefined) data.solubility = input.solubility || null;
    if (input.nutrientComposition !== undefined)
      data.nutrientComposition = input.nutrientComposition ?? null;
    // CA10: Foliares
    if (input.nutritionalComposition !== undefined)
      data.nutritionalComposition = input.nutritionalComposition ?? null;
    if (input.sprayCompatibility !== undefined)
      data.sprayCompatibility = input.sprayCompatibility ?? null;
    // CA11: Medicamentos veterinários
    if (input.therapeuticClass !== undefined)
      data.therapeuticClass = input.therapeuticClass || null;
    if (input.administrationRoute !== undefined)
      data.administrationRoute = input.administrationRoute || null;
    if (input.milkWithdrawalHours !== undefined)
      data.milkWithdrawalHours = input.milkWithdrawalHours ?? null;
    if (input.slaughterWithdrawalDays !== undefined)
      data.slaughterWithdrawalDays = input.slaughterWithdrawalDays ?? null;
    if (input.vetMapaRegistration !== undefined)
      data.vetMapaRegistration = input.vetMapaRegistration?.trim() || null;
    if (input.requiresPrescription !== undefined)
      data.requiresPrescription = input.requiresPrescription;
    if (input.storageCondition !== undefined)
      data.storageCondition = input.storageCondition || null;
    // CA12: Sementes
    if (input.cultivarId !== undefined) data.cultivarId = input.cultivarId || null;
    if (input.sieveSize !== undefined) data.sieveSize = input.sieveSize?.trim() || null;
    if (input.industrialTreatment !== undefined)
      data.industrialTreatment = input.industrialTreatment?.trim() || null;
    if (input.germinationPct !== undefined)
      data.germinationPct = input.germinationPct != null ? input.germinationPct : null;
    if (input.purityPct !== undefined)
      data.purityPct = input.purityPct != null ? input.purityPct : null;
    // US-092 CA1/CA2
    if (input.reorderPoint !== undefined)
      data.reorderPoint = input.reorderPoint != null ? input.reorderPoint : null;
    if (input.safetyStock !== undefined)
      data.safetyStock = input.safetyStock != null ? input.safetyStock : null;
    if (input.expiryAlertDays !== undefined)
      data.expiryAlertDays = input.expiryAlertDays != null ? input.expiryAlertDays : null;

    // Replace compositions if provided
    if (input.compositions !== undefined) {
      await (tx as any).productComposition.deleteMany({ where: { productId: id } });
      if (input.compositions.length > 0) {
        await (tx as any).productComposition.createMany({
          data: input.compositions.map((c) => ({
            productId: id,
            activeIngredient: c.activeIngredient.trim(),
            concentration: c.concentration?.trim() || null,
            function: c.function?.trim() || null,
          })),
        });
      }
    }

    const row = await tx.product.update({
      where: { id },
      data: data as any,
      include: PRODUCT_INCLUDE,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteProduct(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.product.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new ProductError('Produto/serviço não encontrado', 404);
    }

    await tx.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Manufacturers ──────────────────────────────────────────────────

export async function listManufacturers(
  ctx: RlsContext,
  search?: string,
): Promise<ManufacturerItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const rows = await (tx as any).manufacturer.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 50,
    });

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      cnpj: (r.cnpj as string) ?? null,
    }));
  });
}
