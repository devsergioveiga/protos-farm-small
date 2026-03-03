import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import type { CreateProducerPFPayload } from '@/types/producer';

export interface ProducerPFFormFields {
  name: string;
  document: string;
  tradeName: string;
  birthDate: string;
  spouseCpf: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  incraRegistration: string;
  legalRepresentative: string;
  legalRepCpf: string;
  taxRegime: string;
}

export type PFFieldKey = keyof ProducerPFFormFields;

const INITIAL_FIELDS: ProducerPFFormFields = {
  name: '',
  document: '',
  tradeName: '',
  birthDate: '',
  spouseCpf: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  incraRegistration: '',
  legalRepresentative: '',
  legalRepCpf: '',
  taxRegime: '',
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

function stripCpf(value: string): string {
  return value.replace(/\D/g, '');
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

  if (fields.spouseCpf.trim()) {
    const spouseDigits = stripCpf(fields.spouseCpf);
    if (!CPF_REGEX.test(spouseDigits)) {
      errors.spouseCpf = 'CPF do cônjuge deve ter 11 dígitos';
    }
  }

  if (fields.legalRepCpf.trim()) {
    const repDigits = stripCpf(fields.legalRepCpf);
    if (!CPF_REGEX.test(repDigits)) {
      errors.legalRepCpf = 'CPF do representante deve ter 11 dígitos';
    }
  }

  if (fields.state && !(VALID_UF as readonly string[]).includes(fields.state)) {
    errors.state = 'UF inválida';
  }

  if (fields.zipCode.trim() && !CEP_REGEX.test(fields.zipCode.trim())) {
    errors.zipCode = 'CEP inválido (formato: 00000-000)';
  }

  return errors;
}

function buildPayload(fields: ProducerPFFormFields): CreateProducerPFPayload {
  const payload: CreateProducerPFPayload = {
    type: 'PF',
    name: fields.name.trim(),
    document: stripCpf(fields.document),
  };

  if (fields.tradeName.trim()) payload.tradeName = fields.tradeName.trim();
  if (fields.birthDate) payload.birthDate = fields.birthDate;
  if (fields.spouseCpf.trim()) payload.spouseCpf = stripCpf(fields.spouseCpf);
  if (fields.address.trim()) payload.address = fields.address.trim();
  if (fields.city.trim()) payload.city = fields.city.trim();
  if (fields.state) payload.state = fields.state;
  if (fields.zipCode.trim()) payload.zipCode = fields.zipCode.replace(/\D/g, '');
  if (fields.incraRegistration.trim()) payload.incraRegistration = fields.incraRegistration.trim();
  if (fields.legalRepresentative.trim())
    payload.legalRepresentative = fields.legalRepresentative.trim();
  if (fields.legalRepCpf.trim()) payload.legalRepCpf = stripCpf(fields.legalRepCpf);
  if (fields.taxRegime) payload.taxRegime = fields.taxRegime;

  return payload;
}

interface UseCreateProducerOptions {
  onSuccess: () => void;
}

export function useCreateProducer({ onSuccess }: UseCreateProducerOptions) {
  const [formData, setFormData] = useState<ProducerPFFormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<PFFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<PFFieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = useCallback(
    (key: PFFieldKey, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value };
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
      const payload = buildPayload(formData);
      await api.post('/org/producers', payload);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível cadastrar o produtor.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess]);

  const reset = useCallback(() => {
    setFormData(INITIAL_FIELDS);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, []);

  return {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    setField,
    touchField,
    submit,
    reset,
  };
}
