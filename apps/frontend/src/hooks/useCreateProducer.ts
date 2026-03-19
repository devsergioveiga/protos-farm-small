import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import { isoToDateInput } from '@/utils/dateUtils';
import type {
  CreateProducerPFPayload,
  CreateIePayload,
  UpdateProducerPayload,
  ProducerDetail,
} from '@/types/producer';

export interface ProducerPFFormFields {
  // Dados Cadastrais (same order as IE document)
  ieNumber: string;
  document: string;
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

export type PFFieldKey = keyof ProducerPFFormFields;

const INITIAL_FIELDS: ProducerPFFormFields = {
  ieNumber: '',
  document: '',
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

const CPF_REGEX = /^\d{11}$/;
const CEP_REGEX = /^\d{5}-?\d{3}$/;

export function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function stripCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCepInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function validatePFFields(
  fields: ProducerPFFormFields,
): Partial<Record<PFFieldKey, string>> {
  const errors: Partial<Record<PFFieldKey, string>> = {};

  if (!fields.name.trim()) {
    errors.name = 'Nome é obrigatório';
  }

  const docDigits = stripCpf(fields.document);
  if (!docDigits) {
    errors.document = 'CPF é obrigatório';
  } else if (!CPF_REGEX.test(docDigits)) {
    errors.document = 'CPF deve ter 11 dígitos';
  }

  if (fields.state && !(VALID_UF as readonly string[]).includes(fields.state)) {
    errors.state = 'UF inválida';
  }

  if (fields.zipCode.trim() && !CEP_REGEX.test(fields.zipCode.trim())) {
    errors.zipCode = 'CEP inválido (formato: 00000-000)';
  }

  return errors;
}

function buildCreatePayload(fields: ProducerPFFormFields): CreateProducerPFPayload {
  const payload: CreateProducerPFPayload = {
    type: 'PF',
    name: fields.name.trim(),
    document: stripCpf(fields.document),
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

function buildUpdatePayload(fields: ProducerPFFormFields): UpdateProducerPayload {
  const payload: UpdateProducerPayload = {
    name: fields.name.trim(),
    document: stripCpf(fields.document),
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

function buildIePayload(fields: ProducerPFFormFields): CreateIePayload | null {
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

function detailToFormFields(detail: ProducerDetail): ProducerPFFormFields {
  const firstIe = detail.stateRegistrations?.[0];

  return {
    ieNumber: firstIe?.number ?? '',
    document: detail.document ? formatCpfInput(detail.document) : '',
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

interface UseCreateProducerOptions {
  onSuccess: () => void;
  producerId?: string;
}

export function useCreateProducer({ onSuccess, producerId }: UseCreateProducerOptions) {
  const isEditMode = !!producerId;
  const [formData, setFormData] = useState<ProducerPFFormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<PFFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<PFFieldKey, boolean>>>({});
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
          if (detail.stateRegistrations?.[0]) {
            setExistingIeId(detail.stateRegistrations[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmitError('Não foi possível carregar os dados do produtor.');
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
    (key: PFFieldKey, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value } as ProducerPFFormFields;
          const newErrors = validatePFFields(updated);
          return { ...prev, [key]: newErrors[key] };
        });
      }
    },
    [formData, touched],
  );

  const touchField = useCallback(
    (key: PFFieldKey) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors(validatePFFields(formData));
    },
    [formData],
  );

  const submit = useCallback(async () => {
    const allTouched = Object.keys(INITIAL_FIELDS).reduce(
      (acc, key) => {
        acc[key as PFFieldKey] = true;
        return acc;
      },
      {} as Record<PFFieldKey, boolean>,
    );
    setTouched(allTouched);

    const validationErrors = validatePFFields(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let targetProducerId = producerId;

      if (isEditMode) {
        const payload = buildUpdatePayload(formData);
        await api.patch(`/org/producers/${producerId}`, payload);
      } else {
        const payload = buildCreatePayload(formData);
        const created = await api.post<{ id: string }>('/org/producers', payload);
        targetProducerId = created.id;
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
            : 'Não foi possível cadastrar o produtor.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess, isEditMode, producerId, existingIeId]);

  const reset = useCallback(() => {
    setFormData(INITIAL_FIELDS);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
    setExistingIeId(null);
  }, []);

  return {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    isLoadingDetail,
    setField,
    touchField,
    submit,
    reset,
  };
}
