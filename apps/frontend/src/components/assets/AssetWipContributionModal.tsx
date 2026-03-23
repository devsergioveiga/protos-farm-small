import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAssetWip } from '@/hooks/useAssetWip';
import type { WipStage, AddContributionInput } from '@/hooks/useAssetWip';
import './AssetWipContributionModal.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface AssetWipContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assetId: string;
  stages: WipStage[];
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AssetWipContributionModal({
  isOpen,
  onClose,
  onSuccess,
  assetId,
  stages,
}: AssetWipContributionModalProps) {
  const { addContribution } = useAssetWip(assetId);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [contributionDate, setContributionDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [stageId, setStageId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setContributionDate(today());
      setAmount('');
      setDescription('');
      setStageId('');
      setSupplierId('');
      setInvoiceRef('');
      setNotes('');
      setLoading(false);
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

    if (!contributionDate) {
      setFormError('Data do aporte e obrigatoria.');
      return;
    }
    if (contributionDate > today()) {
      setFormError('Data do aporte nao pode ser uma data futura.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setFormError('Valor deve ser maior que zero.');
      return;
    }
    if (!description.trim()) {
      setFormError('Descricao e obrigatoria.');
      return;
    }

    const input: AddContributionInput = {
      contributionDate,
      amount: amountNum,
      description: description.trim(),
    };
    if (stageId) input.stageId = stageId;
    if (supplierId.trim()) input.supplierId = supplierId.trim();
    if (invoiceRef.trim()) input.invoiceRef = invoiceRef.trim();
    if (notes.trim()) input.notes = notes.trim();

    setLoading(true);
    try {
      await addContribution(input);
      onClose();
      onSuccess();
    } catch {
      setFormError('Nao foi possivel registrar o aporte. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="wip-contribution-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wip-contribution-modal-title"
    >
      <div className="wip-contribution-modal">
        {/* Header */}
        <div className="wip-contribution-modal__header">
          <h2 id="wip-contribution-modal-title" className="wip-contribution-modal__title">
            Registrar Aporte
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="wip-contribution-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="wip-contribution-modal__body">
            {/* Contribution date */}
            <div className="wip-contribution-modal__field">
              <label
                htmlFor="contribution-date"
                className="wip-contribution-modal__label"
              >
                Data do aporte *
              </label>
              <input
                id="contribution-date"
                type="date"
                className="wip-contribution-modal__input"
                value={contributionDate}
                onChange={(e) => setContributionDate(e.target.value)}
                max={today()}
                aria-required="true"
              />
            </div>

            {/* Amount */}
            <div className="wip-contribution-modal__field">
              <label htmlFor="contribution-amount" className="wip-contribution-modal__label">
                Valor (R$) *
              </label>
              <input
                id="contribution-amount"
                type="number"
                className="wip-contribution-modal__input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                placeholder="0,00"
                aria-required="true"
              />
            </div>

            {/* Description */}
            <div className="wip-contribution-modal__field">
              <label htmlFor="contribution-description" className="wip-contribution-modal__label">
                Descricao *
              </label>
              <input
                id="contribution-description"
                type="text"
                className="wip-contribution-modal__input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                aria-required="true"
                placeholder="Ex: Materiais de construcao, mao de obra..."
              />
            </div>

            {/* Stage */}
            {stages.length > 0 && (
              <div className="wip-contribution-modal__field">
                <label htmlFor="contribution-stage" className="wip-contribution-modal__label">
                  Etapa (opcional)
                </label>
                <select
                  id="contribution-stage"
                  className="wip-contribution-modal__select"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                >
                  <option value="">Selecione uma etapa...</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Supplier */}
            <div className="wip-contribution-modal__field">
              <label htmlFor="contribution-supplier" className="wip-contribution-modal__label">
                Fornecedor
              </label>
              <input
                id="contribution-supplier"
                type="text"
                className="wip-contribution-modal__input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                maxLength={255}
                placeholder="Nome do fornecedor"
              />
            </div>

            {/* Invoice ref */}
            <div className="wip-contribution-modal__field">
              <label htmlFor="contribution-invoice" className="wip-contribution-modal__label">
                Numero da NF
              </label>
              <input
                id="contribution-invoice"
                type="text"
                className="wip-contribution-modal__input"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                maxLength={100}
                placeholder="Ex: 123456"
              />
            </div>

            {/* Notes */}
            <div className="wip-contribution-modal__field">
              <label htmlFor="contribution-notes" className="wip-contribution-modal__label">
                Observacoes
              </label>
              <textarea
                id="contribution-notes"
                className="wip-contribution-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Informacoes adicionais..."
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="wip-contribution-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="wip-contribution-modal__footer">
            <button
              type="button"
              className="wip-contribution-modal__btn wip-contribution-modal__btn--cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="wip-contribution-modal__btn wip-contribution-modal__btn--primary"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrar Aporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
