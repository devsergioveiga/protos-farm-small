import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Search,
  Download,
  AlertCircle,
  Package,
  Clock,
  Recycle,
} from 'lucide-react';
import {
  useStockAlerts,
  type StockLevel,
  type StockLevelAlert,
  type ExpiryAlert,
} from '@/hooks/useStockAlerts';
import './StockAlertsPage.css';

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatQty(value: number, unit: string | null) {
  const formatted = value % 1 === 0 ? String(value) : value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

const LEVEL_LABELS: Record<StockLevel, string> = {
  CRITICAL: 'Crítico',
  WARNING: 'Atenção',
  OK: 'OK',
};

const LEVEL_ICONS: Record<StockLevel, React.ElementType> = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  OK: CheckCircle,
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  semente: 'Semente',
  fertilizante: 'Fertilizante',
  defensivo_herbicida: 'Herbicida',
  defensivo_inseticida: 'Inseticida',
  defensivo_fungicida: 'Fungicida',
  defensivo_acaricida: 'Acaricida',
  adjuvante: 'Adjuvante',
  corretivo_calcario: 'Calcário',
  corretivo_gesso: 'Gesso',
  inoculante: 'Inoculante',
  biologico: 'Biológico',
  medicamento_veterinario: 'Med. Veterinário',
  combustivel: 'Combustível',
  material_consumo: 'Material de consumo',
  outro: 'Outro',
};

function getExpiryBadgeClass(days: number): string {
  if (days < 0) return 'stock-alerts__expiry-badge--expired';
  if (days <= 30) return 'stock-alerts__expiry-badge--urgent';
  return 'stock-alerts__expiry-badge--soon';
}

function getExpiryLabel(days: number): string {
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  return `${days}d restantes`;
}

// ─── Component ──────────────────────────────────────────────────────

type TabKey = 'dashboard' | 'expiry';

