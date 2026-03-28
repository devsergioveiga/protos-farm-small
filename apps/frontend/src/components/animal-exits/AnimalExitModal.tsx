import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import type {
  AnimalExitType,
  DeathType,
  CreateAnimalExitPayload,
  BulkAnimalExitPayload,
  BulkAnimalExitResult,
  AnimalExitItem,
} from '@/types/animal-exit';
import { EXIT_TYPES, EXIT_TYPE_LABELS, DEATH_TYPES, DEATH_TYPE_LABELS } from '@/types/animal-exit';
import './AnimalExitModal.css';

interface AnimalExitModalProps {
  isOpen: boolean;
  farmId: string;
  animalId?: string | null;
  animalIds?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

function AnimalExitModal({
  isOpen,
  farmId,
  animalId,
  animalIds,
  onClose,
  onSuccess,
}: AnimalExitModalProps) {
  const isBulk = !animalId && Array.isArray(animalIds) && animalIds.length > 0;
  const count = isBulk ? animalIds!.length : 1;

  const [exitType, setExitType] = useState<AnimalExitType | ''>('');
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [deathType, setDeathType] = useState<DeathType | ''>('');
  const [deathCause, setDeathCause] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [saleWeightKg, setSaleWeightKg] = useState('');
  const [salePricePerKg, setSalePricePerKg] = useState('');
  const [salePriceTotal, setSalePriceTotal] = useState('');
  const [gtaNumber, setGtaNumber] = useState('');
  const [destinationFarm, setDestinationFarm] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate total when weight and price per kg change
  useEffect(() => {
    const weight = parseFloat(saleWeightKg);
    const pricePerKg = parseFloat(salePricePerKg);
    if (!isNaN(weight) && !isNaN(pricePerKg) && weight > 0 && pricePerKg > 0) {
      setSalePriceTotal((weight * pricePerKg).toFixed(2));
    }
  }, [saleWeightKg, salePricePerKg]);

  const resetForm = useCallback(() => {
    setExitType('');
    setExitDate(new Date().toISOString().slice(0, 10));
    setDeathType('');
    setDeathCause('');
    setBuyerName('');
    setSaleWeightKg('');
    setSalePricePerKg('');
    setSalePriceTotal('');
    setGtaNumber('');
    setDestinationFarm('');
    setNotes('');
    setError(null);
  }, []);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitType) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateAnimalExitPayload = {
        exitType,
        exitDate,
        deathType: exitType === 'MORTE' ? deathType || null : null,
        deathCause: exitType === 'MORTE' ? deathCause || null : null,
        buyerName: ['VENDA', 'ABATE'].includes(exitType) ? buyerName || null : null,
        salePriceTotal:
          ['VENDA', 'ABATE'].includes(exitType) && salePriceTotal
            ? parseFloat(salePriceTotal)
            : null,
        salePricePerKg:
          ['VENDA', 'ABATE'].includes(exitType) && salePricePerKg
            ? parseFloat(salePricePerKg)
            : null,
        saleWeightKg:
          ['VENDA', 'ABATE'].includes(exitType) && saleWeightKg ? parseFloat(saleWeightKg) : null,
        gtaNumber: ['VENDA', 'TRANSFERENCIA'].includes(exitType) && gtaNumber ? gtaNumber : null,
        destinationFarm:
          ['VENDA', 'TRANSFERENCIA'].includes(exitType) && destinationFarm ? destinationFarm : null,
        notes: notes || null,
      };

