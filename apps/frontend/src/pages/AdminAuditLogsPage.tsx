import { useState, Fragment } from 'react';
import {
  ScrollText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminAuditLogs';
import './AdminAuditLogsPage.css';

const ACTION_LABELS: Record<string, string> = {
  CREATE_ORGANIZATION: 'Criar organização',
  UPDATE_ORGANIZATION_STATUS: 'Alterar status',
  UPDATE_ORGANIZATION_PLAN: 'Alterar plano',
  CREATE_ORG_ADMIN: 'Criar admin',
  RESET_USER_PASSWORD: 'Resetar senha',
  UNLOCK_USER: 'Desbloquear usuário',
  UPDATE_SESSION_POLICY: 'Política de sessão',
  UPDATE_SOCIAL_LOGIN_POLICY: 'Login social',
};

const AUDIT_ACTIONS = Object.keys(ACTION_LABELS);

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orgIdFilter, setOrgIdFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const { logs, meta, isLoading, error } = useAdminAuditLogs({
    page,
    action: actionFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    organizationId: orgIdFilter || undefined,
  });

  const toggleCardMetadata = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Loading
  if (isLoading && logs.length === 0) {
    return (
      <section className="admin-logs" aria-live="polite">
        <div
          className="admin-logs__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="admin-logs__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="admin-logs__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="admin-logs">
      <header className="admin-logs__header">
        <h1 className="admin-logs__title">Auditoria</h1>
        <p className="admin-logs__subtitle">Registros de ações realizadas no sistema</p>
      </header>

      {error && (
        <div className="admin-logs__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="admin-logs__filters">
        <div className="admin-logs__filter-group">
          <label htmlFor="log-action-filter" className="admin-logs__filter-label">
            Ação
          </label>
          <select
            id="log-action-filter"
            className="admin-logs__filter-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as ações</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-logs__filter-group">
          <label htmlFor="log-date-from" className="admin-logs__filter-label">
            De
          </label>
          <input
            id="log-date-from"
            type="date"
            className="admin-logs__filter-input"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="admin-logs__filter-group">
          <label htmlFor="log-date-to" className="admin-logs__filter-label">
            Até
          </label>
          <input
            id="log-date-to"
            type="date"
            className="admin-logs__filter-input"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="admin-logs__filter-group">
          <label htmlFor="log-org-filter" className="admin-logs__filter-label">
            Organização (ID)
          </label>
          <input
            id="log-org-filter"
            type="text"
            className="admin-logs__filter-input"
            placeholder="ID da organização"
            value={orgIdFilter}
            onChange={(e) => {
              setOrgIdFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Content */}
      {logs.length === 0 && !isLoading ? (
        <div className="admin-logs__empty">
          <ScrollText size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="admin-logs__empty-title">Nenhum registro de auditoria encontrado</h2>
          <p className="admin-logs__empty-desc">
            {actionFilter || dateFrom || dateTo || orgIdFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Os registros de ações aparecerão aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-logs__table-wrapper">
            <table className="admin-logs__table">
              <thead>
                <tr>
                  <th scope="col">Data/Hora</th>
                  <th scope="col">Ator</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Alvo</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className={`admin-logs__table-row ${expandedId === log.id ? 'admin-logs__table-row--expanded' : ''}`}
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      tabIndex={0}
                      role="button"
                      aria-expanded={expandedId === log.id}
                      aria-label={`${ACTION_LABELS[log.action] ?? log.action} — ${log.actorEmail}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(expandedId === log.id ? null : log.id);
                        }
                      }}
                    >
                      <td>
                        <span className="admin-logs__datetime">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span className="admin-logs__email">{log.actorEmail}</span>
                      </td>
                      <td>
                        <span className="admin-logs__action-badge">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td>
                        {log.targetType && (
                          <span>
                            {log.targetType}
                            {log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="admin-logs__ip">{log.ipAddress ?? '—'}</span>
                      </td>
                    </tr>
                    {expandedId === log.id && log.metadata && (
                      <tr className="admin-logs__metadata-row">
                        <td colSpan={5}>
                          <pre className="admin-logs__metadata">{formatMetadata(log.metadata)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-logs__cards">
            {logs.map((log) => (
              <div key={log.id} className="admin-logs__card">
                <div className="admin-logs__card-header">
                  <span className="admin-logs__action-badge">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="admin-logs__datetime">{formatDateTime(log.createdAt)}</span>
                </div>
                <div className="admin-logs__card-row">
                  <span className="admin-logs__card-label">Ator</span>
                  <span className="admin-logs__card-value">{log.actorEmail}</span>
                </div>
                <div className="admin-logs__card-row">
                  <span className="admin-logs__card-label">Alvo</span>
                  <span className="admin-logs__card-value">
                    {log.targetType
                      ? `${log.targetType}${log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}`
                      : '—'}
                  </span>
                </div>
                <div className="admin-logs__card-row">
                  <span className="admin-logs__card-label">IP</span>
                  <span className="admin-logs__card-value">{log.ipAddress ?? '—'}</span>
                </div>
                {log.metadata && (
                  <div className="admin-logs__card-metadata">
                    <button
                      type="button"
                      className="admin-logs__card-toggle"
                      onClick={() => toggleCardMetadata(log.id)}
                      aria-expanded={expandedCardIds.has(log.id)}
                    >
                      {expandedCardIds.has(log.id) ? (
                        <>
                          <ChevronUp aria-hidden="true" size={16} />
                          Ocultar detalhes
                        </>
                      ) : (
                        <>
                          <ChevronDown aria-hidden="true" size={16} />
                          Ver detalhes
                        </>
                      )}
                    </button>
                    {expandedCardIds.has(log.id) && (
                      <pre className="admin-logs__metadata">{formatMetadata(log.metadata)}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="admin-logs__pagination" aria-label="Paginação de logs">
              <button
                type="button"
                className="admin-logs__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="admin-logs__pagination-btn"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default AdminAuditLogsPage;
