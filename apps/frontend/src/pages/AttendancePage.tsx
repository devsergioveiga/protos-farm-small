import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Monitor,
  UserPen,
  AlertCircle,
  ClockArrowUp,
  Link2,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useEmployees } from '@/hooks/useEmployees';
import { api } from '@/services/api';
import ManualPunchModal from '@/components/attendance/ManualPunchModal';
import LinkOperationModal from '@/components/attendance/LinkOperationModal';
import OvertimeBankCard from '@/components/attendance/OvertimeBankCard';
import TeamLinkingTab from '@/components/attendance/TeamLinkingTab';
import type { TimeEntry, OvertimeBankSummary, CreateTimeEntryInput, AddActivityInput } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import './AttendancePage.css';

type Tab = 'apontamentos' | 'banco-horas' | 'vincular';


function formatTime(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? `${String(m).padStart(2, '0')}m` : ''}`;
}

function SourceChip({ source, outOfRange }: { source: string; outOfRange: boolean }) {
  if (source === 'MOBILE') {
    return (
      <span className={`attendance-page__source-chip attendance-page__source-chip--${outOfRange ? 'warning' : 'mobile'}`}>
        <MapPin size={12} aria-hidden="true" />
        {outOfRange ? 'Fora do perímetro' : 'Mobile'}
      </span>
    );
  }
  if (source === 'MANAGER') {
    return (
      <span className="attendance-page__source-chip attendance-page__source-chip--manager">
        <UserPen size={12} aria-hidden="true" />
        Gerente
      </span>
    );
  }
  return (
    <span className="attendance-page__source-chip attendance-page__source-chip--web">
      <Monitor size={12} aria-hidden="true" />
      Web
    </span>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('apontamentos');
  const [selectedFarmId, _setSelectedFarmId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [linkingEntry, setLinkingEntry] = useState<TimeEntry | null>(null);
  const [overtimeSummaries, setOvertimeSummaries] = useState<OvertimeBankSummary[]>([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { timeEntries, loading, error, fetchTimeEntries, createTimeEntry, addActivity } = useTimeEntries();
  const { employees } = useEmployees({ farmId: selectedFarmId || undefined, limit: 200 });

  const orgId = user?.organizationId;

  const doFetch = useCallback(() => {
    void fetchTimeEntries({
      farmId: selectedFarmId || undefined,
      employeeId: selectedEmployeeId || undefined,
      dateFrom,
      dateTo,
    });
  }, [fetchTimeEntries, selectedFarmId, selectedEmployeeId, dateFrom, dateTo]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  const fetchOvertime = useCallback(async () => {
    if (!orgId || activeTab !== 'banco-horas') return;
    setOvertimeLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFarmId) params.set('farmId', selectedFarmId);
      if (selectedEmployeeId) params.set('employeeId', selectedEmployeeId);
      const qs = params.toString();
      const result = await api.get<OvertimeBankSummary[] | { data: OvertimeBankSummary[] }>(
        `/org/${orgId}/overtime-bank${qs ? `?${qs}` : ''}`,
      );
      const summaries = Array.isArray(result) ? result : (result as { data: OvertimeBankSummary[] }).data;
      setOvertimeSummaries(summaries);
    } catch {
      setOvertimeSummaries([]);
    } finally {
      setOvertimeLoading(false);
    }
  }, [orgId, activeTab, selectedFarmId, selectedEmployeeId]);

  useEffect(() => {
    void fetchOvertime();
  }, [fetchOvertime]);

  async function handleCreatePunch(employeeId: string, data: CreateTimeEntryInput): Promise<boolean> {
    const success = await createTimeEntry(employeeId, data);
    if (success) {
      setSuccessMsg('Ponto registrado com sucesso');
      doFetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    }
    return success;
  }

  async function handleAddActivity(timeEntryId: string, data: AddActivityInput): Promise<boolean> {
    const success = await addActivity(timeEntryId, data);
    if (success) {
      setSuccessMsg('Operação vinculada com sucesso');
      doFetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    }
    return success;
  }

  return (
    <main className="attendance-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="attendance-page__breadcrumb" aria-label="Navegação estrutural">
        <span>RH</span>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Controle de Ponto</span>
      </nav>

      {/* Header */}
      <div className="attendance-page__header">
        <h1 className="attendance-page__title">
          <Clock size={24} aria-hidden="true" />
          Controle de Ponto
        </h1>
        <button
          type="button"
          className="attendance-page__btn attendance-page__btn--primary"
          onClick={() => setShowPunchModal(true)}
          aria-label="Registrar ponto manualmente"
        >
          Registrar Ponto
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="attendance-page__success" role="status" aria-live="polite">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="attendance-page__filters">
        <div className="attendance-page__filter-group">
          <label htmlFor="filter-employee" className="attendance-page__filter-label">
            Colaborador
          </label>
          <select
            id="filter-employee"
            className="attendance-page__filter-select"
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

        <div className="attendance-page__filter-group">
          <label htmlFor="filter-date-from" className="attendance-page__filter-label">
            De
          </label>
          <input
            id="filter-date-from"
            type="date"
            className="attendance-page__filter-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="attendance-page__filter-group">
          <label htmlFor="filter-date-to" className="attendance-page__filter-label">
            Até
          </label>
          <input
            id="filter-date-to"
            type="date"
            className="attendance-page__filter-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="attendance-page__tabs" role="tablist" aria-label="Seções de controle de ponto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'apontamentos'}
          aria-controls="tab-apontamentos"
          className={`attendance-page__tab ${activeTab === 'apontamentos' ? 'attendance-page__tab--active' : ''}`}
          onClick={() => setActiveTab('apontamentos')}
        >
          <Clock size={16} aria-hidden="true" />
          Apontamentos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'banco-horas'}
          aria-controls="tab-banco-horas"
          className={`attendance-page__tab ${activeTab === 'banco-horas' ? 'attendance-page__tab--active' : ''}`}
          onClick={() => setActiveTab('banco-horas')}
        >
          <ClockArrowUp size={16} aria-hidden="true" />
          Banco de Horas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'vincular'}
          aria-controls="tab-vincular"
          className={`attendance-page__tab ${activeTab === 'vincular' ? 'attendance-page__tab--active' : ''}`}
          onClick={() => setActiveTab('vincular')}
        >
          <Link2 size={16} aria-hidden="true" />
          Vincular Operacoes
        </button>
      </div>

      {/* Tab: Apontamentos */}
      {activeTab === 'apontamentos' && (
        <section id="tab-apontamentos" role="tabpanel" aria-label="Apontamentos de ponto">
          {error && (
            <div className="attendance-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="attendance-page__table-wrapper">
              <table className="attendance-page__table" aria-label="Carregando apontamentos...">
                <thead>
                  <tr>
                    <th scope="col">DATA</th>
                    <th scope="col">COLABORADOR</th>
                    <th scope="col">ENTRADA</th>
                    <th scope="col">INT. INÍCIO</th>
                    <th scope="col">INT. FIM</th>
                    <th scope="col">SAÍDA</th>
                    <th scope="col">HORAS</th>
                    <th scope="col">FONTE</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="attendance-page__skeleton-row">
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--md" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--badge" /></td>
                      <td><div className="attendance-page__skeleton attendance-page__skeleton--sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && timeEntries.length === 0 && (
            <div className="attendance-page__empty">
              <Clock size={48} className="attendance-page__empty-icon" aria-hidden="true" />
              <h2 className="attendance-page__empty-title">Nenhum ponto registrado hoje</h2>
              <p className="attendance-page__empty-body">
                Os colaboradores ainda nao registraram ponto. Voce pode registrar manualmente pelo botao acima.
              </p>
              <button
                type="button"
                className="attendance-page__btn attendance-page__btn--primary"
                onClick={() => setShowPunchModal(true)}
              >
                Registrar Ponto
              </button>
            </div>
          )}

          {/* Desktop table */}
          {!loading && !error && timeEntries.length > 0 && (
            <>
              <div className="attendance-page__table-wrapper attendance-page__table-wrapper--desktop">
                <table className="attendance-page__table" aria-label="Lista de apontamentos">
                  <thead>
                    <tr>
                      <th scope="col">DATA</th>
                      <th scope="col">COLABORADOR</th>
                      <th scope="col">ENTRADA</th>
                      <th scope="col">INT. INÍCIO</th>
                      <th scope="col">INT. FIM</th>
                      <th scope="col">SAÍDA</th>
                      <th scope="col">HORAS</th>
                      <th scope="col">FONTE</th>
                      <th scope="col">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`attendance-page__row ${entry.outOfRange ? 'attendance-page__row--warning' : ''}`}
                      >
                        <td className="attendance-page__cell-date">
                          {new Date(entry.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="attendance-page__cell-name">{entry.employeeName}</td>
                        <td className="attendance-page__cell-time">{formatTime(entry.clockIn)}</td>
                        <td className="attendance-page__cell-time">{formatTime(entry.breakStart)}</td>
                        <td className="attendance-page__cell-time">{formatTime(entry.breakEnd)}</td>
                        <td className="attendance-page__cell-time">{formatTime(entry.clockOut)}</td>
                        <td className="attendance-page__cell-time">{formatMinutes(entry.workedMinutes)}</td>
                        <td>
                          <SourceChip source={entry.source} outOfRange={entry.outOfRange} />
                        </td>
                        <td>
                          <div className="attendance-page__row-actions">
                            {entry.managerNote && (
                              <span
                                className="attendance-page__manager-badge"
                                title={entry.managerNote}
                                aria-label={`Nota do gerente: ${entry.managerNote}`}
                              >
                                <UserPen size={14} aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="attendance-page__cards attendance-page__cards--mobile">
                {timeEntries.map((entry) => (
                  <article key={`card-${entry.id}`} className={`attendance-page__card ${entry.outOfRange ? 'attendance-page__card--warning' : ''}`}>
                    <div className="attendance-page__card-header">
                      <div>
                        <div className="attendance-page__card-name">{entry.employeeName}</div>
                        <div className="attendance-page__card-date">
                          {new Date(entry.date).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <SourceChip source={entry.source} outOfRange={entry.outOfRange} />
                    </div>
                    <div className="attendance-page__card-times">
                      <div className="attendance-page__card-time-item">
                        <span className="attendance-page__card-time-label">Entrada</span>
                        <span className="attendance-page__card-time-value">{formatTime(entry.clockIn)}</span>
                      </div>
                      {entry.breakStart && (
                        <div className="attendance-page__card-time-item">
                          <span className="attendance-page__card-time-label">Int. Início</span>
                          <span className="attendance-page__card-time-value">{formatTime(entry.breakStart)}</span>
                        </div>
                      )}
                      {entry.breakEnd && (
                        <div className="attendance-page__card-time-item">
                          <span className="attendance-page__card-time-label">Int. Fim</span>
                          <span className="attendance-page__card-time-value">{formatTime(entry.breakEnd)}</span>
                        </div>
                      )}
                      <div className="attendance-page__card-time-item">
                        <span className="attendance-page__card-time-label">Saída</span>
                        <span className="attendance-page__card-time-value">{formatTime(entry.clockOut)}</span>
                      </div>
                      <div className="attendance-page__card-time-item attendance-page__card-time-item--total">
                        <span className="attendance-page__card-time-label">Total</span>
                        <span className="attendance-page__card-time-value">{formatMinutes(entry.workedMinutes)}</span>
                      </div>
                    </div>
                    {entry.managerNote && (
                      <div className="attendance-page__card-note">
                        <UserPen size={12} aria-hidden="true" />
                        <span>{entry.managerNote}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Tab: Banco de Horas */}
      {activeTab === 'banco-horas' && (
        <section id="tab-banco-horas" role="tabpanel" aria-label="Banco de horas">
          {overtimeLoading && (
            <div className="attendance-page__overtime-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="attendance-page__skeleton-card">
                  <div className="attendance-page__skeleton attendance-page__skeleton--lg" />
                  <div className="attendance-page__skeleton attendance-page__skeleton--md" />
                  <div className="attendance-page__skeleton attendance-page__skeleton--sm" />
                </div>
              ))}
            </div>
          )}

          {!overtimeLoading && overtimeSummaries.length === 0 && (
            <div className="attendance-page__empty">
              <ClockArrowUp size={48} className="attendance-page__empty-icon" aria-hidden="true" />
              <h2 className="attendance-page__empty-title">Sem saldo no banco de horas</h2>
              <p className="attendance-page__empty-body">
                Nenhuma hora extra acumulada para este periodo.
              </p>
            </div>
          )}

          {!overtimeLoading && overtimeSummaries.length > 0 && (
            <div className="attendance-page__overtime-grid">
              {overtimeSummaries.map((summary) => (
                <OvertimeBankCard key={summary.employeeId} summary={summary} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab: Vincular Operacoes */}
      {activeTab === 'vincular' && (
        <section id="tab-vincular" role="tabpanel" aria-label="Vincular operacoes">
          <TeamLinkingTab
            farmId={selectedFarmId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            timeEntries={timeEntries}
            onLinkIndividual={(entry) => setLinkingEntry(entry)}
            onSuccess={(msg) => {
              setSuccessMsg(msg);
              doFetch();
              setTimeout(() => setSuccessMsg(null), 5000);
            }}
          />
        </section>
      )}

      {/* Modals */}
      <ManualPunchModal
        isOpen={showPunchModal}
        employees={employees}
        onSave={handleCreatePunch}
        onClose={() => setShowPunchModal(false)}
      />

      <LinkOperationModal
        isOpen={linkingEntry !== null}
        timeEntry={linkingEntry}
        onSave={handleAddActivity}
        onClose={() => setLinkingEntry(null)}
      />
    </main>
  );
}
