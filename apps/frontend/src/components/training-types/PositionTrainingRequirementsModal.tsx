import { useEffect, useRef, useState } from 'react';
import { X, Trash2, Plus, AlertCircle } from 'lucide-react';
import type { TrainingType, PositionTrainingRequirement } from '@/types/training';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './PositionTrainingRequirementsModal.css';

interface Position {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  position: Position | null;
  requirements: PositionTrainingRequirement[];
  trainingTypes: TrainingType[];
  onClose: () => void;
  onAdd: (positionId: string, trainingTypeId: string) => Promise<boolean>;
  onRemove: (requirementId: string) => Promise<boolean>;
}

export default function PositionTrainingRequirementsModal({
  isOpen,
  position,
  requirements,
  trainingTypes,
  onClose,
  onAdd,
  onRemove,
}: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTypeId('');
      setError(null);
      setTimeout(() => firstRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  const positionReqs = requirements.filter((r) => r.positionId === position.id);

  // Available types to add (not already added, not system global types that appear globally)
  const addedTypeIds = new Set(positionReqs.map((r) => r.trainingTypeId));
  const availableTypes = trainingTypes.filter((t) => !t.isGlobal && !addedTypeIds.has(t.id));
  const globalTypes = trainingTypes.filter((t) => t.isGlobal);

  const handleAdd = async () => {
    if (!selectedTypeId) return;
    setAdding(true);
    setError(null);
    const ok = await onAdd(position.id, selectedTypeId);
    setAdding(false);
    if (ok) {
      setSelectedTypeId('');
    } else {
      setError('Não foi possível adicionar o requisito.');
    }
  };

  const handleRemove = async () => {
    if (!removeId) return;
    setRemoving(true);
    const ok = await onRemove(removeId);
    setRemoving(false);
    if (ok) {
      setRemoveId(null);
    }
  };

  return (
    <>
      <div
        className="pos-train-modal__overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-train-modal-title"
      >
        <div className="pos-train-modal">
          <div className="pos-train-modal__header">
            <h2 id="pos-train-modal-title" className="pos-train-modal__title">
              Treinamentos — {position.name}
            </h2>
            <button
              type="button"
              className="pos-train-modal__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="pos-train-modal__body">
            {error && (
              <div className="pos-train-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Global training types */}
            {globalTypes.length > 0 && (
              <div className="pos-train-modal__section">
                <p className="pos-train-modal__section-label">Obrigatórios para todos os cargos</p>
                <ul className="pos-train-modal__list">
                  {globalTypes.map((t) => (
                    <li key={t.id} className="pos-train-modal__item">
                      <span>{t.name}</span>
                      <span className="pos-train-modal__global-chip">Todos os cargos</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Position-specific requirements */}
            <div className="pos-train-modal__section">
              <p className="pos-train-modal__section-label">Requisitos específicos do cargo</p>
              {positionReqs.length === 0 ? (
                <p className="pos-train-modal__empty">Nenhum treinamento definido para este cargo.</p>
              ) : (
                <ul className="pos-train-modal__list">
                  {positionReqs.map((req) => (
                    <li key={req.id} className="pos-train-modal__item">
                      <span>{req.trainingTypeName}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${req.trainingTypeName}`}
                        className="pos-train-modal__remove-btn"
                        onClick={() => setRemoveId(req.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add requirement */}
            {availableTypes.length > 0 && (
              <div className="pos-train-modal__add-row">
                <label htmlFor="pos-train-select" className="pos-train-modal__add-label">
                  Adicionar treinamento
                </label>
                <div className="pos-train-modal__add-controls">
                  <select
                    ref={firstRef}
                    id="pos-train-select"
                    className="pos-train-modal__select"
                    value={selectedTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {availableTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pos-train-modal__add-btn"
                    onClick={handleAdd}
                    disabled={!selectedTypeId || adding}
                    aria-label="Adicionar treinamento"
                  >
                    <Plus size={16} aria-hidden="true" />
                    {adding ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pos-train-modal__footer">
            <button
              type="button"
              className="pos-train-modal__close-btn"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!removeId}
        title="Remover treinamento"
        message="Remover este requisito de treinamento do cargo?"
        variant="warning"
        confirmLabel="Remover"
        isLoading={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemoveId(null)}
      />
    </>
  );
}
