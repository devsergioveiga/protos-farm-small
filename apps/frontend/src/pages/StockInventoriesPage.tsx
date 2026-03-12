import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  ArrowLeft,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Save,
} from 'lucide-react';
import {
  useStockInventories,
  type Inventory,
  type InventoryItem,
  type InventoryStatus,
} from '@/hooks/useStockInventories';
import './StockInventoriesPage.css';

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatQty(value: number, unit: string | null) {
  const formatted = value % 1 === 0 ? String(value) : value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

type ToastType = 'success' | 'error';

// ─── Page Component ─────────────────────────────────────────────────

function StockInventoriesPage() {
  const {
    inventories,
    currentInventory,
    report,
    loading,
    error,
    fetchInventories,
    fetchInventory,
    createInventory,
    recordCount,
    reconcileInventory,
    cancelInventory,
    fetchReport,
    exportReportCSV,
  } = useStockInventories();

  const [tab, setTab] = useState<'list' | 'detail'>('list');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | ''>('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReconcile, setConfirmReconcile] = useState(false);

  // Count form state — derive initial values from currentInventory, track user edits separately
  const [countEdits, setCountEdits] = useState<
    Record<string, { countedQuantity: string; reason: string }>
  >({});
  const [lastInventoryId, setLastInventoryId] = useState<string | null>(null);

  // Reset edits when switching to a different inventory (state-based reset during render)
  const currentInventoryId = currentInventory?.id ?? null;
  if (currentInventoryId && currentInventoryId !== lastInventoryId) {
    setLastInventoryId(currentInventoryId);
    setCountEdits({});
  }

  const countData = useMemo(() => {
    const data: Record<string, { countedQuantity: string; reason: string }> = {};
    if (!currentInventory) return data;
    for (const item of currentInventory.items) {
      data[item.id] = countEdits[item.id] ?? {
        countedQuantity: item.countedQuantity != null ? String(item.countedQuantity) : '',
        reason: item.reason ?? '',
      };
    }
    return data;
  }, [currentInventory, countEdits]);

  const setCountData = setCountEdits;

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType) => {
    setToast({ msg, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ─── Load list ──────────────────────────────────────────────────

  const loadList = useCallback(() => {
    fetchInventories({
      status: statusFilter || undefined,
      page,
      limit: 20,
    });
  }, [fetchInventories, statusFilter, page]);

  useEffect(() => {
    if (tab === 'list') loadList();
  }, [tab, loadList]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleCreate = async () => {
    try {
      const inv = await createInventory({});
      showToast('Inventário criado com sucesso!', 'success');
      setTab('detail');
      await fetchInventory(inv.id);
    } catch {
      showToast(error ?? 'Erro ao criar inventário', 'error');
    }
  };

  const handleOpenDetail = async (inv: Inventory) => {
    setTab('detail');
    await fetchInventory(inv.id);
    if (inv.status === 'RECONCILED') {
      await fetchReport(inv.id);
    }
  };

  const handleBackToList = () => {
    setTab('list');
    loadList();
  };

  const handleSaveCount = async () => {
    if (!currentInventory) return;
    const items = currentInventory.items
      .filter((item) => {
        const data = countData[item.id];
        return data && data.countedQuantity !== '';
      })
      .map((item) => {
        const data = countData[item.id];
        return {
          productId: item.productId,
          batchNumber: item.batchNumber ?? undefined,
          countedQuantity: Number(data.countedQuantity),
          reason: data.reason || undefined,
        };
      });

    if (items.length === 0) {
      showToast('Preencha a contagem de pelo menos um produto.', 'error');
      return;
    }

    try {
      await recordCount(currentInventory.id, items);
      showToast('Contagem salva com sucesso!', 'success');
    } catch {
      showToast(error ?? 'Erro ao salvar contagem', 'error');
    }
  };

  const handleReconcile = async () => {
    if (!currentInventory) return;
    setConfirmReconcile(false);

    const items = currentInventory.items
      .filter((item) => {
        const data = countData[item.id];
        const counted = data ? Number(data.countedQuantity) : null;
        return counted != null && counted !== item.systemQuantity;
      })
      .map((item) => ({
        productId: item.productId,
        reason: countData[item.id]?.reason || 'Ajuste de inventário',
      }));

    try {
      await reconcileInventory(currentInventory.id, items);
      showToast('Inventário conciliado com sucesso!', 'success');
    } catch {
      showToast(error ?? 'Erro ao conciliar inventário', 'error');
    }
  };

  const handleCancel = async () => {
    if (!currentInventory) return;
    setConfirmCancel(false);
    try {
      await cancelInventory(currentInventory.id);
      showToast('Inventário cancelado.', 'success');
      handleBackToList();
    } catch {
      showToast(error ?? 'Erro ao cancelar inventário', 'error');
    }
  };

  const handleExport = async () => {
    if (!currentInventory) return;
    try {
      await exportReportCSV(currentInventory.id);
    } catch {
      showToast('Erro ao exportar relatório', 'error');
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────

  const renderStatus = (status: InventoryStatus, label: string) => (
    <span className={`stock-inventories-page__status stock-inventories-page__status--${status}`}>
      {status === 'RECONCILED' && <CheckCircle size={14} aria-hidden="true" />}
      {status === 'CANCELLED' && <XCircle size={14} aria-hidden="true" />}
      {status === 'IN_PROGRESS' && <AlertTriangle size={14} aria-hidden="true" />}
      {label}
    </span>
  );

  const renderVariance = (item: InventoryItem) => {
    if (item.variance == null) return '—';
    const cls =
      item.variance > 0
        ? 'stock-inventories-page__variance--positive'
        : item.variance < 0
          ? 'stock-inventories-page__variance--negative'
          : 'stock-inventories-page__variance--zero';
    const sign = item.variance > 0 ? '+' : '';
    return (
      <span className={`stock-inventories-page__variance ${cls}`}>
        {sign}
        {formatQty(item.variance, item.measurementUnit)}
      </span>
    );
  };

  // ─── List View ──────────────────────────────────────────────────

  const renderList = () => (
    <>
      <div className="stock-inventories-page__header">
        <h1 className="stock-inventories-page__title">
          <ClipboardCheck size={24} aria-hidden="true" />
          Inventário de Estoque
        </h1>
        <div className="stock-inventories-page__actions">
          <button
            type="button"
            className="stock-inventories-page__btn stock-inventories-page__btn--primary"
            onClick={handleCreate}
            disabled={loading}
          >
            <Plus size={20} aria-hidden="true" />
            Novo inventário
          </button>
        </div>
      </div>

      <div className="stock-inventories-page__filters">
        <label htmlFor="status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="status-filter"
          className="stock-inventories-page__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as InventoryStatus | '');
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Aberto</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="RECONCILED">Conciliado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {inventories && inventories.data.length === 0 ? (
        <div className="stock-inventories-page__empty">
          <ClipboardCheck
            size={48}
            aria-hidden="true"
            className="stock-inventories-page__empty-icon"
          />
          <p className="stock-inventories-page__empty-title">Nenhum inventário ainda</p>
          <p className="stock-inventories-page__empty-desc">
            Crie um inventário para conferir o estoque físico da sua fazenda.
          </p>
          <button
            type="button"
            className="stock-inventories-page__btn stock-inventories-page__btn--primary"
            onClick={handleCreate}
            disabled={loading}
          >
            <Plus size={20} aria-hidden="true" />
            Criar primeiro inventário
          </button>
        </div>
      ) : (
        <>
          <table className="stock-inventories-page__table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Status</th>
                <th scope="col">Depósito</th>
                <th scope="col">Itens</th>
                <th scope="col">Contados</th>
                <th scope="col">Divergências</th>
              </tr>
            </thead>
            <tbody>
              {inventories?.data.map((inv) => (
                <tr
                  key={inv.id}
                  className="stock-inventories-page__table-row--clickable"
                  onClick={() => handleOpenDetail(inv)}
                >
                  <td data-label="Data">{formatDate(inv.inventoryDate)}</td>
                  <td data-label="Status">{renderStatus(inv.status, inv.statusLabel)}</td>
                  <td data-label="Depósito">{inv.storageFarmName || inv.storageLocation || '—'}</td>
                  <td data-label="Itens">{inv.itemCount}</td>
                  <td data-label="Contados">{inv.countedCount}</td>
                  <td data-label="Divergências">{inv.divergenceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {inventories && inventories.totalPages > 1 && (
            <div className="stock-inventories-page__pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <span>
                Página {inventories.page} de {inventories.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= inventories.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  // ─── Detail View ────────────────────────────────────────────────

  const renderDetail = () => {
    if (!currentInventory) return null;
    const inv = currentInventory;
    const isEditable = inv.status === 'OPEN' || inv.status === 'IN_PROGRESS';
    const isReconciled = inv.status === 'RECONCILED';
    const allCounted = inv.items.every((i) => {
      const data = countData[i.id];
      return data && data.countedQuantity !== '';
    });

    return (
      <>
        <button type="button" className="stock-inventories-page__back" onClick={handleBackToList}>
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para lista
        </button>

        <div className="stock-inventories-page__detail">
          <div className="stock-inventories-page__detail-header">
            <div>
              <h2 className="stock-inventories-page__detail-title">
                Inventário — {formatDate(inv.inventoryDate)}
              </h2>
              <p className="stock-inventories-page__detail-meta">
                {renderStatus(inv.status, inv.statusLabel)}
                {inv.storageFarmName && ` · ${inv.storageFarmName}`}
                {inv.storageLocation && ` · ${inv.storageLocation}`}
                {inv.createdBy && ` · Criado por ${inv.createdBy}`}
              </p>
            </div>
            <div className="stock-inventories-page__detail-actions">
              {isEditable && (
                <>
                  <button
                    type="button"
                    className="stock-inventories-page__btn stock-inventories-page__btn--secondary"
                    onClick={handleSaveCount}
                    disabled={loading}
                  >
                    <Save size={16} aria-hidden="true" />
                    Salvar contagem
                  </button>
                  <button
                    type="button"
                    className="stock-inventories-page__btn stock-inventories-page__btn--primary"
                    onClick={() => setConfirmReconcile(true)}
                    disabled={loading || !allCounted}
                    title={!allCounted ? 'Conte todos os itens primeiro' : undefined}
                  >
                    <CheckCircle size={16} aria-hidden="true" />
                    Conciliar
                  </button>
                  <button
                    type="button"
                    className="stock-inventories-page__btn stock-inventories-page__btn--danger"
                    onClick={() => setConfirmCancel(true)}
                    disabled={loading}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    Cancelar
                  </button>
                </>
              )}
              {isReconciled && (
                <button
                  type="button"
                  className="stock-inventories-page__btn stock-inventories-page__btn--secondary"
                  onClick={handleExport}
                  disabled={loading}
                >
                  <Download size={16} aria-hidden="true" />
                  Exportar CSV
                </button>
              )}
            </div>
          </div>

          {/* Summary for reconciled */}
          {isReconciled && report && (
            <div className="stock-inventories-page__summary">
              <div className="stock-inventories-page__summary-card">
                <div className="stock-inventories-page__summary-value">
                  {report.summary.totalItems}
                </div>
                <div className="stock-inventories-page__summary-label">Total itens</div>
              </div>
              <div className="stock-inventories-page__summary-card stock-inventories-page__summary-card--match">
                <div className="stock-inventories-page__summary-value">
                  {report.summary.matchCount}
                </div>
                <div className="stock-inventories-page__summary-label">Conferem</div>
              </div>
              <div className="stock-inventories-page__summary-card stock-inventories-page__summary-card--surplus">
                <div className="stock-inventories-page__summary-value">
                  {report.summary.surplusCount}
                </div>
                <div className="stock-inventories-page__summary-label">Sobras</div>
              </div>
              <div className="stock-inventories-page__summary-card stock-inventories-page__summary-card--shortage">
                <div className="stock-inventories-page__summary-value">
                  {report.summary.shortageCount}
                </div>
                <div className="stock-inventories-page__summary-label">Faltas</div>
              </div>
            </div>
          )}

          {/* Items table */}
          <table className="stock-inventories-page__table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Unidade</th>
                <th scope="col">Saldo sistema</th>
                <th scope="col">Contagem física</th>
                <th scope="col">Diferença</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Produto">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={16} aria-hidden="true" />
                      {item.productName}
                    </div>
                  </td>
                  <td data-label="Unidade">{item.measurementUnit || '—'}</td>
                  <td data-label="Saldo sistema">
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatQty(item.systemQuantity, null)}
                    </span>
                  </td>
                  <td data-label="Contagem física">
                    {isEditable ? (
                      <input
                        type="number"
                        className="stock-inventories-page__count-input"
                        value={countData[item.id]?.countedQuantity ?? ''}
                        onChange={(e) =>
                          setCountData((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              countedQuantity: e.target.value,
                            },
                          }))
                        }
                        min="0"
                        step="0.01"
                        placeholder="0"
                        aria-label={`Contagem de ${item.productName}`}
                      />
                    ) : (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.countedQuantity != null ? formatQty(item.countedQuantity, null) : '—'}
                      </span>
                    )}
                  </td>
                  <td data-label="Diferença">{renderVariance(item)}</td>
                  <td data-label="Motivo">
                    {isEditable ? (
                      <input
                        type="text"
                        className="stock-inventories-page__reason-input"
                        value={countData[item.id]?.reason ?? ''}
                        onChange={(e) =>
                          setCountData((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              reason: e.target.value,
                            },
                          }))
                        }
                        placeholder="Motivo da divergência"
                        aria-label={`Motivo para ${item.productName}`}
                      />
                    ) : (
                      item.reason || '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Adjustments table for reconciled */}
          {isReconciled && report && report.adjustments.length > 0 && (
            <>
              <h3
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-neutral-800)',
                  marginTop: 24,
                  marginBottom: 12,
                }}
              >
                Ajustes aplicados
              </h3>
              <table className="stock-inventories-page__table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Qtd. anterior</th>
                    <th scope="col">Qtd. nova</th>
                    <th scope="col">Ajuste</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.adjustments.map((adj) => (
                    <tr key={adj.id}>
                      <td data-label="Produto">{adj.productName}</td>
                      <td data-label="Tipo">{adj.adjustmentTypeLabel}</td>
                      <td data-label="Qtd. anterior">
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {adj.previousQuantity}
                        </span>
                      </td>
                      <td data-label="Qtd. nova">
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {adj.newQuantity}
                        </span>
                      </td>
                      <td data-label="Ajuste">
                        <span
                          className={`stock-inventories-page__variance ${
                            adj.adjustmentType === 'INVENTORY_SURPLUS'
                              ? 'stock-inventories-page__variance--positive'
                              : 'stock-inventories-page__variance--negative'
                          }`}
                        >
                          {adj.adjustmentType === 'INVENTORY_SURPLUS' ? '+' : '-'}
                          {adj.adjustmentQty}
                        </span>
                      </td>
                      <td data-label="Motivo">{adj.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="stock-inventories-page" id="main-content">
      {tab === 'list' && renderList()}
      {tab === 'detail' && renderDetail()}

      {/* Toast */}
      {toast && (
        <div
          className={`stock-inventories-page__toast stock-inventories-page__toast--${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          {toast.type === 'success' ? (
            <CheckCircle size={16} aria-hidden="true" />
          ) : (
            <AlertTriangle size={16} aria-hidden="true" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Confirm Cancel Modal */}
      {confirmCancel && (
        <div
          className="stock-inventories-page__modal-overlay"
          onClick={() => setConfirmCancel(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar cancelamento"
        >
          <div className="stock-inventories-page__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="stock-inventories-page__modal-title">Cancelar inventário?</h3>
            <p className="stock-inventories-page__modal-body">
              Esta ação não pode ser desfeita. As contagens registradas serão perdidas e nenhum
              ajuste será aplicado ao estoque.
            </p>
            <div className="stock-inventories-page__modal-actions">
              <button
                type="button"
                className="stock-inventories-page__btn stock-inventories-page__btn--secondary"
                onClick={() => setConfirmCancel(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="stock-inventories-page__btn stock-inventories-page__btn--danger"
                onClick={handleCancel}
              >
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reconcile Modal */}
      {confirmReconcile && (
        <div
          className="stock-inventories-page__modal-overlay"
          onClick={() => setConfirmReconcile(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar conciliação"
        >
          <div className="stock-inventories-page__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="stock-inventories-page__modal-title">Conciliar inventário?</h3>
            <p className="stock-inventories-page__modal-body">
              Os saldos de estoque serão ajustados de acordo com as contagens físicas informadas.
              Produtos com divergência terão seu saldo corrigido. Esta ação não pode ser desfeita.
            </p>
            <div className="stock-inventories-page__modal-actions">
              <button
                type="button"
                className="stock-inventories-page__btn stock-inventories-page__btn--secondary"
                onClick={() => setConfirmReconcile(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="stock-inventories-page__btn stock-inventories-page__btn--primary"
                onClick={handleReconcile}
              >
                Sim, conciliar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default StockInventoriesPage;
