import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Upload,
  FileText,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  MoreVertical,
  Eye,
  Pencil,
  Undo2,
  Trash2,
  Settings,
} from 'lucide-react';
import { useJournalEntries, useJournalEntryActions } from '@/hooks/useJournalEntries';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import { useAuth } from '@/stores/AuthContext';
import { usePendingCounts } from '@/hooks/usePendingPostings';
import JournalEntryModal from '@/components/accounting/JournalEntryModal';
import ReversalModal from '@/components/accounting/ReversalModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PendingPostingsTab from '@/components/accounting/PendingPostingsTab';
import AccountingRulesTab from '@/components/accounting/AccountingRulesTab';
import type { JournalEntry, JournalEntryStatus, JournalEntryType, CsvImportPreview } from '@/types/journal-entries';
import './JournalEntriesPage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function formatAmount(lines: JournalEntry['lines']): string {
  const debitTotal = lines
    .filter((l) => l.side === 'DEBIT')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);
  return debitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: JournalEntryStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<JournalEntryStatus, { label: string; icon: React.ReactNode; className: string }> = {
    DRAFT: {
      label: 'RASCUNHO',
      icon: <FileText size={16} aria-hidden="true" />,
      className: 'je-page__badge je-page__badge--draft',
    },
    POSTED: {
      label: 'POSTADO',
      icon: <CheckCircle size={16} aria-hidden="true" />,
      className: 'je-page__badge je-page__badge--posted',
    },
    REVERSED: {
      label: 'ESTORNADO',
      icon: <RotateCcw size={16} aria-hidden="true" />,
      className: 'je-page__badge je-page__badge--reversed',
    },
  };

  const { label, icon, className } = config[status];
  return (
    <span className={className} aria-label={`Status: ${label}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Entry Type Labels ────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<JournalEntryType, string> = {
  MANUAL: 'Manual',
  OPENING_BALANCE: 'Saldo de Abertura',
  REVERSAL: 'Estorno',
  TEMPLATE_INSTANCE: 'Modelo',
  AUTOMATIC: 'Automático',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, j) => (
            <td key={j} className="je-page__td">
              <div className="je-page__skeleton-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Row Action Menu ──────────────────────────────────────────────────────────

interface RowMenuProps {
  entry: JournalEntry;
  onView: () => void;
  onEdit: () => void;
  onReverse: () => void;
  onDelete: () => void;
}

function RowMenu({ entry, onView, onEdit, onReverse, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="je-page__row-menu" ref={menuRef}>
      <button
        type="button"
        className="je-page__menu-trigger"
        aria-label="Ações"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="je-page__menu-dropdown" role="menu">
          <li role="none">
            <button type="button" role="menuitem" className="je-page__menu-item" onClick={() => { setOpen(false); onView(); }}>
              <Eye size={14} aria-hidden="true" /> Visualizar
            </button>
          </li>
          {entry.status === 'DRAFT' && (
            <li role="none">
              <button type="button" role="menuitem" className="je-page__menu-item" onClick={() => { setOpen(false); onEdit(); }}>
                <Pencil size={14} aria-hidden="true" /> Editar
              </button>
            </li>
          )}
          {entry.status === 'POSTED' && (
            <li role="none">
              <button type="button" role="menuitem" className="je-page__menu-item je-page__menu-item--danger" onClick={() => { setOpen(false); onReverse(); }}>
                <Undo2 size={14} aria-hidden="true" /> Estornar
              </button>
            </li>
          )}
          {entry.status === 'DRAFT' && (
            <li role="none">
              <button type="button" role="menuitem" className="je-page__menu-item je-page__menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>
                <Trash2 size={14} aria-hidden="true" /> Excluir
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── CSV Import Preview Modal ─────────────────────────────────────────────────

interface CsvPreviewModalProps {
  preview: CsvImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CsvPreviewModal({ preview, onConfirm, onCancel, isLoading }: CsvPreviewModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="je-page__csv-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="je-page__csv-modal">
        <h2 id="csv-preview-title" className="je-page__csv-title">
          Prévia da importação CSV
        </h2>
        <p className="je-page__csv-summary">
          {preview.totalEntries} lançamento{preview.totalEntries !== 1 ? 's' : ''} encontrado{preview.totalEntries !== 1 ? 's' : ''}
          {preview.totalErrors > 0 && (
            <span className="je-page__csv-errors">
              {' '}— {preview.totalErrors} erro{preview.totalErrors !== 1 ? 's' : ''} encontrado{preview.totalErrors !== 1 ? 's' : ''}
            </span>
          )}
        </p>

        {preview.errors.length > 0 && (
          <div className="je-page__csv-error-list" role="alert">
            <h3 className="je-page__csv-error-heading">
              <AlertTriangle size={16} aria-hidden="true" /> Erros encontrados
            </h3>
            <ul>
              {preview.errors.map((err, i) => (
                <li key={i} className="je-page__csv-error-item">
                  Linha {err.rowNumber}, campo "{err.field}": {err.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.totalEntries > 0 && (
          <p className="je-page__csv-notice">
            Os {preview.totalEntries} lançamento{preview.totalEntries !== 1 ? 's' : ''} serão criados como rascunho. Revise antes de lançar.
          </p>
        )}

        <div className="je-page__csv-actions">
          <button type="button" className="je-page__btn je-page__btn--secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </button>
          {preview.totalEntries > 0 && (
            <button
              type="button"
              className="je-page__btn je-page__btn--primary"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Importando...' : `Criar ${preview.totalEntries} rascunho${preview.totalEntries !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';

  // ─── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'lancamentos' | 'pendencias' | 'regras'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('tab') as 'lancamentos' | 'pendencias' | 'regras') || 'lancamentos';
  });

  const { counts: pendingCounts } = usePendingCounts();

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  const [filterPeriodId, setFilterPeriodId] = useState('');
  const [filterStatus, setFilterStatus] = useState<JournalEntryStatus | ''>('');
  const [filterType, setFilterType] = useState<JournalEntryType | ''>('');

  const filters = {
    periodId: filterPeriodId || undefined,
    status: (filterStatus || undefined) as JournalEntryStatus | undefined,
    entryType: (filterType || undefined) as JournalEntryType | undefined,
  };

  const { entries, isLoading, error, refetch } = useJournalEntries(filters);
  const { data: fiscalYears } = useFiscalYears();
  const { createDraft, deleteDraft, importCsv } = useJournalEntryActions();

  const [toast, setToast] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [reversingEntry, setReversingEntry] = useState<JournalEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<JournalEntry | null>(null);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);

  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // Flatten all periods from all fiscal years for the filter dropdown
  const allPeriods = fiscalYears.flatMap((fy) => fy.periods);

  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvLoading(true);
    try {
      const preview = await importCsv(file);
      setCsvPreview(preview);
    } catch {
      showToast('Não foi possível processar o arquivo CSV. Verifique o formato.');
    } finally {
      setCsvLoading(false);
      // Reset input so same file can be re-selected
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleCsvImportConfirm = async () => {
    if (!csvPreview || csvPreview.entries.length === 0) return;
    setCsvLoading(true);
    try {
      let successCount = 0;
      for (const entryInput of csvPreview.entries) {
        try {
          await createDraft(entryInput);
          successCount++;
        } catch {
          // Continue with remaining entries
        }
      }
      showToast(`${successCount} rascunho${successCount !== 1 ? 's' : ''} criado${successCount !== 1 ? 's' : ''} com sucesso`);
      setCsvPreview(null);
      setCsvFile(null);
      void refetch();
    } catch {
      showToast('Não foi possível importar os lançamentos.');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingEntry) return;
    try {
      await deleteDraft(deletingEntry.id);
      showToast('Rascunho excluído');
      setDeletingEntry(null);
      void refetch();
    } catch {
      showToast('Não foi possível excluir o rascunho.');
      setDeletingEntry(null);
    }
  }, [deletingEntry, deleteDraft, refetch]);

  return (
    <main className="je-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="je-page__breadcrumb" aria-label="Caminho da página">
        <span className="je-page__bc-item">Início</span>
        <span className="je-page__bc-sep" aria-hidden="true">/</span>
        <span className="je-page__bc-item">Contabilidade</span>
        <span className="je-page__bc-sep" aria-hidden="true">/</span>
        <span className="je-page__bc-item je-page__bc-item--current" aria-current="page">
          Lançamentos Contábeis
        </span>
      </nav>

      {/* Header */}
      <header className="je-page__header">
        <div className="je-page__header-left">
          <BookOpen size={24} aria-hidden="true" className="je-page__header-icon" />
          <h1 className="je-page__title">Lançamentos Contábeis</h1>
        </div>
        <div className="je-page__header-actions">
          {/* Hidden CSV file input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="je-page__csv-input-hidden"
            aria-label="Selecionar arquivo CSV para importação"
            onChange={(e) => { void handleCsvSelect(e); }}
          />
          <button
            type="button"
            className="je-page__btn je-page__btn--secondary"
            onClick={() => csvInputRef.current?.click()}
            disabled={csvLoading}
          >
            <Upload size={16} aria-hidden="true" />
            Importar CSV
          </button>
          <button
            type="button"
            className="je-page__btn je-page__btn--secondary"
            onClick={() => setShowOpeningBalance(true)}
          >
            Saldo de Abertura
          </button>
          <button
            type="button"
            className="je-page__btn je-page__btn--primary"
            onClick={() => { setEditingEntry(null); setShowCreateModal(true); }}
          >
            <Plus size={16} aria-hidden="true" />
            Novo Lançamento
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav role="tablist" className="journal-tabs" aria-label="Abas de lançamentos">
        <button
          role="tab"
          id="tab-lancamentos"
          aria-selected={activeTab === 'lancamentos'}
          aria-controls="panel-lancamentos"
          className={`journal-tab${activeTab === 'lancamentos' ? ' active' : ''}`}
          onClick={() => setActiveTab('lancamentos')}
        >
          Lançamentos
        </button>
        <button
          role="tab"
          id="tab-pendencias"
          aria-selected={activeTab === 'pendencias'}
          aria-controls="panel-pendencias"
          className={`journal-tab${activeTab === 'pendencias' ? ' active' : ''}`}
          onClick={() => setActiveTab('pendencias')}
        >
          Pendências
          {pendingCounts.error > 0 && (
            <span className="tab-badge tab-badge--error" aria-label={`${pendingCounts.error} erros`}>
              {pendingCounts.error}
            </span>
          )}
          {pendingCounts.pending > 0 && (
            <span className="tab-badge tab-badge--warning" aria-label={`${pendingCounts.pending} pendentes`}>
              {pendingCounts.pending}
            </span>
          )}
        </button>
        <button
          role="tab"
          id="tab-regras"
          aria-selected={activeTab === 'regras'}
          aria-controls="panel-regras"
          className={`journal-tab${activeTab === 'regras' ? ' active' : ''}`}
          onClick={() => setActiveTab('regras')}
        >
          Regras
        </button>
      </nav>

      {/* Pendências tab panel */}
      {activeTab === 'pendencias' && (
        <div role="tabpanel" id="panel-pendencias" aria-labelledby="tab-pendencias" tabIndex={0}>
          <PendingPostingsTab
            onNavigateToEntry={(_id) => {
              setActiveTab('lancamentos');
            }}
          />
        </div>
      )}

      {/* Regras tab panel */}
      {activeTab === 'regras' && (
        <div role="tabpanel" id="panel-regras" aria-labelledby="tab-regras" tabIndex={0}>
          <AccountingRulesTab />
        </div>
      )}

      {/* Lançamentos tab panel — kept mounted to preserve filter state */}
      <div
        role="tabpanel"
        id="panel-lancamentos"
        aria-labelledby="tab-lancamentos"
        tabIndex={0}
        hidden={activeTab !== 'lancamentos'}
      >

      {/* Error banner */}
      {error && (
        <div className="je-page__error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="je-page__filters">
        <div className="je-page__filter-group">
          <label htmlFor="je-filter-period" className="je-page__filter-label">Período</label>
          <select
            id="je-filter-period"
            className="je-page__filter-select"
            value={filterPeriodId}
            onChange={(e) => setFilterPeriodId(e.target.value)}
          >
            <option value="">Todos os períodos</option>
            {allPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.month).padStart(2, '0')}/{p.year}
                {p.status !== 'OPEN' ? ` (${p.status === 'CLOSED' ? 'fechado' : 'bloqueado'})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="je-page__filter-group">
          <label htmlFor="je-filter-status" className="je-page__filter-label">Status</label>
          <select
            id="je-filter-status"
            className="je-page__filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as JournalEntryStatus | '')}
          >
            <option value="">TODOS</option>
            <option value="DRAFT">RASCUNHO</option>
            <option value="POSTED">POSTADO</option>
            <option value="REVERSED">ESTORNADO</option>
          </select>
        </div>

        <div className="je-page__filter-group">
          <label htmlFor="je-filter-type" className="je-page__filter-label">Tipo</label>
          <select
            id="je-filter-type"
            className="je-page__filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as JournalEntryType | '')}
          >
            <option value="">Todos os tipos</option>
            <option value="MANUAL">Manual</option>
            <option value="OPENING_BALANCE">Saldo de Abertura</option>
            <option value="REVERSAL">Estorno</option>
            <option value="TEMPLATE_INSTANCE">Modelo</option>
            <option value="AUTOMATIC">Automático</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="je-page__table-wrapper">
        <table className="je-page__table">
          <caption className="sr-only">Lista de lançamentos contábeis</caption>
          <thead>
            <tr>
              <th scope="col" className="je-page__th">NÚMERO</th>
              <th scope="col" className="je-page__th">DATA</th>
              <th scope="col" className="je-page__th je-page__th--wide">HISTÓRICO</th>
              <th scope="col" className="je-page__th je-page__th--hidden-mobile">TIPO</th>
              <th scope="col" className="je-page__th je-page__th--right je-page__th--hidden-mobile">VALOR TOTAL</th>
              <th scope="col" className="je-page__th">STATUS</th>
              <th scope="col" className="je-page__th je-page__th--actions">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton />}

            {!isLoading && entries.length === 0 && !error && (
              <tr>
                <td colSpan={7}>
                  <div className="je-page__empty">
                    <BookOpen size={48} aria-hidden="true" className="je-page__empty-icon" />
                    <h2 className="je-page__empty-title">Nenhum lançamento ainda</h2>
                    <p className="je-page__empty-desc">
                      Crie o primeiro lançamento manual ou configure o saldo de abertura para iniciar a contabilidade.
                    </p>
                    <button
                      type="button"
                      className="je-page__btn je-page__btn--primary"
                      onClick={() => { setEditingEntry(null); setShowCreateModal(true); }}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Novo Lançamento
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && entries.map((entry) => (
              <tr key={entry.id} className="je-page__row">
                <td className="je-page__td je-page__td--mono">
                  #{entry.entryNumber}
                </td>
                <td className="je-page__td je-page__td--mono">
                  {formatDate(entry.entryDate)}
                </td>
                <td className="je-page__td je-page__td--wide">
                  <span className="je-page__description">{entry.description}</span>
                </td>
                <td className="je-page__td je-page__td--hidden-mobile">
                  {entry.entryType === 'AUTOMATIC' ? (
                    <span className="je-page__badge je-page__badge--automatic" aria-label="Tipo: Automático">
                      <Settings size={14} aria-hidden="true" />
                      AUTOMÁTICO
                    </span>
                  ) : (
                    ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType
                  )}
                </td>
                <td className="je-page__td je-page__td--mono je-page__td--right je-page__td--hidden-mobile">
                  {formatAmount(entry.lines)}
                </td>
                <td className="je-page__td">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="je-page__td je-page__td--actions">
                  <RowMenu
                    entry={entry}
                    onView={() => setViewingEntry(entry)}
                    onEdit={() => { setEditingEntry(entry); setShowCreateModal(true); }}
                    onReverse={() => setReversingEntry(entry)}
                    onDelete={() => setDeletingEntry(entry)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && entries.length > 0 && (
        <ul className="je-page__mobile-list" role="list" aria-label="Lançamentos contábeis">
          {entries.map((entry) => (
            <li key={entry.id} className="je-page__mobile-card">
              <div className="je-page__mobile-card-row">
                <span className="je-page__mobile-number je-page__mono">#{entry.entryNumber}</span>
                <StatusBadge status={entry.status} />
              </div>
              <div className="je-page__mobile-desc">{entry.description}</div>
              <div className="je-page__mobile-meta">
                <span className="je-page__mono">{formatDate(entry.entryDate)}</span>
                <span className="je-page__mono">{formatAmount(entry.lines)}</span>
              </div>
              <div className="je-page__mobile-actions">
                <button type="button" className="je-page__btn je-page__btn--sm je-page__btn--secondary" onClick={() => setViewingEntry(entry)}>
                  <Eye size={14} aria-hidden="true" /> Ver
                </button>
                {entry.status === 'DRAFT' && (
                  <button type="button" className="je-page__btn je-page__btn--sm je-page__btn--secondary" onClick={() => { setEditingEntry(entry); setShowCreateModal(true); }}>
                    <Pencil size={14} aria-hidden="true" /> Editar
                  </button>
                )}
                {entry.status === 'POSTED' && (
                  <button type="button" className="je-page__btn je-page__btn--sm je-page__btn--danger" onClick={() => setReversingEntry(entry)}>
                    <Undo2 size={14} aria-hidden="true" /> Estornar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* CSV Import Preview */}
      {csvPreview && (
        <CsvPreviewModal
          preview={csvPreview}
          onConfirm={() => { void handleCsvImportConfirm(); }}
          onCancel={() => { setCsvPreview(null); setCsvFile(null); }}
          isLoading={csvLoading}
        />
      )}

      {/* Journal Entry Create/Edit Modal */}
      {(showCreateModal || editingEntry !== null) && (
        <JournalEntryModal
          isOpen={showCreateModal || editingEntry !== null}
          entry={editingEntry ?? viewingEntry ?? undefined}
          readOnly={viewingEntry !== null && editingEntry === null && !showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEntry(null);
            setViewingEntry(null);
          }}
          onSuccess={(msg) => {
            showToast(msg);
            void refetch();
            setShowCreateModal(false);
            setEditingEntry(null);
          }}
          orgId={orgId}
        />
      )}

      {/* View-only modal (reuse JournalEntryModal in readOnly) */}
      {viewingEntry !== null && !showCreateModal && editingEntry === null && (
        <JournalEntryModal
          isOpen={true}
          entry={viewingEntry}
          readOnly={true}
          onClose={() => setViewingEntry(null)}
          onSuccess={() => setViewingEntry(null)}
          orgId={orgId}
        />
      )}

      {/* Opening Balance Wizard — lazy import */}
      {showOpeningBalance && (
        <OpeningBalanceWizardLazy
          isOpen={showOpeningBalance}
          onClose={() => setShowOpeningBalance(false)}
          onSuccess={(msg) => {
            showToast(msg);
            void refetch();
            setShowOpeningBalance(false);
          }}
          orgId={orgId}
        />
      )}

      {/* Reversal Modal */}
      {reversingEntry && (
        <ReversalModal
          isOpen={true}
          entry={reversingEntry}
          onClose={() => setReversingEntry(null)}
          onSuccess={(msg) => {
            showToast(msg);
            void refetch();
            setReversingEntry(null);
          }}
          orgId={orgId}
        />
      )}

      {/* Delete draft confirm */}
      <ConfirmModal
        isOpen={!!deletingEntry}
        title="Excluir rascunho"
        message="Excluir este rascunho? Os dados serão perdidos."
        confirmLabel="Excluir"
        variant="warning"
        onConfirm={() => { void handleDeleteConfirm(); }}
        onCancel={() => setDeletingEntry(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="je-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      </div>{/* end panel-lancamentos */}
    </main>
  );
}

// ─── Lazy Opening Balance Wizard ──────────────────────────────────────────────
// Imported dynamically to allow tree-shaking; defined here to avoid circular dep

import { lazy, Suspense } from 'react';

const OpeningBalanceWizardComponent = lazy(
  () => import('@/components/accounting/OpeningBalanceWizard'),
);

interface OpeningBalanceLazyProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  orgId: string;
}

function OpeningBalanceWizardLazy({ isOpen, onClose, onSuccess, orgId }: OpeningBalanceLazyProps) {
  return (
    <Suspense fallback={null}>
      <OpeningBalanceWizardComponent isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} orgId={orgId} />
    </Suspense>
  );
}
