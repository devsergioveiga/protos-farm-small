import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateReleaseInput } from '@/types/reproductive-release';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './ReleaseModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
  preselectedAnimalId?: string | null;
}

const EMPTY_FORM: CreateReleaseInput = {
  animalId: '',
  releaseDate: new Date().toISOString().split('T')[0],
  weightKg: null,
  ageMonths: null,
  bodyConditionScore: null,
  responsibleName: '',
  notes: '',
};

const BODY_SCORE_OPTIONS = [
  { value: 1, label: '1 — Muito magra' },
  { value: 2, label: '2 — Magra' },
  { value: 3, label: '3 — Regular' },
  { value: 4, label: '4 — Boa' },
  { value: 5, label: '5 — Excelente' },
];

export default function ReleaseModal({
  isOpen,
  onClose,
  farmId,
  onSuccess,
  preselectedAnimalId,
}: Props) {
  const [formData, setFormData] = useState<CreateReleaseInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500 });

  // Filter only female animals
  const femaleAnimals = animals.filter((a: AnimalListItem) => a.sex === 'FEMALE');

  // Auto-calculate age when animal is selected
  const selectedAnimal = femaleAnimals.find((a) => a.id === formData.animalId);

  useEffect(() => {
    if (!isOpen) return;
    const initial = { ...EMPTY_FORM };
    if (preselectedAnimalId) {
      initial.animalId = preselectedAnimalId;
    }
    setFormData(initial);
    setError(null);
  }, [isOpen, preselectedAnimalId]);

  useEffect(() => {
    if (selectedAnimal?.birthDate) {
      const birth = new Date(selectedAnimal.birthDate);
      const now = new Date();
      const diffMonths =
        (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      setFormData((prev) => ({ ...prev, ageMonths: diffMonths }));
    }
  }, [selectedAnimal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.releaseDate) {
      setError('Informe a data da liberação.');
      return;
    }
    if (!formData.responsibleName.trim()) {
      setError('Informe o responsável.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      weightKg: formData.weightKg || null,
      ageMonths: formData.ageMonths || null,
      bodyConditionScore: formData.bodyConditionScore || null,
      notes: formData.notes || null,
    };

    try {
      await api.post(`/org/farms/${farmId}/reproductive-releases`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar liberação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="release-modal__overlay" onClick={onClose}>
      <div
        className="release-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-modal-title"
      >
        <header className="release-modal__header">
          <h2 id="release-modal-title">Liberar novilha para reprodução</h2>
          <button
            type="button"
            className="release-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="release-modal__form">
          {error && (
            <div className="release-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Animal */}
          <div className="release-modal__field">
            <label htmlFor="release-animal">Animal *</label>
            <select
              id="release-animal"
              value={formData.animalId}
              onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
              required
              aria-required="true"
            >
              <option value="">Selecione a novilha...</option>
              {femaleAnimals.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          {/* Data + Responsável */}
          <div className="release-modal__row">
            <div className="release-modal__field">
              <label htmlFor="release-date">Data da liberação *</label>
              <input
                id="release-date"
                type="date"
                value={formData.releaseDate}
                onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="release-modal__field">
              <label htmlFor="release-responsible">Responsável *</label>
              <input
                id="release-responsible"
                type="text"
                value={formData.responsibleName}
                onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                required
                aria-required="true"
                placeholder="Nome do responsável"
              />
            </div>
          </div>

          {/* Peso + Idade */}
          <div className="release-modal__row">
            <div className="release-modal__field">
              <label htmlFor="release-weight">Peso (kg)</label>
              <input
                id="release-weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weightKg ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weightKg: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ex: 320"
              />
            </div>
            <div className="release-modal__field">
              <label htmlFor="release-age">Idade (meses)</label>
              <input
                id="release-age"
                type="number"
                min="0"
                value={formData.ageMonths ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ageMonths: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Calculado automaticamente"
              />
            </div>
          </div>

          {/* Escore corporal */}
          <div className="release-modal__field">
            <label htmlFor="release-score">Escore de condição corporal</label>
            <select
              id="release-score"
              value={formData.bodyConditionScore ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bodyConditionScore: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Selecione o escore...</option>
              {BODY_SCORE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Observações */}
          <div className="release-modal__field">
            <label htmlFor="release-notes">Observações</label>
            <textarea
              id="release-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Observações adicionais (opcional)"
            />
          </div>

          <footer className="release-modal__footer">
            <button
              type="button"
              className="release-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="release-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Registrando...' : 'Registrar liberação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
