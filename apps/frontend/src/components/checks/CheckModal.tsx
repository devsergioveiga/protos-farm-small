import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, CheckSquare } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateCheckInput } from '@/hooks/useChecks';
import './CheckModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
}

interface CheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  type?: string;
  checkNumber?: string;
  payeeName?: string;
  bankAccountId?: string;
  amount?: string;
  issueDate?: string;
  deliveryDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// ─── Component ─────────────────────────────────────────────────────

const CheckModal = ({ isOpen, onClose, onSuccess }: CheckModalProps) => {
  const [type, setType] = useState<'EMITIDO' | 'RECEBIDO' | ''>('');
  const [checkNumber, setCheckNumber] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [expectedCompensationDate, setExpectedCompensationDate] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Load bank accounts
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setType('');
      setCheckNumber('');
      setPayeeName('');
      setBankAccountId('');
      setAmountDisplay('');
      setIssueDate('');
      setDeliveryDate('');
      setExpectedCompensationDate('');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus first field on open
  useEffect(() => {
    if (isOpen) setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleAmountBlur = useCallback(() => {
    const num = parseBRL(amountDisplay);
    if (num > 0) {
      setAmountDisplay(formatBRL(num));
      setErrors((p) => ({ ...p, amount: undefined }));
    } else if (amountDisplay.trim()) {
      setErrors((p) => ({ ...p, amount: 'Valor inválido' }));
    }
  }, [amountDisplay]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: FormErrors = {};
      if (!type) newErrors.type = 'Tipo é obrigatório';
      if (!checkNumber.trim()) newErrors.checkNumber = 'Número do cheque é obrigatório';
      if (!payeeName.trim())
        newErrors.payeeName =
          type === 'EMITIDO' ? 'Beneficiário é obrigatório' : 'Emitente é obrigatório';
      if (!bankAccountId) newErrors.bankAccountId = 'Conta bancária é obrigatória';
      if (parseBRL(amountDisplay) <= 0) newErrors.amount = 'Valor é obrigatório';
      if (!issueDate) newErrors.issueDate = 'Data de emissão é obrigatória';
      if (deliveryDate && issueDate && deliveryDate < issueDate) {
        newErrors.deliveryDate = 'Data de entrega deve ser igual ou posterior à emissão';
      }
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const payload: CreateCheckInput = {
        type: type as 'EMITIDO' | 'RECEBIDO',
        checkNumber: checkNumber.trim(),
        payeeName: payeeName.trim(),
        bankAccountId,
        amount: parseBRL(amountDisplay),
        issueDate,
        deliveryDate: deliveryDate || undefined,
        expectedCompensationDate: expectedCompensationDate || undefined,
        notes: notes.trim() || undefined,
      };

      try {
        await api.post('/org/checks', payload);
        onSuccess();
      } catch {
        setSubmitError(
          'Não foi possível registrar o cheque. Verifique os dados e tente novamente.',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      type,
      checkNumber,
      payeeName,
      bankAccountId,
      amountDisplay,
      issueDate,
      deliveryDate,
      expectedCompensationDate,
      notes,
      onSuccess,
    ],
  );

  const payeeLabel = type === 'RECEBIDO' ? 'Emitente' : 'Beneficiário';

  if (!isOpen) return null;

  return (
    <div
      className="chk-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chk-modal-title"
    >
      <div className="chk-modal__panel">
        <header className="chk-modal__header">
          <div className="chk-modal__header-icon" aria-hidden="true">
            <CheckSquare size={20} />
          </div>
          <h2 id="chk-modal-title" className="chk-modal__title">
            Registrar Cheque
          </h2>
          <button type="button" className="chk-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="chk-modal__body">
            {submitError && (
              <div className="chk-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Tipo */}
            <fieldset className="chk-modal__fieldset">
              <legend className="chk-modal__label">
                Tipo <span aria-label="obrigatório">*</span>
              </legend>
              <div className="chk-modal__radio-group" role="group" aria-required="true">
                <label className="chk-modal__radio-label">
                  <input
                    ref={firstFieldRef}
                    type="radio"
                    name="chk-type"
                    value="EMITIDO"
                    checked={type === 'EMITIDO'}
                    onChange={() => setType('EMITIDO')}
                    aria-required="true"
                  />
                  Emitido
                </label>
                <label className="chk-modal__radio-label">
                  <input
                    type="radio"
                    name="chk-type"
                    value="RECEBIDO"
                    checked={type === 'RECEBIDO'}
                    onChange={() => setType('RECEBIDO')}
                  />
                  Recebido
                </label>
              </div>
              {errors.type && (
                <span className="chk-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.type}
                </span>
              )}
            </fieldset>

            {/* N Cheque + Beneficiario/Emitente */}
            <div className="chk-modal__row">
              <div className="chk-modal__field">
                <label htmlFor="chk-number" className="chk-modal__label">
                  N° do Cheque <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="chk-number"
                  type="text"
                  maxLength={20}
                  className={`chk-modal__input${errors.checkNumber ? ' chk-modal__input--error' : ''}`}
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  onBlur={() => {
                    if (!checkNumber.trim())
                      setErrors((p) => ({ ...p, checkNumber: 'Número do cheque é obrigatório' }));
                    else setErrors((p) => ({ ...p, checkNumber: undefined }));
                  }}
                  aria-required="true"
                  aria-describedby={errors.checkNumber ? 'chk-number-err' : undefined}
                  placeholder="Ex: 001234"
                />
                {errors.checkNumber && (
                  <span id="chk-number-err" className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.checkNumber}
                  </span>
                )}
              </div>

              <div className="chk-modal__field">
                <label htmlFor="chk-payee" className="chk-modal__label">
                  {payeeLabel} <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="chk-payee"
                  type="text"
                  maxLength={100}
                  className={`chk-modal__input${errors.payeeName ? ' chk-modal__input--error' : ''}`}
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  onBlur={() => {
                    if (!payeeName.trim())
                      setErrors((p) => ({ ...p, payeeName: `${payeeLabel} é obrigatório` }));
                    else setErrors((p) => ({ ...p, payeeName: undefined }));
                  }}
                  aria-required="true"
                  aria-describedby={errors.payeeName ? 'chk-payee-err' : undefined}
                  placeholder={type === 'RECEBIDO' ? 'Nome do emitente' : 'Nome do beneficiário'}
                />
                {errors.payeeName && (
                  <span id="chk-payee-err" className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.payeeName}
                  </span>
                )}
              </div>
            </div>

            {/* Conta bancaria + Valor */}
            <div className="chk-modal__row">
              <div className="chk-modal__field">
                <label htmlFor="chk-bank" className="chk-modal__label">
                  Conta Bancária <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="chk-bank"
                  className={`chk-modal__input${errors.bankAccountId ? ' chk-modal__input--error' : ''}`}
                  value={bankAccountId}
                  onChange={(e) => {
                    setBankAccountId(e.target.value);
                    if (e.target.value) setErrors((p) => ({ ...p, bankAccountId: undefined }));
                  }}
                  aria-required="true"
                >
                  <option value="">Selecione a conta</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.bankAccountId && (
                  <span className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.bankAccountId}
                  </span>
                )}
              </div>

              <div className="chk-modal__field">
                <label htmlFor="chk-amount" className="chk-modal__label">
                  Valor <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="chk-amount"
                  type="text"
                  className={`chk-modal__input chk-modal__input--mono${errors.amount ? ' chk-modal__input--error' : ''}`}
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(e.target.value)}
                  onBlur={handleAmountBlur}
                  aria-required="true"
                  placeholder="R$ 0,00"
                />
                {errors.amount && (
                  <span className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.amount}
                  </span>
                )}
              </div>
            </div>

            {/* Datas */}
            <div className="chk-modal__row chk-modal__row--three">
              <div className="chk-modal__field">
                <label htmlFor="chk-issue-date" className="chk-modal__label">
                  Data de Emissão <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="chk-issue-date"
                  type="date"
                  className={`chk-modal__input${errors.issueDate ? ' chk-modal__input--error' : ''}`}
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  aria-required="true"
                />
                {errors.issueDate && (
                  <span className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.issueDate}
                  </span>
                )}
              </div>

              <div className="chk-modal__field">
                <label htmlFor="chk-delivery-date" className="chk-modal__label">
                  Data de Entrega
                </label>
                <input
                  id="chk-delivery-date"
                  type="date"
                  className={`chk-modal__input${errors.deliveryDate ? ' chk-modal__input--error' : ''}`}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={issueDate || undefined}
                />
                {errors.deliveryDate && (
                  <span className="chk-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.deliveryDate}
                  </span>
                )}
              </div>

              <div className="chk-modal__field">
                <label htmlFor="chk-exp-comp-date" className="chk-modal__label">
                  Data Prevista de Compensação
                </label>
                <input
                  id="chk-exp-comp-date"
                  type="date"
                  className="chk-modal__input"
                  value={expectedCompensationDate}
                  onChange={(e) => setExpectedCompensationDate(e.target.value)}
                />
              </div>
            </div>

            {/* Observacoes */}
            <div className="chk-modal__field">
              <label htmlFor="chk-notes" className="chk-modal__label">
                Observações
              </label>
              <textarea
                id="chk-notes"
                className="chk-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <footer className="chk-modal__footer">
            <button type="button" className="chk-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="chk-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Registrar Cheque'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CheckModal;
