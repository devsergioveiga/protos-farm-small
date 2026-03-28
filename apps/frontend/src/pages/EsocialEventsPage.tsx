import { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileCode,
  AlertTriangle,
  Eye,
  Play,
} from 'lucide-react';
import { useEsocialEvents, type EsocialXsdError } from '@/hooks/useEsocialEvents';
import type { EsocialEvent, EsocialGroup, EsocialStatus } from '@/types/esocial-event';
import {
  ESOCIAL_GROUP_LABELS,
  ESOCIAL_STATUS_LABELS,
  ESOCIAL_EVENT_TYPE_LABELS,
} from '@/types/esocial-event';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Status chip ────────────────────────────────────────────────────────────

const STATUS_CHIP_CLASSES: Record<EsocialStatus, string> = {
  PENDENTE: 'esocial-events-page__chip esocial-events-page__chip--gray',
  EXPORTADO: 'esocial-events-page__chip esocial-events-page__chip--blue',
  ACEITO: 'esocial-events-page__chip esocial-events-page__chip--green',
  REJEITADO: 'esocial-events-page__chip esocial-events-page__chip--red',
};

function StatusChip({ status }: { status: EsocialStatus }) {
  return <span className={STATUS_CHIP_CLASSES[status]}>{ESOCIAL_STATUS_LABELS[status]}</span>;
}

// ─── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="esocial-events-page__skeleton-cell">
          <div className="esocial-events-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ─── Generate Modal ─────────────────────────────────────────────────────────

const ALL_EVENT_TYPE_OPTIONS = Object.entries(ESOCIAL_EVENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label: `${value} — ${label}`,
}));

interface GenerateModalProps {
  onClose: () => void;
  onSubmit: (eventType: string, referenceMonth?: string) => Promise<void>;
}

