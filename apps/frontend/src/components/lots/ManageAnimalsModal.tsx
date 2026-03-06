import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useAnimals } from '@/hooks/useAnimals';
import { SEX_LABELS, CATEGORY_LABELS } from '@/types/animal';
import type { AnimalListItem } from '@/types/animal';
import './ManageAnimalsModal.css';

interface ManageAnimalsModalProps {
  isOpen: boolean;
  farmId: string;
  lotId: string;
  lotName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ManageAnimalsModal({
  isOpen,
  farmId,
  lotId,
  lotName,
  onClose,
  onSuccess,
}: ManageAnimalsModalProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    moved: number;
    warning: string | null;
  } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { animals, isLoading } = useAnimals({
    farmId: isOpen ? farmId : null,
    search: debouncedSearch || undefined,
    limit: 50,
  });

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setDebouncedSearch('');
      setSelectedIds(new Set());
      setReason('');
      setSubmitError(null);
      setSubmitResult(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  const toggleAnimal = useCallback((animalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) {
        next.delete(animalId);
      } else {
        next.add(animalId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await api.post<{ moved: number; warning: string | null }>(
        `/org/farms/${farmId}/lots/${lotId}/move`,
        {
          animalIds: [...selectedIds],
          reason: reason.trim() || undefined,
        },
      );
      setSubmitResult(result);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mover animais';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, farmId, lotId, reason, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="manage-animals-overlay" onClick={onClose}>
      <div
        className="manage-animals-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Mover animais para ${lotName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="manage-animals-modal__header">
          <h2 className="manage-animals-modal__title">Mover animais para {lotName}</h2>
          <button
            type="button"
            className="manage-animals-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="manage-animals-modal__body">
          {/* Search */}
          <div className="manage-animals-modal__search-wrapper">
            <Search size={16} aria-hidden="true" className="manage-animals-modal__search-icon" />
            <input
              type="search"
              className="manage-animals-modal__search"
              placeholder="Buscar por brinco ou nome..."
              value={search}
              onChange={handleSearchChange}
              aria-label="Buscar animais"
            />
          </div>

          {/* Animals list */}
          <div className="manage-animals-modal__list">
            {isLoading && (
              <div className="manage-animals-modal__loading">Carregando animais...</div>
            )}
            {!isLoading && animals.length === 0 && (
              <div className="manage-animals-modal__empty">Nenhum animal encontrado</div>
            )}
            {!isLoading &&
              animals.map((animal: AnimalListItem) => {
                const isSelected = selectedIds.has(animal.id);
                const alreadyInLot = animal.lotId === lotId;
                return (
                  <button
                    key={animal.id}
                    type="button"
                    className={`manage-animals-modal__item ${isSelected ? 'manage-animals-modal__item--selected' : ''} ${alreadyInLot ? 'manage-animals-modal__item--disabled' : ''}`}
                    onClick={() => !alreadyInLot && toggleAnimal(animal.id)}
                    disabled={alreadyInLot}
                    aria-pressed={isSelected}
                  >
                    <div className="manage-animals-modal__item-check">
                      {isSelected && <Check size={14} aria-hidden="true" />}
                    </div>
                    <div className="manage-animals-modal__item-info">
                      <span className="manage-animals-modal__item-tag">{animal.earTag}</span>
                      {animal.name && (
                        <span className="manage-animals-modal__item-name">{animal.name}</span>
                      )}
                      <span className="manage-animals-modal__item-meta">
                        {SEX_LABELS[animal.sex]} &middot; {CATEGORY_LABELS[animal.category]}
                      </span>
                    </div>
                    {alreadyInLot && (
                      <span className="manage-animals-modal__item-badge">Já no lote</span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Reason */}
          <div className="manage-animals-modal__field">
            <label htmlFor="move-reason" className="manage-animals-modal__label">
              Motivo (opcional)
            </label>
            <input
              id="move-reason"
              type="text"
              className="manage-animals-modal__input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Manejo de recria"
            />
          </div>

          {submitError && (
            <div className="manage-animals-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}

          {submitResult?.warning && (
            <div className="manage-animals-modal__warning" role="alert" aria-live="polite">
              {submitResult.warning}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="manage-animals-modal__footer">
          <span className="manage-animals-modal__selection-count">
            {selectedIds.size}{' '}
            {selectedIds.size === 1 ? 'animal selecionado' : 'animais selecionados'}
          </span>
          <div className="manage-animals-modal__footer-spacer" />
          <button
            type="button"
            className="manage-animals-modal__btn manage-animals-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="manage-animals-modal__btn manage-animals-modal__btn--primary"
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting
              ? 'Movendo...'
              : `Mover ${selectedIds.size > 0 ? selectedIds.size : ''} animais`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageAnimalsModal;
