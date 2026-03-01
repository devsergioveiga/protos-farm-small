import type { ProducerFarmBondType } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { logger } from '../../shared/utils/logger';
import { isValidCPF, isValidCNPJ, cleanDocument } from '../../shared/utils/document-validator';
import {
  ProducerError,
  VALID_UF,
  PRODUCER_TYPES,
  TAX_REGIMES,
  IE_SITUATIONS,
  IE_CATEGORIES,
  BOND_TYPES,
  IE_NUMBER_REGEX,
  type CreateProducerInput,
  type UpdateProducerInput,
  type ListProducersQuery,
  type CreateParticipantInput,
  type UpdateParticipantInput,
  type CreateIeInput,
  type UpdateIeInput,
  type CreateFarmLinkInput,
  type UpdateFarmLinkInput,
} from './producers.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateUf(uf: string): void {
  if (!(VALID_UF as readonly string[]).includes(uf)) {
    throw new ProducerError(`UF inválida: ${uf}`, 400);
  }
}

function validateProducerType(type: string): void {
  if (!(PRODUCER_TYPES as readonly string[]).includes(type)) {
    throw new ProducerError(
      `Tipo de produtor inválido. Valores permitidos: ${PRODUCER_TYPES.join(', ')}`,
      400,
    );
  }
}

function validateTaxRegime(regime: string | undefined): void {
  if (regime && !(TAX_REGIMES as readonly string[]).includes(regime)) {
    throw new ProducerError(
      `Regime tributário inválido. Valores permitidos: ${TAX_REGIMES.join(', ')}`,
      400,
    );
  }
}

function validateIeNumber(num: string): void {
  const cleaned = cleanDocument(num);
  if (!IE_NUMBER_REGEX.test(cleaned)) {
    throw new ProducerError('Número da IE inválido. Esperado: 8 a 14 dígitos', 400);
  }
}

function validateIeSituation(situation: string | undefined): void {
  if (situation && !(IE_SITUATIONS as readonly string[]).includes(situation)) {
    throw new ProducerError(
      `Situação da IE inválida. Valores permitidos: ${IE_SITUATIONS.join(', ')}`,
      400,
    );
  }
}

function validateIeCategory(category: string | undefined): void {
  if (category && !(IE_CATEGORIES as readonly string[]).includes(category)) {
    throw new ProducerError(
      `Categoria da IE inválida. Valores permitidos: ${IE_CATEGORIES.join(', ')}`,
      400,
    );
  }
}

function validateBondType(bondType: string): void {
  if (!(BOND_TYPES as readonly string[]).includes(bondType)) {
    throw new ProducerError(
      `Tipo de vínculo inválido. Valores permitidos: ${BOND_TYPES.join(', ')}`,
      400,
    );
  }
}

// ─── Create Producer ────────────────────────────────────────────────

export async function createProducer(ctx: RlsContext, input: CreateProducerInput) {
  validateProducerType(input.type);
  validateTaxRegime(input.taxRegime);

  if (input.state) {
    validateUf(input.state);
  }

  // PF: name + CPF required
  if (input.type === 'PF') {
    if (!input.document) {
      throw new ProducerError('CPF é obrigatório para pessoa física', 400);
    }
    if (!isValidCPF(input.document)) {
      throw new ProducerError('CPF inválido', 400);
    }
  }

  // PJ: name + CNPJ required
  if (input.type === 'PJ') {
    if (!input.document) {
      throw new ProducerError('CNPJ é obrigatório para pessoa jurídica', 400);
    }
    if (!isValidCNPJ(input.document)) {
      throw new ProducerError('CNPJ inválido', 400);
    }
  }

  // SC: document must be null
  if (input.type === 'SOCIEDADE_EM_COMUM' && input.document) {
    throw new ProducerError('Sociedade em Comum não possui documento (CPF/CNPJ)', 400);
  }

  // Validate optional CPF fields
  if (input.spouseCpf && !isValidCPF(input.spouseCpf)) {
    throw new ProducerError('CPF do cônjuge inválido', 400);
  }
  if (input.legalRepCpf && !isValidCPF(input.legalRepCpf)) {
    throw new ProducerError('CPF do representante legal inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate document within org
    if (input.document) {
      const existing = await tx.producer.findFirst({
        where: { document: input.document, organizationId: ctx.organizationId },
      });
      if (existing) {
        throw new ProducerError('Já existe um produtor com este documento nesta organização', 409);
      }
    }

    const producer = await tx.producer.create({
      data: {
        organizationId: ctx.organizationId,
        type: input.type as 'PF' | 'PJ' | 'SOCIEDADE_EM_COMUM',
        name: input.name,
        tradeName: input.tradeName ?? null,
        document: input.document ?? null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        spouseCpf: input.spouseCpf ?? null,
        incraRegistration: input.incraRegistration ?? null,
        legalRepresentative: input.legalRepresentative ?? null,
        legalRepCpf: input.legalRepCpf ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zipCode: input.zipCode ?? null,
        taxRegime:
          (input.taxRegime as 'REAL' | 'PRESUMIDO' | 'SIMPLES' | 'ISENTO' | undefined) ?? undefined,
        mainCnae: input.mainCnae ?? null,
        ruralActivityType: input.ruralActivityType ?? null,
      },
    });

    logger.info({ producerId: producer.id, orgId: ctx.organizationId }, 'Producer created');

    return producer;
  });
}