export default function StockAlertsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('90');
  const [pesticideFilter, setPesticideFilter] = useState(false);
  const [levelPage, setLevelPage] = useState(1);
  const [expiryPage, setExpiryPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const {
    dashboard,
    levelAlerts,
    expiryAlerts,
    loading,
    error,
    fetchDashboard,
    fetchLevelAlerts,
    fetchExpiryAlerts,
    exportExpiryCSV,
  } = useStockAlerts();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setLevelPage(1);
      setExpiryPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch dashboard on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch level alerts
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchLevelAlerts({
        level: (levelFilter as StockLevel) || undefined,
        search: search || undefined,
        page: levelPage,
        limit: 20,
      });
    }
  }, [activeTab, levelFilter, search, levelPage, fetchLevelAlerts]);

  // Fetch expiry alerts
  useEffect(() => {
    if (activeTab === 'expiry') {
      fetchExpiryAlerts({
        daysAhead: Number(daysFilter),
        isPesticide: pesticideFilter || undefined,
        search: search || undefined,
        page: expiryPage,
        limit: 20,
      });
    }
  }, [activeTab, daysFilter, pesticideFilter, search, expiryPage, fetchExpiryAlerts]);

  // Export CSV
  const handleExport = useCallback(async () => {
    try {
      await exportExpiryCSV({
        daysAhead: Number(daysFilter),
      });
      setToast('Relatório exportado com sucesso');
      setTimeout(() => setToast(null), 5000);
    } catch {
      setToast('Erro ao exportar relatório');
      setTimeout(() => setToast(null), 5000);
    }
  }, [exportExpiryCSV, daysFilter]);

  // ─── Summary Cards (CA5) ───────────────────────────────────────

  function renderSummaryCards() {
    if (!dashboard) {
      return (
        <div className="stock-alerts__summary">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stock-alerts__skeleton stock-alerts__skeleton--card" />
          ))}
        </div>
      );
    }

    const { summary } = dashboard;

    return (
      <div className="stock-alerts__summary">
        <div className="stock-alerts__summary-card stock-alerts__summary-card--critical">
          <span className="stock-alerts__summary-label">Abaixo do mínimo</span>
          <span className="stock-alerts__summary-value stock-alerts__summary-value--critical">
            {summary.criticalCount}
          </span>
        </div>
        <div className="stock-alerts__summary-card stock-alerts__summary-card--warning">
          <span className="stock-alerts__summary-label">Nível de segurança</span>
          <span className="stock-alerts__summary-value stock-alerts__summary-value--warning">
            {summary.warningCount}
          </span>
        </div>
        <div className="stock-alerts__summary-card stock-alerts__summary-card--ok">
          <span className="stock-alerts__summary-label">Estoque OK</span>
          <span className="stock-alerts__summary-value stock-alerts__summary-value--ok">
            {summary.okCount}
          </span>
        </div>
        <div className="stock-alerts__summary-card stock-alerts__summary-card--expiry">
          <span className="stock-alerts__summary-label">Vencidos / A vencer</span>
          <span className="stock-alerts__summary-value">
            {summary.expiredCount} / {summary.expiringCount}
          </span>
        </div>
      </div>
    );
  }

  // ─── Level Alerts Table (CA3/CA5) ─────────────────────────────

  function renderLevelAlerts() {
    return (
      <>
        <div className="stock-alerts__filters">
          <div className="stock-alerts__search-wrapper">
            <Search size={16} className="stock-alerts__search-icon" aria-hidden="true" />
            <input
              type="search"
              className="stock-alerts__search"
              placeholder="Buscar produto..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar produto"
            />
          </div>
          <select
            className="stock-alerts__select"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setLevelPage(1);
            }}
            aria-label="Filtrar por nível"
          >
            <option value="">Todos os níveis</option>
            <option value="CRITICAL">Crítico</option>
            <option value="WARNING">Atenção</option>
            <option value="OK">OK</option>
          </select>
        </div>

        {loading && !levelAlerts ? (
          <div className="stock-alerts__table-wrapper">
            {[1, 2, 3].map((i) => (
              <div key={i} className="stock-alerts__skeleton" style={{ height: 48, margin: 8 }} />
            ))}
          </div>
        ) : levelAlerts && levelAlerts.data.length > 0 ? (
          <>
            <div className="stock-alerts__table-wrapper">
              <table className="stock-alerts__table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Saldo atual</th>
                    <th scope="col">Ponto de reposição</th>
                    <th scope="col">Estoque segurança</th>
                    <th scope="col">Valor total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {levelAlerts.data.map((alert: StockLevelAlert) => {
                    const LevelIcon = LEVEL_ICONS[alert.level];
                    return (
                      <tr key={alert.productId}>
                        <td data-label="Produto">{alert.productName}</td>
                        <td data-label="Tipo">
                          {PRODUCT_TYPE_LABELS[alert.productType] || alert.productType}
                        </td>
                        <td data-label="Saldo atual">
                          <span
                            className={`stock-alerts__qty ${alert.level === 'CRITICAL' ? 'stock-alerts__qty--low' : ''}`}
                          >
                            {formatQty(alert.currentQuantity, alert.measurementUnit)}
                          </span>
                        </td>
                        <td data-label="Ponto reposição">
                          <span className="stock-alerts__qty">
                            {alert.reorderPoint != null
                              ? formatQty(alert.reorderPoint, alert.measurementUnit)
                              : '—'}
                          </span>
                        </td>
                        <td data-label="Estoque segurança">
                          <span className="stock-alerts__qty">
                            {alert.safetyStock != null
                              ? formatQty(alert.safetyStock, alert.measurementUnit)
                              : '—'}
                          </span>
                        </td>
                        <td data-label="Valor total">{formatBRL(alert.totalValue)}</td>
                        <td data-label="Status">
                          <span
                            className={`stock-alerts__level-badge stock-alerts__level-badge--${alert.level}`}
                          >
                            <LevelIcon size={14} aria-hidden="true" />
                            {LEVEL_LABELS[alert.level]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {renderPagination(
              levelAlerts.total,
              levelAlerts.page,
              levelAlerts.totalPages,
              setLevelPage,
            )}
          </>
        ) : (
          <div className="stock-alerts__empty">
            <Package size={48} className="stock-alerts__empty-icon" aria-hidden="true" />
            <h3 className="stock-alerts__empty-title">Nenhum alerta de nível</h3>
            <p className="stock-alerts__empty-desc">
              Configure ponto de reposição e estoque de segurança nos produtos para ativar alertas.
            </p>
          </div>
        )}
      </>
    );
  }

  // ─── Expiry Alerts Table (CA4/CA6) ────────────────────────────

  function renderExpiryAlerts() {
    return (
      <>
        <div className="stock-alerts__filters">
          <div className="stock-alerts__search-wrapper">
            <Search size={16} className="stock-alerts__search-icon" aria-hidden="true" />
            <input
              type="search"
              className="stock-alerts__search"
              placeholder="Buscar produto..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar produto"
            />
          </div>
          <select
            className="stock-alerts__select"
            value={daysFilter}
            onChange={(e) => {
              setDaysFilter(e.target.value);
              setExpiryPage(1);
            }}
            aria-label="Período de alerta"
          >
            <option value="30">Próximos 30 dias</option>
            <option value="60">Próximos 60 dias</option>
            <option value="90">Próximos 90 dias</option>
            <option value="180">Próximos 180 dias</option>
          </select>
          <label className="stock-alerts__checkbox-label">
            <input
              type="checkbox"
              checked={pesticideFilter}
              onChange={(e) => {
                setPesticideFilter(e.target.checked);
                setExpiryPage(1);
              }}
            />
            <span style={{ marginLeft: 6 }}>Apenas defensivos</span>
          </label>
          <button
            type="button"
            className="stock-alerts__export-btn"
            onClick={handleExport}
            aria-label="Exportar relatório de validade"
          >
            <Download size={16} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>

        {loading && !expiryAlerts ? (
          <div className="stock-alerts__table-wrapper">
            {[1, 2, 3].map((i) => (
              <div key={i} className="stock-alerts__skeleton" style={{ height: 48, margin: 8 }} />
            ))}
          </div>
        ) : expiryAlerts && expiryAlerts.data.length > 0 ? (
          <>
            <div className="stock-alerts__table-wrapper">
              <table className="stock-alerts__table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Lote</th>
                    <th scope="col">Validade</th>
                    <th scope="col">Dias</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Custo total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryAlerts.data.map((alert: ExpiryAlert, idx: number) => (
                    <tr key={`${alert.productId}-${alert.batchNumber}-${idx}`}>
                      <td data-label="Produto">
                        {alert.productName}
                        {alert.isPesticide && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.75rem',
                              color: 'var(--color-neutral-400)',
                            }}
                          >
                            (defensivo)
                          </span>
                        )}
                      </td>
                      <td data-label="Lote">
                        <span className="stock-alerts__qty">{alert.batchNumber || '—'}</span>
                      </td>
                      <td data-label="Validade">{formatDate(alert.expirationDate)}</td>
                      <td data-label="Dias">
                        <span
                          className={`stock-alerts__expiry-badge ${getExpiryBadgeClass(alert.daysUntilExpiry)}`}
                        >
                          <Clock size={12} aria-hidden="true" />
                          {getExpiryLabel(alert.daysUntilExpiry)}
                        </span>
                      </td>
                      <td data-label="Quantidade">
                        <span className="stock-alerts__qty">
                          {formatQty(alert.quantity, alert.measurementUnit)}
                        </span>
                      </td>
                      <td data-label="Custo total">{formatBRL(alert.totalCost)}</td>
                      <td data-label="Situação">
                        {alert.inpevRequired && (
                          <span className="stock-alerts__inpev-tag">
                            <Recycle size={12} aria-hidden="true" />
                            InpEV obrigatório
                          </span>
                        )}
                        {alert.isExpired && !alert.inpevRequired && (
                          <span className="stock-alerts__expiry-badge stock-alerts__expiry-badge--expired">
                            Vencido
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(
              expiryAlerts.total,
              expiryAlerts.page,
              expiryAlerts.totalPages,
              setExpiryPage,
            )}
          </>
        ) : (
          <div className="stock-alerts__empty">
            <Clock size={48} className="stock-alerts__empty-icon" aria-hidden="true" />
            <h3 className="stock-alerts__empty-title">Nenhum produto próximo do vencimento</h3>
            <p className="stock-alerts__empty-desc">
              Produtos com data de validade cadastrada aparecerão aqui quando estiverem próximos do
              vencimento.
            </p>
          </div>
        )}
      </>
    );
  }

  // ─── Pagination ───────────────────────────────────────────────

  function renderPagination(
    total: number,
    currentPage: number,
    totalPages: number,
    setPage: (p: number) => void,
  ) {
    if (totalPages <= 1) return null;
    return (
      <div className="stock-alerts__pagination">
        <span>
          {total} {total === 1 ? 'resultado' : 'resultados'}
        </span>
        <div className="stock-alerts__pagination-buttons">
          <button
            type="button"
            className="stock-alerts__pagination-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <span style={{ padding: '8px 0', fontSize: '0.875rem' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="stock-alerts__pagination-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  const criticalBadge = dashboard ? dashboard.summary.criticalCount : 0;
  const expiryBadge = dashboard
    ? dashboard.summary.expiredCount + dashboard.summary.expiringCount
    : 0;

  return (
    <main className="stock-alerts-page">
      <header className="stock-alerts-page__header">
        <h1 className="stock-alerts-page__title">
          <Bell size={24} aria-hidden="true" />
          Alertas de Estoque
        </h1>
      </header>

      {error && (
        <div className="stock-alerts__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {renderSummaryCards()}

      <div className="stock-alerts-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`stock-alerts-page__tab ${activeTab === 'dashboard' ? 'stock-alerts-page__tab--active' : ''}`}
          aria-selected={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        >
          Nível de estoque
          {criticalBadge > 0 && (
            <span className="stock-alerts-page__tab-badge stock-alerts-page__tab-badge--critical">
              {criticalBadge}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          className={`stock-alerts-page__tab ${activeTab === 'expiry' ? 'stock-alerts-page__tab--active' : ''}`}
          aria-selected={activeTab === 'expiry'}
          onClick={() => setActiveTab('expiry')}
        >
          Validade
          {expiryBadge > 0 && (
            <span className="stock-alerts-page__tab-badge stock-alerts-page__tab-badge--warning">
              {expiryBadge}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'dashboard' && renderLevelAlerts()}
      {activeTab === 'expiry' && renderExpiryAlerts()}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            background: 'var(--color-neutral-800)',
            color: 'var(--color-neutral-0)',
            padding: '12px 20px',
            borderRadius: 8,
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.9375rem',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
