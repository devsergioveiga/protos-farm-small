import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import { formatCpfInput, stripCpf } from '@/hooks/useCreateProducer';
import { isoToDateInput } from '@/utils/dateUtils';
import type {
  CreateProducerSCPayload,
  CreateParticipantPayload,
  CreateIePayload,
  UpdateProducerPayload,
  ProducerDetail,
} from '@/types/producer';

export interface ProducerSCFormFields {
  // Dados Cadastrais (same order as IE document)
  ieNumber: string;
  name: string;
  tradeName: string;
  cnaeActivity: string;
  assessmentRegime: string;
  category: string;
  inscriptionDate: string;
  contractEndDate: string;
  situation: string;
  // Endereço do Estabelecimento
  zipCode: string;
  state: string;
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  addressNumber: string;
  complement: string;
  locationReference: string;
  // Extra
  milkProgramOptIn: boolean;
}

export type SCFieldKey = keyof ProducerSCFormFields;

export interface ParticipantRow {
  name: string;
  cpf: string;
  participationPct: string;
  isMainResponsible: boolean;
}

const INITIAL_FIELDS: ProducerSCFormFields = {
  ieNumber: '',
  name: '',
  tradeName: '',
  cnaeActivity: '',
  assessmentRegime: '',
  category: '',
  inscriptionDate: '',
  contractEndDate: '',
  situation: '',
  zipCode: '',
  state: '',
  city: '',
  district: '',
  neighborhood: '',
  street: '',
  addressNumber: '',
  complement: '',
  locationReference: '',
  milkProgramOptIn: false,
};

function emptyParticipant(): ParticipantRow {
  return { name: '', cpf: '', participationPct: '', isMainResponsible: false };
}

const INITIAL_PARTICIPANTS: ParticipantRow[] = [
  { ...emptyParticipant(), isMainResponsible: true },
  emptyParticipant(),
];

const CPF_REGEX = /^\d{11}$/;
const CEP_REGEX = /^\d{5}-?\d{3}$/;

export interface SCValidationErrors {
  fields: Partial<Record<SCFieldKey, string>>;
  participants: string[];
  global: string | null;
}

export function validateSCForm(
  fields: ProducerSCFormFields,
  participants: ParticipantRow[],
): SCValidationErrors {
  const fieldErrors: Partial<Record<SCFieldKey, string>> = {};

  if (!fields.name.trim()) {
    fieldErrors.name = 'Nome é obrigatório';
  }

  if (fields.state && !(VALID_UF as readonly string[]).includes(fields.state)) {
    fieldErrors.state = 'UF inválida';
  }

  if (fields.zipCode.trim() && !CEP_REGEX.test(fields.zipCode.trim())) {
    fieldErrors.zipCode = 'CEP inválido (formato: 00000-000)';
  }

  const participantErrors: string[] = [];
  const cpfSet = new Set<string>();
  let mainCount = 0;
  let totalPct = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const errs: string[] = [];

    if (!p.name.trim()) {
      errs.push('Nome é obrigatório');
    }

    const cpfDigits = stripCpf(p.cpf);
    if (!cpfDigits) {
      errs.push('CPF é obrigatório');
    } else if (!CPF_REGEX.test(cpfDigits)) {
      errs.push('CPF deve ter 11 dígitos');
    } else if (cpfSet.has(cpfDigits)) {
      errs.push('CPF duplicado');
    } else {
      cpfSet.add(cpfDigits);
    }

    const pct = parseFloat(p.participationPct);
    if (!p.participationPct.trim()) {
      errs.push('Percentual é obrigatório');
    } else if (isNaN(pct) || pct < 0.01 || pct > 100) {
      errs.push('Percentual deve ser entre 0,01 e 100');
    } else {
      totalPct += pct;
    }

    if (p.isMainResponsible) mainCount++;

    participantErrors.push(errs.join('; '));
  }

  let globalError: string | null = null;

  if (participants.length < 2) {
    globalError = 'A sociedade deve ter pelo menos 2 participantes';
  } else if (mainCount !== 1) {
    globalError = 'Deve haver exatamente 1 responsável principal';
  } else if (totalPct > 100) {
    globalError = 'A soma dos percentuais não pode ultrapassar 100%';
  }

  return { fields: fieldErrors, participants: participantErrors, global: globalError };
}

function hasErrors(errors: SCValidationErrors): boolean {
  return (
    Object.keys(errors.fields).length > 0 ||
    errors.participants.some((e) => e !== '') ||
    errors.global !== null
  );
}

