import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CreditCard } from 'lucide-react';
import { api } from '@/services/api';
import type {
  CreditCardBrand,
  CreateCreditCardInput,
  CreditCardOutput,
} from '@/hooks/useCreditCards';
import './CreditCardModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
}

interface FarmOption {
  id: string;
  name: string;
}

interface CreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cardId?: string;
}

interface FormErrors {
  name?: string;
  brand?: string;
  lastFourDigits?: string;
  creditLimit?: string;
  closingDay?: string;
  dueDay?: string;
  debitAccountId?: string;
  farmId?: string;
  holder?: string;
}

const BRAND_LABELS: Record<CreditCardBrand, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outro',
};

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// ─── Component ────────────────────────────────────────────────────

const CreditCardModal = ({ isOpen, onClose, onSuccess, cardId }: CreditCardModalProps) => {
  const isEdit = Boolean(cardId);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState<CreditCardBrand | ''>('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [creditLimitDisplay, setCreditLimitDisplay] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [holder, setHolder] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [farms, setFarms] = useState<FarmOption[]>([]);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = 'credit-card-modal-title';

  // Load options
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
    void api
      .get<{ data: FarmOption[] }>('/org/farms?limit=100')
      .then((r) => setFarms(r.data ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Load for edit
  useEffect(() => {
    if (!isOpen || !cardId) return;
    void api
      .get<CreditCardOutput>(`/org/credit-cards/${cardId}`)
      .then((c) => {
        setName(c.name ?? '');
        setBrand((c.brand as CreditCardBrand) ?? '');
        setLastFourDigits(c.lastFourDigits ?? '');
        setCreditLimitDisplay(formatBRL(c.creditLimit ?? 0));
        setClosingDay(String(c.closingDay ?? ''));
        setDueDay(String(c.dueDay ?? ''));
        setDebitAccountId(c.debitAccountId ?? '');
        setFarmId(c.farmId ?? '');
        setHolder(c.holder ?? '');
        setNotes(c.notes ?? '');
      })
      .catch(() => {});
  }, [isOpen, cardId]);

  // Reset
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setBrand('');
      setLastFourDigits('');
      setCreditLimitDisplay('');
      setClosingDay('');
      setDueDay('');
      setDebitAccountId('');
      setFarmId('');
      setHolder('');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus first field
  useEffect(() => {
    if (isOpen) setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (name.trim().length > 60) newErrors.name = 'Nome deve ter no máximo 60 caracteres';
    if (!brand) newErrors.brand = 'Bandeira é obrigatória';
    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits)) {
      newErrors.lastFourDigits = 'Informe exatamente 4 dígitos numéricos';
    }
    const limit = parseBRL(creditLimitDisplay);
    if (!limit || limit <= 0)
      newErrors.creditLimit = 'Limite é obrigatório e deve ser maior que zero';
    const closing = parseInt(closingDay);
    if (!closing || closing < 1 || closing > 28)
      newErrors.closingDay = 'Dia de fechamento deve ser entre 1 e 28';
    const due = parseInt(dueDay);
    if (!due || due < 1 || due > 28) newErrors.dueDay = 'Dia de vencimento deve ser entre 1 e 28';
    if (!debitAccountId) newErrors.debitAccountId = 'Conta de débito é obrigatória';
    if (!farmId) newErrors.farmId = 'Fazenda é obrigatória';
    if (!holder.trim()) newErrors.holder = 'Portador é obrigatório';
    if (holder.trim().length > 80) newErrors.holder = 'Portador deve ter no máximo 80 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateCreditCardInput = {
      name: name.trim(),
      brand: brand as CreditCardBrand,
      lastFourDigits: lastFourDigits || undefined,
      creditLimit: parseBRL(creditLimitDisplay),
      closingDay: parseInt(closingDay),
      dueDay: parseInt(dueDay),
      debitAccountId,
      farmId,
      holder: holder.trim(),
      notes: notes.trim() || undefined,
    };

    try {
      if (isEdit && cardId) {
        await api.put(`/org/credit-cards/${cardId}`, payload);
      } else {
        await api.post('/org/credit-cards', payload);
      }
      onSuccess();
    } catch {
      setSubmitError(
        isEdit
          ? 'Não foi possível salvar as alterações. Verifique os dados e tente novamente.'
          : 'Não foi possível cadastrar o cartão. Verifique os dados e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ccm-modal__backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ccm-modal__panel">
        <header className="ccm-modal__header">
          <div className="ccm-modal__header-icon" aria-hidden="true">
            <CreditCard size={20} />
          </div>
          <h2 id={titleId} className="ccm-modal__title">
            {isEdit ? 'Editar cartão' : 'Novo cartão'}
          </h2>
          <button type="button" className="ccm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="ccm-modal__body">
            {submitError && (
              <div className="ccm-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Nome */}
            <div className="ccm-modal__field">
              <label htmlFor="ccm-name" className="ccm-modal__label">
                Nome <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="ccm-name"
                ref={firstFieldRef}
                type="text"
                maxLength={60}
                className={`ccm-modal__input${errors.name ? ' ccm-modal__input--error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setErrors((p) => ({ ...p, name: 'Nome é obrigatório' }));
                  else setErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.name ? 'ccm-name-err' : undefined}
                placeholder="Ex: Cartão Corporativo Visa"
              />
              {errors.name && (
                <span id="ccm-name-err" className="ccm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.name}
                </span>
              )}
            </div>

            {/* Bandeira + Últimos 4 dígitos */}
            <div className="ccm-modal__row">
              <div className="ccm-modal__field">
                <label htmlFor="ccm-brand" className="ccm-modal__label">
                  Bandeira <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="ccm-brand"
                  className={`ccm-modal__input${errors.brand ? ' ccm-modal__input--error' : ''}`}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value as CreditCardBrand)}
                  onBlur={() => {
                    if (!brand) setErrors((p) => ({ ...p, brand: 'Bandeira é obrigatória' }));
                    else setErrors((p) => ({ ...p, brand: undefined }));
                  }}
                  aria-required="true"
                >
                  <option value="">Selecione a bandeira</option>
                  {(Object.keys(BRAND_LABELS) as CreditCardBrand[]).map((b) => (
                    <option key={b} value={b}>
                      {BRAND_LABELS[b]}
                    </option>
                  ))}
                </select>
                {errors.brand && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.brand}
                  </span>
                )}
              </div>

              <div className="ccm-modal__field">
                <label htmlFor="ccm-last-four" className="ccm-modal__label">
                  Últimos 4 dígitos
                </label>
                <input
                  id="ccm-last-four"
                  type="text"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                  className={`ccm-modal__input ccm-modal__input--mono${errors.lastFourDigits ? ' ccm-modal__input--error' : ''}`}
                  value={lastFourDigits}
                  onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onBlur={() => {
                    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits)) {
                      setErrors((p) => ({
                        ...p,
                        lastFourDigits: 'Informe exatamente 4 dígitos numéricos',
                      }));
                    } else {
                      setErrors((p) => ({ ...p, lastFourDigits: undefined }));
                    }
                  }}
                  placeholder="0000"
                />
                {errors.lastFourDigits && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.lastFourDigits}
                  </span>
                )}
              </div>
            </div>

            {/* Limite + Portador */}
            <div className="ccm-modal__row">
              <div className="ccm-modal__field">
                <label htmlFor="ccm-limit" className="ccm-modal__label">
                  Limite de crédito <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ccm-limit"
                  type="text"
                  inputMode="decimal"
                  className={`ccm-modal__input ccm-modal__input--mono${errors.creditLimit ? ' ccm-modal__input--error' : ''}`}
                  value={creditLimitDisplay}
                  onChange={(e) => setCreditLimitDisplay(e.target.value)}
                  onBlur={() => {
                    const num = parseBRL(creditLimitDisplay);
                    if (num > 0) {
                      setCreditLimitDisplay(formatBRL(num));
                      setErrors((p) => ({ ...p, creditLimit: undefined }));
                    } else {
                      setErrors((p) => ({
                        ...p,
                        creditLimit: 'Limite é obrigatório e deve ser maior que zero',
                      }));
                    }
                  }}
                  aria-required="true"
                  placeholder="R$ 0,00"
                />
                {errors.creditLimit && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.creditLimit}
                  </span>
                )}
              </div>

              <div className="ccm-modal__field">
                <label htmlFor="ccm-holder" className="ccm-modal__label">
                  Portador <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ccm-holder"
                  type="text"
                  maxLength={80}
                  className={`ccm-modal__input${errors.holder ? ' ccm-modal__input--error' : ''}`}
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  onBlur={() => {
                    if (!holder.trim())
                      setErrors((p) => ({ ...p, holder: 'Portador é obrigatório' }));
                    else setErrors((p) => ({ ...p, holder: undefined }));
                  }}
                  aria-required="true"
                  placeholder="Nome do portador do cartão"
                />
                {errors.holder && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.holder}
                  </span>
                )}
              </div>
            </div>

            {/* Dia fechamento + Dia vencimento */}
            <div className="ccm-modal__row">
              <div className="ccm-modal__field">
                <label htmlFor="ccm-closing-day" className="ccm-modal__label">
                  Dia de fechamento <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ccm-closing-day"
                  type="number"
                  min={1}
                  max={28}
                  className={`ccm-modal__input${errors.closingDay ? ' ccm-modal__input--error' : ''}`}
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(closingDay);
                    if (!val || val < 1 || val > 28) {
                      setErrors((p) => ({ ...p, closingDay: 'Dia deve ser entre 1 e 28' }));
                    } else {
                      setErrors((p) => ({ ...p, closingDay: undefined }));
                    }
                  }}
                  aria-required="true"
                  placeholder="1–28"
                />
                {errors.closingDay && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.closingDay}
                  </span>
                )}
              </div>

              <div className="ccm-modal__field">
                <label htmlFor="ccm-due-day" className="ccm-modal__label">
                  Dia de vencimento <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ccm-due-day"
                  type="number"
                  min={1}
                  max={28}
                  className={`ccm-modal__input${errors.dueDay ? ' ccm-modal__input--error' : ''}`}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(dueDay);
                    if (!val || val < 1 || val > 28) {
                      setErrors((p) => ({ ...p, dueDay: 'Dia deve ser entre 1 e 28' }));
                    } else {
                      setErrors((p) => ({ ...p, dueDay: undefined }));
                    }
                  }}
                  aria-required="true"
                  placeholder="1–28"
                />
                {errors.dueDay && (
                  <span className="ccm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.dueDay}
                  </span>
                )}
              </div>
            </div>

            {/* Conta de débito */}
            <div className="ccm-modal__field">
              <label htmlFor="ccm-debit-account" className="ccm-modal__label">
                Conta de débito <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="ccm-debit-account"
                className={`ccm-modal__input${errors.debitAccountId ? ' ccm-modal__input--error' : ''}`}
                value={debitAccountId}
                onChange={(e) => setDebitAccountId(e.target.value)}
                onBlur={() => {
                  if (!debitAccountId)
                    setErrors((p) => ({ ...p, debitAccountId: 'Conta de débito é obrigatória' }));
                  else setErrors((p) => ({ ...p, debitAccountId: undefined }));
                }}
                aria-required="true"
              >
                <option value="">Selecione a conta</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {errors.debitAccountId && (
                <span className="ccm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.debitAccountId}
                </span>
              )}
            </div>

            {/* Fazenda */}
            <div className="ccm-modal__field">
              <label htmlFor="ccm-farm" className="ccm-modal__label">
                Fazenda <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="ccm-farm"
                className={`ccm-modal__input${errors.farmId ? ' ccm-modal__input--error' : ''}`}
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
                onBlur={() => {
                  if (!farmId) setErrors((p) => ({ ...p, farmId: 'Fazenda é obrigatória' }));
                  else setErrors((p) => ({ ...p, farmId: undefined }));
                }}
                aria-required="true"
              >
                <option value="">Selecione a fazenda</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {errors.farmId && (
                <span className="ccm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.farmId}
                </span>
              )}
            </div>

            {/* Observações */}
            <div className="ccm-modal__field">
              <label htmlFor="ccm-notes" className="ccm-modal__label">
                Observações
              </label>
              <textarea
                id="ccm-notes"
                className="ccm-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais sobre o cartão..."
              />
            </div>
          </div>

          <footer className="ccm-modal__footer">
            <button type="button" className="ccm-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="ccm-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar cartão'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreditCardModal;