// ─── List Producers ─────────────────────────────────────────────────

export async function listProducers(ctx: RlsContext, query: ListProducersQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { tradeName: { contains: query.search, mode: 'insensitive' } },
      { document: { contains: query.search } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.type) {
    where.type = query.type;
  }

  return withRlsContext(ctx, async (tx) => {
    const [data, total] = await Promise.all([
      tx.producer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { farmLinks: true, stateRegistrations: true } },
        },
      }),
      tx.producer.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── Get Producer ───────────────────────────────────────────────────

export async function getProducer(ctx: RlsContext, producerId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        stateRegistrations: { orderBy: { createdAt: 'asc' } },
        farmLinks: {
          include: {
            farm: { select: { id: true, name: true, nickname: true, state: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    return producer;
  });
}

// ─── Update Producer ────────────────────────────────────────────────

export async function updateProducer(
  ctx: RlsContext,
  producerId: string,
  input: UpdateProducerInput,
) {
  if (input.state) {
    validateUf(input.state);
  }
  validateTaxRegime(input.taxRegime);

  if (input.spouseCpf && !isValidCPF(input.spouseCpf)) {
    throw new ProducerError('CPF do cônjuge inválido', 400);
  }
  if (input.legalRepCpf && !isValidCPF(input.legalRepCpf)) {
    throw new ProducerError('CPF do representante legal inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.producer.findUnique({ where: { id: producerId } });
    if (!existing) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    // Validate document changes
    if (input.document !== undefined && input.document !== existing.document) {
      if (existing.type === 'PF' && input.document && !isValidCPF(input.document)) {
        throw new ProducerError('CPF inválido', 400);
      }
      if (existing.type === 'PJ' && input.document && !isValidCNPJ(input.document)) {
        throw new ProducerError('CNPJ inválido', 400);
      }
      if (existing.type === 'SOCIEDADE_EM_COMUM' && input.document) {
        throw new ProducerError('Sociedade em Comum não possui documento (CPF/CNPJ)', 400);
      }
      if (input.document) {
        const dup = await tx.producer.findFirst({
          where: {
            document: input.document,
            organizationId: ctx.organizationId,
            id: { not: producerId },
          },
        });
        if (dup) {
          throw new ProducerError(
            'Já existe um produtor com este documento nesta organização',
            409,
          );
        }
      }
    }

    const updated = await tx.producer.update({
      where: { id: producerId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.tradeName !== undefined && { tradeName: input.tradeName || null }),
        ...(input.document !== undefined && { document: input.document || null }),
        ...(input.birthDate !== undefined && {
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
        }),
        ...(input.spouseCpf !== undefined && { spouseCpf: input.spouseCpf || null }),
        ...(input.incraRegistration !== undefined && {
          incraRegistration: input.incraRegistration || null,
        }),
        ...(input.legalRepresentative !== undefined && {
          legalRepresentative: input.legalRepresentative || null,
        }),
        ...(input.legalRepCpf !== undefined && { legalRepCpf: input.legalRepCpf || null }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.city !== undefined && { city: input.city || null }),
        ...(input.state !== undefined && { state: input.state || null }),
        ...(input.zipCode !== undefined && { zipCode: input.zipCode || null }),
        ...(input.taxRegime !== undefined && {
          taxRegime: (input.taxRegime || null) as
            | 'REAL'
            | 'PRESUMIDO'
            | 'SIMPLES'
            | 'ISENTO'
            | null,
        }),
        ...(input.mainCnae !== undefined && { mainCnae: input.mainCnae || null }),
        ...(input.ruralActivityType !== undefined && {
          ruralActivityType: input.ruralActivityType || null,
        }),
      },
    });

    logger.info({ producerId, orgId: ctx.organizationId }, 'Producer updated');

    return updated;
  });
}

// ─── Toggle Producer Status ─────────────────────────────────────────

export async function toggleProducerStatus(
  ctx: RlsContext,
  producerId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const updated = await tx.producer.update({
      where: { id: producerId },
      data: { status },
    });

    logger.info({ producerId, orgId: ctx.organizationId, status }, 'Producer status updated');

    return updated;
  });
}

