import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import {
  createGoodsReceiptApi,
  confirmGoodsReceiptApi,
  getGoodsReceiptApi,
} from '@/hooks/useGoodsReceipts';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptItemInput,
  GoodsReceiptDivergenceInput,
  GoodsReceipt,
  ReceivingType,
  DivergenceType,
  DivergenceAction,
} from '@/types/goods-receipt';
import {
  RECEIVING_TYPE_LABELS,
  DIVERGENCE_TYPE_LABELS,
  DIVERGENCE_ACTION_LABELS,
  GR_STATUS_LABELS,
  GR_STATUS_COLORS,
} from '@/types/goods-receipt';
import './GoodsReceiptModal.css';

// ─── Types ────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  tradeName: string | null;
  document: string;
}

interface Farm {
  id: string;
  name: string;
}

interface PurchaseOrderItem {
  id: string;
  productName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

interface PurchaseOrder {
  id: string;
  sequentialNumber: string;
  status: string;
  supplier: Supplier;
  items: PurchaseOrderItem[];
  expectedDeliveryDate?: string | null;
}

interface InspectionItemRow {
  purchaseOrderItemId?: string;
  productId?: string;
  productName: string;
  unitName: string;
  orderedQty: number;
  invoiceQty: string;
  receivedQty: string;
  unitPrice: number;
  qualityVisualOk: boolean;
  batchNumber: string;
  expirationDate: string;
  qualityNotes: string;
  // divergence
  showDivergence: boolean;
  divergenceType: DivergenceType | '';
  divergenceAction: DivergenceAction | '';
  divergenceObservation: string;
}

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedPurchaseOrderId?: string;
  existingId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatBRL(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function computeDivergencePct(orderedQty: number, receivedQty: number): number {
  if (orderedQty <= 0) return 0;
  return (Math.abs(receivedQty - orderedQty) / orderedQty) * 100;
}

// ─── Step indicator ───────────────────────────────────────────────

const STEP_LABELS = ['Pedido', 'Nota Fiscal', 'Conferencia', 'Resumo'];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="gr-modal__stepper" aria-label="Progresso do formulario">
      {STEP_LABELS.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === step;
        const isCompleted = stepNum < step;
        const circleClass = isActive
          ? 'gr-modal__step-circle gr-modal__step-circle--active'
          : isCompleted
            ? 'gr-modal__step-circle gr-modal__step-circle--completed'
            : 'gr-modal__step-circle';
        return (
          <div key={stepNum} className="gr-modal__step">
            <div className={circleClass} aria-current={isActive ? 'step' : undefined}>
              {isCompleted ? <CheckCircle2 size={14} aria-hidden="true" /> : <span>{stepNum}</span>}
            </div>
            <span
              className={`gr-modal__step-label ${isActive ? 'gr-modal__step-label--active' : ''}`}
            >
              {label}
            </span>
            {index < STEP_LABELS.length - 1 && (
              <div
                className={`gr-modal__step-connector ${isCompleted ? 'gr-modal__step-connector--done' : ''}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Selecionar Pedido ────────────────────────────────────

interface Step1Props {
  emergencyMode: boolean;
  setEmergencyMode: (val: boolean) => void;
  selectedPO: PurchaseOrder | null;
  setSelectedPO: (po: PurchaseOrder | null) => void;
  receivingType: ReceivingType;
  setReceivingType: (val: ReceivingType) => void;
  emergencySupplierId: string;
  setEmergencySupplierId: (val: string) => void;
  emergencyJustification: string;
  setEmergencyJustification: (val: string) => void;
  preselectedPurchaseOrderId?: string;
}

function Step1SelectPO({
  emergencyMode,
  setEmergencyMode,
  selectedPO,
  setSelectedPO,
  receivingType,
  setReceivingType,
  emergencySupplierId,
  setEmergencySupplierId,
  emergencyJustification,
  setEmergencyJustification,
  preselectedPurchaseOrderId,
}: Step1Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  // Load suppliers for emergency mode
  useEffect(() => {
    if (!emergencyMode) return;
    let cancelled = false;
    setIsLoadingSuppliers(true);
    void api
      .get<{ data: Supplier[] }>('/org/suppliers?status=ACTIVE&limit=100')
      .then((result) => {
        if (!cancelled) setSuppliers(result.data);
      })
      .catch(() => {
        if (!cancelled) setSuppliers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuppliers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [emergencyMode]);

  // Load POs matching search
  const loadPOs = useCallback(
    async (search: string) => {
      if (emergencyMode) return;
      setIsLoadingPOs(true);
      try {
        const params = new URLSearchParams();
        params.set('status', 'CONFIRMADA');
        params.set('status2', 'EM_TRANSITO');
        if (search) params.set('search', search);
        params.set('limit', '20');
        const result = await api.get<{ data: PurchaseOrder[] }>(
          `/org/purchase-orders?${params.toString()}`,
        );
        setPoList(result.data ?? []);
      } catch {
        setPoList([]);
      } finally {
        setIsLoadingPOs(false);
      }
    },
    [emergencyMode],
  );

  // Preselect PO if provided
  useEffect(() => {
    if (preselectedPurchaseOrderId && !emergencyMode) {
      void api
        .get<PurchaseOrder>(`/org/purchase-orders/${preselectedPurchaseOrderId}`)
        .then((po) => {
          setSelectedPO(po);
          setPoList([po]);
        })
        .catch(() => {
          void loadPOs('');
        });
    } else if (!preselectedPurchaseOrderId) {
      void loadPOs(searchQuery);
    }
  }, [preselectedPurchaseOrderId, emergencyMode]); // intentional: only re-run on PO ID or mode change

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadPOs(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, loadPOs]);

  return (
    <div className="gr-modal__step-content">
      {/* Emergency toggle */}
      <div className="gr-modal__emergency-toggle">
        <label className="gr-modal__toggle-label">
          <input
            type="checkbox"
            checked={emergencyMode}
            onChange={(e) => {
              setEmergencyMode(e.target.checked);
              setSelectedPO(null);
              if (e.target.checked) {
                setReceivingType('EMERGENCIAL');
              } else {
                setReceivingType('STANDARD');
              }
            }}
            aria-describedby="emergency-hint"
          />
          <span>Recebimento emergencial (sem pedido de compra)</span>
        </label>
        <p id="emergency-hint" className="gr-modal__toggle-hint">
          Use quando a mercadoria chega sem pedido previo no sistema.
        </p>
      </div>

      {emergencyMode ? (
        <div className="gr-modal__emergency-fields">
          <div className="gr-modal__info-banner">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Recebimento emergencial registrado sem vinculo com pedido de compra.</span>
          </div>

          <div className="gr-modal__field">
            <label htmlFor="gr-emergency-supplier" className="gr-modal__label">
              Fornecedor <span aria-hidden="true">*</span>
            </label>
            {isLoadingSuppliers ? (
              <div className="gr-modal__loading-row">
                <Loader2 size={16} className="gr-modal__spin" aria-hidden="true" />
                <span>Carregando fornecedores...</span>
              </div>
            ) : (
              <select
                id="gr-emergency-supplier"
                className="gr-modal__select"
                value={emergencySupplierId}
                onChange={(e) => setEmergencySupplierId(e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione um fornecedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.tradeName ? ` (${s.tradeName})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="gr-modal__field">
            <label htmlFor="gr-emergency-justification" className="gr-modal__label">
              Justificativa <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="gr-emergency-justification"
              className="gr-modal__textarea"
              rows={3}
              placeholder="Descreva o motivo do recebimento sem pedido previo..."
              value={emergencyJustification}
              onChange={(e) => setEmergencyJustification(e.target.value)}
              aria-required="true"
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="gr-modal__field">
            <label htmlFor="gr-po-search" className="gr-modal__label">
              Buscar Pedido de Compra
            </label>
            <div className="gr-modal__search-wrapper">
              <input
                id="gr-po-search"
                type="search"
                className="gr-modal__input"
                placeholder="Numero do pedido ou nome do fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isLoadingPOs && (
                <Loader2
                  size={16}
                  className="gr-modal__spin gr-modal__search-spinner"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {poList.length === 0 && !isLoadingPOs && (
            <p className="gr-modal__empty-hint">
              Nenhum pedido encontrado. Tente outro termo ou use modo emergencial.
            </p>
          )}

          <ul className="gr-modal__po-list" aria-label="Pedidos de compra disponíveis">
            {poList.map((po) => {
              const isSelected = selectedPO?.id === po.id;
              return (
                <li key={po.id}>
                  <button
                    type="button"
                    className={`gr-modal__po-card ${isSelected ? 'gr-modal__po-card--selected' : ''}`}
                    onClick={() => setSelectedPO(isSelected ? null : po)}
                    aria-pressed={isSelected}
                  >
                    <div className="gr-modal__po-card-header">
                      <span className="gr-modal__po-number">{po.sequentialNumber}</span>
                      {isSelected && (
                        <CheckCircle2 size={16} className="gr-modal__po-check" aria-hidden="true" />
                      )}
                    </div>
                    <p className="gr-modal__po-supplier">{po.supplier.name}</p>
                    <div className="gr-modal__po-meta">
                      <span>{po.items.length} item(s)</span>
                      {po.expectedDeliveryDate && (
                        <span>Entrega: {formatDate(po.expectedDeliveryDate)}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedPO && (
            <div className="gr-modal__field">
              <label htmlFor="gr-receiving-type" className="gr-modal__label">
                Tipo de Recebimento
              </label>
              <select
                id="gr-receiving-type"
                className="gr-modal__select"
                value={receivingType}
                onChange={(e) => setReceivingType(e.target.value as ReceivingType)}
              >
                {(
                  [
                    'STANDARD',
                    'NF_ANTECIPADA',
                    'MERCADORIA_ANTECIPADA',
                    'PARCIAL',
                    'NF_FRACIONADA',
                  ] as ReceivingType[]
                ).map((rt) => (
                  <option key={rt} value={rt}>
                    {RECEIVING_TYPE_LABELS[rt]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Dados da Nota Fiscal ─────────────────────────────────

interface NfData {
  invoiceNumber: string;
  invoiceSerie: string;
  invoiceCfop: string;
  invoiceDate: string;
  invoiceTotal: string;
  invoiceKey: string;
  storageFarmId: string;
  notes: string;
}

interface Step2Props {
  nfData: NfData;
  setNfData: (data: NfData) => void;
  receivingType: ReceivingType;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function Step2NotaFiscal({
  nfData,
  setNfData,
  receivingType,
  validationErrors,
  setValidationErrors,
}: Step2Props) {
  const [farms, setFarms] = useState<Farm[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ data: Farm[] }>('/org/farms?limit=100')
      .then((result) => {
        if (!cancelled) setFarms(result.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setFarms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field: keyof NfData, value: string) {
    setNfData({ ...nfData, [field]: value });
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const showNfWarning = receivingType === 'MERCADORIA_ANTECIPADA';
  const showNfAnticipated = receivingType === 'NF_ANTECIPADA';
  const requireNf = ['STANDARD', 'PARCIAL', 'NF_FRACIONADA'].includes(receivingType);

  return (
    <div className="gr-modal__step-content">
      {showNfWarning && (
        <div className="gr-modal__info-banner gr-modal__info-banner--warning">
          <Info size={16} aria-hidden="true" />
          <span>
            Mercadoria sem NF — entrada provisoria no estoque. NF sera registrada posteriormente.
          </span>
        </div>
      )}
      {showNfAnticipated && (
        <div className="gr-modal__info-banner">
          <Info size={16} aria-hidden="true" />
          <span>
            NF registrada antecipadamente. Aguardando chegada da mercadoria para atualizar estoque.
          </span>
        </div>
      )}

      <div className="gr-modal__field-row">
        <div className="gr-modal__field">
          <label htmlFor="gr-invoice-number" className="gr-modal__label">
            Numero da NF {requireNf && <span aria-hidden="true">*</span>}
          </label>
          <input
            id="gr-invoice-number"
            type="text"
            className={`gr-modal__input ${validationErrors.invoiceNumber ? 'gr-modal__input--error' : ''}`}
            placeholder="ex: 001234"
            value={nfData.invoiceNumber}
            onChange={(e) => update('invoiceNumber', e.target.value)}
            aria-required={requireNf}
          />
          {validationErrors.invoiceNumber && (
            <span className="gr-modal__field-error" role="alert">
              <AlertCircle size={12} aria-hidden="true" />
              {validationErrors.invoiceNumber}
            </span>
          )}
        </div>

        <div className="gr-modal__field">
          <label htmlFor="gr-invoice-serie" className="gr-modal__label">
            Serie
          </label>
          <input
            id="gr-invoice-serie"
            type="text"
            className="gr-modal__input"
            placeholder="ex: 001"
            value={nfData.invoiceSerie}
            onChange={(e) => update('invoiceSerie', e.target.value)}
          />
        </div>

        <div className="gr-modal__field">
          <label htmlFor="gr-invoice-cfop" className="gr-modal__label">
            CFOP
          </label>
          <input
            id="gr-invoice-cfop"
            type="text"
            className="gr-modal__input"
            placeholder="ex: 1102"
            value={nfData.invoiceCfop}
            onChange={(e) => update('invoiceCfop', e.target.value)}
          />
        </div>
      </div>

      <div className="gr-modal__field-row">
        <div className="gr-modal__field">
          <label htmlFor="gr-invoice-date" className="gr-modal__label">
            Data de Emissao {nfData.invoiceNumber && <span aria-hidden="true">*</span>}
          </label>
          <input
            id="gr-invoice-date"
            type="date"
            className={`gr-modal__input ${validationErrors.invoiceDate ? 'gr-modal__input--error' : ''}`}
            value={nfData.invoiceDate}
            onChange={(e) => update('invoiceDate', e.target.value)}
          />
          {validationErrors.invoiceDate && (
            <span className="gr-modal__field-error" role="alert">
              <AlertCircle size={12} aria-hidden="true" />
              {validationErrors.invoiceDate}
            </span>
          )}
        </div>

        <div className="gr-modal__field">
          <label htmlFor="gr-invoice-total" className="gr-modal__label">
            Valor Total da NF (R$) {nfData.invoiceNumber && <span aria-hidden="true">*</span>}
          </label>
          <input
            id="gr-invoice-total"
            type="number"
            min="0"
            step="0.01"
            className={`gr-modal__input ${validationErrors.invoiceTotal ? 'gr-modal__input--error' : ''}`}
            placeholder="0,00"
            value={nfData.invoiceTotal}
            onChange={(e) => update('invoiceTotal', e.target.value)}
          />
          {validationErrors.invoiceTotal && (
            <span className="gr-modal__field-error" role="alert">
              <AlertCircle size={12} aria-hidden="true" />
              {validationErrors.invoiceTotal}
            </span>
          )}
        </div>
      </div>

      <div className="gr-modal__field">
        <label htmlFor="gr-invoice-key" className="gr-modal__label">
          Chave de Acesso
          <span className="gr-modal__label-hint"> (44 digitos)</span>
        </label>
        <input
          id="gr-invoice-key"
          type="text"
          className={`gr-modal__input ${validationErrors.invoiceKey ? 'gr-modal__input--error' : ''}`}
          placeholder="44 digitos da chave de acesso da NF-e"
          maxLength={44}
          value={nfData.invoiceKey}
          onChange={(e) => update('invoiceKey', e.target.value)}
        />
        {validationErrors.invoiceKey && (
          <span className="gr-modal__field-error" role="alert">
            <AlertCircle size={12} aria-hidden="true" />
            {validationErrors.invoiceKey}
          </span>
        )}
      </div>

      <div className="gr-modal__field">
        <label htmlFor="gr-storage-farm" className="gr-modal__label">
          Fazenda de Armazenamento
        </label>
        <select
          id="gr-storage-farm"
          className="gr-modal__select"
          value={nfData.storageFarmId}
          onChange={(e) => update('storageFarmId', e.target.value)}
        >
          <option value="">Selecione uma fazenda (opcional)...</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="gr-modal__field">
        <label htmlFor="gr-notes" className="gr-modal__label">
          Observacoes
        </label>
        <textarea
          id="gr-notes"
          className="gr-modal__textarea"
          rows={3}
          placeholder="Instrucoes adicionais para este recebimento..."
          value={nfData.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Step 3: Conferencia de Itens ─────────────────────────────────

interface Step3Props {
  items: InspectionItemRow[];
  setItems: React.Dispatch<React.SetStateAction<InspectionItemRow[]>>;
  isEmergency: boolean;
}

function Step3Inspection({ items, setItems, isEmergency }: Step3Props) {
  const divergenceCount = items.filter((item) => {
    const ordered = item.orderedQty;
    const received = parseFloat(item.receivedQty) || 0;
    return computeDivergencePct(ordered, received) > 5;
  }).length;

  function updateItem(index: number, field: keyof InspectionItemRow, value: unknown) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addEmergencyItem() {
    setItems((prev) => [
      ...prev,
      {
        productName: '',
        unitName: '',
        orderedQty: 0,
        invoiceQty: '',
        receivedQty: '',
        unitPrice: 0,
        qualityVisualOk: true,
        batchNumber: '',
        expirationDate: '',
        qualityNotes: '',
        showDivergence: false,
        divergenceType: '',
        divergenceAction: '',
        divergenceObservation: '',
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="gr-modal__step-content">
      {divergenceCount > 0 && (
        <div className="gr-modal__divergence-banner" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            Atencao: {divergenceCount} item(ns) com divergencia {'>'} 5%
          </span>
        </div>
      )}

      <div className="gr-modal__inspection-table-wrapper">
        <table className="gr-modal__inspection-table">
          <caption className="sr-only">Tabela de conferencia de itens</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Unidade</th>
              <th scope="col">Qtd Pedida</th>
              <th scope="col">Qtd NF</th>
              <th scope="col">Qtd Recebida</th>
              <th scope="col">Preco Unit.</th>
              <th scope="col">Visual OK</th>
              <th scope="col">Lote</th>
              <th scope="col">Validade</th>
              <th scope="col">Obs</th>
              {isEmergency && (
                <th scope="col">
                  <span className="sr-only">Remover</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const received = parseFloat(item.receivedQty) || 0;
              const divPct = computeDivergencePct(item.orderedQty, received);
              const hasDivergence = divPct > 5;

              return (
                <>
                  <tr
                    key={`row-${index}`}
                    className={hasDivergence ? 'gr-modal__inspection-row--divergent' : ''}
                  >
                    <td>
                      {isEmergency ? (
                        <input
                          type="text"
                          className="gr-modal__table-input"
                          placeholder="Nome do produto"
                          value={item.productName}
                          onChange={(e) => updateItem(index, 'productName', e.target.value)}
                          aria-label={`Produto do item ${index + 1}`}
                        />
                      ) : (
                        <span className="gr-modal__table-text">{item.productName}</span>
                      )}
                    </td>
                    <td>
                      {isEmergency ? (
                        <input
                          type="text"
                          className="gr-modal__table-input gr-modal__table-input--sm"
                          placeholder="un"
                          value={item.unitName}
                          onChange={(e) => updateItem(index, 'unitName', e.target.value)}
                          aria-label={`Unidade do item ${index + 1}`}
                        />
                      ) : (
                        <span className="gr-modal__table-text">{item.unitName}</span>
                      )}
                    </td>
                    <td>
                      {isEmergency ? (
                        <input
                          type="number"
                          className="gr-modal__table-input gr-modal__table-input--sm"
                          placeholder="0"
                          min="0"
                          step="any"
                          value={item.orderedQty || ''}
                          onChange={(e) =>
                            updateItem(index, 'orderedQty', parseFloat(e.target.value) || 0)
                          }
                          aria-label={`Qtd pedida item ${index + 1}`}
                        />
                      ) : (
                        <span className="gr-modal__table-text gr-modal__table-text--mono">
                          {item.orderedQty}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="gr-modal__table-input gr-modal__table-input--sm"
                        placeholder="0"
                        min="0"
                        step="any"
                        value={item.invoiceQty}
                        onChange={(e) => updateItem(index, 'invoiceQty', e.target.value)}
                        aria-label={`Qtd NF item ${index + 1}`}
                      />
                    </td>
                    <td>
                      <div className="gr-modal__received-cell">
                        <input
                          type="number"
                          className="gr-modal__table-input gr-modal__table-input--sm"
                          placeholder="0"
                          min="0"
                          step="any"
                          value={item.receivedQty}
                          onChange={(e) => {
                            updateItem(index, 'receivedQty', e.target.value);
                            const newReceived = parseFloat(e.target.value) || 0;
                            const newDivPct = computeDivergencePct(item.orderedQty, newReceived);
                            if (newDivPct > 5 && !item.showDivergence) {
                              updateItem(index, 'showDivergence', true);
                            }
                          }}
                          aria-label={`Qtd recebida item ${index + 1}`}
                        />
                        {hasDivergence && (
                          <span
                            className="gr-modal__divergence-badge"
                            aria-label={`Divergencia ${divPct.toFixed(1)}%`}
                          >
                            <AlertTriangle size={12} aria-hidden="true" />
                            {divPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isEmergency ? (
                        <input
                          type="number"
                          className="gr-modal__table-input gr-modal__table-input--sm"
                          placeholder="0,00"
                          min="0"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) =>
                            updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          aria-label={`Preco unitario item ${index + 1}`}
                        />
                      ) : (
                        <span className="gr-modal__table-text gr-modal__table-text--mono">
                          {formatBRL(item.unitPrice)}
                        </span>
                      )}
                    </td>
                    <td className="gr-modal__table-center">
                      <input
                        type="checkbox"
                        checked={item.qualityVisualOk}
                        onChange={(e) => updateItem(index, 'qualityVisualOk', e.target.checked)}
                        aria-label={`Visual OK item ${index + 1}`}
                        className="gr-modal__checkbox"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gr-modal__table-input gr-modal__table-input--sm"
                        placeholder="Lote..."
                        value={item.batchNumber}
                        onChange={(e) => updateItem(index, 'batchNumber', e.target.value)}
                        aria-label={`Lote item ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="gr-modal__table-input gr-modal__table-input--sm"
                        value={item.expirationDate}
                        onChange={(e) => updateItem(index, 'expirationDate', e.target.value)}
                        aria-label={`Validade item ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="gr-modal__table-input"
                        placeholder="Observacoes..."
                        value={item.qualityNotes}
                        onChange={(e) => updateItem(index, 'qualityNotes', e.target.value)}
                        aria-label={`Observacoes item ${index + 1}`}
                      />
                    </td>
                    {isEmergency && (
                      <td>
                        <button
                          type="button"
                          className="gr-modal__remove-btn"
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1}
                          aria-label={`Remover item ${index + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                  {/* Divergence registration row */}
                  {hasDivergence && item.showDivergence && (
                    <tr key={`div-${index}`} className="gr-modal__divergence-row">
                      <td colSpan={isEmergency ? 11 : 10}>
                        <div className="gr-modal__divergence-form">
                          <span className="gr-modal__divergence-form-title">
                            Registrar divergencia:
                          </span>
                          <div className="gr-modal__divergence-fields">
                            <div className="gr-modal__field gr-modal__field--inline">
                              <label
                                htmlFor={`div-type-${index}`}
                                className="gr-modal__label gr-modal__label--sm"
                              >
                                Tipo
                              </label>
                              <select
                                id={`div-type-${index}`}
                                className="gr-modal__select gr-modal__select--sm"
                                value={item.divergenceType}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    'divergenceType',
                                    e.target.value as DivergenceType | '',
                                  )
                                }
                              >
                                <option value="">Selecione...</option>
                                {(Object.keys(DIVERGENCE_TYPE_LABELS) as DivergenceType[]).map(
                                  (dt) => (
                                    <option key={dt} value={dt}>
                                      {DIVERGENCE_TYPE_LABELS[dt]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div className="gr-modal__field gr-modal__field--inline">
                              <label
                                htmlFor={`div-action-${index}`}
                                className="gr-modal__label gr-modal__label--sm"
                              >
                                Acao
                              </label>
                              <select
                                id={`div-action-${index}`}
                                className="gr-modal__select gr-modal__select--sm"
                                value={item.divergenceAction}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    'divergenceAction',
                                    e.target.value as DivergenceAction | '',
                                  )
                                }
                              >
                                <option value="">Selecione...</option>
                                {(Object.keys(DIVERGENCE_ACTION_LABELS) as DivergenceAction[]).map(
                                  (da) => (
                                    <option key={da} value={da}>
                                      {DIVERGENCE_ACTION_LABELS[da]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div className="gr-modal__field gr-modal__field--inline gr-modal__field--grow">
                              <label
                                htmlFor={`div-obs-${index}`}
                                className="gr-modal__label gr-modal__label--sm"
                              >
                                Observacao
                              </label>
                              <input
                                id={`div-obs-${index}`}
                                type="text"
                                className="gr-modal__input gr-modal__input--sm"
                                placeholder="Descricao da divergencia..."
                                value={item.divergenceObservation}
                                onChange={(e) =>
                                  updateItem(index, 'divergenceObservation', e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Show/hide divergence toggle when has divergence */}
                  {hasDivergence && !item.showDivergence && (
                    <tr key={`div-toggle-${index}`}>
                      <td colSpan={isEmergency ? 11 : 10}>
                        <button
                          type="button"
                          className="gr-modal__divergence-toggle"
                          onClick={() => updateItem(index, 'showDivergence', true)}
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          Registrar divergencia
                          <ChevronRight size={12} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEmergency && (
        <button type="button" className="gr-modal__add-item-btn" onClick={addEmergencyItem}>
          <Plus size={16} aria-hidden="true" />
          Adicionar item
        </button>
      )}
    </div>
  );
}

// ─── Step 4: Resumo e Confirmacao ─────────────────────────────────

interface Step4Props {
  selectedPO: PurchaseOrder | null;
  emergencyMode: boolean;
  emergencySupplierId: string;
  receivingType: ReceivingType;
  nfData: NfData;
  items: InspectionItemRow[];
}

function Step4Summary({
  selectedPO,
  emergencyMode,
  emergencySupplierId,
  receivingType,
  nfData,
  items,
}: Step4Props) {
  const divergingItems = items.filter((item) => {
    const received = parseFloat(item.receivedQty) || 0;
    return computeDivergencePct(item.orderedQty, received) > 5;
  });

  const totalValue = items.reduce((sum, item) => {
    const received = parseFloat(item.receivedQty) || 0;
    return sum + received * item.unitPrice;
  }, 0);

  return (
    <div className="gr-modal__step-content">
      <div className="gr-modal__summary">
        {/* Header info */}
        <div className="gr-modal__summary-section">
          <h3 className="gr-modal__summary-title">Informacoes Gerais</h3>
          <dl className="gr-modal__summary-dl">
            <div className="gr-modal__summary-row">
              <dt>Pedido de Compra</dt>
              <dd>
                {selectedPO ? selectedPO.sequentialNumber : emergencyMode ? 'Emergencial' : '—'}
              </dd>
            </div>
            <div className="gr-modal__summary-row">
              <dt>Fornecedor</dt>
              <dd>
                {selectedPO
                  ? selectedPO.supplier.name
                  : emergencySupplierId
                    ? `ID: ${emergencySupplierId}`
                    : '—'}
              </dd>
            </div>
            <div className="gr-modal__summary-row">
              <dt>Tipo de Recebimento</dt>
              <dd>{RECEIVING_TYPE_LABELS[receivingType]}</dd>
            </div>
          </dl>
        </div>

        {/* NF data */}
        {(nfData.invoiceNumber || nfData.invoiceDate) && (
          <div className="gr-modal__summary-section">
            <h3 className="gr-modal__summary-title">Nota Fiscal</h3>
            <dl className="gr-modal__summary-dl">
              {nfData.invoiceNumber && (
                <div className="gr-modal__summary-row">
                  <dt>Numero NF</dt>
                  <dd>
                    {nfData.invoiceNumber}
                    {nfData.invoiceSerie ? `/${nfData.invoiceSerie}` : ''}
                  </dd>
                </div>
              )}
              {nfData.invoiceDate && (
                <div className="gr-modal__summary-row">
                  <dt>Data de Emissao</dt>
                  <dd>{formatDate(nfData.invoiceDate)}</dd>
                </div>
              )}
              {nfData.invoiceTotal && (
                <div className="gr-modal__summary-row">
                  <dt>Valor Total</dt>
                  <dd className="gr-modal__summary-money">
                    {formatBRL(parseFloat(nfData.invoiceTotal))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Items summary */}
        <div className="gr-modal__summary-section">
          <h3 className="gr-modal__summary-title">Itens ({items.length})</h3>
          <table className="gr-modal__summary-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Qtd Pedida</th>
                <th scope="col">Qtd Recebida</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const received = parseFloat(item.receivedQty) || 0;
                const divPct = computeDivergencePct(item.orderedQty, received);
                return (
                  <tr key={index}>
                    <td>{item.productName}</td>
                    <td className="gr-modal__summary-num">{item.orderedQty}</td>
                    <td className="gr-modal__summary-num">
                      {received}
                      {divPct > 5 && (
                        <span
                          className="gr-modal__divergence-badge gr-modal__divergence-badge--sm"
                          aria-label={`divergencia ${divPct.toFixed(1)}%`}
                        >
                          <AlertTriangle size={10} aria-hidden="true" />
                          {divPct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="gr-modal__summary-money">
                      {formatBRL(received * item.unitPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="gr-modal__summary-total-label">
                  Valor total recebido:
                </td>
                <td className="gr-modal__summary-money gr-modal__summary-total">
                  {formatBRL(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Warnings */}
        {receivingType === 'MERCADORIA_ANTECIPADA' && (
          <div className="gr-modal__summary-warning">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Entrada no estoque sera criada em modo RASCUNHO (bloqueada para consumo ate NF
              chegar).
            </span>
          </div>
        )}
        {receivingType === 'NF_ANTECIPADA' && (
          <div className="gr-modal__summary-warning">
            <Info size={16} aria-hidden="true" />
            <span>
              Conta a pagar sera criada. Estoque sera atualizado quando mercadoria chegar.
            </span>
          </div>
        )}
        {divergingItems.length > 0 && (
          <div className="gr-modal__summary-warning gr-modal__summary-warning--divergence">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              {divergingItems.length} divergencia(s) registrada(s). Revise antes de confirmar.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────

function DetailView({
  receipt,
  onClose,
  onSuccess,
}: {
  receipt: GoodsReceipt;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colorClass = GR_STATUS_COLORS[receipt.status] ?? 'badge--neutral';

  async function handleConfirm() {
    setIsConfirming(true);
    setError(null);
    try {
      await confirmGoodsReceiptApi(receipt.id);
      setShowConfirmModal(false);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar recebimento');
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div
      className="gr-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gr-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gr-modal gr-modal--detail">
        {/* Header */}
        <div className="gr-modal__header">
          <div>
            <h2 id="gr-detail-title" className="gr-modal__title">
              Recebimento {receipt.sequentialNumber}
            </h2>
            <span className={`gr-badge ${colorClass}`}>{receipt.statusLabel}</span>
          </div>
          <button
            type="button"
            className="gr-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="gr-modal__body">
          {error && (
            <div className="gr-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="gr-modal__summary">
            <div className="gr-modal__summary-section">
              <h3 className="gr-modal__summary-title">Informacoes Gerais</h3>
              <dl className="gr-modal__summary-dl">
                <div className="gr-modal__summary-row">
                  <dt>Fornecedor</dt>
                  <dd>{receipt.supplier.name}</dd>
                </div>
                <div className="gr-modal__summary-row">
                  <dt>Tipo</dt>
                  <dd>{receipt.receivingTypeLabel}</dd>
                </div>
                {receipt.purchaseOrder && (
                  <div className="gr-modal__summary-row">
                    <dt>Pedido de Compra</dt>
                    <dd>
                      <button
                        type="button"
                        className="gr-modal__link-btn"
                        onClick={() => {
                          navigate(`/purchase-orders?id=${receipt.purchaseOrderId ?? ''}`);
                          onClose();
                        }}
                      >
                        {receipt.purchaseOrder.sequentialNumber}
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </dd>
                  </div>
                )}
                {receipt.payableId && (
                  <div className="gr-modal__summary-row">
                    <dt>Conta a Pagar</dt>
                    <dd>
                      <button
                        type="button"
                        className="gr-modal__link-btn"
                        onClick={() => {
                          navigate(`/payables?id=${receipt.payableId ?? ''}`);
                          onClose();
                        }}
                      >
                        Ver CP
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </dd>
                  </div>
                )}
                {receipt.confirmedAt && (
                  <div className="gr-modal__summary-row">
                    <dt>Confirmado em</dt>
                    <dd>{formatDate(receipt.confirmedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {(receipt.invoiceNumber ?? receipt.invoiceDate) && (
              <div className="gr-modal__summary-section">
                <h3 className="gr-modal__summary-title">Nota Fiscal</h3>
                <dl className="gr-modal__summary-dl">
                  {receipt.invoiceNumber && (
                    <div className="gr-modal__summary-row">
                      <dt>Numero NF</dt>
                      <dd>
                        {receipt.invoiceNumber}
                        {receipt.invoiceSerie ? `/${receipt.invoiceSerie}` : ''}
                      </dd>
                    </div>
                  )}
                  {receipt.invoiceDate && (
                    <div className="gr-modal__summary-row">
                      <dt>Data Emissao</dt>
                      <dd>{formatDate(receipt.invoiceDate)}</dd>
                    </div>
                  )}
                  {receipt.invoiceTotal !== null && (
                    <div className="gr-modal__summary-row">
                      <dt>Valor Total</dt>
                      <dd className="gr-modal__summary-money">{formatBRL(receipt.invoiceTotal)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="gr-modal__summary-section">
              <h3 className="gr-modal__summary-title">Itens ({receipt.items.length})</h3>
              <table className="gr-modal__summary-table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Qtd Pedida</th>
                    <th scope="col">Qtd Recebida</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td className="gr-modal__summary-num">{item.orderedQty}</td>
                      <td className="gr-modal__summary-num">
                        {item.receivedQty}
                        {item.hasDivergence && item.divergencePct !== null && (
                          <span className="gr-modal__divergence-badge gr-modal__divergence-badge--sm">
                            <AlertTriangle size={10} aria-hidden="true" />
                            {item.divergencePct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="gr-modal__summary-money">{formatBRL(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {receipt.divergences.length > 0 && (
              <div className="gr-modal__summary-section">
                <h3 className="gr-modal__summary-title">
                  Divergencias ({receipt.divergences.length})
                </h3>
                <ul className="gr-modal__divergence-list">
                  {receipt.divergences.map((div) => (
                    <li key={div.id} className="gr-modal__divergence-item">
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>
                        {div.divergenceTypeLabel} — {div.actionLabel}
                        {div.observation ? `: ${div.observation}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="gr-modal__footer">
          <button
            type="button"
            className="gr-modal__btn gr-modal__btn--secondary"
            onClick={onClose}
          >
            Fechar
          </button>
          {receipt.status === 'CONFERIDO' && (
            <button
              type="button"
              className="gr-modal__btn gr-modal__btn--primary"
              onClick={() => setShowConfirmModal(true)}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 size={16} className="gr-modal__spin" aria-hidden="true" />
                  Confirmando...
                </>
              ) : (
                'Confirmar Recebimento'
              )}
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirmar Recebimento"
        message="Esta acao ira gerar o lancamento no estoque e a conta a pagar. Deseja confirmar?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={isConfirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}

// ─── Wizard Inner Form ────────────────────────────────────────────

function GoodsReceiptWizard({
  onClose,
  onSuccess,
  preselectedPurchaseOrderId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  preselectedPurchaseOrderId?: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<GoodsReceipt | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Step 1 state
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receivingType, setReceivingType] = useState<ReceivingType>('STANDARD');
  const [emergencySupplierId, setEmergencySupplierId] = useState('');
  const [emergencyJustification, setEmergencyJustification] = useState('');

  // Step 2 state
  const [nfData, setNfData] = useState<NfData>({
    invoiceNumber: '',
    invoiceSerie: '',
    invoiceCfop: '',
    invoiceDate: '',
    invoiceTotal: '',
    invoiceKey: '',
    storageFarmId: '',
    notes: '',
  });
  const [nfValidationErrors, setNfValidationErrors] = useState<Record<string, string>>({});

  // Step 3 state
  const [inspectionItems, setInspectionItems] = useState<InspectionItemRow[]>([]);

  // Build inspection items when PO is selected
  useEffect(() => {
    if (selectedPO && selectedPO.items.length > 0) {
      setInspectionItems(
        selectedPO.items.map((item) => ({
          purchaseOrderItemId: item.id,
          productName: item.productName,
          unitName: item.unitName,
          orderedQty: item.quantity,
          invoiceQty: '',
          receivedQty: String(item.quantity),
          unitPrice: item.unitPrice,
          qualityVisualOk: true,
          batchNumber: '',
          expirationDate: '',
          qualityNotes: '',
          showDivergence: false,
          divergenceType: '',
          divergenceAction: '',
          divergenceObservation: '',
        })),
      );
    } else if (emergencyMode && inspectionItems.length === 0) {
      setInspectionItems([
        {
          productName: '',
          unitName: '',
          orderedQty: 0,
          invoiceQty: '',
          receivedQty: '',
          unitPrice: 0,
          qualityVisualOk: true,
          batchNumber: '',
          expirationDate: '',
          qualityNotes: '',
          showDivergence: false,
          divergenceType: '',
          divergenceAction: '',
          divergenceObservation: '',
        },
      ]);
    }
  }, [selectedPO, emergencyMode]); // intentional: only re-run when PO or mode changes

  function validateStep1(): boolean {
    if (emergencyMode) {
      if (!emergencySupplierId) {
        setError('Selecione um fornecedor para o recebimento emergencial.');
        return false;
      }
      if (!emergencyJustification.trim()) {
        setError('Informe a justificativa para o recebimento emergencial.');
        return false;
      }
    } else {
      if (!selectedPO) {
        setError('Selecione um pedido de compra ou habilite o modo emergencial.');
        return false;
      }
    }
    setError(null);
    return true;
  }

  function validateStep2(): boolean {
    const errors: Record<string, string> = {};
    const requireNf = ['STANDARD', 'PARCIAL', 'NF_FRACIONADA'].includes(receivingType);

    if (requireNf && !nfData.invoiceNumber.trim()) {
      errors.invoiceNumber = 'Numero da NF e obrigatorio para este tipo de recebimento.';
    }
    if (nfData.invoiceNumber && !nfData.invoiceDate) {
      errors.invoiceDate = 'Informe a data de emissao da NF.';
    }
    if (nfData.invoiceNumber && (!nfData.invoiceTotal || parseFloat(nfData.invoiceTotal) <= 0)) {
      errors.invoiceTotal = 'Informe o valor total da NF.';
    }
    if (nfData.invoiceKey && nfData.invoiceKey.length !== 44) {
      errors.invoiceKey = 'A chave de acesso deve ter exatamente 44 digitos.';
    }

    setNfValidationErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    setError(null);
    return true;
  }

  function validateStep3(): boolean {
    for (const item of inspectionItems) {
      const received = parseFloat(item.receivedQty);
      if (isNaN(received) || received < 0) {
        setError('Preencha a quantidade recebida para todos os itens.');
        return false;
      }
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
  }

  function buildInput(): CreateGoodsReceiptInput {
    const items: GoodsReceiptItemInput[] = inspectionItems.map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId,
      productName: item.productName,
      unitName: item.unitName,
      orderedQty: item.orderedQty,
      invoiceQty: item.invoiceQty ? parseFloat(item.invoiceQty) : undefined,
      receivedQty: parseFloat(item.receivedQty) || 0,
      unitPrice: item.unitPrice,
      qualityVisualOk: item.qualityVisualOk,
      batchNumber: item.batchNumber || undefined,
      expirationDate: item.expirationDate || undefined,
      qualityNotes: item.qualityNotes || undefined,
    }));

    const divergences: GoodsReceiptDivergenceInput[] = [];
    // divergences will be attached by itemId after creation
    // We gather them here for submission
    inspectionItems.forEach((item) => {
      const received = parseFloat(item.receivedQty) || 0;
      const divPct = computeDivergencePct(item.orderedQty, received);
      if (divPct > 5 && item.divergenceType && item.divergenceAction) {
        // itemId will be matched by index — backend can accept temp IDs
        divergences.push({
          itemId: item.purchaseOrderItemId ?? `temp-${Date.now()}`,
          divergenceType: item.divergenceType as DivergenceType,
          action: item.divergenceAction as DivergenceAction,
          observation: item.divergenceObservation || undefined,
        });
      }
    });

    return {
      purchaseOrderId: selectedPO?.id,
      supplierId: emergencyMode ? emergencySupplierId : (selectedPO?.supplier.id ?? ''),
      receivingType,
      invoiceNumber: nfData.invoiceNumber || undefined,
      invoiceSerie: nfData.invoiceSerie || undefined,
      invoiceCfop: nfData.invoiceCfop || undefined,
      invoiceDate: nfData.invoiceDate || undefined,
      invoiceTotal: nfData.invoiceTotal ? parseFloat(nfData.invoiceTotal) : undefined,
      invoiceKey: nfData.invoiceKey || undefined,
      storageFarmId: nfData.storageFarmId || undefined,
      notes: nfData.notes || undefined,
      emergencyJustification: emergencyMode ? emergencyJustification : undefined,
      items,
      divergences: divergences.length > 0 ? divergences : undefined,
    };
  }

  async function handleRegister() {
    setIsSubmitting(true);
    setError(null);
    try {
      const input = buildInput();
      const receipt = await createGoodsReceiptApi(input);
      setCreatedReceipt(receipt);
      setIsSubmitting(false);
      setShowConfirmModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel registrar o recebimento.');
      setIsSubmitting(false);
    }
  }

  async function handleConfirmNow() {
    if (!createdReceipt) return;
    setIsConfirming(true);
    try {
      await confirmGoodsReceiptApi(createdReceipt.id);
      setShowConfirmModal(false);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel confirmar o recebimento.');
      setShowConfirmModal(false);
    } finally {
      setIsConfirming(false);
    }
  }

  function handleSkipConfirm() {
    setShowConfirmModal(false);
    onSuccess();
    onClose();
  }

  return (
    <div
      className="gr-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gr-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gr-modal">
        {/* Header with step indicator */}
        <div className="gr-modal__header">
          <h2 id="gr-wizard-title" className="gr-modal__title">
            Novo Recebimento
          </h2>
          <button
            type="button"
            className="gr-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <StepIndicator step={step} />

        {/* Body */}
        <div className="gr-modal__body">
          {error && (
            <div className="gr-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {step === 1 && (
            <Step1SelectPO
              emergencyMode={emergencyMode}
              setEmergencyMode={setEmergencyMode}
              selectedPO={selectedPO}
              setSelectedPO={setSelectedPO}
              receivingType={receivingType}
              setReceivingType={setReceivingType}
              emergencySupplierId={emergencySupplierId}
              setEmergencySupplierId={setEmergencySupplierId}
              emergencyJustification={emergencyJustification}
              setEmergencyJustification={setEmergencyJustification}
              preselectedPurchaseOrderId={preselectedPurchaseOrderId}
            />
          )}
          {step === 2 && (
            <Step2NotaFiscal
              nfData={nfData}
              setNfData={setNfData}
              receivingType={receivingType}
              validationErrors={nfValidationErrors}
              setValidationErrors={setNfValidationErrors}
            />
          )}
          {step === 3 && (
            <Step3Inspection
              items={inspectionItems}
              setItems={setInspectionItems}
              isEmergency={emergencyMode}
            />
          )}
          {step === 4 && (
            <Step4Summary
              selectedPO={selectedPO}
              emergencyMode={emergencyMode}
              emergencySupplierId={emergencySupplierId}
              receivingType={receivingType}
              nfData={nfData}
              items={inspectionItems}
            />
          )}
        </div>

        {/* Footer */}
        <div className="gr-modal__footer">
          <button
            type="button"
            className="gr-modal__btn gr-modal__btn--secondary"
            onClick={step === 1 ? onClose : handleBack}
            disabled={isSubmitting}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              className="gr-modal__btn gr-modal__btn--primary"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              Proximo
            </button>
          ) : (
            <button
              type="button"
              className="gr-modal__btn gr-modal__btn--primary"
              onClick={() => void handleRegister()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="gr-modal__spin" aria-hidden="true" />
                  Registrando...
                </>
              ) : (
                'Registrar Recebimento'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation after creation */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={`Recebimento ${createdReceipt?.sequentialNumber ?? ''} registrado`}
        message="Deseja confirmar o recebimento agora? Isso ira gerar o lancamento no estoque e a conta a pagar."
        confirmLabel="Confirmar agora"
        cancelLabel="Confirmar depois"
        variant="warning"
        isLoading={isConfirming}
        onConfirm={() => void handleConfirmNow()}
        onCancel={handleSkipConfirm}
      />
    </div>
  );
}

// ─── Main modal (with detail mode) ───────────────────────────────

function GoodsReceiptModalInner({
  onClose,
  onSuccess,
  preselectedPurchaseOrderId,
  existingId,
}: Omit<GoodsReceiptModalProps, 'isOpen'>) {
  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(!!existingId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingId) return;
    let cancelled = false;
    void getGoodsReceiptApi(existingId)
      .then((r) => {
        if (!cancelled) {
          setReceipt(r);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Erro ao carregar recebimento');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [existingId]);

  if (existingId) {
    if (isLoading) {
      return (
        <div
          className="gr-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Carregando recebimento"
        >
          <div className="gr-modal gr-modal--loading">
            <Loader2 size={32} className="gr-modal__spin" aria-hidden="true" />
            <p>Carregando recebimento...</p>
          </div>
        </div>
      );
    }
    if (loadError || !receipt) {
      return (
        <div
          className="gr-modal__overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="gr-modal gr-modal--loading">
            <AlertCircle size={32} aria-hidden="true" />
            <p>{loadError ?? 'Recebimento nao encontrado.'}</p>
            <button
              type="button"
              className="gr-modal__btn gr-modal__btn--secondary"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      );
    }
    return <DetailView receipt={receipt} onClose={onClose} onSuccess={onSuccess} />;
  }

  return (
    <GoodsReceiptWizard
      key="wizard"
      onClose={onClose}
      onSuccess={onSuccess}
      preselectedPurchaseOrderId={preselectedPurchaseOrderId}
    />
  );
}

export default function GoodsReceiptModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedPurchaseOrderId,
  existingId,
}: GoodsReceiptModalProps) {
  if (!isOpen) return null;
  return (
    <GoodsReceiptModalInner
      key={existingId ?? `new-${String(isOpen)}`}
      onClose={onClose}
      onSuccess={onSuccess}
      preselectedPurchaseOrderId={preselectedPurchaseOrderId}
      existingId={existingId}
    />
  );
}

// Re-export status labels for use in GoodsReceiptsPage
export { GR_STATUS_LABELS };
