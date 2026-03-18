import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/services/api';
import { createGoodsReturn } from '@/hooks/useGoodsReturns';
import { GR_RETURN_REASON_LABELS, GR_RETURN_ACTION_LABELS } from '@/hooks/useGoodsReturns';
import './GoodsReturnModal.css';

// ─── Types ────────────────────────────────────────────────────────

export interface GoodsReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConfirmedReceipt {
  id: string;
  sequentialNumber: string;
  supplierName: string;
  items: ReceiptItem[];
}

interface ReceiptItem {
  id: string;
  productName: string;
  unitName: string;
  receivedQty: number;
  unitPrice: number;
}

interface ConfirmedReceiptsResponse {
  data: Array<{
    id: string;
    sequentialNumber: string;
    supplier: { name: string };
    items: Array<{
      id: string;
      productName: string;
      unitName: string;
      receivedQty: number;
      unitPrice: number;
    }>;
  }>;
}

interface ItemRow {
  itemId: string;
  productName: string;
  unitName: string;
  receivedQty: number;
  unitPrice: number;
  selected: boolean;
  returnQty: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Main Modal ───────────────────────────────────────────────────

function GoodsReturnModal({ isOpen, onClose, onSuccess }: GoodsReturnModalProps) {
  // Receipt selection
  const [receipts, setReceipts] = useState<ConfirmedReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ConfirmedReceipt | null>(null);

  // Form fields
  const [reason, setReason] = useState('');
  const [expectedAction, setExpectedAction] = useState('');
  const [resolutionDeadline, setResolutionDeadline] = useState('');
  const [nfOpen, setNfOpen] = useState(false);
  const [returnInvoiceNumber, setReturnInvoiceNumber] = useState('');
  const [returnInvoiceDate, setReturnInvoiceDate] = useState('');
  const [notes, setNotes] = useState('');

  // Item rows
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load confirmed receipts on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingReceipts(true);
    void api
      .get<ConfirmedReceiptsResponse>('/org/goods-receipts?status=CONFIRMADO&limit=100')
      .then((res) => {
        if (cancelled) return;
        setReceipts(
          res.data.map((r) => ({
            id: r.id,
            sequentialNumber: r.sequentialNumber,
            supplierName: r.supplier.name,
            items: r.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              unitName: item.unitName,
              receivedQty: item.receivedQty,
              unitPrice: item.unitPrice,
            })),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setReceipts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReceipts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Update item rows when receipt selection changes
  useEffect(() => {
    if (!selectedReceiptId) {
      setSelectedReceipt(null);
      setItemRows([]);
      return;
    }
    const receipt = receipts.find((r) => r.id === selectedReceiptId);
    if (!receipt) return;
    setSelectedReceipt(receipt);
    setItemRows(
      receipt.items.map((item) => ({
        itemId: item.id,
        productName: item.productName,
        unitName: item.unitName,
        receivedQty: item.receivedQty,
        unitPrice: item.unitPrice,
        selected: false,
        returnQty: '',
      })),
    );
  }, [selectedReceiptId, receipts]);

  const handleSelectAll = useCallback((checked: boolean) => {
    setItemRows((rows) =>
      rows.map((r) => ({
        ...r,
        selected: checked,
        returnQty: checked ? String(r.receivedQty) : r.returnQty,
      })),
    );
  }, []);

  const handleItemCheck = useCallback((itemId: string, checked: boolean) => {
    setItemRows((rows) =>
      rows.map((r) =>
        r.itemId === itemId
          ? { ...r, selected: checked, returnQty: checked ? String(r.receivedQty) : r.returnQty }
          : r,
      ),
    );
  }, []);

  const handleReturnQtyChange = useCallback((itemId: string, value: string) => {
    setItemRows((rows) => rows.map((r) => (r.itemId === itemId ? { ...r, returnQty: value } : r)));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    if (!selectedReceiptId) errs.receipt = 'Selecione um recebimento';
    if (!reason) errs.reason = 'Informe o motivo da devolução';
    if (!expectedAction) errs.expectedAction = 'Selecione a ação esperada';

    const selectedItems = itemRows.filter((r) => r.selected);
    if (selectedItems.length === 0) errs.items = 'Selecione ao menos um item para devolver';

    selectedItems.forEach((item) => {
      const qty = parseFloat(item.returnQty);
      if (!item.returnQty || isNaN(qty) || qty <= 0) {
        errs[`qty_${item.itemId}`] = `Quantidade inválida para ${item.productName}`;
      } else if (qty > item.receivedQty) {
        errs[`qty_${item.itemId}`] =
          `Quantidade não pode exceder ${item.receivedQty} para ${item.productName}`;
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [selectedReceiptId, reason, expectedAction, itemRows]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedItems = itemRows.filter((r) => r.selected);
      await createGoodsReturn({
        goodsReceiptId: selectedReceiptId,
        reason,
        expectedAction,
        resolutionDeadline: resolutionDeadline || undefined,
        returnInvoiceNumber: returnInvoiceNumber || undefined,
        returnInvoiceDate: returnInvoiceDate || undefined,
        notes: notes || undefined,
        items: selectedItems.map((item) => ({
          goodsReceiptItemId: item.itemId,
          returnQty: parseFloat(item.returnQty),
        })),
      });
      setSuccessMessage('Devolução registrada com sucesso');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível registrar a devolução.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    itemRows,
    selectedReceiptId,
    reason,
    expectedAction,
    resolutionDeadline,
    returnInvoiceNumber,
    returnInvoiceDate,
    notes,
    onSuccess,
  ]);

  const filteredReceipts = receipts.filter(
    (r) =>
      !receiptSearch ||
      r.sequentialNumber.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(receiptSearch.toLowerCase()),
  );

  const allSelected = itemRows.length > 0 && itemRows.every((r) => r.selected);
  const someSelected = itemRows.some((r) => r.selected);

  if (!isOpen) return null;

  return (
    <div
      className="gr-return-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar devolução"
    >
      <div className="gr-return-modal">
        {/* Header */}
        <div className="gr-return-modal__header">
          <h2 className="gr-return-modal__title">Registrar Devolução</h2>
          <button
            type="button"
            className="gr-return-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={isSubmitting}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="gr-return-modal__body">
          {successMessage && (
            <div className="gr-return-modal__success" role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              {successMessage}
            </div>
          )}

          {submitError && (
            <div className="gr-return-modal__error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {/* 1. Recebimento */}
          <div className="gr-return-modal__section">
            <label htmlFor="gr-return-receipt" className="gr-return-modal__label">
              Recebimento *
            </label>
            {errors.receipt && (
              <span className="gr-return-modal__field-error" role="alert">
                {errors.receipt}
              </span>
            )}
            <div className="gr-return-modal__receipt-search">
              <input
                type="search"
                className="gr-return-modal__input"
                placeholder="Buscar por numero ou fornecedor..."
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                aria-label="Buscar recebimento"
              />
            </div>
            {isLoadingReceipts ? (
              <div className="gr-return-modal__loading">
                <Loader2 size={16} aria-hidden="true" className="gr-return-modal__spinner" />
                Carregando recebimentos...
              </div>
            ) : (
              <select
                id="gr-return-receipt"
                className={`gr-return-modal__select ${errors.receipt ? 'gr-return-modal__select--error' : ''}`}
                value={selectedReceiptId}
                onChange={(e) => {
                  setSelectedReceiptId(e.target.value);
                  setErrors((prev) => ({ ...prev, receipt: '' }));
                }}
                aria-required="true"
              >
                <option value="">Selecione um recebimento confirmado...</option>
                {filteredReceipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sequentialNumber} — {r.supplierName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Motivo */}
          <div className="gr-return-modal__section">
            <label htmlFor="gr-return-reason" className="gr-return-modal__label">
              Motivo *
            </label>
            {errors.reason && (
              <span className="gr-return-modal__field-error" role="alert">
                {errors.reason}
              </span>
            )}
            <select
              id="gr-return-reason"
              className={`gr-return-modal__select ${errors.reason ? 'gr-return-modal__select--error' : ''}`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((prev) => ({ ...prev, reason: '' }));
              }}
              aria-required="true"
            >
              <option value="">Selecione o motivo...</option>
              {Object.entries(GR_RETURN_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Ação esperada */}
          <div className="gr-return-modal__section">
            <fieldset className="gr-return-modal__fieldset">
              <legend className="gr-return-modal__label">Ação Esperada *</legend>
              {errors.expectedAction && (
                <span className="gr-return-modal__field-error" role="alert">
                  {errors.expectedAction}
                </span>
              )}
              <div className="gr-return-modal__radio-group">
                {Object.entries(GR_RETURN_ACTION_LABELS).map(([value, label]) => {
                  const descriptions: Record<string, string> = {
                    TROCA: 'Aguarda nova entrega',
                    CREDITO: 'Abatimento na conta a pagar',
                    ESTORNO: 'Reduz valor da conta a pagar',
                  };
                  return (
                    <label key={value} className="gr-return-modal__radio-option">
                      <input
                        type="radio"
                        name="expectedAction"
                        value={value}
                        checked={expectedAction === value}
                        onChange={() => {
                          setExpectedAction(value);
                          setErrors((prev) => ({ ...prev, expectedAction: '' }));
                        }}
                        className="gr-return-modal__radio-input"
                      />
                      <div className="gr-return-modal__radio-content">
                        <span className="gr-return-modal__radio-label">{label}</span>
                        <span className="gr-return-modal__radio-desc">{descriptions[value]}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* 4. Itens a devolver */}
          {selectedReceipt && (
            <div className="gr-return-modal__section">
              <div className="gr-return-modal__items-header">
                <span className="gr-return-modal__label">Itens a devolver *</span>
                {errors.items && (
                  <span className="gr-return-modal__field-error" role="alert">
                    {errors.items}
                  </span>
                )}
              </div>
              <div className="gr-return-modal__items-table-wrapper">
                <table className="gr-return-modal__items-table">
                  <caption className="sr-only">Itens do recebimento para devolução</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Selecionar todos os itens"
                          className="gr-return-modal__checkbox"
                        />
                      </th>
                      <th scope="col">Produto</th>
                      <th scope="col">Unidade</th>
                      <th scope="col">Qtd recebida</th>
                      <th scope="col">Qtd a devolver *</th>
                      <th scope="col">Preço unitário</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.map((row) => {
                      const returnQtyNum = parseFloat(row.returnQty);
                      const total =
                        row.selected && !isNaN(returnQtyNum) ? returnQtyNum * row.unitPrice : null;
                      const qtyError = errors[`qty_${row.itemId}`];

                      return (
                        <tr
                          key={row.itemId}
                          className={row.selected ? 'gr-return-modal__item-row--selected' : ''}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => handleItemCheck(row.itemId, e.target.checked)}
                              aria-label={`Selecionar ${row.productName}`}
                              className="gr-return-modal__checkbox"
                            />
                          </td>
                          <td>{row.productName}</td>
                          <td>{row.unitName}</td>
                          <td>{row.receivedQty}</td>
                          <td>
                            <div className="gr-return-modal__qty-cell">
                              <input
                                type="number"
                                className={`gr-return-modal__qty-input ${qtyError ? 'gr-return-modal__qty-input--error' : ''}`}
                                value={row.returnQty}
                                min={0}
                                max={row.receivedQty}
                                step="any"
                                disabled={!row.selected}
                                onChange={(e) => handleReturnQtyChange(row.itemId, e.target.value)}
                                aria-label={`Quantidade a devolver de ${row.productName}`}
                              />
                              {qtyError && (
                                <span className="gr-return-modal__qty-error" role="alert">
                                  {qtyError}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{formatBRL(row.unitPrice)}</td>
                          <td>{total !== null ? formatBRL(total) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Prazo de resolução */}
          <div className="gr-return-modal__section">
            <label htmlFor="gr-return-deadline" className="gr-return-modal__label">
              Prazo de resolução
            </label>
            <input
              id="gr-return-deadline"
              type="date"
              className="gr-return-modal__input"
              value={resolutionDeadline}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setResolutionDeadline(e.target.value)}
            />
          </div>

          {/* 6. NF de devolução (collapsed) */}
          <div className="gr-return-modal__section">
            <button
              type="button"
              className="gr-return-modal__collapse-toggle"
              onClick={() => setNfOpen((v) => !v)}
              aria-expanded={nfOpen}
            >
              <span>NF de devolução (opcional)</span>
              {nfOpen ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>
            {nfOpen && (
              <div className="gr-return-modal__nf-fields">
                <div className="gr-return-modal__field-row">
                  <div className="gr-return-modal__field">
                    <label htmlFor="gr-return-nf-number" className="gr-return-modal__label">
                      Número da NF
                    </label>
                    <input
                      id="gr-return-nf-number"
                      type="text"
                      className="gr-return-modal__input"
                      value={returnInvoiceNumber}
                      onChange={(e) => setReturnInvoiceNumber(e.target.value)}
                      placeholder="ex: 001234"
                    />
                  </div>
                  <div className="gr-return-modal__field">
                    <label htmlFor="gr-return-nf-date" className="gr-return-modal__label">
                      Data da NF
                    </label>
                    <input
                      id="gr-return-nf-date"
                      type="date"
                      className="gr-return-modal__input"
                      value={returnInvoiceDate}
                      onChange={(e) => setReturnInvoiceDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 7. Observações */}
          <div className="gr-return-modal__section">
            <label htmlFor="gr-return-notes" className="gr-return-modal__label">
              Observações
            </label>
            <textarea
              id="gr-return-notes"
              className="gr-return-modal__textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre a devolução..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="gr-return-modal__footer">
          <button
            type="button"
            className="gr-return-modal__cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="gr-return-modal__submit-btn"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="gr-return-modal__spinner" />
                Registrando...
              </>
            ) : (
              'Registrar Devolução'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoodsReturnModal;
