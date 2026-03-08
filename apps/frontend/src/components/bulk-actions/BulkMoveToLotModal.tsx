import { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useLots } from '@/hooks/useLots';
import { api } from '@/services/api';
import './BulkMoveToLotModal.css';

interface BulkMoveToLotModalProps {
  isOpen: boolean;
  farmId: string;
  selectedAnimalIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface MoveResult {
  moved: number;
  warning?: string | null;
}

function BulkMoveToLotModal({
  isOpen,
  farmId,
  selectedAnimalIds,
  onClose,
  onSuccess,
}: BulkMoveToLotModalProps) {
  const [selectedLotId, setSelectedLotId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MoveResult | null>(null);

  const { lots, isLoading: lotsLoading } = useLots({ farmId, limit: 100 });

  const handleSubmit = async () => {
    if (!selectedLotId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post<MoveResult>(`/org/farms/${farmId}/lots/${selectedLotId}/move`, {
        animalIds: selectedAnimalIds,
        reason: reason || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover animais');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (result) {
      onSuccess();
    }
    setSelectedLotId('');
    setReason('');
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="bulk-move-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-move-title"
    >
      <div className="bulk-move">
        <header className="bulk-move__header">
          <h2 id="bulk-move-title" className="bulk-move__title">
            <ArrowRightLeft aria-hidden="true" size={20} />
            Mover animais para lote
          </h2>
          <button
            type="button"
            className="bulk-move__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="bulk-move__body">
          {result ? (
            <div className="bulk-move__result">
              <CheckCircle size={48} color="var(--color-primary-600)" aria-hidden="true" />
              <h3 className="bulk-move__result-title">Movimentação concluída</h3>
              <p className="bulk-move__result-desc">
                <strong>{result.moved}</strong> animal(is) movido(s) com sucesso.
              </p>
              {result.warning && (
                <p className="bulk-move__result-warning">
                  <AlertCircle size={16} aria-hidden="true" />
                  {result.warning}
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="bulk-move__info">
                <strong>{selectedAnimalIds.length}</strong> animal(is) selecionado(s) serão movidos
                para o lote escolhido.
              </p>

              {error && (
                <div className="bulk-move__error" role="alert" aria-live="polite">
                  <AlertCircle size={16} aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="bulk-move__field">
                <label htmlFor="bulk-move-lot" className="bulk-move__label">
                  Lote de destino *
                </label>
                <select
                  id="bulk-move-lot"
                  className="bulk-move__select"
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  disabled={lotsLoading}
                  aria-required="true"
                >
                  <option value="">Selecione um lote</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name} ({lot._count.animals}/{lot.maxCapacity ?? '∞'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bulk-move__field">
                <label htmlFor="bulk-move-reason" className="bulk-move__label">
                  Motivo da movimentação
                </label>
                <input
                  id="bulk-move-reason"
                  type="text"
                  className="bulk-move__input"
                  placeholder="Ex: Manejo de pastagem, desmama..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <footer className="bulk-move__footer">
          {result ? (
            <button
              type="button"
              className="bulk-move__btn bulk-move__btn--primary"
              onClick={handleClose}
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                className="bulk-move__btn bulk-move__btn--secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="bulk-move__btn bulk-move__btn--primary"
                onClick={() => void handleSubmit()}
                disabled={!selectedLotId || isSubmitting}
              >
                {isSubmitting ? 'Movendo...' : `Mover ${selectedAnimalIds.length} animal(is)`}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default BulkMoveToLotModal;
