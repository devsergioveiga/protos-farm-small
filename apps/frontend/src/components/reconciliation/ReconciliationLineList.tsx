import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Link2,
  MoreVertical,
  FileDown,
} from 'lucide-react';
import { useImportLines, useReconciliationActions } from '@/hooks/useReconciliation';
import type { StatementLineWithMatches, ConfidenceLevel } from '@/hooks/useReconciliation';
import ManualLinkModal from './ManualLinkModal';
import './ReconciliationLineList.css';

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="recon-list__row recon-list__row--skeleton" aria-hidden="true">
      <div className="recon-skeleton-cell" style={{ width: '10%' }} />
      <div className="recon-skeleton-cell" style={{ width: '30%' }} />
      <div className="recon-skeleton-cell" style={{ width: '20%' }} />
      <div className="recon-skeleton-cell" style={{ width: '30%' }} />
    </div>
  );
}

// ─── Confidence section ────────────────────────────────────────────

interface ConfidenceSectionProps {
  level: ConfidenceLevel;
  lines: StatementLineWithMatches[];
  importId: string;
  bankAccountId: string;
  expandedLines: Set<string>;
  ignoreConfirms: Set<string>;
  onAccept: (line: StatementLineWithMatches) => Promise<void>;
  onReject: (line: StatementLineWithMatches) => Promise<void>;
  onOpenManualLink: (line: StatementLineWithMatches) => void;
  onIgnore: (line: StatementLineWithMatches) => Promise<void>;
  onToggleExpand: (lineId: string) => void;
  onAskIgnoreConfirm: (lineId: string) => void;
  onCancelIgnore: (lineId: string) => void;
}

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  EXATO: 'EXATO',
  PROVAVEL: 'PROVÁVEL',
  SEM_MATCH: 'SEM MATCH',
};

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  EXATO: 'recon-list__section--exato',
  PROVAVEL: 'recon-list__section--provavel',
  SEM_MATCH: 'recon-list__section--sem-match',
};