// ─── Society Participants ───────────────────────────────────────────

export async function addParticipant(
  ctx: RlsContext,
  producerId: string,
  input: CreateParticipantInput,
) {
  if (!isValidCPF(input.cpf)) {
    throw new ProducerError('CPF do participante inválido', 400);
  }

  if (input.participationPct <= 0 || input.participationPct > 100) {
    throw new ProducerError('Percentual de participação deve ser entre 0.01 e 100', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { participants: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    if (producer.type !== 'SOCIEDADE_EM_COMUM') {
      throw new ProducerError('Participantes só podem ser adicionados a Sociedade em Comum', 400);
    }

    // Check duplicate CPF
    const existingCpf = producer.participants.find(
      (p) => cleanDocument(p.cpf) === cleanDocument(input.cpf),
    );
    if (existingCpf) {
      throw new ProducerError('Já existe um participante com este CPF', 409);
    }

    // Check total percentage
    const currentTotal = producer.participants.reduce(
      (sum, p) => sum + Number(p.participationPct),
      0,
    );
    if (currentTotal + input.participationPct > 100) {
      throw new ProducerError(
        `Soma dos percentuais excede 100%. Atual: ${currentTotal}%, tentando adicionar: ${input.participationPct}%`,
        400,
      );
    }

    const participant = await tx.societyParticipant.create({
      data: {
        producerId,
        name: input.name,
        cpf: input.cpf,
        participationPct: input.participationPct,
        isMainResponsible: input.isMainResponsible ?? false,
      },
    });

    logger.info({ producerId, participantId: participant.id }, 'Participant added');

    return participant;
  });
}

export async function updateParticipant(
  ctx: RlsContext,
  producerId: string,
  participantId: string,
  input: UpdateParticipantInput,
) {
  if (input.cpf && !isValidCPF(input.cpf)) {
    throw new ProducerError('CPF do participante inválido', 400);
  }

  if (input.participationPct !== undefined) {
    if (input.participationPct <= 0 || input.participationPct > 100) {
      throw new ProducerError('Percentual de participação deve ser entre 0.01 e 100', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { participants: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = producer.participants.find((p) => p.id === participantId);
    if (!existing) {
      throw new ProducerError('Participante não encontrado', 404);
    }

    // Check total percentage excluding current participant
    if (input.participationPct !== undefined) {
      const othersTotal = producer.participants
        .filter((p) => p.id !== participantId)
        .reduce((sum, p) => sum + Number(p.participationPct), 0);
      if (othersTotal + input.participationPct > 100) {
        throw new ProducerError(
          `Soma dos percentuais excede 100%. Outros: ${othersTotal}%, novo valor: ${input.participationPct}%`,
          400,
        );
      }
    }

    // Check CPF uniqueness if changing
    if (input.cpf && cleanDocument(input.cpf) !== cleanDocument(existing.cpf)) {
      const dupCpf = producer.participants.find(
        (p) => p.id !== participantId && cleanDocument(p.cpf) === cleanDocument(input.cpf!),
      );
      if (dupCpf) {
        throw new ProducerError('Já existe um participante com este CPF', 409);
      }
    }

    const updated = await tx.societyParticipant.update({
      where: { id: participantId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.cpf !== undefined && { cpf: input.cpf }),
        ...(input.participationPct !== undefined && { participationPct: input.participationPct }),
        ...(input.isMainResponsible !== undefined && {
          isMainResponsible: input.isMainResponsible,
        }),
      },
    });

    logger.info({ producerId, participantId }, 'Participant updated');

    return updated;
  });
}

export async function deleteParticipant(
  ctx: RlsContext,
  producerId: string,
  participantId: string,
) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { participants: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = producer.participants.find((p) => p.id === participantId);
    if (!existing) {
      throw new ProducerError('Participante não encontrado', 404);
    }

    await tx.societyParticipant.delete({ where: { id: participantId } });

    logger.info({ producerId, participantId }, 'Participant deleted');

    return { message: 'Participante removido com sucesso' };
  });
}

