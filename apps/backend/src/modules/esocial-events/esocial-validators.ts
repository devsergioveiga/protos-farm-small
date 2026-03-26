// ─── eSocial Pre-generation Validators ───────────────────────────────────────
// Validate source data before XML generation.
// Returns EsocialValidationError[] — empty means valid.

import type { EsocialValidationError } from './esocial-events.types';

// ─── S-2200 (evtAdmissao) ────────────────────────────────────────────────────

export function validateS2200Input(
  employee: { name?: string; cpf?: string | null; pisPassep?: string | null; birthDate?: unknown },
  contract: { salary?: number | null },
  position: { cbo?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!employee.pisPassep) {
    errors.push({ field: 'nisTrab', employeeName: employee.name, message: 'NIS/PIS nao informado' });
  }

  if (!position.cbo) {
    errors.push({ field: 'codCBO', employeeName: employee.name, message: 'CBO do cargo nao informado' });
  }

  if (!contract.salary || Number(contract.salary) <= 0) {
    errors.push({ field: 'vrSalFx', employeeName: employee.name, message: 'Salario invalido ou zero' });
  }

  if (!employee.birthDate) {
    errors.push({ field: 'dtNascimento', employeeName: employee.name, message: 'Data de nascimento nao informada' });
  }

  return errors;
}

// ─── S-2206 (evtAltContratual) ───────────────────────────────────────────────

export function validateS2206Input(
  employee: { name?: string; cpf?: string | null },
  amendment: { effectiveAt?: unknown },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!amendment.effectiveAt) {
    errors.push({ field: 'dtAlt', employeeName: employee.name, message: 'Data da alteracao nao informada' });
  }

  return errors;
}

// ─── S-2230 (evtAfastTemp) ───────────────────────────────────────────────────

export function validateS2230Input(
  employee: { name?: string; cpf?: string | null },
  absence: { startDate?: unknown; absenceType?: string },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!absence.startDate) {
    errors.push({ field: 'dtIniAfast', employeeName: employee.name, message: 'Data de inicio do afastamento nao informada' });
  }

  return errors;
}

// ─── S-2299 (evtDeslig) ──────────────────────────────────────────────────────

export function validateS2299Input(
  employee: { name?: string; cpf?: string | null },
  termination: { terminationDate?: unknown },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!termination.terminationDate) {
    errors.push({ field: 'dtDeslig', employeeName: employee.name, message: 'Data do desligamento nao informada' });
  }

  return errors;
}

// ─── S-1200 (evtRemun) ───────────────────────────────────────────────────────

export function validateS1200Input(
  item: { lineItemsJson?: string | null },
  employee: { name?: string; cpf?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!item.lineItemsJson) {
    errors.push({ field: 'lineItemsJson', employeeName: employee.name, message: 'Itens de remuneracao ausentes' });
    return errors;
  }

  try {
    const items: Array<{ eSocialCode?: string | null }> = JSON.parse(item.lineItemsJson);
    const hasEsocialCode = items.some((i) => i.eSocialCode != null && i.eSocialCode !== '');
    if (!hasEsocialCode) {
      errors.push({
        field: 'itensRemun',
        employeeName: employee.name,
        message: 'Nenhuma rubrica com codigo eSocial encontrada — verifique a tabela de rubricas',
      });
    }
  } catch {
    errors.push({ field: 'lineItemsJson', employeeName: employee.name, message: 'lineItemsJson com formato invalido' });
  }

  return errors;
}

// ─── S-1210 (evtPgtos) ───────────────────────────────────────────────────────

export function validateS1210Input(
  item: { lineItemsJson?: string | null },
  employee: { name?: string; cpf?: string | null },
): EsocialValidationError[] {
  // Same validation as S-1200
  return validateS1200Input(item, employee);
}

// ─── S-1299 (evtFechaEvPer) ──────────────────────────────────────────────────

export function validateS1299Input(
  payrollRun: { referenceMonth?: unknown },
  organization: { cnpj?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!payrollRun.referenceMonth) {
    errors.push({ field: 'perApur', message: 'Competencia (referenceMonth) nao informada' });
  }

  if (!organization.cnpj) {
    errors.push({ field: 'nrInsc', message: 'CNPJ da organizacao nao informado' });
  }

  return errors;
}

// ─── S-2220 (evtMonit / ASO) ─────────────────────────────────────────────────

export function validateS2220Input(
  exam: { type?: string; date?: unknown; doctorCrm?: string | null; result?: string },
  employee: { name?: string; cpf?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!exam.doctorCrm) {
    errors.push({ field: 'nrCRM', employeeName: employee.name, message: 'CRM do medico nao informado' });
  }

  if (!exam.date) {
    errors.push({ field: 'dtAso', employeeName: employee.name, message: 'Data do ASO nao informada' });
  }

  return errors;
}

// ─── S-2240 (evtExpRisco) ────────────────────────────────────────────────────

export function validateS2240Input(
  epiDelivery: { deliveryDate?: unknown },
  employee: { name?: string; cpf?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];

  if (!employee.cpf) {
    errors.push({ field: 'cpfTrab', employeeName: employee.name, message: 'CPF nao informado' });
  }

  if (!epiDelivery.deliveryDate) {
    errors.push({ field: 'dtIniCondicao', employeeName: employee.name, message: 'Data de entrega do EPI nao informada' });
  }

  return errors;
}

// ─── Table events (S-1000, S-1005, S-1010, S-1020) ───────────────────────────

export function validateS1000Input(
  organization: { cnpj?: string | null; name?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];
  if (!organization.cnpj) {
    errors.push({ field: 'nrInsc', message: 'CNPJ da organizacao nao informado' });
  }
  return errors;
}

export function validateS1005Input(
  farm: { cnae?: string | null },
  organization: { cnpj?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];
  if (!organization.cnpj) {
    errors.push({ field: 'nrInsc', message: 'CNPJ da organizacao nao informado' });
  }
  if (!farm.cnae) {
    errors.push({ field: 'cnaePrep', message: 'CNAE do estabelecimento nao informado' });
  }
  return errors;
}

export function validateS1010Input(
  rubrica: { code?: string | null; name?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];
  if (!rubrica.code) {
    errors.push({ field: 'codRubr', message: 'Codigo da rubrica nao informado' });
  }
  return errors;
}

export function validateS1020Input(
  position: { id?: string | null },
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];
  if (!position.id) {
    errors.push({ field: 'codLotacao', message: 'Identificador da lotacao nao informado' });
  }
  return errors;
}
