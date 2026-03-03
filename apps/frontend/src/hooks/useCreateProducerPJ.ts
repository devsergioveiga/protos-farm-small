import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import type { CreateProducerPJPayload } from '@/types/producer';

export interface ProducerPJFormFields {
  name: string;
  document: string;
  tradeName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  incraRegistration: string;
  legalRepresentative: string;
  legalRepCpf: string;
  taxRegime: string;
  mainCnae: string;
  ruralActivityType: string;
}

export type PJFieldKey = keyof ProducerPJFormFields;

const INITIAL_FIELDS: ProducerPJFormFields = {
  name: '',
  document: '',
  tradeName: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  incraRegistration: '',
  legalRepresentative: '',
  legalRepCpf: '',
  taxRegime: '',
  mainCnae: '',
  ruralActivityType: '',
};

const CNPJ_REGEX = /^\d{14}$/;
const CPF_REGEX = /^\d{11}$/;
const CEP_REGEX = /^\d{5}-?\d{3}$/;

export function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function stripDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function validatePJFields(
  fields: ProducerPJFormFields,
): Partial<Record<PJFieldKey, string>> {
  const errors: Partial<Record<PJFieldKey, string>> = {};

  if (!fields.name.trim()) {
    errors.name = 'Razão social é obrigatória';
  }

  const docDigits = stripDigits(fields.document);
  if (!docDigits) {
    errors.document = 'CNPJ é obrigatório';
  } else if (!CNPJ_REGEX.test(docDigits)) {
    errors.document = 'CNPJ deve ter 14 dígitos';
  }

  if (fields.legalRepCpf.trim()) {
    const repDigits = stripDigits(fields.legalRepCpf);
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

function buildPayload(fields: ProducerPJFormFields): CreateProducerPJPayload {
  const payload: CreateProducerPJPayload = {
    type: 'PJ',
    name: fields.name.trim(),
    document: stripDigits(fields.document),
  };

  if (fields.tradeName.trim()) payload.tradeName = fields.tradeName.trim();
  if (fields.address.trim()) payload.address = fields.address.trim();
  if (fields.city.trim()) payload.city = fields.city.trim();
  if (fields.state) payload.state = fields.state;
  if (fields.zipCode.trim()) payload.zipCode = fields.zipCode.replace(/\D/g, '');
  if (fields.incraRegistration.trim()) payload.incraRegistration = fields.incraRegistration.trim();
  if (fields.legalRepresentative.trim())
    payload.legalRepresentative = fields.legalRepresentative.trim();
  if (fields.legalRepCpf.trim()) payload.legalRepCpf = stripDigits(fields.legalRepCpf);
  if (fields.taxRegime) payload.taxRegime = fields.taxRegime;
  if (fields.mainCnae.trim()) payload.mainCnae = fields.mainCnae.trim();
  if (fields.ruralActivityType.trim()) payload.ruralActivityType = fields.ruralActivityType.trim();

  return payload;
}

interface UseCreateProducerPJOptions {
  onSuccess: () => void;
}

export function useCreateProducerPJ({ onSuccess }: UseCreateProducerPJOptions) {
  const [formData, setFormData] = useState<ProducerPJFormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<PJFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<PJFieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = useCallback(
    (key: PJFieldKey, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value };
          const newErrors = validatePJFields(updated);
          return { ...prev, [key]: newErrors[key] };
        });
      }
    },
    [formData, touched],
  );

  const touchField = useCallback(
    (key: PJFieldKey) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors(validatePJFields(formData));
    },
    [formData],
  );

  const handleCnpjChange = useCallback(
    (value: string) => {
      setField('document', formatCnpjInput(value));
    },
    [setField],
  );

  const handleCpfChange = useCallback(
    (key: PJFieldKey, value: string) => {
      setField(key, formatCpfInput(value));
    },
    [setField],
  );

  const submit = useCallback(async () => {
    const allTouched = Object.keys(INITIAL_FIELDS).reduce(
      (acc, key) => {
        acc[key as PJFieldKey] = true;
        return acc;
      },
      {} as Record<PJFieldKey, boolean>,
    );
    setTouched(allTouched);

    const validationErrors = validatePJFields(formData);
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
    handleCnpjChange,
    handleCpfChange,
    submit,
    reset,
  };
}