// ─── State Registrations (IEs) ──────────────────────────────────────

export async function addIe(ctx: RlsContext, producerId: string, input: CreateIeInput) {
  validateUf(input.state);
  validateIeNumber(input.number);
  validateIeSituation(input.situation);
  validateIeCategory(input.category);

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    // Check duplicate (producerId, number, state)
    const existing = await tx.producerStateRegistration.findFirst({
      where: { producerId, number: input.number, state: input.state },
    });
    if (existing) {
      throw new ProducerError('Já existe uma IE com este número e UF para este produtor', 409);
    }

    // If farmId provided, verify farm belongs to org
    if (input.farmId) {
      const farm = await tx.farm.findUnique({ where: { id: input.farmId } });
      if (!farm) {
        throw new ProducerError('Fazenda não encontrada', 404);
      }
    }

    const ie = await tx.producerStateRegistration.create({
      data: {
        producerId,
        farmId: input.farmId ?? null,
        number: input.number,
        state: input.state,
        cnaeActivity: input.cnaeActivity ?? null,
        assessmentRegime: input.assessmentRegime ?? null,
        category:
          (input.category as 'PRIMEIRO_ESTABELECIMENTO' | 'DEMAIS' | 'UNICO' | undefined) ??
          undefined,
        inscriptionDate: input.inscriptionDate ? new Date(input.inscriptionDate) : null,
        situation: (input.situation as 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') ?? 'ACTIVE',
        contractEndDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        milkProgramOptIn: input.milkProgramOptIn ?? false,
        isDefaultForFarm: input.isDefaultForFarm ?? false,
      },
    });

    logger.info({ producerId, ieId: ie.id }, 'IE added');

    return ie;
  });
}

export async function updateIe(
  ctx: RlsContext,
  producerId: string,
  ieId: string,
  input: UpdateIeInput,
) {
  if (input.state) {
    validateUf(input.state);
  }
  if (input.number) {
    validateIeNumber(input.number);
  }
  validateIeSituation(input.situation);
  validateIeCategory(input.category);

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { stateRegistrations: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = producer.stateRegistrations.find((ie) => ie.id === ieId);
    if (!existing) {
      throw new ProducerError('Inscrição estadual não encontrada', 404);
    }

    // Check unique constraint if number or state changes
    const newNumber = input.number ?? existing.number;
    const newState = input.state ?? existing.state;
    if (newNumber !== existing.number || newState !== existing.state) {
      const dup = await tx.producerStateRegistration.findFirst({
        where: { producerId, number: newNumber, state: newState, id: { not: ieId } },
      });
      if (dup) {
        throw new ProducerError('Já existe uma IE com este número e UF para este produtor', 409);
      }
    }

    if (input.farmId) {
      const farm = await tx.farm.findUnique({ where: { id: input.farmId } });
      if (!farm) {
        throw new ProducerError('Fazenda não encontrada', 404);
      }
    }

    const updated = await tx.producerStateRegistration.update({
      where: { id: ieId },
      data: {
        ...(input.number !== undefined && { number: input.number }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.farmId !== undefined && { farmId: input.farmId || null }),
        ...(input.cnaeActivity !== undefined && { cnaeActivity: input.cnaeActivity || null }),
        ...(input.assessmentRegime !== undefined && {
          assessmentRegime: input.assessmentRegime || null,
        }),
        ...(input.category !== undefined && {
          category: (input.category || null) as
            | 'PRIMEIRO_ESTABELECIMENTO'
            | 'DEMAIS'
            | 'UNICO'
            | null,
        }),
        ...(input.inscriptionDate !== undefined && {
          inscriptionDate: input.inscriptionDate ? new Date(input.inscriptionDate) : null,
        }),
        ...(input.situation !== undefined && {
          situation: input.situation as 'ACTIVE' | 'SUSPENDED' | 'CANCELLED',
        }),
        ...(input.contractEndDate !== undefined && {
          contractEndDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        }),
        ...(input.milkProgramOptIn !== undefined && { milkProgramOptIn: input.milkProgramOptIn }),
        ...(input.isDefaultForFarm !== undefined && { isDefaultForFarm: input.isDefaultForFarm }),
      },
    });

    logger.info({ producerId, ieId }, 'IE updated');

    return updated;
  });
}

