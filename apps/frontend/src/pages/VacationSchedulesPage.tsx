import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarPlus,
  CalendarOff,
  CalendarCheck,
  TriangleAlert,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useVacationSchedules } from '@/hooks/useVacationSchedules';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  VacationAcquisitivePeriod,
  VacationSchedule,
  ScheduleVacationInput,
} from '@/types/vacation';
import './VacationSchedulesPage.css';

type Tab = 'periodos' | 'agendamentos';

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function getMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m] ?? month}/${year}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="vac-page__skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="vac-page__skeleton-cell">
          <div className="vac-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

function PeriodStatusBadge({ status }: { status: VacationAcquisitivePeriod['status'] }) {
  const config: Record<string, { label: string; cls: string; desc: string }> = {
    ACCRUING: { label: 'AGUARDANDO', cls: 'badge--neutral', desc: 'Periodo em aquisicao' },
    AVAILABLE: { label: 'DISPONIVEL', cls: 'badge--info', desc: 'Periodo disponivel para agendamento' },
    SCHEDULED: { label: 'AGENDADO', cls: 'badge--warning', desc: 'Ferias agendadas' },
    EXPIRED: { label: 'VENCIDO', cls: 'badge--error', desc: 'Periodo vencido' },
  };
  const c = config[status] ?? { label: status, cls: 'badge--neutral', desc: status };
  return (
    <span className={`vac-page__badge ${c.cls}`} aria-label={`Status: ${c.desc}`}>
      {c.label}
    </span>
  );
}

function ScheduleStatusBadge({ status }: { status: VacationSchedule['status'] }) {
  const config: Record<string, { label: string; cls: string; desc: string }> = {
    SCHEDULED: { label: 'AGENDADO', cls: 'badge--info', desc: 'Ferias agendadas' },
    PAID: { label: 'PAGO', cls: 'badge--success', desc: 'Ferias pagas' },
    CANCELLED: { label: 'CANCELADO', cls: 'badge--neutral', desc: 'Agendamento cancelado' },
  };
  const c = config[status] ?? { label: status, cls: 'badge--neutral', desc: status };
  return (
    <span className={`vac-page__badge ${c.cls}`} aria-label={`Status: ${c.desc}`}>
      {c.label}
    </span>
  );
}

// ---- 3-step vacation schedule modal ----

interface ModalStep1Data {
  employeeSearch: string;
  selectedPeriodId: string;
}

interface ModalStep2Data {
  startDate: string;
  totalDays: number;
  abono: number;
}

interface VacationScheduleModalProps {
  isOpen: boolean;
  periods: VacationAcquisitivePeriod[];
  onClose: () => void;
  onSubmit: (data: ScheduleVacationInput) => Promise<boolean>;
}

