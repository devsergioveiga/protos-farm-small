import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { CreatePlotResponse } from '@/types/farm';

export interface PlotFormFields {
  name: string;
  code: string;
  soilType: string;
  currentCrop: string;
  previousCrop: string;
  notes: string;
  registrationId: string;
}

type FieldErrors = Partial<Record<keyof PlotFormFields, string>>;
type TouchedFields = Partial<Record<keyof PlotFormFields, boolean>>;

const INITIAL_FORM: PlotFormFields = {
  name: '',
  code: '',
  soilType: '',
  currentCrop: '',
  previousCrop: '',
  notes: '',
  registrationId: '',
};

function validateField(field: keyof PlotFormFields, value: string): string | undefined {
  if (field === 'name' && !value.trim()) {
    return 'Nome é obrigatório';
  }
  return undefined;
}

export function useCreatePlot() {
  const [formData, setFormData] = useState<PlotFormFields>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [boundaryFile, setBoundaryFile] = useState<File | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const setField = useCallback((field: keyof PlotFormFields, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const err = validateField(field, value);
      if (err) return { ...prev, [field]: err };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const touchField = useCallback((field: keyof PlotFormFields) => {
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

  const setFile = useCallback((file: File | null) => {
    setBoundaryFile(file);
    if (file) setBoundaryError(null);
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: FieldErrors = {};
    const nameErr = validateField('name', formData.name);
    if (nameErr) newErrors.name = nameErr;

    setErrors((prev) => ({ ...prev, ...newErrors }));
    setTouched((prev) => ({ ...prev, name: true }));

    let fileMissing = false;
    if (!boundaryFile) {
      setBoundaryError('Arquivo de perímetro é obrigatório');
      fileMissing = true;
    }

    return Object.keys(newErrors).length === 0 && !fileMissing;
  }, [formData.name, boundaryFile]);

  const submit = useCallback(
    async (farmId: string): Promise<boolean> => {
      if (!validate()) return false;

      setIsSubmitting(true);
      setSubmitError(null);
      setWarnings([]);

      try {
        const fd = new FormData();
        fd.append('name', formData.name.trim());
        if (formData.code.trim()) fd.append('code', formData.code.trim());
        if (formData.soilType) fd.append('soilType', formData.soilType);
        if (formData.currentCrop.trim()) fd.append('currentCrop', formData.currentCrop.trim());
        if (formData.previousCrop.trim()) fd.append('previousCrop', formData.previousCrop.trim());
        if (formData.notes.trim()) fd.append('notes', formData.notes.trim());
        if (formData.registrationId) fd.append('registrationId', formData.registrationId);
        fd.append('boundary', boundaryFile!);

        const result = await api.postFormData<CreatePlotResponse>(`/org/farms/${farmId}/plots`, fd);
        setWarnings(result.warnings ?? []);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar talhão';
        setSubmitError(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, boundaryFile, validate],
  );

  const reset = useCallback(() => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setTouched({});
    setBoundaryFile(null);
    setBoundaryError(null);
    setIsSubmitting(false);
    setSubmitError(null);
    setWarnings([]);
  }, []);

  return {
    formData,
    errors,
    touched,
    boundaryFile,
    boundaryError,
    isSubmitting,
    submitError,
    warnings,
    setField,
    touchField,
    setFile,
    validate,
    submit,
    reset,
  };
}
