import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertTriangle, Wrench, Hand, ArrowRightLeft, Trash } from 'lucide-react';
import { api } from '@/services/api';
import type { StockBalance } from '@/hooks/useStockEntries';
import './StockOutputModal.css';

// ─── Constants ──────────────────────────────────────────────────────

const OUTPUT_TYPES = [
  { value: 'CONSUMPTION', label: 'Consumo op.', icon: Wrench },
  { value: 'MANUAL_CONSUMPTION', label: 'Consumo manual', icon: Hand },
  { value: 'TRANSFER', label: 'Transferência', icon: ArrowRightLeft },
  { value: 'DISPOSAL', label: 'Descarte', icon: Trash },
] as const;

const DISPOSAL_REASONS = [
  { value: 'EXPIRED', label: 'Produto vencido' },
  { value: 'DAMAGED', label: 'Produto danificado' },
  { value: 'CONTAMINATED', label: 'Contaminação' },
  { value: 'QUALITY_ISSUE', label: 'Problema de qualidade' },
  { value: 'OTHER', label: 'Outro motivo' },
];

interface ProductOption {
  id: string;
  name: string;
  measurementUnitAbbreviation: string | null;
}

interface FarmOption {
  id: string;
  name: string;
}

interface FieldPlotOption {
  id: string;
  name: string;
  farmId: string;
}

interface ItemForm {
  productId: string;
  quantity: string;
  batchNumber: string;
}

interface ItemBalance {
  available: number;
  unit: string;
  exceeded: boolean;
}

const emptyItem = (): ItemForm => ({
  productId: '',
  quantity: '',
  batchNumber: '',
});

// ─── Component ──────────────────────────────────────────────────────

interface StockOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockOutputModal({ isOpen, onClose, onSuccess }: StockOutputModalProps) {
  // Type
  const [outputType, setOutputType] = useState('CONSUMPTION');

  // General
  const [outputDate, setOutputDate] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');

  // Consumption fields
  const [fieldOperationRef, setFieldOperationRef] = useState('');
  const [fieldPlotId, setFieldPlotId] = useState('');

  // Transfer fields
  const [sourceFarmId, setSourceFarmId] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [destinationFarmId, setDestinationFarmId] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');

  // Disposal fields
  const [disposalReason, setDisposalReason] = useState('');
  const [disposalJustification, setDisposalJustification] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');

  // Items
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  // Force insufficient
  const [forceInsufficient, setForceInsufficient] = useState(false);
  const [insufficientJustification, setInsufficientJustification] = useState('');

  // Reference data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [fieldPlots, setFieldPlots] = useState<FieldPlotOption[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);

  // State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Computed: item balances
  const getItemBalance = useCallback(
    (productId: string): ItemBalance | null => {
      if (!productId) return null;
      const balance = balances.find((b) => b.productId === productId);
      if (!balance) return { available: 0, unit: '', exceeded: false };
      return {
        available: balance.currentQuantity,
        unit: balance.measurementUnit || '',
        exceeded: false,
      };
    },
    [balances],
  );

  // Check if any item exceeds balance
  const insufficientItems = items
    .filter((item) => item.productId && item.quantity)
    .map((item) => {
      const bal = getItemBalance(item.productId);
      const qty = parseFloat(item.quantity) || 0;
      if (bal && qty > bal.available) {
        const product = products.find((p) => p.id === item.productId);
        return {
          productName: product?.name || 'Produto',
          requested: qty,
          available: bal.available,
          unit: bal.unit,
        };
      }
      return null;
    })
    .filter(Boolean);

  const hasInsufficientStock = insufficientItems.length > 0;

  // Load reference data
  useEffect(() => {
    if (!isOpen) return;

    void api
      .get<{ data: ProductOption[] }>('/org/products?nature=PRODUCT&status=ACTIVE&limit=500')
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));

    void api
      .get<{ data: FarmOption[] }>('/org/farms?status=ACTIVE&limit=100')
      .then((res) => setFarms(res.data))
      .catch(() => setFarms([]));

    void api
      .get<{ data: FieldPlotOption[] }>('/org/field-plots?limit=500')
      .then((res) => setFieldPlots(res.data))
      .catch(() => setFieldPlots([]));

