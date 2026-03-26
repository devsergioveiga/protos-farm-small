import { useState, useEffect } from 'react';
import { X, AlertCircle, Trash2, Plus } from 'lucide-react';
import { useEpiProducts } from '@/hooks/useEpiProducts';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { PositionWithEpiCount, PositionEpiRequirement } from '@/types/epi';
import { EPI_TYPE_LABELS } from '@/types/epi';
import './PositionEpiRequirementsModal.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  position: PositionWithEpiCount;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PositionEpiRequirementsModal({
  isOpen,
  position,
  onClose,
  onSuccess,
}: Props) {
  const {
    epiProducts,
    fetchEpiProducts,
    fetchRequirementsForPosition,
    createPositionRequirement,
    deletePositionRequirement,
  } = useEpiProducts();

  const [requirements, setRequirements] = useState<PositionEpiRequirement[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [selectedEpiId, setSelectedEpiId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      void fetchEpiProducts({ limit: 100 });
      setLoadingReqs(true);
      void fetchRequirementsForPosition(position.positionId)
        .then(setRequirements)
        .finally(() => setLoadingReqs(false));
    }
  }, [isOpen, position.positionId, fetchEpiProducts, fetchRequirementsForPosition]);

  if (!isOpen) return null;

  // ─── Add requirement ────────────────────────────────────────────────────

  async function handleAdd() {
    if (!selectedEpiId) {
      setAddError('Selecione um EPI.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const newReq = await createPositionRequirement({
        positionId: position.positionId,
        epiProductId: selectedEpiId,
        quantity: Number(quantity) || 1,
      });
      setRequirements((prev) => [...prev, newReq]);
      setSelectedEpiId('');
      setQuantity('1');
      onSuccess();
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : 'Não foi possível adicionar o requisito.',
      );
    } finally {
      setAdding(false);
    }
  }

  // ─── Delete requirement ─────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deletePositionRequirement(id);
      setRequirements((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      onSuccess();
    } catch (err: unknown) {
      // Silently fail — requirements remain in list
      console.error('Failed to delete requirement:', err);
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="pos-epi-modal__overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`EPIs obrigatórios — ${position.positionName}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="pos-epi-modal">
          {/* Header */}
          <div className="pos-epi-modal__header">
            <div>
              <h2 className="pos-epi-modal__title">EPIs obrigatórios</h2>
              <p className="pos-epi-modal__subtitle">{position.positionName}</p>
            </div>
            <button
              type="button"
              className="pos-epi-modal__close"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="pos-epi-modal__body">
            {/* Current requirements */}
            {loadingReqs ? (
              <div className="pos-epi-modal__skeleton" />
            ) : requirements.length === 0 ? (
              <p className="pos-epi-modal__empty">
                Nenhum EPI obrigatório definido para este cargo.
              </p>
            ) : (
              <ul className="pos-epi-modal__list">
                {requirements.map((req) => (
                  <li key={req.id} className="pos-epi-modal__item">
                    <div className="pos-epi-modal__item-info">
                      <span className="pos-epi-modal__item-name">{req.epiProductName}</span>
                      <span className="pos-epi-modal__item-qty">Qtd: {req.quantity}</span>
                    </div>
                    <button
                      type="button"
                      className="pos-epi-modal__btn-delete"
                      aria-label={`Remover ${req.epiProductName}`}
                      onClick={() => setConfirmDeleteId(req.id)}
                      disabled={deletingId === req.id}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add row */}
            <div className="pos-epi-modal__add-section">
              <h3 className="pos-epi-modal__add-title">Adicionar EPI</h3>
              {addError && (
                <div className="pos-epi-modal__add-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {addError}
                </div>
              )}
              <div className="pos-epi-modal__add-row">
                <select
                  className="pos-epi-modal__select"
                  value={selectedEpiId}
                  onChange={(e) => setSelectedEpiId(e.target.value)}
                  aria-label="Selecionar EPI"
                >
                  <option value="">Selecione um EPI...</option>
                  {epiProducts?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName} — {EPI_TYPE_LABELS[p.epiType] ?? p.epiType} (CA {p.caNumber})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="pos-epi-modal__qty-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={1}
                  aria-label="Quantidade"
                  placeholder="Qtd"
                />
                <button
                  type="button"
                  className="pos-epi-modal__btn-add"
                  onClick={() => void handleAdd()}
                  disabled={adding}
                  aria-busy={adding}
                >
                  <Plus size={16} aria-hidden="true" />
                  {adding ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pos-epi-modal__footer">
            <button type="button" className="pos-epi-modal__btn-close" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete */}
      {confirmDeleteId && (
        <ConfirmModal
          isOpen={true}
          title="Remover requisito"
          message="Remover este EPI dos requisitos do cargo?"
          confirmLabel="Remover"
          variant="warning"
          isLoading={deletingId === confirmDeleteId}
          onConfirm={() => void handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  );
}
