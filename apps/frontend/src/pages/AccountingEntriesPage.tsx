import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Download, BookMarked, ChevronDown, ChevronUp } from 'lucide-react';
import { useAccountingEntries } from '@/hooks/useAccountingEntries';
import {
  AccountingEntryType,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_BADGE_COLORS,
} from '@/types/accounting-entries';
import type { AccountingEntry, AccountingEntryListFilters } from '@/types/accounting-entries';
import './AccountingEntriesPage.css';

const MONTH_OPTIONS = [
  { value: '', label: 'Todos os meses' },
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m] ?? month}/${year}`;
}

function EntryTypeBadge({ type }: { type: AccountingEntryType }) {
  const colors = ENTRY_TYPE_BADGE_COLORS[type];
  const label = ENTRY_TYPE_LABELS[type] ?? type;
  return (
    <span
      className="ae-page__badge"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="ae-page__td">
          <div className="ae-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

interface EntryRowProps {
  entry: AccountingEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function EntryRow({ entry, isExpanded, onToggle }: EntryRowProps) {
  const runLabel = `FOLHA-${entry.referenceMonth}`;

  return (
    <>
      <tr
        className={`ae-page__row ae-page__row--clickable${isExpanded ? ' ae-page__row--expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <td className="ae-page__td">{formatMonth(entry.referenceMonth)}</td>
        <td className="ae-page__td">
          <EntryTypeBadge type={entry.entryType} />
        </td>
        <td className="ae-page__td ae-page__td--mono ae-page__td--hidden-mobile">
          {entry.debitAccount}
        </td>
        <td className="ae-page__td ae-page__td--mono ae-page__td--hidden-mobile">
          {entry.creditAccount}
        </td>
        <td className="ae-page__td ae-page__td--mono ae-page__td--right">
          {formatCurrency(entry.amount)}
        </td>
        <td className="ae-page__td ae-page__td--hidden-tablet">
          {entry.costCenterName ?? '—'}
        </td>
        <td className="ae-page__td">
          <span className="ae-page__origin-pill">
            {runLabel}
          </span>
          <button
            type="button"
            className="ae-page__expand-btn"
            aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded
              ? <ChevronUp size={14} aria-hidden="true" />
              : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="ae-page__accordion-row">
          <td colSpan={7} className="ae-page__accordion-cell">
            <div className="ae-page__accordion-content">
              <div className="ae-page__accordion-grid">
                <div className="ae-page__accordion-item">
                  <span className="ae-page__accordion-label">Débito</span>
                  <span className="ae-page__accordion-value">
                    <span className="ae-page__mono">{entry.debitAccount}</span>
                    {' — '}
                    {entry.debitLabel}
                  </span>
                </div>
                <div className="ae-page__accordion-item">
                  <span className="ae-page__accordion-label">Crédito</span>
                  <span className="ae-page__accordion-value">
                    <span className="ae-page__mono">{entry.creditAccount}</span>
                    {' — '}
                    {entry.creditLabel}
                  </span>
                </div>
                {entry.notes && (
                  <div className="ae-page__accordion-item ae-page__accordion-item--full">
                    <span className="ae-page__accordion-label">Observações</span>
                    <span className="ae-page__accordion-value">{entry.notes}</span>
                  </div>
                )}
                {entry.reversedById && (
                  <div className="ae-page__accordion-item ae-page__accordion-item--full">
                    <span className="ae-page__accordion-label">Estornado por</span>
                    <span className="ae-page__accordion-value ae-page__mono">
                      {entry.reversedById}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const PAGE_SIZE = 20;

export default function AccountingEntriesPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterType, setFilterType] = useState<AccountingEntryType | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { entries, isLoading, error, totalCount, refetch, exportCsv } = useAccountingEntries();

  const buildFilters = useCallback((): AccountingEntryListFilters => {
    const filters: AccountingEntryListFilters = {
      page: currentPage,
      limit: PAGE_SIZE,
    };
    if (filterYear && filterMonth) {
      filters.referenceMonth = `${filterYear}-${filterMonth}`;
    } else if (filterYear) {
      // pass just year — backend may support partial filtering
      filters.referenceMonth = filterYear;
    }
    if (filterType) filters.entryType = filterType;
    return filters;
  }, [filterMonth, filterYear, filterType, currentPage]);

  useEffect(() => {
    refetch(buildFilters());
  }, [filterMonth, filterYear, filterType, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  function handleExport() {
    const filters = buildFilters();
    exportCsv(filters);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main className="ae-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="ae-page__breadcrumb" aria-label="Navegação estrutural">
        <span className="ae-page__bc-item">Dashboard</span>
        <span className="ae-page__bc-sep" aria-hidden="true">/</span>
        <span className="ae-page__bc-item">Contabilidade</span>
        <span className="ae-page__bc-sep" aria-hidden="true">/</span>
        <span className="ae-page__bc-item ae-page__bc-item--current" aria-current="page">
          Lançamentos
        </span>
      </nav>

      {/* Page header */}
      <div className="ae-page__header">
        <h1 className="ae-page__title">
          <BookOpen size={24} aria-hidden="true" className="ae-page__title-icon" />
          Lançamentos Contábeis
        </h1>
        <button
          type="button"
          className="ae-page__export-btn"
          onClick={handleExport}
          aria-label="Exportar lançamentos contábeis em CSV"
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="ae-page__error" role="alert">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="ae-page__filters">
        <div className="ae-page__filter-group">
          <label htmlFor="ae-filter-month" className="ae-page__filter-label">Mês</label>
          <select
            id="ae-filter-month"
            className="ae-page__filter-select"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="ae-page__filter-group">
          <label htmlFor="ae-filter-year" className="ae-page__filter-label">Ano</label>
          <select
            id="ae-filter-year"
            className="ae-page__filter-select"
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>

        <div className="ae-page__filter-group">
          <label htmlFor="ae-filter-type" className="ae-page__filter-label">Tipo</label>
          <select
            id="ae-filter-type"
            className="ae-page__filter-select"
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as AccountingEntryType | ''); setCurrentPage(1); }}
          >
            <option value="">Todos os tipos</option>
            {(Object.values(AccountingEntryType) as AccountingEntryType[]).map((type) => (
              <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="ae-page__table-wrapper">
        <table className="ae-page__table">
          <caption className="sr-only">Lançamentos contábeis gerados pelo sistema</caption>
          <thead>
            <tr>
              <th scope="col" className="ae-page__th">COMPETÊNCIA</th>
              <th scope="col" className="ae-page__th">TIPO</th>
              <th scope="col" className="ae-page__th ae-page__th--hidden-mobile">DÉBITO</th>
              <th scope="col" className="ae-page__th ae-page__th--hidden-mobile">CRÉDITO</th>
              <th scope="col" className="ae-page__th ae-page__th--right">VALOR</th>
              <th scope="col" className="ae-page__th ae-page__th--hidden-tablet">CENTRO DE CUSTO</th>
              <th scope="col" className="ae-page__th">ORIGEM</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && entries.length === 0 && !error && (
              <tr>
                <td colSpan={7}>
                  <div className="ae-page__empty">
                    <BookMarked size={48} aria-hidden="true" className="ae-page__empty-icon" />
                    <p className="ae-page__empty-title">Nenhum lançamento contábil ainda</p>
                    <p className="ae-page__empty-desc">
                      Os lançamentos são gerados automaticamente ao fechar uma folha de pagamento.
                      Feche a folha do mês para ver os registros aqui.
                    </p>
                    <button
                      type="button"
                      className="ae-page__empty-cta"
                      onClick={() => navigate('/payroll-runs')}
                    >
                      Ir para Folha de Pagamento
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedId === entry.id}
                  onToggle={() => toggleExpand(entry.id)}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && entries.length > 0 && (
        <ul className="ae-page__mobile-list" role="list">
          {entries.map((entry) => (
            <li key={entry.id} className="ae-page__mobile-card">
              <div className="ae-page__mobile-card-header">
                <EntryTypeBadge type={entry.entryType} />
                <span className="ae-page__mobile-competencia">
                  {formatMonth(entry.referenceMonth)}
                </span>
              </div>
              <div className="ae-page__mobile-card-value">
                {formatCurrency(entry.amount)}
              </div>
              <div className="ae-page__mobile-card-origin">
                <span className="ae-page__origin-pill">FOLHA-{entry.referenceMonth}</span>
              </div>
              {expandedId === entry.id && (
                <div className="ae-page__mobile-card-detail">
                  <div className="ae-page__accordion-item">
                    <span className="ae-page__accordion-label">Débito</span>
                    <span className="ae-page__mono">{entry.debitAccount} — {entry.debitLabel}</span>
                  </div>
                  <div className="ae-page__accordion-item">
                    <span className="ae-page__accordion-label">Crédito</span>
                    <span className="ae-page__mono">{entry.creditAccount} — {entry.creditLabel}</span>
                  </div>
                  {entry.notes && (
                    <div className="ae-page__accordion-item">
                      <span className="ae-page__accordion-label">Observações</span>
                      <span>{entry.notes}</span>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className="ae-page__mobile-expand-btn"
                aria-expanded={expandedId === entry.id}
                aria-label={expandedId === entry.id ? 'Recolher detalhes' : 'Ver detalhes'}
                onClick={() => toggleExpand(entry.id)}
              >
                {expandedId === entry.id ? 'Ocultar detalhes' : 'Ver detalhes'}
                {expandedId === entry.id
                  ? <ChevronUp size={14} aria-hidden="true" />
                  : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="ae-page__pagination" aria-label="Paginação de lançamentos">
          <button
            type="button"
            className="ae-page__page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Página anterior"
          >
            Anterior
          </button>
          <span className="ae-page__page-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="ae-page__page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Próxima página"
          >
            Próxima
          </button>
        </nav>
      )}
    </main>
  );
}
