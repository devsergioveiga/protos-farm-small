import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAssetInventory } from '@/hooks/useAssetInventory';
import { useFarms } from '@/hooks/useFarms';
import './AssetInventoryModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemCount: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function AssetInventoryModal({
  isOpen,
  onClose,
  onSuccess,
}: AssetInventoryModalProps) {
  const { createInventory, isLoading } = useAssetInventory();
  const { farms } = useFarms();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [farmId, setFarmId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFarmId('');
      setNotes('');
      setFormError(null);
      setTimeout(() => closeRef.current?.focus(), 100);
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

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    try {
      const result = await createInventory({
        farmId: farmId || undefined,
        notes: notes || undefined,
      });
      onSuccess(result.itemCount);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel criar o inventario. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="inventory-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
    >
      <div className="inventory-modal">
        <div className="inventory-modal__header">
          <h2 id="inventory-modal-title" className="inventory-modal__title">
            Novo inventario patrimonial
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="inventory-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="inventory-modal__body">
            <div className="inventory-modal__field">
              <label htmlFor="inv-farm-id" className="inventory-modal__label">
                Fazenda
              </label>
              <select
                id="inv-farm-id"
                className="inventory-modal__select"
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
              >
                <option value="">Todas as fazendas</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <p className="inventory-modal__hint">
                Deixe em branco para incluir todos os ativos da organizacao.
              </p>
            </div>

            <div className="inventory-modal__field">
              <label htmlFor="inv-notes" className="inventory-modal__label">
                Observacoes
              </label>
              <textarea
                id="inv-notes"
                className="inventory-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Motivo ou detalhes do inventario..."
              />
            </div>

            {formError && (
              <div className="inventory-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          <div className="inventory-modal__footer">
            <button
              type="button"
              className="inventory-modal__btn inventory-modal__btn--cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inventory-modal__btn inventory-modal__btn--primary"
              disabled={isLoading}
            >
              {isLoading ? 'Criando...' : 'Criar inventario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