export async function deleteIe(ctx: RlsContext, producerId: string, ieId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { stateRegistrations: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = producer.stateRegistrations.find((ie) => ie.id === ieId);
    if (!existing) {
      throw new ProducerError('Inscrição estadual não encontrada', 404);
    }

    await tx.producerStateRegistration.delete({ where: { id: ieId } });

    logger.info({ producerId, ieId }, 'IE deleted');

    return { message: 'Inscrição estadual removida com sucesso' };
  });
}

// ─── Set Default IE for Farm ────────────────────────────────────────

export async function setDefaultIeForFarm(ctx: RlsContext, producerId: string, ieId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({
      where: { id: producerId },
      include: { stateRegistrations: true },
    });

    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const ie = producer.stateRegistrations.find((i) => i.id === ieId);
    if (!ie) {
      throw new ProducerError('Inscrição estadual não encontrada', 404);
    }

    if (!ie.farmId) {
      throw new ProducerError('Esta IE não está vinculada a uma fazenda', 400);
    }

    // Unset all other defaults for same farm
    await tx.producerStateRegistration.updateMany({
      where: { producerId, farmId: ie.farmId, isDefaultForFarm: true, id: { not: ieId } },
      data: { isDefaultForFarm: false },
    });

    const updated = await tx.producerStateRegistration.update({
      where: { id: ieId },
      data: { isDefaultForFarm: true },
    });

    logger.info({ producerId, ieId, farmId: ie.farmId }, 'Default IE set for farm');

    return updated;
  });
}

// ─── Farm Links ─────────────────────────────────────────────────────

export async function addFarmLink(ctx: RlsContext, producerId: string, input: CreateFarmLinkInput) {
  validateBondType(input.bondType);

  if (input.participationPct !== undefined) {
    if (input.participationPct < 0 || input.participationPct > 100) {
      throw new ProducerError('Percentual de participação deve ser entre 0 e 100', 400);
    }
  }

  // Validate date range
  if (input.startDate && input.endDate) {
    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new ProducerError('Data de término deve ser igual ou posterior à data de início', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const farm = await tx.farm.findUnique({ where: { id: input.farmId } });
    if (!farm) {
      throw new ProducerError('Fazenda não encontrada', 404);
    }

    // Check duplicate link
    const existing = await tx.producerFarmLink.findFirst({
      where: { producerId, farmId: input.farmId, bondType: input.bondType as ProducerFarmBondType },
    });
    if (existing) {
      throw new ProducerError('Já existe um vínculo com este tipo para esta fazenda', 409);
    }

    // Validate registrationIds belong to the farm
    if (input.registrationIds && input.registrationIds.length > 0) {
      const regs = await tx.farmRegistration.findMany({
        where: { id: { in: input.registrationIds }, farmId: input.farmId },
      });
      if (regs.length !== input.registrationIds.length) {
        throw new ProducerError('Uma ou mais matrículas não pertencem a esta fazenda', 400);
      }
    }

    // If isItrDeclarant, unset others for this farm
    if (input.isItrDeclarant) {
      await tx.producerFarmLink.updateMany({
        where: { farmId: input.farmId, isItrDeclarant: true },
        data: { isItrDeclarant: false },
      });
    }

    const link = await tx.producerFarmLink.create({
      data: {
        producerId,
        farmId: input.farmId,
        bondType: input.bondType as ProducerFarmBondType,
        participationPct: input.participationPct ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isItrDeclarant: input.isItrDeclarant ?? false,
        ...(input.registrationIds && input.registrationIds.length > 0
          ? {
              registrationLinks: {
                create: input.registrationIds.map((rid) => ({
                  farmRegistrationId: rid,
                })),
              },
            }
          : {}),
      },
      include: {
        farm: { select: { id: true, name: true, nickname: true, state: true } },
        registrationLinks: { include: { farmRegistration: true } },
      },
    });

    logger.info({ producerId, linkId: link.id, farmId: input.farmId }, 'Farm link added');

    return link;
  });
}