function buildCreatePayload(fields: ProducerSCFormFields): CreateProducerSCPayload {
  const payload: CreateProducerSCPayload = {
    type: 'SOCIEDADE_EM_COMUM',
    name: fields.name.trim(),
  };

  if (fields.tradeName.trim()) payload.tradeName = fields.tradeName.trim();
  if (fields.street.trim()) payload.street = fields.street.trim();
  if (fields.addressNumber.trim()) payload.addressNumber = fields.addressNumber.trim();
  if (fields.complement.trim()) payload.complement = fields.complement.trim();
  if (fields.neighborhood.trim()) payload.neighborhood = fields.neighborhood.trim();
  if (fields.district.trim()) payload.district = fields.district.trim();
  if (fields.locationReference.trim()) payload.locationReference = fields.locationReference.trim();
  if (fields.city.trim()) payload.city = fields.city.trim();
  if (fields.state) payload.state = fields.state;
  if (fields.zipCode.trim()) payload.zipCode = fields.zipCode.replace(/\D/g, '');

  return payload;
}

function buildUpdatePayload(fields: ProducerSCFormFields): UpdateProducerPayload {
  const payload: UpdateProducerPayload = {
    name: fields.name.trim(),
  };

  payload.tradeName = fields.tradeName.trim() || undefined;
  payload.street = fields.street.trim() || undefined;
  payload.addressNumber = fields.addressNumber.trim() || undefined;
  payload.complement = fields.complement.trim() || undefined;
  payload.neighborhood = fields.neighborhood.trim() || undefined;
  payload.district = fields.district.trim() || undefined;
  payload.locationReference = fields.locationReference.trim() || undefined;
  payload.city = fields.city.trim() || undefined;
  payload.state = fields.state || undefined;
  payload.zipCode = fields.zipCode.trim() ? fields.zipCode.replace(/\D/g, '') : undefined;

  return payload;
}

function buildIePayload(fields: ProducerSCFormFields): CreateIePayload | null {
  const ieDigits = fields.ieNumber.replace(/\D/g, '');
  if (!ieDigits) return null;

  const payload: CreateIePayload = {
    number: fields.ieNumber.trim(),
    state: fields.state || 'MG',
  };

  if (fields.cnaeActivity.trim()) payload.cnaeActivity = fields.cnaeActivity.trim();
  if (fields.assessmentRegime.trim()) payload.assessmentRegime = fields.assessmentRegime.trim();
  if (fields.category) payload.category = fields.category;
  if (fields.inscriptionDate) payload.inscriptionDate = fields.inscriptionDate;
  if (fields.contractEndDate) payload.contractEndDate = fields.contractEndDate;
  if (fields.situation) payload.situation = fields.situation;
  payload.milkProgramOptIn = fields.milkProgramOptIn;

  return payload;
}

function detailToFormFields(detail: ProducerDetail): ProducerSCFormFields {
  const firstIe = detail.stateRegistrations?.[0];

  return {
    ieNumber: firstIe?.number ?? '',
    name: detail.name || '',
    tradeName: detail.tradeName || '',
    cnaeActivity: firstIe?.cnaeActivity ?? '',
    assessmentRegime: firstIe?.assessmentRegime ?? '',
    category: firstIe?.category ?? '',
    inscriptionDate: isoToDateInput(firstIe?.inscriptionDate),
    contractEndDate: isoToDateInput(firstIe?.contractEndDate),
    situation: firstIe?.situation ?? '',
    zipCode: detail.zipCode || '',
    state: detail.state || '',
    city: detail.city || '',
    district: detail.district || '',
    neighborhood: detail.neighborhood || '',
    street: detail.street || '',
    addressNumber: detail.addressNumber || '',
    complement: detail.complement || '',
    locationReference: detail.locationReference || '',
    milkProgramOptIn: firstIe?.milkProgramOptIn ?? false,
  };
}

function detailToParticipants(detail: ProducerDetail): ParticipantRow[] {
  if (!detail.participants || detail.participants.length === 0) {
    return INITIAL_PARTICIPANTS.map((p) => ({ ...p }));
  }
  return detail.participants.map((p) => ({
    name: p.name,
    cpf: p.cpf ? formatCpfInput(p.cpf) : '',
    participationPct: p.participationPct != null ? String(p.participationPct) : '',
    isMainResponsible: p.isMainResponsible,
  }));
}

interface UseCreateProducerSCOptions {
  onSuccess: () => void;
  producerId?: string;
}

