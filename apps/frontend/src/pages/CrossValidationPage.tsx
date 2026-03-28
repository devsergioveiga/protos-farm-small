import { useState, useMemo, useCallback, useEffect } from 'react';
import { GitMerge, CheckCircle, AlertTriangle } from 'lucide-react';
import { useCrossValidation } from '@/hooks/useCrossValidation';
import { useOrgId } from '@/hooks/useDre';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import InvariantCard from '@/components/financial-statements/InvariantCard';
import './CrossValidationPage.css';

// ─── Month list ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div
      className="cross-validation-page__grid"
      aria-label="Carregando validacoes..."
      aria-busy="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="cross-validation-page__card-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrossValidationPage() {
  const orgId = useOrgId();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const hasFilters = !!selectedFiscalYearId && !!selectedMonth;

  const cvFilters = useMemo(
    () =>
      hasFilters
        ? { fiscalYearId: selectedFiscalYearId, month: selectedMonth }
        : null,
    [hasFilters, selectedFiscalYearId, selectedMonth],
  );

  const { data, loading, error } = useCrossValidation(orgId, cvFilters);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast('Nao foi possivel carregar as validacoes. Tente novamente.');
    }
  }, [error, showToast]);

  const failedCount = data?.invariants.filter((inv) => inv.status === 'FAILED').length ?? 0;
  const allPassed = data?.allPassed ?? false;

  return (
    <main className="cross-validation-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="cross-validation-page__breadcrumb" aria-label="Caminho da pagina">
        <span className="cross-validation-page__breadcrumb-item">Inicio</span>
        <span className="cross-validation-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="cross-validation-page__breadcrumb-item">Contabilidade</span>
        <span className="cross-validation-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="cross-validation-page__breadcrumb-item cross-validation-page__breadcrumb-item--current">
          Validacao Cruzada
        </span>
      </nav>

      {/* Header */}
      <header className="cross-validation-page__header">
        <GitMerge size={24} aria-hidden="true" className="cross-validation-page__header-icon" />
        <h1 className="cross-validation-page__title">Validacao Cruzada</h1>
      </header>

      {/* Filter bar */}
      <section className="cross-validation-page__filter-bar" aria-label="Filtros do periodo">
        <div className="cross-validation-page__filter-group">
          <label htmlFor="cv-fy-select" className="cross-validation-page__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="cv-fy-select"
            className="cross-validation-page__select"
            value={selectedFiscalYearId}
            onChange={(e) => setSelectedFiscalYearId(e.target.value)}
          >
            <option value="">Selecione o exercicio</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>

        <div className="cross-validation-page__filter-group">
          <label htmlFor="cv-month-select" className="cross-validation-page__filter-label">
            Mes
          </label>
          <select
            id="cv-month-select"
            className="cross-validation-page__select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Status banner */}
      {!loading && data && (
        <>
          {allPassed ? (
            <div
              className="cross-validation-page__banner cross-validation-page__banner--success"
              role="status"
              aria-live="polite"
            >
              <CheckCircle size={20} aria-hidden="true" />
              <span>Todas as validacoes estao corretas.</span>
            </div>
          ) : (
            <div
              className="cross-validation-page__banner cross-validation-page__banner--error"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle size={20} aria-hidden="true" />
              <span>
                {failedCount} validacao{failedCount !== 1 ? 'oes' : ''} com divergencia. Verifique
                os cards abaixo.
              </span>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasFilters && (
        <div className="cross-validation-page__empty">
          <GitMerge size={48} aria-hidden="true" className="cross-validation-page__empty-icon" />
          <h2 className="cross-validation-page__empty-title">Selecione o periodo</h2>
          <p className="cross-validation-page__empty-desc">
            Escolha o exercicio fiscal e o mes para executar as validacoes.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {hasFilters && loading && <GridSkeleton />}

      {/* Invariant cards grid */}
      {hasFilters && !loading && data && (
        <div className="cross-validation-page__grid">
          {data.invariants.map((invariant) => (
            <InvariantCard key={invariant.id} invariant={invariant} />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="cross-validation-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
