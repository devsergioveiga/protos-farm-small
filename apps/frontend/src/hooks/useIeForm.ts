import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import type { ProducerStateRegistration, CreateIePayload, UpdateIePayload } from '@/types/producer';

export interface IeFormFields {
  number: string;
  state: string;
  situation: string;
  category: string;
  inscriptionDate: string;
  contractEndDate: string;
  cnaeActivity: string;
  assessmentRegime: string;
  milkProgramOptIn: boolean;
}

export type IeFieldKey = keyof IeFormFields;

const INITIAL_FIELDS: IeFormFields = {
  number: '',
  state: '',
  situation: '',
  category: '',
  inscriptionDate: '',
  contractEndDate: '',
  cnaeActivity: '',
  assessmentRegime: '',
  milkProgramOptIn: false,
};

export function validateIeFields(fields: IeFormFields): Partial<Record<IeFieldKey, string>> {
  const errors: Partial<Record<IeFieldKey, string>> = {};

  const digits = fields.number.replace(/\D/g, '');
  if (!digits) {
    errors.number = 'Numero da IE e obrigatorio';
  } else if (digits.length < 8 || digits.length > 14) {
    errors.number = 'IE deve ter entre 8 e 14 digitos';
  }

  if (!fields.state) {
    errors.state = 'UF e obrigatoria';
  } else if (!VALID_UF.includes(fields.state as (typeof VALID_UF)[number])) {
    errors.state = 'UF invalida';
  }

  return errors;
}

function ieToFormFields(ie: ProducerStateRegistration): IeFormFields {
  return {
    number: ie.number,
    state: ie.state,
    situation: ie.situation ?? '',
    category: ie.category ?? '',
    inscriptionDate: ie.inscriptionDate ? ie.inscriptionDate.split('T')[0] : '',
    contractEndDate: ie.contractEndDate ? ie.contractEndDate.split('T')[0] : '',
    cnaeActivity: ie.cnaeActivity ?? '',
    assessmentRegime: ie.assessmentRegime ?? '',
    milkProgramOptIn: ie.milkProgramOptIn ?? false,
  };
}

interface UseIeFormOptions {
  onSuccess: () => void;
  producerId: string;
  existingIe?: ProducerStateRegistration;
}

export function useIeForm({ onSuccess, producerId, existingIe }: UseIeFormOptions) {
  const isEditMode = !!existingIe;
  const [formData, setFormData] = useState<IeFormFields>(
    existingIe ? ieToFormFields(existingIe) : INITIAL_FIELDS,
  );
  const [errors, setErrors] = useState<Partial<Record<IeFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<IeFieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (existingIe) {
      setFormData(ieToFormFields(existingIe));
    } else {
      setFormData(INITIAL_FIELDS);
    }
  }, [existingIe]);

  const setField = useCallback(
    (key: IeFieldKey, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value } as IeFormFields;
          const newErrors = validateIeFields(updated);
          return { ...prev, [key]: newErrors[key] };
        });
      }
    },
    [formData, touched],
  );

  const touchField = useCallback(
    (key: IeFieldKey) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors(validateIeFields(formData));
    },
    [formData],
  );

  const submit = useCallback(async () => {
    const allTouched: Record<string, boolean> = {};
    for (const key of Object.keys(INITIAL_FIELDS)) {
      allTouched[key] = true;
    }
    setTouched(allTouched as Record<IeFieldKey, boolean>);

    const validationErrors = validateIeFields(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditMode && existingIe) {
        const payload: UpdateIePayload = {};
        if (formData.number) payload.number = formData.number;
        if (formData.state) payload.state = formData.state;
        if (formData.situation) payload.situation = formData.situation;
        if (formData.category) payload.category = formData.category;
        if (formData.inscriptionDate) payload.inscriptionDate = formData.inscriptionDate;
        if (formData.contractEndDate) payload.contractEndDate = formData.contractEndDate;
        if (formData.cnaeActivity) payload.cnaeActivity = formData.cnaeActivity;
        if (formData.assessmentRegime) payload.assessmentRegime = formData.assessmentRegime;
        payload.milkProgramOptIn = formData.milkProgramOptIn;

        await api.patch(`/org/producers/${producerId}/ies/${existingIe.id}`, payload);
      } else {
        const payload: CreateIePayload = {
          number: formData.number,
          state: formData.state,
        };
        if (formData.situation) payload.situation = formData.situation;
        if (formData.category) payload.category = formData.category;
        if (formData.inscriptionDate) payload.inscriptionDate = formData.inscriptionDate;
        if (formData.contractEndDate) payload.contractEndDate = formData.contractEndDate;
        if (formData.cnaeActivity) payload.cnaeActivity = formData.cnaeActivity;
        if (formData.assessmentRegime) payload.assessmentRegime = formData.assessmentRegime;
        payload.milkProgramOptIn = formData.milkProgramOptIn;

        await api.post(`/org/producers/${producerId}/ies`, payload);
      }
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditMode
            ? 'Nao foi possivel salvar as alteracoes da inscricao.'
            : 'Nao foi possivel cadastrar a inscricao estadual.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess, isEditMode, producerId, existingIe]);

  const reset = useCallback(() => {
    setFormData(existingIe ? ieToFormFields(existingIe) : INITIAL_FIELDS);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, [existingIe]);

  return {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    setField,
    touchField,
    submit,
    reset,
  };
}
