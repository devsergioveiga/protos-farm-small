import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { usePurchaseRequestForm } from '@/hooks/usePurchaseRequestForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestUrgency,
  CreatePurchaseRequestInput,
} from '@/types/purchase-request';
import { SUPPLIER_CATEGORY_LABELS } from '@/types/purchase-request';
import { useFarms } from '@/hooks/useFarms';
import './PurchaseRequestModal.css';

interface PurchaseRequestModalProps {
  isOpen: boolean;
  rc?: PurchaseRequest;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type SupplierCategory = keyof typeof SUPPLIER_CATEGORY_LABELS;

interface ItemRow extends Omit<PurchaseRequestItem, 'id'> {
  _key: string;
}

function createEmptyItem(): ItemRow {
  return {
    _key: Math.random().toString(36).slice(2),
    productName: '',
    quantity: 1,
    unitName: '',
    estimatedUnitPrice: undefined,
    notes: '',
  };
}

function itemsFromRc(rc: PurchaseRequest): ItemRow[] {
  return rc.items.map((item) => ({
    _key: item.id ?? Math.random().toString(36).slice(2),
    productName: item.productName,
    quantity: item.quantity,
    unitName: item.unitName,
    estimatedUnitPrice: item.estimatedUnitPrice,
    notes: item.notes ?? '',
  }));
}

interface PurchaseRequestFormProps {
  rc?: PurchaseRequest;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function PurchaseRequestForm({ rc, onClose, onSuccess }: PurchaseRequestFormProps) {
  const isEditing = !!rc;
  const titleId = 'prcm-title';

  // Derive initial values from rc (runs once on mount due to key remount)
  const [requestType, setRequestType] = useState<SupplierCategory>(
    (rc?.requestType as SupplierCategory) ?? 'INSUMO_AGRICOLA',
  );
  const [farmId, setFarmId] = useState(rc?.farmId ?? '');
  const [urgency, setUrgency] = useState<PurchaseRequestUrgency>(rc?.urgency ?? 'NORMAL');
  const [justification, setJustification] = useState(rc?.justification ?? '');
  const [neededBy, setNeededBy] = useState(rc?.neededBy ? rc.neededBy.slice(0, 10) : '');
  const [items, setItems] = useState<ItemRow[]>(rc ? itemsFromRc(rc) : [createEmptyItem()]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { create, update, submit, isLoading } = usePurchaseRequestForm(() => {});
  const { farms, isLoading: farmsLoading } = useFarms();

  const firstInputRef = useRef<HTMLSelectElement>(null);
  const isDirtyRef = useRef(false);
  const handleCloseRef = useRef<() => void>(null!);

  function doClose() {
    setShowDiscardConfirm(false);
    onClose();
  }

  function handleClose() {
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true);
    } else {
      doClose();
    }
  }

  // Keep ref in sync so keyboard handler always calls the latest handleClose
  useLayoutEffect(() => {
    handleCloseRef.current = handleClose;
  });

  function markDirty() {
    isDirtyRef.current = true;
    if (!isDirty) setIsDirty(true);
  }

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, []);

  // Keyboard handling — use ref so no exhaustive-deps issue
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    if (!requestType) newErrors.requestType = 'Selecione o tipo de requisicao.';
    if (!farmId) newErrors.farmId = 'Selecione a fazenda.';
    if (!urgency) newErrors.urgency = 'Selecione a urgencia.';
    if (urgency === 'EMERGENCIAL' && !justification.trim()) {
      newErrors.justification = 'A justificativa e obrigatoria para requisicoes emergenciais.';
    }
    if (items.length === 0) {
      newErrors.items = 'Adicione pelo menos um item a requisicao.';
    } else {
      items.forEach((item, idx) => {
        if (!item.productName.trim()) {
          newErrors[`item_${idx}_name`] = 'Informe o produto ou descricao.';
        }
        if (!item.quantity || item.quantity <= 0) {
          newErrors[`item_${idx}_qty`] = 'Quantidade invalida.';
        }
        if (!item.unitName.trim()) {
          newErrors[`item_${idx}_unit`] = 'Informe a unidade.';
        }
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function buildInput(): CreatePurchaseRequestInput {
    return {
      requestType,
      farmId,
      urgency,
      justification: urgency === 'EMERGENCIAL' ? justification.trim() : undefined,
      neededBy: neededBy || undefined,
      items: items.map((item) => ({
        productName: item.productName.trim(),
        quantity: item.quantity,
        unitName: item.unitName.trim(),
        estimatedUnitPrice: item.estimatedUnitPrice,
        notes: item.notes?.trim() || undefined,
      })),
    };
  }

  async function handleSaveDraft() {
    if (!validateForm()) return;
    try {
      const input = buildInput();
      if (isEditing && rc) {
        await update(rc.id, input);
        onSuccess('Rascunho atualizado com sucesso.');
      } else {
        await create(input);
        onSuccess('Rascunho salvo com sucesso.');
      }
    } catch {
      // error handled by hook
    }
  }

  async function handleSubmitForApproval() {
    if (!validateForm()) return;
    try {
      const input = buildInput();
      if (isEditing && rc) {
        await update(rc.id, input);
        await submit(rc.id);
      } else {
        const created = await create(input);
        await submit(created.id);
      }
      onSuccess('Requisicao enviada para aprovacao.');
    } catch {
      // error handled by hook
    }
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
    markDirty();
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i._key !== key));
    markDirty();
  }

  function updateItem(
    key: string,
    field: keyof Omit<ItemRow, '_key'>,
    value: string | number | undefined,
  ) {
    setItems((prev) => prev.map((i) => (i._key === key ? { ...i, [field]: value } : i)));
    markDirty();
  }

  const categoryOptions = Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][];

