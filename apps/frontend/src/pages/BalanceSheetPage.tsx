import { useState, useMemo, useCallback, useEffect } from 'react';
import { Scale, Download } from 'lucide-react';
import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { useOrgId } from '@/hooks/useDre';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import IndicatorCard from '@/components/financial-statements/IndicatorCard';
import BalanceSheetTable from '@/components/financial-statements/BalanceSheetTable';
import './BalanceSheetPage.css';

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

// ─── Indicator config ─────────────────────────────────────────────────────────

const INDICATOR_CONFIG = [
  {
    key: 'liquidezCorrente' as const,
    label: 'LIQUIDEZ CORRENTE',
    tooltip: 'Ativo Circulante / Passivo Circulante',
  },
  {
    key: 'liquidezSeca' as const,
    label: 'LIQUIDEZ SECA',
    tooltip: '(Ativo Circulante - Estoques) / Passivo Circulante',
  },
  {
    key: 'endividamentoGeral' as const,
    label: 'ENDIVIDAMENTO GERAL',
    tooltip: 'Passivo Exigivel / Ativo Total',
  },
  {
    key: 'composicaoEndividamento' as const,
    label: 'COMPOSICAO ENDIVIDAMENTO',
    tooltip: 'Passivo Circulante / Passivo Exigivel',
  },
  {
    key: 'roe' as const,
    label: 'ROE',
    tooltip: 'Resultado Liquido / Patrimonio Liquido',
  },
  {
    key: 'plPorHectare' as const,
    label: 'PL POR HECTARE',
    tooltip: 'Patrimonio Liquido / Area Total (ha) de todas as fazendas',
  },
] as const;

// ─── Skeleton indicators ──────────────────────────────────────────────────────

function IndicatorsSkeleton() {
  return (
    <div className="balance-sheet-page__indicators-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="balance-sheet-page__indicator-skeleton"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
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

  const bsFilters = useMemo(
    () =>
      hasFilters
        ? { fiscalYearId: selectedFiscalYearId, month: selectedMonth }
        : null,
    [hasFilters, selectedFiscalYearId, selectedMonth],
  );

  const { data, loading, error } = useBalanceSheet(orgId, bsFilters);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast('Nao foi possivel carregar o Balanco Patrimonial. Tente novamente.');
    }
  }, [error, showToast]);

  const periodLabel = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) return '';
    const month = MONTHS.find((m) => m.value === selectedMonth);
    const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId);
    return [month?.label, fy?.name].filter(Boolean).join(' / ');
  }, [selectedFiscalYearId, selectedMonth, fiscalYears]);

  const emptyBpGroup = useMemo(
    () => ({
      accountId: null,
      code: '',
      name: '',
      currentBalance: '0',
      priorBalance: '0',
      isSubtotal: true,
      level: 0,
    }),
    [],
  );

  return (
    <main className="balance-sheet-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="balance-sheet-page__breadcrumb" aria-label="Caminho da pagina">
        <span className="balance-sheet-page__breadcrumb-item">Inicio</span>
        <span className="balance-sheet-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="balance-sheet-page__breadcrumb-item">Contabilidade</span>
        <span className="balance-sheet-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="balance-sheet-page__breadcrumb-item balance-sheet-page__breadcrumb-item--current">
          Balanco Patrimonial
        </span>
      </nav>

      {/* Header */}
      <header className="balance-sheet-page__header">
        <Scale size={24} aria-hidden="true" className="balance-sheet-page__header-icon" />
        <h1 className="balance-sheet-page__title">Balanco Patrimonial</h1>
      </header>

      {/* Filter bar */}
      <section className="balance-sheet-page__filter-bar" aria-label="Filtros do periodo">
        <div className="balance-sheet-page__filter-group">
          <label htmlFor="bs-fy-select" className="balance-sheet-page__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="bs-fy-select"
            className="balance-sheet-page__select"
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

        <div className="balance-sheet-page__filter-group">
          <label htmlFor="bs-month-select" className="balance-sheet-page__filter-label">
            Mes
          </label>
          <select
            id="bs-month-select"
            className="balance-sheet-page__select"
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

      {/* Indicators section */}
      {hasFilters && (
        <section aria-label="Indicadores financeiros">
          <h2 className="balance-sheet-page__section-heading">Indicadores Financeiros</h2>

          {loading ? (
            <IndicatorsSkeleton />
          ) : (
            <div className="balance-sheet-page__indicators-grid">
              {INDICATOR_CONFIG.map((config) => (
                <IndicatorCard
                  key={config.key}
                  label={config.label}
                  value={data?.indicators[config.key] ?? null}
                  tooltip={config.tooltip}
                  sparklineData={data?.indicators.sparklines[config.key] ?? []}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Export bar */}
      {hasFilters && (
        <div className="balance-sheet-page__export-bar">
          <button
            type="button"
            className="balance-sheet-page__btn balance-sheet-page__btn--secondary"
            onClick={() => showToast('Exportacao disponivel em breve.')}
            disabled={loading}
            aria-label="Exportar PDF do Balanco Patrimonial"
          >
            <Download size={16} aria-hidden="true" />
            Exportar PDF
          </button>
          <button
            type="button"
            className="balance-sheet-page__btn balance-sheet-page__btn--secondary"
            onClick={() => showToast('Exportacao disponivel em breve.')}
            disabled={loading}
            aria-label="Exportar XLSX do Balanco Patrimonial"
          >
            <Download size={16} aria-hidden="true" />
            Exportar XLSX
          </button>
        </div>
      )}

      {/* Empty state */}
      {!hasFilters && (
        <div className="balance-sheet-page__empty">
          <Scale size={48} aria-hidden="true" className="balance-sheet-page__empty-icon" />
          <h2 className="balance-sheet-page__empty-title">Selecione o periodo</h2>
          <p className="balance-sheet-page__empty-desc">
            Escolha o exercicio fiscal e o mes para gerar o balanco.
          </p>
        </div>
      )}

      {/* Balance Sheet Table */}
      {hasFilters && (loading || data) && (
        <BalanceSheetTable
          ativo={data?.ativo ?? []}
          passivo={data?.passivo ?? []}
          totalAtivo={data?.totalAtivo ?? { ...emptyBpGroup, name: 'Total Ativo' }}
          totalPassivo={data?.totalPassivo ?? { ...emptyBpGroup, name: 'Total Passivo + PL' }}
          loading={loading}
          period={periodLabel}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="balance-sheet-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
