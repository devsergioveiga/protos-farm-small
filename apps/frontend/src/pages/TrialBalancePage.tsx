import { useState, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Download,
  CheckCircle,
  XCircle,
  BookOpen,
} from 'lucide-react';
import {
  useTrialBalance,
  useDailyBook,
  useOrgId,
  exportTrialBalancePdf,
  exportTrialBalanceXlsx,
  exportDailyBookPdf,
} from '@/hooks/useLedger';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import type { TrialBalanceRow } from '@/types/journal-entries';
import './TrialBalancePage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function _formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(num));
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TrialBalanceSkeleton() {
  return (
    <div
      className="trial-balance-page__skeleton"
      aria-label="Carregando balancete de verificação..."
      aria-busy="true"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="trial-balance-page__skeleton-row">
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--sm" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--lg" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--md" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--md" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--md" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--md" />
        </div>
      ))}
    </div>
  );
}

function DailyBookSkeleton() {
  return (
    <div
      className="trial-balance-page__skeleton"
      aria-label="Carregando livro diário..."
      aria-busy="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="trial-balance-page__skeleton-row">
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--sm" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--lg" />
          <div className="trial-balance-page__skeleton-cell trial-balance-page__skeleton-cell--md" />
        </div>
      ))}
    </div>
  );
}

// ─── Trial Balance Table Row ──────────────────────────────────────────────────

interface TrialBalanceTableRowProps {
  row: TrialBalanceRow;
}

