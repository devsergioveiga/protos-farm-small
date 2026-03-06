import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { WeighingItem } from '@/types/animal';
import './CreateWeighingModal.css';

interface CreateWeighingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    weightKg: number;
    measuredAt: string;
    bodyConditionScore?: number | null;
    notes?: string | null;
  }) => Promise<void>;
  editingWeighing?: WeighingItem | null;
}

function CreateWeighingModal({
  isOpen,
  onClose,
  onSubmit,
  editingWeighing,
}: CreateWeighingModalProps) {
  const [weightKg, setWeightKg] = useState('');
  const [measuredAt, setMeasuredAt] = useState('');
  const [bodyConditionScore, setBodyConditionScore] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingWeighing != null;

  useEffect(() => {
    if (isOpen) {
      if (editingWeighing) {
        setWeightKg(String(editingWeighing.weightKg));
        setMeasuredAt(editingWeighing.measuredAt);
        setBodyConditionScore(
          editingWeighing.bodyConditionScore != null
            ? String(editingWeighing.bodyConditionScore)
            : '',
        );
        setNotes(editingWeighing.notes ?? '');
      } else {
        setWeightKg('');
        setMeasuredAt(new Date().toISOString().slice(0, 10));
        setBodyConditionScore('');
        setNotes('');
      }
      setError(null);
      if (dialogRef.current?.showModal) {
        dialogRef.current.showModal();
      }
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      if (dialogRef.current?.close) {
        dialogRef.current.close();
      }
    }
  }, [isOpen, editingWeighing]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const weight = parseFloat(weightKg.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
      setError('Informe um peso válido');
      return;
    }

    if (!measuredAt) {
      setError('Informe a data da pesagem');
      return;
    }

    const bcs = bodyConditionScore ? parseInt(bodyConditionScore, 10) : null;
    if (bcs != null && (bcs < 1 || bcs > 5)) {
      setError('Escore corporal deve ser entre 1 e 5');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        weightKg: weight,
        measuredAt,
        bodyConditionScore: bcs,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pesagem');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="weighing-modal__dialog"
      onKeyDown={handleKeyDown}
      aria-labelledby="weighing-modal-title"
    >
      <div className="weighing-modal">
        <header className="weighing-modal__header">
          <h2 className="weighing-modal__title" id="weighing-modal-title">
            {isEditing ? 'Editar pesagem' : 'Registrar pesagem'}
          </h2>
          <button
            type="button"
            className="weighing-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="weighing-modal__form">
          {error && (
            <div className="weighing-modal__error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className="weighing-modal__field">
            <label htmlFor="weighing-weight" className="weighing-modal__label">
              Peso (kg) <span aria-hidden="true">*</span>
            </label>
            <input
              ref={firstInputRef}
              id="weighing-weight"
              type="number"
              step="0.01"
              min="0.01"
              max="9999"
              className="weighing-modal__input"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
              aria-required="true"
              placeholder="Ex: 450.50"
            />
          </div>

          <div className="weighing-modal__field">
            <label htmlFor="weighing-date" className="weighing-modal__label">
              Data da pesagem <span aria-hidden="true">*</span>
            </label>
            <input
              id="weighing-date"
              type="date"
              className="weighing-modal__input"
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              aria-required="true"
            />
          </div>

          <div className="weighing-modal__field">
            <label htmlFor="weighing-bcs" className="weighing-modal__label">
              Escore de condição corporal (1-5)
            </label>
            <input
              id="weighing-bcs"
              type="number"
              min="1"
              max="5"
              step="1"
              className="weighing-modal__input"
              value={bodyConditionScore}
              onChange={(e) => setBodyConditionScore(e.target.value)}
              placeholder="1 a 5"
            />
          </div>

          <div className="weighing-modal__field">
            <label htmlFor="weighing-notes" className="weighing-modal__label">
              Observações
            </label>
            <textarea
              id="weighing-notes"
              className="weighing-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre a pesagem"
            />
          </div>

          <footer className="weighing-modal__footer">
            <button
              type="button"
              className="weighing-modal__btn weighing-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="weighing-modal__btn weighing-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar pesagem'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default CreateWeighingModal;
