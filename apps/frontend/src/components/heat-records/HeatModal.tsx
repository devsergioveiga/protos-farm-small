import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateHeatRecordInput } from '@/types/heat-record';
import { HEAT_INTENSITIES, HEAT_SIGNS, DETECTION_METHODS, HEAT_PERIODS } from '@/types/heat-record';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './HeatModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateHeatRecordInput = {
  animalId: '',
  heatDate: new Date().toISOString().split('T')[0],
  heatTime: '',
  heatPeriod: '',
  intensity: 'MODERATE',
  signs: [],
  detectionMethod: 'VISUAL',
  notes: '',
};

export default function HeatModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateHeatRecordInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500, sex: 'FEMALE' });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM, heatDate: new Date().toISOString().split('T')[0] });
    setError(null);
  }, [isOpen]);

  const handleSignToggle = (signValue: string) => {
    setFormData((prev) => {
      const signs = prev.signs.includes(signValue)
        ? prev.signs.filter((s) => s !== signValue)
        : [...prev.signs, signValue];
      return { ...prev, signs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.intensity) {
      setError('Selecione a intensidade do cio.');
      return;
    }
    if (formData.signs.length === 0) {
      setError('Selecione ao menos um sinal de cio.');
      return;
    }
    if (!formData.detectionMethod) {
      setError('Selecione o método de detecção.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      heatTime: formData.heatTime || null,
      heatPeriod: formData.heatPeriod || null,
      notes: formData.notes || null,
    };

    try {
      await api.post(`/org/farms/${farmId}/heat-records`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar cio.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="heat-modal__overlay" onClick={onClose}>
      <div
        className="heat-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="heat-modal-title"
      >
        <header className="heat-modal__header">
          <h2 id="heat-modal-title">Registrar cio</h2>
          <button type="button" className="heat-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="heat-modal__form">
          {error && (
            <div className="heat-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Animal */}
          <div className="heat-modal__field">
            <label htmlFor="heat-animal">Animal *</label>
            <select
              id="heat-animal"
              value={formData.animalId}
              onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
              required
              aria-required="true"
            >
              <option value="">Selecione a fêmea...</option>
              {animals.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          {/* Data + Horário */}
          <div className="heat-modal__row">
            <div className="heat-modal__field">
              <label htmlFor="heat-date">Data do cio *</label>
              <input
                id="heat-date"
                type="date"
                value={formData.heatDate}
                onChange={(e) => setFormData({ ...formData, heatDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="heat-modal__field">
              <label htmlFor="heat-time">Horário</label>
              <input
                id="heat-time"
                type="time"
                value={formData.heatTime ?? ''}
                onChange={(e) => setFormData({ ...formData, heatTime: e.target.value })}
              />
            </div>
          </div>

          {/* Período + Intensidade */}
          <div className="heat-modal__row">
            <div className="heat-modal__field">
              <label htmlFor="heat-period">Período</label>
              <select
                id="heat-period"
                value={formData.heatPeriod ?? ''}
                onChange={(e) => setFormData({ ...formData, heatPeriod: e.target.value })}
              >
                <option value="">Selecione...</option>
                {HEAT_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="heat-modal__field">
              <label htmlFor="heat-intensity">Intensidade *</label>
              <select
                id="heat-intensity"
                value={formData.intensity}
                onChange={(e) => setFormData({ ...formData, intensity: e.target.value })}
                required
                aria-required="true"
              >
                {HEAT_INTENSITIES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sinais de cio (multi-checkbox grid) */}
          <fieldset className="heat-modal__fieldset">
            <legend className="heat-modal__legend">Sinais de cio *</legend>
            <div className="heat-modal__signs-grid">
              {HEAT_SIGNS.map((sign) => (
                <label key={sign.value} className="heat-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.signs.includes(sign.value)}
                    onChange={() => handleSignToggle(sign.value)}
                    className="heat-modal__checkbox"
                  />
                  <span className="heat-modal__checkbox-text">{sign.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Método de detecção */}
          <div className="heat-modal__field">
            <label htmlFor="heat-method">Método de detecção *</label>
            <select
              id="heat-method"
              value={formData.detectionMethod}
              onChange={(e) => setFormData({ ...formData, detectionMethod: e.target.value })}
              required
              aria-required="true"
            >
              {DETECTION_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Observações */}
          <div className="heat-modal__field">
            <label htmlFor="heat-notes">Observações</label>
            <textarea
              id="heat-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="heat-modal__footer">
            <button
              type="button"
              className="heat-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="heat-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Registrar cio'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
