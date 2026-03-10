import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { CROP_OPTIONS_OPERATION } from '@/types/operation-type';
import type { OperationTypeItem, CreateOperationTypeInput } from '@/types/operation-type';
import './OperationTypeModal.css';

interface OperationTypeModalProps {
  isOpen: boolean;
  operationType: OperationTypeItem | null;
  parentId: string | null;
  parentName: string | null;
  parentCrops: string[];
  onClose: () => void;
  onSuccess: () => void;
}

function OperationTypeModal({
  isOpen,
  operationType,
  parentId,
  parentName,
  parentCrops,
  onClose,
  onSuccess,
}: OperationTypeModalProps) {
  const isEditing = !!operationType;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setSortOrder(0);
      setSelectedCrops([]);
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (operationType) {
      setName(operationType.name);
      setDescription(operationType.description ?? '');
      setSortOrder(operationType.sortOrder);
      setSelectedCrops(operationType.crops ?? []);
    }
  }, [isOpen, operationType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleCropToggle = useCallback((crop: string) => {
    setSelectedCrops((prev) => {
      if (crop === 'Todas') {
        return prev.includes('Todas') ? [] : ['Todas'];
      }
      const without = prev.filter((c) => c !== 'Todas');
      return without.includes(crop) ? without.filter((c) => c !== crop) : [...without, crop];
    });
  }, []);

  // Available crops: if parent has crops set (and not "Todas"), restrict to those
  const availableCrops: string[] =
    parentCrops.length > 0 && !parentCrops.includes('Todas')
      ? CROP_OPTIONS_OPERATION.filter((c) => c === 'Todas' || parentCrops.includes(c))
      : [...CROP_OPTIONS_OPERATION];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditing) {
        await api.patch(`/org/operation-types/${operationType.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          sortOrder,
          crops: selectedCrops,
        });
      } else {
        const body: CreateOperationTypeInput = {
          name: name.trim(),
          description: description.trim() || null,
          sortOrder,
          crops: selectedCrops,
        };
        if (parentId) body.parentId = parentId;
        await api.post('/org/operation-types', body);
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar tipo de operação';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const effectiveParentName = isEditing ? (operationType.parentId ? parentName : null) : parentName;

  const levelLabel = effectiveParentName
    ? `Sub-operação de "${effectiveParentName}"`
    : 'Categoria principal (nível 1)';

  return (
    <div
      className="optype-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar tipo de operação' : 'Novo tipo de operação'}
    >
      <div className="optype-modal__container">
        <header className="optype-modal__header">
          <h2 className="optype-modal__title">
            {isEditing ? 'Editar tipo de operação' : 'Novo tipo de operação'}
          </h2>
          <button
            type="button"
            className="optype-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="optype-modal__body">
            <p className="optype-modal__level-info">{levelLabel}</p>

            {submitError && (
              <div className="optype-modal__error" role="alert">
                {submitError}
              </div>
            )}

            <div className="optype-modal__field">
              <label htmlFor="optype-name" className="optype-modal__label">
                Nome *
              </label>
              <input
                id="optype-name"
                type="text"
                className="optype-modal__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Aração, Gradagem leve"
                required
                autoFocus
                aria-required="true"
              />
            </div>

            <div className="optype-modal__field">
              <label htmlFor="optype-description" className="optype-modal__label">
                Descrição
              </label>
              <textarea
                id="optype-description"
                className="optype-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional da operação"
                rows={3}
              />
            </div>

            <div className="optype-modal__field">
              <label className="optype-modal__label">Culturas vinculadas</label>
              {parentCrops.length > 0 && !parentCrops.includes('Todas') && (
                <p className="optype-modal__hint">
                  Restritas às culturas do nível pai: {parentCrops.join(', ')}
                </p>
              )}
              <div className="optype-modal__crops">
                {availableCrops.map((crop) => {
                  const isSelected = selectedCrops.includes(crop);
                  const isDisabled = crop !== 'Todas' && selectedCrops.includes('Todas');
                  return (
                    <button
                      key={crop}
                      type="button"
                      className={`optype-modal__crop-chip${isSelected ? ' optype-modal__crop-chip--selected' : ''}`}
                      onClick={() => handleCropToggle(crop)}
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                    >
                      {crop}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="optype-modal__field">
              <label htmlFor="optype-sort" className="optype-modal__label">
                Ordem de exibição
              </label>
              <input
                id="optype-sort"
                type="number"
                className="optype-modal__input optype-modal__input--short"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <footer className="optype-modal__footer">
            <button
              type="button"
              className="optype-modal__btn optype-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="optype-modal__btn optype-modal__btn--primary"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default OperationTypeModal;
