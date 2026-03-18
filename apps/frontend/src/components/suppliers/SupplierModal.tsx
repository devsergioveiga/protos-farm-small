import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, Files } from 'lucide-react';
import { useSupplierForm } from '@/hooks/useSupplierForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Supplier, SupplierCategory, SupplierType } from '@/types/supplier';
import {
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_STATUS_LABELS,
  PAYMENT_TERMS_SUGGESTIONS,
} from '@/types/supplier';
import { VALID_UF } from '@/constants/states';
import './SupplierModal.css';

// ─── Document formatting ─────────────────────────────────────────────

function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Form state ──────────────────────────────────────────────────────

interface FormState {
  type: SupplierType;
  name: string;
  tradeName: string;
  document: string;
  stateRegistration: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  paymentTerms: string;
  freightType: '' | 'CIF' | 'FOB';
  notes: string;
  status: Supplier['status'];
  categories: SupplierCategory[];
}

const INITIAL_STATE: FormState = {
  type: 'PJ',
  name: '',
  tradeName: '',
  document: '',
  stateRegistration: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  paymentTerms: '',
  freightType: '',
  notes: '',
  status: 'ACTIVE',
  categories: [],
};

function supplierToForm(supplier: Supplier): FormState {
  return {
    type: supplier.type,
    name: supplier.name,
    tradeName: supplier.tradeName ?? '',
    document: supplier.document,
    stateRegistration: supplier.stateRegistration ?? '',
    address: supplier.address ?? '',
    city: supplier.city ?? '',
    state: supplier.state ?? '',
    zipCode: supplier.zipCode ?? '',
    contactName: supplier.contactName ?? '',
    contactPhone: supplier.contactPhone ?? '',
    contactEmail: supplier.contactEmail ?? '',
    paymentTerms: supplier.paymentTerms ?? '',
    freightType: supplier.freightType ?? '',
    notes: supplier.notes ?? '',
    status: supplier.status,
    categories: supplier.categories,
  };
}

// ─── Props ───────────────────────────────────────────────────────────

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  supplier?: Supplier;
}

