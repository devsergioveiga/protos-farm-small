import { useState, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { usePendingPostings, usePendingCounts, usePendingActions } from '@/hooks/usePendingPostings';
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ROUTES,
  PENDING_STATUS_LABELS,
} from '@/types/auto-posting';
import type { PendingPostingStatus, AutoPostingSourceType, PendingJournalPosting } from '@/types/auto-posting';
import './PendingPostingsTab.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function PendingStatusBadge({ status }: { status: PendingPostingStatus }) {
  const config: Record<
    PendingPostingStatus,
    { icon: React.ReactNode; className: string }
  > = {
    COMPLETED: {
      icon: <CheckCircle size={14} aria-hidden="true" />,
      className: 'ppt__badge ppt__badge--completed',
    },
    PENDING: {
      icon: <Clock size={14} aria-hidden="true" />,
      className: 'ppt__badge ppt__badge--pending',
    },
    ERROR: {
      icon: <XCircle size={14} aria-hidden="true" />,
      className: 'ppt__badge ppt__badge--error',
    },
    PROCESSING: {
      icon: <RefreshCw size={14} aria-hidden="true" />,
      className: 'ppt__badge ppt__badge--processing',
    },
  };

  const { icon, className } = config[status];
  const label = PENDING_STATUS_LABELS[status];

  return (
    <span className={className} aria-label={`Status: ${label}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} className="ppt__td">
              <div className="ppt__skeleton-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Error Row Accordion ──────────────────────────────────────────────────────

interface ErrorRowProps {
  posting: PendingJournalPosting;
  onRetry: (id: string) => Promise<void>;
}

function ErrorRow({ posting, onRetry }: ErrorRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await onRetry(posting.id);
      setRetried(true);
    } finally {
      setRetrying(false);
    }
  }, [onRetry, posting.id]);

  const originUrl = `${SOURCE_TYPE_ROUTES[posting.sourceType]}?id=${posting.sourceId}`;

  if (retried) {
    return (
      <tr className="ppt__row ppt__row--completed">
        <td className="ppt__td">
          <PendingStatusBadge status="COMPLETED" />
        </td>
        <td className="ppt__td">{SOURCE_TYPE_LABELS[posting.sourceType]}</td>
        <td className="ppt__td">
          <a href={originUrl} className="ppt__origin-link" aria-label={`Ver ${SOURCE_TYPE_LABELS[posting.sourceType]} de origem`}>
            <ExternalLink size={12} aria-hidden="true" />
            Ver origem
          </a>
        </td>
        <td className="ppt__td ppt__td--mono">{formatDate(posting.createdAt)}</td>
        <td className="ppt__td" />
      </tr>
    );
  }

  return (
    <>
      <tr
        className="ppt__row ppt__row--error ppt__row--clickable"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <td className="ppt__td">
          <PendingStatusBadge status="ERROR" />
        </td>
        <td className="ppt__td">{SOURCE_TYPE_LABELS[posting.sourceType]}</td>
        <td className="ppt__td">
          <a
            href={originUrl}
            className="ppt__origin-link"
            aria-label={`Ver ${SOURCE_TYPE_LABELS[posting.sourceType]} de origem`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} aria-hidden="true" />
            Ver origem
          </a>
        </td>
        <td className="ppt__td ppt__td--mono">{formatDate(posting.createdAt)}</td>
        <td className="ppt__td ppt__td--actions">
          <span className={`ppt__chevron${expanded ? ' ppt__chevron--expanded' : ''}`}>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="ppt__row ppt__accordion-row">
          <td colSpan={5} className="ppt__accordion-cell">
            <div className="ppt__accordion-content">
              <p className="ppt__error-message" role="alert" aria-live="polite">
                {posting.errorMessage ?? 'Erro desconhecido'}
              </p>
              <button
                type="button"
                className="ppt__btn ppt__btn--secondary"
                onClick={(e) => { e.stopPropagation(); void handleRetry(); }}
                disabled={retrying}
                aria-busy={retrying}
              >
                <RefreshCw size={14} aria-hidden="true" className={retrying ? 'ppt__spin' : ''} />
                {retrying ? 'Tentando...' : 'Tentar novamente'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PendingPostingsTabProps {
  onNavigateToEntry: (journalEntryId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PendingPostingsTab({ onNavigateToEntry }: PendingPostingsTabProps) {
  const [filterStatus, setFilterStatus] = useState<PendingPostingStatus | ''>('');
  const [filterSourceType, setFilterSourceType] = useState<AutoPostingSourceType | ''>('');
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { postings, isLoading, error, refetch } = usePendingPostings({
    status: filterStatus || undefined,
    sourceType: filterSourceType || undefined,
  });
  const { counts, refetch: refetchCounts } = usePendingCounts();
  const { retryOne, retryBatch } = usePendingActions();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleRetryOne = useCallback(
    async (id: string) => {
      try {
        await retryOne(id);
        void refetch();
        void refetchCounts();
      } catch {
        showToast('Não foi possível reprocessar. Verifique a mensagem de erro.');
      }
    },
    [retryOne, refetch, refetchCounts],
  );

  const handleRetryBatch = useCallback(async () => {
    setBatchRetrying(true);
    showToast('Reprocessando pendências...');
    try {
      const result = await retryBatch({
        status: filterStatus || undefined,
        sourceType: filterSourceType || undefined,
      });
      if (result.failed > 0) {
        showToast(`${result.succeeded} reprocessado(s) com sucesso, ${result.failed} com falha.`);
      } else {
        showToast(`${result.succeeded} pendência(s) reprocessada(s) com sucesso.`);
      }
      void refetch();
      void refetchCounts();
    } catch {
      showToast('Não foi possível reprocessar em lote. Tente novamente.');
    } finally {
      setBatchRetrying(false);
    }
  }, [retryBatch, filterStatus, filterSourceType, refetch, refetchCounts]);

  const hasErrorOrPending = postings.some((p) => p.status === 'ERROR' || p.status === 'PENDING');

  return (
    <section className="ppt" aria-label="Pendências de lançamento automático">

      {/* Filter bar */}
      <div className="ppt__filters">
        <div className="ppt__filter-group">
          <label htmlFor="ppt-filter-status" className="ppt__filter-label">Status</label>
          <select
            id="ppt-filter-status"
            className="ppt__filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PendingPostingStatus | '')}
          >
            <option value="">Todos</option>
            <option value="PENDING">PENDENTE</option>
            <option value="PROCESSING">PROCESSANDO</option>
            <option value="COMPLETED">CONCLUÍDO</option>
            <option value="ERROR">ERRO</option>
          </select>
        </div>

        <div className="ppt__filter-group">
          <label htmlFor="ppt-filter-type" className="ppt__filter-label">Tipo de operação</label>
          <select
            id="ppt-filter-type"
            className="ppt__filter-select"
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value as AutoPostingSourceType | '')}
          >
            <option value="">Todos</option>
            {(Object.entries(SOURCE_TYPE_LABELS) as [AutoPostingSourceType, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ),
            )}
          </select>
        </div>

        {hasErrorOrPending && (
          <button
            type="button"
            className="ppt__btn ppt__btn--primary"
            onClick={() => { void handleRetryBatch(); }}
            disabled={batchRetrying}
            aria-busy={batchRetrying}
          >
            <RefreshCw size={14} aria-hidden="true" className={batchRetrying ? 'ppt__spin' : ''} />
            {batchRetrying ? 'Reprocessando...' : 'Tentar novamente em lote'}
          </button>
        )}
      </div>

      {/* Summary chips */}
      {(counts.error > 0 || counts.pending > 0) && (
        <div className="ppt__chips" aria-live="polite">
          {counts.error > 0 && (
            <span className="ppt__chip ppt__chip--error">
              <XCircle size={14} aria-hidden="true" />
              {counts.error} com erro
            </span>
          )}
          {counts.pending > 0 && (
            <span className="ppt__chip ppt__chip--pending">
              <Clock size={14} aria-hidden="true" />
              {counts.pending} pendente{counts.pending !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="ppt__error-banner" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="ppt__table-wrapper">
        <table className="ppt__table">
          <caption className="sr-only">Lista de pendências de lançamento automático</caption>
          <thead>
            <tr>
              <th scope="col" className="ppt__th">STATUS</th>
              <th scope="col" className="ppt__th">TIPO DE OPERAÇÃO</th>
              <th scope="col" className="ppt__th">ORIGEM</th>
              <th scope="col" className="ppt__th">DATA</th>
              <th scope="col" className="ppt__th ppt__th--actions">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton />}

            {!isLoading && postings.length === 0 && !error && (
              <tr>
                <td colSpan={5}>
                  {counts.error === 0 && counts.pending === 0 ? (
                    <div className="ppt__empty">
                      <CheckCircle size={48} aria-hidden="true" className="ppt__empty-icon ppt__empty-icon--success" />
                      <h2 className="ppt__empty-title">Tudo em dia</h2>
                      <p className="ppt__empty-desc">
                        Nenhuma operação aguardando lançamento contábil.
                      </p>
                    </div>
                  ) : (
                    <div className="ppt__empty">
                      <AlertTriangle size={48} aria-hidden="true" className="ppt__empty-icon" />
                      <h2 className="ppt__empty-title">Nenhuma pendência encontrada</h2>
                      <p className="ppt__empty-desc">
                        Ajuste os filtros ou aguarde o processamento de novas operações.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {!isLoading &&
              postings.map((posting) => {
                if (posting.status === 'ERROR') {
                  return (
                    <ErrorRow
                      key={posting.id}
                      posting={posting}
                      onRetry={handleRetryOne}
                    />
                  );
                }

                const originUrl = `${SOURCE_TYPE_ROUTES[posting.sourceType]}?id=${posting.sourceId}`;
                return (
                  <tr key={posting.id} className="ppt__row">
                    <td className="ppt__td">
                      <PendingStatusBadge status={posting.status} />
                    </td>
                    <td className="ppt__td">{SOURCE_TYPE_LABELS[posting.sourceType]}</td>
                    <td className="ppt__td">
                      <a
                        href={originUrl}
                        className="ppt__origin-link"
                        aria-label={`Ver ${SOURCE_TYPE_LABELS[posting.sourceType]} de origem`}
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        Ver origem
                      </a>
                    </td>
                    <td className="ppt__td ppt__td--mono">{formatDate(posting.createdAt)}</td>
                    <td className="ppt__td ppt__td--actions">
                      {posting.status === 'COMPLETED' && posting.journalEntryId && (
                        <button
                          type="button"
                          className="ppt__btn ppt__btn--text"
                          onClick={() => onNavigateToEntry(posting.journalEntryId!)}
                        >
                          Ver lançamento
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && postings.length > 0 && (
        <ul className="ppt__mobile-list" role="list" aria-label="Pendências de lançamento">
          {postings.map((posting) => {
            const originUrl = `${SOURCE_TYPE_ROUTES[posting.sourceType]}?id=${posting.sourceId}`;
            return (
              <li key={posting.id} className="ppt__mobile-card">
                <div className="ppt__mobile-card-row">
                  <PendingStatusBadge status={posting.status} />
                  <span className="ppt__mobile-date ppt__td--mono">
                    {formatDate(posting.createdAt)}
                  </span>
                </div>
                <div className="ppt__mobile-type">{SOURCE_TYPE_LABELS[posting.sourceType]}</div>
                {posting.status === 'ERROR' && posting.errorMessage && (
                  <p className="ppt__mobile-error" role="alert">
                    {posting.errorMessage}
                  </p>
                )}
                <div className="ppt__mobile-actions">
                  <a
                    href={originUrl}
                    className="ppt__btn ppt__btn--sm ppt__btn--secondary"
                    aria-label={`Ver ${SOURCE_TYPE_LABELS[posting.sourceType]} de origem`}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Origem
                  </a>
                  {posting.status === 'COMPLETED' && posting.journalEntryId && (
                    <button
                      type="button"
                      className="ppt__btn ppt__btn--sm ppt__btn--secondary"
                      onClick={() => onNavigateToEntry(posting.journalEntryId!)}
                    >
                      Ver lançamento
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Toast */}
      {toast && (
        <div className="ppt__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </section>
  );
}
