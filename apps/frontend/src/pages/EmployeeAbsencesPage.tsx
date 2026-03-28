import { useState, useEffect, useCallback, useRef } from 'react';
import { Stethoscope, AlertTriangle, Info, MinusCircle } from 'lucide-react';
import { useEmployeeAbsences } from '@/hooks/useEmployeeAbsences';
import type {
  EmployeeAbsence,
  AbsenceType,
  CreateAbsenceInput,
  RegisterReturnInput,
} from '@/types/absence';
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPE_FIXED_DAYS } from '@/types/absence';
import './EmployeeAbsencesPage.css';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="abs-page__skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="abs-page__skeleton-cell">
          <div className="abs-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

function PayrollImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return <span>—</span>;
  if (impact.includes('INSS')) {
    return (
      <span
        className="abs-page__impact-badge abs-page__impact-badge--info"
        aria-label="INSS responsavel pelo pagamento"
      >
        <Info size={12} aria-hidden="true" />
        INSS paga
      </span>
    );
  }
  const daysMatch = impact.match(/(\d+)/);
  const days = daysMatch ? daysMatch[1] : '';
  return (
    <span
      className="abs-page__impact-badge abs-page__impact-badge--deduction"
      aria-label={`Desconto de ${days} dias na folha`}
    >
      <MinusCircle size={12} aria-hidden="true" />
      {days ? `-${days} dias` : impact}
    </span>
  );
}

// ---- Absence modal ----

interface EmployeeAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAbsenceInput) => Promise<boolean>;
}

