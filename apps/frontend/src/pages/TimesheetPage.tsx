import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Lock,
  Info,
  Download,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useTimesheet } from '@/hooks/useTimesheet';
import { useEmployees } from '@/hooks/useEmployees';
import TimesheetApprovalModal from '@/components/attendance/TimesheetApprovalModal';
import TimeEntryEditModal from '@/components/attendance/TimeEntryEditModal';
import type { Timesheet, TimesheetStatus, TimesheetInconsistency } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import './TimesheetPage.css';

type Tab = 'espelho' | 'inconsistencias';

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_MANAGER: 'Pendente Gerente',
  MANAGER_APPROVED: 'Aprovado Gerente',
  PENDING_RH: 'Pendente RH',
  APPROVED: 'Aprovado RH',
  LOCKED: 'Fechado',
  REJECTED: 'Rejeitado',
};

const STATUS_CLASSES: Record<TimesheetStatus, string> = {
  DRAFT: 'timesheet-page__status-chip--draft',
  PENDING_MANAGER: 'timesheet-page__status-chip--warning',
  MANAGER_APPROVED: 'timesheet-page__status-chip--info',
  PENDING_RH: 'timesheet-page__status-chip--warning',
  APPROVED: 'timesheet-page__status-chip--approved',
  LOCKED: 'timesheet-page__status-chip--locked',
  REJECTED: 'timesheet-page__status-chip--error',
};

