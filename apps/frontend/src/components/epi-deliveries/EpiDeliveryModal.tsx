import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Upload } from 'lucide-react';
import { useEpiDeliveries } from '@/hooks/useEpiDeliveries';
import { useEpiProducts } from '@/hooks/useEpiProducts';
import { useEmployees } from '@/hooks/useEmployees';
import type { EpiProduct } from '@/types/epi';
import { DELIVERY_REASON_LABELS } from '@/types/epi';
import './EpiDeliveryModal.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  prefilledEpiProduct?: EpiProduct | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  employeeId: string;
  epiProductId: string;
  date: string;
  quantity: string;
  reason: string;
  signatureUrl: string;
  observations: string;
}

interface FormErrors {
  employeeId?: string;
  epiProductId?: string;
  date?: string;
  quantity?: string;
  reason?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const REASONS = ['NOVO', 'TROCA', 'DANIFICADO', 'EXTRAVIO'] as const;

export default function EpiDeliveryModal({ isOpen, prefilledEpiProduct, onClose, onSuccess }: Props) {
  const { createEpiDelivery } = useEpiDeliveries();
  const { epiProducts, fetchEpiProducts } = useEpiProducts();
  const { employees, isLoading: employeesLoading } = useEmployees({ limit: 200 });

  const [form, setForm] = useState<FormState>({
    employeeId: '',
    epiProductId: prefilledEpiProduct?.id ?? '',
    date: new Date().toISOString().split('T')[0],
    quantity: '1',
    reason: 'NOVO',
    signatureUrl: '',
    observations: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchEpiProducts({ limit: 200 });
      setForm({
        employeeId: '',
        epiProductId: prefilledEpiProduct?.id ?? '',
        date: new Date().toISOString().split('T')[0],
        quantity: '1',
        reason: 'NOVO',
        signatureUrl: '',
        observations: '',
      });
      setErrors({});
      setSaveError(null);
      setSignaturePreview(null);
    }
  }, [isOpen, prefilledEpiProduct, fetchEpiProducts]);

  if (!isOpen) return null;

  // ─── Validation ─────────────────────────────────────────────────────────