function TrialBalanceTableRow({ row }: TrialBalanceTableRowProps) {
  const rowClass = row.isSynthetic ? 'group-row' : 'analytic-row';

  return (
    <tr className={`trial-balance-table__row ${rowClass}`}>
      <td className="trial-balance-table__td amount-mono trial-balance-table__td--code">
        {row.accountCode}
      </td>
      <td
        className="trial-balance-table__td trial-balance-table__td--name"
        style={{ paddingLeft: `${Math.max(16, row.level * 16)}px` }}
      >
        {row.accountName}
      </td>
      <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono">
        {formatAmount(row.previousBalance)}
      </td>
      <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono amount-debit">
        {formatAmount(row.debitMovement)}
      </td>
      <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono amount-credit">
        {formatAmount(row.creditMovement)}
      </td>
      <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono">
        {formatAmount(row.currentBalance)}
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const orgId = useOrgId();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'balancete' | 'diario'>('balancete');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingDiarioPdf, setExportingDiarioPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // Compute date range for daily book from fiscal year + month
  const { startDate, endDate } = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) {
      return { startDate: undefined, endDate: undefined };
    }
    const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId);
    if (!fy) return { startDate: undefined, endDate: undefined };
    const year = new Date(fy.startDate).getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    const lastDay = new Date(year, selectedMonth, 0).getDate();
    return {
      startDate: `${year}-${monthStr}-01`,
      endDate: `${year}-${monthStr}-${lastDay}`,
    };
  }, [selectedFiscalYearId, selectedMonth, fiscalYears]);

  const { trialBalance, loading: tbLoading } = useTrialBalance(
    orgId,
    selectedFiscalYearId || undefined,
    selectedMonth,
  );

  const { dailyBook, loading: dbLoading } = useDailyBook(
    orgId,
    startDate,
    endDate,
  );

  const hasFilters = !!selectedFiscalYearId && !!selectedMonth;

  const handleExportPdf = useCallback(async () => {
    if (!orgId || !selectedFiscalYearId) return;
    setExportingPdf(true);
    try {
      await exportTrialBalancePdf(orgId, {
        fiscalYearId: selectedFiscalYearId,
        month: selectedMonth,
      });
    } catch {
      showToast('Não foi possível exportar o PDF. Tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  }, [orgId, selectedFiscalYearId, selectedMonth]);

  const handleExportXlsx = useCallback(async () => {
    if (!orgId || !selectedFiscalYearId) return;
    setExportingXlsx(true);
    try {
      await exportTrialBalanceXlsx(orgId, {
        fiscalYearId: selectedFiscalYearId,
        month: selectedMonth,
      });
    } catch {
      showToast('Não foi possível exportar o XLSX. Tente novamente.');
    } finally {
      setExportingXlsx(false);
    }
  }, [orgId, selectedFiscalYearId, selectedMonth]);

  const handleExportDiarioPdf = useCallback(async () => {
    if (!orgId || !startDate || !endDate) return;
    setExportingDiarioPdf(true);
    try {
      await exportDailyBookPdf(orgId, { startDate, endDate });
    } catch {
      showToast('Não foi possível exportar o PDF do livro diário. Tente novamente.');
    } finally {
      setExportingDiarioPdf(false);
    }
  }, [orgId, startDate, endDate]);

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
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

  return (
    <main className="trial-balance-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="trial-balance-page__breadcrumb" aria-label="Caminho da página">
        <span className="trial-balance-page__breadcrumb-item">Início</span>
        <span className="trial-balance-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="trial-balance-page__breadcrumb-item">Contabilidade</span>
        <span className="trial-balance-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="trial-balance-page__breadcrumb-item trial-balance-page__breadcrumb-item--current">
          Balancete de Verificação
        </span>
      </nav>

      {/* Header */}
      <header className="trial-balance-page__header">
        <div className="trial-balance-page__header-left">
          <BarChart3 size={24} aria-hidden="true" className="trial-balance-page__header-icon" />
          <h1 className="trial-balance-page__title">Balancete de Verificação</h1>
        </div>
      </header>

      {/* Period selectors */}
      <section className="trial-balance-page__filters" aria-label="Filtros do período">
        <div className="trial-balance-page__filter-group">
          <label htmlFor="fy-select" className="trial-balance-page__filter-label">
            Exercício fiscal
          </label>
          <select
            id="fy-select"
            className="trial-balance-page__select"
            value={selectedFiscalYearId}
            onChange={(e) => setSelectedFiscalYearId(e.target.value)}
          >
            <option value="">Selecione o exercício</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>

        <div className="trial-balance-page__filter-group">
          <label htmlFor="month-select-tb" className="trial-balance-page__filter-label">
            Mês
          </label>
          <select
            id="month-select-tb"
            className="trial-balance-page__select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Tabs */}
      <div className="trial-balance-page__tabs" role="tablist" aria-label="Seções do relatório">
        <button
          type="button"
          role="tab"
          id="tab-balancete"
          aria-controls="panel-balancete"
          aria-selected={activeTab === 'balancete'}
          className={`trial-balance-page__tab ${activeTab === 'balancete' ? 'trial-balance-page__tab--active' : ''}`}
          onClick={() => setActiveTab('balancete')}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Balancete
        </button>
        <button
          type="button"
          role="tab"
          id="tab-diario"
          aria-controls="panel-diario"
          aria-selected={activeTab === 'diario'}
          className={`trial-balance-page__tab ${activeTab === 'diario' ? 'trial-balance-page__tab--active' : ''}`}
          onClick={() => setActiveTab('diario')}
        >
          <BookOpen size={16} aria-hidden="true" />
          Livro Diário
        </button>
      </div>

      {/* Balancete Panel */}
      <div
        id="panel-balancete"
        role="tabpanel"
        aria-labelledby="tab-balancete"
        hidden={activeTab !== 'balancete'}
        className="trial-balance-page__panel"
      >
        {/* Balance validation bar */}
        {trialBalance && (
          <div
            className={`validation-bar ${trialBalance.isBalanced ? 'validation-bar--ok' : 'validation-bar--error'}`}
            role="status"
            aria-live="polite"
          >
            {trialBalance.isBalanced ? (
              <>
                <CheckCircle size={20} aria-hidden="true" />
                <span>Balancete equilibrado</span>
              </>
            ) : (
              <>
                <XCircle size={20} aria-hidden="true" />
                <span>
                  Atenção: débitos e créditos divergem em R${' '}
                  {formatAmount(
                    String(
                      Math.abs(
                        parseFloat(trialBalance.grandTotals.movementDebit) -
                          parseFloat(trialBalance.grandTotals.movementCredit),
                      ),
                    ),
                  )}
                </span>
              </>
            )}
          </div>
        )}

        {/* Export buttons */}
        <div className="trial-balance-page__actions">
          <button
            type="button"
            className="trial-balance-page__btn trial-balance-page__btn--secondary"
            onClick={() => { void handleExportXlsx(); }}
            disabled={!hasFilters || exportingXlsx}
            aria-label="Exportar XLSX do balancete"
          >
            {exportingXlsx ? (
              <span className="trial-balance-page__spinner" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Exportar XLSX
          </button>
          <button
            type="button"
            className="trial-balance-page__btn trial-balance-page__btn--secondary"
            onClick={() => { void handleExportPdf(); }}
            disabled={!hasFilters || exportingPdf}
            aria-label="Exportar PDF do balancete"
          >
            {exportingPdf ? (
              <span className="trial-balance-page__spinner" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Exportar PDF
          </button>
        </div>

        {/* Loading */}
        {tbLoading && <TrialBalanceSkeleton />}

        {/* Empty state */}
        {!tbLoading && hasFilters && (!trialBalance || trialBalance.rows.length === 0) && (
          <div className="trial-balance-page__empty">
            <BarChart3 size={48} aria-hidden="true" className="trial-balance-page__empty-icon" />
            <p className="trial-balance-page__empty-text">
              Nenhum movimento no período selecionado.
            </p>
          </div>
        )}

        {/* No period selected */}
        {!tbLoading && !hasFilters && (
          <div className="trial-balance-page__empty">
            <BarChart3 size={48} aria-hidden="true" className="trial-balance-page__empty-icon" />
            <p className="trial-balance-page__empty-text">
              Selecione o exercício fiscal e o mês para visualizar o balancete.
            </p>
          </div>
        )}

        {/* Table */}
        {!tbLoading && trialBalance && trialBalance.rows.length > 0 && (
          <div className="trial-balance-page__table-wrapper">
            <table className="trial-balance-table" aria-label="Balancete de verificação">
              <caption className="trial-balance-table__caption">
                Balancete de Verificação
                {selectedFiscalYearId && (
                  <span className="trial-balance-table__caption-period">
                    {' '}| {months.find((m) => m.value === selectedMonth)?.label}
                  </span>
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--code">
                    Código
                  </th>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--name">
                    Conta
                  </th>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--amount">
                    Saldo Anterior (D/C)
                  </th>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--amount amount-debit">
                    Movimento Débito
                  </th>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--amount amount-credit">
                    Movimento Crédito
                  </th>
                  <th scope="col" className="trial-balance-table__th trial-balance-table__th--amount">
                    Saldo Atual (D/C)
                  </th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.rows.map((row) => (
                  <TrialBalanceTableRow key={row.accountId} row={row} />
                ))}
              </tbody>
              {/* Grand totals */}
              <tfoot>
                <tr className="total-row">
                  <td className="trial-balance-table__td trial-balance-table__td--code" />
                  <td className="trial-balance-table__td total-row__label">Total Geral</td>
                  <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono">
                    {formatAmount(trialBalance.grandTotals.previousBalanceDebit)}
                  </td>
                  <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono amount-debit">
                    {formatAmount(trialBalance.grandTotals.movementDebit)}
                  </td>
                  <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono amount-credit">
                    {formatAmount(trialBalance.grandTotals.movementCredit)}
                  </td>
                  <td className="trial-balance-table__td trial-balance-table__td--amount amount-mono">
                    {formatAmount(trialBalance.grandTotals.currentBalanceDebit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Daily Book Panel */}
      <div
        id="panel-diario"
        role="tabpanel"
        aria-labelledby="tab-diario"
        hidden={activeTab !== 'diario'}
        className="trial-balance-page__panel"
      >
        {/* Section header + export */}
        <div className="trial-balance-page__diario-header">
          <h2 className="trial-balance-page__diario-title">
            <BookOpen size={20} aria-hidden="true" />
            Livro Diário
          </h2>
          <button
            type="button"
            className="trial-balance-page__btn trial-balance-page__btn--secondary"
            onClick={() => { void handleExportDiarioPdf(); }}
            disabled={!startDate || !endDate || exportingDiarioPdf}
            aria-label="Exportar PDF do livro diário"
          >
            {exportingDiarioPdf ? (
              <span className="trial-balance-page__spinner" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Exportar PDF
          </button>
        </div>

        {/* Loading */}
        {dbLoading && <DailyBookSkeleton />}

        {/* No period selected */}
        {!dbLoading && (!startDate || !endDate) && (
          <div className="trial-balance-page__empty">
            <BookOpen size={48} aria-hidden="true" className="trial-balance-page__empty-icon" />
            <p className="trial-balance-page__empty-text">
              Selecione o exercício fiscal e o mês para visualizar o livro diário.
            </p>
          </div>
        )}

        {/* Empty */}
        {!dbLoading && startDate && endDate && (!dailyBook || dailyBook.entries.length === 0) && (
          <div className="trial-balance-page__empty">
            <BookOpen size={48} aria-hidden="true" className="trial-balance-page__empty-icon" />
            <p className="trial-balance-page__empty-text">
              Nenhum lançamento no período selecionado.
            </p>
          </div>
        )}

        {/* Entry list */}
        {!dbLoading && dailyBook && dailyBook.entries.length > 0 && (
          <div className="trial-balance-page__diario-entries">
            {dailyBook.entries.map((entry) => (
              <article
                key={entry.entryId}
                className="diario-entry"
                aria-label={`Lançamento ${entry.entryNumber} — ${formatDate(entry.entryDate)}`}
              >
                <header className="diario-entry__header">
                  <span className="diario-entry__date">{formatDate(entry.entryDate)}</span>
                  <span className="amount-mono diario-entry__number">#{entry.entryNumber}</span>
                  <span className="diario-entry__description">{entry.description}</span>
                </header>
                <table
                  className="diario-entry__table"
                  aria-label={`Linhas do lançamento ${entry.entryNumber}`}
                >
                  <thead>
                    <tr>
                      <th scope="col" className="diario-entry__th">Conta</th>
                      <th scope="col" className="diario-entry__th diario-entry__th--amount amount-debit">Débito</th>
                      <th scope="col" className="diario-entry__th diario-entry__th--amount amount-credit">Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, idx) => (
                      <tr key={idx} className="diario-entry__line">
                        <td className="diario-entry__td">
                          <span className="amount-mono diario-entry__account-code">
                            {line.accountCode}
                          </span>
                          <span className="diario-entry__account-name">{line.accountName}</span>
                        </td>
                        <td className="diario-entry__td diario-entry__td--amount amount-mono amount-debit">
                          {line.side === 'DEBIT' ? `R$ ${formatAmount(line.amount)}` : ''}
                        </td>
                        <td className="diario-entry__td diario-entry__td--amount amount-mono amount-credit">
                          {line.side === 'CREDIT' ? `R$ ${formatAmount(line.amount)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="trial-balance-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
