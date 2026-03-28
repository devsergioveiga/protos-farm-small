import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAssetDisposal } from '@/hooks/useAssetDisposal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import InstallmentPreviewTable from '@/components/assets/InstallmentPreviewTable';
import type { Asset, CreateDisposalInput, DisposalType, InstallmentPreview } from '@/types/asset';
import { DISPOSAL_TYPE_LABELS } from '@/types/asset';
import './AssetDisposalModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetDisposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: Asset;
}

// ─── Helpers ───────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateInstallments(
  totalAmount: number,
  count: number,
  firstDueDate: string,
): InstallmentPreview[] {
  if (!totalAmount || count <= 0 || !firstDueDate) return [];
  const amount = totalAmount / count;
  const result: InstallmentPreview[] = [];
  const base = new Date(firstDueDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(base);
    dueDate.setMonth(dueDate.getMonth() + i);
    result.push({ number: i + 1, dueDate, amount });
  }
  return result;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function AssetDisposalModal({
  isOpen,
  onClose,
  onSuccess,
  asset,
}: AssetDisposalModalProps) {
  const { createDisposal, isLoading } = useAssetDisposal();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [disposalType, setDisposalType] = useState<DisposalType>('VENDA');
  const [disposalDate, setDisposalDate] = useState(today());
  const [saleValue, setSaleValue] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [installmentCount, setInstallmentCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [motivation, setMotivation] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisposalType('VENDA');
      setDisposalDate(today());
      setSaleValue('');
      setBuyerName('');
      setDueDate('');
      setInstallmentCount(1);
      setFirstDueDate('');
      setMotivation('');
      setDocumentUrl('');
      setFormError(null);
      setShowConfirm(false);
      setTimeout(() => closeRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showConfirm) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, showConfirm]);

  if (!isOpen) return null;

  const acquisitionValue = asset.acquisitionValue ? parseFloat(asset.acquisitionValue) : 0;
  const saleValueNum = parseFloat(saleValue) || 0;
  const isVenda = disposalType === 'VENDA';

  // Estimated gain/loss (approximate — backend will use actual NBV)
  const gainLoss = isVenda ? saleValueNum - acquisitionValue : -acquisitionValue;

  // Installment preview
  const installments: InstallmentPreview[] =
    isVenda && installmentCount > 1 && saleValueNum > 0 && firstDueDate
      ? generateInstallments(saleValueNum, installmentCount, firstDueDate)
      : [];

  function handleSubmitAttempt(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!disposalDate) {
      setFormError('Data da alienacao e obrigatoria.');
      return;
    }
    if (isVenda && !saleValue) {
      setFormError('Valor de venda e obrigatorio para alienacao por Venda.');
      return;
    }
    if (!isVenda && !motivation) {
      setFormError('Motivacao e obrigatoria para este tipo de alienacao.');
      return;
    }

    setShowConfirm(true);
  }

  async function handleConfirm() {
    setFormError(null);
    const data: CreateDisposalInput = {
      disposalType,
      disposalDate,
    };
    if (isVenda) {
      data.saleValue = saleValueNum;
      if (buyerName) data.buyerName = buyerName;
      if (dueDate) data.dueDate = dueDate;
      if (installmentCount > 1) {
        data.installmentCount = installmentCount;
        if (firstDueDate) data.firstDueDate = firstDueDate;
      }
    } else {
      data.motivation = motivation;
      if (documentUrl) data.documentUrl = documentUrl;
    }

    try {
      await createDisposal(asset.id, data);
      setShowConfirm(false);
      onSuccess();
    } catch (err) {
      setShowConfirm(false);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel registrar a alienacao. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="disposal-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disposal-modal-title"
    >
      <div className="disposal-modal">
        {/* Header */}
        <div className="disposal-modal__header">
          <h2 id="disposal-modal-title" className="disposal-modal__title">
            Alienar ativo
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="disposal-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Asset info */}
        <div className="disposal-modal__asset-info">
          <span className="disposal-modal__asset-tag">{asset.assetTag}</span>
          <span className="disposal-modal__asset-name">{asset.name}</span>
          {acquisitionValue > 0 && (
            <span className="disposal-modal__asset-value">
              Valor de aquisicao: {currencyFmt.format(acquisitionValue)}
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitAttempt} noValidate>
          <div className="disposal-modal__body">
            {/* Tipo de alienacao */}
            <section className="disposal-section">
              <h3 className="disposal-section__title">Tipo de alienacao *</h3>
              <div className="disposal-section__radio-group" role="radiogroup" aria-label="Tipo de alienacao">
                {(Object.entries(DISPOSAL_TYPE_LABELS) as [DisposalType, string][]).map(
                  ([value, label]) => (
                    <label key={value} className="disposal-section__radio-label">
                      <input
                        type="radio"
                        name="disposalType"
                        value={value}
                        checked={disposalType === value}
                        onChange={() => setDisposalType(value)}
                        className="disposal-section__radio-input"
                      />
                      {label}
                    </label>
                  ),
                )}
              </div>
            </section>

            {/* Data */}
            <section className="disposal-section">
              <label htmlFor="disposal-date" className="disposal-section__label">
                Data da alienacao *
              </label>
              <input
                id="disposal-date"
                type="date"
                className="disposal-section__input"
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                required
                aria-required="true"
              />
            </section>

            {/* Venda section */}
            {isVenda && (
              <section className="disposal-section">
                <h3 className="disposal-section__title">Dados da venda</h3>

                <div className="disposal-section__field">
                  <label htmlFor="sale-value" className="disposal-section__label">
                    Valor de venda (R$) *
                  </label>
                  <input
                    id="sale-value"
                    type="number"
                    min="0"
                    step="0.01"
                    className="disposal-section__input"
                    value={saleValue}
                    onChange={(e) => setSaleValue(e.target.value)}
                    placeholder="0,00"
                    aria-required="true"
                  />
                </div>

                <div className="disposal-section__field">
                  <label htmlFor="buyer-name" className="disposal-section__label">
                    Nome do comprador
                  </label>
                  <input
                    id="buyer-name"
                    type="text"
                    className="disposal-section__input"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Nome ou razao social"
                  />
                </div>

                <div className="disposal-section__field">
                  <label htmlFor="due-date" className="disposal-section__label">
                    Vencimento (pagamento unico)
                  </label>
                  <input
                    id="due-date"
                    type="date"
                    className="disposal-section__input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="disposal-section__field">
                  <label htmlFor="installment-count" className="disposal-section__label">
                    Numero de parcelas
                  </label>
                  <input
                    id="installment-count"
                    type="number"
                    min="1"
                    max="120"
                    className="disposal-section__input disposal-section__input--narrow"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                {installmentCount > 1 && (
                  <div className="disposal-section__field">
                    <label htmlFor="first-due-date" className="disposal-section__label">
                      Vencimento da 1a parcela *
                    </label>
                    <input
                      id="first-due-date"
                      type="date"
                      className="disposal-section__input"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      aria-required="true"
                    />
                  </div>
                )}

                {installmentCount > 1 && installments.length > 0 && (
                  <div className="disposal-section__installments">
                    <InstallmentPreviewTable
                      installments={installments}
                      totalAmount={saleValueNum}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Baixa section (DESCARTE / SINISTRO / OBSOLESCENCIA) */}
            {!isVenda && (
              <section className="disposal-section">
                <h3 className="disposal-section__title">Dados da baixa</h3>

                <div className="disposal-section__field">
                  <label htmlFor="motivation" className="disposal-section__label">
                    Motivacao *
                  </label>
                  <textarea
                    id="motivation"
                    className="disposal-section__textarea"
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    rows={3}
                    placeholder="Descreva o motivo da baixa..."
                    aria-required="true"
                  />
                </div>

                <div className="disposal-section__field">
                  <label htmlFor="document-url" className="disposal-section__label">
                    URL do laudo / documento (opcional)
                  </label>
                  <input
                    id="document-url"
                    type="url"
                    className="disposal-section__input"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </section>
            )}

            {/* Gain/Loss preview */}
            <section className="disposal-section">
              <div className="disposal-preview-card">
                <h3 className="disposal-preview-card__title">Impacto contabil (estimado)</h3>
                <dl className="disposal-preview-card__dl">
                  <div className="disposal-preview-card__row">
                    <dt>Valor de aquisicao</dt>
                    <dd>{acquisitionValue > 0 ? currencyFmt.format(acquisitionValue) : '—'}</dd>
                  </div>
                  {isVenda && (
                    <div className="disposal-preview-card__row">
                      <dt>Valor de venda</dt>
                      <dd>{saleValueNum > 0 ? currencyFmt.format(saleValueNum) : '—'}</dd>
                    </div>
                  )}
                  <div className="disposal-preview-card__row disposal-preview-card__row--result">
                    <dt>{isVenda ? 'Ganho / Perda estimado' : 'Baixa total do valor contabil'}</dt>
                    <dd
                      className={
                        isVenda
                          ? gainLoss >= 0
                            ? 'disposal-preview-card__gain'
                            : 'disposal-preview-card__loss'
                          : 'disposal-preview-card__loss'
                      }
                    >
                      {isVenda ? (
                        <>
                          {gainLoss >= 0 ? (
                            <TrendingUp size={14} aria-hidden="true" />
                          ) : (
                            <TrendingDown size={14} aria-hidden="true" />
                          )}
                          {currencyFmt.format(gainLoss)}
                        </>
                      ) : (
                        <>
                          <TrendingDown size={14} aria-hidden="true" />
                          Perda total do valor contabil
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="disposal-preview-card__note">
                  * O valor contabil liquido real sera calculado pelo sistema com base na
                  depreciacao acumulada.
                </p>
              </div>
            </section>

            {/* Error */}
            {formError && (
              <div className="disposal-section__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="disposal-modal__footer">
            <button
              type="button"
              className="disposal-modal__btn disposal-modal__btn--cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="disposal-modal__btn disposal-modal__btn--danger"
              disabled={isLoading}
            >
              {isLoading ? 'Registrando...' : 'Alienar ativo'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Confirmar alienacao"
        message={`Tem certeza? Esta acao nao pode ser desfeita. O ativo "${asset.name}" sera marcado como alienado.`}
        confirmLabel="Sim, alienar ativo"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isLoading}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
