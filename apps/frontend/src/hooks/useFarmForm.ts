import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import type { CreateFarmPayload, FarmDetail } from '@/types/farm';

const ZIPCODE_REGEX = /^\d{5}-?\d{3}$/;

export type FormFields = {
  name: string;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalAreaHa: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;
type TouchedFields = Partial<Record<keyof FormFields, boolean>>;

const INITIAL_FORM: FormFields = {
  name: '',
  nickname: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  totalAreaHa: '',
};

const STEP_FIELDS: (keyof FormFields)[][] = [
  ['name', 'nickname', 'address', 'city', 'state', 'zipCode', 'totalAreaHa'],
  [], // confirmation
];

export const TOTAL_STEPS = 2;

function validateField(field: keyof FormFields, value: string): string | undefined {
  switch (field) {
    case 'name':
      if (!value.trim()) return 'Nome é obrigatório';
      break;
    case 'state':
      if (!value) return 'UF é obrigatória';
      if (!VALID_UF.includes(value as (typeof VALID_UF)[number])) return 'UF inválida';
      break;
    case 'totalAreaHa': {
      if (!value) return 'Área total é obrigatória';
      const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) return 'Área deve ser maior que zero';
      break;
    }
    case 'zipCode':
      if (value && !ZIPCODE_REGEX.test(value)) return 'CEP deve ter formato XXXXX-XXX';
      break;
  }
  return undefined;
}

function farmDetailToFormFields(farm: FarmDetail): FormFields {
  const str = (v: string | null | undefined): string => v ?? '';
  const numArea = (v: number | string | null | undefined): string => {
    if (v == null) return '';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return '';
    return n
      .toFixed(4)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?=,))/g, '.');
  };

  return {
    name: str(farm.name),
    nickname: str(farm.nickname),
    address: str(farm.address),
    city: str(farm.city),
    state: farm.state,
    zipCode: str(farm.zipCode),
    totalAreaHa: numArea(farm.totalAreaHa),
  };
}

interface UseFarmFormOptions {
  farmId?: string;
  onSuccess?: () => void;
}

export function useFarmForm(options: UseFarmFormOptions = {}) {
  const { farmId, onSuccess } = options;
  const isEditMode = !!farmId;

  const [formData, setFormData] = useState<FormFields>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    isEditMode ? new Set([0, 1]) : new Set([0]),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingFarm, setIsLoadingFarm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const editFarmRef = useRef<FarmDetail | null>(null);

  // Fetch farm details when in edit mode
  useEffect(() => {
    if (!farmId) return;

    let cancelled = false;
    setIsLoadingFarm(true);
    setLoadError(null);

    api
      .get<FarmDetail>(`/org/farms/${farmId}`)
      .then((farm) => {
        if (cancelled) return;
        editFarmRef.current = farm;
        setFormData(farmDetailToFormFields(farm));
        setVisitedSteps(new Set([0, 1]));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar fazenda');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFarm(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const setField = useCallback((field: keyof FormFields, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const err = validateField(field, value);
      if (err) return { ...prev, [field]: err };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const touchField = useCallback((field: keyof FormFields) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFormData((current) => {
      const err = validateField(field, current[field]);
      setErrors((prev) => {
        if (err) return { ...prev, [field]: err };
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return current;
    });
  }, []);

  const validateStep = useCallback(
    (step: number): boolean => {
      const fields = STEP_FIELDS[step];
      const newErrors: FieldErrors = {};
      const newTouched: TouchedFields = {};

      for (const field of fields) {
        newTouched[field] = true;
        const err = validateField(field, formData[field]);
        if (err) newErrors[field] = err;
      }

      setTouched((prev) => ({ ...prev, ...newTouched }));
      setErrors((prev) => {
        const updated = { ...prev };
        for (const field of fields) {
          if (newErrors[field]) updated[field] = newErrors[field];
          else delete updated[field];
        }
        return updated;
      });

      return Object.keys(newErrors).length === 0;
    },
    [formData],
  );

  const focusFirstInput = useCallback(() => {
    requestAnimationFrame(() => {
      const el = stepRef.current?.querySelector<HTMLElement>('input, select');
      el?.focus();
    });
  }, []);

  const goNext = useCallback(() => {
    if (currentStep >= TOTAL_STEPS - 1) return;
    if (!validateStep(currentStep)) return;
    const next = currentStep + 1;
    setCurrentStep(next);
    setVisitedSteps((prev) => new Set(prev).add(next));
    focusFirstInput();
  }, [currentStep, validateStep, focusFirstInput]);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    setCurrentStep(currentStep - 1);
    focusFirstInput();
  }, [currentStep, focusFirstInput]);

  const goToStep = useCallback(
    (step: number) => {
      if (step < 0 || step >= TOTAL_STEPS) return;
      if (!visitedSteps.has(step)) return;
      if (step > currentStep && !validateStep(currentStep)) return;
      setCurrentStep(step);
      focusFirstInput();
    },
    [currentStep, visitedSteps, validateStep, focusFirstInput],
  );

  const canAdvance = useCallback((): boolean => {
    const fields = STEP_FIELDS[currentStep];
    for (const field of fields) {
      if (validateField(field, formData[field])) return false;
    }
    return true;
  }, [currentStep, formData]);

  const buildPayload = useCallback((): CreateFarmPayload => {
    const payload: CreateFarmPayload = {
      name: formData.name.trim(),
      state: formData.state,
      totalAreaHa: Number(formData.totalAreaHa.replace(/\./g, '').replace(',', '.')),
    };

    if (formData.nickname.trim()) payload.nickname = formData.nickname.trim();
    if (formData.address.trim()) payload.address = formData.address.trim();
    if (formData.city.trim()) payload.city = formData.city.trim();
    if (formData.zipCode.trim()) payload.zipCode = formData.zipCode.replace('-', '');

    return payload;
  }, [formData]);

  const submit = useCallback(async () => {
    for (let i = 0; i < TOTAL_STEPS - 1; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildPayload();
      if (farmId) {
        await api.patch(`/org/farms/${farmId}`, payload);
      } else {
        await api.post('/org/farms', payload);
      }
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isEditMode
            ? 'Erro ao atualizar fazenda'
            : 'Erro ao cadastrar fazenda';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateStep, buildPayload, onSuccess, farmId, isEditMode]);

  const reset = useCallback(() => {
    if (editFarmRef.current) {
      setFormData(farmDetailToFormFields(editFarmRef.current));
      setVisitedSteps(new Set([0, 1]));
    } else {
      setFormData(INITIAL_FORM);
      setVisitedSteps(new Set([0]));
    }
    setErrors({});
    setTouched({});
    setCurrentStep(0);
    setIsSubmitting(false);
    setSubmitError(null);
  }, []);

  return {
    formData,
    errors,
    touched,
    currentStep,
    visitedSteps,
    isSubmitting,
    submitError,
    isLoadingFarm,
    loadError,
    isEditMode,
    stepRef,
    setField,
    touchField,
    validateStep,
    goNext,
    goBack,
    goToStep,
    canAdvance,
    submit,
    reset,
  };
}

// Backward compatibility alias
export function useCreateFarm(onSuccess?: () => void) {
  return useFarmForm({ onSuccess });
}
