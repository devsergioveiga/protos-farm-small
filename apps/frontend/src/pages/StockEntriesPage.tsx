import { useState, useCallback, useEffect } from 'react';
import { Plus, PackageOpen, Search, AlertCircle, Eye, XCircle, Warehouse } from 'lucide-react';
import { useStockEntries, useStockBalances } from '@/hooks/useStockEntries';
import type { StockEntry } from '@/hooks/useStockEntries';
import StockEntryModal from '@/components/stock-entries/StockEntryModal';
import { api } from '@/services/api';
import './StockEntriesPage.css';

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  DRAFT: 'Rascunho',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function StockEntriesPage() {
  const [activeTab, setActiveTab] = useState<'entries' | 'balances'>('entries');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StockEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Entries tab
  const {
    entries,
    meta: entriesMeta,
    isLoading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useStockEntries({
    page,
    status: statusFilter || undefined,
    supplierName: activeTab === 'entries' ? search || undefined : undefined,
  });

  // Balances tab
  const {
    balances,
    meta: balancesMeta,
    isLoading: balancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useStockBalances({
    page,
    search: activeTab === 'balances' ? search || undefined : undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    void refetchEntries();
    void refetchBalances();
    setToast('Entrada registrada com sucesso');
    setTimeout(() => setToast(null), 5000);
  }, [refetchEntries, refetchBalances]);

  const handleCancel = useCallback(
    async (entry: StockEntry, e: React.MouseEvent) => {
      e.stopPropagation();
      if (entry.status === 'CANCELLED') return;
      try {
        await api.post(`/org/stock-entries/${entry.id}/cancel`);
        void refetchEntries();
        void refetchBalances();
        setToast('Entrada cancelada');
        setTimeout(() => setToast(null), 5000);
      } catch {
        /* handled by refetch */
      }
    },
    [refetchEntries, refetchBalances],
  );

  const handleTabChange = useCallback((tab: 'entries' | 'balances') => {
    setActiveTab(tab);
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const isLoading = activeTab === 'entries' ? entriesLoading : balancesLoading;
  const error = activeTab === 'entries' ? entriesError : balancesError;
  const meta = activeTab === 'entries' ? entriesMeta : balancesMeta;

  return (
    <div className="stock-page">
      {toast && <div className="stock-page__toast">{toast}</div>}

      <header className="stock-page__header">
        <div>
          <h1>Estoque de Insumos</h1>
          <p>Gerencie entradas e saldos de estoque</p>
        </div>
        <button className="stock-page__btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} aria-hidden="true" />
          Nova entrada
        </button>
      </header>

      <nav className="stock-page__tabs" aria-label="Seção do estoque">
        <button
          className={activeTab === 'entries' ? 'stock-page__tab--active' : 'stock-page__tab'}
          onClick={() => handleTabChange('entries')}
          aria-current={activeTab === 'entries' ? 'page' : undefined}
        >
          <PackageOpen size={16} aria-hidden="true" />
          Entradas
        </button>
        <button
          className={activeTab === 'balances' ? 'stock-page__tab--active' : 'stock-page__tab'}
          onClick={() => handleTabChange('balances')}
          aria-current={activeTab === 'balances' ? 'page' : undefined}
        >
          <Warehouse size={16} aria-hidden="true" />
          Saldos
        </button>
      </nav>

      <div className="stock-page__toolbar">
        <div className="stock-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder={
              activeTab === 'entries' ? 'Buscar por fornecedor...' : 'Buscar por produto...'
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar"
          />
        </div>
        {activeTab === 'entries' && (
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
        )}
      </div>

      {error && (
        <div className="stock-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="stock-page__skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stock-page__skeleton-row" />
          ))}
        </div>
      )}

      {/* Entries tab */}
      {!isLoading && !error && activeTab === 'entries' && (
        <>
          {entries.length === 0 ? (
            <div className="stock-page__empty">
              <PackageOpen size={48} aria-hidden="true" />
              <h3>Nenhuma entrada encontrada</h3>
              <p>
                {search || statusFilter
                  ? 'Tente alterar os filtros.'
                  : 'Registre sua primeira entrada de estoque.'}
              </p>
            </div>
          ) : (
            <table className="stock-page__table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Fornecedor</th>
                  <th scope="col">NF</th>
                  <th scope="col">Itens</th>
                  <th scope="col">Custo total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} onClick={() => setSelectedEntry(entry)}>
                    <td data-label="Data">{formatDate(entry.entryDate)}</td>
                    <td data-label="Fornecedor">{entry.supplierName || '—'}</td>
                    <td data-label="NF">{entry.invoiceNumber || '—'}</td>
                    <td data-label="Itens">{entry.items.length}</td>
                    <td data-label="Custo total">
                      <span className="stock-page__mono">{formatBRL(entry.totalCost)}</span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`stock-page__badge stock-page__badge--${entry.status.toLowerCase()}`}
                      >
                        {STATUS_LABELS[entry.status] || entry.status}
                      </span>
                    </td>
                    <td>
                      <div className="stock-page__actions">
                        <button
                          className="stock-page__icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          aria-label="Ver detalhes"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        {entry.status === 'CONFIRMED' && (
                          <button
                            className="stock-page__icon-btn stock-page__icon-btn--danger"
                            onClick={(e) => handleCancel(entry, e)}
                            aria-label="Cancelar entrada"
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

      {/* Balances tab */}
      {!isLoading && !error && activeTab === 'balances' && (
        <>
          {balances.length === 0 ? (
            <div className="stock-page__empty">
              <Warehouse size={48} aria-hidden="true" />
              <h3>Nenhum saldo encontrado</h3>
              <p>{search ? 'Tente alterar a busca.' : 'Registre entradas para ver os saldos.'}</p>
            </div>
          ) : (
            <table className="stock-page__table">
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
                      <span className="stock-page__mono">
                        {b.currentQuantity.toLocaleString('pt-BR')} {b.measurementUnit || ''}
                      </span>
                    </td>
                    <td data-label="Custo médio">
                      <span className="stock-page__mono">{formatBRL(b.averageCost)}</span>
                    </td>
                    <td data-label="Valor total">
                      <span className="stock-page__mono">{formatBRL(b.totalValue)}</span>
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

      {meta && meta.totalPages > 1 && (
        <div className="stock-page__pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}

      {/* Entry detail modal */}
      {selectedEntry && (
        <div className="stock-page__detail-overlay" onClick={() => setSelectedEntry(null)}>
          <div
            className="stock-page__detail"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da entrada"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Entrada — {formatDate(selectedEntry.entryDate)}</h2>
            <div className="stock-page__detail-grid">
              <div className="stock-page__detail-field">
                <label>Fornecedor</label>
                <span>{selectedEntry.supplierName || '—'}</span>
              </div>
              <div className="stock-page__detail-field">
                <label>NF</label>
                <span>{selectedEntry.invoiceNumber || '—'}</span>
              </div>
              <div className="stock-page__detail-field">
                <label>Fazenda</label>
                <span>{selectedEntry.storageFarmName || '—'}</span>
              </div>
              <div className="stock-page__detail-field">
                <label>Local</label>
                <span>
                  {[selectedEntry.storageLocation, selectedEntry.storageSublocation]
                    .filter(Boolean)
                    .join(' / ') || '—'}
                </span>
              </div>
              <div className="stock-page__detail-field">
                <label>Status</label>
                <span>{STATUS_LABELS[selectedEntry.status]}</span>
              </div>
              <div className="stock-page__detail-field">
                <label>Custo total</label>
                <span className="stock-page__mono">{formatBRL(selectedEntry.totalCost)}</span>
              </div>
            </div>

            <h3 className="stock-page__detail-section">Itens ({selectedEntry.items.length})</h3>
            {selectedEntry.items.map((item) => (
              <div key={item.id} className="stock-page__detail-item">
                <div className="stock-page__detail-item-row">
                  <strong>{item.productName}</strong>
                  <span className="stock-page__mono">{formatBRL(item.finalTotalCost)}</span>
                </div>
                <div className="stock-page__detail-item-sub">
                  {item.quantity} {item.purchaseUnitAbbreviation || 'un'} ×{' '}
                  {formatBRL(item.unitCost)}
                  {item.stockQuantity != null && item.stockUnitAbbreviation && (
                    <>
                      {' '}
                      → {item.stockQuantity.toLocaleString('pt-BR')} {item.stockUnitAbbreviation}
                    </>
                  )}
                  {item.batchNumber && <> — Lote: {item.batchNumber}</>}
                  {item.expirationDate && <> — Val: {formatDate(item.expirationDate)}</>}
                  {item.apportionedExpenses > 0 && (
                    <> — Desp. rateadas: {formatBRL(item.apportionedExpenses)}</>
                  )}
                </div>
              </div>
            ))}

            {selectedEntry.expenses.length > 0 && (
              <>
                <h3 className="stock-page__detail-section">
                  Despesas acessórias ({selectedEntry.expenses.length})
                </h3>
                {selectedEntry.expenses.map((exp) => (
                  <div key={exp.id} className="stock-page__detail-item">
                    <div className="stock-page__detail-item-row">
                      <span>
                        {exp.expenseTypeLabel}
                        {exp.isRetroactive ? ' (retroativa)' : ''}
                      </span>
                      <span className="stock-page__mono">{formatBRL(exp.amount)}</span>
                    </div>
                    <div className="stock-page__detail-item-sub">
                      {exp.supplierName && <>Fornecedor: {exp.supplierName}</>}
                      {exp.invoiceNumber && <> — NF: {exp.invoiceNumber}</>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {selectedEntry.notes && (
              <>
                <h3 className="stock-page__detail-section">Observações</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {selectedEntry.notes}
                </p>
              </>
            )}

            <div className="stock-page__detail-close">
              <button type="button" onClick={() => setSelectedEntry(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <StockEntryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
