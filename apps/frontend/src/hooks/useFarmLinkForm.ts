import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import type {
  ProducerFarmLink,
  CreateFarmLinkPayload,
  UpdateFarmLinkPayload,
} from '@/types/producer';

export interface FarmLinkFormFields {
  farmId: string;
  bondType: string;
  participationPct: string;
  startDate: string;
  endDate: string;
  isItrDeclarant: boolean;
}

export type FarmLinkFieldKey = keyof FarmLinkFormFields;

const INITIAL_FIELDS: FarmLinkFormFields = {
  farmId: '',
  bondType: '',
  participationPct: '',
  startDate: '',
  endDate: '',
  isItrDeclarant: false,
};

export function validateFarmLinkFields(
  fields: FarmLinkFormFields,
): Partial<Record<FarmLinkFieldKey, string>> {
  const errors: Partial<Record<FarmLinkFieldKey, string>> = {};

  if (!fields.farmId) {
    errors.farmId = 'Fazenda é obrigatória';
  }

  if (!fields.bondType) {
    errors.bondType = 'Tipo de vínculo é obrigatório';
  }

  if (fields.participationPct) {
    const pct = parseFloat(fields.participationPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      errors.participationPct = 'Participação deve ser entre 0 e 100';
    }
  }

  if (fields.startDate && fields.endDate) {
    if (new Date(fields.endDate) < new Date(fields.startDate)) {
      errors.endDate = 'Data fim deve ser maior ou igual à data início';
    }
  }

  return errors;
}

function linkToFormFields(link: ProducerFarmLink): FarmLinkFormFields {
  return {
    farmId: link.farm.id,
    bondType: link.bondType,
    participationPct: link.participationPct != null ? String(link.participationPct) : '',
    startDate: link.startDate ? link.startDate.split('T')[0] : '',
    endDate: link.endDate ? link.endDate.split('T')[0] : '',
    isItrDeclarant: link.isItrDeclarant,
  };
}

interface UseFarmLinkFormOptions {
  onSuccess: () => void;
  producerId: string;
  existingLink?: ProducerFarmLink;
}

export function useFarmLinkForm({ onSuccess, producerId, existingLink }: UseFarmLinkFormOptions) {
  const isEditMode = !!existingLink;
  const [formData, setFormData] = useState<FarmLinkFormFields>(
    existingLink ? linkToFormFields(existingLink) : INITIAL_FIELDS,
  );
  const [errors, setErrors] = useState<Partial<Record<FarmLinkFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FarmLinkFieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (existingLink) {
      setFormData(linkToFormFields(existingLink));
    } else {
      setFormData(INITIAL_FIELDS);
    }
  }, [existingLink]);

  const setField = useCallback(
    (key: FarmLinkFieldKey, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSubmitError(null);
      if (touched[key]) {
        setErrors((prev) => {
          const updated = { ...formData, [key]: value } as FarmLinkFormFields;
          const newErrors = validateFarmLinkFields(updated);
          return { ...prev, [key]: newErrors[key] };
        });
      }
    },
    [formData, touched],
  );

  const touchField = useCallback(
    (key: FarmLinkFieldKey) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors(validateFarmLinkFields(formData));
    },
    [formData],
  );

  const submit = useCallback(async () => {
    const allTouched: Record<string, boolean> = {};
    for (const key of Object.keys(INITIAL_FIELDS)) {
      allTouched[key] = true;
    }
    setTouched(allTouched as Record<FarmLinkFieldKey, boolean>);

    const validationErrors = validateFarmLinkFields(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditMode && existingLink) {
        const payload: UpdateFarmLinkPayload = {
          bondType: formData.bondType,
        };
        if (formData.participationPct) {
          payload.participationPct = parseFloat(formData.participationPct);
        }
        if (formData.startDate) payload.startDate = formData.startDate;
        if (formData.endDate) payload.endDate = formData.endDate;
        payload.isItrDeclarant = formData.isItrDeclarant;

        await api.patch(`/org/producers/${producerId}/farms/${existingLink.id}`, payload);
      } else {
        const payload: CreateFarmLinkPayload = {
          farmId: formData.farmId,
          bondType: formData.bondType,
        };
        if (formData.participationPct) {
          payload.participationPct = parseFloat(formData.participationPct);
        }
        if (formData.startDate) payload.startDate = formData.startDate;
        if (formData.endDate) payload.endDate = formData.endDate;
        payload.isItrDeclarant = formData.isItrDeclarant;

        await api.post(`/org/producers/${producerId}/farms`, payload);
      }
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditMode
            ? 'Não foi possível salvar as alterações do vínculo.'
            : 'Não foi possível vincular a fazenda.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess, isEditMode, producerId, existingLink]);

  const reset = useCallback(() => {
    setFormData(existingLink ? linkToFormFields(existingLink) : INITIAL_FIELDS);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, [existingLink]);

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