      if (isBulk) {
        const bulkPayload: BulkAnimalExitPayload = { ...payload, animalIds: animalIds! };
        const result = await api.post<BulkAnimalExitResult>(
          `/org/farms/${farmId}/animal-exits/bulk`,
          bulkPayload,
        );
        if (result.failed > 0) {
          setError(
            `${result.created} saída(s) registrada(s). ${result.failed} falha(s): ${result.errors.map((e) => e.earTag ?? e.animalId).join(', ')}`,
          );
        }
      } else {
        await api.post<AnimalExitItem>(`/org/farms/${farmId}/animals/${animalId}/exit`, payload);
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível registrar a saída';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showDeathFields = exitType === 'MORTE';
  const showSaleFields = exitType === 'VENDA' || exitType === 'ABATE';
  const showTransferFields = exitType === 'VENDA' || exitType === 'TRANSFERENCIA';

  return (
    <div
      className="exit-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar saída de animal"
    >
      <div className="exit-modal__container">
        <header className="exit-modal__header">
          <h2 className="exit-modal__title">
            Registrar saída {isBulk ? `(${count} animais)` : ''}
          </h2>
          <button type="button" className="exit-modal__close" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="exit-modal__body">
          <div className="exit-modal__warning" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>
              {isBulk
                ? `Os ${count} animais selecionados serão removidos do rebanho ativo.`
                : 'O animal será removido do rebanho ativo.'}
            </span>
          </div>

          {error && (
            <div className="exit-modal__error" role="alert">
              {error}
            </div>
          )}

          <div className="exit-modal__field">
            <label htmlFor="exit-type" className="exit-modal__label">
              Tipo de saída *
            </label>
            <select
              id="exit-type"
              className="exit-modal__select"
              value={exitType}
              onChange={(e) => setExitType(e.target.value as AnimalExitType)}
              required
              aria-required="true"
            >
              <option value="">Selecione...</option>
              {EXIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="exit-modal__field">
            <label htmlFor="exit-date" className="exit-modal__label">
              Data da saída *
            </label>
            <input
              id="exit-date"
              type="date"
              className="exit-modal__input"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
              aria-required="true"
            />
          </div>

          {showDeathFields && (
            <>
              <div className="exit-modal__field">
                <label htmlFor="death-type" className="exit-modal__label">
                  Tipo de morte *
                </label>
                <select
                  id="death-type"
                  className="exit-modal__select"
                  value={deathType}
                  onChange={(e) => setDeathType(e.target.value as DeathType)}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {DEATH_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DEATH_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="exit-modal__field">
                <label htmlFor="death-cause" className="exit-modal__label">
                  Causa da morte *
                </label>
                <textarea
                  id="death-cause"
                  className="exit-modal__textarea"
                  value={deathCause}
                  onChange={(e) => setDeathCause(e.target.value)}
                  required
                  aria-required="true"
                  rows={3}
                  placeholder="Descreva a causa da morte"
                />
              </div>
            </>
          )}

          {showSaleFields && (
            <>
              <div className="exit-modal__field">
                <label htmlFor="buyer-name" className="exit-modal__label">
                  Comprador *
                </label>
                <input
                  id="buyer-name"
                  type="text"
                  className="exit-modal__input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                  aria-required="true"
                  placeholder="Nome do comprador"
                />
              </div>
              <div className="exit-modal__row">
                <div className="exit-modal__field">
                  <label htmlFor="sale-weight" className="exit-modal__label">
                    Peso (kg)
                  </label>
                  <input
                    id="sale-weight"
                    type="number"
                    className="exit-modal__input"
                    value={saleWeightKg}
                    onChange={(e) => setSaleWeightKg(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                  />
                </div>
                <div className="exit-modal__field">
                  <label htmlFor="sale-price-kg" className="exit-modal__label">
                    Preço/kg (R$)
                  </label>
                  <input
                    id="sale-price-kg"
                    type="number"
                    className="exit-modal__input"
                    value={salePricePerKg}
                    onChange={(e) => setSalePricePerKg(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="exit-modal__field">
                <label htmlFor="sale-price-total" className="exit-modal__label">
                  Valor total (R$) *
                </label>
                <input
                  id="sale-price-total"
                  type="number"
                  className="exit-modal__input"
                  value={salePriceTotal}
                  onChange={(e) => setSalePriceTotal(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  aria-required="true"
                  placeholder="0,00"
                />
              </div>
            </>
          )}

          {showTransferFields && (
            <>
              <div className="exit-modal__field">
                <label htmlFor="gta-number" className="exit-modal__label">
                  Número da GTA
                </label>
                <input
                  id="gta-number"
                  type="text"
                  className="exit-modal__input"
                  value={gtaNumber}
                  onChange={(e) => setGtaNumber(e.target.value)}
                  placeholder="Número da GTA (opcional)"
                />
              </div>
              <div className="exit-modal__field">
                <label htmlFor="destination-farm" className="exit-modal__label">
                  Fazenda de destino
                </label>
                <input
                  id="destination-farm"
                  type="text"
                  className="exit-modal__input"
                  value={destinationFarm}
                  onChange={(e) => setDestinationFarm(e.target.value)}
                  placeholder="Nome da fazenda de destino (opcional)"
                />
              </div>
            </>
          )}

          <div className="exit-modal__field">
            <label htmlFor="exit-notes" className="exit-modal__label">
              Observações
            </label>
            <textarea
              id="exit-notes"
              className="exit-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações adicionais (opcional)"
            />
          </div>

          <footer className="exit-modal__footer">
            <button
              type="button"
              className="exit-modal__btn exit-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="exit-modal__btn exit-modal__btn--danger"
              disabled={isSubmitting || !exitType}
            >
              {isSubmitting ? 'Registrando...' : 'Registrar saída'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default AnimalExitModal;
