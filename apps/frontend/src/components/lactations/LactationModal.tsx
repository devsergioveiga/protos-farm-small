import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { LactationItem, CreateLactationInput, UpdateLactationInput } from '@/types/lactation';
import { useAnimals } from '@/hooks/useAnimals';
import './LactationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lactation?: LactationItem | null;
  farmId: string;
  onSuccess: () => void;
}

export default function LactationModal({ isOpen, onClose, lactation, farmId, onSuccess }: Props) {
  const [animalId, setAnimalId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500, sex: 'FEMALE' });

  const isEditing = !!lactation;

  useEffect(() => {
    if (!isOpen) return;
    if (lactation) {
      setAnimalId(lactation.animalId);
      setStartDate(lactation.startDate.slice(0, 10));
      setNotes(lactation.notes ?? '');
    } else {
      setAnimalId('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
    setError(null);
  }, [isOpen, lactation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isEditing) {
        const payload: UpdateLactationInput = {
          startDate,
          notes: notes || null,
        };
        await api.patch(`/org/farms/${farmId}/lactations/${lactation!.id}`, payload);
      } else {
        const payload: CreateLactationInput = {
          animalId,
          startDate,
          origin: 'BIRTH',
          notes: notes || null,
        };
        await api.post(`/org/farms/${farmId}/lactations`, payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lactação');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="lactation-modal__overlay" onClick={onClose}>
      <div
        className="lactation-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar lactação' : 'Nova lactação'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lactation-modal__header">
          <h2>{isEditing ? 'Editar lactação' : 'Nova lactação'}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="lactation-modal__close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="lactation-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="lactation-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="lactation-modal__field">
            <label htmlFor="lact-animal">Animal *</label>
            <select
              id="lact-animal"
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              required
              aria-required="true"
              disabled={isEditing}
            >
              <option value="">Selecione o animal</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div className="lactation-modal__field">
            <label htmlFor="lact-start-date">Data de início *</label>
            <input
              id="lact-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              aria-required="true"
            />
          </div>

          <div className="lactation-modal__field">
            <label htmlFor="lact-notes">Observações</label>
            <textarea
              id="lact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </form>

        <footer className="lactation-modal__footer">
          <button type="button" className="lactation-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="lactation-modal__btn-save"
            disabled={isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar lactação'}
          </button>
        </footer>
      </div>
    </div>
  );
}
