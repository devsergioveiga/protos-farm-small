import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  TrainingType,
  PositionTrainingRequirement,
  CreateTrainingTypeInput,
  UpdateTrainingTypeInput,
  CreatePositionTrainingRequirementInput,
} from '@/types/training';

export function useTrainingTypes() {
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [positionRequirements, setPositionRequirements] = useState<PositionTrainingRequirement[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Training Types ──────────────────────────────────────────────

  const fetchTrainingTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TrainingType[]>('/org/training-types');
      setTrainingTypes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tipos de treinamento');
    } finally {
      setLoading(false);
    }
  }, []);

  const seedNr31Types = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/training-types/seed', {});
      setSuccessMessage('Tipos NR-31 importados com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao importar tipos NR-31');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTrainingType = useCallback(async (input: CreateTrainingTypeInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/training-types', input);
      setSuccessMessage('Tipo de treinamento criado com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tipo de treinamento');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTrainingType = useCallback(async (id: string, input: UpdateTrainingTypeInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.put(`/org/training-types/${id}`, input);
      setSuccessMessage('Tipo de treinamento atualizado com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tipo de treinamento');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTrainingType = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/training-types/${id}`);
      setSuccessMessage('Tipo de treinamento removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover tipo de treinamento');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Position Requirements ───────────────────────────────────────

  const fetchPositionRequirements = useCallback(async (positionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = positionId ? `?positionId=${positionId}` : '';
      const data = await api.get<PositionTrainingRequirement[]>(
        `/org/training-types/position-requirements${qs}`,
      );
      setPositionRequirements(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar requisitos de treinamento');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPositionRequirement = useCallback(
    async (input: CreatePositionTrainingRequirementInput) => {
      setLoading(true);
      setError(null);
      try {
        await api.post('/org/training-types/position-requirements', input);
        setSuccessMessage('Requisito adicionado com sucesso.');
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao adicionar requisito');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deletePositionRequirement = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/training-types/position-requirements/${id}`);
      setSuccessMessage('Requisito removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover requisito');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    trainingTypes,
    positionRequirements,
    loading,
    error,
    successMessage,
    fetchTrainingTypes,
    seedNr31Types,
    createTrainingType,
    updateTrainingType,
    deleteTrainingType,
    fetchPositionRequirements,
    createPositionRequirement,
    deletePositionRequirement,
  };
}
