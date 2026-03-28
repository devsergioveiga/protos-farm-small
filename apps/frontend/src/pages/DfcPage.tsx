import { useState, useMemo } from 'react';
import { ArrowLeftRight, Download } from 'lucide-react';
import { useDfc, useOrgId } from '@/hooks/useDfc';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import DfcTable from '@/components/financial-statements/DfcTable';
import './DfcPage.css';

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

type DfcMethod = 'direto' | 'indireto';

export default function DfcPage() {
  const orgId = useOrgId();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<DfcMethod>('direto');

  const hasFilters = !!selectedFiscalYearId && !!selectedMonth;

  const { data, loading, error } = useDfc(
    orgId,
    selectedFiscalYearId || null,
    hasFilters ? selectedMonth : null,
  );

  const periodLabel = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) return '';
    const month = MONTHS.find((m) => m.value === selectedMonth);
    const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId);
    return [month?.label, fy?.name].filter(Boolean).join(' / ');
  }, [selectedFiscalYearId, selectedMonth, fiscalYears]);

  return (
    <main className="dfc-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="dfc-page__breadcrumb" aria-label="Caminho da pagina">
        <span className="dfc-page__breadcrumb-item">Inicio</span>
        <span className="dfc-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="dfc-page__breadcrumb-item">Contabilidade</span>
        <span className="dfc-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="dfc-page__breadcrumb-item dfc-page__breadcrumb-item--current">DFC</span>
      </nav>

      {/* Header */}
      <header className="dfc-page__header">
        <ArrowLeftRight size={24} aria-hidden="true" className="dfc-page__header-icon" />
        <h1 className="dfc-page__title">DFC — Demonstracao do Fluxo de Caixa</h1>
      </header>

      {/* Subtitle */}
      <p className="dfc-page__subtitle">Fluxo de entradas e saidas de caixa no periodo</p>

      {/* Filter bar */}
      <section className="dfc-page__filter-bar" aria-label="Filtros do periodo">
        <div className="dfc-page__filter-group">
          <label htmlFor="dfc-fy-select" className="dfc-page__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="dfc-fy-select"
            className="dfc-page__select"
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

        <div className="dfc-page__filter-group">
          <label htmlFor="dfc-month-select" className="dfc-page__filter-label">
            Mes
          </label>
          <select
            id="dfc-month-select"
            className="dfc-page__select"
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

        {/* Export button */}
        <div className="dfc-page__filter-group dfc-page__filter-group--export">
          <button
            type="button"
            className="dfc-page__btn dfc-page__btn--secondary"
            disabled={!hasFilters || loading}
            aria-label="Exportar CSV da DFC"
          >
            <Download size={16} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>
      </section>

      {/* Tabs */}
      {hasFilters && (
        <nav
          className="dfc-page__tabs"
          role="tablist"
          aria-label="Metodo de calculo"
        >
          <button
            type="button"
            role="tab"
            id="tab-direto"
            aria-selected={activeTab === 'direto'}
            aria-controls="panel-direto"
            className={`dfc-page__tab ${activeTab === 'direto' ? 'dfc-page__tab--active' : ''}`}
            onClick={() => setActiveTab('direto')}
          >
            Metodo Direto
          </button>
          <button
            type="button"
            role="tab"
            id="tab-indireto"
            aria-selected={activeTab === 'indireto'}
            aria-controls="panel-indireto"
            className={`dfc-page__tab ${activeTab === 'indireto' ? 'dfc-page__tab--active' : ''}`}
            onClick={() => setActiveTab('indireto')}
          >
            Metodo Indireto
          </button>
        </nav>
      )}

      {/* Empty state: no filters selected */}
      {!hasFilters && !loading && (
        <div className="dfc-page__empty">
          <ArrowLeftRight size={48} aria-hidden="true" className="dfc-page__empty-icon" />
          <h2 className="dfc-page__empty-title">Nenhum dado disponivel para o periodo</h2>
          <p className="dfc-page__empty-desc">
            Selecione um exercicio fiscal e mes para gerar a demonstracao.
          </p>
        </div>
      )}

      {/* Error state */}
      {hasFilters && !loading && error && (
        <div className="dfc-page__error" role="alert">
          <h2 className="dfc-page__error-title">Erro ao carregar</h2>
          <p className="dfc-page__error-desc">
            Nao foi possivel carregar a DFC. Verifique sua conexao e tente novamente.
          </p>
        </div>
      )}

      {/* DFC panels — use hidden attribute to preserve tab state */}
      {hasFilters && !error && (
        <>
          <section
            role="tabpanel"
            id="panel-direto"
            aria-labelledby="tab-direto"
            hidden={activeTab !== 'direto'}
          >
            <DfcTable
              data={data?.direto ?? {
                sections: [],
                cash: {
                  saldoInicial: { currentMonth: '0', ytd: '0', priorYear: '0' },
                  variacaoLiquida: { currentMonth: '0', ytd: '0', priorYear: '0' },
                  saldoFinal: { currentMonth: '0', ytd: '0', priorYear: '0' },
                },
              }}
              caption={`DFC Metodo Direto${periodLabel ? ` — ${periodLabel}` : ''}`}
              loading={loading}
            />
          </section>

          <section
            role="tabpanel"
            id="panel-indireto"
            aria-labelledby="tab-indireto"
            hidden={activeTab !== 'indireto'}
          >
            <DfcTable
              data={data?.indireto ?? {
                sections: [],
                cash: {
                  saldoInicial: { currentMonth: '0', ytd: '0', priorYear: '0' },
                  variacaoLiquida: { currentMonth: '0', ytd: '0', priorYear: '0' },
                  saldoFinal: { currentMonth: '0', ytd: '0', priorYear: '0' },
                },
              }}
              caption={`DFC Metodo Indireto${periodLabel ? ` — ${periodLabel}` : ''}`}
              loading={loading}
            />
          </section>
        </>
      )}
    </main>
  );
}