function VacationScheduleModal({ isOpen, periods, onClose, onSubmit }: VacationScheduleModalProps) {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<ModalStep1Data>({ employeeSearch: '', selectedPeriodId: '' });
  const [step2, setStep2] = useState<ModalStep2Data>({ startDate: '', totalDays: 30, abono: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstSelectRef = useRef<HTMLSelectElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setStep1({ employeeSearch: '', selectedPeriodId: '' });
      setStep2({ startDate: '', totalDays: 30, abono: 0 });
      setErrors({});
      setTimeout(() => {
        if (step === 1) firstSelectRef.current?.focus();
        else firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availablePeriods = periods.filter((p) => p.status === 'AVAILABLE');
  const selectedPeriod = availablePeriods.find((p) => p.id === step1.selectedPeriodId);

  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!step1.selectedPeriodId) errs.period = 'Selecione um periodo aquisitivo disponivel';
    return errs;
  }

  function validateStep2() {
    const errs: Record<string, string> = {};
    if (!step2.startDate) errs.startDate = 'Informe a data de inicio';
    if (step2.totalDays < 5) errs.totalDays = 'O periodo minimo de ferias e 5 dias corridos. Ajuste as datas.';
    if (selectedPeriod && step2.totalDays > selectedPeriod.balance) {
      errs.totalDays = `Saldo disponivel: ${selectedPeriod.balance} dias`;
    }
    if (step2.abono > 0 && step2.abono !== 10) errs.abono = 'O abono pecuniario e de exatamente 10 dias';
    return errs;
  }

  function handleNext() {
    if (step === 1) {
      const errs = validateStep1();
      if (Object.keys(errs).length) { setErrors(errs); return; }
    }
    if (step === 2) {
      const errs = validateStep2();
      if (Object.keys(errs).length) { setErrors(errs); return; }
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    if (!selectedPeriod) return;
    setSubmitting(true);
    const ok = await onSubmit({
      employeeId: selectedPeriod.employeeId,
      acquisitivePeriodId: step1.selectedPeriodId,
      startDate: step2.startDate,
      totalDays: step2.totalDays,
      abono: step2.abono,
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  // Estimated calculation for Step 3 preview
  const baseSalary = selectedPeriod ? 3000 : 0; // placeholder — real value comes from API
  const oneThirdBonus = (baseSalary / 30) * step2.totalDays * (1 / 3);
  const abonoAmount = step2.abono > 0 ? (baseSalary / 30) * step2.abono : 0;
  const grossAmount = (baseSalary / 30) * step2.totalDays + oneThirdBonus + abonoAmount;

  return (
    <div
      className="vac-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vac-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="vac-page__modal">
        {/* Modal header with steps */}
        <div className="vac-page__modal-header">
          <h2 id="vac-modal-title" className="vac-page__modal-title">Agendar Ferias</h2>
          <div className="vac-page__modal-steps" aria-label="Progresso do formulario">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`vac-page__modal-step ${step === s ? 'vac-page__modal-step--active' : ''} ${step > s ? 'vac-page__modal-step--done' : ''}`}
                aria-current={step === s ? 'step' : undefined}
              >
                <span className="vac-page__modal-step-num">{s}</span>
                <span className="vac-page__modal-step-label">
                  {s === 1 ? 'Selecionar Periodo' : s === 2 ? 'Definir Datas' : 'Conferir Calculo'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="vac-page__modal-body">
            <div className="vac-page__form-group">
              <label htmlFor="modal-period-select" className="vac-page__form-label">
                Periodo Aquisitivo <span aria-hidden="true">*</span>
              </label>
              <select
                id="modal-period-select"
                ref={firstSelectRef}
                className="vac-page__form-select"
                value={step1.selectedPeriodId}
                onChange={(e) => setStep1((p) => ({ ...p, selectedPeriodId: e.target.value }))}
                aria-required="true"
                aria-describedby={errors.period ? 'modal-period-error' : undefined}
              >
                <option value="">Selecione um periodo disponivel...</option>
                {availablePeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.employeeName} — {formatDate(p.startDate)} a {formatDate(p.endDate)} ({p.balance} dias)
                  </option>
                ))}
              </select>
              {errors.period && (
                <span id="modal-period-error" className="vac-page__form-error" role="alert" aria-live="polite">
                  {errors.period}
                </span>
              )}
            </div>
            {availablePeriods.length === 0 && (
              <p className="vac-page__modal-info">
                Nenhum periodo aquisitivo disponivel para agendamento no momento.
              </p>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="vac-page__modal-body">
            {selectedPeriod && (
              <div className="vac-page__modal-summary">
                <strong>{selectedPeriod.employeeName}</strong>
                <span>Saldo disponivel: {selectedPeriod.balance} dias</span>
              </div>
            )}
            <div className="vac-page__form-group">
              <label htmlFor="modal-start-date" className="vac-page__form-label">
                Data de Inicio <span aria-hidden="true">*</span>
              </label>
              <input
                id="modal-start-date"
                ref={firstInputRef}
                type="date"
                className="vac-page__form-input"
                value={step2.startDate}
                onChange={(e) => setStep2((p) => ({ ...p, startDate: e.target.value }))}
                aria-required="true"
                aria-describedby={errors.startDate ? 'modal-startdate-error' : undefined}
              />
              {errors.startDate && (
                <span id="modal-startdate-error" className="vac-page__form-error" role="alert" aria-live="polite">
                  {errors.startDate}
                </span>
              )}
            </div>
            <div className="vac-page__form-group">
              <label htmlFor="modal-total-days" className="vac-page__form-label">
                Total de Dias <span aria-hidden="true">*</span>
              </label>
              <input
                id="modal-total-days"
                type="number"
                className="vac-page__form-input"
                value={step2.totalDays}
                min={5}
                max={selectedPeriod?.balance ?? 30}
                onChange={(e) => setStep2((p) => ({ ...p, totalDays: parseInt(e.target.value, 10) || 0 }))}
                aria-required="true"
                aria-describedby={errors.totalDays ? 'modal-days-error' : undefined}
              />
              {errors.totalDays && (
                <span id="modal-days-error" className="vac-page__form-error" role="alert" aria-live="polite">
                  {errors.totalDays}
                </span>
              )}
            </div>
            <div className="vac-page__form-group">
              <label className="vac-page__form-label">Abono Pecuniario</label>
              <label className="vac-page__form-checkbox-label">
                <input
                  type="checkbox"
                  checked={step2.abono === 10}
                  onChange={(e) => setStep2((p) => ({ ...p, abono: e.target.checked ? 10 : 0 }))}
                />
                Vender 10 dias (abono pecuniario — 1/3 adicional sobre os dias vendidos)
              </label>
            </div>
          </div>
        )}

        {/* Step 3 — calculation preview */}
        {step === 3 && (
          <div className="vac-page__modal-body">
            <p className="vac-page__modal-preview-note">
              Valores estimados. O calculo definitivo sera gerado ao confirmar.
            </p>
            <table className="vac-page__preview-table">
              <caption className="sr-only">Calculo estimado de ferias</caption>
              <tbody>
                <tr>
                  <td>Salario Base</td>
                  <td className="vac-page__preview-value">{formatCurrency(baseSalary)}</td>
                </tr>
                <tr>
                  <td>1/3 Constitucional</td>
                  <td className="vac-page__preview-value">{formatCurrency(oneThirdBonus)}</td>
                </tr>
                {step2.abono > 0 && (
                  <tr>
                    <td>Abono Pecuniario ({step2.abono} dias)</td>
                    <td className="vac-page__preview-value">{formatCurrency(abonoAmount)}</td>
                  </tr>
                )}
                <tr>
                  <td>Bruto estimado</td>
                  <td className="vac-page__preview-value">{formatCurrency(grossAmount)}</td>
                </tr>
                <tr className="vac-page__preview-separator">
                  <td>INSS</td>
                  <td className="vac-page__preview-value vac-page__preview-deduction">
                    — (calculado ao confirmar)
                  </td>
                </tr>
                <tr>
                  <td>IRRF</td>
                  <td className="vac-page__preview-value vac-page__preview-deduction">
                    — (calculado ao confirmar)
                  </td>
                </tr>
                <tr className="vac-page__preview-total">
                  <td><strong>Liquido estimado</strong></td>
                  <td className="vac-page__preview-value"><strong>{formatCurrency(grossAmount * 0.85)}</strong></td>
                </tr>
                <tr>
                  <td>FGTS</td>
                  <td className="vac-page__preview-value">{formatCurrency(grossAmount * 0.08)}</td>
                </tr>
                <tr>
                  <td>Periodo</td>
                  <td className="vac-page__preview-value">
                    {step2.startDate ? formatDate(step2.startDate) : '—'} — {step2.totalDays} dias
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Modal footer */}
        <div className="vac-page__modal-footer">
          <button
            type="button"
            className="vac-page__modal-btn vac-page__modal-btn--secondary"
            onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}
          >
            {step === 1 ? 'Cancelar' : (
              <>
                <ChevronLeft size={16} aria-hidden="true" />
                Voltar
              </>
            )}
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="vac-page__modal-btn vac-page__modal-btn--primary"
              onClick={handleNext}
            >
              Avancar
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="vac-page__modal-btn vac-page__modal-btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Calendar view ----

interface CalendarViewProps {
  schedules: VacationSchedule[];
  year: number;
  month: number;
  onNavigate: (direction: -1 | 1) => void;
}

function CalendarView({ schedules, year, month, onNavigate }: CalendarViewProps) {
  const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const employeeColors = ['#90A4AE', '#A5D6A7', '#FFCC80', '#CE93D8', '#80DEEA', '#FFAB91'];

  const employeeList = Array.from(new Set(schedules.map((s) => s.employeeId)));

  function isOnVacation(empId: string, day: number): boolean {
    const checkDate = new Date(year, month - 1, day);
    return schedules.some((s) => {
      if (s.employeeId !== empId) return false;
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return checkDate >= start && checkDate <= end;
    });
  }

  return (
    <div className="vac-page__calendar">
      <div className="vac-page__calendar-header">
        <button
          type="button"
          className="vac-page__cal-nav-btn"
          onClick={() => onNavigate(-1)}
          aria-label="Mes anterior"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h3 className="vac-page__calendar-month">
          {monthNames[month - 1]} {year}
        </h3>
        <button
          type="button"
          className="vac-page__cal-nav-btn"
          onClick={() => onNavigate(1)}
          aria-label="Proximo mes"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Employee legend */}
      {employeeList.length > 0 && (
        <div className="vac-page__calendar-legend">
          {employeeList.map((empId, idx) => {
            const schedule = schedules.find((s) => s.employeeId === empId);
            return (
              <div key={empId} className="vac-page__legend-item">
                <span
                  className="vac-page__legend-dot"
                  style={{ background: employeeColors[idx % employeeColors.length] }}
                  aria-hidden="true"
                />
                <span>{schedule?.employeeName ?? empId}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="vac-page__calendar-grid">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
          <div key={d} className="vac-page__calendar-weekday">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="vac-page__calendar-cell vac-page__calendar-cell--empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const vacEmployees = employeeList.filter((empId) => isOnVacation(empId, day));
          const schedule = vacEmployees.length > 0
            ? schedules.find((s) => s.employeeId === vacEmployees[0])
            : undefined;
          const ariaLabel = vacEmployees.length > 0
            ? `${day}: ${schedule?.employeeName} em ferias`
            : `${day}`;

          return (
            <div
              key={day}
              className={`vac-page__calendar-cell ${vacEmployees.length > 0 ? 'vac-page__calendar-cell--vacation' : ''}`}
              aria-label={ariaLabel}
            >
              <span className="vac-page__calendar-day-num">{day}</span>
              {vacEmployees.map((empId, _idx) => (
                <div
                  key={empId}
                  className="vac-page__calendar-band"
                  style={{ background: employeeColors[employeeList.indexOf(empId) % employeeColors.length] }}
                  aria-hidden="true"
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main page ----

export default function VacationSchedulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('periodos');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);

  const ctaButtonRef = useRef<HTMLButtonElement>(null);

  const {
    periods,
    schedules,
    loading,
    error,
    successMessage,
    fetchPeriods,
    fetchSchedules,
    scheduleVacation,
    cancelVacation,
    markAsPaid,
    getReceiptPdf,
  } = useVacationSchedules();

  // Debounced employee search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchEmployee(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (activeTab === 'periodos') {
        fetchPeriods({ employeeSearch: value.length >= 2 ? value : undefined });
      } else {
        fetchSchedules({
          employeeSearch: value.length >= 2 ? value : undefined,
          status: filterStatus || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        });
      }
    }, 300);
  }, [activeTab, filterStatus, filterStartDate, filterEndDate, fetchPeriods, fetchSchedules]);

  useEffect(() => {
    if (activeTab === 'periodos') {
      fetchPeriods();
    } else {
      fetchSchedules();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'agendamentos') {
      fetchSchedules({
        employeeSearch: searchEmployee.length >= 2 ? searchEmployee : undefined,
        status: filterStatus || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
    }
  }, [filterStatus, filterStartDate, filterEndDate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleScheduleVacation(data: ScheduleVacationInput): Promise<boolean> {
    const result = await scheduleVacation(data);
    if (result) {
      fetchPeriods();
      fetchSchedules();
      setTimeout(() => ctaButtonRef.current?.focus(), 100);
      return true;
    }
    return false;
  }

  async function handleCancelConfirm() {
    if (!cancelTargetId) return;
    await cancelVacation(cancelTargetId);
    setCancelTargetId(null);
    fetchSchedules();
    fetchPeriods();
  }

  function handleCalendarNavigate(direction: -1 | 1) {
    const newMonth = calMonth + direction;
    if (newMonth < 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else if (newMonth > 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else setCalMonth(newMonth);
  }

  const expiringPeriods = periods.filter((p) => p.isNearDoubling && p.status !== 'EXPIRED');

  return (
    <main className="vac-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="vac-page__breadcrumb" aria-label="Navegacao">
        <span className="vac-page__breadcrumb-item">RH</span>
        <span className="vac-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="vac-page__breadcrumb-item vac-page__breadcrumb-item--current" aria-current="page">
          Ferias
        </span>
      </nav>

      {/* Header */}
      <div className="vac-page__header">
        <h1 className="vac-page__title">Ferias</h1>
        <button
          ref={ctaButtonRef}
          type="button"
          className="vac-page__cta-btn"
          onClick={() => setShowModal(true)}
        >
          <CalendarPlus size={20} aria-hidden="true" />
          Agendar Ferias
        </button>
      </div>

      {/* Toast messages */}
      {successMessage && (
        <div className="vac-page__toast vac-page__toast--success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="vac-page__toast vac-page__toast--error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Alert banners for expiring periods */}
      {expiringPeriods.map((p) => {
        const daysLeft = daysUntil(p.doublingDeadline);
        return (
          <div key={p.id} className="vac-page__alert-banner" role="alert">
            <TriangleAlert size={16} aria-hidden="true" className="vac-page__alert-icon" />
            <span>
              <strong>{p.employeeName}:</strong> Ferias vencerao em {daysLeft} dias. Programe antes de {formatDate(p.doublingDeadline)}.
            </span>
          </div>
        );
      })}

      {/* Tabs */}
      <div className="vac-page__tabs" role="tablist" aria-label="Secoes de ferias">
        <button
          role="tab"
          type="button"
          id="tab-periodos"
          aria-selected={activeTab === 'periodos'}
          aria-controls="panel-periodos"
          className={`vac-page__tab ${activeTab === 'periodos' ? 'vac-page__tab--active' : ''}`}
          onClick={() => setActiveTab('periodos')}
        >
          Periodos Aquisitivos
        </button>
        <button
          role="tab"
          type="button"
          id="tab-agendamentos"
          aria-selected={activeTab === 'agendamentos'}
          aria-controls="panel-agendamentos"
          className={`vac-page__tab ${activeTab === 'agendamentos' ? 'vac-page__tab--active' : ''}`}
          onClick={() => setActiveTab('agendamentos')}
        >
          Agendamentos
        </button>
      </div>

      {/* Tab: Periodos Aquisitivos */}
      {activeTab === 'periodos' && (
        <section id="panel-periodos" role="tabpanel" aria-labelledby="tab-periodos" className="vac-page__panel">
          <div className="vac-page__filters">
            <div className="vac-page__filter-group">
              <label htmlFor="search-employee-periodos" className="vac-page__filter-label">
                Colaborador
              </label>
              <input
                id="search-employee-periodos"
                type="search"
                className="vac-page__filter-input"
                placeholder="Buscar colaborador..."
                value={searchEmployee}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="vac-page__table-wrapper">
            <table className="vac-page__table">
              <caption className="sr-only">Periodos aquisitivos de ferias</caption>
              <thead>
                <tr>
                  <th scope="col" className="vac-page__th">COLABORADOR</th>
                  <th scope="col" className="vac-page__th">INICIO AQUISICAO</th>
                  <th scope="col" className="vac-page__th">FIM AQUISICAO</th>
                  <th scope="col" className="vac-page__th">DIAS GANHOS</th>
                  <th scope="col" className="vac-page__th">DIAS GOZADOS</th>
                  <th scope="col" className="vac-page__th">SALDO</th>
                  <th scope="col" className="vac-page__th">STATUS</th>
                  <th scope="col" className="vac-page__th">ACOES</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
                {!loading && periods.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="vac-page__empty">
                        <CalendarOff size={48} aria-hidden="true" className="vac-page__empty-icon" />
                        <p className="vac-page__empty-title">Nenhum periodo aquisitivo encontrado</p>
                        <p className="vac-page__empty-desc">
                          Os periodos aquisitivos sao criados automaticamente ao cadastrar um colaborador com data de admissao.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && periods.map((period) => (
                  <tr key={period.id} className="vac-page__row">
                    <td className="vac-page__td">{period.employeeName}</td>
                    <td className="vac-page__td">{formatDate(period.startDate)}</td>
                    <td className="vac-page__td">{formatDate(period.endDate)}</td>
                    <td className="vac-page__td">{period.daysEarned}</td>
                    <td className="vac-page__td">{period.daysTaken}</td>
                    <td className="vac-page__td">
                      <span className={period.balance <= 10 ? 'vac-page__balance--low' : ''}>
                        {period.balance}
                      </span>
                    </td>
                    <td className="vac-page__td">
                      <PeriodStatusBadge status={period.status} />
                    </td>
                    <td className="vac-page__td vac-page__td--actions">
                      {period.status === 'AVAILABLE' && (
                        <button
                          type="button"
                          className="vac-page__action-btn"
                          onClick={() => { setShowModal(true); }}
                          aria-label={`Agendar ferias para ${period.employeeName}`}
                          title="Agendar ferias"
                        >
                          <CalendarPlus size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab: Agendamentos */}
      {activeTab === 'agendamentos' && (
        <section id="panel-agendamentos" role="tabpanel" aria-labelledby="tab-agendamentos" className="vac-page__panel">
          <div className="vac-page__filters">
            <div className="vac-page__filter-group">
              <label htmlFor="search-employee-agend" className="vac-page__filter-label">
                Colaborador
              </label>
              <input
                id="search-employee-agend"
                type="search"
                className="vac-page__filter-input"
                placeholder="Buscar colaborador..."
                value={searchEmployee}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="vac-page__filter-group">
              <label htmlFor="filter-status-agend" className="vac-page__filter-label">Status</label>
              <select
                id="filter-status-agend"
                className="vac-page__filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="SCHEDULED">Agendado</option>
                <option value="PAID">Pago</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div className="vac-page__filter-group">
              <label htmlFor="filter-start" className="vac-page__filter-label">De</label>
              <input
                id="filter-start"
                type="date"
                className="vac-page__filter-input"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div className="vac-page__filter-group">
              <label htmlFor="filter-end" className="vac-page__filter-label">Ate</label>
              <input
                id="filter-end"
                type="date"
                className="vac-page__filter-input"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
            <div className="vac-page__filter-group vac-page__filter-group--end">
              <button
                type="button"
                className="vac-page__toggle-btn"
                onClick={() => setShowCalendar((v) => !v)}
                aria-pressed={showCalendar}
              >
                <CalendarCheck size={16} aria-hidden="true" />
                {showCalendar ? 'Ver Lista' : 'Ver Calendario'}
              </button>
            </div>
          </div>

          {/* Calendar view */}
          {showCalendar ? (
            <CalendarView
              schedules={schedules.filter((s) => s.status !== 'CANCELLED')}
              year={calYear}
              month={calMonth}
              onNavigate={handleCalendarNavigate}
            />
          ) : (
            <div className="vac-page__table-wrapper">
              <table className="vac-page__table">
                <caption className="sr-only">Agendamentos de ferias</caption>
                <thead>
                  <tr>
                    <th scope="col" className="vac-page__th">COLABORADOR</th>
                    <th scope="col" className="vac-page__th">PERIODO</th>
                    <th scope="col" className="vac-page__th">DATA INICIO</th>
                    <th scope="col" className="vac-page__th">DATA FIM</th>
                    <th scope="col" className="vac-page__th">DIAS</th>
                    <th scope="col" className="vac-page__th">ABONO</th>
                    <th scope="col" className="vac-page__th vac-page__th--right">VALOR LIQUIDO</th>
                    <th scope="col" className="vac-page__th">PAGAMENTO ATE</th>
                    <th scope="col" className="vac-page__th">STATUS</th>
                    <th scope="col" className="vac-page__th">ACOES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={10} />)}
                  {!loading && schedules.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="vac-page__empty">
                          <CalendarCheck size={48} aria-hidden="true" className="vac-page__empty-icon" />
                          <p className="vac-page__empty-title">Nenhuma ferias agendada</p>
                          <p className="vac-page__empty-desc">
                            Selecione um colaborador com periodo disponivel e agende o gozo das ferias.
                          </p>
                          <button
                            type="button"
                            className="vac-page__empty-cta"
                            onClick={() => setShowModal(true)}
                          >
                            Agendar Ferias
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && schedules.map((schedule) => (
                    <tr key={schedule.id} className="vac-page__row">
                      <td className="vac-page__td">{schedule.employeeName}</td>
                      <td className="vac-page__td">{getMonthLabel(schedule.acquisitivePeriodId.slice(0, 7) || '2026-01')}</td>
                      <td className="vac-page__td">{formatDate(schedule.startDate)}</td>
                      <td className="vac-page__td">{formatDate(schedule.endDate)}</td>
                      <td className="vac-page__td">{schedule.totalDays}</td>
                      <td className="vac-page__td">{schedule.abono > 0 ? `${schedule.abono} dias` : '—'}</td>
                      <td className="vac-page__td vac-page__td--mono vac-page__td--right">
                        {formatCurrency(schedule.netAmount)}
                      </td>
                      <td className="vac-page__td">{formatDate(schedule.paymentDueDate)}</td>
                      <td className="vac-page__td">
                        <ScheduleStatusBadge status={schedule.status} />
                      </td>
                      <td className="vac-page__td vac-page__td--actions">
                        {schedule.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            className="vac-page__action-btn"
                            onClick={() => markAsPaid(schedule.id)}
                            aria-label={`Marcar ferias de ${schedule.employeeName} como pagas`}
                            title="Marcar como pago"
                          >
                            Pagar
                          </button>
                        )}
                        {schedule.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            className="vac-page__action-btn vac-page__action-btn--danger"
                            onClick={() => setCancelTargetId(schedule.id)}
                            aria-label={`Cancelar ferias de ${schedule.employeeName}`}
                            title="Cancelar agendamento"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          className="vac-page__action-btn"
                          onClick={() => getReceiptPdf(schedule.id, schedule.employeeName)}
                          aria-label={`Baixar recibo de ferias de ${schedule.employeeName}`}
                          title="Baixar recibo PDF"
                        >
                          <FileText size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Vacation schedule modal */}
      <VacationScheduleModal
        isOpen={showModal}
        periods={periods}
        onClose={() => {
          setShowModal(false);
          setTimeout(() => ctaButtonRef.current?.focus(), 100);
        }}
        onSubmit={handleScheduleVacation}
      />

      {/* Cancel confirmation */}
      <ConfirmModal
        isOpen={cancelTargetId !== null}
        title="Cancelar agendamento de ferias?"
        message="Cancelar este agendamento de ferias? Os dias voltarao ao saldo disponivel do colaborador."
        confirmLabel="Cancelar agendamento"
        cancelLabel="Manter agendamento"
        variant="danger"
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelTargetId(null)}
      />
    </main>
  );
}
