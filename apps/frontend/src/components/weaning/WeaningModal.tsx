import { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateWeaningInput, WeaningCandidateItem } from '@/types/weaning';
import './WeaningModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  candidate: WeaningCandidateItem | null;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateWeaningInput = {
  calfId: '',
  weaningDate: new Date().toISOString().split('T')[0],
  weightKg: null,
  ageMonths: null,
  concentrateConsumptionGrams: null,
  observations: '',
};

export default function WeaningModal({ isOpen, onClose, farmId, candidate, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateWeaningInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate age in months from candidate birthDate
  const autoAgeMonths = useMemo(() => {
    if (!candidate?.birthDate || !formData.weaningDate) return null;
    const birth = new Date(candidate.birthDate);
    const weaning = new Date(formData.weaningDate);
    const diffMs = weaning.getTime() - birth.getTime();
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    return Math.round(months * 10) / 10;
  }, [candidate?.birthDate, formData.weaningDate]);

  useEffect(() => {
    if (!isOpen) return;
    if (candidate) {
      setFormData({
        calfId: candidate.calfId,
        weaningDate: new Date().toISOString().split('T')[0],
        weightKg: candidate.lastWeightKg,
        ageMonths: null,
        concentrateConsumptionGrams: null,
        observations: '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [candidate, isOpen]);

  // Update ageMonths when autoAgeMonths changes
  useEffect(() => {
    if (autoAgeMonths !== null) {
      setFormData((prev) => ({ ...prev, ageMonths: autoAgeMonths }));
    }
  }, [autoAgeMonths]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.calfId) {
      setError('Selecione o bezerro.');
      return;
    }
    if (!formData.weaningDate) {
      setError('Informe a data da desmama.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      weightKg: formData.weightKg ?? null,
      ageMonths: formData.ageMonths ?? null,
      concentrateConsumptionGrams: formData.concentrateConsumptionGrams ?? null,
      observations: formData.observations || null,
    };

    try {
      await api.post(`/org/farms/${farmId}/weanings`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar desmama.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="weaning-modal__overlay" onClick={onClose}>
      <div
        className="weaning-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weaning-modal-title"
      >
        <header className="weaning-modal__header">
          <h2 id="weaning-modal-title">Registrar desmama</h2>
          <button
            type="button"
            className="weaning-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="weaning-modal__form">
          {error && (
            <div className="weaning-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {candidate && (
            <div className="weaning-modal__candidate-info">
              <span className="weaning-modal__candidate-tag">{candidate.earTag}</span>
              {candidate.calfName && (
                <span className="weaning-modal__candidate-name">{candidate.calfName}</span>
              )}
              {candidate.ageDays !== null && (
                <span className="weaning-modal__candidate-detail">
                  Idade: <strong>{candidate.ageDays}</strong> dias
                </span>
              )}
              {candidate.lastWeightKg !== null && (
                <span className="weaning-modal__candidate-detail">
                  Peso: <strong>{candidate.lastWeightKg}</strong> kg
                </span>
              )}
            </div>
          )}

          <div className="weaning-modal__field">
            <label htmlFor="wean-date">Data da desmama *</label>
            <input
              id="wean-date"
              type="date"
              value={formData.weaningDate}
              onChange={(e) => setFormData({ ...formData, weaningDate: e.target.value })}
              required
              aria-required="true"
            />
          </div>

          <div className="weaning-modal__row">
            <div className="weaning-modal__field">
              <label htmlFor="wean-weight">Peso (kg)</label>
              <input
                id="wean-weight"
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
                placeholder="Peso na desmama"
              />
            </div>
            <div className="weaning-modal__field">
              <label htmlFor="wean-age">Idade (meses)</label>
              <input
                id="wean-age"
                type="number"
                min="0"
                step="0.1"
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

          <div className="weaning-modal__field">
            <label htmlFor="wean-concentrate">Consumo de concentrado (g/dia)</label>
            <input
              id="wean-concentrate"
              type="number"
              min="0"
              step="10"
              value={formData.concentrateConsumptionGrams ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  concentrateConsumptionGrams: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Gramas por dia de concentrado"
            />
          </div>

          <div className="weaning-modal__field">
            <label htmlFor="wean-obs">Observações</label>
            <textarea
              id="wean-obs"
              value={formData.observations ?? ''}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              rows={3}
              placeholder="Observações sobre a desmama..."
            />
          </div>

          <footer className="weaning-modal__footer">
            <button
              type="button"
              className="weaning-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="weaning-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Registrar desmama'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