function GenerateModal({ onClose, onSubmit }: GenerateModalProps) {
  const [eventType, setEventType] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventType) return;
    setSubmitting(true);
    await onSubmit(eventType, referenceMonth || undefined);
    setSubmitting(false);
    onClose();
  }

  return (
    <div
      className="esocial-events-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-modal-title"
    >
      <div className="esocial-events-page__modal">
        <header className="esocial-events-page__modal-header">
          <h2 id="generate-modal-title" className="esocial-events-page__modal-title">
            Gerar Eventos eSocial
          </h2>
          <button
            type="button"
            className="esocial-events-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </header>
        <form onSubmit={handleSubmit} className="esocial-events-page__modal-body">
          <div className="esocial-events-page__form-group">
            <label htmlFor="gen-event-type" className="esocial-events-page__label">
              Tipo de Evento <span aria-hidden="true">*</span>
            </label>
            <select
              id="gen-event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
              aria-required="true"
              className="esocial-events-page__select"
            >
              <option value="">Selecione o tipo</option>
              {ALL_EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="esocial-events-page__form-group">
            <label htmlFor="gen-ref-month" className="esocial-events-page__label">
              Competência (opcional)
            </label>
            <input
              id="gen-ref-month"
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="esocial-events-page__input"
            />
          </div>
          <footer className="esocial-events-page__modal-footer">
            <button
              type="button"
              className="esocial-events-page__btn esocial-events-page__btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !eventType}
              className="esocial-events-page__btn esocial-events-page__btn--primary"
            >
              {submitting ? 'Gerando...' : 'Gerar Eventos'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── Rejection Modal ─────────────────────────────────────────────────────────

interface RejectionModalProps {
  eventId: string;
  onClose: () => void;
  onSubmit: (eventId: string, reason: string) => Promise<void>;
}

function RejectionModal({ eventId, onClose, onSubmit }: RejectionModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectionReason.trim()) return;
    setSubmitting(true);
    await onSubmit(eventId, rejectionReason.trim());
    setSubmitting(false);
    onClose();
  }

  return (
    <div
      className="esocial-events-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rejection-modal-title"
    >
      <div className="esocial-events-page__modal">
        <header className="esocial-events-page__modal-header">
          <h2 id="rejection-modal-title" className="esocial-events-page__modal-title">
            Motivo da Rejeicao
          </h2>
          <button
            type="button"
            className="esocial-events-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </header>
        <form onSubmit={handleSubmit} className="esocial-events-page__modal-body">
          <div className="esocial-events-page__form-group">
            <label htmlFor="rejection-reason" className="esocial-events-page__label">
              Motivo da Rejeicao <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              aria-required="true"
              rows={4}
              placeholder="Descreva o motivo da rejeicao pelo eSocial..."
              className="esocial-events-page__textarea"
            />
          </div>
          <footer className="esocial-events-page__modal-footer">
            <button
              type="button"
              className="esocial-events-page__btn esocial-events-page__btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !rejectionReason.trim()}
              className="esocial-events-page__btn esocial-events-page__btn--warning"
            >
              {submitting ? 'Salvando...' : 'Confirmar Rejeicao'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── XSD Validation Errors Modal ─────────────────────────────────────────────

interface XsdErrorModalProps {
  errors: EsocialXsdError;
  onClose: () => void;
}

function XsdErrorModal({ errors, onClose }: XsdErrorModalProps) {
  return (
    <div
      className="esocial-events-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xsd-error-modal-title"
    >
      <div className="esocial-events-page__modal esocial-events-page__modal--wide">
        <header className="esocial-events-page__modal-header">
          <div className="esocial-events-page__modal-title-row">
            <AlertTriangle
              size={20}
              className="esocial-events-page__icon--warning"
              aria-hidden="true"
            />
            <h2 id="xsd-error-modal-title" className="esocial-events-page__modal-title">
              Erros de Validacao XSD
            </h2>
          </div>
          <button
            type="button"
            className="esocial-events-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </header>
        <div className="esocial-events-page__modal-body">
          <p className="esocial-events-page__modal-description">
            O XML do evento nao passou na validacao do schema XSD. Corrija os campos abaixo antes de
            tentar novamente.
          </p>
          <table className="esocial-events-page__table" aria-label="Erros de validacao XSD">
            <thead>
              <tr>
                <th scope="col">CAMPO</th>
                <th scope="col">MENSAGEM</th>
              </tr>
            </thead>
            <tbody>
              {errors.validationErrors.map((err, i) => (
                <tr key={i}>
                  <td className="esocial-events-page__mono">{err.field}</td>
                  <td>{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="esocial-events-page__modal-footer">
          <button
            type="button"
            className="esocial-events-page__btn esocial-events-page__btn--secondary"
            onClick={onClose}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Rejection Reason View Modal ─────────────────────────────────────────────

interface ViewRejectionModalProps {
  reason: string;
  onClose: () => void;
}

function ViewRejectionModal({ reason, onClose }: ViewRejectionModalProps) {
  return (
    <div
      className="esocial-events-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-rejection-modal-title"
    >
      <div className="esocial-events-page__modal">
        <header className="esocial-events-page__modal-header">
          <h2 id="view-rejection-modal-title" className="esocial-events-page__modal-title">
            Motivo da Rejeicao
          </h2>
          <button
            type="button"
            className="esocial-events-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </header>
        <div className="esocial-events-page__modal-body">
          <p className="esocial-events-page__rejection-reason">{reason}</p>
        </div>
        <footer className="esocial-events-page__modal-footer">
          <button
            type="button"
            className="esocial-events-page__btn esocial-events-page__btn--secondary"
            onClick={onClose}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Events Table ────────────────────────────────────────────────────────────

interface EventsTableProps {
  events: EsocialEvent[];
  loading: boolean;
  onDownload: (event: EsocialEvent) => void;
  onAccept: (event: EsocialEvent) => void;
  onReject: (event: EsocialEvent) => void;
  onReprocess: (event: EsocialEvent) => void;
  onViewRejection: (event: EsocialEvent) => void;
}

function EventsTable({
  events,
  loading,
  onDownload,
  onAccept,
  onReject,
  onReprocess,
  onViewRejection,
}: EventsTableProps) {
  return (
    <div className="esocial-events-page__table-wrapper">
      <table className="esocial-events-page__table" aria-label="Eventos eSocial">
        <thead>
          <tr>
            <th scope="col">EVENTO</th>
            <th scope="col">FONTE</th>
            <th scope="col">VERSAO</th>
            <th scope="col">STATUS</th>
            <th scope="col">CRIADO EM</th>
            <th scope="col">ACOES</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
            : events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className="esocial-events-page__event-type">{event.eventType}</span>
                    <span className="esocial-events-page__event-label">
                      {ESOCIAL_EVENT_TYPE_LABELS[event.eventType] ?? ''}
                    </span>
                  </td>
                  <td>
                    <span className="esocial-events-page__source-type">{event.sourceType}</span>
                    <span className="esocial-events-page__source-id">
                      {event.sourceId.slice(0, 8)}...
                    </span>
                  </td>
                  <td>v{event.version}</td>
                  <td>
                    <StatusChip status={event.status} />
                  </td>
                  <td>{formatDate(event.createdAt)}</td>
                  <td className="esocial-events-page__actions">
                    {event.status === 'PENDENTE' && (
                      <button
                        type="button"
                        className="esocial-events-page__action-btn"
                        onClick={() => onDownload(event)}
                        aria-label="Baixar XML"
                        title="Baixar XML"
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                    )}
                    {event.status === 'EXPORTADO' && (
                      <>
                        <button
                          type="button"
                          className="esocial-events-page__action-btn esocial-events-page__action-btn--success"
                          onClick={() => onAccept(event)}
                          aria-label="Marcar como aceito"
                          title="Marcar como aceito"
                        >
                          <CheckCircle size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="esocial-events-page__action-btn esocial-events-page__action-btn--danger"
                          onClick={() => onReject(event)}
                          aria-label="Marcar como rejeitado"
                          title="Marcar como rejeitado"
                        >
                          <XCircle size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {event.status === 'REJEITADO' && (
                      <>
                        <button
                          type="button"
                          className="esocial-events-page__action-btn"
                          onClick={() => onReprocess(event)}
                          aria-label="Reprocessar evento"
                          title="Reprocessar evento"
                        >
                          <RefreshCw size={16} aria-hidden="true" />
                        </button>
                        {event.rejectionReason && (
                          <button
                            type="button"
                            className="esocial-events-page__action-btn"
                            onClick={() => onViewRejection(event)}
                            aria-label="Ver motivo da rejeicao"
                            title="Ver motivo da rejeicao"
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && events.length === 0 && (
        <div className="esocial-events-page__empty" role="status">
          <FileCode size={48} aria-hidden="true" className="esocial-events-page__empty-icon" />
          <p className="esocial-events-page__empty-title">Nenhum evento eSocial</p>
          <p className="esocial-events-page__empty-desc">
            Gere eventos a partir de admissoes, folhas e ASOs
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Cards ─────────────────────────────────────────────────────────

interface DashboardCardsProps {
  total: number;
  pendente: number;
  exportado: number;
  rejeitado: number;
}

function DashboardCards({ total, pendente, exportado, rejeitado }: DashboardCardsProps) {
  return (
    <div className="esocial-events-page__cards" role="region" aria-label="Resumo de eventos">
      <div className="esocial-events-page__card">
        <p className="esocial-events-page__card-label">TOTAL EVENTOS</p>
        <p className="esocial-events-page__card-value">{total}</p>
      </div>
      <div className="esocial-events-page__card esocial-events-page__card--amber">
        <p className="esocial-events-page__card-label">PENDENTES</p>
        <p className="esocial-events-page__card-value">{pendente}</p>
      </div>
      <div className="esocial-events-page__card esocial-events-page__card--blue">
        <p className="esocial-events-page__card-label">EXPORTADOS</p>
        <p className="esocial-events-page__card-value">{exportado}</p>
      </div>
      <div className="esocial-events-page__card esocial-events-page__card--red">
        <p className="esocial-events-page__card-label">REJEITADOS</p>
        <p className="esocial-events-page__card-value">{rejeitado}</p>
      </div>
    </div>
  );
}

// ─── Group tabs ──────────────────────────────────────────────────────────────

const GROUP_TABS: EsocialGroup[] = ['TABELA', 'NAO_PERIODICO', 'PERIODICO', 'SST'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EsocialEventsPage() {
  const {
    events,
    dashboard,
    loading,
    error,
    successMessage,
    fetchEvents,
    fetchDashboard,
    generateBatch,
    downloadEvent,
    updateStatus,
    reprocessEvent,
  } = useEsocialEvents();

  const [activeGroup, setActiveGroup] = useState<EsocialGroup>('TABELA');
  const [referenceMonth, setReferenceMonth] = useState(getCurrentYearMonth());

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [rejectionEventId, setRejectionEventId] = useState<string | null>(null);
  const [xsdErrors, setXsdErrors] = useState<EsocialXsdError | null>(null);
  const [viewRejectionReason, setViewRejectionReason] = useState<string | null>(null);

  // Load data when month changes
  useEffect(() => {
    const refDate = `${referenceMonth}-01`;
    void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
    void fetchDashboard(refDate);
  }, [referenceMonth, activeGroup, fetchEvents, fetchDashboard]);

  async function handleGenerateBatch(eventType: string, month?: string) {
    const refMonth = month ? `${month}-01` : `${referenceMonth}-01`;
    const ok = await generateBatch({ eventType, referenceMonth: refMonth });
    if (ok) {
      const refDate = `${referenceMonth}-01`;
      void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
      void fetchDashboard(refDate);
    }
  }

  async function handleDownload(event: EsocialEvent) {
    const result = await downloadEvent(event.id, event.eventType, event.version);
    if (result && result.validationErrors.length > 0) {
      setXsdErrors(result);
    } else {
      // Refresh to reflect status change to EXPORTADO
      const refDate = `${referenceMonth}-01`;
      void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
      void fetchDashboard(refDate);
    }
  }

  async function handleAccept(event: EsocialEvent) {
    const ok = await updateStatus(event.id, { status: 'ACEITO' });
    if (ok) {
      const refDate = `${referenceMonth}-01`;
      void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
      void fetchDashboard(refDate);
    }
  }

  function handleOpenReject(event: EsocialEvent) {
    setRejectionEventId(event.id);
  }

  async function handleConfirmReject(eventId: string, reason: string) {
    const ok = await updateStatus(eventId, { status: 'REJEITADO', rejectionReason: reason });
    if (ok) {
      const refDate = `${referenceMonth}-01`;
      void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
      void fetchDashboard(refDate);
    }
  }

  async function handleReprocess(event: EsocialEvent) {
    const ok = await reprocessEvent(event.id);
    if (ok) {
      const refDate = `${referenceMonth}-01`;
      void fetchEvents({ referenceMonth: refDate, eventGroup: activeGroup });
      void fetchDashboard(refDate);
    }
  }

  function handleViewRejection(event: EsocialEvent) {
    if (event.rejectionReason) {
      setViewRejectionReason(event.rejectionReason);
    }
  }

  const filteredEvents = events.filter((e) => e.eventGroup === activeGroup);

  return (
    <main className="esocial-events-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="esocial-events-page__breadcrumb">
        <ol>
          <li>Obrigacoes Acessorias</li>
          <li aria-current="page">Eventos eSocial</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="esocial-events-page__header">
        <h1 className="esocial-events-page__title">Eventos eSocial</h1>
        <button
          type="button"
          className="esocial-events-page__btn esocial-events-page__btn--primary"
          onClick={() => setShowGenerateModal(true)}
        >
          <Play size={16} aria-hidden="true" />
          Gerar Eventos
        </button>
      </header>

      {/* Alerts */}
      {error && (
        <div className="esocial-events-page__alert esocial-events-page__alert--error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </div>
      )}
      {successMessage && (
        <div
          className="esocial-events-page__alert esocial-events-page__alert--success"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {/* Month selector */}
      <section className="esocial-events-page__filters" aria-label="Filtros">
        <div className="esocial-events-page__form-group">
          <label htmlFor="ref-month" className="esocial-events-page__label">
            Competencia
          </label>
          <input
            id="ref-month"
            type="month"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
            className="esocial-events-page__input"
          />
        </div>
      </section>

      {/* Dashboard cards */}
      {dashboard && (
        <DashboardCards
          total={dashboard.total}
          pendente={dashboard.pendente}
          exportado={dashboard.exportado}
          rejeitado={dashboard.rejeitado}
        />
      )}

      {/* Group tabs */}
      <nav className="esocial-events-page__tabs" aria-label="Grupos de eventos" role="tablist">
        {GROUP_TABS.map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={activeGroup === group}
            aria-controls={`tabpanel-${group}`}
            className={`esocial-events-page__tab${activeGroup === group ? ' esocial-events-page__tab--active' : ''}`}
            onClick={() => setActiveGroup(group)}
          >
            {ESOCIAL_GROUP_LABELS[group]}
          </button>
        ))}
      </nav>

      {/* Events table per group */}
      <section
        id={`tabpanel-${activeGroup}`}
        role="tabpanel"
        aria-label={`Eventos do grupo ${ESOCIAL_GROUP_LABELS[activeGroup]}`}
      >
        <EventsTable
          events={filteredEvents}
          loading={loading}
          onDownload={handleDownload}
          onAccept={handleAccept}
          onReject={handleOpenReject}
          onReprocess={handleReprocess}
          onViewRejection={handleViewRejection}
        />
      </section>

      {/* Modals */}
      {showGenerateModal && (
        <GenerateModal onClose={() => setShowGenerateModal(false)} onSubmit={handleGenerateBatch} />
      )}

      {rejectionEventId && (
        <RejectionModal
          eventId={rejectionEventId}
          onClose={() => setRejectionEventId(null)}
          onSubmit={handleConfirmReject}
        />
      )}

      {xsdErrors && <XsdErrorModal errors={xsdErrors} onClose={() => setXsdErrors(null)} />}

      {viewRejectionReason && (
        <ViewRejectionModal
          reason={viewRejectionReason}
          onClose={() => setViewRejectionReason(null)}
        />
      )}
    </main>
  );
}