export function useCreateProducerSC({ onSuccess, producerId }: UseCreateProducerSCOptions) {
  const isEditMode = !!producerId;
  const [formData, setFormData] = useState<ProducerSCFormFields>(INITIAL_FIELDS);
  const [participants, setParticipants] = useState<ParticipantRow[]>(
    INITIAL_PARTICIPANTS.map((p) => ({ ...p })),
  );
  const [errors, setErrors] = useState<SCValidationErrors>({
    fields: {},
    participants: [],
    global: null,
  });
  const [touched, setTouched] = useState<Partial<Record<SCFieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [existingIeId, setExistingIeId] = useState<string | null>(null);

  useEffect(() => {
    if (!producerId) return;
    let cancelled = false;
    setIsLoadingDetail(true);

    api
      .get<ProducerDetail>(`/org/producers/${producerId}`)
      .then((detail) => {
        if (!cancelled) {
          setFormData(detailToFormFields(detail));
          setParticipants(detailToParticipants(detail));
          if (detail.stateRegistrations?.[0]) {
            setExistingIeId(detail.stateRegistrations[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmitError('Não foi possível carregar os dados da sociedade.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [producerId]);

  const setField = useCallback(
    (key: SCFieldKey, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value } as ProducerSCFormFields;
          const newErrors = validateSCForm(updated, participants);
          return { ...prev, fields: { ...prev.fields, [key]: newErrors.fields[key] } };
        });
      }
    },
    [formData, touched, participants],
  );

  const touchField = useCallback(
    (key: SCFieldKey) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      const newErrors = validateSCForm(formData, participants);
      setErrors((prev) => ({ ...prev, fields: { ...prev.fields, [key]: newErrors.fields[key] } }));
    },
    [formData, participants],
  );

  const addParticipant = useCallback(() => {
    setParticipants((prev) => [...prev, emptyParticipant()]);
  }, []);

  const removeParticipant = useCallback((index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const replaceAllParticipants = useCallback((rows: ParticipantRow[]) => {
    setParticipants(rows);
  }, []);

  const setParticipantField = useCallback(
    (index: number, key: keyof ParticipantRow, value: string | boolean) => {
      setParticipants((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [key]: value };

        // If setting isMainResponsible to true, unset all others
        if (key === 'isMainResponsible' && value === true) {
          return next.map((p, i) => ({
            ...p,
            isMainResponsible: i === index,
          }));
        }

        return next;
      });
      setSubmitError(null);
    },
    [],
  );

  const submit = useCallback(async () => {
    // Touch all fields
    const allTouched = Object.keys(INITIAL_FIELDS).reduce(
      (acc, key) => {
        acc[key as SCFieldKey] = true;
        return acc;
      },
      {} as Record<SCFieldKey, boolean>,
    );
    setTouched(allTouched);

    const validationErrors = validateSCForm(formData, participants);
    setErrors(validationErrors);

    if (hasErrors(validationErrors)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let targetProducerId = producerId;

      if (isEditMode) {
        const payload = buildUpdatePayload(formData);
        await api.patch(`/org/producers/${producerId}`, payload);

        // Sync participants: delete old, create new
        const detail = await api.get<ProducerDetail>(`/org/producers/${producerId}`);
        for (const existing of detail.participants) {
          await api.delete(`/org/producers/${producerId}/participants/${existing.id}`);
        }
        for (const p of participants) {
          const participantPayload: CreateParticipantPayload = {
            name: p.name.trim(),
            cpf: stripCpf(p.cpf),
            participationPct: parseFloat(p.participationPct),
            isMainResponsible: p.isMainResponsible,
          };
          await api.post(`/org/producers/${producerId}/participants`, participantPayload);
        }
      } else {
        const payload = buildCreatePayload(formData);
        const created = await api.post<{ id: string }>('/org/producers', payload);
        targetProducerId = created.id;

        // Create participants
        for (const p of participants) {
          const participantPayload: CreateParticipantPayload = {
            name: p.name.trim(),
            cpf: stripCpf(p.cpf),
            participationPct: parseFloat(p.participationPct),
            isMainResponsible: p.isMainResponsible,
          };
          await api.post(`/org/producers/${targetProducerId}/participants`, participantPayload);
        }
      }

      // Create or update IE if number provided
      const iePayload = buildIePayload(formData);
      if (iePayload && targetProducerId) {
        if (existingIeId) {
          await api.patch(`/org/producers/${targetProducerId}/ies/${existingIeId}`, iePayload);
        } else {
          await api.post(`/org/producers/${targetProducerId}/ies`, iePayload);
        }
      }

      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditMode
            ? 'Não foi possível salvar as alterações.'
            : 'Não foi possível cadastrar a sociedade.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, participants, onSuccess, isEditMode, producerId, existingIeId]);

  const reset = useCallback(() => {
    setFormData(INITIAL_FIELDS);
    setParticipants(INITIAL_PARTICIPANTS.map((p) => ({ ...p })));
    setErrors({ fields: {}, participants: [], global: null });
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
    setExistingIeId(null);
  }, []);

  const totalPct = participants.reduce((sum, p) => {
    const pct = parseFloat(p.participationPct);
    return sum + (isNaN(pct) ? 0 : pct);
  }, 0);

  return {
    formData,
    participants,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    isLoadingDetail,
    totalPct,
    setField,
    touchField,
    addParticipant,
    removeParticipant,
    replaceAllParticipants,
    setParticipantField,
    submit,
    reset,
  };
}