function ConfidenceSection({
  level,
  lines,
  importId,
  bankAccountId,
  expandedLines,
  ignoreConfirms,
  onAccept,
  onReject,
  onOpenManualLink,
  onIgnore,
  onToggleExpand,
  onAskIgnoreConfirm,
  onCancelIgnore,
}: ConfidenceSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (lines.length === 0) return null;

  return (
    <section
      className={`recon-list__section ${CONFIDENCE_CLASS[level]}`}
      aria-label={`Seção de matches ${CONFIDENCE_LABELS[level]}: ${lines.length} linhas`}
    >
      <button
        type="button"
        className="recon-list__section-header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span
          className={`confidence-badge confidence-badge--${level.toLowerCase().replace('_', '-')}`}
        >
          {CONFIDENCE_LABELS[level]}
        </span>
        <span className="recon-list__section-count">{lines.length}</span>
        {collapsed ? (
          <ChevronDown size={16} aria-hidden="true" style={{ marginLeft: 'auto' }} />
        ) : (
          <ChevronUp size={16} aria-hidden="true" style={{ marginLeft: 'auto' }} />
        )}
      </button>

      {!collapsed && (
        <div className="recon-list__section-body">
          {lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              importId={importId}
              bankAccountId={bankAccountId}
              isExpanded={expandedLines.has(line.id)}
              isIgnoreConfirming={ignoreConfirms.has(line.id)}
              onAccept={onAccept}
              onReject={onReject}
              onOpenManualLink={onOpenManualLink}
              onIgnore={onIgnore}
              onToggleExpand={onToggleExpand}
              onAskIgnoreConfirm={onAskIgnoreConfirm}
              onCancelIgnore={onCancelIgnore}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Line row ─────────────────────────────────────────────────────

interface LineRowProps {
  line: StatementLineWithMatches;
  importId: string;
  bankAccountId: string;
  isExpanded: boolean;
  isIgnoreConfirming: boolean;
  onAccept: (line: StatementLineWithMatches) => Promise<void>;
  onReject: (line: StatementLineWithMatches) => Promise<void>;
  onOpenManualLink: (line: StatementLineWithMatches) => void;
  onIgnore: (line: StatementLineWithMatches) => Promise<void>;
  onToggleExpand: (lineId: string) => void;
  onAskIgnoreConfirm: (lineId: string) => void;
  onCancelIgnore: (lineId: string) => void;
}

function LineRow({
  line,
  isIgnoreConfirming,
  onAccept,
  onReject,
  onOpenManualLink,
  onIgnore,
  onToggleExpand,
  onAskIgnoreConfirm,
  onCancelIgnore,
}: LineRowProps) {
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | 'ignore' | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const isReconciled = line.status === 'RECONCILED';
  const isIgnored = line.status === 'IGNORED';

  const handleAccept = useCallback(async () => {
    if (!line.topMatch) return;
    setActionLoading('accept');
    try {
      await onAccept(line);
    } finally {
      setActionLoading(null);
    }
  }, [line, onAccept]);

  const handleReject = useCallback(async () => {
    if (!line.topMatch) return;
    setActionLoading('reject');
    try {
      await onReject(line);
    } finally {
      setActionLoading(null);
    }
  }, [line, onReject]);

  const handleIgnore = useCallback(async () => {
    setActionLoading('ignore');
    try {
      await onIgnore(line);
    } finally {
      setActionLoading(null);
    }
  }, [line, onIgnore]);

  const hasMultipleMatches = line.allMatches.length > 1;

  return (
    <div
      className={`recon-list__row ${isReconciled ? 'recon-list__row--reconciled' : ''} ${isIgnored ? 'recon-list__row--ignored' : ''}`}
    >
      {/* Left: line info */}
      <div className="recon-list__row-left">
        <div className="recon-list__row-main">
          <span
            className={`recon-modal__type-badge recon-modal__type-badge--${line.type.toLowerCase()}`}
          >
            {line.type === 'CREDIT' ? 'CRÉDITO' : 'DÉBITO'}
          </span>
          <span className="recon-list__date">{formatDate(line.date)}</span>
          <span className="recon-list__amount">{formatBRL(line.amount)}</span>
        </div>
        <div className="recon-list__memo">{line.memo}</div>

        {/* Status badge for reconciled/ignored */}
        {(isReconciled || isIgnored) && (
          <div style={{ marginTop: 4 }}>
            <span className={`status-badge status-badge--${line.status.toLowerCase()}`}>
              {isReconciled ? (
                <CheckCircle2 size={12} aria-hidden="true" />
              ) : (
                <XCircle size={12} aria-hidden="true" />
              )}
              {isReconciled ? 'CONCILIADO' : 'IGNORADO'}
            </span>
          </div>
        )}
      </div>

      {/* Middle: match suggestion */}
      {line.topMatch && !isReconciled && !isIgnored && (
        <div className="recon-list__match">
          <div className="recon-list__match-desc">{line.topMatch.description}</div>
          <div className="recon-list__match-amount">{formatBRL(line.topMatch.amount)}</div>
          {hasMultipleMatches && (
            <button
              type="button"
              className="recon-list__expand-btn"
              onClick={() => onToggleExpand(line.id)}
              aria-expanded={false}
            >
              + {line.allMatches.length - 1} mais
            </button>
          )}
        </div>
      )}

      {/* Right: actions */}
      {!isReconciled && !isIgnored && (
        <div className="recon-list__actions">
          {isIgnoreConfirming ? (
            <div className="recon-list__ignore-confirm" role="status">
              <span className="recon-list__ignore-confirm-text">
                Confirmar que deseja ignorar esta linha do extrato?
              </span>
              <button
                type="button"
                className="recon-list__btn-confirm-ignore"
                onClick={() => void handleIgnore()}
                disabled={actionLoading === 'ignore'}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="recon-list__btn-cancel-ignore"
                onClick={() => onCancelIgnore(line.id)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              {line.topMatch && (
                <>
                  <button
                    type="button"
                    className="recon-list__btn-accept"
                    onClick={() => void handleAccept()}
                    disabled={actionLoading === 'accept'}
                    aria-label={`Aceitar match para ${line.memo} em ${formatDate(line.date)}`}
                  >
                    <CheckCircle size={16} aria-hidden="true" />
                    {actionLoading === 'accept' ? 'Aceitando...' : 'Aceitar'}
                  </button>
                  <button
                    type="button"
                    className="recon-list__btn-reject"
                    onClick={() => void handleReject()}
                    disabled={actionLoading === 'reject'}
                    aria-label={`Recusar match para ${line.memo} em ${formatDate(line.date)}`}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    {actionLoading === 'reject' ? 'Recusando...' : 'Recusar'}
                  </button>
                </>
              )}
              <button
                type="button"
                className="recon-list__btn-link"
                onClick={() => onOpenManualLink(line)}
                aria-label={`Vincular manualmente ${line.memo} em ${formatDate(line.date)}`}
              >
                <Link2 size={16} aria-hidden="true" />
                Vincular
              </button>

              {/* Overflow for SEM_MATCH: Ignorar */}
              <div className="recon-list__overflow" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="recon-list__btn-overflow"
                  onClick={() => setOverflowOpen((v) => !v)}
                  aria-label="Mais opções"
                  aria-haspopup="menu"
                  aria-expanded={overflowOpen}
                >
                  <MoreVertical size={16} aria-hidden="true" />
                </button>
                {overflowOpen && (
                  <div className="recon-list__overflow-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="recon-list__overflow-item"
                      onClick={() => {
                        setOverflowOpen(false);
                        onAskIgnoreConfirm(line.id);
                      }}
                    >
                      <XCircle size={14} aria-hidden="true" />
                      Ignorar
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

interface ReconciliationLineListProps {
  importId: string;
  bankAccountId: string;
  onBack: () => void;
  onActionSuccess?: (message: string) => void;
}

export default function ReconciliationLineList({
  importId,
  bankAccountId,
  onActionSuccess,
}: ReconciliationLineListProps) {
  const { lines: rawLines, loading, error, refetch } = useImportLines(importId);
  const { acceptMatch, rejectMatch, ignoreLine } = useReconciliationActions();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [ignoreConfirms, setIgnoreConfirms] = useState<Set<string>>(new Set());
  const [manualLinkLine, setManualLinkLine] = useState<StatementLineWithMatches | null>(null);

  // Filter lines
  const filteredLines = useMemo(() => {
    let result = rawLines;
    if (statusFilter) {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.memo.toLowerCase().includes(q));
    }
    return result;
  }, [rawLines, statusFilter, search]);

  // Group by confidence
  const groupedLines = useMemo(() => {
    const exato: StatementLineWithMatches[] = [];
    const provavel: StatementLineWithMatches[] = [];
    const semMatch: StatementLineWithMatches[] = [];

    filteredLines.forEach((line) => {
      if (line.status === 'RECONCILED' || line.status === 'IGNORED') {
        // Show in the section matching their top match confidence
        const conf = line.topMatch?.confidence ?? 'SEM_MATCH';
        if (conf === 'EXATO') exato.push(line);
        else if (conf === 'PROVAVEL') provavel.push(line);
        else semMatch.push(line);
      } else {
        const conf = line.topMatch?.confidence ?? 'SEM_MATCH';
        if (conf === 'EXATO') exato.push(line);
        else if (conf === 'PROVAVEL') provavel.push(line);
        else semMatch.push(line);
      }
    });

    return { exato, provavel, semMatch };
  }, [filteredLines]);

  // Summary counts
  const totalReconciled = rawLines.filter((l) => l.status === 'RECONCILED').length;
  const totalPending = rawLines.filter((l) => l.status === 'PENDING').length;
  const totalSemMatch = rawLines.filter((l) => l.status === 'PENDING' && !l.topMatch).length;

  const allReconciled =
    rawLines.length > 0 &&
    rawLines.every((l) => l.status === 'RECONCILED' || l.status === 'IGNORED');

  const handleAccept = useCallback(
    async (line: StatementLineWithMatches) => {
      if (!line.topMatch) return;
      await acceptMatch(importId, line.id, line.topMatch.id);
      void refetch();
      onActionSuccess?.('Lançamento conciliado com sucesso.');
    },
    [importId, acceptMatch, refetch, onActionSuccess],
  );

  const handleReject = useCallback(
    async (line: StatementLineWithMatches) => {
      if (!line.topMatch) return;
      await rejectMatch(importId, line.id, line.topMatch.id);
      void refetch();
      onActionSuccess?.('Match recusado. Linha permanece pendente.');
    },
    [importId, rejectMatch, refetch, onActionSuccess],
  );

  const handleIgnore = useCallback(
    async (line: StatementLineWithMatches) => {
      await ignoreLine(importId, line.id);
      setIgnoreConfirms((prev) => {
        const next = new Set(prev);
        next.delete(line.id);
        return next;
      });
      void refetch();
      onActionSuccess?.('Linha ignorada.');
    },
    [importId, ignoreLine, refetch, onActionSuccess],
  );

  const handleManualLinkSuccess = useCallback(() => {
    setManualLinkLine(null);
    void refetch();
    onActionSuccess?.('Vínculo manual criado.');
  }, [refetch, onActionSuccess]);

  const toggleExpand = useCallback((lineId: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const handleAskIgnoreConfirm = useCallback((lineId: string) => {
    setIgnoreConfirms((prev) => new Set([...prev, lineId]));
  }, []);

  const handleCancelIgnore = useCallback((lineId: string) => {
    setIgnoreConfirms((prev) => {
      const next = new Set(prev);
      next.delete(lineId);
      return next;
    });
  }, []);

  const handleDownloadReport = useCallback(async () => {
    try {
      const token =
        localStorage.getItem('protos_access_token') ??
        localStorage.getItem('authToken') ??
        sessionStorage.getItem('authToken') ??
        '';
      const response = await fetch(`/api/org/reconciliation/imports/${importId}/report`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Erro ao gerar relatório');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-conciliacao-${importId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onActionSuccess?.('Não foi possível exportar. Tente novamente.');
    }
  }, [importId, onActionSuccess]);

  if (loading) {
    return (
      <div className="recon-list" aria-busy="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="recon-list">
        <div className="reconciliation-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      </div>
    );
  }

  if (allReconciled && rawLines.length > 0) {
    return (
      <div className="recon-list__all-done">
        <CheckCircle size={48} aria-hidden="true" className="recon-list__all-done-icon" />
        <h3 className="recon-list__all-done-title">Todos os lançamentos estão conciliados</h3>
        <p className="recon-list__all-done-desc">
          O extrato está em dia com os lançamentos do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="recon-list">
      {/* Filter bar */}
      <div className="recon-list__filters">
        <div className="recon-list__filter-group">
          <label htmlFor="recon-status-filter" className="recon-list__filter-label">
            Status
          </label>
          <select
            id="recon-status-filter"
            className="recon-list__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="RECONCILED">Conciliado</option>
            <option value="IGNORED">Ignorado</option>
          </select>
        </div>
        <div className="recon-list__filter-group" style={{ flex: 1 }}>
          <label htmlFor="recon-search" className="recon-list__filter-label">
            Busca
          </label>
          <input
            id="recon-search"
            type="search"
            className="recon-list__filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição..."
          />
        </div>
      </div>

      {/* Confidence sections */}
      <div className="recon-list__sections">
        {(['EXATO', 'PROVAVEL', 'SEM_MATCH'] as ConfidenceLevel[]).map((level) => {
          const sectionLines =
            level === 'EXATO'
              ? groupedLines.exato
              : level === 'PROVAVEL'
                ? groupedLines.provavel
                : groupedLines.semMatch;

          return (
            <ConfidenceSection
              key={level}
              level={level}
              lines={sectionLines}
              importId={importId}
              bankAccountId={bankAccountId}
              expandedLines={expandedLines}
              ignoreConfirms={ignoreConfirms}
              onAccept={handleAccept}
              onReject={handleReject}
              onOpenManualLink={setManualLinkLine}
              onIgnore={handleIgnore}
              onToggleExpand={toggleExpand}
              onAskIgnoreConfirm={handleAskIgnoreConfirm}
              onCancelIgnore={handleCancelIgnore}
            />
          );
        })}
      </div>

      {/* Bottom summary bar */}
      <div className="recon-list__summary-bar">
        <span className="recon-list__summary-text">
          {totalReconciled} conciliado{totalReconciled !== 1 ? 's' : ''}, {totalPending} pendente
          {totalPending !== 1 ? 's' : ''}, {totalSemMatch} sem match
        </span>
        <button
          type="button"
          className="recon-list__btn-report"
          onClick={() => void handleDownloadReport()}
        >
          <FileDown size={16} aria-hidden="true" />
          Gerar Relatório
        </button>
      </div>

      {/* Manual link modal */}
      {manualLinkLine && (
        <ManualLinkModal
          isOpen={!!manualLinkLine}
          onClose={() => setManualLinkLine(null)}
          statementLine={manualLinkLine}
          importId={importId}
          onSuccess={handleManualLinkSuccess}
        />
      )}
    </div>
  );
}
