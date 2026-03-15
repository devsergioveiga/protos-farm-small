import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateSeparationInput } from '@/types/weaning';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './SeparationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateSeparationInput = {
  calfId: '',
  motherId: '',
  separationDate: new Date().toISOString().split('T')[0],
  reason: '',
  destination: '',
};

export default function SeparationModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateSeparationInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500 });

  // Filter young calves
  const calves = animals.filter(
    (a: AnimalListItem) => a.category === 'BEZERRO' || a.category === 'BEZERRA',
  );

  const mothers = animals.filter((a: AnimalListItem) => a.sex === 'FEMALE');

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM });
    setError(null);
  }, [isOpen]);

  // Auto-fill mother from calf's dam if available
  const handleCalfChange = (calfId: string) => {
    setFormData((prev) => ({ ...prev, calfId }));
    const selectedCalf = animals.find((a: AnimalListItem) => a.id === calfId);
    if (selectedCalf?.dam?.id) {
      setFormData((prev) => ({ ...prev, calfId, motherId: selectedCalf.dam!.id }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.calfId) {
      setError('Selecione o bezerro.');
      return;
    }
    if (!formData.motherId) {
      setError('Selecione a mãe.');
      return;
    }
    if (!formData.separationDate) {
      setError('Informe a data da separação.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      reason: formData.reason || null,
      destination: formData.destination || null,
    };

    try {
      await api.post(`/org/farms/${farmId}/calf-separations`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar separação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="separation-modal__overlay" onClick={onClose}>
      <div
        className="separation-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="separation-modal-title"
      >
        <header className="separation-modal__header">
          <h2 id="separation-modal-title">Nova separação</h2>
          <button
            type="button"
            className="separation-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="separation-modal__form">
          {error && (
            <div className="separation-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="separation-modal__field">
            <label htmlFor="sep-calf">Bezerro *</label>
            <select
              id="sep-calf"
              value={formData.calfId}
              onChange={(e) => handleCalfChange(e.target.value)}
              required
              aria-required="true"
            >
              <option value="">Selecione o bezerro...</option>
              {calves.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div className="separation-modal__field">
            <label htmlFor="sep-mother">Mãe *</label>
            <select
              id="sep-mother"
              value={formData.motherId}
              onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
              required
              aria-required="true"
            >
              <option value="">Selecione a mãe...</option>
              {mothers.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div className="separation-modal__field">
            <label htmlFor="sep-date">Data da separação *</label>
            <input
              id="sep-date"
              type="date"
              value={formData.separationDate}
              onChange={(e) => setFormData({ ...formData, separationDate: e.target.value })}
              required
              aria-required="true"
            />
          </div>

          <div className="separation-modal__row">
            <div className="separation-modal__field">
              <label htmlFor="sep-reason">Motivo</label>
              <input
                id="sep-reason"
                type="text"
                value={formData.reason ?? ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Ex: Início do desaleitamento"
              />
            </div>
            <div className="separation-modal__field">
              <label htmlFor="sep-destination">Destino</label>
              <input
                id="sep-destination"
                type="text"
                value={formData.destination ?? ''}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Ex: Bezerreiro, Piquete 3"
              />
            </div>
          </div>

          <footer className="separation-modal__footer">
            <button
              type="button"
              className="separation-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="separation-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Registrar separação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