export async function listFarmLinks(ctx: RlsContext, producerId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    return tx.producerFarmLink.findMany({
      where: { producerId },
      include: {
        farm: { select: { id: true, name: true, nickname: true, state: true } },
        registrationLinks: { include: { farmRegistration: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });
}

export async function updateFarmLink(
  ctx: RlsContext,
  producerId: string,
  linkId: string,
  input: UpdateFarmLinkInput,
) {
  if (input.bondType) {
    validateBondType(input.bondType);
  }

  if (input.participationPct !== undefined) {
    if (input.participationPct < 0 || input.participationPct > 100) {
      throw new ProducerError('Percentual de participação deve ser entre 0 e 100', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = await tx.producerFarmLink.findFirst({
      where: { id: linkId, producerId },
    });
    if (!existing) {
      throw new ProducerError('Vínculo não encontrado', 404);
    }

    // Validate date range
    const effectiveStart =
      input.startDate !== undefined
        ? input.startDate
          ? new Date(input.startDate)
          : null
        : existing.startDate;
    const effectiveEnd =
      input.endDate !== undefined
        ? input.endDate
          ? new Date(input.endDate)
          : null
        : existing.endDate;
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new ProducerError('Data de término deve ser igual ou posterior à data de início', 400);
    }

    // Check duplicate if bondType changes
    if (input.bondType && input.bondType !== existing.bondType) {
      const dup = await tx.producerFarmLink.findFirst({
        where: {
          producerId,
          farmId: existing.farmId,
          bondType: input.bondType as ProducerFarmBondType,
          id: { not: linkId },
        },
      });
      if (dup) {
        throw new ProducerError('Já existe um vínculo com este tipo para esta fazenda', 409);
      }
    }

    // Validate registrationIds belong to the farm
    if (input.registrationIds && input.registrationIds.length > 0) {
      const regs = await tx.farmRegistration.findMany({
        where: { id: { in: input.registrationIds }, farmId: existing.farmId },
      });
      if (regs.length !== input.registrationIds.length) {
        throw new ProducerError('Uma ou mais matrículas não pertencem a esta fazenda', 400);
      }
    }

    // If isItrDeclarant being set to true, unset others for this farm
    if (input.isItrDeclarant) {
      await tx.producerFarmLink.updateMany({
        where: { farmId: existing.farmId, isItrDeclarant: true, id: { not: linkId } },
        data: { isItrDeclarant: false },
      });
    }

    // Sync registrationLinks if provided (delete + create)
    if (input.registrationIds !== undefined) {
      await tx.producerRegistrationLink.deleteMany({ where: { farmLinkId: linkId } });
      if (input.registrationIds.length > 0) {
        await tx.producerRegistrationLink.createMany({
          data: input.registrationIds.map((rid) => ({
            farmLinkId: linkId,
            farmRegistrationId: rid,
          })),
        });
      }
    }

    const updated = await tx.producerFarmLink.update({
      where: { id: linkId },
      data: {
        ...(input.bondType !== undefined && { bondType: input.bondType as ProducerFarmBondType }),
        ...(input.participationPct !== undefined && {
          participationPct: input.participationPct,
        }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.endDate !== undefined && {
          endDate: input.endDate ? new Date(input.endDate) : null,
        }),
        ...(input.isItrDeclarant !== undefined && { isItrDeclarant: input.isItrDeclarant }),
      },
      include: {
        farm: { select: { id: true, name: true, nickname: true, state: true } },
        registrationLinks: { include: { farmRegistration: true } },
      },
    });

    logger.info({ producerId, linkId }, 'Farm link updated');

    return updated;
  });
}

export async function deleteFarmLink(ctx: RlsContext, producerId: string, linkId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const existing = await tx.producerFarmLink.findFirst({
      where: { id: linkId, producerId },
    });
    if (!existing) {
      throw new ProducerError('Vínculo não encontrado', 404);
    }

    await tx.producerFarmLink.delete({ where: { id: linkId } });

    logger.info({ producerId, linkId }, 'Farm link deleted');

    return { message: 'Vínculo removido com sucesso' };
  });
}

// ─── Reverse lookup: Farm → Producers ───────────────────────────────

export async function getProducersByFarm(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new ProducerError('Fazenda não encontrada', 404);
    }

    return tx.producerFarmLink.findMany({
      where: { farmId },
      include: {
        producer: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            type: true,
            document: true,
            status: true,
            stateRegistrations: {
              where: { farmId, situation: 'ACTIVE' },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        registrationLinks: { include: { farmRegistration: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });
}

// ─── Farm Participation Validation ──────────────────────────────────

export async function validateFarmParticipation(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new ProducerError('Fazenda não encontrada', 404);
    }

    const links = await tx.producerFarmLink.findMany({
      where: { farmId },
      include: {
        producer: { select: { id: true, name: true } },
      },
    });

    // Group by bondType
    const byBondType: Record<
      string,
      { total: number; producers: { id: string; name: string; pct: number }[] }
    > = {};
    for (const link of links) {
      const bt = link.bondType;
      if (!byBondType[bt]) {
        byBondType[bt] = { total: 0, producers: [] };
      }
      const pct = Number(link.participationPct ?? 0);
      byBondType[bt].total += pct;
      byBondType[bt].producers.push({ id: link.producer.id, name: link.producer.name, pct });
    }

    const warnings: string[] = [];
    for (const [bondType, data] of Object.entries(byBondType)) {
      if (data.total !== 100) {
        warnings.push(`Soma dos percentuais para ${bondType}: ${data.total}% (esperado: 100%)`);
      }
    }

    return { farmId, participation: byBondType, warnings };
  });
}

// ─── ITR Declarant ──────────────────────────────────────────────────

export async function getItrDeclarant(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new ProducerError('Fazenda não encontrada', 404);
    }

    const link = await tx.producerFarmLink.findFirst({
      where: { farmId, isItrDeclarant: true },
      include: {
        producer: {
          select: { id: true, name: true, type: true, document: true },
        },
      },
    });

    if (!link) {
      throw new ProducerError('Nenhum declarante ITR definido para esta fazenda', 404);
    }

    return link;
  });
}

