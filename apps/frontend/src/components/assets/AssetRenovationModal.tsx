import { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, Receipt, AlertCircle } from 'lucide-react';
import { useAssetRenovation } from '@/hooks/useAssetRenovation';
import type { CreateRenovationInput } from '@/hooks/useAssetRenovation';
import './AssetRenovationModal.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface AssetRenovationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assetId: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AssetRenovationModal({
  isOpen,
  onClose,
  onSuccess,
  assetId,
}: AssetRenovationModalProps) {
  const { createRenovation, loading } = useAssetRenovation(assetId);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [description, setDescription] = useState('');
  const [renovationDate, setRenovationDate] = useState(today());
  const [totalCost, setTotalCost] = useState('');
  const [accountingDecision, setAccountingDecision] = useState<'CAPITALIZAR' | 'DESPESA'>('CAPITALIZAR');
  const [newUsefulLifeMonths, setNewUsefulLifeMonths] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setRenovationDate(today());
      setTotalCost('');
      setAccountingDecision('CAPITALIZAR');
      setNewUsefulLifeMonths('');
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

    if (!description.trim()) {
      setFormError('Descricao da reforma e obrigatoria.');
      return;
    }
    if (!renovationDate) {
      setFormError('Data da reforma e obrigatoria.');
      return;
    }
    if (renovationDate > today()) {
      setFormError('Data da reforma nao pode ser uma data futura.');
      return;
    }
    const cost = parseFloat(totalCost);
    if (!totalCost || isNaN(cost) || cost <= 0) {
      setFormError('Valor total deve ser maior que zero.');
      return;
    }

    const input: CreateRenovationInput = {
      description: description.trim(),
      renovationDate,
      totalCost: cost,
      accountingDecision,
    };

    if (accountingDecision === 'CAPITALIZAR' && newUsefulLifeMonths) {
      const months = parseInt(newUsefulLifeMonths, 10);
      if (!isNaN(months) && months > 0) {
        input.newUsefulLifeMonths = months;
      }
    }

    if (notes.trim()) {
      input.notes = notes.trim();
    }

    try {
      await createRenovation(input);
      onClose();
      onSuccess();
      // Toast handled by parent
    } catch {
      setFormError('Nao foi possivel registrar a reforma. Verifique os dados e tente novamente.');
    }
  }

  return (
    <div
      className="renovation-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="renovation-modal-title"
    >
      <div className="renovation-modal">
        {/* Header */}
        <div className="renovation-modal__header">
          <h2 id="renovation-modal-title" className="renovation-modal__title">
            Registrar Reforma
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="renovation-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="renovation-modal__body">
            {/* Description */}
            <div className="renovation-modal__field">
              <label htmlFor="renovation-description" className="renovation-modal__label">
                Descricao da reforma *
              </label>
              <input
                id="renovation-description"
                type="text"
                className="renovation-modal__input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                aria-required="true"
                placeholder="Ex: Troca de motor, reforma eletrica..."
              />
            </div>

            {/* Date */}
            <div className="renovation-modal__field">
              <label htmlFor="renovation-date" className="renovation-modal__label">
                Data da reforma *
              </label>
              <input
                id="renovation-date"
                type="date"
                className="renovation-modal__input"
                value={renovationDate}
                onChange={(e) => setRenovationDate(e.target.value)}
                max={today()}
                aria-required="true"
              />
            </div>

            {/* Total cost */}
            <div className="renovation-modal__field">
              <label htmlFor="renovation-cost" className="renovation-modal__label">
                Valor total (R$) *
              </label>
              <input
                id="renovation-cost"
                type="number"
                className="renovation-modal__input"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                min="0.01"
                step="0.01"
                placeholder="0,00"
                aria-required="true"
              />
            </div>

            {/* Accounting decision — radio cards */}
            <fieldset className="renovation-modal__fieldset">
              <legend className="renovation-modal__legend">Classificacao contabil *</legend>
              <div className="renovation-modal__radio-group">
                {/* CAPITALIZAR */}
                <label
                  className={`renovation-modal__radio-card${accountingDecision === 'CAPITALIZAR' ? ' renovation-modal__radio-card--selected' : ''}`}
                  htmlFor="accounting-capitalizar"
                >
                  <input
                    id="accounting-capitalizar"
                    type="radio"
                    name="accountingDecision"
                    value="CAPITALIZAR"
                    checked={accountingDecision === 'CAPITALIZAR'}
                    onChange={() => setAccountingDecision('CAPITALIZAR')}
                    className="renovation-modal__radio-input"
                    aria-required="true"
                  />
                  <TrendingUp
                    size={20}
                    aria-hidden="true"
                    className="renovation-modal__radio-icon"
                  />
                  <span className="renovation-modal__radio-content">
                    <span className="renovation-modal__radio-title">Capitalizar</span>
                    <span className="renovation-modal__radio-desc">
                      Soma ao valor contabil do ativo. Use quando a reforma aumenta a capacidade ou
                      prolonga a vida util.
                    </span>
                  </span>
                </label>

                {/* DESPESA */}
                <label
                  className={`renovation-modal__radio-card${accountingDecision === 'DESPESA' ? ' renovation-modal__radio-card--selected' : ''}`}
                  htmlFor="accounting-despesa"
                >
                  <input
                    id="accounting-despesa"
                    type="radio"
                    name="accountingDecision"
                    value="DESPESA"
                    checked={accountingDecision === 'DESPESA'}
                    onChange={() => setAccountingDecision('DESPESA')}
                    className="renovation-modal__radio-input"
                    aria-required="true"
                  />
                  <Receipt size={20} aria-hidden="true" className="renovation-modal__radio-icon" />
                  <span className="renovation-modal__radio-content">
                    <span className="renovation-modal__radio-title">Lancamento em despesa</span>
                    <span className="renovation-modal__radio-desc">
                      Registra como despesa do periodo. Use quando a reforma apenas restaura a
                      condicao original.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {/* New useful life — conditional */}
            <div
              className={`renovation-modal__field${accountingDecision !== 'CAPITALIZAR' ? ' renovation-modal__field--disabled' : ''}`}
            >
              <label htmlFor="renovation-useful-life" className="renovation-modal__label">
                Nova vida util (meses)
                {accountingDecision !== 'CAPITALIZAR' && (
                  <span className="renovation-modal__label-note">
                    {' '}
                    — disponivel apenas para Capitalizar
                  </span>
                )}
              </label>
              <input
                id="renovation-useful-life"
                type="number"
                className="renovation-modal__input"
                value={newUsefulLifeMonths}
                onChange={(e) => setNewUsefulLifeMonths(e.target.value)}
                min="1"
                step="1"
                placeholder="Ex: 60"
                disabled={accountingDecision !== 'CAPITALIZAR'}
                aria-disabled={accountingDecision !== 'CAPITALIZAR'}
              />
            </div>

            {/* Notes */}
            <div className="renovation-modal__field">
              <label htmlFor="renovation-notes" className="renovation-modal__label">
                Observacoes
              </label>
              <textarea
                id="renovation-notes"
                className="renovation-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Informacoes adicionais sobre a reforma..."
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="renovation-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="renovation-modal__footer">
            <button
              type="button"
              className="renovation-modal__btn renovation-modal__btn--cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="renovation-modal__btn renovation-modal__btn--primary"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrar Reforma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
