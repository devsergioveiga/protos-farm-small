import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmProducers } from '@/hooks/useFarmProducers';
import './BulkMoveToLotModal.css';

const OWNERSHIP_TYPES = [
  { value: 'PROPRIETARIO', label: 'Proprietário' },
  { value: 'PARCEIRO', label: 'Parceiro' },
  { value: 'COMODATARIO', label: 'Comodatário' },
  { value: 'DEPOSITARIO', label: 'Depositário' },
] as const;

interface BulkAssignOwnerModalProps {
  isOpen: boolean;
  farmId: string;
  selectedAnimalIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BulkResult {
  created: number;
  skipped: number;
  total: number;
}

function BulkAssignOwnerModal({
  isOpen,
  farmId,
  selectedAnimalIds,
  onClose,
  onSuccess,
}: BulkAssignOwnerModalProps) {
  const [producerId, setProducerId] = useState('');
  const [ownershipType, setOwnershipType] = useState('PROPRIETARIO');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [participationPct, setParticipationPct] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const { producers } = useFarmProducers(farmId);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const resetState = useCallback(() => {
    setProducerId('');
    setOwnershipType('PROPRIETARIO');
    setStartDate(new Date().toISOString().split('T')[0]);
    setParticipationPct('');
    setNotes('');
    setError(null);
    setResult(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (result) onSuccess();
    onClose();
    resetState();
  }, [result, onSuccess, onClose, resetState]);

  const handleSubmit = useCallback(async () => {
    if (!producerId || !startDate) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        animalIds: selectedAnimalIds,
        producerId,
        ownershipType,
        startDate,
      };
      if (participationPct) payload.participationPct = Number(participationPct);
      if (notes.trim()) payload.notes = notes.trim();

      const res = await api.post<BulkResult>(
        `/org/farms/${farmId}/animal-ownerships/bulk`,
        payload,
      );
      setResult(res);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível vincular o proprietário.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [producerId, ownershipType, startDate, participationPct, notes, selectedAnimalIds, farmId]);

  if (!isOpen) return null;

  return (
    <div className="bulk-move-overlay" onClick={handleClose}>
      <div
        className="bulk-move"
        style={{ maxWidth: 560 }}
        role="dialog"
        aria-modal="true"
        aria-label="Vincular proprietário em lote"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bulk-move__header">
          <h2 className="bulk-move__title">Vincular proprietário</h2>
          <button
            type="button"
            className="bulk-move__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="bulk-move__body">
          {error && (
            <div className="bulk-move__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {result ? (
            <div className="bulk-move__result">
              <Check size={48} aria-hidden="true" style={{ color: 'var(--color-primary-600)' }} />
              <h3 className="bulk-move__result-title">Vínculos criados</h3>
              <p className="bulk-move__result-desc">
                <strong>{result.created}</strong> vínculo(s) criado(s)
                {result.skipped > 0 && ` (${result.skipped} já existente(s))`}
              </p>
            </div>
          ) : (
            <>
              <p className="bulk-move__info">
                Vincular proprietário a <strong>{selectedAnimalIds.length}</strong> animal(is)
                selecionado(s).
              </p>

              <div className="bulk-move__field">
                <label htmlFor="owner-producer" className="bulk-move__label">
                  Produtor *
                </label>
                <select
                  id="owner-producer"
                  className="bulk-move__select"
                  value={producerId}
                  onChange={(e) => setProducerId(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione um produtor...</option>
                  {producers.map((p) => (
                    <option key={p.producerId} value={p.producerId}>
                      {p.producer.name}
                      {p.producer.document ? ` (${p.producer.document})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div className="bulk-move__field" style={{ flex: 1 }}>
                  <label htmlFor="owner-type" className="bulk-move__label">
                    Tipo de vínculo
                  </label>
                  <select
                    id="owner-type"
                    className="bulk-move__select"
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value)}
                  >
                    {OWNERSHIP_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bulk-move__field" style={{ flex: 1 }}>
                  <label htmlFor="owner-date" className="bulk-move__label">
                    Data início *
                  </label>
                  <input
                    id="owner-date"
                    type="date"
                    className="bulk-move__input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-required="true"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div className="bulk-move__field" style={{ flex: 1 }}>
                  <label htmlFor="owner-pct" className="bulk-move__label">
                    Participação (%)
                  </label>
                  <input
                    id="owner-pct"
                    type="number"
                    className="bulk-move__input"
                    value={participationPct}
                    onChange={(e) => setParticipationPct(e.target.value)}
                    placeholder="Ex: 100"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div className="bulk-move__field" style={{ flex: 1 }}>
                  <label htmlFor="owner-notes" className="bulk-move__label">
                    Observações
                  </label>
                  <input
                    id="owner-notes"
                    type="text"
                    className="bulk-move__input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="bulk-move__footer">
          <button
            type="button"
            className="bulk-move__btn bulk-move__btn--secondary"
            onClick={handleClose}
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              className="bulk-move__btn bulk-move__btn--primary"
              disabled={isSubmitting || !producerId || !startDate}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    size={16}
                    style={{ animation: 'create-animal-spin 1s linear infinite' }}
                    aria-hidden="true"
                  />
                  Vinculando...
                </>
              ) : (
                `Vincular a ${selectedAnimalIds.length} animal(is)`
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default BulkAssignOwnerModal;
