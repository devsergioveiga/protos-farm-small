import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '@/services/api';
import type { StockEntry, CostAlert } from '@/hooks/useStockEntries';
import './StockEntryModal.css';

// ─── Constants ──────────────────────────────────────────────────────

const EXPENSE_TYPES = [
  { value: 'FREIGHT', label: 'Frete' },
  { value: 'INSURANCE', label: 'Seguro de carga' },
  { value: 'UNLOADING', label: 'Descarga/manuseio' },
  { value: 'TOLL', label: 'Pedágio' },
  { value: 'TEMPORARY_STORAGE', label: 'Armazenagem temporária' },
  { value: 'PACKAGING', label: 'Embalagem' },
  { value: 'PORT_FEE', label: 'Taxa portuária' },
  { value: 'ICMS_ST', label: 'ICMS-ST' },
  { value: 'IPI', label: 'IPI não recuperável' },
  { value: 'OTHER', label: 'Outro' },
];

const APPORTIONMENT_METHODS = [
  { value: 'BY_VALUE', label: 'Proporcional ao valor' },
  { value: 'BY_QUANTITY', label: 'Proporcional à quantidade' },
  { value: 'BY_WEIGHT', label: 'Proporcional ao peso' },
  { value: 'FIXED', label: 'Valor fixo por item' },
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

interface MeasurementUnitOption {
  id: string;
  abbreviation: string;
  name: string;
}

interface ProductUnitConfigInfo {
  purchaseUnitAbbreviation: string | null;
  stockUnitAbbreviation: string | null;
}

interface ItemForm {
  productId: string;
  quantity: string;
  unitCost: string;
  purchaseUnitAbbreviation: string;
  batchNumber: string;
  manufacturingDate: string;
  expirationDate: string;
  weightKg: string;
}

interface ExpenseForm {
  expenseType: string;
  description: string;
  supplierName: string;
  invoiceNumber: string;
  amount: string;
  apportionmentMethod: string;
}

const emptyItem = (): ItemForm => ({
  productId: '',
  quantity: '',
  unitCost: '',
  purchaseUnitAbbreviation: '',
  batchNumber: '',
  manufacturingDate: '',
  expirationDate: '',
  weightKg: '',
});

const emptyExpense = (): ExpenseForm => ({
  expenseType: 'FREIGHT',
  description: '',
  supplierName: '',
  invoiceNumber: '',
  amount: '',
  apportionmentMethod: 'BY_VALUE',
});

// ─── Component ──────────────────────────────────────────────────────

interface StockEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockEntryModal({ isOpen, onClose, onSuccess }: StockEntryModalProps) {
  const [entryDate, setEntryDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [storageFarmId, setStorageFarmId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [storageSublocation, setStorageSublocation] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [expenses, setExpenses] = useState<ExpenseForm[]>([]);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [units, setUnits] = useState<MeasurementUnitOption[]>([]);
  const [productUnitConfigs, setProductUnitConfigs] = useState<
    Record<string, ProductUnitConfigInfo>
  >({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);

  // Load products and farms
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
      .get<{ data: MeasurementUnitOption[] }>('/org/measurement-units?limit=100')
      .then((res) => setUnits(res.data))
      .catch(() => setUnits([]));
  }, [isOpen]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setEntryDate(new Date().toISOString().slice(0, 10));
      setSupplierName('');
      setInvoiceNumber('');
      setStorageFarmId('');
      setStorageLocation('');
      setStorageSublocation('');
      setNotes('');
      setItems([emptyItem()]);
      setExpenses([]);
      setError(null);
      setCostAlerts([]);
      setProductUnitConfigs({});
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

  // Fetch product unit config when a product is selected (US-097 CA3)
  const fetchProductUnitConfig = useCallback(
    async (productId: string) => {
      if (!productId || productUnitConfigs[productId]) return;
      try {
        const config = await api.get<ProductUnitConfigInfo & { productId: string }>(
          `/org/product-unit-configs/${productId}`,
        );
        setProductUnitConfigs((prev) => ({
          ...prev,
          [productId]: {
            purchaseUnitAbbreviation: config.purchaseUnitAbbreviation,
            stockUnitAbbreviation: config.stockUnitAbbreviation,
          },
        }));
      } catch {
        // No config for this product — that's fine
        setProductUnitConfigs((prev) => ({
          ...prev,
          [productId]: { purchaseUnitAbbreviation: null, stockUnitAbbreviation: null },
        }));
      }
    },
    [productUnitConfigs],
  );

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

  // Expense handlers
  const updateExpense = useCallback((index: number, field: keyof ExpenseForm, value: string) => {
    setExpenses((prev) => prev.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp)));
  }, []);

  const addExpense = useCallback(() => {
    setExpenses((prev) => [...prev, emptyExpense()]);
  }, []);

  const removeExpense = useCallback((index: number) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Totals
  const merchandiseTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const expenseTotal = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const grandTotal = merchandiseTotal + expenseTotal;

  // Format currency
  const formatBRL = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Submit
  const handleSubmit = useCallback(async () => {
    setError(null);
    setCostAlerts([]);

    // Validate
    const validItems = items.filter((i) => i.productId && i.quantity && i.unitCost);
    if (validItems.length === 0) {
      setError('Adicione pelo menos um item com produto, quantidade e custo.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        entryDate: entryDate || undefined,
        supplierName: supplierName || undefined,
        invoiceNumber: invoiceNumber || undefined,
        storageFarmId: storageFarmId || undefined,
        storageLocation: storageLocation || undefined,
        storageSublocation: storageSublocation || undefined,
        notes: notes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unitCost),
          purchaseUnitAbbreviation: item.purchaseUnitAbbreviation || undefined,
          batchNumber: item.batchNumber || undefined,
          manufacturingDate: item.manufacturingDate || undefined,
          expirationDate: item.expirationDate || undefined,
          weightKg: item.weightKg ? parseFloat(item.weightKg) : undefined,
        })),
        expenses: expenses
          .filter((e) => e.amount)
          .map((exp) => ({
            expenseType: exp.expenseType,
            description: exp.description || undefined,
            supplierName: exp.supplierName || undefined,
            invoiceNumber: exp.invoiceNumber || undefined,
            amount: parseFloat(exp.amount),
            apportionmentMethod: exp.apportionmentMethod || 'BY_VALUE',
          })),
      };

      const result = await api.post<StockEntry & { costAlerts: CostAlert[] }>(
        '/org/stock-entries',
        body,
      );

      if (result.costAlerts && result.costAlerts.length > 0) {
        setCostAlerts(result.costAlerts);
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a entrada.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [
    entryDate,
    supplierName,
    invoiceNumber,
    storageFarmId,
    storageLocation,
    storageSublocation,
    notes,
    items,
    expenses,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="stock-modal__overlay" onClick={onClose}>
      <div
        className="stock-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Registrar entrada de estoque"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="stock-modal__header">
          <h2>Registrar entrada de estoque</h2>
          <button
            type="button"
            className="stock-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="stock-modal__body">
          {error && (
            <div className="stock-modal__error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {costAlerts.length > 0 && (
            <div className="stock-modal__alert" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Alerta de custo</strong>
                <ul>
                  {costAlerts.map((alert) => (
                    <li key={alert.productId}>
                      {alert.productName}: custo {formatBRL(alert.newUnitCost)} diverge{' '}
                      {alert.divergencePct}% do custo médio {formatBRL(alert.currentAvgCost)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* General Info */}
          <h3 className="stock-modal__section-title">Dados da entrada</h3>
          <div className="stock-modal__row">
            <div className="stock-modal__field">
              <label htmlFor="entry-date">Data da entrada *</label>
              <input
                id="entry-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="stock-modal__field">
              <label htmlFor="supplier-name">Fornecedor</label>
              <input
                id="supplier-name"
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

          <div className="stock-modal__row">
            <div className="stock-modal__field">
              <label htmlFor="invoice-number">Nº da NF</label>
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ex: NF-1234"
              />
            </div>
            <div className="stock-modal__field">
              <label htmlFor="storage-farm">Fazenda de armazenamento</label>
              <select
                id="storage-farm"
                value={storageFarmId}
                onChange={(e) => setStorageFarmId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stock-modal__row">
            <div className="stock-modal__field">
              <label htmlFor="storage-location">Depósito / Galpão</label>
              <input
                id="storage-location"
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Ex: Galpão 1"
              />
            </div>
            <div className="stock-modal__field">
              <label htmlFor="storage-sublocation">Prateleira</label>
              <input
                id="storage-sublocation"
                type="text"
                value={storageSublocation}
                onChange={(e) => setStorageSublocation(e.target.value)}
                placeholder="Ex: Prateleira A"
              />
            </div>
          </div>

          {/* Items */}
          <h3 className="stock-modal__section-title">Itens da entrada *</h3>
          <div className="stock-modal__items">
            {items.map((item, idx) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              const unitConfig = item.productId ? productUnitConfigs[item.productId] : null;
              const purchaseAbbrev =
                item.purchaseUnitAbbreviation ||
                unitConfig?.purchaseUnitAbbreviation ||
                selectedProduct?.measurementUnitAbbreviation ||
                '';
              const stockAbbrev =
                unitConfig?.stockUnitAbbreviation ||
                selectedProduct?.measurementUnitAbbreviation ||
                '';
              const showConversionPreview =
                purchaseAbbrev &&
                stockAbbrev &&
                purchaseAbbrev !== stockAbbrev &&
                parseFloat(item.quantity) > 0;
              return (
                <div key={idx} className="stock-modal__item-card">
                  <div className="stock-modal__item-card-header">
                    <span>Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="stock-modal__item-remove"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remover item ${idx + 1}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="stock-modal__row">
                    <div className="stock-modal__field">
                      <label htmlFor={`item-product-${idx}`}>Produto *</label>
                      <select
                        id={`item-product-${idx}`}
                        value={item.productId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          updateItem(idx, 'productId', pid);
                          updateItem(idx, 'purchaseUnitAbbreviation', '');
                          if (pid) void fetchProductUnitConfig(pid);
                        }}
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
                    </div>
                    <div className="stock-modal__field">
                      <label htmlFor={`item-batch-${idx}`}>Lote do fabricante</label>
                      <input
                        id={`item-batch-${idx}`}
                        type="text"
                        value={item.batchNumber}
                        onChange={(e) => updateItem(idx, 'batchNumber', e.target.value)}
                        placeholder="Ex: LOT-001"
                      />
                    </div>
                  </div>
                  <div className="stock-modal__row stock-modal__row--4">
                    <div className="stock-modal__field">
                      <label htmlFor={`item-qty-${idx}`}>Quantidade *</label>
                      <input
                        id={`item-qty-${idx}`}
                        type="number"
                        min="0.0001"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        required
                        aria-required="true"
                      />
                    </div>
                    <div className="stock-modal__field">
                      <label htmlFor={`item-unit-${idx}`}>Unidade</label>
                      <select
                        id={`item-unit-${idx}`}
                        value={item.purchaseUnitAbbreviation}
                        onChange={(e) =>
                          updateItem(idx, 'purchaseUnitAbbreviation', e.target.value)
                        }
                      >
                        <option value="">{purchaseAbbrev || 'Padrão'}</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.abbreviation}>
                            {u.name} ({u.abbreviation})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="stock-modal__field">
                      <label htmlFor={`item-cost-${idx}`}>Custo unitário (R$) *</label>
                      <input
                        id={`item-cost-${idx}`}
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitCost}
                        onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                        required
                        aria-required="true"
                      />
                    </div>
                    <div className="stock-modal__field">
                      <label htmlFor={`item-weight-${idx}`}>Peso (kg)</label>
                      <input
                        id={`item-weight-${idx}`}
                        type="number"
                        min="0"
                        step="any"
                        value={item.weightKg}
                        onChange={(e) => updateItem(idx, 'weightKg', e.target.value)}
                      />
                    </div>
                  </div>
                  {showConversionPreview && (
                    <div
                      className="stock-modal__conversion-preview"
                      role="status"
                      aria-live="polite"
                    >
                      <ArrowRight size={14} aria-hidden="true" />
                      <span>
                        {parseFloat(item.quantity)} {purchaseAbbrev} será convertido para{' '}
                        {stockAbbrev} no estoque
                      </span>
                    </div>
                  )}
                  <div className="stock-modal__row">
                    <div className="stock-modal__field">
                      <label htmlFor={`item-mfg-${idx}`}>Data de fabricação</label>
                      <input
                        id={`item-mfg-${idx}`}
                        type="date"
                        value={item.manufacturingDate}
                        onChange={(e) => updateItem(idx, 'manufacturingDate', e.target.value)}
                      />
                    </div>
                    <div className="stock-modal__field">
                      <label htmlFor={`item-exp-${idx}`}>Data de validade</label>
                      <input
                        id={`item-exp-${idx}`}
                        type="date"
                        value={item.expirationDate}
                        onChange={(e) => updateItem(idx, 'expirationDate', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button type="button" className="stock-modal__add-btn" onClick={addItem}>
              <Plus size={16} aria-hidden="true" />
              Adicionar item
            </button>
          </div>

          {/* Expenses */}
          <h3 className="stock-modal__section-title">Despesas acessórias</h3>
          <div className="stock-modal__items">
            {expenses.map((exp, idx) => (
              <div key={idx} className="stock-modal__item-card">
                <div className="stock-modal__item-card-header">
                  <span>Despesa {idx + 1}</span>
                  <button
                    type="button"
                    className="stock-modal__item-remove"
                    onClick={() => removeExpense(idx)}
                    aria-label={`Remover despesa ${idx + 1}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="stock-modal__row">
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-type-${idx}`}>Tipo *</label>
                    <select
                      id={`exp-type-${idx}`}
                      value={exp.expenseType}
                      onChange={(e) => updateExpense(idx, 'expenseType', e.target.value)}
                    >
                      {EXPENSE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-amount-${idx}`}>Valor (R$) *</label>
                    <input
                      id={`exp-amount-${idx}`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={exp.amount}
                      onChange={(e) => updateExpense(idx, 'amount', e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                </div>
                <div className="stock-modal__row">
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-supplier-${idx}`}>Fornecedor/Prestador</label>
                    <input
                      id={`exp-supplier-${idx}`}
                      type="text"
                      value={exp.supplierName}
                      onChange={(e) => updateExpense(idx, 'supplierName', e.target.value)}
                      placeholder="Ex: Transportadora X"
                    />
                  </div>
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-invoice-${idx}`}>Nº NF/CTE</label>
                    <input
                      id={`exp-invoice-${idx}`}
                      type="text"
                      value={exp.invoiceNumber}
                      onChange={(e) => updateExpense(idx, 'invoiceNumber', e.target.value)}
                      placeholder="Ex: CTE-5678"
                    />
                  </div>
                </div>
                <div className="stock-modal__row">
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-method-${idx}`}>Rateio</label>
                    <select
                      id={`exp-method-${idx}`}
                      value={exp.apportionmentMethod}
                      onChange={(e) => updateExpense(idx, 'apportionmentMethod', e.target.value)}
                    >
                      {APPORTIONMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stock-modal__field">
                    <label htmlFor={`exp-desc-${idx}`}>Descrição</label>
                    <input
                      id={`exp-desc-${idx}`}
                      type="text"
                      value={exp.description}
                      onChange={(e) => updateExpense(idx, 'description', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="stock-modal__add-btn" onClick={addExpense}>
              <Plus size={16} aria-hidden="true" />
              Adicionar despesa acessória
            </button>
          </div>

          {/* Notes */}
          <div className="stock-modal__field">
            <label htmlFor="entry-notes">Observações</label>
            <textarea
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre esta entrada..."
            />
          </div>

          {/* Totals */}
          <div className="stock-modal__totals">
            <div className="stock-modal__total-row">
              <span>Mercadoria</span>
              <span>{formatBRL(merchandiseTotal)}</span>
            </div>
            {expenseTotal > 0 && (
              <div className="stock-modal__total-row">
                <span>Despesas acessórias</span>
                <span>{formatBRL(expenseTotal)}</span>
              </div>
            )}
            <div className="stock-modal__total-row stock-modal__total-row--final">
              <span>Total da entrada</span>
              <span>{formatBRL(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="stock-modal__footer">
          <button type="button" className="stock-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="stock-modal__btn-save"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}
