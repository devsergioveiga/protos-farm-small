import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserMinus,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
} from 'lucide-react';
import { useEmployeeTerminations } from '@/hooks/useEmployeeTerminations';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  EmployeeTermination,
  CreateTerminationInput,
  TerminationType,
} from '@/types/termination';
import { TERMINATION_TYPE_LABELS, TERMINATION_STATUS_LABELS } from '@/types/termination';
import './EmployeeTerminationsPage.css';

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function daysUntilDeadline(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="term-page__skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="term-page__skeleton-cell" />
        </td>
      ))}
    </tr>
  );
}

type WizardStep = 1 | 2 | 3;

type NoticePeriodType = 'TRABALHADO' | 'INDENIZADO' | 'DISPENSADO';

interface WizardState {
  employeeId: string;
  employeeName: string;
  terminationType: TerminationType | '';
  terminationDate: string;
  noticePeriodType: NoticePeriodType | '';
}

interface WizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  processTermination: (data: CreateTerminationInput) => Promise<EmployeeTermination | null>;
  confirmTermination: (id: string) => Promise<boolean>;
}

function EmployeeTerminationModal({
  isOpen,
  onClose,
  onSuccess,
  processTermination,
  confirmTermination,
}: WizardModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardState>({
    employeeId: '',
    employeeName: '',
    terminationType: '',
    terminationDate: '',
    noticePeriodType: '',
  });
  const [calculatedTermination, setCalculatedTermination] = useState<EmployeeTermination | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setFormData({
        employeeId: '',
        employeeName: '',
        terminationType: '',
        terminationDate: '',
        noticePeriodType: '',
      });
      setCalculatedTermination(null);
      setError(null);
      setShowConfirm(false);
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

  const handleStep1Next = async () => {
    if (
      !formData.employeeId ||
      !formData.terminationType ||
      !formData.terminationDate ||
      !formData.noticePeriodType
    ) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await processTermination({
      employeeId: formData.employeeId,
      terminationType: formData.terminationType,
      terminationDate: formData.terminationDate,
      noticePeriodType: formData.noticePeriodType,
    });
    setIsLoading(false);
    if (result) {
      setCalculatedTermination(result);
      setStep(2);
    } else {
      setError('Não foi possível calcular a rescisão. Verifique os dados e tente novamente.');
    }
  };

  const handleStep2Next = () => {
    setStep(3);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!calculatedTermination) return;
    setIsLoading(true);
    const ok = await confirmTermination(calculatedTermination.id);
    setIsLoading(false);
    if (ok) {
      onSuccess();
      onClose();
    }
  };

  const getFgtsPenaltyLabel = (termination: EmployeeTermination): string => {
    if (termination.terminationType === 'WITHOUT_CAUSE') return 'Multa FGTS 40%';
    if (termination.terminationType === 'MUTUAL_AGREEMENT') return 'Multa FGTS 20%';
    return 'Sem multa FGTS';
  };

  if (!isOpen) return null;

  return (
    <div
      className="term-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-modal-title"
    >
      <div className="term-modal">
        {/* Header */}
        <div className="term-modal__header">
          <div className="term-modal__stepper" aria-label="Etapas do processo">
            {([1, 2, 3] as WizardStep[]).map((s) => (
              <div
                key={s}
                className={`term-modal__step ${step >= s ? 'term-modal__step--active' : ''} ${step > s ? 'term-modal__step--done' : ''}`}
              >
                <span className="term-modal__step-num">{s}</span>
                <span className="term-modal__step-label">
                  {s === 1
                    ? 'Dados da Rescisao'
                    : s === 2
                      ? 'Conferir Calculo'
                      : 'Confirmar e Gerar TRCT'}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="term-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="term-modal__body">
          <h2 id="term-modal-title" className="term-modal__title">
            {step === 1
              ? 'Dados da Rescisao'
              : step === 2
                ? 'Conferir Calculo'
                : 'Confirmar e Gerar TRCT'}
          </h2>

          {error && (
            <div className="term-modal__error" role="alert" aria-live="polite">
              <TriangleAlert size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="term-modal__form">
              <div className="term-modal__field">
                <label htmlFor="term-employee-id" className="term-modal__label">
                  ID do Colaborador <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="term-employee-id"
                  type="text"
                  className="term-modal__input"
                  value={formData.employeeId}
                  onChange={(e) => setFormData((p) => ({ ...p, employeeId: e.target.value }))}
                  placeholder="UUID do colaborador ativo"
                  aria-required="true"
                />
                <p className="term-modal__hint">Somente colaboradores com status ATIVO</p>
              </div>

              <div className="term-modal__field">
                <label htmlFor="term-employee-name" className="term-modal__label">
                  Nome do Colaborador
                </label>
                <input
                  id="term-employee-name"
                  type="text"
                  className="term-modal__input"
                  value={formData.employeeName}
                  onChange={(e) => setFormData((p) => ({ ...p, employeeName: e.target.value }))}
                  placeholder="Nome para referência"
                />
              </div>

              <div className="term-modal__field">
                <label htmlFor="term-type" className="term-modal__label">
                  Tipo de Rescisao <span aria-hidden="true">*</span>
                </label>
                <select
                  id="term-type"
                  className="term-modal__select"
                  value={formData.terminationType}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      terminationType: e.target.value as TerminationType,
                    }))
                  }
                  aria-required="true"
                >
                  <option value="">Selecione o tipo</option>
                  {(Object.entries(TERMINATION_TYPE_LABELS) as [TerminationType, string][]).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="term-modal__field">
                <label htmlFor="term-date" className="term-modal__label">
                  Data da Rescisao <span aria-hidden="true">*</span>
                </label>
                <input
                  id="term-date"
                  type="date"
                  className="term-modal__input"
                  value={formData.terminationDate}
                  onChange={(e) => setFormData((p) => ({ ...p, terminationDate: e.target.value }))}
                  aria-required="true"
                />
              </div>

              <div className="term-modal__field">
                <label htmlFor="term-notice-type" className="term-modal__label">
                  Tipo de Aviso Previo <span aria-hidden="true">*</span>
                </label>
                <select
                  id="term-notice-type"
                  className="term-modal__select"
                  value={formData.noticePeriodType}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      noticePeriodType: e.target.value as NoticePeriodType,
                    }))
                  }
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  <option value="TRABALHADO">Trabalhado</option>
                  <option value="INDENIZADO">Indenizado</option>
                  <option value="DISPENSADO">Dispensado</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2 — Read-only calculation breakdown */}
          {step === 2 && calculatedTermination && (
            <div className="term-modal__calc">
              <p className="term-modal__calc-intro">
                Confira os valores calculados antes de confirmar a rescisao de{' '}
                <strong>
                  {calculatedTermination.employeeName || formData.employeeName || 'colaborador'}
                </strong>
                .
              </p>
              <table className="term-modal__calc-table">
                <caption className="sr-only">Detalhamento do calculo de rescisao</caption>
                <thead>
                  <tr>
                    <th scope="col" className="term-modal__calc-col-rubrica">
                      Rubrica
                    </th>
                    <th scope="col" className="term-modal__calc-col-valor">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Saldo de Salario</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.balanceSalary)}
                    </td>
                  </tr>
                  <tr>
                    <td>Aviso Previo ({calculatedTermination.noticePeriodDays} dias)</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.noticePay)}
                    </td>
                  </tr>
                  <tr>
                    <td>13o Proporcional</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.thirteenthProp)}
                    </td>
                  </tr>
                  <tr>
                    <td>Ferias Vencidas + 1/3</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.vacationVested)}
                    </td>
                  </tr>
                  <tr>
                    <td>Ferias Proporcionais + 1/3</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.vacationProp)}
                    </td>
                  </tr>
                  <tr>
                    <td>{getFgtsPenaltyLabel(calculatedTermination)}</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.fgtsPenalty)}
                    </td>
                  </tr>
                  <tr className="term-modal__calc-subtotal">
                    <td>Total Bruto</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.totalGross)}
                    </td>
                  </tr>
                  <tr>
                    <td>INSS</td>
                    <td className="term-modal__calc-value term-modal__calc-value--deduction">
                      {calculatedTermination.inssAmount
                        ? `- ${formatCurrency(calculatedTermination.inssAmount)}`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>IRRF</td>
                    <td className="term-modal__calc-value term-modal__calc-value--deduction">
                      {calculatedTermination.irrfAmount
                        ? `- ${formatCurrency(calculatedTermination.irrfAmount)}`
                        : '—'}
                    </td>
                  </tr>
                  <tr className="term-modal__calc-total">
                    <td>Total Liquido</td>
                    <td className="term-modal__calc-value">
                      {formatCurrency(calculatedTermination.totalNet)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="term-modal__calc-deadline">
                Prazo de pagamento:{' '}
                <strong>{formatDate(calculatedTermination.paymentDeadline)}</strong>
              </p>
            </div>
          )}

          {/* Step 3 — Danger confirmation */}
          {step === 3 && (
            <div className="term-modal__confirm-step">
              <p className="term-modal__confirm-text">
                Revise todas as informações antes de confirmar. Esta ação iniciará o processo de
                rescisão e bloqueará o contrato do colaborador.
              </p>
              {showConfirm && (
                <ConfirmModal
                  isOpen={showConfirm}
                  title="Confirmar Rescisao"
                  message="Iniciar a rescisao bloqueia o contrato do colaborador. Confirme apenas apos revisar todos os dados."
                  confirmLabel="Confirmar Rescisao"
                  cancelLabel="Voltar"
                  variant="danger"
                  isLoading={isLoading}
                  onConfirm={handleConfirm}
                  onCancel={() => {
                    setShowConfirm(false);
                    setStep(2);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="term-modal__footer">
          {step === 1 && (
            <>
              <button type="button" className="term-modal__btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="term-modal__btn-primary"
                onClick={handleStep1Next}
                disabled={isLoading}
              >
                {isLoading ? 'Calculando...' : 'Proximo'}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button
                type="button"
                className="term-modal__btn-secondary"
                onClick={() => setStep(1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Voltar
              </button>
              <button type="button" className="term-modal__btn-danger" onClick={handleStep2Next}>
                Confirmar Rescisao
              </button>
            </>
          )}
          {step === 3 && !showConfirm && (
            <button type="button" className="term-modal__btn-secondary" onClick={() => setStep(2)}>
              <ChevronLeft size={16} aria-hidden="true" />
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const EmployeeTerminationsPage = () => {
  const {
    terminations,
    loading,
    error,
    successMessage,
    fetchTerminations,
    processTermination,
    confirmTermination,
    markAsPaid,
    getTrctPdf,
    getGrrfPdf,
  } = useEmployeeTerminations();

  const [showModal, setShowModal] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(() => {
    fetchTerminations({
      employeeSearch: filterSearch.length >= 2 ? filterSearch : undefined,
      terminationType: filterType || undefined,
      status: filterStatus || undefined,
    });
  }, [fetchTerminations, filterSearch, filterType, filterStatus]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doFetch, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [doFetch]);

  useEffect(() => {
    if (successMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast({ message: successMessage, type: 'success' });
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast({ message: error, type: 'error' });
    }
  }, [error]);

  const handleSuccess = () => {
    setToast({ message: 'Rescisao processada. TRCT disponivel para download.', type: 'success' });
    const t = setTimeout(() => setToast(null), 5000);
    doFetch();
    return () => clearTimeout(t);
  };

  const handleConfirmTermination = async (id: string) => {
    await confirmTermination(id);
    doFetch();
  };

  const handleMarkAsPaid = async (id: string) => {
    await markAsPaid(id);
    doFetch();
  };

  const getDeadlineBadge = (deadline: string) => {
    const days = daysUntilDeadline(deadline);
    if (days < 0) {
      return (
        <span
          className="term-page__deadline-badge term-page__deadline-badge--overdue"
          role="status"
        >
          <TriangleAlert size={12} aria-hidden="true" />
          Prazo vencido em {formatDate(deadline)}
        </span>
      );
    }
    if (days <= 3) {
      return (
        <span
          className="term-page__deadline-badge term-page__deadline-badge--warning"
          role="status"
        >
          <TriangleAlert size={12} aria-hidden="true" />
          Pagar ate {formatDate(deadline)}
        </span>
      );
    }
    return <span className="term-page__deadline-normal">{formatDate(deadline)}</span>;
  };

  const getStatusBadge = (status: EmployeeTermination['status']) => {
    const labels: Record<string, { label: string; cls: string }> = {
      DRAFT: { label: 'RASCUNHO', cls: 'term-page__badge--draft' },
      PROCESSED: { label: 'PROCESSADO', cls: 'term-page__badge--processed' },
      PAID: { label: 'PAGO', cls: 'term-page__badge--paid' },
    };
    const cfg = labels[status] ?? { label: status, cls: '' };
    return (
      <span
        className={`term-page__badge ${cfg.cls}`}
        aria-label={`Status: ${TERMINATION_STATUS_LABELS[status] ?? status}`}
      >
        {cfg.label}
      </span>
    );
  };

  return (
    <main className="term-page" id="main-content">
      {/* Toast */}
      {toast && (
        <div
          className={`term-page__toast ${toast.type === 'error' ? 'term-page__toast--error' : 'term-page__toast--success'}`}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="term-page__breadcrumb" aria-label="Localização na aplicação">
        <span className="term-page__breadcrumb-item">RH</span>
        <span className="term-page__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="term-page__breadcrumb-item term-page__breadcrumb-item--current">
          Rescisoes
        </span>
      </nav>

      {/* Page Header */}
      <header className="term-page__header">
        <h1 className="term-page__title">Rescisoes</h1>
        <button type="button" className="term-page__cta-btn" onClick={() => setShowModal(true)}>
          <UserMinus size={20} aria-hidden="true" />
          Iniciar Rescisao
        </button>
      </header>

      {/* Filter Bar */}
      <section className="term-page__filters" aria-label="Filtros">
        <div className="term-page__filter-group">
          <label htmlFor="term-filter-search" className="term-page__filter-label">
            Colaborador
          </label>
          <input
            id="term-filter-search"
            type="search"
            className="term-page__filter-input"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Buscar colaborador..."
            aria-label="Buscar por colaborador"
          />
        </div>
        <div className="term-page__filter-group">
          <label htmlFor="term-filter-type" className="term-page__filter-label">
            Tipo
          </label>
          <select
            id="term-filter-type"
            className="term-page__filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {(Object.entries(TERMINATION_TYPE_LABELS) as [TerminationType, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="term-page__filter-group">
          <label htmlFor="term-filter-status" className="term-page__filter-label">
            Status
          </label>
          <select
            id="term-filter-status"
            className="term-page__filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="PROCESSED">Processado</option>
            <option value="PAID">Pago</option>
          </select>
        </div>
      </section>

      {/* Table */}
      <section className="term-page__table-section">
        {loading ? (
          <table className="term-page__table">
            <caption className="sr-only">Carregando rescisoes...</caption>
            <thead>
              <tr>
                {[
                  'Colaborador',
                  'Tipo Rescisao',
                  'Data Rescisao',
                  'Aviso Previo',
                  'Saldo Salario',
                  'Total Bruto',
                  'Total Liquido',
                  'Prazo Pagamento',
                  'Status',
                  'Acoes',
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={10} />
              ))}
            </tbody>
          </table>
        ) : terminations.length === 0 ? (
          <div className="term-page__empty">
            <UserMinus size={48} aria-hidden="true" className="term-page__empty-icon" />
            <h2 className="term-page__empty-title">Nenhuma rescisao registrada</h2>
            <p className="term-page__empty-body">
              Ao iniciar uma rescisao, o sistema calcula automaticamente todos os direitos
              trabalhistas e gera o TRCT.
            </p>
            <button type="button" className="term-page__cta-btn" onClick={() => setShowModal(true)}>
              <UserMinus size={20} aria-hidden="true" />
              Iniciar Rescisao
            </button>
          </div>
        ) : (
          <table className="term-page__table">
            <caption className="sr-only">Lista de rescisoes de colaboradores</caption>
            <thead>
              <tr>
                <th scope="col">Colaborador</th>
                <th scope="col">Tipo Rescisao</th>
                <th scope="col">Data Rescisao</th>
                <th scope="col">Aviso Previo</th>
                <th scope="col" className="term-page__col-numeric">
                  Saldo Salario
                </th>
                <th scope="col" className="term-page__col-numeric">
                  Total Bruto
                </th>
                <th scope="col" className="term-page__col-numeric">
                  Total Liquido
                </th>
                <th scope="col">Prazo Pagamento</th>
                <th scope="col">Status</th>
                <th scope="col">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {terminations.map((t) => (
                <tr key={t.id} className="term-page__row">
                  <td className="term-page__employee-name">{t.employeeName}</td>
                  <td>{TERMINATION_TYPE_LABELS[t.terminationType] ?? t.terminationType}</td>
                  <td>{formatDate(t.terminationDate)}</td>
                  <td>{t.noticePeriodDays} dias</td>
                  <td className="term-page__col-numeric">{formatCurrency(t.balanceSalary)}</td>
                  <td className="term-page__col-numeric">{formatCurrency(t.totalGross)}</td>
                  <td className="term-page__col-numeric term-page__total-net">
                    {formatCurrency(t.totalNet)}
                  </td>
                  <td>{getDeadlineBadge(t.paymentDeadline)}</td>
                  <td>{getStatusBadge(t.status)}</td>
                  <td className="term-page__actions">
                    {t.status === 'DRAFT' && (
                      <>
                        <button
                          type="button"
                          className="term-page__action-btn"
                          onClick={() => handleConfirmTermination(t.id)}
                        >
                          Confirmar
                        </button>
                      </>
                    )}
                    {t.status === 'PROCESSED' && (
                      <>
                        <button
                          type="button"
                          className="term-page__action-btn"
                          onClick={() => handleMarkAsPaid(t.id)}
                        >
                          Pagar
                        </button>
                        <button
                          type="button"
                          className="term-page__action-btn term-page__action-btn--icon"
                          onClick={() => getTrctPdf(t.id, t.employeeName)}
                          aria-label={`Baixar TRCT de ${t.employeeName}`}
                        >
                          <FileText size={16} aria-hidden="true" />
                          TRCT
                        </button>
                        <button
                          type="button"
                          className="term-page__action-btn term-page__action-btn--icon"
                          onClick={() => getGrrfPdf(t.id, t.employeeName)}
                          aria-label={`Baixar GRRF de ${t.employeeName}`}
                        >
                          <Download size={16} aria-hidden="true" />
                          GRRF
                        </button>
                      </>
                    )}
                    {t.status === 'PAID' && (
                      <>
                        <button
                          type="button"
                          className="term-page__action-btn term-page__action-btn--icon"
                          onClick={() => getTrctPdf(t.id, t.employeeName)}
                          aria-label={`Baixar TRCT de ${t.employeeName}`}
                        >
                          <FileText size={16} aria-hidden="true" />
                          TRCT
                        </button>
                        <button
                          type="button"
                          className="term-page__action-btn term-page__action-btn--icon"
                          onClick={() => getGrrfPdf(t.id, t.employeeName)}
                          aria-label={`Baixar GRRF de ${t.employeeName}`}
                        >
                          <Download size={16} aria-hidden="true" />
                          GRRF
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 3-Step Wizard Modal */}
      <EmployeeTerminationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        processTermination={processTermination}
        confirmTermination={confirmTermination}
      />
    </main>
  );
};

export default EmployeeTerminationsPage;
