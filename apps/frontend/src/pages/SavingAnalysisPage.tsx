import { useState, lazy, Suspense } from 'react';
import {
  BarChart2,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Award,
} from 'lucide-react';
import {
  useSavingDashboard,
  type SavingAnalysisParams,
  type QuotationSaving,
  type TopProduct,
  type TopSupplier,
} from '@/hooks/useSavingAnalysis';
import './SavingAnalysisPage.css';

// ─── Lazy-loaded chart components ─────────────────────────────────────────────

const PriceHistoryChart = lazy(() => import('@/components/saving-analysis/PriceHistoryChart'));
const TopItemsChart = lazy(() => import('@/components/saving-analysis/TopItemsChart'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Date presets ─────────────────────────────────────────────────────────────

interface DatePreset {
  label: string;
  start: string;
  end: string;
}

function getDatePresets(): DatePreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const lastMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(y, m, 0));

  const quarterStart = new Date(Date.UTC(y, m - 2, 1));
  const quarterEnd = new Date(Date.UTC(y, m + 1, 0));

  const safetyStart = new Date(Date.UTC(y - 1, 6, 1));
  const safetyEnd = new Date(Date.UTC(y, 5, 30));

  const yearStart = new Date(Date.UTC(y - 1, m + 1, 1));
  const yearEnd = new Date(Date.UTC(y, m + 1, 0));

  function fmt(d: Date): string {
    return d.toISOString().split('T')[0] ?? '';
  }

  return [
    { label: 'Último Mês', start: fmt(lastMonthStart), end: fmt(lastMonthEnd) },
    { label: 'Último Trimestre', start: fmt(quarterStart), end: fmt(quarterEnd) },
    { label: 'Safra Atual', start: fmt(safetyStart), end: fmt(safetyEnd) },
    { label: 'Último Ano', start: fmt(yearStart), end: fmt(yearEnd) },
  ];
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  icon?: React.ElementType;
}

function KpiCard({
  label,
  value,
  subtitle,
  accentColor = 'var(--color-primary-600)',
  icon: Icon,
}: KpiCardProps) {
  return (
    <article className="saving-analysis-page__kpi-card" style={{ borderLeftColor: accentColor }}>
      {Icon && (
        <div
          className="saving-analysis-page__kpi-icon"
          style={{ color: accentColor }}
          aria-hidden="true"
        >
          <Icon size={20} />
        </div>
      )}
      <span className="saving-analysis-page__kpi-label">{label}</span>
      <span className="saving-analysis-page__kpi-value">{value}</span>
      {subtitle && <span className="saving-analysis-page__kpi-subtitle">{subtitle}</span>}
    </article>
  );
}

// ─── Saving Quotation Table ───────────────────────────────────────────────────

interface SavingQuotationTableProps {
  savings: QuotationSaving[];
  isLoading: boolean;
}

