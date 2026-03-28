import { useState, useCallback, useEffect, useMemo } from 'react';
import { TrendingUp, Download, ToggleLeft, ToggleRight } from 'lucide-react';
import { useDre, useOrgId } from '@/hooks/useDre';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import { api } from '@/services/api';
import DreTable from '@/components/financial-statements/DreTable';
import MarginRankingChart from '@/components/financial-statements/MarginRankingChart';
import './DrePage.css';

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

// ─── Cost Center Types ─────────────────────────────────────────────────────────

interface CostCenter {
  id: string;
  name: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DrePage() {
  const orgId = useOrgId();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [showVH, setShowVH] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch cost centers
  useEffect(() => {
    if (!orgId) return;
    void api.get<CostCenter[]>(`/org/${orgId}/cost-centers`)
      .then((data) => setCostCenters(data))
      .catch(() => {
        // non-blocking: cost center filter optional
      });
  }, [orgId]);

  const hasFilters = !!selectedFiscalYearId && !!selectedMonth;

  const dreFilters = useMemo(
    () =>
      hasFilters
        ? {
            fiscalYearId: selectedFiscalYearId,
            month: selectedMonth,
            costCenterId: selectedCostCenterId || undefined,
          }
        : null,
    [hasFilters, selectedFiscalYearId, selectedMonth, selectedCostCenterId],
  );

  const { data, loading, error } = useDre(orgId, dreFilters);

  // Show error toast when error changes
  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast('Nao foi possivel carregar a DRE. Verifique sua conexao e tente novamente.');
    }
  }, [error, showToast]);

  const periodLabel = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) return '';
    const month = MONTHS.find((m) => m.value === selectedMonth);
    const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId);
    return [month?.label, fy?.name].filter(Boolean).join(' / ');
  }, [selectedFiscalYearId, selectedMonth, fiscalYears]);

  const showMarginRanking = !selectedCostCenterId && data?.marginRanking && data.marginRanking.length > 0;

  return (
    <main className="dre-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="dre-page__breadcrumb" aria-label="Caminho da pagina">
        <span className="dre-page__breadcrumb-item">Inicio</span>
        <span className="dre-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="dre-page__breadcrumb-item">Contabilidade</span>
        <span className="dre-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="dre-page__breadcrumb-item dre-page__breadcrumb-item--current">
          DRE
        </span>
      </nav>

      {/* Header */}
      <header className="dre-page__header">
        <TrendingUp size={24} aria-hidden="true" className="dre-page__header-icon" />
        <h1 className="dre-page__title">Demonstracao do Resultado</h1>
      </header>

      {/* Filter bar */}
      <section className="dre-page__filter-bar" aria-label="Filtros do periodo">
        <div className="dre-page__filter-group">
          <label htmlFor="dre-fy-select" className="dre-page__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="dre-fy-select"
            className="dre-page__select"
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

        <div className="dre-page__filter-group">
          <label htmlFor="dre-month-select" className="dre-page__filter-label">
            Mes
          </label>
          <select
            id="dre-month-select"
            className="dre-page__select"
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

        <div className="dre-page__filter-group">
          <label htmlFor="dre-cc-select" className="dre-page__filter-label">
            Centro de Custo
          </label>
          <select
            id="dre-cc-select"
            className="dre-page__select"
            value={selectedCostCenterId}
            onChange={(e) => setSelectedCostCenterId(e.target.value)}
          >
            <option value="">Consolidado (todas as fazendas)</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="dre-page__filter-group dre-page__filter-group--toggle">
          <span className="dre-page__filter-label">Analise V/H</span>
          <button
            type="button"
            className={`dre-page__vh-toggle ${showVH ? 'dre-page__vh-toggle--active' : ''}`}
            aria-pressed={showVH}
            onClick={() => setShowVH((v) => !v)}
          >
            {showVH ? (
              <ToggleRight size={20} aria-hidden="true" />
            ) : (
              <ToggleLeft size={20} aria-hidden="true" />
            )}
            Analise V/H
          </button>
        </div>
      </section>

      {/* Export bar */}
      <div className="dre-page__export-bar">
        <button
          type="button"
          className="dre-page__btn dre-page__btn--secondary"
          onClick={() => showToast('Exportacao disponivel em breve.')}
          disabled={!hasFilters}
          aria-label="Exportar PDF da DRE"
        >
          <Download size={16} aria-hidden="true" />
          Exportar PDF
        </button>
        <button
          type="button"
          className="dre-page__btn dre-page__btn--secondary"
          onClick={() => showToast('Exportacao disponivel em breve.')}
          disabled={!hasFilters}
          aria-label="Exportar XLSX da DRE"
        >
          <Download size={16} aria-hidden="true" />
          Exportar XLSX
        </button>
      </div>

      {/* Empty state: no filters selected */}
      {!hasFilters && !loading && (
        <div className="dre-page__empty">
          <TrendingUp size={48} aria-hidden="true" className="dre-page__empty-icon" />
          <h2 className="dre-page__empty-title">Selecione o periodo</h2>
          <p className="dre-page__empty-desc">
            Escolha o exercicio fiscal e o mes para gerar a DRE.
          </p>
        </div>
      )}

      {/* DRE Table */}
      {hasFilters && (loading || data) && (
        <DreTable
          sections={data?.dre.sections ?? []}
          resultadoLiquido={data?.dre.resultadoLiquido ?? {
            accountId: null,
            code: '',
            name: 'Resultado Liquido',
            currentMonth: '0',
            ytd: '0',
            priorYear: '0',
            avPercent: null,
            ahPercent: null,
            isSubtotal: true,
            isCpc29: false,
            level: 0,
          }}
          showVH={showVH}
          loading={loading}
          period={periodLabel}
        />
      )}

      {/* Margin Ranking Chart */}
      {showMarginRanking && (
        <MarginRankingChart data={data!.marginRanking!} />
      )}

      {/* Toast */}
      {toast && (
        <div className="dre-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