// ─── Field helpers ───────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="supplier-modal__field">
      <label htmlFor={id} className="supplier-modal__label">
        {label}
        {required && (
          <span className="supplier-modal__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="supplier-modal__field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function SupplierModal({
  isOpen,
  onClose,
  onSuccess,
  supplier,
}: SupplierModalProps) {
  const isEdit = !!supplier;
  const [form, setForm] = useState<FormState>(isEdit ? supplierToForm(supplier) : INITIAL_STATE);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Supplier['status'] | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevSupplier, setPrevSupplier] = useState(supplier);

  const {
    createSupplier,
    updateSupplier,
    isSubmitting,
    error: submitError,
  } = useSupplierForm(() => {
    const msg = isEdit ? 'Fornecedor atualizado com sucesso' : 'Fornecedor cadastrado com sucesso';
    onSuccess(msg);
  });

  // Reset form when modal opens or supplier changes (render-time derivation)
  if (isOpen !== prevIsOpen || supplier !== prevSupplier) {
    setPrevIsOpen(isOpen);
    setPrevSupplier(supplier);
    if (isOpen) {
      setForm(supplier ? supplierToForm(supplier) : INITIAL_STATE);
      setTouched({});
    }
  }

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => firstInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showBlockConfirm) onClose();
    },
    [isOpen, onClose, showBlockConfirm],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  // ─── Derived state ────────────────────────────────────────────────

  function getDocMask(val: string): string {
    return form.type === 'PJ' ? maskCnpj(val) : maskCpf(val);
  }

  function touch(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Validation ──────────────────────────────────────────────────

  const errors: Record<string, string> = {};

  if (!form.name.trim()) errors.name = 'Nome e obrigatorio';
  if (!form.document.trim()) {
    errors.document = form.type === 'PJ' ? 'CNPJ e obrigatorio' : 'CPF e obrigatorio';
  }
  if (form.categories.length === 0) errors.categories = 'Selecione ao menos uma categoria';
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
    errors.contactEmail = 'Email invalido';
  }

  function isValid(): boolean {
    return Object.keys(errors).length === 0;
  }

  // ─── Category toggle ─────────────────────────────────────────────

  function toggleCategory(cat: SupplierCategory) {
    setForm((prev) => {
      const has = prev.categories.includes(cat);
      return {
        ...prev,
        categories: has ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat],
      };
    });
    touch('categories');
  }

  // ─── Submit ──────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Touch all required fields
    setTouched({ name: true, document: true, categories: true, contactEmail: true });
    if (!isValid()) return;

    const payload = {
      type: form.type,
      name: form.name.trim(),
      tradeName: form.tradeName.trim() || undefined,
      document: form.document.replace(/\D/g, ''),
      stateRegistration: form.stateRegistration.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state || undefined,
      zipCode: form.zipCode.replace(/\D/g, '') || undefined,
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.replace(/\D/g, '') || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      freightType: form.freightType || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
      categories: form.categories,
    };

    if (isEdit && supplier) {
      void updateSupplier(supplier.id, payload);
    } else {
      void createSupplier(payload);
    }
  }

  // ─── Status change ───────────────────────────────────────────────

  function handleStatusChange(newStatus: Supplier['status']) {
    if (newStatus === 'BLOCKED') {
      setPendingStatus(newStatus);
      setShowBlockConfirm(true);
    } else {
      set('status', newStatus);
    }
  }

  const categoryOptions = Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][];

  return (
    <>
      {/* Overlay */}
      <div
        className="supplier-modal__overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
      >
        <div className="supplier-modal">
          {/* Header */}
          <div className="supplier-modal__header">
            <h2 id="supplier-modal-title" className="supplier-modal__title">
              {isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </h2>
            <button
              type="button"
              className="supplier-modal__close"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Form body */}
          <form
            id="supplier-form"
            className="supplier-modal__body"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Submit error */}
            {submitError && (
              <div className="supplier-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Section 1: Tipo */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">TIPO DE CADASTRO</span>
              <div
                className="supplier-modal__type-toggle"
                role="radiogroup"
                aria-label="Tipo de fornecedor"
              >
                <button
                  type="button"
                  className={`supplier-modal__type-btn ${form.type === 'PJ' ? 'supplier-modal__type-btn--active' : ''}`}
                  role="radio"
                  aria-checked={form.type === 'PJ'}
                  onClick={() => set('type', 'PJ')}
                >
                  Pessoa Juridica (PJ)
                </button>
                <button
                  type="button"
                  className={`supplier-modal__type-btn ${form.type === 'PF' ? 'supplier-modal__type-btn--active' : ''}`}
                  role="radio"
                  aria-checked={form.type === 'PF'}
                  onClick={() => set('type', 'PF')}
                >
                  Pessoa Fisica (PF)
                </button>
              </div>
            </div>

            {/* Section 2: Dados Fiscais */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">DADOS FISCAIS</span>
              <div className="supplier-modal__grid">
                <Field
                  id="supplier-name"
                  label={form.type === 'PJ' ? 'Razao Social' : 'Nome'}
                  required
                  error={touched.name ? errors.name : undefined}
                >
                  <input
                    ref={firstInputRef}
                    id="supplier-name"
                    type="text"
                    className={`supplier-modal__input ${touched.name && errors.name ? 'supplier-modal__input--error' : ''}`}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    onBlur={() => touch('name')}
                    aria-required="true"
                    aria-invalid={!!(touched.name && errors.name)}
                    aria-describedby={
                      touched.name && errors.name ? 'supplier-name-error' : undefined
                    }
                    autoComplete="organization"
                  />
                </Field>

                <Field
                  id="supplier-document"
                  label={form.type === 'PJ' ? 'CNPJ' : 'CPF'}
                  required
                  error={touched.document ? errors.document : undefined}
                >
                  <input
                    id="supplier-document"
                    type="text"
                    inputMode="numeric"
                    className={`supplier-modal__input supplier-modal__input--mono ${touched.document && errors.document ? 'supplier-modal__input--error' : ''}`}
                    value={form.document}
                    onChange={(e) => set('document', getDocMask(e.target.value))}
                    onBlur={() => touch('document')}
                    placeholder={form.type === 'PJ' ? 'XX.XXX.XXX/XXXX-XX' : 'XXX.XXX.XXX-XX'}
                    aria-required="true"
                    aria-invalid={!!(touched.document && errors.document)}
                    aria-describedby={
                      touched.document && errors.document ? 'supplier-document-error' : undefined
                    }
                    maxLength={form.type === 'PJ' ? 18 : 14}
                  />
                </Field>

                {form.type === 'PJ' && (
                  <Field id="supplier-trade-name" label="Nome Fantasia">
                    <input
                      id="supplier-trade-name"
                      type="text"
                      className="supplier-modal__input"
                      value={form.tradeName}
                      onChange={(e) => set('tradeName', e.target.value)}
                    />
                  </Field>
                )}

                {form.type === 'PJ' && (
                  <Field id="supplier-ie" label="Inscricao Estadual">
                    <input
                      id="supplier-ie"
                      type="text"
                      className="supplier-modal__input"
                      value={form.stateRegistration}
                      onChange={(e) => set('stateRegistration', e.target.value)}
                    />
                  </Field>
                )}
              </div>
            </div>

            {/* Section 3: Endereco */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">ENDERECO</span>
              <div className="supplier-modal__grid">
                <div className="supplier-modal__grid-full">
                  <Field id="supplier-address" label="Logradouro">
                    <input
                      id="supplier-address"
                      type="text"
                      className="supplier-modal__input"
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      autoComplete="street-address"
                    />
                  </Field>
                </div>

                <Field id="supplier-city" label="Cidade">
                  <input
                    id="supplier-city"
                    type="text"
                    className="supplier-modal__input"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    autoComplete="address-level2"
                  />
                </Field>

                <Field id="supplier-state" label="UF">
                  <select
                    id="supplier-state"
                    className="supplier-modal__select"
                    value={form.state}
                    onChange={(e) => set('state', e.target.value)}
                    aria-label="Estado"
                  >
                    <option value="">Selecione</option>
                    {VALID_UF.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="supplier-zip" label="CEP">
                  <input
                    id="supplier-zip"
                    type="text"
                    inputMode="numeric"
                    className="supplier-modal__input supplier-modal__input--mono"
                    value={form.zipCode}
                    onChange={(e) => set('zipCode', maskCep(e.target.value))}
                    placeholder="00000-000"
                    maxLength={9}
                    autoComplete="postal-code"
                  />
                </Field>
              </div>
            </div>

            {/* Section 4: Dados Comerciais */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">DADOS COMERCIAIS</span>
              <div className="supplier-modal__grid">
                <Field id="supplier-contact-name" label="Nome do Contato">
                  <input
                    id="supplier-contact-name"
                    type="text"
                    className="supplier-modal__input"
                    value={form.contactName}
                    onChange={(e) => set('contactName', e.target.value)}
                    autoComplete="name"
                  />
                </Field>

                <Field id="supplier-contact-phone" label="Telefone">
                  <input
                    id="supplier-contact-phone"
                    type="tel"
                    className="supplier-modal__input supplier-modal__input--mono"
                    value={form.contactPhone}
                    onChange={(e) => set('contactPhone', maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={16}
                    autoComplete="tel"
                  />
                </Field>

                <Field
                  id="supplier-contact-email"
                  label="Email"
                  error={touched.contactEmail ? errors.contactEmail : undefined}
                >
                  <input
                    id="supplier-contact-email"
                    type="email"
                    className={`supplier-modal__input ${touched.contactEmail && errors.contactEmail ? 'supplier-modal__input--error' : ''}`}
                    value={form.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                    onBlur={() => touch('contactEmail')}
                    autoComplete="email"
                    aria-invalid={!!(touched.contactEmail && errors.contactEmail)}
                    aria-describedby={
                      touched.contactEmail && errors.contactEmail
                        ? 'supplier-contact-email-error'
                        : undefined
                    }
                  />
                </Field>

                <Field id="supplier-payment-terms" label="Prazo de Pagamento">
                  <input
                    id="supplier-payment-terms"
                    type="text"
                    className="supplier-modal__input"
                    list="payment-terms-list"
                    value={form.paymentTerms}
                    onChange={(e) => set('paymentTerms', e.target.value)}
                    placeholder="Ex: 30 dias"
                    autoComplete="off"
                  />
                  <datalist id="payment-terms-list">
                    {PAYMENT_TERMS_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>

                <Field id="supplier-freight-type" label="Tipo de Frete">
                  <select
                    id="supplier-freight-type"
                    className="supplier-modal__select"
                    value={form.freightType}
                    onChange={(e) => set('freightType', e.target.value as FormState['freightType'])}
                  >
                    <option value="">Selecione</option>
                    <option value="CIF">CIF (por conta do fornecedor)</option>
                    <option value="FOB">FOB (por conta do comprador)</option>
                  </select>
                </Field>

                {/* Status — edit mode only */}
                {isEdit && (
                  <Field id="supplier-status" label="Status">
                    <select
                      id="supplier-status"
                      className="supplier-modal__select"
                      value={form.status}
                      onChange={(e) => handleStatusChange(e.target.value as Supplier['status'])}
                    >
                      {(
                        Object.entries(SUPPLIER_STATUS_LABELS) as [Supplier['status'], string][]
                      ).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>

            {/* Section 5: Categorias */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">
                CATEGORIAS <span className="supplier-modal__required">*</span>
              </span>
              <div
                className="supplier-modal__categories"
                role="group"
                aria-label="Categorias do fornecedor"
              >
                {categoryOptions.map(([cat, label]) => {
                  const selected = form.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`supplier-modal__category-chip ${selected ? 'supplier-modal__category-chip--selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => toggleCategory(cat)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {touched.categories && errors.categories && (
                <span className="supplier-modal__field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.categories}
                </span>
              )}
            </div>

            {/* Section 6: Anexos */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">DOCUMENTOS E ANEXOS</span>
              <div
                className="supplier-modal__upload-zone"
                aria-label="Zona de upload de documentos"
              >
                <Files size={48} aria-hidden="true" className="supplier-modal__upload-icon" />
                <p className="supplier-modal__upload-text">Arraste arquivos aqui para anexar</p>
                <p className="supplier-modal__upload-note">Funcionalidade em desenvolvimento</p>
              </div>
            </div>

            {/* Section 7: Observacoes */}
            <div className="supplier-modal__section">
              <span className="supplier-modal__section-label">OBSERVACOES</span>
              <div className="supplier-modal__field">
                <label htmlFor="supplier-notes" className="supplier-modal__label">
                  Informacoes adicionais
                </label>
                <textarea
                  id="supplier-notes"
                  className="supplier-modal__textarea"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Informacoes adicionais sobre o fornecedor"
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="supplier-modal__footer">
            <button
              type="button"
              className="supplier-modal__btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="supplier-form"
              className="supplier-modal__btn-save"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Block confirm */}
      <ConfirmModal
        isOpen={showBlockConfirm}
        title="Bloquear fornecedor?"
        message="Fornecedor bloqueado nao aparecera na selecao ao criar cotacoes."
        confirmLabel="Bloquear fornecedor"
        variant="warning"
        onConfirm={() => {
          if (pendingStatus) set('status', pendingStatus);
          setPendingStatus(null);
          setShowBlockConfirm(false);
        }}
        onCancel={() => {
          setPendingStatus(null);
          setShowBlockConfirm(false);
        }}
      />
    </>
  );
}
