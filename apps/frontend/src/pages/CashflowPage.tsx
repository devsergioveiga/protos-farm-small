import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FileDown, FileSpreadsheet, TrendingUp } from 'lucide-react';
import { useCashflow, exportCashflowPdf, exportCashflowExcel } from '@/hooks/useCashflow';
import { useFarms } from '@/hooks/useFarms';
import DfcTable from '@/components/cashflow/DfcTable';
import './CashflowPage.css';

const CashflowChart = lazy(() => import('@/components/cashflow/CashflowChart'));

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoDate: string): string {
  // Input: "YYYY-MM" — format as "mês/ano"
  const [year, month] = isoDate.split('-');
  const MONTHS = [
    '',
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const monthIndex = parseInt(month ?? '0', 10);
  const monthLabel = MONTHS[monthIndex] ?? month;
  return `${monthLabel}/${String(year).slice(-2)}`;
}

// ─── Skeleton ────────────────────────────────────────────────────────

function CashflowSkeleton() {
  return (
    <div aria-busy="true" aria-label="Calculando projecao...">
      {/* Chart skeleton */}
      <div className="cashflow-page__skeleton">
        <div
          className="skeleton-rect"
          style={{ height: '24px', width: '200px', marginBottom: '8px' }}
        />
        <div
          className="skeleton-rect"
          style={{ height: '16px', width: '300px', marginBottom: '16px' }}
        />
        <div className="skeleton-rect" style={{ height: '320px', width: '100%' }} />
      </div>

      {/* DFC skeleton: 3 sections */}
      <div className="cashflow-page__skeleton">
        <div
          className="skeleton-rect"
          style={{ height: '24px', width: '180px', marginBottom: '16px' }}
        />
        <div className="cashflow-page__skeleton-rows">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-rect" style={{ height: '48px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────

export default function CashflowPage() {
  const [localFarmId, setLocalFarmId] = useState<string | undefined>(undefined);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { farms } = useFarms();
  const { projection, loading, error, refetch } = useCashflow(localFarmId);

  const hasNegativeBalance =
    projection?.negativeBalanceDate !== null && projection?.negativeBalanceDate !== undefined;

  // ── Export handlers ──────────────────────────────────────────────

  async function handleExportPdf() {
    setPdfLoading(true);
    setExportError(null);
    try {
      await exportCashflowPdf(localFarmId);
    } catch {
      setExportError('Nao foi possivel exportar. Tente novamente.');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleExportExcel() {
    setExcelLoading(true);
    setExportError(null);
    try {
      await exportCashflowExcel(localFarmId);
    } catch {
      setExportError('Nao foi possivel exportar. Tente novamente.');
    } finally {
      setExcelLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <main className="cashflow-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="cashflow-page__breadcrumb" aria-label="Navegacao estrutural">
        <Link to="/financial-dashboard">Financeiro</Link>
        <span className="cashflow-page__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span aria-current="page">Fluxo de Caixa</span>
      </nav>

      {/* Header */}
      <header className="cashflow-page__header">
        <h1>Fluxo de Caixa</h1>
        <p>Projecao de 12 meses com cenarios otimista, realista e pessimista</p>
      </header>

      {/* Filters + export buttons */}
      <div className="cashflow-page__filters" role="search" aria-label="Filtros do fluxo de caixa">
        <div className="cashflow-page__filter-group">
          <label htmlFor="cashflow-farm-filter">Fazenda</label>
          <select
            id="cashflow-farm-filter"
            value={localFarmId ?? ''}
            onChange={(e) => {
              setLocalFarmId(e.target.value === '' ? undefined : e.target.value);
            }}
            aria-label="Selecionar fazenda"
          >
            <option value="">Todas as fazendas</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </div>

        <div className="cashflow-page__export-group">
          <button
            type="button"
            className={`cashflow-page__export-btn${pdfLoading ? ' cashflow-page__export-btn--loading' : ''}`}
            onClick={() => void handleExportPdf()}
            disabled={pdfLoading || loading}
            aria-label="Exportar fluxo de caixa em PDF"
          >
            {pdfLoading ? (
              <span className="cashflow-page__spinner" aria-hidden="true" />
            ) : (
              <FileDown size={16} aria-hidden="true" />
            )}
            Exportar PDF
          </button>

          <button
            type="button"
            className={`cashflow-page__export-btn${excelLoading ? ' cashflow-page__export-btn--loading' : ''}`}
            onClick={() => void handleExportExcel()}
            disabled={excelLoading || loading}
            aria-label="Exportar fluxo de caixa em Excel"
          >
            {excelLoading ? (
              <span className="cashflow-page__spinner" aria-hidden="true" />
            ) : (
              <FileSpreadsheet size={16} aria-hidden="true" />
            )}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Export error */}
      {exportError && (
        <div
          className="cashflow-page__alert"
          role="alert"
          style={{ marginBottom: 'var(--space-4)' }}
        >
          <AlertCircle size={20} className="cashflow-page__alert-icon" aria-hidden="true" />
          <div className="cashflow-page__alert-body">
            <p className="cashflow-page__alert-text">{exportError}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <CashflowSkeleton />}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--color-neutral-0)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: 'var(--radius-lg)',
          }}
          role="alert"
        >
          <AlertCircle size={48} color="var(--color-error-500)" aria-hidden="true" />
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-neutral-800)',
              margin: '16px 0 8px',
            }}
          >
            Nao foi possivel carregar o fluxo de caixa
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-neutral-600)', margin: '0 0 24px' }}>
            Verifique sua conexao e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            style={{
              minHeight: '48px',
              padding: '12px 24px',
              border: '1px solid var(--color-neutral-200)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-neutral-0)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && projection !== null && (
        <>
          {/* Negative balance alert banner */}
          {hasNegativeBalance && (
            <div className="cashflow-page__alert" role="alert">
              <AlertCircle size={20} className="cashflow-page__alert-icon" aria-hidden="true" />
              <div className="cashflow-page__alert-body">
                <p className="cashflow-page__alert-heading">Saldo negativo previsto</p>
                <p className="cashflow-page__alert-text">
                  em {formatDate(projection.negativeBalanceDate!)} — saldo projetado de{' '}
                  {formatBRL(projection.negativeBalanceAmount ?? 0)}. Revise seus compromissos
                  financeiros.
                </p>
              </div>
            </div>
          )}

          {/* Mobile balance card (visible only on mobile, chart hidden) */}
          <div className="cashflow-page__mobile-balance">
            <p className="cashflow-page__mobile-balance-label">Saldo atual</p>
            <p
              className={`cashflow-page__mobile-balance-value${projection.currentBalance < 0 ? ' cashflow-page__mobile-balance-value--negative' : ''}`}
              aria-label={`Saldo atual: ${formatBRL(projection.currentBalance)}`}
            >
              {formatBRL(projection.currentBalance)}
            </p>
          </div>

          {/* Chart section (hidden on mobile <640px via CSS) */}
          <section
            className="cashflow-page__chart"
            aria-label="Grafico de projecao de fluxo de caixa"
          >
            <h2 className="cashflow-page__chart-title">Projecao de saldo por cenario</h2>
            <p className="cashflow-page__chart-subtitle">
              Realista (area), Otimista (tracejado verde) e Pessimista (tracejado vermelho) — linha
              vermelha indica zona de risco (saldo zero)
            </p>
            {projection.projectionPoints.length > 0 ? (
              <Suspense
                fallback={
                  <div
                    className="skeleton-rect"
                    style={{ height: '320px', width: '100%' }}
                    aria-label="Carregando grafico"
                  />
                }
              >
                <CashflowChart data={projection.projectionPoints} />
              </Suspense>
            ) : (
              <div
                style={{
                  height: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <TrendingUp size={48} color="var(--color-neutral-300)" aria-hidden="true" />
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-neutral-400)',
                    margin: 0,
                  }}
                >
                  Sem projecoes para este periodo
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-neutral-400)',
                    margin: 0,
                  }}
                >
                  Registre contas a pagar e a receber para ver a projecao de fluxo de caixa.
                </p>
              </div>
            )}
          </section>

          {/* DFC Table */}
          <section
            className="cashflow-page__dfc"
            aria-label="Demonstracao de fluxo de caixa por classificacao"
          >
            <h2 className="cashflow-page__dfc-title">Demonstracao de Fluxo de Caixa (DFC)</h2>
            <DfcTable dfc={projection.dfc} />
          </section>
        </>
      )}
    </main>
  );
}