function SavingQuotationTable({ savings, isLoading }: SavingQuotationTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="saving-analysis-page__skeleton"
            style={{ height: 48, marginBottom: 8 }}
          />
        ))}
      </div>
    );
  }

  if (savings.length === 0) {
    return (
      <div className="saving-analysis-page__section-empty">
        <p>Nenhuma cotação com saving no período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="saving-analysis-page__table-wrapper">
      <table className="saving-analysis-page__table">
        <thead>
          <tr>
            <th scope="col" style={{ width: 32 }} />
            <th scope="col">Cotação</th>
            <th scope="col">Data</th>
            <th scope="col">Fornecedores</th>
            <th scope="col">Saving Total</th>
            <th scope="col">% Saving</th>
          </tr>
        </thead>
        <tbody>
          {savings.map((s) => (
            <>
              <tr
                key={s.quotationId}
                className="saving-analysis-page__table-row"
                onClick={() => toggleRow(s.quotationId)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  {expanded.has(s.quotationId) ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </td>
                <td data-label="Cotação" className="saving-analysis-page__mono">
                  #{s.sequentialNumber}
                </td>
                <td data-label="Data">{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                <td data-label="Fornecedores">{s.supplierCount}</td>
                <td
                  data-label="Saving Total"
                  className="saving-analysis-page__mono saving-analysis-page__saving-value"
                >
                  {formatBRL(s.totalSaving)}
                </td>
                <td data-label="% Saving">
                  <span className="saving-analysis-page__pct-badge">
                    {formatPercent(s.savingPercent)}
                  </span>
                </td>
              </tr>
              {expanded.has(s.quotationId) && s.items && s.items.length > 0 && (
                <tr key={`${s.quotationId}-items`} className="saving-analysis-page__subtable-row">
                  <td colSpan={6}>
                    <table className="saving-analysis-page__subtable">
                      <thead>
                        <tr>
                          <th scope="col">Produto</th>
                          <th scope="col">Qtd</th>
                          <th scope="col">Preço max.</th>
                          <th scope="col">Preço vencedor</th>
                          <th scope="col">Saving</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.productName}</td>
                            <td className="saving-analysis-page__mono">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="saving-analysis-page__mono">
                              {formatBRL(item.maxPrice)}
                            </td>
                            <td className="saving-analysis-page__mono">
                              {formatBRL(item.winnerPrice)}
                            </td>
                            <td className="saving-analysis-page__mono saving-analysis-page__saving-value">
                              {formatBRL(item.saving)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top Table (fallback, used when no chart data) ────────────────────────────

function TopProductsTable({ products }: { products: TopProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="saving-analysis-page__section-empty">
        <p>Nenhum produto no período selecionado.</p>
      </div>
    );
  }

  const max = products[0]?.totalSpent ?? 1;

  return (
    <ol className="saving-analysis-page__top-list">
      {products.map((p) => (
        <li key={p.productId} className="saving-analysis-page__top-item">
          <div className="saving-analysis-page__top-row">
            <span className="saving-analysis-page__top-rank">#{p.rank}</span>
            <span className="saving-analysis-page__top-name" title={p.productName}>
              {p.productName}
            </span>
            <span className="saving-analysis-page__top-value">{formatBRL(p.totalSpent)}</span>
          </div>
          <div className="saving-analysis-page__top-bar-track">
            <div
              className="saving-analysis-page__top-bar-fill"
              style={{ width: `${(p.totalSpent / max) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function TopSuppliersTable({ suppliers }: { suppliers: TopSupplier[] }) {
  if (suppliers.length === 0) {
    return (
      <div className="saving-analysis-page__section-empty">
        <p>Nenhum fornecedor no período selecionado.</p>
      </div>
    );
  }

  const max = suppliers[0]?.totalVolume ?? 1;

  return (
    <ol className="saving-analysis-page__top-list">
      {suppliers.map((s) => (
        <li key={s.supplierId} className="saving-analysis-page__top-item">
          <div className="saving-analysis-page__top-row">
            <span className="saving-analysis-page__top-rank">#{s.rank}</span>
            <span className="saving-analysis-page__top-name" title={s.supplierName}>
              {s.supplierName}
            </span>
            <span className="saving-analysis-page__top-value">{formatBRL(s.totalVolume)}</span>
          </div>
          <div className="saving-analysis-page__top-bar-track">
            <div
              className="saving-analysis-page__top-bar-fill"
              style={{ width: `${(s.totalVolume / max) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SavingAnalysisPage() {
  const presets = getDatePresets();
  const defaultPreset = presets[2]; // Safra Atual

  const [startDate, setStartDate] = useState(defaultPreset?.start ?? '');
  const [endDate, setEndDate] = useState(defaultPreset?.end ?? '');
  const [activePreset, setActivePreset] = useState('Safra Atual');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [expandedSaving, setExpandedSaving] = useState(false);

  const params: SavingAnalysisParams = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { dashboard, isLoading, error, refetch } = useSavingDashboard(params);

  function handlePreset(preset: DatePreset) {
    setStartDate(preset.start);
    setEndDate(preset.end);
    setActivePreset(preset.label);
  }

  const saving = dashboard?.saving;
  const indicators = dashboard?.indicators;
  const topProducts = dashboard?.topProducts ?? [];
  const topSuppliers = dashboard?.topSuppliers ?? [];

  function emergencyColor(pct: number): string {
    if (pct > 40) return 'var(--color-error-600)';
    if (pct >= 20) return '#F9A825';
    return 'var(--color-primary-600)';
  }

  return (
    <main className="saving-analysis-page" id="main-content">
      {/* Header */}
      <header className="saving-analysis-page__header">
        <div>
          <h1 className="saving-analysis-page__title">
            <BarChart2 size={24} aria-hidden="true" />
            Análise de Saving
          </h1>
          <p className="saving-analysis-page__subtitle">
            Visibilidade sobre economia gerada nas cotações e desempenho das compras
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="saving-analysis-page__filters" role="search" aria-label="Filtros de período">
        <div className="saving-analysis-page__presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`saving-analysis-page__preset-btn ${activePreset === p.label ? 'saving-analysis-page__preset-btn--active' : ''}`}
              onClick={() => handlePreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="saving-analysis-page__date-range">
          <div className="saving-analysis-page__filter-group">
            <label htmlFor="filter-start">De</label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>
          <div className="saving-analysis-page__filter-group">
            <label htmlFor="filter-end">Até</label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="saving-analysis-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
          <button
            type="button"
            onClick={() => void refetch()}
            className="saving-analysis-page__retry-btn"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Section 1 — KPI Cards */}
      <section className="saving-analysis-page__section" aria-label="Indicadores de saving">
        {isLoading ? (
          <div className="saving-analysis-page__kpis-grid">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="saving-analysis-page__skeleton saving-analysis-page__skeleton--kpi"
              />
            ))}
          </div>
        ) : (
          <div className="saving-analysis-page__kpis-grid">
            <KpiCard
              icon={TrendingUp}
              label="Saving Total"
              value={formatBRL(saving?.totalSaving ?? 0)}
              subtitle={`${saving?.quotationCount ?? 0} cotações no período`}
              accentColor="var(--color-primary-600)"
            />
            <KpiCard
              icon={BarChart2}
              label="Saving Médio"
              value={formatPercent(saving?.avgSavingPercent ?? 0)}
              subtitle="por cotação"
              accentColor="var(--color-primary-500)"
            />
            <KpiCard
              icon={ShoppingCart}
              label="% Compras Formais"
              value={formatPercent(indicators?.percentFormal ?? 0)}
              subtitle="com cotação"
              accentColor="var(--color-primary-600)"
            />
            <KpiCard
              icon={AlertCircle}
              label="% Emergenciais"
              value={formatPercent(indicators?.percentEmergency ?? 0)}
              subtitle={
                (indicators?.percentEmergency ?? 0) > 20
                  ? 'Acima do ideal (< 20%)'
                  : 'Dentro do esperado'
              }
              accentColor={emergencyColor(indicators?.percentEmergency ?? 0)}
            />
          </div>
        )}
      </section>

      {/* Section 2 — Saving por Cotação */}
      <section className="saving-analysis-page__section" aria-label="Saving por cotação">
        <div className="saving-analysis-page__section-header">
          <h2 className="saving-analysis-page__section-title">Saving por Cotação</h2>
          <button
            type="button"
            className="saving-analysis-page__toggle-btn"
            onClick={() => setExpandedSaving((v) => !v)}
            aria-expanded={expandedSaving}
          >
            {expandedSaving ? (
              <>
                <ChevronDown size={16} aria-hidden="true" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronRight size={16} aria-hidden="true" />
                Expandir
              </>
            )}
          </button>
        </div>

        {expandedSaving && (
          <SavingQuotationTable savings={saving?.savings ?? []} isLoading={isLoading} />
        )}

        {!expandedSaving && !isLoading && (
          <p className="saving-analysis-page__section-summary">
            {saving?.quotationCount ?? 0} cotações — saving total de{' '}
            <strong>{formatBRL(saving?.totalSaving ?? 0)}</strong>
          </p>
        )}
      </section>

      {/* Section 3 — Histórico de Preços */}
      <section
        className="saving-analysis-page__section"
        aria-label="Histórico de preços por produto"
      >
        <h2 className="saving-analysis-page__section-title">Histórico de Preços</h2>

        <div className="saving-analysis-page__product-select-group">
          <label htmlFor="price-history-product">Selecione um produto</label>
          <select
            id="price-history-product"
            value={selectedProductId ?? ''}
            onChange={(e) => setSelectedProductId(e.target.value || null)}
            className="saving-analysis-page__product-select"
          >
            <option value="">— Selecione um produto —</option>
            {topProducts.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productName}
              </option>
            ))}
          </select>
        </div>

        {selectedProductId ? (
          <Suspense
            fallback={
              <div
                className="saving-analysis-page__skeleton"
                style={{ height: 300 }}
                aria-label="Carregando gráfico"
              />
            }
          >
            <PriceHistoryChart productId={selectedProductId} params={params} />
          </Suspense>
        ) : (
          <div className="saving-analysis-page__chart-empty">
            <BarChart2 size={48} className="saving-analysis-page__empty-icon" aria-hidden="true" />
            <p>Selecione um produto para ver o histórico de preços</p>
          </div>
        )}
      </section>

      {/* Section 4 — Indicadores de Ciclo */}
      <section
        className="saving-analysis-page__section"
        aria-label="Indicadores de ciclo de compras"
      >
        <h2 className="saving-analysis-page__section-title">Indicadores de Ciclo</h2>

        {isLoading ? (
          <div className="saving-analysis-page__kpis-grid saving-analysis-page__kpis-grid--4col">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="saving-analysis-page__skeleton saving-analysis-page__skeleton--kpi"
              />
            ))}
          </div>
        ) : (
          <div className="saving-analysis-page__kpis-grid saving-analysis-page__kpis-grid--4col">
            <KpiCard
              icon={Clock}
              label="Prazo Médio"
              value={`${indicators?.avgCycleDays?.toFixed(0) ?? '—'} dias`}
              subtitle="da RC ao recebimento"
              accentColor="var(--color-neutral-500)"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Total de Pedidos"
              value={String(indicators?.totalOrders ?? 0)}
              subtitle="no período"
              accentColor="var(--color-primary-600)"
            />
            <KpiCard
              icon={Award}
              label="% Compras Formais"
              value={formatPercent(indicators?.percentFormal ?? 0)}
              subtitle="com cotação aprovada"
              accentColor="var(--color-primary-600)"
            />
            <KpiCard
              icon={AlertCircle}
              label="% Emergenciais"
              value={formatPercent(indicators?.percentEmergency ?? 0)}
              subtitle="sem cotação"
              accentColor={emergencyColor(indicators?.percentEmergency ?? 0)}
            />
          </div>
        )}
      </section>

      {/* Sections 5 & 6 — Top Products and Top Suppliers */}
      <div className="saving-analysis-page__top-grid">
        {/* Section 5 — Top 10 Produtos */}
        <section
          className="saving-analysis-page__section saving-analysis-page__section--panel"
          aria-label="Top 10 produtos por gasto"
        >
          <h2 className="saving-analysis-page__section-title">Top 10 Produtos por Gasto</h2>

          {isLoading ? (
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="saving-analysis-page__skeleton"
                  style={{ height: 32, marginBottom: 6 }}
                />
              ))}
            </div>
          ) : topProducts.length > 0 ? (
            <Suspense fallback={<TopProductsTable products={topProducts} />}>
              <TopItemsChart
                items={topProducts.map((p) => ({
                  name: p.productName,
                  value: p.totalSpent,
                  rank: p.rank,
                }))}
                label="Produtos"
              />
            </Suspense>
          ) : (
            <TopProductsTable products={[]} />
          )}
        </section>

        {/* Section 6 — Top 5 Fornecedores */}
        <section
          className="saving-analysis-page__section saving-analysis-page__section--panel"
          aria-label="Top 5 fornecedores por volume"
        >
          <h2 className="saving-analysis-page__section-title">Top 5 Fornecedores por Volume</h2>

          {isLoading ? (
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="saving-analysis-page__skeleton"
                  style={{ height: 32, marginBottom: 6 }}
                />
              ))}
            </div>
          ) : topSuppliers.length > 0 ? (
            <Suspense fallback={<TopSuppliersTable suppliers={topSuppliers} />}>
              <TopItemsChart
                items={topSuppliers.map((s) => ({
                  name: s.supplierName,
                  value: s.totalVolume,
                  rank: s.rank,
                }))}
                label="Fornecedores"
              />
            </Suspense>
          ) : (
            <TopSuppliersTable suppliers={[]} />
          )}
        </section>
      </div>
    </main>
  );
}
