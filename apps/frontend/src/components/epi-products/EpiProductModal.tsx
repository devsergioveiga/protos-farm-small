import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useEpiProducts } from '@/hooks/useEpiProducts';
import type { EpiProduct, CreateEpiProductInput, UpdateEpiProductInput } from '@/types/epi';
import { EPI_TYPES, EPI_TYPE_LABELS } from '@/types/epi';
import './EpiProductModal.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  product: EpiProduct | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  caNumber: string;
  caExpiry: string;
  epiType: string;
}

interface FormErrors {
  caNumber?: string;
  epiType?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EpiProductModal({ isOpen, product, onClose, onSuccess }: Props) {
  const isEdit = product !== null;
  const { createEpiProduct, updateEpiProduct } = useEpiProducts();

  const [form, setForm] = useState<FormState>({
    caNumber: '',
    caExpiry: '',
    epiType: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setForm({
          caNumber: product.caNumber,
          caExpiry: product.caExpiry ? product.caExpiry.split('T')[0] : '',
          epiType: product.epiType,
        });
      } else {
        setForm({ caNumber: '', caExpiry: '', epiType: '' });
      }
      setErrors({});
      setSaveError(null);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  // ─── Validation ─────────────────────────────────────────────────────────

  function validateField(name: keyof FormState, value: string): string | undefined {
    if (name === 'caNumber') {
      const digits = value.replace(/\D/g, '');
      if (!value.trim()) return 'Número CA é obrigatório.';
      if (!/^\d{5,6}$/.test(digits)) return 'Número CA deve ter 5 ou 6 dígitos.';
    }
    if (name === 'epiType') {
      if (!value) return 'Tipo de EPI é obrigatório.';
    }
    return undefined;
  }

  function validateAll(): boolean {
    const newErrors: FormErrors = {};
    const caError = validateField('caNumber', form.caNumber);
    if (caError) newErrors.caNumber = caError;
    const typeError = validateField('epiType', form.epiType);
    if (typeError) newErrors.epiType = typeError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleBlur(name: keyof FormState) {
    const err = validateField(name, form[name]);
    setErrors((prev) => ({ ...prev, [name]: err }));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit && product) {
        const input: UpdateEpiProductInput = {
          caNumber: form.caNumber,
          caExpiry: form.caExpiry || null,
          epiType: form.epiType,
        };
        await updateEpiProduct(product.id, input);
        onSuccess('EPI atualizado com sucesso.');
      } else {
        const input: CreateEpiProductInput = {
          productId: '', // Will be set by product picker — placeholder for now
          caNumber: form.caNumber,
          caExpiry: form.caExpiry || undefined,
          epiType: form.epiType,
        };
        await createEpiProduct(input);
        onSuccess('EPI cadastrado com sucesso.');
      }
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar. Verifique os dados e tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="epi-product-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Editar EPI' : 'Novo EPI'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="epi-product-modal">
        {/* Header */}
        <div className="epi-product-modal__header">
          <h2 className="epi-product-modal__title">{isEdit ? 'Editar EPI' : 'Novo EPI'}</h2>
          <button
            type="button"
            className="epi-product-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form className="epi-product-modal__body" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Save Error */}
          {saveError && (
            <div className="epi-product-modal__error-banner" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {saveError}
            </div>
          )}

          {/* CA Number */}
          <div className="epi-product-modal__field">
            <label htmlFor="epi-ca-number" className="epi-product-modal__label">
              Número CA <span aria-label="obrigatório">*</span>
            </label>
            <input
              id="epi-ca-number"
              type="text"
              className={`epi-product-modal__input${errors.caNumber ? ' epi-product-modal__input--error' : ''}`}
              value={form.caNumber}
              onChange={(e) => setForm((f) => ({ ...f, caNumber: e.target.value }))}
              onBlur={() => handleBlur('caNumber')}
              aria-required="true"
              aria-describedby={errors.caNumber ? 'epi-ca-number-error' : undefined}
              placeholder="Ex.: 12345"
              inputMode="numeric"
              maxLength={6}
            />
            {errors.caNumber && (
              <span
                id="epi-ca-number-error"
                className="epi-product-modal__field-error"
                role="alert"
              >
                <AlertCircle size={14} aria-hidden="true" />
                {errors.caNumber}
              </span>
            )}
          </div>

          {/* EPI Type */}
          <div className="epi-product-modal__field">
            <label htmlFor="epi-type" className="epi-product-modal__label">
              Tipo de EPI <span aria-label="obrigatório">*</span>
            </label>
            <select
              id="epi-type"
              className={`epi-product-modal__input${errors.epiType ? ' epi-product-modal__input--error' : ''}`}
              value={form.epiType}
              onChange={(e) => setForm((f) => ({ ...f, epiType: e.target.value }))}
              onBlur={() => handleBlur('epiType')}
              aria-required="true"
              aria-describedby={errors.epiType ? 'epi-type-error' : undefined}
            >
              <option value="">Selecione o tipo...</option>
              {EPI_TYPES.map((t) => (
                <option key={t} value={t}>{EPI_TYPE_LABELS[t]}</option>
              ))}
            </select>
            {errors.epiType && (
              <span
                id="epi-type-error"
                className="epi-product-modal__field-error"
                role="alert"
              >
                <AlertCircle size={14} aria-hidden="true" />
                {errors.epiType}
              </span>
            )}
          </div>

          {/* CA Expiry */}
          <div className="epi-product-modal__field">
            <label htmlFor="epi-ca-expiry" className="epi-product-modal__label">
              Validade do CA
            </label>
            <input
              id="epi-ca-expiry"
              type="date"
              className="epi-product-modal__input"
              value={form.caExpiry}
              onChange={(e) => setForm((f) => ({ ...f, caExpiry: e.target.value }))}
            />
          </div>

          {/* Footer */}
          <div className="epi-product-modal__footer">
            <button
              type="button"
              className="epi-product-modal__btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="epi-product-modal__btn-save"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar EPI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
