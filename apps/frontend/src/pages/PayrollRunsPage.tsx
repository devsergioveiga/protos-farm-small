import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Wallet, Eye, Download, Mail, RotateCcw, ChevronDown } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { usePayrollRuns } from '@/hooks/usePayrollRuns';
import { useSalaryAdvances } from '@/hooks/useSalaryAdvances';
import PayrollRunStatusBadge from '@/components/payroll/PayrollRunStatusBadge';
import PayrollRunWizard from '@/components/payroll/PayrollRunWizard';
import PayrollRunDetailModal from '@/components/payroll/PayrollRunDetailModal';
import PayrollCpReviewModal from '@/components/payroll/PayrollCpReviewModal';
import SalaryAdvanceModal from '@/components/payroll/SalaryAdvanceModal';
import type { PayrollRun, SalaryAdvance } from '@/types/payroll-runs';
import { RUN_TYPE_LABELS, RUN_STATUS_LABELS } from '@/types/payroll-runs';
import './PayrollRunsPage.css';

type Tab = 'rodadas' | 'adiantamentos';

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

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function getMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m] ?? month}/${year}`;
}

// Skeleton row component
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="payroll-runs-page__skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="payroll-runs-page__skeleton-cell">
          <div className="payroll-runs-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function PayrollRunsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('rodadas');

  const currentYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showWizard, setShowWizard] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showCpReview, setShowCpReview] = useState(false);
  const [selectedRunIdForClose, setSelectedRunIdForClose] = useState<string | null>(null);
  const [selectedRunMonthForClose, setSelectedRunMonthForClose] = useState('');
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const initiateButtonRef = useRef<HTMLButtonElement>(null);

  const {
    runs,
    loading: runsLoading,
    error: runsError,
    successMessage: runsSuccess,
    fetchRuns,
    createRun,
    processRun,
    recalculateEmployee,
    closeRun,
    revertRun,
    getRun,
    getPreview,
    downloadPayslips,
    downloadItemPayslip,
  } = usePayrollRuns();

  const {
    advances,
    loading: advancesLoading,
    error: advancesError,
    fetchAdvances,
  } = useSalaryAdvances();

  // Build filter string for API
  const buildMonthFilter = useCallback(() => {
    if (!filterYear) return undefined;
    if (filterMonth) return `${filterYear}-${filterMonth}`;
    return undefined;
  }, [filterYear, filterMonth]);

  useEffect(() => {
    if (activeTab === 'rodadas') {
      fetchRuns({
        month: buildMonthFilter(),
        type: filterType || undefined,
        status: filterStatus || undefined,
      });
    } else {
      fetchAdvances({ month: buildMonthFilter() });
    }
  }, [activeTab, filterMonth, filterYear, filterType, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFechaFolha(run: PayrollRun) {
    setSelectedRunIdForClose(run.id);
    setSelectedRunMonthForClose(run.referenceMonth);
    setShowCpReview(true);
  }

  async function handleCpReviewConfirm() {
    if (!selectedRunIdForClose) return;
    setIsConfirmingClose(true);
    const success = await closeRun(selectedRunIdForClose);
    setIsConfirmingClose(false);
    if (success) {
      setShowCpReview(false);
      setSelectedRunIdForClose(null);
      setSelectedRunMonthForClose('');
      // successMessage from usePayrollRuns is already set; override with plan copy
    }
  }

  async function handleOpenDetail(run: PayrollRun) {
    const full = await getRun(run.id);
    if (full) {
      setSelectedRun(full);
      setShowDetail(true);
    }
  }

  function handleDetailClose() {
    setShowDetail(false);
    setSelectedRun(null);
    fetchRuns({
      month: buildMonthFilter(),
      type: filterType || undefined,
      status: filterStatus || undefined,
    });
  }

  async function handleWizardCreateRun(data: {
    referenceMonth: string;
    runType: import('@/types/payroll-runs').PayrollRunType;
    notes?: string;
  }) {
    return createRun(data);
  }

  function handleWizardSuccess() {
    fetchRuns({
      month: buildMonthFilter(),
      type: filterType || undefined,
      status: filterStatus || undefined,
    });
    // Return focus to initiate button
    setTimeout(() => initiateButtonRef.current?.focus(), 100);
  }

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <main className="payroll-runs-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="payroll-runs-page__breadcrumb" aria-label="Navegação">
        <span className="payroll-runs-page__breadcrumb-item">RH</span>
        <span className="payroll-runs-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="payroll-runs-page__breadcrumb-item payroll-runs-page__breadcrumb-item--current" aria-current="page">
          Folha de Pagamento
        </span>
      </nav>

      {/* Header */}
      <div className="payroll-runs-page__header">
        <h1 className="payroll-runs-page__title">Folha de Pagamento</h1>
        {activeTab === 'rodadas' ? (
          <button
            ref={initiateButtonRef}
            type="button"
            className="payroll-runs-page__cta-btn"
            onClick={() => setShowWizard(true)}
          >
            Iniciar Folha
          </button>
        ) : (
          <button
            type="button"
            className="payroll-runs-page__cta-btn"
            onClick={() => setShowAdvanceModal(true)}
          >
            Registrar Adiantamento
          </button>
        )}
      </div>

      {/* Toast messages */}
      {runsSuccess && (
        <div className="payroll-runs-page__toast payroll-runs-page__toast--success" role="status" aria-live="polite">
          {runsSuccess}
        </div>
      )}
      {(runsError || advancesError) && (
        <div className="payroll-runs-page__toast payroll-runs-page__toast--error" role="alert" aria-live="assertive">
          {runsError ?? advancesError}
        </div>
      )}

      {/* Filter row */}
      <div className="payroll-runs-page__filters">
        <div className="payroll-runs-page__filter-group">
          <label htmlFor="filter-month" className="payroll-runs-page__filter-label">
            Mês
          </label>
          <select
            id="filter-month"
            className="payroll-runs-page__filter-select"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="payroll-runs-page__filter-group">
          <label htmlFor="filter-year" className="payroll-runs-page__filter-label">
            Ano
          </label>
          <select
            id="filter-year"
            className="payroll-runs-page__filter-select"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {activeTab === 'rodadas' && (
          <>
            <div className="payroll-runs-page__filter-group">
              <label htmlFor="filter-type" className="payroll-runs-page__filter-label">
                Tipo
              </label>
              <select
                id="filter-type"
                className="payroll-runs-page__filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {(Object.entries(RUN_TYPE_LABELS) as [string, string][]).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="payroll-runs-page__filter-group">
              <label htmlFor="filter-status" className="payroll-runs-page__filter-label">
                Status
              </label>
              <select
                id="filter-status"
                className="payroll-runs-page__filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                {(Object.entries(RUN_STATUS_LABELS) as [string, string][]).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="payroll-runs-page__tabs" role="tablist" aria-label="Seções da folha de pagamento">
        <button
          role="tab"
          type="button"
          id="tab-rodadas"
          aria-selected={activeTab === 'rodadas'}
          aria-controls="panel-rodadas"
          className={`payroll-runs-page__tab ${activeTab === 'rodadas' ? 'payroll-runs-page__tab--active' : ''}`}
          onClick={() => setActiveTab('rodadas')}
        >
          Rodadas
        </button>
        <button
          role="tab"
          type="button"
          id="tab-adiantamentos"
          aria-selected={activeTab === 'adiantamentos'}
          aria-controls="panel-adiantamentos"
          className={`payroll-runs-page__tab ${activeTab === 'adiantamentos' ? 'payroll-runs-page__tab--active' : ''}`}
          onClick={() => setActiveTab('adiantamentos')}
        >
          Adiantamentos
        </button>
      </div>

      {/* Rodadas tab */}
      {activeTab === 'rodadas' && (
        <section
          id="panel-rodadas"
          role="tabpanel"
          aria-labelledby="tab-rodadas"
          className="payroll-runs-page__panel"
        >
          {/* Desktop table */}
          <div className="payroll-runs-page__table-wrapper">
            <table className="payroll-runs-page__table">
              <caption className="sr-only">Rodadas de folha de pagamento</caption>
              <thead>
                <tr>
                  <th scope="col" className="payroll-runs-page__th">COMPETENCIA</th>
                  <th scope="col" className="payroll-runs-page__th">TIPO</th>
                  <th scope="col" className="payroll-runs-page__th">COLABORADORES</th>
                  <th scope="col" className="payroll-runs-page__th">BRUTO</th>
                  <th scope="col" className="payroll-runs-page__th">ENCARGOS</th>
                  <th scope="col" className="payroll-runs-page__th">LIQUIDO</th>
                  <th scope="col" className="payroll-runs-page__th">STATUS</th>
                  <th scope="col" className="payroll-runs-page__th">ACOES</th>
                </tr>
              </thead>
              <tbody>
                {runsLoading &&
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
                {!runsLoading && runs.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="payroll-runs-page__empty">
                        <FileText size={48} aria-hidden="true" className="payroll-runs-page__empty-icon" />
                        <p className="payroll-runs-page__empty-title">Nenhuma folha processada</p>
                        <p className="payroll-runs-page__empty-desc">
                          Inicie o processamento mensal para gerar os holerites e as Contas a Pagar.
                        </p>
                        <button
                          type="button"
                          className="payroll-runs-page__empty-cta"
                          onClick={() => setShowWizard(true)}
                        >
                          Iniciar Folha
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {!runsLoading &&
                  runs.map((run) => (
                    <tr key={run.id} className="payroll-runs-page__row">
                      <td className="payroll-runs-page__td">{getMonthLabel(run.referenceMonth)}</td>
                      <td className="payroll-runs-page__td">
                        {RUN_TYPE_LABELS[run.runType] ?? run.runType}
                      </td>
                      <td className="payroll-runs-page__td">{run.employeeCount}</td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--mono">
                        {formatCurrency(run.totalGross)}
                      </td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--mono">
                        {formatCurrency(run.totalCharges)}
                      </td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--mono">
                        {formatCurrency(run.totalNet)}
                      </td>
                      <td className="payroll-runs-page__td">
                        <PayrollRunStatusBadge status={run.status} />
                      </td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--actions">
                        <button
                          type="button"
                          className="payroll-runs-page__action-btn"
                          onClick={() => handleOpenDetail(run)}
                          aria-label={`Ver detalhes da folha de ${getMonthLabel(run.referenceMonth)}`}
                          title="Ver detalhes"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="payroll-runs-page__action-btn"
                          onClick={() => downloadPayslips(run.id)}
                          aria-label={`Baixar holerites da folha de ${getMonthLabel(run.referenceMonth)}`}
                          title="Baixar holerites (ZIP)"
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="payroll-runs-page__action-btn"
                          aria-label={`Reenviar holerites da folha de ${getMonthLabel(run.referenceMonth)}`}
                          title="Reenviar holerites por email"
                        >
                          <Mail size={16} aria-hidden="true" />
                        </button>
                        {run.status === 'CALCULATED' && (
                          <button
                            type="button"
                            className="payroll-runs-page__action-btn payroll-runs-page__action-btn--primary"
                            onClick={() => handleFechaFolha(run)}
                            aria-label={`Fechar folha de ${getMonthLabel(run.referenceMonth)}`}
                            title="Fechar folha"
                          >
                            Fechar Folha
                          </button>
                        )}
                        {run.status === 'COMPLETED' && (
                          <button
                            type="button"
                            className="payroll-runs-page__action-btn payroll-runs-page__action-btn--danger"
                            onClick={() => handleOpenDetail(run)}
                            aria-label={`Estornar folha de ${getMonthLabel(run.referenceMonth)}`}
                            title="Estornar folha"
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — shown below 768px */}
          <ul className="payroll-runs-page__mobile-list" role="list">
            {runsLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="payroll-runs-page__mobile-card payroll-runs-page__skeleton-card" aria-hidden="true">
                  <div className="payroll-runs-page__skeleton-pulse payroll-runs-page__skeleton-pulse--wide" />
                  <div className="payroll-runs-page__skeleton-pulse" />
                </li>
              ))}
            {!runsLoading && runs.length === 0 && (
              <li className="payroll-runs-page__mobile-empty">
                <FileText size={48} aria-hidden="true" className="payroll-runs-page__empty-icon" />
                <p className="payroll-runs-page__empty-title">Nenhuma folha processada</p>
                <p className="payroll-runs-page__empty-desc">
                  Inicie o processamento mensal para gerar os holerites.
                </p>
              </li>
            )}
            {!runsLoading &&
              runs.map((run) => (
                <li key={run.id} className="payroll-runs-page__mobile-card">
                  <div className="payroll-runs-page__mobile-card-header">
                    <div className="payroll-runs-page__mobile-card-meta">
                      <span className="payroll-runs-page__mobile-competencia">
                        {getMonthLabel(run.referenceMonth)}
                      </span>
                      <span className="payroll-runs-page__mobile-tipo">
                        {RUN_TYPE_LABELS[run.runType] ?? run.runType}
                      </span>
                    </div>
                    <div className="payroll-runs-page__mobile-card-right">
                      <PayrollRunStatusBadge status={run.status} />
                      <button
                        type="button"
                        className="payroll-runs-page__mobile-expand-btn"
                        onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                        aria-expanded={expandedRunId === run.id}
                        aria-label="Expandir detalhes"
                      >
                        <ChevronDown
                          size={18}
                          aria-hidden="true"
                          className={`payroll-runs-page__chevron${expandedRunId === run.id ? ' payroll-runs-page__chevron--open' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="payroll-runs-page__mobile-card-liquido">
                    {formatCurrency(run.totalNet)}
                  </div>
                  {expandedRunId === run.id && (
                    <div className="payroll-runs-page__mobile-card-expanded">
                      <div className="payroll-runs-page__mobile-card-row">
                        <span>Bruto:</span>
                        <span className="payroll-runs-page__mobile-mono">{formatCurrency(run.totalGross)}</span>
                      </div>
                      <div className="payroll-runs-page__mobile-card-row">
                        <span>Encargos:</span>
                        <span className="payroll-runs-page__mobile-mono">{formatCurrency(run.totalCharges)}</span>
                      </div>
                      <div className="payroll-runs-page__mobile-card-row">
                        <span>Colaboradores:</span>
                        <span>{run.employeeCount}</span>
                      </div>
                      <button
                        type="button"
                        className="payroll-runs-page__mobile-detail-btn"
                        onClick={() => handleOpenDetail(run)}
                      >
                        <Eye size={14} aria-hidden="true" />
                        Ver detalhes
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Adiantamentos tab */}
      {activeTab === 'adiantamentos' && (
        <section
          id="panel-adiantamentos"
          role="tabpanel"
          aria-labelledby="tab-adiantamentos"
          className="payroll-runs-page__panel"
        >
          <div className="payroll-runs-page__table-wrapper">
            <table className="payroll-runs-page__table">
              <caption className="sr-only">Adiantamentos salariais</caption>
              <thead>
                <tr>
                  <th scope="col" className="payroll-runs-page__th">DATA</th>
                  <th scope="col" className="payroll-runs-page__th">COLABORADOR</th>
                  <th scope="col" className="payroll-runs-page__th">COMPETENCIA</th>
                  <th scope="col" className="payroll-runs-page__th">VALOR</th>
                  <th scope="col" className="payroll-runs-page__th">STATUS CP</th>
                  <th scope="col" className="payroll-runs-page__th">ACOES</th>
                </tr>
              </thead>
              <tbody>
                {advancesLoading &&
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
                {!advancesLoading && advances.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="payroll-runs-page__empty">
                        <Wallet size={48} aria-hidden="true" className="payroll-runs-page__empty-icon" />
                        <p className="payroll-runs-page__empty-title">Nenhum adiantamento registrado</p>
                        <p className="payroll-runs-page__empty-desc">
                          Registre um adiantamento individual ou processe o lote do dia 15.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {!advancesLoading &&
                  advances.map((adv: SalaryAdvance) => (
                    <tr key={adv.id} className="payroll-runs-page__row">
                      <td className="payroll-runs-page__td">{formatDate(adv.advanceDate)}</td>
                      <td className="payroll-runs-page__td">{adv.employeeName ?? adv.employeeId}</td>
                      <td className="payroll-runs-page__td">{getMonthLabel(adv.referenceMonth)}</td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--mono">
                        {formatCurrency(adv.amount)}
                      </td>
                      <td className="payroll-runs-page__td">
                        {adv.payableStatus ?? '—'}
                      </td>
                      <td className="payroll-runs-page__td payroll-runs-page__td--actions">
                        <button
                          type="button"
                          className="payroll-runs-page__action-btn"
                          aria-label={`Baixar recibo de adiantamento`}
                          title="Baixar recibo"
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Wizard modal */}
      <PayrollRunWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setTimeout(() => initiateButtonRef.current?.focus(), 100);
        }}
        onCreateRun={handleWizardCreateRun}
        onGetPreview={getPreview}
        onProcessRun={processRun}
        onSuccess={handleWizardSuccess}
      />

      {/* Detail modal */}
      <PayrollRunDetailModal
        isOpen={showDetail}
        run={selectedRun}
        onClose={handleDetailClose}
        onCloseRun={closeRun}
        onRevertRun={revertRun}
        onRecalculateEmployee={recalculateEmployee}
        onDownloadItemPayslip={downloadItemPayslip}
      />

      {/* Salary advance modal */}
      <SalaryAdvanceModal
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        orgId={user?.organizationId ?? ''}
        mode="individual"
        onSuccess={() => {
          setShowAdvanceModal(false);
          fetchAdvances({ month: buildMonthFilter() });
        }}
      />

      {/* CP Review modal — pre-close review before confirming payroll close */}
      <PayrollCpReviewModal
        isOpen={showCpReview}
        onClose={() => {
          setShowCpReview(false);
          setSelectedRunIdForClose(null);
          setSelectedRunMonthForClose('');
        }}
        runId={selectedRunIdForClose}
        referenceMonth={selectedRunMonthForClose}
        onConfirmClose={handleCpReviewConfirm}
        isConfirming={isConfirmingClose}
      />
    </main>
  );
}
