import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ChartOfAccount, CreateAccountInput, AccountType, AccountNature } from '@/types/accounting';
import './CoaModal.css';

// ─── Props ────────────────────────────────────────────────────────────────

interface CoaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAccountInput) => Promise<void>;
  account?: ChartOfAccount;
  parentAccounts: ChartOfAccount[];
}

// ─── Initial form state ───────────────────────────────────────────────────

function getInitialForm(account?: ChartOfAccount): CreateAccountInput & { isActive?: boolean } {
  return {
    code: account?.code ?? '',
    name: account?.name ?? '',
    parentId: account?.parentId ?? undefined,
    accountType: account?.accountType ?? 'ATIVO',
    nature: account?.nature ?? 'DEVEDORA',
    isSynthetic: account?.isSynthetic ?? false,
    allowManualEntry: account?.allowManualEntry ?? true,
    isFairValueAdj: account?.isFairValueAdj ?? false,
    spedRefCode: account?.spedRefCode ?? '',
  };
}

// ─── Component ───────────────────────────────────────────────────────────

export default function CoaModal({ isOpen, onClose, onSubmit, account, parentAccounts }: CoaModalProps) {
  const isEdit = !!account;
  const [form, setForm] = useState(getInitialForm(account));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm(account));
      setErrors({});
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, account]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Validation
  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.code.trim()) newErrors.code = 'Código é obrigatório';
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    if (field === 'code' && !form.code.trim()) {
      setErrors((prev) => ({ ...prev, code: 'Código é obrigatório' }));
    }
    if (field === 'name' && !form.name.trim()) {
      setErrors((prev) => ({ ...prev, name: 'Nome é obrigatório' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload: CreateAccountInput = {
        code: form.code.trim(),
        name: form.name.trim(),
        accountType: form.accountType as AccountType,
        nature: form.nature as AccountNature,
        isSynthetic: form.isSynthetic,
        allowManualEntry: form.isSynthetic ? false : form.allowManualEntry,
        isFairValueAdj: form.isFairValueAdj,
      };
      if (form.parentId) payload.parentId = form.parentId;
      if (form.spedRefCode?.trim()) payload.spedRefCode = form.spedRefCode.trim();
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <div
      className="coa-modal__overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coa-modal-title"
    >
      <div className="coa-modal">
        {/* Header */}
        <div className="coa-modal__header">
          <h2 id="coa-modal-title" className="coa-modal__title">
            {isEdit ? 'Editar Conta' : 'Nova Conta'}
          </h2>
          <button
            type="button"
            className="coa-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form className="coa-modal__body" onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="coa-modal__row">
            {/* Code */}
            <div className="coa-modal__field">
              <label htmlFor="coa-code" className="coa-modal__label">
                Código <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstInputRef}
                id="coa-code"
                type="text"
                className={`coa-modal__input ${errors.code ? 'coa-modal__input--error' : ''}`}
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                onBlur={() => handleBlur('code')}
                aria-required="true"
                aria-describedby={errors.code ? 'coa-code-error' : undefined}
                placeholder="ex: 1.1.01"
              />
              {errors.code && (
                <span id="coa-code-error" role="alert" className="coa-modal__error">
                  {errors.code}
                </span>
              )}
            </div>

            {/* Account Type */}
            <div className="coa-modal__field">
              <label htmlFor="coa-type" className="coa-modal__label">
                Tipo <span aria-hidden="true">*</span>
              </label>
              <select
                id="coa-type"
                className="coa-modal__input"
                value={form.accountType}
                onChange={(e) => set('accountType', e.target.value as AccountType)}
                aria-required="true"
              >
                <option value="ATIVO">Ativo</option>
                <option value="PASSIVO">Passivo</option>
                <option value="PL">Patrimônio Líquido</option>
                <option value="RECEITA">Receita</option>
                <option value="DESPESA">Despesa</option>
              </select>
            </div>
          </div>

          {/* Name */}
          <div className="coa-modal__field">
            <label htmlFor="coa-name" className="coa-modal__label">
              Nome da Conta <span aria-hidden="true">*</span>
            </label>
            <input
              id="coa-name"
              type="text"
              className={`coa-modal__input ${errors.name ? 'coa-modal__input--error' : ''}`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              aria-required="true"
              aria-describedby={errors.name ? 'coa-name-error' : undefined}
              placeholder="ex: Caixa e Equivalentes de Caixa"
            />
            {errors.name && (
              <span id="coa-name-error" role="alert" className="coa-modal__error">
                {errors.name}
              </span>
            )}
          </div>

          <div className="coa-modal__row">
            {/* Parent Account */}
            <div className="coa-modal__field">
              <label htmlFor="coa-parent" className="coa-modal__label">Conta Pai</label>
              <select
                id="coa-parent"
                className="coa-modal__input"
                value={form.parentId ?? ''}
                onChange={(e) => set('parentId', e.target.value || undefined)}
              >
                <option value="">Sem conta pai (nível raiz)</option>
                {parentAccounts.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.code} — {pa.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Nature */}
            <div className="coa-modal__field">
              <label htmlFor="coa-nature" className="coa-modal__label">
                Natureza <span aria-hidden="true">*</span>
              </label>
              <select
                id="coa-nature"
                className="coa-modal__input"
                value={form.nature}
                onChange={(e) => set('nature', e.target.value as AccountNature)}
                aria-required="true"
              >
                <option value="DEVEDORA">Devedora</option>
                <option value="CREDORA">Credora</option>
              </select>
            </div>
          </div>

          {/* SPED Ref Code */}
          <div className="coa-modal__field">
            <label htmlFor="coa-sped" className="coa-modal__label">
              Código Referencial SPED L300R
            </label>
            <input
              id="coa-sped"
              type="text"
              className="coa-modal__input"
              value={form.spedRefCode ?? ''}
              onChange={(e) => set('spedRefCode', e.target.value)}
              placeholder="ex: 01.01.01.01.01.00-1"
            />
          </div>

          {/* Checkboxes */}
          <div className="coa-modal__checkboxes">
            <label className="coa-modal__checkbox-label">
              <input
                type="checkbox"
                className="coa-modal__checkbox"
                checked={form.isSynthetic ?? false}
                onChange={(e) => {
                  set('isSynthetic', e.target.checked);
                  if (e.target.checked) set('allowManualEntry', false);
                }}
              />
              Conta Sintética (grupo)
            </label>

            <label className={`coa-modal__checkbox-label ${form.isSynthetic ? 'coa-modal__checkbox-label--disabled' : ''}`}>
              <input
                type="checkbox"
                className="coa-modal__checkbox"
                checked={form.isSynthetic ? false : (form.allowManualEntry ?? true)}
                onChange={(e) => set('allowManualEntry', e.target.checked)}
                disabled={form.isSynthetic}
              />
              Permite Lançamento Manual
            </label>

            <label className="coa-modal__checkbox-label">
              <input
                type="checkbox"
                className="coa-modal__checkbox"
                checked={form.isFairValueAdj ?? false}
                onChange={(e) => set('isFairValueAdj', e.target.checked)}
              />
              Ajuste a Valor Justo CPC 29
            </label>
          </div>

          {/* Footer */}
          <div className="coa-modal__footer">
            <button
              type="button"
              className="coa-modal__btn coa-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="coa-modal__btn coa-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
