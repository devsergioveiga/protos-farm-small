import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { createEmergencyPO } from '@/hooks/usePurchaseOrders';
import './PurchaseOrderModal.css';

interface Supplier {
  id: string;
  name: string;
  tradeName: string | null;
  document: string;
}

interface ItemRow {
  productName: string;
  unitName: string;
  quantity: string;
  unitPrice: string;
}

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(raw: string): number {
  const cleaned = raw.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function PurchaseOrderForm({ onClose, onSuccess }: Omit<PurchaseOrderModalProps, 'isOpen'>) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [justification, setJustification] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [internalReference, setInternalReference] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { productName: '', unitName: '', quantity: '', unitPrice: '' },
  ]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Load suppliers
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingSuppliers(true);
      try {
        const result = await api.get<{ data: Supplier[] }>(
          '/org/suppliers?status=ACTIVE&limit=100',
        );
        if (!cancelled) setSuppliers(result.data);
      } catch {
        if (!cancelled) setSuppliers([]);
      } finally {
        if (!cancelled) setIsLoadingSuppliers(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function addItem() {
    setItems((prev) => [...prev, { productName: '', unitName: '', quantity: '', unitPrice: '' }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    // Clear item-level errors
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[`item_${index}_${field}`];
      return next;
    });
  }

  function computeItemTotal(item: ItemRow): number {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseBRL(item.unitPrice) || 0;
    return qty * price;
  }

  function computeGrandTotal(): number {
    return items.reduce((sum, item) => sum + computeItemTotal(item), 0);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!supplierId) errors.supplierId = 'Selecione um fornecedor';
    if (!justification.trim()) {
      errors.justification = 'A justificativa e obrigatoria';
    } else if (justification.trim().length < 10) {
      errors.justification = 'Justificativa deve ter pelo menos 10 caracteres';
    }

    let hasItemError = false;
    items.forEach((item, i) => {
      if (!item.productName.trim()) {
        errors[`item_${i}_productName`] = 'Informe o produto';
        hasItemError = true;
      }
      const qty = parseFloat(item.quantity);
      if (!qty || qty <= 0) {
        errors[`item_${i}_quantity`] = 'Quantidade invalida';
        hasItemError = true;
      }
      const price = parseBRL(item.unitPrice);
      if (!price || price <= 0) {
        errors[`item_${i}_unitPrice`] = 'Preco invalido';
        hasItemError = true;
      }
    });

    if (hasItemError) errors.items = 'Corrija os erros nos itens';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await createEmergencyPO({
        supplierId,
        justification: justification.trim(),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        internalReference: internalReference || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({
          productName: item.productName.trim(),
          unitName: item.unitName.trim() || 'un',
          quantity: parseFloat(item.quantity),
          unitPrice: parseBRL(item.unitPrice),
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido emergencial');
    } finally {
      setIsSubmitting(false);
    }
  }

  const grandTotal = computeGrandTotal();

  return (
    <div
      className="pom-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pom-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pom-modal">
        {/* Header */}
        <div className="pom-modal__header">
          <h2 id="pom-title" className="pom-modal__title">
            Pedido Emergencial
          </h2>
          <button
            type="button"
            className="pom-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Warning banner */}
        <div className="pom-warning">
          <AlertTriangle size={18} aria-hidden="true" className="pom-warning__icon" />
          <span>Pedidos emergenciais pulam o processo de cotacao. Justifique o motivo abaixo.</span>
        </div>

        {/* Body */}
        <form
          id="pom-form"
          className="pom-modal__body"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          {error && (
            <div className="pom-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Supplier */}
          <div className="pom-field">
            <label htmlFor="pom-supplier" className="pom-field__label">
              Fornecedor <span aria-hidden="true">*</span>
            </label>
            {isLoadingSuppliers ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <Loader2 size={16} className="pom-spin" aria-hidden="true" />
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-neutral-500)',
                  }}
                >
                  Carregando fornecedores...
                </span>
              </div>
            ) : (
              <select
                id="pom-supplier"
                ref={firstInputRef}
                className={`pom-select ${validationErrors.supplierId ? 'pom-select--error' : ''}`}
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setValidationErrors((prev) => ({ ...prev, supplierId: '' }));
                }}
                aria-required="true"
                aria-describedby={validationErrors.supplierId ? 'pom-supplier-error' : undefined}
              >
                <option value="">Selecione um fornecedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.tradeName ? ` (${s.tradeName})` : ''}
                    {' — '}
                    {s.document.slice(0, 8)}...
                  </option>
                ))}
              </select>
            )}
            {validationErrors.supplierId && (
              <span id="pom-supplier-error" className="pom-field__error" role="alert">
                <AlertCircle size={12} aria-hidden="true" />
                {validationErrors.supplierId}
              </span>
            )}
          </div>

          {/* Justification */}
          <div className="pom-field">
            <label htmlFor="pom-justification" className="pom-field__label">
              Justificativa <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="pom-justification"
              className={`pom-textarea ${validationErrors.justification ? 'pom-textarea--error' : ''}`}
              rows={3}
              placeholder="Explique por que este pedido nao pode passar por cotacao..."
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                setValidationErrors((prev) => ({ ...prev, justification: '' }));
              }}
              aria-required="true"
              aria-describedby={
                validationErrors.justification ? 'pom-just-error' : 'pom-just-helper'
              }
            />
            <span id="pom-just-helper" className="pom-field__helper">
              Explique por que este pedido nao pode passar por cotacao
            </span>
            {validationErrors.justification && (
              <span id="pom-just-error" className="pom-field__error" role="alert">
                <AlertCircle size={12} aria-hidden="true" />
                {validationErrors.justification}
              </span>
            )}
          </div>

          <div className="pom-row">
            {/* Expected Delivery Date */}
            <div className="pom-field">
              <label htmlFor="pom-delivery-date" className="pom-field__label">
                Previsao de Entrega
              </label>
              <input
                id="pom-delivery-date"
                type="date"
                className="pom-input"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            {/* Internal Reference */}
            <div className="pom-field">
              <label htmlFor="pom-internal-ref" className="pom-field__label">
                Referencia interna
              </label>
              <input
                id="pom-internal-ref"
                type="text"
                className="pom-input"
                placeholder="ex: REQ-2026-001"
                value={internalReference}
                onChange={(e) => setInternalReference(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="pom-field">
            <label htmlFor="pom-notes" className="pom-field__label">
              Observacoes
            </label>
            <textarea
              id="pom-notes"
              className="pom-textarea"
              rows={2}
              placeholder="Instrucoes adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Items */}
          <div className="pom-field">
            <p className="pom-section-title">Itens do Pedido</p>
            {validationErrors.items && (
              <span className="pom-field__error" role="alert">
                <AlertCircle size={12} aria-hidden="true" />
                {validationErrors.items}
              </span>
            )}

            <div className="pom-items">
              {/* Header row */}
              <div className="pom-item-row pom-item-row--header">
                <span>Produto *</span>
                <span>Unidade</span>
                <span>Qtd *</span>
                <span>Preco unit. *</span>
                <span>Total</span>
              </div>

              {items.map((item, index) => (
                <div key={index} className="pom-item-row">
                  <div>
                    <input
                      type="text"
                      className={`pom-item-input ${validationErrors[`item_${index}_productName`] ? 'pom-item-input--error' : ''}`}
                      placeholder="Nome do produto"
                      value={item.productName}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      aria-label={`Produto do item ${index + 1}`}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="pom-item-input"
                      placeholder="un, kg, L..."
                      value={item.unitName}
                      onChange={(e) => updateItem(index, 'unitName', e.target.value)}
                      aria-label={`Unidade do item ${index + 1}`}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      className={`pom-item-input ${validationErrors[`item_${index}_quantity`] ? 'pom-item-input--error' : ''}`}
                      placeholder="0"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      aria-label={`Quantidade do item ${index + 1}`}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className={`pom-item-input ${validationErrors[`item_${index}_unitPrice`] ? 'pom-item-input--error' : ''}`}
                      placeholder="R$ 0,00"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                      onBlur={(e) => {
                        const val = parseBRL(e.target.value);
                        if (val > 0) updateItem(index, 'unitPrice', formatBRL(val));
                      }}
                      aria-label={`Preco unitario do item ${index + 1}`}
                    />
                  </div>
                  <div className="pom-item-total">{formatBRL(computeItemTotal(item))}</div>
                  <button
                    type="button"
                    className="pom-remove-btn"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}

              <button type="button" className="pom-add-item-btn" onClick={addItem}>
                <Plus size={16} aria-hidden="true" />
                Adicionar item
              </button>

              {/* Grand total */}
              <div className="pom-grand-total">
                <span className="pom-grand-total__label">Total do pedido:</span>
                <span className="pom-grand-total__value">{formatBRL(grandTotal)}</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="pom-modal__footer">
          <button
            type="button"
            className="pom-btn pom-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="pom-form"
            className="pom-btn pom-btn--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="pom-spin" aria-hidden="true" />
                Criando...
              </>
            ) : (
              'Criar Pedido Emergencial'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: PurchaseOrderModalProps) {
  if (!isOpen) return null;
  return <PurchaseOrderForm key={String(isOpen)} onClose={onClose} onSuccess={onSuccess} />;
}