  function validateField(name: keyof FormState, value: string): string | undefined {
    if (name === 'employeeId' && !value) return 'Selecione um colaborador.';
    if (name === 'epiProductId' && !value) return 'Selecione um EPI.';
    if (name === 'date') {
      if (!value) return 'Data é obrigatória.';
      const selected = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selected > today) return 'A data não pode ser no futuro.';
    }
    if (name === 'quantity') {
      const qty = Number(value);
      if (!value || isNaN(qty) || qty < 1) return 'Quantidade mínima é 1.';
    }
    if (name === 'reason' && !value) return 'Selecione o motivo.';
    return undefined;
  }

  function validateAll(): boolean {
    const newErrors: FormErrors = {};
    (['employeeId', 'epiProductId', 'date', 'quantity', 'reason'] as (keyof FormErrors)[]).forEach(
      (field) => {
        const err = validateField(field, form[field]);
        if (err) newErrors[field] = err;
      },
    );
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleBlur(name: keyof FormState) {
    const err = validateField(name, form[name]);
    setErrors((prev) => ({ ...prev, [name]: err }));
  }

  // ─── Signature Upload ────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowed.includes(file.type)) {
      setSaveError('Formato não suportado. Use JPEG, PNG ou WebP até 5MB.');
      return;
    }
    if (file.size > maxSize) {
      setSaveError('Arquivo muito grande. Use até 5MB.');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      setSignaturePreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);

    // In a real implementation, upload the file and get back a URL
    // For now, store the local object URL as placeholder
    const url = URL.createObjectURL(file);
    setForm((f) => ({ ...f, signatureUrl: url }));
    setSaveError(null);
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;

    setSaving(true);
    setSaveError(null);
    try {
      await createEpiDelivery({
        employeeId: form.employeeId,
        epiProductId: form.epiProductId,
        date: form.date,
        quantity: Number(form.quantity),
        reason: form.reason,
        signatureUrl: form.signatureUrl || undefined,
        observations: form.observations || undefined,
      });
      onSuccess('Entrega registrada. Estoque atualizado automaticamente.');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes('INSUFFICIENT_STOCK') || errorMsg.includes('insufficient')) {
        setSaveError('Estoque insuficiente para este EPI.');
      } else {
        setSaveError('Não foi possível salvar. Verifique os dados e tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="epi-delivery-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar Entrega de EPI"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="epi-delivery-modal">
        {/* Header */}
        <div className="epi-delivery-modal__header">
          <h2 className="epi-delivery-modal__title">Registrar Entrega de EPI</h2>
          <button
            type="button"
            className="epi-delivery-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form
          className="epi-delivery-modal__body"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          {saveError && (
            <div className="epi-delivery-modal__error-banner" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {saveError}
            </div>
          )}

          {/* Employee */}
          <div className="epi-delivery-modal__field">
            <label htmlFor="delivery-employee" className="epi-delivery-modal__label">
              Colaborador <span aria-label="obrigatório">*</span>
            </label>
            <select
              id="delivery-employee"
              className={`epi-delivery-modal__input${errors.employeeId ? ' epi-delivery-modal__input--error' : ''}`}
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              onBlur={() => handleBlur('employeeId')}
              aria-required="true"
              aria-describedby={errors.employeeId ? 'delivery-employee-error' : undefined}
              disabled={employeesLoading}
            >
              <option value="">Selecione o colaborador...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {errors.employeeId && (
              <span id="delivery-employee-error" className="epi-delivery-modal__field-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {errors.employeeId}
              </span>
            )}
          </div>

          {/* EPI Product */}
          <div className="epi-delivery-modal__field">
            <label htmlFor="delivery-epi" className="epi-delivery-modal__label">
              EPI <span aria-label="obrigatório">*</span>
            </label>
            <select
              id="delivery-epi"
              className={`epi-delivery-modal__input${errors.epiProductId ? ' epi-delivery-modal__input--error' : ''}`}
              value={form.epiProductId}
              onChange={(e) => setForm((f) => ({ ...f, epiProductId: e.target.value }))}
              onBlur={() => handleBlur('epiProductId')}
              aria-required="true"
              aria-describedby={errors.epiProductId ? 'delivery-epi-error' : undefined}
            >
              <option value="">Selecione o EPI...</option>
              {epiProducts?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName} (CA {p.caNumber}) — Estoque: {p.currentStock}
                </option>
              ))}
            </select>
            {errors.epiProductId && (
              <span id="delivery-epi-error" className="epi-delivery-modal__field-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {errors.epiProductId}
              </span>
            )}
          </div>

          {/* Date + Quantity row */}
          <div className="epi-delivery-modal__row">
            <div className="epi-delivery-modal__field">
              <label htmlFor="delivery-date" className="epi-delivery-modal__label">
                Data <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="delivery-date"
                type="date"
                className={`epi-delivery-modal__input${errors.date ? ' epi-delivery-modal__input--error' : ''}`}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                onBlur={() => handleBlur('date')}
                aria-required="true"
                aria-describedby={errors.date ? 'delivery-date-error' : undefined}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.date && (
                <span id="delivery-date-error" className="epi-delivery-modal__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.date}
                </span>
              )}
            </div>

            <div className="epi-delivery-modal__field">
              <label htmlFor="delivery-quantity" className="epi-delivery-modal__label">
                Quantidade <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="delivery-quantity"
                type="number"
                className={`epi-delivery-modal__input${errors.quantity ? ' epi-delivery-modal__input--error' : ''}`}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                onBlur={() => handleBlur('quantity')}
                aria-required="true"
                min={1}
                aria-describedby={errors.quantity ? 'delivery-quantity-error' : undefined}
              />
              {errors.quantity && (
                <span id="delivery-quantity-error" className="epi-delivery-modal__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.quantity}
                </span>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="epi-delivery-modal__field">
            <label htmlFor="delivery-reason" className="epi-delivery-modal__label">
              Motivo <span aria-label="obrigatório">*</span>
            </label>
            <select
              id="delivery-reason"
              className={`epi-delivery-modal__input${errors.reason ? ' epi-delivery-modal__input--error' : ''}`}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              onBlur={() => handleBlur('reason')}
              aria-required="true"
              aria-describedby={errors.reason ? 'delivery-reason-error' : undefined}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{DELIVERY_REASON_LABELS[r]}</option>
              ))}
            </select>
            {errors.reason && (
              <span id="delivery-reason-error" className="epi-delivery-modal__field-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {errors.reason}
              </span>
            )}
          </div>

          {/* Signature Upload */}
          <div className="epi-delivery-modal__field">
            <span className="epi-delivery-modal__label">
              Assinatura do colaborador (foto ou digitalização)
            </span>
            <div className="epi-delivery-modal__signature-area">
              {signaturePreview && (
                <img
                  src={signaturePreview}
                  alt="Prévia da assinatura"
                  className="epi-delivery-modal__signature-preview"
                />
              )}
              <button
                type="button"
                className="epi-delivery-modal__btn-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                {signaturePreview ? 'Trocar imagem' : 'Enviar imagem'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="epi-delivery-modal__file-input"
                aria-label="Upload de assinatura"
              />
            </div>
          </div>

          {/* Observations */}
          <div className="epi-delivery-modal__field">
            <label htmlFor="delivery-observations" className="epi-delivery-modal__label">
              Observações
            </label>
            <textarea
              id="delivery-observations"
              className="epi-delivery-modal__textarea"
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
              rows={3}
              placeholder="Observações opcionais..."
            />
          </div>

          {/* Footer */}
          <div className="epi-delivery-modal__footer">
            <button
              type="button"
              className="epi-delivery-modal__btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="epi-delivery-modal__btn-save"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Registrando...' : 'Registrar Entrega'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
