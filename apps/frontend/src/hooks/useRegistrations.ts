import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  CreateRegistrationPayload,
  UpdateRegistrationPayload,
  AreaDivergence,
  RegistrationMutationResponse,
  RegistrationDeleteResponse,
} from '@/types/farm';

interface UseRegistrationsReturn {
  areaDivergence: AreaDivergence | null;
  isSubmitting: boolean;
  submitError: string | null;
  addRegistration: (payload: CreateRegistrationPayload) => Promise<void>;
  updateRegistration: (regId: string, payload: UpdateRegistrationPayload) => Promise<void>;
  deleteRegistration: (regId: string) => Promise<void>;
  clearError: () => void;
}

export function useRegistrations(
  farmId: string | undefined,
  onMutationSuccess: () => void,
): UseRegistrationsReturn {
  const [areaDivergence, setAreaDivergence] = useState<AreaDivergence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clearError = useCallback(() => setSubmitError(null), []);

  const addRegistration = useCallback(
    async (payload: CreateRegistrationPayload) => {
      if (!farmId) return;
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const res = await api.post<RegistrationMutationResponse>(
          `/org/farms/${farmId}/registrations`,
          payload,
        );
        setAreaDivergence(res.areaDivergence);
        onMutationSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao adicionar matrícula';
        setSubmitError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [farmId, onMutationSuccess],
  );

  const updateRegistration = useCallback(
    async (regId: string, payload: UpdateRegistrationPayload) => {
      if (!farmId) return;
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const res = await api.patch<RegistrationMutationResponse>(
          `/org/farms/${farmId}/registrations/${regId}`,
          payload,
        );
        setAreaDivergence(res.areaDivergence);
        onMutationSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar matrícula';
        setSubmitError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [farmId, onMutationSuccess],
  );

  const deleteRegistration = useCallback(
    async (regId: string) => {
      if (!farmId) return;
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const res = await api.delete<RegistrationDeleteResponse>(
          `/org/farms/${farmId}/registrations/${regId}`,
        );
        setAreaDivergence(res.areaDivergence);
        onMutationSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao remover matrícula';
        setSubmitError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [farmId, onMutationSuccess],
  );

  return {
    areaDivergence,
    isSubmitting,
    submitError,
    addRegistration,
    updateRegistration,
    deleteRegistration,
    clearError,
  };
}