function StatusChip({ status }: { status: TimesheetStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls = STATUS_CLASSES[status] ?? '';

  let icon = <Clock size={14} aria-hidden="true" />;
  if (status === 'MANAGER_APPROVED') icon = <CheckCircle size={14} aria-hidden="true" />;
  else if (status === 'APPROVED') icon = <CheckCircle2 size={14} aria-hidden="true" />;
  else if (status === 'LOCKED') icon = <Lock size={14} aria-hidden="true" />;
  else if (status === 'REJECTED') icon = <AlertCircle size={14} aria-hidden="true" />;

  return (
    <span className={`timesheet-page__status-chip ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${h}h`;
}

function getMonthName(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function canApprove(status: TimesheetStatus): boolean {
  return status === 'PENDING_MANAGER' || status === 'PENDING_RH';
}

function canReject(status: TimesheetStatus): boolean {
  return status === 'PENDING_MANAGER' || status === 'PENDING_RH' || status === 'MANAGER_APPROVED';
}

const INCONSISTENCY_TYPE_LABELS: Record<string, string> = {
  MISSING_CLOCK_OUT: 'Saida nao registrada',
  INTERJORNADA_VIOLATION: 'Violacao de interjornada',
  OUT_OF_RANGE: 'Fora do perimetro',
  NO_BOUNDARY: 'Sem perimetro definido',
};

const SEVERITY_CLASSES: Record<string, string> = {
  ERROR: 'timesheet-page__severity--error',
  WARNING: 'timesheet-page__severity--warning',
};

export default function TimesheetPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('espelho');
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [correctingInconsistency, setCorrectingInconsistency] = useState<TimesheetInconsistency | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const {
    timesheets,
    loading,
    error,
    successMessage,
    fetchTimesheets,
    fetchTimesheet,
    approveTimesheet,
    addCorrection,
    exportPdf,
  } = useTimesheet();

  const { employees } = useEmployees({
    farmId: selectedFarmId || undefined,
    limit: 200,
  });

  const orgId = user?.organizationId;

  const doFetch = useCallback(() => {
    void fetchTimesheets({
      farmId: selectedFarmId || undefined,
      employeeId: selectedEmployeeId || undefined,
      referenceMonth: referenceMonth || undefined,
      status: selectedStatus || undefined,
    });
  }, [fetchTimesheets, selectedFarmId, selectedEmployeeId, referenceMonth, selectedStatus]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  async function handleSelectTimesheet(ts: Timesheet) {
    await fetchTimesheet(ts.id);
    setSelectedTimesheet(ts);
  }

  function handleApprove(ts: Timesheet) {
    setSelectedTimesheet(ts);
    setApprovalAction('approve');
    setShowApprovalModal(true);
  }

  function handleReject(ts: Timesheet) {
    setSelectedTimesheet(ts);
    setApprovalAction('reject');
    setShowApprovalModal(true);
  }

  async function handleExportPdf(ts: Timesheet) {
    setPdfLoading(true);
    try {
      await exportPdf(ts.id);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleApprovalConfirm(action: 'APPROVE_MANAGER' | 'APPROVE_RH' | 'REJECT', justification?: string) {
    if (!selectedTimesheet) return false;
    const ok = await approveTimesheet(selectedTimesheet.id, { action, justification });
    if (ok) {
      doFetch();
      setShowApprovalModal(false);
    }
    return ok;
  }

  async function handleCorrection(justification: string, beforeJson: Record<string, unknown>, afterJson: Record<string, unknown>) {
    if (!selectedTimesheet || !correctingInconsistency) return false;
    const ok = await addCorrection(selectedTimesheet.id, {
      timeEntryId: correctingInconsistency.timeEntryId,
      justification,
      beforeJson,
      afterJson,
    });
    if (ok) {
      doFetch();
      setCorrectingInconsistency(null);
    }
    return ok;
  }

  const displayedTimesheets = timesheets;
  const inconsistencies = selectedTimesheet?.inconsistencies ?? [];

  return (
    <main className="timesheet-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="timesheet-page__breadcrumb" aria-label="Navegacao estrutural">
        <span>RH</span>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Espelho de Ponto</span>
      </nav>

      {/* Header */}
      <div className="timesheet-page__header">
        <h1 className="timesheet-page__title">
          <FileText size={24} aria-hidden="true" />
          Espelho de Ponto
        </h1>
      </div>

      {/* Success / Error messages */}
      {successMessage && (
        <div className="timesheet-page__success" role="status" aria-live="polite">
          <CheckCircle size={16} aria-hidden="true" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="timesheet-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="timesheet-page__filters">
        <div className="timesheet-page__filter-group">
          <label htmlFor="filter-month" className="timesheet-page__filter-label">
            Mes/Ano
          </label>
          <input
            id="filter-month"
            type="month"
            className="timesheet-page__filter-input"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
          />
        </div>

        <div className="timesheet-page__filter-group">
          <label htmlFor="filter-employee" className="timesheet-page__filter-label">
            Colaborador
          </label>
          <select
            id="filter-employee"
            className="timesheet-page__filter-select"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="">Todos os colaboradores</option>
            {employees.map((emp: Employee) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="timesheet-page__filter-group">
          <label htmlFor="filter-status" className="timesheet-page__filter-label">
            Status
          </label>
          <select
            id="filter-status"
            className="timesheet-page__filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="PENDING_MANAGER">Pendente Gerente</option>
            <option value="MANAGER_APPROVED">Aprovado Gerente</option>
            <option value="PENDING_RH">Pendente RH</option>
            <option value="APPROVED">Aprovado RH</option>
            <option value="LOCKED">Fechado</option>
            <option value="REJECTED">Rejeitado</option>
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="timesheet-page__skeleton-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="timesheet-page__skeleton-card">
              <div className="timesheet-page__skeleton timesheet-page__skeleton--lg" />
              <div className="timesheet-page__skeleton timesheet-page__skeleton--md" />
              <div className="timesheet-page__skeleton timesheet-page__skeleton--sm" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayedTimesheets.length === 0 && (
        <div className="timesheet-page__empty">
          <FileText size={48} className="timesheet-page__empty-icon" aria-hidden="true" />
          <h2 className="timesheet-page__empty-title">Nenhum espelho disponivel</h2>
          <p className="timesheet-page__empty-body">
            Selecione um colaborador e um mes para visualizar o espelho de ponto.
          </p>
        </div>
      )}

      {/* Timesheet list */}
      {!loading && displayedTimesheets.length > 0 && (
        <div className="timesheet-page__list">
          {displayedTimesheets.map((ts) => (
            <article
              key={ts.id}
              className={`timesheet-page__card ${selectedTimesheet?.id === ts.id ? 'timesheet-page__card--selected' : ''}`}
            >
              <div className="timesheet-page__card-header">
                <div className="timesheet-page__card-info">
                  <h2 className="timesheet-page__card-name">{ts.employeeName}</h2>
                  <p className="timesheet-page__card-month">{getMonthName(ts.referenceMonth)}</p>
                </div>
                <StatusChip status={ts.status} />
              </div>

              <div className="timesheet-page__card-summary">
                <div className="timesheet-page__summary-item">
                  <span className="timesheet-page__summary-label">Total trabalhado</span>
                  <span className="timesheet-page__summary-value">{formatMinutes(ts.totalWorked)}</span>
                </div>
                <div className="timesheet-page__summary-item">
                  <span className="timesheet-page__summary-label">HE 50%</span>
                  <span className="timesheet-page__summary-value">{formatMinutes(ts.totalOvertime50)}</span>
                </div>
                <div className="timesheet-page__summary-item">
                  <span className="timesheet-page__summary-label">HE 100%</span>
                  <span className="timesheet-page__summary-value">{formatMinutes(ts.totalOvertime100)}</span>
                </div>
                <div className="timesheet-page__summary-item">
                  <span className="timesheet-page__summary-label">Noturno</span>
                  <span className="timesheet-page__summary-value">{formatMinutes(ts.totalNightMinutes)}</span>
                </div>
                <div className="timesheet-page__summary-item">
                  <span className="timesheet-page__summary-label">Faltas</span>
                  <span className="timesheet-page__summary-value">{ts.totalAbsences}d</span>
                </div>
                {ts.inconsistencies.length > 0 && (
                  <div className="timesheet-page__summary-item">
                    <span className="timesheet-page__summary-label">Inconsistencias</span>
                    <span className="timesheet-page__summary-value timesheet-page__summary-value--error">
                      <AlertCircle size={14} aria-hidden="true" />
                      {ts.inconsistencies.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="timesheet-page__card-actions">
                <button
                  type="button"
                  className="timesheet-page__btn timesheet-page__btn--ghost"
                  onClick={() => void handleSelectTimesheet(ts)}
                >
                  Ver detalhes
                </button>
                <button
                  type="button"
                  className="timesheet-page__btn timesheet-page__btn--secondary"
                  onClick={() => void handleExportPdf(ts)}
                  disabled={pdfLoading}
                  aria-label={`Exportar PDF do espelho de ${ts.employeeName}`}
                >
                  <Download size={16} aria-hidden="true" />
                  {pdfLoading ? 'Exportando...' : 'Exportar PDF'}
                </button>
                {canReject(ts.status) && (
                  <button
                    type="button"
                    className="timesheet-page__btn timesheet-page__btn--destructive-outline"
                    onClick={() => handleReject(ts)}
                    aria-label={`Rejeitar espelho de ${ts.employeeName}`}
                  >
                    Rejeitar e Devolver
                  </button>
                )}
                {canApprove(ts.status) && (
                  <button
                    type="button"
                    className="timesheet-page__btn timesheet-page__btn--primary"
                    onClick={() => handleApprove(ts)}
                    aria-label={`Aprovar espelho de ${ts.employeeName}`}
                  >
                    Aprovar Espelho
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Detail panel for selected timesheet */}
      {selectedTimesheet && (
        <section className="timesheet-page__detail" aria-label={`Detalhes do espelho de ${selectedTimesheet.employeeName}`}>
          <div className="timesheet-page__detail-header">
            <h2 className="timesheet-page__detail-title">
              {selectedTimesheet.employeeName} — {getMonthName(selectedTimesheet.referenceMonth)}
            </h2>
            <StatusChip status={selectedTimesheet.status} />
          </div>

          {/* Tabs */}
          <div className="timesheet-page__tabs" role="tablist" aria-label="Secoes do espelho">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'espelho'}
              aria-controls="tab-espelho"
              className={`timesheet-page__tab ${activeTab === 'espelho' ? 'timesheet-page__tab--active' : ''}`}
              onClick={() => setActiveTab('espelho')}
            >
              <FileText size={16} aria-hidden="true" />
              Espelho Mensal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'inconsistencias'}
              aria-controls="tab-inconsistencias"
              className={`timesheet-page__tab ${activeTab === 'inconsistencias' ? 'timesheet-page__tab--active' : ''}`}
              onClick={() => setActiveTab('inconsistencias')}
            >
              <AlertCircle size={16} aria-hidden="true" />
              Inconsistencias
              {inconsistencies.length > 0 && (
                <span className="timesheet-page__tab-badge">{inconsistencies.length}</span>
              )}
            </button>
          </div>

          {/* Tab: Espelho Mensal */}
          {activeTab === 'espelho' && (
            <div id="tab-espelho" role="tabpanel" aria-label="Espelho mensal">
              {/* Calendar summary bar */}
              <div className="timesheet-page__summary-bar">
                <div className="timesheet-page__summary-bar-item">
                  <span className="timesheet-page__summary-bar-label">Total Horas</span>
                  <span className="timesheet-page__summary-bar-value">{formatMinutes(selectedTimesheet.totalWorked)}</span>
                </div>
                <div className="timesheet-page__summary-bar-item">
                  <span className="timesheet-page__summary-bar-label">HE 50%</span>
                  <span className="timesheet-page__summary-bar-value">{formatMinutes(selectedTimesheet.totalOvertime50)}</span>
                </div>
                <div className="timesheet-page__summary-bar-item">
                  <span className="timesheet-page__summary-bar-label">HE 100%</span>
                  <span className="timesheet-page__summary-bar-value">{formatMinutes(selectedTimesheet.totalOvertime100)}</span>
                </div>
                <div className="timesheet-page__summary-bar-item">
                  <span className="timesheet-page__summary-bar-label">Noturno</span>
                  <span className="timesheet-page__summary-bar-value">{formatMinutes(selectedTimesheet.totalNightMinutes)}</span>
                </div>
                <div className="timesheet-page__summary-bar-item">
                  <span className="timesheet-page__summary-bar-label">Faltas</span>
                  <span className="timesheet-page__summary-bar-value">{selectedTimesheet.totalAbsences}d</span>
                </div>
              </div>

              {/* Corrections audit trail */}
              {selectedTimesheet.corrections.length > 0 && (
                <div className="timesheet-page__corrections">
                  <h3 className="timesheet-page__corrections-title">
                    <Info size={16} aria-hidden="true" />
                    Historico de correcoes
                  </h3>
                  <ul className="timesheet-page__corrections-list">
                    {selectedTimesheet.corrections.map((c) => (
                      <li key={c.id} className="timesheet-page__correction-item">
                        <span className="timesheet-page__correction-by">{c.correctedBy}</span>
                        <span className="timesheet-page__correction-date">
                          {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="timesheet-page__correction-reason">{c.justification}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="timesheet-page__detail-actions">
                <button
                  type="button"
                  className="timesheet-page__btn timesheet-page__btn--secondary"
                  onClick={() => void handleExportPdf(selectedTimesheet)}
                  disabled={pdfLoading}
                >
                  <Download size={16} aria-hidden="true" />
                  {pdfLoading ? 'Exportando...' : 'Exportar PDF'}
                </button>
                {canReject(selectedTimesheet.status) && (
                  <button
                    type="button"
                    className="timesheet-page__btn timesheet-page__btn--destructive-outline"
                    onClick={() => handleReject(selectedTimesheet)}
                  >
                    Rejeitar e Devolver
                  </button>
                )}
                {canApprove(selectedTimesheet.status) && (
                  <button
                    type="button"
                    className="timesheet-page__btn timesheet-page__btn--primary"
                    onClick={() => handleApprove(selectedTimesheet)}
                  >
                    Aprovar Espelho
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab: Inconsistencias */}
          {activeTab === 'inconsistencias' && (
            <div id="tab-inconsistencias" role="tabpanel" aria-label="Inconsistencias">
              {inconsistencies.length === 0 ? (
                <div className="timesheet-page__empty timesheet-page__empty--sm">
                  <CheckCircle2 size={40} className="timesheet-page__empty-icon" aria-hidden="true" />
                  <h3 className="timesheet-page__empty-title">Sem inconsistencias</h3>
                  <p className="timesheet-page__empty-body">
                    Todos os apontamentos estao corretos para este mes.
                  </p>
                </div>
              ) : (
                <div className="timesheet-page__table-wrapper">
                  <table className="timesheet-page__table" aria-label="Lista de inconsistencias">
                    <thead>
                      <tr>
                        <th scope="col">DATA</th>
                        <th scope="col">TIPO</th>
                        <th scope="col">DESCRICAO</th>
                        <th scope="col">SEVERIDADE</th>
                        <th scope="col">ACAO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inconsistencies.map((inc, idx) => (
                        <tr
                          key={`${inc.timeEntryId}-${idx}`}
                          className="timesheet-page__inconsistency-row"
                          role="alert"
                        >
                          <td className="timesheet-page__cell-mono">
                            {new Date(inc.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td>
                            <span className="timesheet-page__inc-type">
                              <AlertCircle size={14} aria-hidden="true" />
                              {INCONSISTENCY_TYPE_LABELS[inc.type] ?? inc.type}
                            </span>
                          </td>
                          <td className="timesheet-page__inc-description">{inc.description}</td>
                          <td>
                            <span className={`timesheet-page__severity ${SEVERITY_CLASSES[inc.severity] ?? ''}`}>
                              {inc.severity === 'ERROR' ? 'Critico' : 'Atencao'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="timesheet-page__btn timesheet-page__btn--ghost timesheet-page__btn--sm"
                              onClick={() => setCorrectingInconsistency(inc)}
                              aria-label={`Corrigir inconsistencia de ${new Date(inc.date).toLocaleDateString('pt-BR')}`}
                            >
                              Corrigir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Approval Modal */}
      <TimesheetApprovalModal
        isOpen={showApprovalModal}
        timesheet={selectedTimesheet}
        action={approvalAction}
        onConfirm={handleApprovalConfirm}
        onClose={() => setShowApprovalModal(false)}
      />

      {/* Correction Modal */}
      <TimeEntryEditModal
        isOpen={correctingInconsistency !== null}
        inconsistency={correctingInconsistency}
        timesheetId={selectedTimesheet?.id ?? ''}
        onSave={handleCorrection}
        onClose={() => setCorrectingInconsistency(null)}
      />
    </main>
  );
}
