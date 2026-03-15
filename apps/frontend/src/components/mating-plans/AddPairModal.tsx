import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type { AddMatingPairInput } from '@/types/mating-plan';
import './AddPairModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  planId: string;
  existingPairAnimalIds: string[];
  onSuccess: () => void;
}

interface AnimalOption {
  id: string;
  earTag: string;
  name: string | null;
}

interface BullOption {
  id: string;
  name: string;
}

interface PairRow {
  animalId: string;
  primaryBullId: string;
  secondaryBullId: string;
  tertiaryBullId: string;
  notes: string;
}

const EMPTY_ROW: PairRow = {
  animalId: '',
  primaryBullId: '',
  secondaryBullId: '',
  tertiaryBullId: '',
  notes: '',
};

export default function AddPairModal({
  isOpen,
  onClose,
  farmId,
  planId,
  existingPairAnimalIds,
  onSuccess,
}: Props) {
  const [rows, setRows] = useState<PairRow[]>([{ ...EMPTY_ROW }]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [bulls, setBulls] = useState<BullOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load reference data
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setRows([{ ...EMPTY_ROW }]);

    void (async () => {
      try {
        const [animalsRes, bullsRes] = await Promise.all([
          api.get<{ data: AnimalOption[] }>(`/org/farms/${farmId}/animals?limit=500&sex=FEMALE`),
          api.get<{ data: BullOption[] }>(`/org/farms/${farmId}/bulls?limit=200&status=ACTIVE`),
        ]);
        setAnimals(animalsRes.data ?? []);
        setBulls(bullsRes.data ?? []);
      } catch {
        // Non-critical
      }
    })();
  }, [isOpen, farmId]);

  // Filter out animals already in the plan
  const availableAnimals = animals.filter((a) => !existingPairAnimalIds.includes(a.id));

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRow = useCallback((index: number, field: keyof PairRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }, []);

  // Get animals already selected in other rows
  const getSelectedAnimalIds = useCallback(
    (currentIndex: number): string[] => {
      return rows
        .filter((_, i) => i !== currentIndex)
        .map((r) => r.animalId)
        .filter(Boolean);
    },
    [rows],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const pairs: AddMatingPairInput[] = rows
        .filter((r) => r.animalId)
        .map((r) => ({
          animalId: r.animalId,
          primaryBullId: r.primaryBullId || null,
          secondaryBullId: r.secondaryBullId || null,
          tertiaryBullId: r.tertiaryBullId || null,
          notes: r.notes || null,
        }));

      if (pairs.length === 0) {
        setError('Adicione pelo menos um par.');
        setIsLoading(false);
        return;
      }

      await api.post(`/org/farms/${farmId}/mating-plans/${planId}/pairs`, { pairs });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar pares');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-pair-modal__overlay" onClick={onClose}>
      <div
        className="add-pair-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar pares de acasalamento"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="add-pair-modal__header">
          <h2>Adicionar pares</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="add-pair-modal__close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="add-pair-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="add-pair-modal__error" role="alert">
              {error}
            </div>
          )}

          <div className="add-pair-modal__rows">
            {rows.map((row, index) => {
              const selectedByOthers = getSelectedAnimalIds(index);
              const rowAnimals = availableAnimals.filter((a) => !selectedByOthers.includes(a.id));

              return (
                <div key={index} className="add-pair-modal__pair-row">
                  <div className="add-pair-modal__pair-header">
                    <span className="add-pair-modal__pair-label">Par {index + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="add-pair-modal__remove-btn"
                        onClick={() => removeRow(index)}
                        aria-label={`Remover par ${index + 1}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="add-pair-modal__field">
                    <label htmlFor={`pair-animal-${index}`}>Fêmea *</label>
                    <select
                      id={`pair-animal-${index}`}
                      value={row.animalId}
                      onChange={(e) => updateRow(index, 'animalId', e.target.value)}
                      required
                      aria-required="true"
                    >
                      <option value="">Selecione a fêmea</option>
                      {rowAnimals.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.earTag} — {a.name || 'Sem nome'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="add-pair-modal__bull-row">
                    <div className="add-pair-modal__field">
                      <label htmlFor={`pair-bull1-${index}`}>Touro 1 (principal)</label>
                      <select
                        id={`pair-bull1-${index}`}
                        value={row.primaryBullId}
                        onChange={(e) => updateRow(index, 'primaryBullId', e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {bulls.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="add-pair-modal__field">
                      <label htmlFor={`pair-bull2-${index}`}>Touro 2</label>
                      <select
                        id={`pair-bull2-${index}`}
                        value={row.secondaryBullId}
                        onChange={(e) => updateRow(index, 'secondaryBullId', e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {bulls.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="add-pair-modal__field">
                      <label htmlFor={`pair-bull3-${index}`}>Touro 3</label>
                      <select
                        id={`pair-bull3-${index}`}
                        value={row.tertiaryBullId}
                        onChange={(e) => updateRow(index, 'tertiaryBullId', e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {bulls.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="add-pair-modal__field">
                    <label htmlFor={`pair-notes-${index}`}>Observações</label>
                    <input
                      id={`pair-notes-${index}`}
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(index, 'notes', e.target.value)}
                      placeholder="Observação sobre este par..."
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" className="add-pair-modal__add-btn" onClick={addRow}>
            <Plus size={16} aria-hidden="true" />
            Adicionar outro par
          </button>
        </form>

        <footer className="add-pair-modal__footer">
          <button type="button" className="add-pair-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="add-pair-modal__btn-save"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading
              ? 'Adicionando...'
              : `Adicionar ${rows.filter((r) => r.animalId).length} par(es)`}
          </button>
        </footer>
      </div>
    </div>
  );
}