function EmployeeAbsenceModal({ isOpen, onClose, onSubmit }: EmployeeAbsenceModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [absenceType, setAbsenceType] = useState<AbsenceType>('MEDICAL_CERTIFICATE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catNumber, setCatNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmployeeId('');
      setAbsenceType('MEDICAL_CERTIFICATE');
      setStartDate('');
      setEndDate('');
      setCatNumber('');
      setNotes('');
      setErrors({});
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Auto-fill end date for fixed-duration types
  useEffect(() => {
    const fixedDays = ABSENCE_TYPE_FIXED_DAYS[absenceType];
    if (fixedDays && startDate) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + fixedDays - 1);
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEndDate(`${year}-${month}-${day}`);
    }
  }, [absenceType, startDate]);

  if (!isOpen) return null;

  function validate() {
    const errs: Record<string, string> = {};
    if (!employeeId.trim()) errs.employeeId = 'Selecione um colaborador';
    if (!startDate) errs.startDate = 'Informe a data de inicio';
    if (absenceType === 'WORK_ACCIDENT' && !catNumber.trim()) {
      errs.catNumber = 'Numero da CAT e obrigatorio para acidente de trabalho';
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const ok = await onSubmit({
      employeeId,
      absenceType,
      startDate,
      endDate: endDate || undefined,
      catNumber: catNumber || undefined,
      notes: notes || undefined,
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  const isWorkAccident = absenceType === 'WORK_ACCIDENT';
  const isInssLeave = absenceType === 'INSS_LEAVE';
  const hasFixedDuration = !!ABSENCE_TYPE_FIXED_DAYS[absenceType];

  return (
    <div
      className="abs-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abs-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="abs-page__modal">
        <div className="abs-page__modal-header">
          <h2 id="abs-modal-title" className="abs-page__modal-title">
            Registrar Afastamento
          </h2>
          <button
            type="button"
            className="abs-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="abs-page__modal-body">
            {/* Employee ID field */}
            <div className="abs-page__form-group">
              <label htmlFor="abs-employee-id" className="abs-page__form-label">
                ID do Colaborador <span aria-hidden="true">*</span>
              </label>
              <input
                id="abs-employee-id"
                ref={firstInputRef}
                type="text"
                className="abs-page__form-input"
                placeholder="Informe o ID do colaborador"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                aria-required="true"
                aria-describedby={errors.employeeId ? 'abs-emp-error' : undefined}
              />
              {errors.employeeId && (
                <span
                  id="abs-emp-error"
                  className="abs-page__form-error"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.employeeId}
                </span>
              )}
            </div>

            {/* Absence type */}
            <div className="abs-page__form-group">
              <label htmlFor="abs-type-select" className="abs-page__form-label">
                Tipo de Afastamento <span aria-hidden="true">*</span>
              </label>
              <select
                id="abs-type-select"
                className="abs-page__form-select"
                value={absenceType}
                onChange={(e) => setAbsenceType(e.target.value as AbsenceType)}
                aria-required="true"
              >
                {(Object.entries(ABSENCE_TYPE_LABELS) as [AbsenceType, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Work accident info banner */}
            {isWorkAccident && (
              <div className="abs-page__info-banner abs-page__info-banner--warning" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  Ao confirmar, o sistema registra estabilidade provisoria de 12 meses apos o
                  retorno.
                </span>
              </div>
            )}

            {/* INSS leave info banner */}
            {isInssLeave && (
              <div className="abs-page__info-banner abs-page__info-banner--info" role="alert">
                <Info size={16} aria-hidden="true" />
                <span>A partir do 16o dia o INSS assume o pagamento. Notifique o colaborador.</span>
              </div>
            )}

            {/* Start date */}
            <div className="abs-page__form-group">
              <label htmlFor="abs-start-date" className="abs-page__form-label">
                Data de Inicio <span aria-hidden="true">*</span>
              </label>
              <input
                id="abs-start-date"
                type="date"
                className="abs-page__form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-required="true"
                aria-describedby={errors.startDate ? 'abs-start-error' : undefined}
              />
              {errors.startDate && (
                <span
                  id="abs-start-error"
                  className="abs-page__form-error"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.startDate}
                </span>
              )}
            </div>

            {/* End date */}
            <div className="abs-page__form-group">
              <label htmlFor="abs-end-date" className="abs-page__form-label">
                Data de Fim {hasFixedDuration ? '(preenchida automaticamente)' : '(opcional)'}
              </label>
              <input
                id="abs-end-date"
                type="date"
                className="abs-page__form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                readOnly={hasFixedDuration}
                style={hasFixedDuration ? { background: 'var(--color-neutral-100)' } : undefined}
              />
            </div>

            {/* CAT number (work accident only) */}
            {isWorkAccident && (
              <div className="abs-page__form-group">
                <label htmlFor="abs-cat-number" className="abs-page__form-label">
                  Numero da CAT <span aria-hidden="true">*</span>
                </label>
                <input
                  id="abs-cat-number"
                  type="text"
                  className="abs-page__form-input"
                  placeholder="Ex: 123456789"
                  value={catNumber}
                  onChange={(e) => setCatNumber(e.target.value)}
                  aria-required="true"
                  aria-describedby={errors.catNumber ? 'abs-cat-error' : undefined}
                />
                {errors.catNumber && (
                  <span
                    id="abs-cat-error"
                    className="abs-page__form-error"
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.catNumber}
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="abs-page__form-group">
              <label htmlFor="abs-notes" className="abs-page__form-label">
                Observacoes (opcional)
              </label>
              <textarea
                id="abs-notes"
                className="abs-page__form-textarea"
                placeholder="Informacoes adicionais sobre o afastamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="abs-page__modal-footer">
            <button
              type="button"
              className="abs-page__modal-btn abs-page__modal-btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="abs-page__modal-btn abs-page__modal-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Registrando...' : 'Registrar Afastamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Register return modal ----

interface RegisterReturnModalProps {
  isOpen: boolean;
  absence: EmployeeAbsence | null;
  onClose: () => void;
  onSubmit: (absenceId: string, data: RegisterReturnInput) => Promise<boolean>;
}

function RegisterReturnModal({ isOpen, absence, onClose, onSubmit }: RegisterReturnModalProps) {
  const [returnDate, setReturnDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReturnDate('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !absence) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!returnDate) {
      setError('Informe a data de retorno');
      return;
    }
    setSubmitting(true);
    const ok = await onSubmit(absence!.id, { returnDate });
    setSubmitting(false);
    if (ok) onClose();
  }

  const isWorkAccident = absence.absenceType === 'WORK_ACCIDENT';

  return (
    <div
      className="abs-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="abs-page__modal abs-page__modal--small">
        <div className="abs-page__modal-header">
          <h2 id="return-modal-title" className="abs-page__modal-title">
            Registrar Retorno
          </h2>
          <button
            type="button"
            className="abs-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="abs-page__modal-body">
            <p className="abs-page__modal-info">
              <strong>{absence.employeeName}</strong> — {ABSENCE_TYPE_LABELS[absence.absenceType]}
            </p>

            {isWorkAccident && (
              <div className="abs-page__info-banner abs-page__info-banner--info" role="alert">
                <Info size={16} aria-hidden="true" />
                <span>Estabilidade provisoria de 12 meses sera computada a partir desta data.</span>
              </div>
            )}

            <div className="abs-page__form-group">
              <label htmlFor="return-date" className="abs-page__form-label">
                Data de Retorno <span aria-hidden="true">*</span>
              </label>
              <input
                id="return-date"
                ref={inputRef}
                type="date"
                className="abs-page__form-input"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                aria-required="true"
                aria-describedby={error ? 'return-date-error' : undefined}
              />
              {error && (
                <span
                  id="return-date-error"
                  className="abs-page__form-error"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </span>
              )}
            </div>
          </div>

          <div className="abs-page__modal-footer">
            <button
              type="button"
              className="abs-page__modal-btn abs-page__modal-btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="abs-page__modal-btn abs-page__modal-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Registrando...' : 'Confirmar Retorno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main page ----

export default function EmployeeAbsencesPage() {
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [returnTarget, setReturnTarget] = useState<EmployeeAbsence | null>(null);

  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { absences, loading, error, successMessage, fetchAbsences, createAbsence, registerReturn } =
    useEmployeeAbsences();

  useEffect(() => {
    fetchAbsences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAbsences({
      absenceType: filterType || undefined,
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
      employeeSearch: searchEmployee.length >= 2 ? searchEmployee : undefined,
    });
  }, [filterType, filterStartDate, filterEndDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchEmployee(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchAbsences({
          employeeSearch: value.length >= 2 ? value : undefined,
          absenceType: filterType || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        });
      }, 300);
    },
    [filterType, filterStartDate, filterEndDate, fetchAbsences],
  );

  async function handleCreateAbsence(data: CreateAbsenceInput): Promise<boolean> {
    const result = await createAbsence(data);
    if (result) {
      fetchAbsences();
      setTimeout(() => ctaButtonRef.current?.focus(), 100);
      return true;
    }
    return false;
  }

  async function handleRegisterReturn(
    absenceId: string,
    data: RegisterReturnInput,
  ): Promise<boolean> {
    const ok = await registerReturn(absenceId, data);
    if (ok) {
      fetchAbsences();
      setReturnTarget(null);
    }
    return ok;
  }

  // Contextual info banners — show when relevant absences exist
  const hasWorkAccidentWithCat = absences.some(
    (a) => a.absenceType === 'WORK_ACCIDENT' && a.catNumber && !a.returnDate,
  );
  const hasInssLeave = absences.some((a) => a.absenceType === 'INSS_LEAVE' && !a.returnDate);

  // Count active filters for badge
  const activeFilterCount = [filterType, filterStartDate, filterEndDate].filter(Boolean).length;

  return (
    <main className="abs-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="abs-page__breadcrumb" aria-label="Navegacao">
        <span className="abs-page__breadcrumb-item">RH</span>
        <span className="abs-page__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span
          className="abs-page__breadcrumb-item abs-page__breadcrumb-item--current"
          aria-current="page"
        >
          Afastamentos
        </span>
      </nav>

      {/* Header */}
      <div className="abs-page__header">
        <h1 className="abs-page__title">Afastamentos</h1>
        <button
          ref={ctaButtonRef}
          type="button"
          className="abs-page__cta-btn"
          onClick={() => setShowModal(true)}
        >
          <Stethoscope size={20} aria-hidden="true" />
          Registrar Afastamento
        </button>
      </div>

      {/* Toast messages */}
      {successMessage && (
        <div className="abs-page__toast abs-page__toast--success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="abs-page__toast abs-page__toast--error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Contextual info banners */}
      {hasWorkAccidentWithCat && (
        <div className="abs-page__info-banner abs-page__info-banner--info" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            CAT registrada — ha colaboradores com estabilidade provisoria ativa. Verifique as datas
            de vencimento.
          </span>
        </div>
      )}
      {hasInssLeave && (
        <div className="abs-page__info-banner abs-page__info-banner--info" role="alert">
          <Info size={16} aria-hidden="true" />
          <span>A partir do 16o dia o INSS assume o pagamento. Notifique o colaborador.</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="abs-page__filters" aria-label="Filtros">
        <div className="abs-page__filter-label-wrap">
          <span className="abs-page__filter-section-label">
            Filtros
            {activeFilterCount > 0 && (
              <span
                className="abs-page__filter-count"
                aria-label={`${activeFilterCount} filtros ativos`}
              >
                {activeFilterCount}
              </span>
            )}
          </span>
        </div>
        <div className="abs-page__filter-group">
          <label htmlFor="abs-search-employee" className="abs-page__filter-label">
            Colaborador
          </label>
          <input
            id="abs-search-employee"
            type="search"
            className="abs-page__filter-input"
            placeholder="Buscar colaborador..."
            value={searchEmployee}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="abs-page__filter-group">
          <label htmlFor="abs-filter-type" className="abs-page__filter-label">
            Tipo
          </label>
          <select
            id="abs-filter-type"
            className="abs-page__filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {(Object.entries(ABSENCE_TYPE_LABELS) as [AbsenceType, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="abs-page__filter-group">
          <label htmlFor="abs-filter-start" className="abs-page__filter-label">
            De
          </label>
          <input
            id="abs-filter-start"
            type="date"
            className="abs-page__filter-input"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div className="abs-page__filter-group">
          <label htmlFor="abs-filter-end" className="abs-page__filter-label">
            Ate
          </label>
          <input
            id="abs-filter-end"
            type="date"
            className="abs-page__filter-input"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="abs-page__table-wrapper">
        <table className="abs-page__table">
          <caption className="sr-only">Lista de afastamentos de colaboradores</caption>
          <thead>
            <tr>
              <th scope="col" className="abs-page__th">
                COLABORADOR
              </th>
              <th scope="col" className="abs-page__th">
                TIPO
              </th>
              <th scope="col" className="abs-page__th">
                DATA INICIO
              </th>
              <th scope="col" className="abs-page__th">
                DATA FIM
              </th>
              <th scope="col" className="abs-page__th">
                DIAS
              </th>
              <th scope="col" className="abs-page__th">
                CAT
              </th>
              <th scope="col" className="abs-page__th">
                IMPACTO FOLHA
              </th>
              <th scope="col" className="abs-page__th">
                STATUS RETORNO
              </th>
              <th scope="col" className="abs-page__th">
                ACOES
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}
            {!loading && absences.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="abs-page__empty">
                    <Stethoscope size={48} aria-hidden="true" className="abs-page__empty-icon" />
                    <p className="abs-page__empty-title">Nenhum afastamento registrado</p>
                    <p className="abs-page__empty-desc">
                      Registre atestados, afastamentos por INSS ou acidentes de trabalho para que a
                      folha seja ajustada automaticamente.
                    </p>
                    <button
                      type="button"
                      className="abs-page__empty-cta"
                      onClick={() => setShowModal(true)}
                    >
                      Registrar Afastamento
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              absences.map((absence) => (
                <tr key={absence.id} className="abs-page__row">
                  <td className="abs-page__td">{absence.employeeName}</td>
                  <td className="abs-page__td">{ABSENCE_TYPE_LABELS[absence.absenceType]}</td>
                  <td className="abs-page__td">{formatDate(absence.startDate)}</td>
                  <td className="abs-page__td">{formatDate(absence.endDate)}</td>
                  <td className="abs-page__td">{absence.totalDays ?? '—'}</td>
                  <td className="abs-page__td">{absence.catNumber ?? '—'}</td>
                  <td className="abs-page__td">
                    <PayrollImpactBadge impact={absence.payrollImpact} />
                  </td>
                  <td className="abs-page__td">
                    {absence.returnDate ? (
                      <span>
                        {formatDate(absence.returnDate)}
                        {absence.asoRequired && (
                          <span
                            className="abs-page__aso-badge"
                            aria-label="ASO obrigatorio para retorno"
                          >
                            ASO Obrigatorio
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className="abs-page__status-badge abs-page__status-badge--warning"
                        aria-label="Status: Em andamento"
                      >
                        AFASTADO
                      </span>
                    )}
                  </td>
                  <td className="abs-page__td abs-page__td--actions">
                    {!absence.returnDate && (
                      <button
                        type="button"
                        className="abs-page__action-btn"
                        onClick={() => setReturnTarget(absence)}
                        aria-label={`Registrar retorno de ${absence.employeeName}`}
                        title="Registrar retorno"
                      >
                        Registrar Retorno
                      </button>
                    )}
                    <button
                      type="button"
                      className="abs-page__action-btn"
                      onClick={() => setShowModal(true)}
                      aria-label={`Editar afastamento de ${absence.employeeName}`}
                      title="Editar"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Create absence modal */}
      <EmployeeAbsenceModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setTimeout(() => ctaButtonRef.current?.focus(), 100);
        }}
        onSubmit={handleCreateAbsence}
      />

      {/* Register return modal */}
      <RegisterReturnModal
        isOpen={returnTarget !== null}
        absence={returnTarget}
        onClose={() => setReturnTarget(null)}
        onSubmit={handleRegisterReturn}
      />
    </main>
  );
}
