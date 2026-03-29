import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { CATEGORY_LABELS } from '@/types/animal';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES } from '@/types/lot';
import type { AnimalCategory } from '@/types/animal';
import type { LotListItem, UpdateLotPayload, LotLocationType } from '@/types/lot';
import './CreateLotModal.css';

const ANIMAL_CATEGORIES: AnimalCategory[] = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHA',
  'NOVILHO',
  'VACA_LACTACAO',
  'VACA_SECA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
];

interface EditLotModalProps {
  isOpen: boolean;
  farmId: string;
  lot: LotListItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditLotModal({ isOpen, farmId, lot, onClose, onSuccess }: EditLotModalProps) {
  const [name, setName] = useState('');
  const [predominantCategory, setPredominantCategory] = useState<AnimalCategory | ''>('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [locationType, setLocationType] = useState<LotLocationType | ''>('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Populate fields when lot changes
  useEffect(() => {
    if (isOpen && lot) {
      setName(lot.name);
      setPredominantCategory(lot.predominantCategory);
      setCurrentLocation(lot.currentLocation);
      setLocationType(lot.locationType);
      setMaxCapacity(lot.maxCapacity ? String(lot.maxCapacity) : '');
      setDescription(lot.description ?? '');
      setNotes(lot.notes ?? '');
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, lot]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const canSubmit =
    name.trim() !== '' &&
    predominantCategory !== '' &&
    currentLocation.trim() !== '' &&
    locationType !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !lot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: UpdateLotPayload = {
        name: name.trim(),
        predominantCategory: predominantCategory as AnimalCategory,
        currentLocation: currentLocation.trim(),
        locationType: locationType as LotLocationType,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
        description: description.trim() || null,
        notes: notes.trim() || null,
      };

      await api.patch<LotListItem>(`/org/farms/${farmId}/lots/${lot.id}`, payload);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar lote';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    lot,
    name,
    predominantCategory,
    currentLocation,
    locationType,
    maxCapacity,
    description,
    notes,
    farmId,
    onSuccess,
  ]);

  if (!isOpen || !lot) return null;

  return (
    <div className="create-lot-overlay" onClick={onClose}>
      <div
        className="create-lot-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Editar lote"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-lot-modal__header">
          <h2 className="create-lot-modal__title">Editar lote</h2>
          <button
            type="button"
            className="create-lot-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="create-lot-modal__body">
          <div className="create-lot-modal__fields">
            <div className="create-lot-modal__row">
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-name" className="create-lot-modal__label">
                  Nome do lote *
                </label>
                <input
                  id="edit-lot-name"
                  type="text"
                  className="create-lot-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lote Maternidade"
                  aria-required="true"
                />
              </div>
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-category" className="create-lot-modal__label">
                  Categoria predominante *
                </label>
                <select
                  id="edit-lot-category"
                  className="create-lot-modal__select"
                  value={predominantCategory}
                  onChange={(e) => setPredominantCategory(e.target.value as AnimalCategory)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {ANIMAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="create-lot-modal__row">
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-location" className="create-lot-modal__label">
                  Localização *
                </label>
                <input
                  id="edit-lot-location"
                  type="text"
                  className="create-lot-modal__input"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="Ex: Pasto 3, Galpão Norte"
                  aria-required="true"
                />
              </div>
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-location-type" className="create-lot-modal__label">
                  Tipo de local *
                </label>
                <select
                  id="edit-lot-location-type"
                  className="create-lot-modal__select"
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as LotLocationType)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {LOCATION_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {LOCATION_TYPE_LABELS[lt]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="create-lot-modal__row">
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-capacity" className="create-lot-modal__label">
                  Capacidade máxima
                </label>
                <input
                  id="edit-lot-capacity"
                  type="number"
                  className="create-lot-modal__input"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  placeholder="Ex: 30"
                  min="1"
                />
              </div>
              <div className="create-lot-modal__field">
                <label htmlFor="edit-lot-description" className="create-lot-modal__label">
                  Descrição
                </label>
                <input
                  id="edit-lot-description"
                  type="text"
                  className="create-lot-modal__input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição breve do lote"
                />
              </div>
            </div>

            <div className="create-lot-modal__field">
              <label htmlFor="edit-lot-notes" className="create-lot-modal__label">
                Observações
              </label>
              <textarea
                id="edit-lot-notes"
                className="create-lot-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="create-lot-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="create-lot-modal__footer">
          <div className="create-lot-modal__footer-spacer" />
          <button
            type="button"
            className="create-lot-modal__btn create-lot-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="create-lot-modal__btn create-lot-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditLotModal;
