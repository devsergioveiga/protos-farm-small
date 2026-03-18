import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Eye,
  XCircle,
  Warehouse,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  History,
} from 'lucide-react';
import {
  useStockOutputs,
  useMovementHistory,
  useExportMovementsCSV,
} from '@/hooks/useStockOutputs';
import type { StockOutput } from '@/hooks/useStockOutputs';
import { useStockBalances } from '@/hooks/useStockEntries';
import StockOutputModal from '@/components/stock-outputs/StockOutputModal';
import { api } from '@/services/api';
import './StockOutputsPage.css';

// ─── Constants ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
  CONSUMPTION: 'Consumo op.',
  MANUAL_CONSUMPTION: 'Consumo manual',
  TRANSFER: 'Transferência',
  DISPOSAL: 'Descarte',
};

const DIRECTION_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProductOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export default function StockOutputsPage() {
  const [activeTab, setActiveTab] = useState<'outputs' | 'movements' | 'balances'>('outputs');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<StockOutput | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Movements tab state
  const [movProductId, setMovProductId] = useState('');
  const [movDateFrom, setMovDateFrom] = useState('');
  const [movDateTo, setMovDateTo] = useState('');
  const [movPage, setMovPage] = useState(1);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load product options for movements selector
  useEffect(() => {
    if (activeTab === 'movements' && productOptions.length === 0) {
      void api
        .get<{ data: ProductOption[] }>('/org/products?nature=PRODUCT&status=ACTIVE&limit=500')
        .then((res) => setProductOptions(res.data))
        .catch(() => setProductOptions([]));
    }
  }, [activeTab, productOptions.length]);

  // Outputs tab
  const {
    outputs,
    meta: outputsMeta,
    isLoading: outputsLoading,
    error: outputsError,
    refetch: refetchOutputs,
  } = useStockOutputs({
    page,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    responsibleName: activeTab === 'outputs' ? search || undefined : undefined,
  });

  // Movements tab
  const {
    movements,
    meta: movementsMeta,
    isLoading: movementsLoading,
    error: movementsError,
  } = useMovementHistory(movProductId || null, {
    page: movPage,
    dateFrom: movDateFrom || undefined,
    dateTo: movDateTo || undefined,
  });

  const { exportCSV, exporting } = useExportMovementsCSV();

  // Balances tab
  const {
    balances,
    meta: balancesMeta,
    isLoading: balancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useStockBalances({
    page: activeTab === 'balances' ? page : 1,
    search: activeTab === 'balances' ? search || undefined : undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    void refetchOutputs();
    void refetchBalances();
    setToast('Saída registrada com sucesso');
    setTimeout(() => setToast(null), 5000);
  }, [refetchOutputs, refetchBalances]);

  const handleCancel = useCallback(
    async (output: StockOutput, e: React.MouseEvent) => {
      e.stopPropagation();
      if (output.status === 'CANCELLED') return;
      try {
        await api.post(`/org/stock-outputs/${output.id}/cancel`);
        void refetchOutputs();
        void refetchBalances();
        setToast('Saída cancelada');
        setTimeout(() => setToast(null), 5000);
      } catch {
        /* handled by refetch */
      }
    },
    [refetchOutputs, refetchBalances],
  );

  const handleTabChange = useCallback((tab: 'outputs' | 'movements' | 'balances') => {
    setActiveTab(tab);
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setMovPage(1);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!movProductId) return;
    void exportCSV(movProductId, movDateFrom || undefined, movDateTo || undefined);
  }, [movProductId, movDateFrom, movDateTo, exportCSV]);

  // Resolve loading/error/meta per tab
  const isLoading =
    activeTab === 'outputs'
      ? outputsLoading
      : activeTab === 'movements'
        ? movementsLoading
        : balancesLoading;

  const error =
    activeTab === 'outputs'
      ? outputsError
      : activeTab === 'movements'
        ? movementsError
        : balancesError;

  const meta =
    activeTab === 'outputs'
      ? outputsMeta
      : activeTab === 'movements'
        ? movementsMeta
        : balancesMeta;

  const currentPage = activeTab === 'movements' ? movPage : page;
  const setCurrentPage = activeTab === 'movements' ? setMovPage : setPage;

  return (
    <div className="stock-outputs-page">
      {toast && <div className="stock-outputs-page__toast">{toast}</div>}

      <header className="stock-outputs-page__header">
        <div>
          <h1>Saídas de Estoque</h1>
          <p>Gerencie saídas, movimentações e saldos de estoque</p>
        </div>
        {activeTab === 'outputs' && (
          <button className="stock-outputs-page__btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} aria-hidden="true" />
            Nova saída
          </button>
        )}
      </header>

      <nav className="stock-outputs-page__tabs" aria-label="Seção do estoque">
        <button
          className={
            activeTab === 'outputs' ? 'stock-outputs-page__tab--active' : 'stock-outputs-page__tab'
          }
          onClick={() => handleTabChange('outputs')}
          aria-current={activeTab === 'outputs' ? 'page' : undefined}
        >
          <ArrowUpRight size={16} aria-hidden="true" />
          Saídas
        </button>
        <button
          className={
            activeTab === 'movements'
              ? 'stock-outputs-page__tab--active'
              : 'stock-outputs-page__tab'
          }
          onClick={() => handleTabChange('movements')}
          aria-current={activeTab === 'movements' ? 'page' : undefined}
        >
          <History size={16} aria-hidden="true" />
          Movimentações
        </button>
        <button
          className={
            activeTab === 'balances' ? 'stock-outputs-page__tab--active' : 'stock-outputs-page__tab'
          }
          onClick={() => handleTabChange('balances')}
          aria-current={activeTab === 'balances' ? 'page' : undefined}
        >
          <Warehouse size={16} aria-hidden="true" />
          Saldos
        </button>
      </nav>

      {/* Toolbar — Outputs tab */}
      {activeTab === 'outputs' && (
        <div className="stock-outputs-page__toolbar">
          <div className="stock-outputs-page__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por responsável..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos os tipos</option>
            <option value="CONSUMPTION">Consumo op.</option>
            <option value="MANUAL_CONSUMPTION">Consumo manual</option>
            <option value="TRANSFER">Transferência</option>
            <option value="DISPOSAL">Descarte</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="Data final"
          />
        </div>
      )}

      {/* Toolbar — Movements tab */}
      {activeTab === 'movements' && (
        <>
          <div className="stock-outputs-page__movement-selector">
            <label htmlFor="mov-product">Produto</label>
            <select
              id="mov-product"
              value={movProductId}
              onChange={(e) => {
                setMovProductId(e.target.value);
                setMovPage(1);
              }}
            >
              <option value="">Selecione um produto...</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {movProductId && (
            <div className="stock-outputs-page__toolbar">
              <input
                type="date"
                value={movDateFrom}
                onChange={(e) => {
                  setMovDateFrom(e.target.value);
                  setMovPage(1);
                }}
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={movDateTo}
                onChange={(e) => {
                  setMovDateTo(e.target.value);
                  setMovPage(1);
                }}
                aria-label="Data final"
              />
              <button
                className="stock-outputs-page__btn-secondary"
                onClick={handleExportCSV}
                disabled={exporting}
              >
                <Download size={16} aria-hidden="true" />
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Toolbar — Balances tab */}
      {activeTab === 'balances' && (
        <div className="stock-outputs-page__toolbar">
          <div className="stock-outputs-page__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por produto..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="stock-outputs-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="stock-outputs-page__skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stock-outputs-page__skeleton-row" />
          ))}
        </div>
      )}

      {/* ─── Outputs tab ───────────────────────────────────────── */}
      {!isLoading && !error && activeTab === 'outputs' && (
        <>
          {outputs.length === 0 ? (
            <div className="stock-outputs-page__empty">
              <ArrowUpRight size={48} aria-hidden="true" />
              <h3>Nenhuma saída encontrada</h3>
              <p>
                {search || statusFilter || typeFilter || dateFrom || dateTo
                  ? 'Tente alterar os filtros.'
                  : 'Registre sua primeira saída de estoque.'}
              </p>
            </div>
          ) : (
            <table className="stock-outputs-page__table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Itens</th>
                  <th scope="col">Custo total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {outputs.map((output) => (
                  <tr key={output.id} onClick={() => setSelectedOutput(output)}>
                    <td data-label="Data">{formatDate(output.outputDate)}</td>
                    <td data-label="Tipo">
                      <span
                        className={`stock-outputs-page__type-badge stock-outputs-page__type-badge--${output.type.toLowerCase()}`}
                      >
                        {TYPE_LABELS[output.type] || output.type}
                      </span>
                    </td>
                    <td data-label="Responsável">{output.responsibleName || '—'}</td>
                    <td data-label="Itens">{output.items.length}</td>
                    <td data-label="Custo total">
                      <span className="stock-outputs-page__mono">
                        {formatBRL(output.totalCost)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`stock-outputs-page__badge stock-outputs-page__badge--${output.status.toLowerCase()}`}
                      >
                        {STATUS_LABELS[output.status] || output.status}
                      </span>
                    </td>
                    <td>
                      <div className="stock-outputs-page__actions">
                        <button
                          className="stock-outputs-page__icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOutput(output);
                          }}
                          aria-label="Ver detalhes"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        {output.status === 'CONFIRMED' && (
                          <button
                            className="stock-outputs-page__icon-btn stock-outputs-page__icon-btn--danger"
                            onClick={(e) => handleCancel(output, e)}
                            aria-label="Cancelar saída"
                          >
                            <XCircle size={16} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ─── Movements tab ─────────────────────────────────────── */}
      {!isLoading && !error && activeTab === 'movements' && (
        <>
          {!movProductId ? (
            <div className="stock-outputs-page__empty">
              <History size={48} aria-hidden="true" />
              <h3>Selecione um produto</h3>
              <p>Escolha um produto acima para ver o histórico de entradas e saídas.</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="stock-outputs-page__empty">
              <History size={48} aria-hidden="true" />
              <h3>Nenhuma movimentação encontrada</h3>
              <p>
                {movDateFrom || movDateTo
                  ? 'Tente alterar o período.'
                  : 'Este produto ainda não possui movimentações.'}
              </p>
            </div>
          ) : (
            <table className="stock-outputs-page__table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Direção</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Quantidade</th>
                  <th scope="col">Custo unit.</th>
                  <th scope="col">Custo total</th>
                  <th scope="col">Saldo após</th>
                  <th scope="col">Referência</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => (
                  <tr key={mov.id}>
                    <td data-label="Data">{formatDate(mov.date)}</td>
                    <td data-label="Direção">
                      <span
                        className={`stock-outputs-page__direction-badge stock-outputs-page__direction-badge--${mov.direction.toLowerCase()}`}
                      >
                        {mov.direction === 'IN' ? (
                          <ArrowDownRight size={12} aria-hidden="true" />
                        ) : (
                          <ArrowUpRight size={12} aria-hidden="true" />
                        )}
                        {DIRECTION_LABELS[mov.direction]}
                      </span>
                    </td>
                    <td data-label="Tipo">{TYPE_LABELS[mov.type] || mov.type}</td>
                    <td data-label="Quantidade">
                      <span className="stock-outputs-page__mono">
                        {mov.quantity.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td data-label="Custo unit.">
                      <span className="stock-outputs-page__mono">{formatBRL(mov.unitCost)}</span>
                    </td>
                    <td data-label="Custo total">
                      <span className="stock-outputs-page__mono">{formatBRL(mov.totalCost)}</span>
                    </td>
                    <td data-label="Saldo após">
                      <span className="stock-outputs-page__mono">
                        {mov.balanceAfter.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td data-label="Referência">{mov.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ─── Balances tab ──────────────────────────────────────── */}
      {!isLoading && !error && activeTab === 'balances' && (
        <>
          {balances.length === 0 ? (
            <div className="stock-outputs-page__empty">
              <Warehouse size={48} aria-hidden="true" />
              <h3>Nenhum saldo encontrado</h3>
              <p>{search ? 'Tente alterar a busca.' : 'Registre entradas para ver os saldos.'}</p>
            </div>
          ) : (
            <table className="stock-outputs-page__table">
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Custo médio</th>
                  <th scope="col">Valor total</th>
                  <th scope="col">Última entrada</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Produto">
                      <strong>{b.productName}</strong>
                    </td>
                    <td data-label="Tipo">{b.productType}</td>
                    <td data-label="Saldo">
                      <span className="stock-outputs-page__mono">
                        {b.currentQuantity.toLocaleString('pt-BR')} {b.measurementUnit || ''}
                      </span>
                    </td>
                    <td data-label="Custo médio">
                      <span className="stock-outputs-page__mono">{formatBRL(b.averageCost)}</span>
                    </td>
                    <td data-label="Valor total">
                      <span className="stock-outputs-page__mono">{formatBRL(b.totalValue)}</span>
                    </td>
                    <td data-label="Última entrada">
                      {b.lastEntryDate ? formatDate(b.lastEntryDate) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="stock-outputs-page__pagination">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            disabled={currentPage >= meta.totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      )}

      {/* Output detail modal */}
      {selectedOutput && (
        <div className="stock-outputs-page__detail-overlay" onClick={() => setSelectedOutput(null)}>
          <div
            className="stock-outputs-page__detail"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da saída"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Saída — {formatDate(selectedOutput.outputDate)}</h2>
            <div className="stock-outputs-page__detail-grid">
              <div className="stock-outputs-page__detail-field">
                <label>Tipo</label>
                <span>{TYPE_LABELS[selectedOutput.type] || selectedOutput.type}</span>
              </div>
              <div className="stock-outputs-page__detail-field">
                <label>Status</label>
                <span>{STATUS_LABELS[selectedOutput.status]}</span>
              </div>
              <div className="stock-outputs-page__detail-field">
                <label>Responsável</label>
                <span>{selectedOutput.responsibleName || '—'}</span>
              </div>
              <div className="stock-outputs-page__detail-field">
                <label>Custo total</label>
                <span className="stock-outputs-page__mono">
                  {formatBRL(selectedOutput.totalCost)}
                </span>
              </div>

              {selectedOutput.type === 'CONSUMPTION' && (
                <>
                  <div className="stock-outputs-page__detail-field">
                    <label>Referência da operação</label>
                    <span>{selectedOutput.fieldOperationRef || '—'}</span>
                  </div>
                  <div className="stock-outputs-page__detail-field">
                    <label>Talhão</label>
                    <span>{selectedOutput.fieldPlotName || '—'}</span>
                  </div>
                </>
              )}

              {selectedOutput.type === 'TRANSFER' && (
                <>
                  <div className="stock-outputs-page__detail-field">
                    <label>Origem</label>
                    <span>
                      {[selectedOutput.sourceFarmName, selectedOutput.sourceLocation]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </span>
                  </div>
                  <div className="stock-outputs-page__detail-field">
                    <label>Destino</label>
                    <span>
                      {[selectedOutput.destinationFarmName, selectedOutput.destinationLocation]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </span>
                  </div>
                </>
              )}

              {selectedOutput.type === 'DISPOSAL' && (
                <>
                  <div className="stock-outputs-page__detail-field">
                    <label>Motivo</label>
                    <span>{selectedOutput.disposalReason || '—'}</span>
                  </div>
                  <div className="stock-outputs-page__detail-field">
                    <label>Autorizado por</label>
                    <span>{selectedOutput.authorizedBy || '—'}</span>
                  </div>
                </>
              )}
            </div>

            {selectedOutput.type === 'DISPOSAL' && selectedOutput.disposalJustification && (
              <>
                <h3 className="stock-outputs-page__detail-section">Justificativa do descarte</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {selectedOutput.disposalJustification}
                </p>
              </>
            )}

            {selectedOutput.forceInsufficient && selectedOutput.insufficientJustification && (
              <>
                <h3 className="stock-outputs-page__detail-section">
                  Justificativa — saldo insuficiente
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {selectedOutput.insufficientJustification}
                </p>
              </>
            )}

            <h3 className="stock-outputs-page__detail-section">
              Itens ({selectedOutput.items.length})
            </h3>
            {selectedOutput.items.map((item) => (
              <div key={item.id} className="stock-outputs-page__detail-item">
                <div className="stock-outputs-page__detail-item-row">
                  <strong>{item.productName}</strong>
                  <span className="stock-outputs-page__mono">{formatBRL(item.totalCost)}</span>
                </div>
                <div className="stock-outputs-page__detail-item-sub">
                  {item.quantity.toLocaleString('pt-BR')} un × {formatBRL(item.unitCost)}
                  {item.batchNumber && <> — Lote: {item.batchNumber}</>}
                </div>
              </div>
            ))}

            {selectedOutput.notes && (
              <>
                <h3 className="stock-outputs-page__detail-section">Observações</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {selectedOutput.notes}
                </p>
              </>
            )}

            <div className="stock-outputs-page__detail-close">
              <button type="button" onClick={() => setSelectedOutput(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <StockOutputModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