export async function setItrDeclarant(ctx: RlsContext, producerId: string, linkId: string) {
  return withRlsContext(ctx, async (tx) => {
    const producer = await tx.producer.findUnique({ where: { id: producerId } });
    if (!producer) {
      throw new ProducerError('Produtor não encontrado', 404);
    }

    const link = await tx.producerFarmLink.findFirst({
      where: { id: linkId, producerId },
    });
    if (!link) {
      throw new ProducerError('Vínculo não encontrado', 404);
    }

    // Unset all other declarants for this farm
    await tx.producerFarmLink.updateMany({
      where: { farmId: link.farmId, isItrDeclarant: true, id: { not: linkId } },
      data: { isItrDeclarant: false },
    });

    const updated = await tx.producerFarmLink.update({
      where: { id: linkId },
      data: { isItrDeclarant: true },
      include: {
        farm: { select: { id: true, name: true, nickname: true, state: true } },
        producer: { select: { id: true, name: true, type: true, document: true } },
      },
    });

    logger.info({ producerId, linkId, farmId: link.farmId }, 'ITR declarant set');

    return updated;
  });
}

// ─── Expiring Contracts ─────────────────────────────────────────────

export async function getExpiringContracts(ctx: RlsContext, daysAhead: number) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + daysAhead);

  return withRlsContext(ctx, async (tx) => {
    // Farm links with endDate in range
    const expiringLinks = await tx.producerFarmLink.findMany({
      where: {
        endDate: { gte: now, lte: futureDate },
      },
      include: {
        producer: { select: { id: true, name: true, type: true, document: true } },
        farm: { select: { id: true, name: true, nickname: true, state: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    // IEs with contractEndDate in range
    const expiringIes = await tx.producerStateRegistration.findMany({
      where: {
        contractEndDate: { gte: now, lte: futureDate },
      },
      include: {
        producer: { select: { id: true, name: true, type: true, document: true } },
        farm: { select: { id: true, name: true, nickname: true, state: true } },
      },
      orderBy: { contractEndDate: 'asc' },
    });

    const alerts = [
      ...expiringLinks.map((link) => ({
        type: 'FARM_LINK' as const,
        id: link.id,
        producerName: link.producer.name,
        farmName: link.farm.name,
        bondType: link.bondType,
        expiresAt: link.endDate,
      })),
      ...expiringIes.map((ie) => ({
        type: 'STATE_REGISTRATION' as const,
        id: ie.id,
        producerName: ie.producer.name,
        farmName: ie.farm?.name ?? null,
        ieNumber: ie.number,
        ieState: ie.state,
        expiresAt: ie.contractEndDate,
      })),
    ];

    // Sort by expiresAt
    alerts.sort((a, b) => {
      const da = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
      const db = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
      return da - db;
    });

    return { alerts, total: alerts.length };
  });
}
