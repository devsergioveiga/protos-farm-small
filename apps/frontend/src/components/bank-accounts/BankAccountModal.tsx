import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, Building2 } from 'lucide-react';
import { FEBRABAN_BANKS } from '@protos-farm/shared';
import { api } from '@/services/api';
import type { BankAccount, BankAccountType } from '@/hooks/useBankAccounts';
import './BankAccountModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface FarmOption {
  id: string;
  name: string;
}

interface ProducerOption {
  id: string;
  name: string;
}

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountId?: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  initialBalance?: string;
}

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
  RURAL_CREDIT: 'Crédito rural',
};

function parseBRL(value: string): string {
  return value.replace(/[^\d,]/g, '').replace(',', '.');
}

// ─── Component ───────────────────────────────────────────────────────

const BankAccountModal = ({ isOpen, onClose, onSuccess, accountId }: BankAccountModalProps) => {
  const isEditMode = Boolean(accountId);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<BankAccountType | ''>('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [agency, setAgency] = useState('');
  const [agencyDigit, setAgencyDigit] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDigit, setAccountDigit] = useState('');
  const [initialBalanceDisplay, setInitialBalanceDisplay] = useState('');
  const [producerId, setProducerId] = useState('');
  const [farmIds, setFarmIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // Options
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [producers, setProducers] = useState<ProducerOption[]>([]);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Load farms and producers
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<{ data: FarmOption[] }>('/org/farms?limit=100')
      .then((r) => setFarms(r.data))
      .catch(() => {});
    void api
      .get<{ data: ProducerOption[] }>('/org/producers?limit=100')
      .then((r) => setProducers(r.data))
      .catch(() => {});
  }, [isOpen]);

  // Load account for edit mode
  useEffect(() => {
    if (!isOpen || !accountId) return;
    void api
      .get<BankAccount>(`/org/bank-accounts/${accountId}`)
      .then((acc) => {
        setName(acc.name);
        setType(acc.type);
        setBankCode(acc.bankCode);
        const bank = FEBRABAN_BANKS.find((b) => b.code === acc.bankCode);
        setBankSearch(bank ? `${bank.shortName} (${bank.code})` : acc.bankCode);
        setAgency(acc.agency);
        setAgencyDigit(acc.agencyDigit ?? '');
        setAccountNumber(acc.accountNumber);
        setAccountDigit(acc.accountDigit ?? '');
        setInitialBalanceDisplay(
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            acc.balance.initialBalance,
          ),
        );
        setProducerId(acc.producerId ?? '');
        setFarmIds(acc.farms.map((f) => f.id));
        setNotes(acc.notes ?? '');
      })
      .catch(() => {});
  }, [isOpen, accountId]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setType('');
      setBankSearch('');
      setBankCode('');
      setAgency('');
      setAgencyDigit('');
      setAccountNumber('');
      setAccountDigit('');
      setInitialBalanceDisplay('');
      setProducerId('');
      setFarmIds([]);
      setNotes('');
      setErrors({});
      setSubmitError(null);
      setShowBankDropdown(false);
    }
  }, [isOpen]);

  // Focus first field
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close bank dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setShowBankDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filteredBanks = FEBRABAN_BANKS.filter((b) => {
    const q = bankSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.code.includes(q)
    );
  }).slice(0, 20);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Nome da conta é obrigatório';
    if (!type) newErrors.type = 'Tipo é obrigatório';
    if (!bankCode) newErrors.bankCode = 'Banco é obrigatório';
    if (!agency.trim()) newErrors.agency = 'Agência é obrigatória';
    if (!accountNumber.trim()) newErrors.accountNumber = 'Número da conta é obrigatório';
    const rawBalance = parseBRL(initialBalanceDisplay);
    if (!rawBalance || isNaN(parseFloat(rawBalance))) {
      newErrors.initialBalance = 'Saldo inicial é obrigatório';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const payload = {
        name: name.trim(),
        type,
        bankCode,
        agency: agency.trim(),
        agencyDigit: agencyDigit.trim() || undefined,
        accountNumber: accountNumber.trim(),
        accountDigit: accountDigit.trim() || undefined,
        initialBalance: parseFloat(parseBRL(initialBalanceDisplay)),
        producerId: producerId || undefined,
        farmIds: farmIds.length > 0 ? farmIds : undefined,
        notes: notes.trim() || undefined,
      };

      try {
        if (isEditMode && accountId) {
          await api.patch(`/org/bank-accounts/${accountId}`, payload);
        } else {
          await api.post('/org/bank-accounts', payload);
        }
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar';
        setSubmitError(`Não foi possível salvar a conta. ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      name,
      type,
      bankCode,
      agency,
      agencyDigit,
      accountNumber,
      accountDigit,
      initialBalanceDisplay,
      producerId,
      farmIds,
      notes,
      isEditMode,
      accountId,
      onSuccess,
    ],
  );

  const toggleFarm = (farmId: string) => {
    setFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId],
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="ba-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? 'Editar conta bancária' : 'Nova conta bancária'}
    >
      <div className="ba-modal__panel">
        <header className="ba-modal__header">
          <div className="ba-modal__header-icon" aria-hidden="true">
            <Building2 size={20} />
          </div>
          <h2 className="ba-modal__title">
            {isEditMode ? 'Editar conta bancária' : 'Nova conta bancária'}
          </h2>
          <button type="button" className="ba-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="ba-modal__body">
            {submitError && (
              <div className="ba-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Nome da conta */}
            <div className="ba-modal__field">
              <label htmlFor="ba-name" className="ba-modal__label">
                Nome da conta <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="ba-name"
                ref={firstFieldRef}
                type="text"
                className={`ba-modal__input ${errors.name ? 'ba-modal__input--error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim())
                    setErrors((p) => ({ ...p, name: 'Nome da conta é obrigatório' }));
                  else setErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.name ? 'ba-name-error' : undefined}
                placeholder="Ex: Conta Corrente BB Principal"
              />
              {errors.name && (
                <span id="ba-name-error" className="ba-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.name}
                </span>
              )}
            </div>

            {/* Tipo */}
            <div className="ba-modal__field">
              <label htmlFor="ba-type" className="ba-modal__label">
                Tipo <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="ba-type"
                className={`ba-modal__input ${errors.type ? 'ba-modal__input--error' : ''}`}
                value={type}
                onChange={(e) => setType(e.target.value as BankAccountType)}
                onBlur={() => {
                  if (!type) setErrors((p) => ({ ...p, type: 'Tipo é obrigatório' }));
                  else setErrors((p) => ({ ...p, type: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.type ? 'ba-type-error' : undefined}
              >
                <option value="">Selecione o tipo</option>
                {(Object.keys(ACCOUNT_TYPE_LABELS) as BankAccountType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {errors.type && (
                <span id="ba-type-error" className="ba-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.type}
                </span>
              )}
            </div>

            {/* Banco — searchable */}
            <div className="ba-modal__field">
              <label htmlFor="ba-bank-search" className="ba-modal__label">
                Banco <span aria-label="obrigatório">*</span>
              </label>
              <div className="ba-modal__bank-wrap" ref={bankDropdownRef}>
                <input
                  id="ba-bank-search"
                  type="text"
                  className={`ba-modal__input ${errors.bankCode ? 'ba-modal__input--error' : ''}`}
                  value={bankSearch}
                  onChange={(e) => {
                    setBankSearch(e.target.value);
                    setBankCode('');
                    setShowBankDropdown(true);
                  }}
                  onFocus={() => setShowBankDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowBankDropdown(false), 150);
                    if (!bankCode) setErrors((p) => ({ ...p, bankCode: 'Banco é obrigatório' }));
                    else setErrors((p) => ({ ...p, bankCode: undefined }));
                  }}
                  aria-required="true"
                  aria-describedby={errors.bankCode ? 'ba-bank-error' : undefined}
                  placeholder="Pesquisar banco pelo nome ou código..."
                  autoComplete="off"
                />
                {showBankDropdown && filteredBanks.length > 0 && (
                  <ul
                    className="ba-modal__bank-dropdown"
                    role="listbox"
                    aria-label="Bancos disponíveis"
                  >
                    {filteredBanks.map((b) => (
                      <li
                        key={b.code}
                        role="option"
                        aria-selected={bankCode === b.code}
                        className={`ba-modal__bank-option ${bankCode === b.code ? 'ba-modal__bank-option--selected' : ''}`}
                        onMouseDown={() => {
                          setBankCode(b.code);
                          setBankSearch(`${b.shortName} (${b.code})`);
                          setShowBankDropdown(false);
                          setErrors((p) => ({ ...p, bankCode: undefined }));
                        }}
                      >
                        <span className="ba-modal__bank-short">{b.shortName}</span>
                        <span className="ba-modal__bank-code">{b.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.bankCode && (
                <span id="ba-bank-error" className="ba-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.bankCode}
                </span>
              )}
            </div>

            {/* Agência + Dígito */}
            <div className="ba-modal__row">
              <div className="ba-modal__field ba-modal__field--grow">
                <label htmlFor="ba-agency" className="ba-modal__label">
                  Agência <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ba-agency"
                  type="text"
                  className={`ba-modal__input ${errors.agency ? 'ba-modal__input--error' : ''}`}
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  onBlur={() => {
                    if (!agency.trim())
                      setErrors((p) => ({ ...p, agency: 'Agência é obrigatória' }));
                    else setErrors((p) => ({ ...p, agency: undefined }));
                  }}
                  aria-required="true"
                  placeholder="1234"
                />
                {errors.agency && (
                  <span className="ba-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.agency}
                  </span>
                )}
              </div>
              <div className="ba-modal__field ba-modal__field--digit">
                <label htmlFor="ba-agency-digit" className="ba-modal__label">
                  Dígito
                </label>
                <input
                  id="ba-agency-digit"
                  type="text"
                  className="ba-modal__input"
                  value={agencyDigit}
                  onChange={(e) => setAgencyDigit(e.target.value)}
                  maxLength={2}
                  placeholder="X"
                />
              </div>
            </div>

            {/* Número da conta + Dígito */}
            <div className="ba-modal__row">
              <div className="ba-modal__field ba-modal__field--grow">
                <label htmlFor="ba-account" className="ba-modal__label">
                  Número da conta <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="ba-account"
                  type="text"
                  className={`ba-modal__input ${errors.accountNumber ? 'ba-modal__input--error' : ''}`}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  onBlur={() => {
                    if (!accountNumber.trim())
                      setErrors((p) => ({ ...p, accountNumber: 'Número da conta é obrigatório' }));
                    else setErrors((p) => ({ ...p, accountNumber: undefined }));
                  }}
                  aria-required="true"
                  placeholder="56789"
                />
                {errors.accountNumber && (
                  <span className="ba-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.accountNumber}
                  </span>
                )}
              </div>
              <div className="ba-modal__field ba-modal__field--digit">
                <label htmlFor="ba-account-digit" className="ba-modal__label">
                  Dígito
                </label>
                <input
                  id="ba-account-digit"
                  type="text"
                  className="ba-modal__input"
                  value={accountDigit}
                  onChange={(e) => setAccountDigit(e.target.value)}
                  maxLength={2}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Saldo inicial */}
            <div className="ba-modal__field">
              <label htmlFor="ba-balance" className="ba-modal__label">
                Saldo inicial <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="ba-balance"
                type="text"
                className={`ba-modal__input ba-modal__input--mono ${errors.initialBalance ? 'ba-modal__input--error' : ''}`}
                value={initialBalanceDisplay}
                onChange={(e) => setInitialBalanceDisplay(e.target.value)}
                onBlur={(e) => {
                  const raw = parseBRL(e.target.value);
                  const num = parseFloat(raw);
                  if (!isNaN(num)) {
                    setInitialBalanceDisplay(
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        num,
                      ),
                    );
                    setErrors((p) => ({ ...p, initialBalance: undefined }));
                  } else {
                    setErrors((p) => ({ ...p, initialBalance: 'Saldo inicial é obrigatório' }));
                  }
                }}
                aria-required="true"
                aria-describedby={errors.initialBalance ? 'ba-balance-error' : undefined}
                placeholder="R$ 0,00"
              />
              {errors.initialBalance && (
                <span id="ba-balance-error" className="ba-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.initialBalance}
                </span>
              )}
            </div>

            {/* Produtor rural */}
            <div className="ba-modal__field">
              <label htmlFor="ba-producer" className="ba-modal__label">
                Produtor rural
              </label>
              <select
                id="ba-producer"
                className="ba-modal__input"
                value={producerId}
                onChange={(e) => setProducerId(e.target.value)}
              >
                <option value="">Nenhum (conta da fazenda)</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fazendas */}
            {farms.length > 0 && (
              <div className="ba-modal__field">
                <fieldset className="ba-modal__fieldset">
                  <legend className="ba-modal__label">Fazendas vinculadas</legend>
                  <div className="ba-modal__farm-list">
                    {farms.map((farm) => (
                      <label key={farm.id} className="ba-modal__farm-option">
                        <input
                          type="checkbox"
                          checked={farmIds.includes(farm.id)}
                          onChange={() => toggleFarm(farm.id)}
                          className="ba-modal__checkbox"
                        />
                        <span>{farm.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {/* Observações */}
            <div className="ba-modal__field">
              <label htmlFor="ba-notes" className="ba-modal__label">
                Observações
              </label>
              <textarea
                id="ba-notes"
                className="ba-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informações adicionais sobre a conta..."
              />
            </div>
          </div>

          <footer className="ba-modal__footer">
            <button type="button" className="ba-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="ba-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditMode ? 'Salvar alterações' : 'Cadastrar conta'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default BankAccountModal;
