import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { FeedingProtocolInput, FeedingProtocolItem } from '@/types/weaning';
import { FEED_TYPES, FEEDING_METHODS } from '@/types/weaning';
import './FeedingProtocolModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  separationId: string;
  existingProtocol: FeedingProtocolItem | null;
  onSuccess: () => void;
}

const EMPTY_FORM: FeedingProtocolInput = {
  feedType: 'WHOLE_MILK',
  dailyVolumeLiters: 4,
  frequencyPerDay: 2,
  feedingMethod: 'BUCKET_NIPPLE',
  concentrateStartDate: '',
  concentrateGramsPerDay: null,
  roughageType: '',
  targetWeaningWeightKg: null,
};

export default function FeedingProtocolModal({
  isOpen,
  onClose,
  farmId,
  separationId,
  existingProtocol,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<FeedingProtocolInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (existingProtocol) {
      setFormData({
        feedType: existingProtocol.feedType,
        dailyVolumeLiters: existingProtocol.dailyVolumeLiters,
        frequencyPerDay: existingProtocol.frequencyPerDay,
        feedingMethod: existingProtocol.feedingMethod,
        concentrateStartDate: existingProtocol.concentrateStartDate?.split('T')[0] ?? '',
        concentrateGramsPerDay: existingProtocol.concentrateGramsPerDay,
        roughageType: existingProtocol.roughageType ?? '',
        targetWeaningWeightKg: existingProtocol.targetWeaningWeightKg,
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [existingProtocol, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.dailyVolumeLiters || formData.dailyVolumeLiters <= 0) {
      setError('Informe o volume diário em litros.');
      return;
    }
    if (!formData.frequencyPerDay || formData.frequencyPerDay <= 0) {
      setError('Informe a frequência diária.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      concentrateStartDate: formData.concentrateStartDate || null,
      concentrateGramsPerDay: formData.concentrateGramsPerDay ?? null,
      roughageType: formData.roughageType || null,
      targetWeaningWeightKg: formData.targetWeaningWeightKg ?? null,
    };

    try {
      await api.put(
        `/org/farms/${farmId}/calf-separations/${separationId}/feeding-protocol`,
        payload,
      );
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar protocolo alimentar.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="feeding-protocol-modal__overlay" onClick={onClose}>
      <div
        className="feeding-protocol-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feeding-protocol-modal-title"
      >
        <header className="feeding-protocol-modal__header">
          <h2 id="feeding-protocol-modal-title">
            {existingProtocol ? 'Editar protocolo alimentar' : 'Definir protocolo alimentar'}
          </h2>
          <button
            type="button"
            className="feeding-protocol-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="feeding-protocol-modal__form">
          {error && (
            <div className="feeding-protocol-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="feeding-protocol-modal__row">
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-feed-type">Tipo de alimento *</label>
              <select
                id="fp-feed-type"
                value={formData.feedType}
                onChange={(e) => setFormData({ ...formData, feedType: e.target.value })}
                required
                aria-required="true"
              >
                {FEED_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-method">Método *</label>
              <select
                id="fp-method"
                value={formData.feedingMethod}
                onChange={(e) => setFormData({ ...formData, feedingMethod: e.target.value })}
                required
                aria-required="true"
              >
                {FEEDING_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="feeding-protocol-modal__row">
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-volume">Volume diário (L) *</label>
              <input
                id="fp-volume"
                type="number"
                min="0.1"
                step="0.1"
                value={formData.dailyVolumeLiters || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dailyVolumeLiters: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
              />
            </div>
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-frequency">Frequência/dia *</label>
              <input
                id="fp-frequency"
                type="number"
                min="1"
                step="1"
                value={formData.frequencyPerDay || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    frequencyPerDay: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="feeding-protocol-modal__row">
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-concentrate-date">Início concentrado</label>
              <input
                id="fp-concentrate-date"
                type="date"
                value={formData.concentrateStartDate ?? ''}
                onChange={(e) => setFormData({ ...formData, concentrateStartDate: e.target.value })}
              />
            </div>
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-concentrate-grams">Concentrado (g/dia)</label>
              <input
                id="fp-concentrate-grams"
                type="number"
                min="0"
                step="10"
                value={formData.concentrateGramsPerDay ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    concentrateGramsPerDay: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Gramas por dia"
              />
            </div>
          </div>

          <div className="feeding-protocol-modal__row">
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-roughage">Tipo de volumoso</label>
              <input
                id="fp-roughage"
                type="text"
                value={formData.roughageType ?? ''}
                onChange={(e) => setFormData({ ...formData, roughageType: e.target.value })}
                placeholder="Ex: Feno de tifton, Silagem"
              />
            </div>
            <div className="feeding-protocol-modal__field">
              <label htmlFor="fp-target-weight">Peso alvo desmama (kg)</label>
              <input
                id="fp-target-weight"
                type="number"
                min="0"
                step="0.5"
                value={formData.targetWeaningWeightKg ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetWeaningWeightKg: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ex: 80"
              />
            </div>
          </div>

          <footer className="feeding-protocol-modal__footer">
            <button
              type="button"
              className="feeding-protocol-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="feeding-protocol-modal__btn-save" disabled={isLoading}>
              {isLoading
                ? 'Salvando...'
                : existingProtocol
                  ? 'Salvar alterações'
                  : 'Definir protocolo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
