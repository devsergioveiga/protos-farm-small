import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  AnimalColumnMapping,
  AnimalBulkPreviewResult,
  AnimalBulkImportResult,
} from '@/types/animal';

export type BulkImportAnimalStep =
  | 'idle'
  | 'uploading'
  | 'mapping'
  | 'previewing'
  | 'confirming'
  | 'done';

export interface UseBulkImportAnimalsReturn {
  step: BulkImportAnimalStep;
  preview: AnimalBulkPreviewResult | null;
  result: AnimalBulkImportResult | null;
  error: string | null;
  columnMapping: AnimalColumnMapping;
  setColumnMapping: (m: AnimalColumnMapping) => void;
  selectedIndices: Set<number>;
  toggleIndex: (i: number) => void;
  selectAllValid: () => void;
  deselectAll: () => void;
  uploadFile: (file: File, farmId: string) => Promise<void>;
  goToPreview: () => void;
  goToMapping: () => void;
  confirmImport: (file: File, farmId: string) => Promise<void>;
  reset: () => void;
}

// Auto-mapping: lowercase header → AnimalColumnMapping key
const AUTO_MAP: Record<string, keyof AnimalColumnMapping> = {
  brinco: 'earTag',
  eartag: 'earTag',
  'ear tag': 'earTag',
  identificacao: 'earTag',
  nome: 'name',
  name: 'name',
  sexo: 'sex',
  sex: 'sex',
  nascimento: 'birthDate',
  birthdate: 'birthDate',
  categoria: 'category',
  category: 'category',
  origem: 'origin',
  origin: 'origin',
  raca: 'breed1',
  breed: 'breed1',
  breed1: 'breed1',
  raca2: 'breed2',
  breed2: 'breed2',
  raca3: 'breed3',
  breed3: 'breed3',
  percentual: 'pct1',
  pct1: 'pct1',
  percentual2: 'pct2',
  pct2: 'pct2',
  percentual3: 'pct3',
  pct3: 'pct3',
  peso: 'entryWeightKg',
  weight: 'entryWeightKg',
  ecc: 'bodyConditionScore',
  bcs: 'bodyConditionScore',
  pai: 'sireEarTag',
  sire: 'sireEarTag',
  mae: 'damEarTag',
  dam: 'damEarTag',
  rfid: 'rfidTag',
  notas: 'notes',
  notes: 'notes',
  obs: 'notes',
};

function autoMap(headers: string[]): AnimalColumnMapping {
  const mapping: AnimalColumnMapping = {};
  for (const h of headers) {
    const normalized = h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const key = AUTO_MAP[normalized];
    if (key && !mapping[key]) {
      mapping[key] = h;
    }
  }
  return mapping;
}

export function useBulkImportAnimals(): UseBulkImportAnimalsReturn {
  const [step, setStep] = useState<BulkImportAnimalStep>('idle');
  const [preview, setPreview] = useState<AnimalBulkPreviewResult | null>(null);
  const [result, setResult] = useState<AnimalBulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<AnimalColumnMapping>({});
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const uploadFile = useCallback(async (file: File, farmId: string) => {
    setStep('uploading');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const previewResult = await api.postFormData<AnimalBulkPreviewResult>(
        `/org/farms/${farmId}/animals/bulk/preview`,
        formData,
      );

      setPreview(previewResult);
      setColumnMapping(autoMap(previewResult.columnHeaders));

      // Auto-select all valid rows
      const validIndices = new Set(
        previewResult.rows.filter((r) => r.validation.valid).map((r) => r.index),
      );
      setSelectedIndices(validIndices);

      setStep('mapping');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setError(message);
      setStep('idle');
    }
  }, []);

  const confirmImport = useCallback(
    async (file: File, farmId: string) => {
      setStep('confirming');
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('columnMapping', JSON.stringify(columnMapping));
        formData.append('selectedIndices', JSON.stringify(Array.from(selectedIndices)));

        const importResult = await api.postFormData<AnimalBulkImportResult>(
          `/org/farms/${farmId}/animals/bulk`,
          formData,
        );

        setResult(importResult);
        setStep('done');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao importar animais';
        setError(message);
        setStep('previewing');
      }
    },
    [columnMapping, selectedIndices],
  );

  const toggleIndex = useCallback((i: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }, []);

  const selectAllValid = useCallback(() => {
    if (!preview) return;
    const validIndices = new Set(
      preview.rows.filter((r) => r.validation.valid).map((r) => r.index),
    );
    setSelectedIndices(validIndices);
  }, [preview]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const goToPreview = useCallback(() => {
    setStep('previewing');
  }, []);

  const goToMapping = useCallback(() => {
    setStep('mapping');
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setPreview(null);
    setResult(null);
    setError(null);
    setColumnMapping({});
    setSelectedIndices(new Set());
  }, []);

  return {
    step,
    preview,
    result,
    error,
    columnMapping,
    setColumnMapping,
    selectedIndices,
    toggleIndex,
    selectAllValid,
    deselectAll,
    uploadFile,
    goToPreview,
    goToMapping,
    confirmImport,
    reset,
  };
}
