import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAssetTransfer } from '@/hooks/useAssetTransfer';
import type { Asset, CreateTransferInput } from '@/types/asset';
import type { FarmListItem } from '@/types/farm';
import './AssetTransferModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (toFarmName: string) => void;
  asset: Asset;
  farms: FarmListItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ─────────────────────────────────────────────────────────

export default function AssetTransferModal({
  isOpen,
  onClose,
  onSuccess,
  asset,
  farms,
}: AssetTransferModalProps) {
  const { createTransfer, isLoading } = useAssetTransfer();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [toFarmId, setToFarmId] = useState('');
  const [transferDate, setTransferDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Available destination farms (exclude current farm)
  const availableFarms = farms.filter((f) => f.id !== asset.farmId);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setToFarmId('');
      setTransferDate(today());
      setNotes('');
      setFormError(null);
      setTimeout(() => closeRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
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

    if (!toFarmId) {
      setFormError('Selecione a fazenda de destino.');
      return;
    }
    if (!transferDate) {
      setFormError('Data da transferencia e obrigatoria.');
      return;
    }

    const data: CreateTransferInput = {
      toFarmId,
      transferDate,
      notes: notes || undefined,
    };

    try {
      await createTransfer(asset.id, data);
      const toFarm = availableFarms.find((f) => f.id === toFarmId);
      onSuccess(toFarm?.name ?? toFarmId);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel registrar a transferencia. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="transfer-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div className="transfer-modal">
        {/* Header */}
        <div className="transfer-modal__header">
          <h2 id="transfer-modal-title" className="transfer-modal__title">
            Transferir ativo
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="transfer-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Asset info */}
        <div className="transfer-modal__asset-info">
          <span className="transfer-modal__asset-tag">{asset.assetTag}</span>
          <span className="transfer-modal__asset-name">{asset.name}</span>
          {asset.farm && (
            <span className="transfer-modal__asset-farm">Origem: {asset.farm.name}</span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="transfer-modal__body">
            {/* Destination farm */}
            <div className="transfer-modal__field">
              <label htmlFor="to-farm-id" className="transfer-modal__label">
                Fazenda de destino *
              </label>
              {availableFarms.length === 0 ? (
                <p className="transfer-modal__no-farms">
                  Nenhuma outra fazenda disponivel. Cadastre mais fazendas para transferir ativos.
                </p>
              ) : (
                <select
                  id="to-farm-id"
                  className="transfer-modal__select"
                  value={toFarmId}
                  onChange={(e) => setToFarmId(e.target.value)}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione a fazenda...</option>
                  {availableFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Transfer date */}
            <div className="transfer-modal__field">
              <label htmlFor="transfer-date" className="transfer-modal__label">
                Data da transferencia *
              </label>
              <input
                id="transfer-date"
                type="date"
                className="transfer-modal__input"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>

            {/* Notes */}
            <div className="transfer-modal__field">
              <label htmlFor="transfer-notes" className="transfer-modal__label">
                Observacoes
              </label>
              <textarea
                id="transfer-notes"
                className="transfer-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Motivo ou detalhes da transferencia..."
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="transfer-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="transfer-modal__footer">
            <button
              type="button"
              className="transfer-modal__btn transfer-modal__btn--cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="transfer-modal__btn transfer-modal__btn--primary"
              disabled={isLoading || availableFarms.length === 0}
            >
              {isLoading ? 'Transferindo...' : 'Confirmar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
