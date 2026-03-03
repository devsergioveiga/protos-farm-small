import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/services/api';
import { VALID_UF } from '@/constants/states';
import type { CreateFarmPayload, FarmDetail } from '@/types/farm';

const CIB_REGEX = /^\d{1,3}\.\d{3}\.\d{3}-\d$/;
const ZIPCODE_REGEX = /^\d{5}-?\d{3}$/;

const LAND_CLASSIFICATIONS = ['MINIFUNDIO', 'PEQUENA', 'MEDIA', 'GRANDE'] as const;

export type FormFields = {
  name: string;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalAreaHa: string;
  cib: string;
  incraCode: string;
  ccirCode: string;
  carCode: string;
  landClassification: string;
  productive: string;
  appAreaHa: string;
  legalReserveHa: string;
  taxableAreaHa: string;
  usableAreaHa: string;
  utilizationDegree: string;
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
  cib: '',
  incraCode: '',
  ccirCode: '',
  carCode: '',
  landClassification: '',
  productive: 'false',
  appAreaHa: '',
  legalReserveHa: '',
  taxableAreaHa: '',
  usableAreaHa: '',
  utilizationDegree: '',
};

const STEP_FIELDS: (keyof FormFields)[][] = [
  ['name', 'nickname', 'address', 'city', 'state', 'zipCode', 'totalAreaHa'],
  ['cib', 'incraCode', 'ccirCode', 'carCode'],
  [
    'landClassification',
    'productive',
    'appAreaHa',
    'legalReserveHa',
    'taxableAreaHa',
    'usableAreaHa',
    'utilizationDegree',
  ],
  [],
];

export const TOTAL_STEPS = 4;

function validateField(field: keyof FormFields, value: string): string | undefined {
  switch (field) {
    case 'name':
      if (!value.trim()) return 'Nome é obrigatório';
      break;
    case 'state':
      if (!value) return 'UF é obrigatória';
      if (!VALID_UF.includes(value as (typeof VALID_UF)[number])) return 'UF inválida';
      break;
    case 'totalAreaHa':
      if (!value) return 'Área total é obrigatória';
      if (isNaN(Number(value)) || Number(value) <= 0) return 'Área deve ser maior que zero';
      break;
    case 'cib':
      if (value && !CIB_REGEX.test(value)) return 'CIB deve ter formato XXX.XXX.XXX-X';
      break;
    case 'zipCode':
      if (value && !ZIPCODE_REGEX.test(value)) return 'CEP deve ter formato XXXXX-XXX';
      break;
    case 'landClassification':
      if (value && !LAND_CLASSIFICATIONS.includes(value as (typeof LAND_CLASSIFICATIONS)[number]))
        return 'Classificação inválida';
      break;
    case 'appAreaHa':
    case 'legalReserveHa':
    case 'taxableAreaHa':
    case 'usableAreaHa':
      if (value && (isNaN(Number(value)) || Number(value) < 0))
        return 'Área deve ser maior ou igual a zero';
      break;
    case 'utilizationDegree':
      if (value && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 100))
        return 'Grau deve estar entre 0 e 100';
      break;
  }
  return undefined;
}

function farmDetailToFormFields(farm: FarmDetail): FormFields {
  const str = (v: string | null | undefined): string => v ?? '';
  const num = (v: number | null | undefined): string => (v != null ? String(v) : '');
  const bool = (v: boolean | null | undefined): string => (v ? 'true' : 'false');

  return {
    name: str(farm.name),
    nickname: str(farm.nickname),
    address: str(farm.address),
    city: str(farm.city),
    state: farm.state,
    zipCode: str(farm.zipCode),
    totalAreaHa: num(farm.totalAreaHa),
    cib: str(farm.cib),
    incraCode: str(farm.incraCode),
    ccirCode: str(farm.ccirCode),
    carCode: str(farm.carCode),
    landClassification: str(farm.landClassification),
    productive: bool(farm.productive),
    appAreaHa: num(farm.appAreaHa),
    legalReserveHa: num(farm.legalReserveHa),
    taxableAreaHa: num(farm.taxableAreaHa),
    usableAreaHa: num(farm.usableAreaHa),
    utilizationDegree: num(farm.utilizationDegree),
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
    isEditMode ? new Set([0, 1, 2, 3]) : new Set([0]),
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
        setVisitedSteps(new Set([0, 1, 2, 3]));
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
      totalAreaHa: Number(formData.totalAreaHa),
    };

    if (formData.nickname.trim()) payload.nickname = formData.nickname.trim();
    if (formData.address.trim()) payload.address = formData.address.trim();
    if (formData.city.trim()) payload.city = formData.city.trim();
    if (formData.zipCode.trim()) payload.zipCode = formData.zipCode.replace('-', '');
    if (formData.cib.trim()) payload.cib = formData.cib.trim();
    if (formData.incraCode.trim()) payload.incraCode = formData.incraCode.trim();
    if (formData.ccirCode.trim()) payload.ccirCode = formData.ccirCode.trim();
    if (formData.carCode.trim()) payload.carCode = formData.carCode.trim();
    if (formData.landClassification) payload.landClassification = formData.landClassification;
    if (formData.productive === 'true') payload.productive = true;
    if (formData.appAreaHa) payload.appAreaHa = Number(formData.appAreaHa);
    if (formData.legalReserveHa) payload.legalReserveHa = Number(formData.legalReserveHa);
    if (formData.taxableAreaHa) payload.taxableAreaHa = Number(formData.taxableAreaHa);
    if (formData.usableAreaHa) payload.usableAreaHa = Number(formData.usableAreaHa);
    if (formData.utilizationDegree) payload.utilizationDegree = Number(formData.utilizationDegree);

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
      setVisitedSteps(new Set([0, 1, 2, 3]));
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

export { LAND_CLASSIFICATIONS };