  return (
    <>
      <div
        className="prcm-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="prcm-modal">
          {/* Header */}
          <div className="prcm-modal__header">
            <h2 id={titleId} className="prcm-modal__title">
              {isEditing ? `Editar Requisicao ${rc.sequentialNumber}` : 'Nova Requisicao'}
            </h2>
            <button
              type="button"
              className="prcm-modal__close"
              onClick={handleClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="prcm-modal__body">
            {/* Section 1: Dados Gerais */}
            <section className="prcm-section">
              <h3 className="prcm-section__title">Dados Gerais</h3>

              <div className="prcm-field-row">
                {/* Tipo */}
                <div className="prcm-field">
                  <label htmlFor="prcm-type" className="prcm-label">
                    Tipo de requisicao <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="prcm-type"
                    ref={firstInputRef}
                    className={`prcm-select ${errors.requestType ? 'prcm-select--error' : ''}`}
                    value={requestType}
                    aria-required="true"
                    onChange={(e) => {
                      setRequestType(e.target.value as SupplierCategory);
                      markDirty();
                    }}
                  >
                    {categoryOptions.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.requestType && (
                    <span role="alert" className="prcm-error-msg">
                      <AlertCircle size={16} aria-hidden="true" /> {errors.requestType}
                    </span>
                  )}
                </div>

                {/* Fazenda */}
                <div className="prcm-field">
                  <label htmlFor="prcm-farm" className="prcm-label">
                    Fazenda <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="prcm-farm"
                    className={`prcm-select ${errors.farmId ? 'prcm-select--error' : ''}`}
                    value={farmId}
                    aria-required="true"
                    onChange={(e) => {
                      setFarmId(e.target.value);
                      markDirty();
                    }}
                    disabled={farmsLoading}
                  >
                    <option value="">Selecione uma fazenda</option>
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                  {errors.farmId && (
                    <span role="alert" className="prcm-error-msg">
                      <AlertCircle size={16} aria-hidden="true" /> {errors.farmId}
                    </span>
                  )}
                </div>
              </div>

              {/* Urgencia */}
              <div className="prcm-field">
                <fieldset className="prcm-fieldset">
                  <legend className="prcm-label">
                    Urgencia <span aria-hidden="true">*</span>
                  </legend>
                  <div className="prcm-urgency-group" role="group" aria-required="true">
                    {(['NORMAL', 'URGENTE', 'EMERGENCIAL'] as PurchaseRequestUrgency[]).map(
                      (level) => (
                        <label
                          key={level}
                          className={`prcm-urgency-option ${urgency === level ? 'prcm-urgency-option--active' : ''}`}
                        >
                          <input
                            type="radio"
                            name="urgency"
                            value={level}
                            checked={urgency === level}
                            onChange={() => {
                              setUrgency(level);
                              markDirty();
                            }}
                            className="sr-only"
                          />
                          {level === 'NORMAL'
                            ? 'Normal'
                            : level === 'URGENTE'
                              ? 'Urgente'
                              : 'Emergencial'}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
              </div>

              {/* Justificativa (EMERGENCIAL only) */}
              <div
                className={`prcm-field prcm-field--collapsible ${urgency === 'EMERGENCIAL' ? 'prcm-field--visible' : ''}`}
              >
                <label htmlFor="prcm-justification" className="prcm-label">
                  Justificativa <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="prcm-justification"
                  className={`prcm-textarea ${errors.justification ? 'prcm-textarea--error' : ''}`}
                  value={justification}
                  aria-required={urgency === 'EMERGENCIAL'}
                  rows={3}
                  placeholder="Descreva o motivo da urgencia emergencial..."
                  onChange={(e) => {
                    setJustification(e.target.value);
                    markDirty();
                  }}
                />
                {errors.justification && (
                  <span role="alert" className="prcm-error-msg">
                    <AlertCircle size={16} aria-hidden="true" /> {errors.justification}
                  </span>
                )}
              </div>

              {/* Data de Necessidade */}
              <div className="prcm-field prcm-field--half">
                <label htmlFor="prcm-needed-by" className="prcm-label">
                  Data de Necessidade
                </label>
                <input
                  id="prcm-needed-by"
                  type="date"
                  className="prcm-input"
                  value={neededBy}
                  onChange={(e) => {
                    setNeededBy(e.target.value);
                    markDirty();
                  }}
                />
              </div>
            </section>

            {/* Divider */}
            <hr className="prcm-divider" />

            {/* Section 2: Itens */}
            <section className="prcm-section">
              <h3 className="prcm-section__title">Itens</h3>

              {errors.items && (
                <div role="alert" className="prcm-error-msg prcm-error-msg--block">
                  <AlertCircle size={16} aria-hidden="true" /> {errors.items}
                </div>
              )}

              <div className="prcm-items-table-wrapper">
                <table className="prcm-items-table">
                  <thead>
                    <tr>
                      <th scope="col">Produto/Descricao *</th>
                      <th scope="col">Qtd *</th>
                      <th scope="col">Unidade *</th>
                      <th scope="col">Preco Unit. Est.</th>
                      <th scope="col">Obs.</th>
                      <th scope="col">
                        <span className="sr-only">Remover</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item._key}>
                        <td>
                          <input
                            type="text"
                            className={`prcm-input prcm-input--table ${errors[`item_${idx}_name`] ? 'prcm-input--error' : ''}`}
                            value={item.productName}
                            placeholder="Nome do produto"
                            aria-label={`Produto do item ${idx + 1}`}
                            aria-required="true"
                            onChange={(e) => updateItem(item._key, 'productName', e.target.value)}
                          />
                          {errors[`item_${idx}_name`] && (
                            <span role="alert" className="prcm-error-msg prcm-error-msg--sm">
                              {errors[`item_${idx}_name`]}
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`prcm-input prcm-input--table prcm-input--narrow ${errors[`item_${idx}_qty`] ? 'prcm-input--error' : ''}`}
                            value={item.quantity}
                            min={0.01}
                            step="any"
                            aria-label={`Quantidade do item ${idx + 1}`}
                            aria-required="true"
                            onChange={(e) =>
                              updateItem(item._key, 'quantity', parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={`prcm-input prcm-input--table prcm-input--narrow ${errors[`item_${idx}_unit`] ? 'prcm-input--error' : ''}`}
                            value={item.unitName}
                            placeholder="un, kg, L..."
                            aria-label={`Unidade do item ${idx + 1}`}
                            aria-required="true"
                            onChange={(e) => updateItem(item._key, 'unitName', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="prcm-input prcm-input--table prcm-input--narrow"
                            value={item.estimatedUnitPrice ?? ''}
                            min={0}
                            step="0.01"
                            placeholder="0,00"
                            aria-label={`Preco estimado do item ${idx + 1}`}
                            onChange={(e) =>
                              updateItem(
                                item._key,
                                'estimatedUnitPrice',
                                e.target.value ? parseFloat(e.target.value) : undefined,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="prcm-input prcm-input--table"
                            value={item.notes ?? ''}
                            placeholder="Observacoes..."
                            aria-label={`Observacao do item ${idx + 1}`}
                            onChange={(e) => updateItem(item._key, 'notes', e.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="prcm-remove-item-btn"
                            onClick={() => removeItem(item._key)}
                            disabled={items.length === 1}
                            aria-label={`Remover item ${idx + 1}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button" className="prcm-add-item-btn" onClick={addItem}>
                <Plus size={16} aria-hidden="true" />
                Adicionar Item
              </button>
            </section>
          </div>

          {/* Footer */}
          <div className="prcm-modal__footer">
            <button type="button" className="prcm-btn prcm-btn--ghost" onClick={handleClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="prcm-btn prcm-btn--outlined"
              onClick={() => void handleSaveDraft()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={16} aria-hidden="true" className="prcm-spin" /> : null}
              Salvar Rascunho
            </button>
            <button
              type="button"
              className="prcm-btn prcm-btn--primary"
              onClick={() => void handleSubmitForApproval()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={16} aria-hidden="true" className="prcm-spin" /> : null}
              Enviar para Aprovacao
            </button>
          </div>
        </div>
      </div>

      {/* Discard confirm */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        title="Descartar alteracoes?"
        message="As mudancas nao foram salvas."
        confirmLabel="Descartar"
        variant="warning"
        onConfirm={doClose}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
}

export default function PurchaseRequestModal({
  isOpen,
  rc,
  onClose,
  onSuccess,
}: PurchaseRequestModalProps) {
  if (!isOpen) return null;

  // key remounts the form when modal opens or rc changes, giving clean initial state
  const formKey = isOpen ? `${rc?.id ?? 'new'}-${rc?.updatedAt ?? ''}` : 'closed';

  return <PurchaseRequestForm key={formKey} rc={rc} onClose={onClose} onSuccess={onSuccess} />;
}