    void api
      .get<{ data: StockBalance[] }>('/org/stock-balances?limit=500')
      .then((res) => setBalances(res.data))
      .catch(() => setBalances([]));
  }, [isOpen]);

  // Reset form
  useEffect(() => {
    if (isOpen) {
      setOutputType('CONSUMPTION');
      setOutputDate(new Date().toISOString().slice(0, 10));
      setResponsibleName('');
      setNotes('');
      setFieldOperationRef('');
      setFieldPlotId('');
      setSourceFarmId('');
      setSourceLocation('');
      setDestinationFarmId('');
      setDestinationLocation('');
      setDisposalReason('');
      setDisposalJustification('');
      setAuthorizedBy('');
      setItems([emptyItem()]);
      setForceInsufficient(false);
      setInsufficientJustification('');
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Item handlers
  const updateItem = useCallback((index: number, field: keyof ItemForm, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  // Validation
  const validateField = useCallback(
    (field: string, value: string) => {
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (field === 'responsibleName' && !value.trim()) {
          next[field] = 'Responsável é obrigatório';
        } else if (field === 'disposalReason' && outputType === 'DISPOSAL' && !value) {
          next[field] = 'Motivo do descarte é obrigatório';
        } else if (
          field === 'disposalJustification' &&
          outputType === 'DISPOSAL' &&
          !value.trim()
        ) {
          next[field] = 'Justificativa é obrigatória';
        } else if (field === 'authorizedBy' && outputType === 'DISPOSAL' && !value.trim()) {
          next[field] = 'Autorizado por é obrigatório';
        } else {
          delete next[field];
        }
        return next;
      });
    },
    [outputType],
  );

  // Submit
  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate items
    const validItems = items.filter((i) => i.productId && i.quantity);
    if (validItems.length === 0) {
      setError('Adicione pelo menos um item com produto e quantidade.');
      return;
    }

    if (!responsibleName.trim()) {
      setFieldErrors((prev) => ({ ...prev, responsibleName: 'Responsável é obrigatório' }));
      return;
    }

    // Check insufficient stock
    if (hasInsufficientStock && !forceInsufficient) {
      return;
    }
    if (hasInsufficientStock && forceInsufficient && !insufficientJustification.trim()) {
      setError('Informe a justificativa para saída com saldo insuficiente.');
      return;
    }

    // Disposal validation
    if (outputType === 'DISPOSAL') {
      if (!disposalReason) {
        setFieldErrors((prev) => ({ ...prev, disposalReason: 'Motivo do descarte é obrigatório' }));
        return;
      }
      if (!disposalJustification.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          disposalJustification: 'Justificativa é obrigatória',
        }));
        return;
      }
      if (!authorizedBy.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          authorizedBy: 'Autorizado por é obrigatório',
        }));
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        outputDate: outputDate || undefined,
        type: outputType,
        responsibleName: responsibleName || undefined,
        notes: notes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          batchNumber: item.batchNumber || undefined,
        })),
      };

      if (outputType === 'CONSUMPTION') {
        body.fieldOperationRef = fieldOperationRef || undefined;
        body.fieldPlotId = fieldPlotId || undefined;
      }

      if (outputType === 'TRANSFER') {
        body.sourceFarmId = sourceFarmId || undefined;
        body.sourceLocation = sourceLocation || undefined;
        body.destinationFarmId = destinationFarmId || undefined;
        body.destinationLocation = destinationLocation || undefined;
      }

      if (outputType === 'DISPOSAL') {
        body.disposalReason = disposalReason;
        body.disposalJustification = disposalJustification;
        body.authorizedBy = authorizedBy;
      }

      if (hasInsufficientStock && forceInsufficient) {
        body.forceInsufficient = true;
        body.insufficientJustification = insufficientJustification;
      }

      await api.post('/org/stock-outputs', body);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a saída.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [
    outputType,
    outputDate,
    responsibleName,
    notes,
    items,
    fieldOperationRef,
    fieldPlotId,
    sourceFarmId,
    sourceLocation,
    destinationFarmId,
    destinationLocation,
    disposalReason,
    disposalJustification,
    authorizedBy,
    hasInsufficientStock,
    forceInsufficient,
    insufficientJustification,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="stock-output-modal__overlay" onClick={onClose}>
      <div
        className="stock-output-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Registrar saída de estoque"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="stock-output-modal__header">
          <h2>Registrar saída de estoque</h2>
          <button
            type="button"
            className="stock-output-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="stock-output-modal__body">
          {error && (
            <div className="stock-output-modal__error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Insufficient stock alert */}
          {hasInsufficientStock && (
            <div className="stock-output-modal__alert" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <div className="stock-output-modal__alert-content">
                <strong>Saldo insuficiente</strong>
                {insufficientItems.map((item, idx) =>
                  item ? (
                    <p key={idx}>
                      {item.productName}: solicitado {item.requested.toLocaleString('pt-BR')}{' '}
                      {item.unit}, disponível {item.available.toLocaleString('pt-BR')} {item.unit}
                    </p>
                  ) : null,
                )}
                <div className="stock-output-modal__force-check">
                  <label>
                    <input
                      type="checkbox"
                      checked={forceInsufficient}
                      onChange={(e) => setForceInsufficient(e.target.checked)}
                    />
                    Forçar saída mesmo com saldo insuficiente
                  </label>
                  {forceInsufficient && (
                    <input
                      type="text"
                      value={insufficientJustification}
                      onChange={(e) => setInsufficientJustification(e.target.value)}
                      placeholder="Justificativa obrigatória *"
                      aria-label="Justificativa para saldo insuficiente"
                      aria-required="true"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Type selector */}
          <h3 className="stock-output-modal__section-title">Tipo de saída *</h3>
          <div className="stock-output-modal__type-grid">
            {OUTPUT_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  className={`stock-output-modal__type-option ${
                    outputType === t.value ? 'stock-output-modal__type-option--selected' : ''
                  }`}
                  onClick={() => setOutputType(t.value)}
                  aria-pressed={outputType === t.value}
                >
                  <Icon size={20} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* General fields */}
          <h3 className="stock-output-modal__section-title">Dados da saída</h3>
          <div className="stock-output-modal__row">
            <div className="stock-output-modal__field">
              <label htmlFor="output-date">Data da saída *</label>
              <input
                id="output-date"
                type="date"
                value={outputDate}
                onChange={(e) => setOutputDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="stock-output-modal__field">
              <label htmlFor="responsible-name">Responsável *</label>
              <input
                id="responsible-name"
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                onBlur={(e) => validateField('responsibleName', e.target.value)}
                placeholder="Nome do responsável"
                required
                aria-required="true"
                className={fieldErrors.responsibleName ? 'stock-output-modal__input--error' : ''}
              />
              {fieldErrors.responsibleName && (
                <span className="stock-output-modal__field-error" role="alert">
                  {fieldErrors.responsibleName}
                </span>
              )}
            </div>
          </div>

          {/* Consumption fields */}
          {outputType === 'CONSUMPTION' && (
            <div className="stock-output-modal__row">
              <div className="stock-output-modal__field">
                <label htmlFor="field-operation-ref">Referência da operação</label>
                <input
                  id="field-operation-ref"
                  type="text"
                  value={fieldOperationRef}
                  onChange={(e) => setFieldOperationRef(e.target.value)}
                  placeholder="Ex: OP-2026-001"
                />
              </div>
              <div className="stock-output-modal__field">
                <label htmlFor="field-plot-id">Talhão</label>
                <select
                  id="field-plot-id"
                  value={fieldPlotId}
                  onChange={(e) => setFieldPlotId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {fieldPlots.map((plot) => (
                    <option key={plot.id} value={plot.id}>
                      {plot.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Transfer fields */}
          {outputType === 'TRANSFER' && (
            <>
              <div className="stock-output-modal__row">
                <div className="stock-output-modal__field">
                  <label htmlFor="source-farm">Fazenda de origem</label>
                  <select
                    id="source-farm"
                    value={sourceFarmId}
                    onChange={(e) => setSourceFarmId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="stock-output-modal__field">
                  <label htmlFor="source-location">Local de origem</label>
                  <input
                    id="source-location"
                    type="text"
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    placeholder="Ex: Galpão 1"
                  />
                </div>
              </div>
              <div className="stock-output-modal__row">
                <div className="stock-output-modal__field">
                  <label htmlFor="dest-farm">Fazenda de destino</label>
                  <select
                    id="dest-farm"
                    value={destinationFarmId}
                    onChange={(e) => setDestinationFarmId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="stock-output-modal__field">
                  <label htmlFor="dest-location">Local de destino</label>
                  <input
                    id="dest-location"
                    type="text"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                    placeholder="Ex: Galpão 2"
                  />
                </div>
              </div>
            </>
          )}

          {/* Disposal fields */}
          {outputType === 'DISPOSAL' && (
            <>
              <div className="stock-output-modal__row">
                <div className="stock-output-modal__field">
                  <label htmlFor="disposal-reason">Motivo do descarte *</label>
                  <select
                    id="disposal-reason"
                    value={disposalReason}
                    onChange={(e) => setDisposalReason(e.target.value)}
                    onBlur={(e) => validateField('disposalReason', e.target.value)}
                    required
                    aria-required="true"
                    className={fieldErrors.disposalReason ? 'stock-output-modal__input--error' : ''}
                  >
                    <option value="">Selecione...</option>
                    {DISPOSAL_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.disposalReason && (
                    <span className="stock-output-modal__field-error" role="alert">
                      {fieldErrors.disposalReason}
                    </span>
                  )}
                </div>
                <div className="stock-output-modal__field">
                  <label htmlFor="authorized-by">Autorizado por *</label>
                  <input
                    id="authorized-by"
                    type="text"
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                    onBlur={(e) => validateField('authorizedBy', e.target.value)}
                    placeholder="Nome de quem autorizou"
                    required
                    aria-required="true"
                    className={fieldErrors.authorizedBy ? 'stock-output-modal__input--error' : ''}
                  />
                  {fieldErrors.authorizedBy && (
                    <span className="stock-output-modal__field-error" role="alert">
                      {fieldErrors.authorizedBy}
                    </span>
                  )}
                </div>
              </div>
              <div className="stock-output-modal__row stock-output-modal__row--full">
                <div className="stock-output-modal__field">
                  <label htmlFor="disposal-justification">Justificativa do descarte *</label>
                  <textarea
                    id="disposal-justification"
                    value={disposalJustification}
                    onChange={(e) => setDisposalJustification(e.target.value)}
                    onBlur={(e) => validateField('disposalJustification', e.target.value)}
                    placeholder="Descreva o motivo detalhado do descarte..."
                    required
                    aria-required="true"
                  />
                  {fieldErrors.disposalJustification && (
                    <span className="stock-output-modal__field-error" role="alert">
                      {fieldErrors.disposalJustification}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Items */}
          <h3 className="stock-output-modal__section-title">Itens da saída *</h3>
          <div className="stock-output-modal__items">
            {items.map((item, idx) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              const unitLabel = selectedProduct?.measurementUnitAbbreviation || '';
              const itemBal = getItemBalance(item.productId);
              const qty = parseFloat(item.quantity) || 0;
              const isExceeded = itemBal ? qty > itemBal.available : false;

              return (
                <div key={idx} className="stock-output-modal__item-card">
                  <div className="stock-output-modal__item-card-header">
                    <span>Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="stock-output-modal__item-remove"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remover item ${idx + 1}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="stock-output-modal__row">
                    <div className="stock-output-modal__field">
                      <label htmlFor={`item-product-${idx}`}>Produto *</label>
                      <select
                        id={`item-product-${idx}`}
                        value={item.productId}
                        onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                        required
                        aria-required="true"
                      >
                        <option value="">Selecione...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.measurementUnitAbbreviation
                              ? ` (${p.measurementUnitAbbreviation})`
                              : ''}
                          </option>
                        ))}
                      </select>
                      {itemBal && (
                        <span
                          className={`stock-output-modal__item-balance ${
                            isExceeded
                              ? 'stock-output-modal__item-balance--danger'
                              : itemBal.available <= 0
                                ? 'stock-output-modal__item-balance--warning'
                                : ''
                          }`}
                        >
                          Saldo disponível: {itemBal.available.toLocaleString('pt-BR')}{' '}
                          {itemBal.unit}
                        </span>
                      )}
                    </div>
                    <div className="stock-output-modal__field">
                      <label htmlFor={`item-batch-${idx}`}>Lote</label>
                      <input
                        id={`item-batch-${idx}`}
                        type="text"
                        value={item.batchNumber}
                        onChange={(e) => updateItem(idx, 'batchNumber', e.target.value)}
                        placeholder="Ex: LOT-001"
                      />
                    </div>
                  </div>
                  <div className="stock-output-modal__row stock-output-modal__row--full">
                    <div className="stock-output-modal__field">
                      <label htmlFor={`item-qty-${idx}`}>
                        Quantidade {unitLabel ? `(${unitLabel})` : ''} *
                      </label>
                      <input
                        id={`item-qty-${idx}`}
                        type="number"
                        min="0.0001"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        required
                        aria-required="true"
                        className={isExceeded ? 'stock-output-modal__input--error' : ''}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button type="button" className="stock-output-modal__add-btn" onClick={addItem}>
              <Plus size={16} aria-hidden="true" />
              Adicionar item
            </button>
          </div>

          {/* Notes */}
          <div className="stock-output-modal__field">
            <label htmlFor="output-notes">Observações</label>
            <textarea
              id="output-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre esta saída..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="stock-output-modal__footer">
          <button type="button" className="stock-output-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="stock-output-modal__btn-save"
            onClick={handleSubmit}
            disabled={saving || (hasInsufficientStock && !forceInsufficient)}
          >
            {saving ? 'Salvando...' : 'Registrar saída'}
          </button>
        </div>
      </div>
    </div>
  );
}
