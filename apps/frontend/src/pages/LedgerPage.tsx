import { useState, useMemo, useCallback } from 'react';
import { Search, Download, FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useLedger, useOrgId, exportLedgerCsv, exportLedgerPdf } from '@/hooks/useLedger';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import type { LedgerLine } from '@/types/journal-entries';
import './LedgerPage.css';

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LedgerSkeleton() {
  return (
    <div className="ledger-page__skeleton" aria-label="Carregando razão contábil..." aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ledger-page__skeleton-row">
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--sm" />
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--sm" />
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--lg" />
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--md" />
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--md" />
          <div className="ledger-page__skeleton-cell ledger-page__skeleton-cell--md" />
        </div>
      ))}
    </div>
  );
}

// ─── Entry Detail Modal ────────────────────────────────────────────────────────

interface EntryDetailModalProps {
  entry: LedgerLine | null;
  onClose: () => void;
}

function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
  if (!entry) return null;
  return (
    <div
      className="ledger-page__modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="ledger-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ledger-page__modal-header">
          <h2 id="entry-detail-title" className="ledger-page__modal-title">
            Lançamento #{entry.entryNumber}
          </h2>
          <button
            type="button"
            className="ledger-page__modal-close"
            onClick={onClose}
            aria-label="Fechar detalhe do lançamento"
          >
            ×
          </button>
        </div>
        <div className="ledger-page__modal-body">
          <dl className="ledger-page__detail-list">
            <div className="ledger-page__detail-row">
              <dt>Data</dt>
              <dd>{formatDate(entry.entryDate)}</dd>
            </div>
            <div className="ledger-page__detail-row">
              <dt>Número</dt>
              <dd className="amount-mono">{entry.entryNumber}</dd>
            </div>
            <div className="ledger-page__detail-row">
              <dt>Histórico</dt>
              <dd>{entry.description}</dd>
            </div>
            <div className="ledger-page__detail-row">
              <dt>Tipo</dt>
              <dd className={entry.side === 'DEBIT' ? 'amount-debit' : 'amount-credit'}>
                {entry.side === 'DEBIT' ? 'Débito' : 'Crédito'}
              </dd>
            </div>
            <div className="ledger-page__detail-row">
              <dt>Valor</dt>
              <dd className={`amount-mono ${entry.side === 'DEBIT' ? 'amount-debit' : 'amount-credit'}`}>
                R$ {formatAmount(entry.amount)}
              </dd>
            </div>
            <div className="ledger-page__detail-row">
              <dt>Saldo Progressivo</dt>
              <dd className={`amount-mono ${parseFloat(entry.runningBalance) < 0 ? 'amount-debit' : ''}`}>
                R$ {formatAmount(entry.runningBalance)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const orgId = useOrgId();
  const { data: accounts } = useChartOfAccounts();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerLine | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // Analytics-only accounts for selection
  const analyticAccounts = useMemo(
    () => accounts.filter((a) => !a.isSynthetic && a.isActive),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return analyticAccounts;
    const lower = accountSearch.toLowerCase();
    return analyticAccounts.filter(
      (a) => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower),
    );
  }, [analyticAccounts, accountSearch]);

  const selectedAccount = useMemo(
    () => analyticAccounts.find((a) => a.id === selectedAccountId),
    [analyticAccounts, selectedAccountId],
  );

  // Determine date range from fiscal year + month
  const { startDate, endDate } = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) return { startDate: undefined, endDate: undefined };
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

  const { ledger, loading, error } = useLedger(
    orgId,
    selectedAccountId || undefined,
    startDate,
    endDate,
  );

  const handleAccountSelect = useCallback((id: string, name: string, code: string) => {
    setSelectedAccountId(id);
    setAccountSearch(`${code} — ${name}`);
    setShowAccountDropdown(false);
  }, []);

  const handleExportCsv = async () => {
    if (!orgId || !selectedAccountId || !startDate || !endDate) return;
    setExportingCsv(true);
    try {
      await exportLedgerCsv(orgId, {
        accountId: selectedAccountId,
        startDate,
        endDate,
      });
    } catch {
      showToast('Não foi possível exportar o CSV. Tente novamente.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (!orgId || !selectedAccountId || !startDate || !endDate) return;
    setExportingPdf(true);
    try {
      await exportLedgerPdf(orgId, {
        accountId: selectedAccountId,
        startDate,
        endDate,
      });
    } catch {
      showToast('Não foi possível exportar o PDF. Tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  };

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

  const hasFilters = !!selectedAccountId && !!startDate && !!endDate;

  return (
    <main className="ledger-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="ledger-page__breadcrumb" aria-label="Caminho da página">
        <span className="ledger-page__breadcrumb-item">Início</span>
        <span className="ledger-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="ledger-page__breadcrumb-item">Contabilidade</span>
        <span className="ledger-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="ledger-page__breadcrumb-item ledger-page__breadcrumb-item--current">
          Razão Contábil
        </span>
      </nav>

      {/* Header */}
      <header className="ledger-page__header">
        <div className="ledger-page__header-left">
          <FileText size={24} aria-hidden="true" className="ledger-page__header-icon" />
          <h1 className="ledger-page__title">Razão Contábil</h1>
        </div>
        <div className="ledger-page__header-actions">
          <button
            type="button"
            className="ledger-page__btn ledger-page__btn--secondary"
            onClick={() => { void handleExportCsv(); }}
            disabled={!hasFilters || exportingCsv}
            aria-label="Exportar CSV do razão"
          >
            {exportingCsv ? (
              <span className="ledger-page__spinner" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Exportar CSV
          </button>
          <button
            type="button"
            className="ledger-page__btn ledger-page__btn--secondary"
            onClick={() => { void handleExportPdf(); }}
            disabled={!hasFilters || exportingPdf}
            aria-label="Exportar PDF do razão"
          >
            {exportingPdf ? (
              <span className="ledger-page__spinner" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Exportar PDF
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="ledger-page__filters" aria-label="Filtros do razão">
        {/* Account selector */}
        <div className="ledger-page__filter-group">
          <label htmlFor="account-search" className="ledger-page__filter-label">
            Conta analítica
          </label>
          <div className="ledger-page__account-selector" role="combobox" aria-expanded={showAccountDropdown} aria-haspopup="listbox">
            <div className="ledger-page__account-input-wrapper">
              <Search size={16} aria-hidden="true" className="ledger-page__search-icon" />
              <input
                id="account-search"
                type="text"
                className="ledger-page__account-input"
                placeholder="Selecione uma conta analítica"
                value={accountSearch}
                onChange={(e) => {
                  setAccountSearch(e.target.value);
                  setShowAccountDropdown(true);
                  if (!e.target.value) setSelectedAccountId('');
                }}
                onFocus={() => setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 200)}
                aria-autocomplete="list"
                aria-controls="account-listbox"
              />
              {showAccountDropdown ? (
                <ChevronUp size={16} aria-hidden="true" className="ledger-page__chevron" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" className="ledger-page__chevron" />
              )}
            </div>
            {showAccountDropdown && filteredAccounts.length > 0 && (
              <ul
                id="account-listbox"
                role="listbox"
                className="ledger-page__account-dropdown"
                aria-label="Contas analíticas disponíveis"
              >
                {filteredAccounts.slice(0, 50).map((account) => (
                  <li
                    key={account.id}
                    role="option"
                    aria-selected={account.id === selectedAccountId}
                    className={`ledger-page__account-option ${account.id === selectedAccountId ? 'ledger-page__account-option--selected' : ''}`}
                    onMouseDown={() => handleAccountSelect(account.id, account.name, account.code)}
                  >
                    <span className="amount-mono ledger-page__account-code">{account.code}</span>
                    <span className="ledger-page__account-name">{account.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Period selector */}
        <div className="ledger-page__filter-group">
          <label htmlFor="fiscal-year-select" className="ledger-page__filter-label">
            Exercício fiscal
          </label>
          <select
            id="fiscal-year-select"
            className="ledger-page__select"
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

        <div className="ledger-page__filter-group">
          <label htmlFor="month-select" className="ledger-page__filter-label">
            Período
          </label>
          <select
            id="month-select"
            className="ledger-page__select"
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

      {/* Content */}
      <section className="ledger-page__body" aria-label="Razão contábil">
        {!selectedAccountId && (
          <div className="ledger-page__empty">
            <Search size={48} aria-hidden="true" className="ledger-page__empty-icon" />
            <p className="ledger-page__empty-text">
              Selecione uma conta para visualizar o razão.
            </p>
          </div>
        )}

        {selectedAccountId && loading && <LedgerSkeleton />}

        {selectedAccountId && !loading && error && (
          <div className="ledger-page__error" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {selectedAccountId && !loading && !error && ledger && ledger.lines.length === 0 && (
          <div className="ledger-page__empty">
            <Search size={48} aria-hidden="true" className="ledger-page__empty-icon" />
            <p className="ledger-page__empty-text">
              Nenhum lançamento nesta conta para o período selecionado.
            </p>
          </div>
        )}

        {selectedAccountId && !loading && !error && ledger && ledger.lines.length > 0 && (
          <div className="ledger-page__table-wrapper">
            <table className="ledger-table" aria-label={`Razão da conta ${selectedAccount?.code ?? ''} — ${selectedAccount?.name ?? ''}`}>
              <caption className="ledger-table__caption">
                {selectedAccount?.code} — {selectedAccount?.name}
                {startDate && endDate && (
                  <span className="ledger-table__caption-period">
                    {' '}| {formatDate(startDate)} a {formatDate(endDate)}
                  </span>
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="ledger-table__th">Data</th>
                  <th scope="col" className="ledger-table__th">Número</th>
                  <th scope="col" className="ledger-table__th ledger-table__th--wide">Histórico</th>
                  <th scope="col" className="ledger-table__th ledger-table__th--amount amount-debit">Débito</th>
                  <th scope="col" className="ledger-table__th ledger-table__th--amount amount-credit">Crédito</th>
                  <th scope="col" className="ledger-table__th ledger-table__th--amount ledger-table__th--balance running-balance-col">Saldo Progressivo</th>
                </tr>
              </thead>
              <tbody>
                {/* Saldo Anterior row */}
                <tr className="saldo-anterior-row">
                  <td className="ledger-table__td" />
                  <td className="ledger-table__td" />
                  <td className="ledger-table__td ledger-table__td--bold">Saldo Anterior</td>
                  <td className="ledger-table__td ledger-table__td--amount amount-mono" />
                  <td className="ledger-table__td ledger-table__td--amount amount-mono" />
                  <td className="ledger-table__td ledger-table__td--amount amount-mono">
                    R$ {formatAmount(ledger.previousBalance)}
                  </td>
                </tr>
                {/* Entry rows */}
                {ledger.lines.map((line) => (
                  <tr
                    key={`${line.entryId}-${line.side}`}
                    className="ledger-table__row"
                    onClick={() => setSelectedEntry(line)}
                  >
                    <td className="ledger-table__td">{formatDate(line.entryDate)}</td>
                    <td className="ledger-table__td amount-mono">
                      <button
                        type="button"
                        className="ledger-table__entry-link"
                        onClick={(e) => { e.stopPropagation(); setSelectedEntry(line); }}
                        aria-label={`Ver detalhe do lançamento ${line.entryNumber}`}
                      >
                        #{line.entryNumber}
                      </button>
                    </td>
                    <td className="ledger-table__td">{line.description}</td>
                    <td className="ledger-table__td ledger-table__td--amount amount-mono amount-debit">
                      {line.side === 'DEBIT' ? `R$ ${formatAmount(line.amount)}` : ''}
                    </td>
                    <td className="ledger-table__td ledger-table__td--amount amount-mono amount-credit">
                      {line.side === 'CREDIT' ? `R$ ${formatAmount(line.amount)}` : ''}
                    </td>
                    <td className={`ledger-table__td ledger-table__td--amount amount-mono running-balance-col ${parseFloat(line.runningBalance) < 0 ? 'amount-debit' : ''}`}>
                      R$ {formatAmount(line.runningBalance)}
                    </td>
                  </tr>
                ))}
                {/* Final balance row */}
                <tr className="saldo-anterior-row">
                  <td className="ledger-table__td" />
                  <td className="ledger-table__td" />
                  <td className="ledger-table__td ledger-table__td--bold">Saldo Final</td>
                  <td className="ledger-table__td ledger-table__td--amount amount-mono" />
                  <td className="ledger-table__td ledger-table__td--amount amount-mono" />
                  <td className="ledger-table__td ledger-table__td--amount amount-mono">
                    R$ {formatAmount(ledger.finalBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Entry detail modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="ledger-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
