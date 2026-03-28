import { useState, useEffect } from 'react';
import { FileText, Download, Mail, AlertTriangle, CheckCircle, Info, Search } from 'lucide-react';
import { useIncomeStatements } from '@/hooks/useIncomeStatements';
import type { IncomeStatement } from '@/types/income-statement';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: string | null | undefined): string {
  if (!value) return 'R$ 0,00';
  const n = parseFloat(value);
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="income-statements-page__skeleton-cell">
          <div className="income-statements-page__skeleton-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ─── Generate Modal ───────────────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void;
  onSubmit: (yearBase: number) => Promise<void>;
}

function GenerateModal({ onClose, onSubmit }: GenerateModalProps) {
  const [yearBase, setYearBase] = useState(getCurrentYear() - 1);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(yearBase);
    setSubmitting(false);
    onClose();
  }

  return (
    <div
      className="income-statements-page__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-stmt-modal-title"
    >
      <div className="income-statements-page__modal">
        <header className="income-statements-page__modal-header">
          <h2 id="generate-stmt-modal-title" className="income-statements-page__modal-title">
            Gerar Informes de Rendimentos
          </h2>
          <button
            type="button"
            className="income-statements-page__modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            &times;
          </button>
        </header>
        <form onSubmit={handleSubmit} className="income-statements-page__modal-body">
          <div className="income-statements-page__form-group">
            <label htmlFor="gen-year-base" className="income-statements-page__label">
              Ano-Base <span aria-hidden="true">*</span>
            </label>
            <input
              id="gen-year-base"
              type="number"
              value={yearBase}
              onChange={(e) => setYearBase(parseInt(e.target.value, 10))}
              min={2020}
              max={getCurrentYear()}
              required
              aria-required="true"
              className="income-statements-page__input"
            />
          </div>
          <footer className="income-statements-page__modal-footer">
            <button
              type="button"
              className="income-statements-page__btn income-statements-page__btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="income-statements-page__btn income-statements-page__btn--primary"
            >
              {submitting ? 'Gerando...' : 'Gerar Informes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ─── RAIS Banner ──────────────────────────────────────────────────────────────

interface RaisBannerProps {
  yearBase: number;
  onCheckConsistency: () => void;
  consistency: {
    loaded: boolean;
    isConsistent: boolean;
    totalEmployees: number;
    employeesWithAdmission: number;
    employeesWithRemuneration: number;
    employeesWithTermination: number;
    missingAdmissionEvents: string[];
    missingRemunerationEvents: string[];
  } | null;
  checking: boolean;
}

function RaisBanner({
  yearBase,
  onCheckConsistency,
  consistency,
  checking,
}: RaisBannerProps) {
  return (
    <section
      className="income-statements-page__rais-banner"
      aria-label="Informacoes sobre a RAIS"
    >
      <div className="income-statements-page__rais-banner-header">
        <Info size={16} aria-hidden="true" className="income-statements-page__icon--info" />
        <p className="income-statements-page__rais-banner-text">
          <strong>RAIS substituida pelo eSocial desde 2023.</strong> Use o relatorio de
          consistencia abaixo para verificar se todos os eventos foram gerados corretamente para o
          ano-base {yearBase}.
        </p>
        <button
          type="button"
          className="income-statements-page__btn income-statements-page__btn--outline"
          onClick={onCheckConsistency}
          disabled={checking}
          aria-label={`Verificar consistencia dos eventos eSocial para ${yearBase}`}
        >
          <Search size={14} aria-hidden="true" />
          {checking ? 'Verificando...' : 'Verificar Consistencia'}
        </button>
      </div>

      {consistency && consistency.loaded && (
        <div
          className={`income-statements-page__rais-result${consistency.isConsistent ? ' income-statements-page__rais-result--ok' : ' income-statements-page__rais-result--warn'}`}
          role="alert"
          aria-live="polite"
        >
          {consistency.isConsistent ? (
            <div className="income-statements-page__rais-ok">
              <CheckCircle size={16} aria-hidden="true" />
              <span>
                Consistencia OK — {consistency.totalEmployees} colaboradores,{' '}
                {consistency.employeesWithAdmission} admissoes,{' '}
                {consistency.employeesWithRemuneration} remuneracoes,{' '}
                {consistency.employeesWithTermination} desligamentos no eSocial.
              </span>
            </div>
          ) : (
            <div className="income-statements-page__rais-warn">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <p>
                  <strong>Inconsistencias encontradas.</strong>{' '}
                  {consistency.totalEmployees} colaboradores verificados.
                </p>
                {consistency.missingAdmissionEvents.length > 0 && (
                  <p>
                    <strong>Sem S-2200 (admissao):</strong>{' '}
                    {consistency.missingAdmissionEvents.join(', ')}
                  </p>
                )}
                {consistency.missingRemunerationEvents.length > 0 && (
                  <p>
                    <strong>Sem S-1200 (remuneracao):</strong>{' '}
                    {consistency.missingRemunerationEvents.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncomeStatementsPage() {
  const {
    statements,
    raisConsistency,
    loading,
    error,
    successMessage,
    fetchStatements,
    generateStatements,
    downloadStatement,
    sendStatements,
    fetchRaisConsistency,
  } = useIncomeStatements();

  const [yearBase, setYearBase] = useState(getCurrentYear() - 1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [checkingRais, setCheckingRais] = useState(false);
  const [raisLoaded, setRaisLoaded] = useState(false);

  useEffect(() => {
    void fetchStatements(yearBase);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRaisLoaded(false);
  }, [yearBase, fetchStatements]);

  async function handleGenerate(year: number) {
    const ok = await generateStatements({ yearBase: year });
    if (ok) {
      void fetchStatements(yearBase);
    }
  }

  async function handleCheckRais() {
    setCheckingRais(true);
    await fetchRaisConsistency(yearBase);
    setRaisLoaded(true);
    setCheckingRais(false);
  }

  async function handleSendAll() {
    await sendStatements({ yearBase });
    void fetchStatements(yearBase);
  }

  async function handleSendSingle(stmt: IncomeStatement) {
    await sendStatements({ yearBase: stmt.yearBase, employeeIds: [stmt.employeeId] });
    void fetchStatements(yearBase);
  }

  const consistencyForBanner = raisLoaded && raisConsistency
    ? {
        loaded: true,
        isConsistent: raisConsistency.isConsistent,
        totalEmployees: raisConsistency.totalEmployees,
        employeesWithAdmission: raisConsistency.employeesWithAdmission,
        employeesWithRemuneration: raisConsistency.employeesWithRemuneration,
        employeesWithTermination: raisConsistency.employeesWithTermination,
        missingAdmissionEvents: raisConsistency.missingAdmissionEvents,
        missingRemunerationEvents: raisConsistency.missingRemunerationEvents,
      }
    : null;

  return (
    <main className="income-statements-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="income-statements-page__breadcrumb">
        <ol>
          <li>Obrigacoes Acessorias</li>
          <li aria-current="page">Informes de Rendimentos</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="income-statements-page__header">
        <h1 className="income-statements-page__title">Informes de Rendimentos</h1>
        <div className="income-statements-page__header-actions">
          <button
            type="button"
            className="income-statements-page__btn income-statements-page__btn--secondary"
            onClick={handleSendAll}
            disabled={loading || statements.length === 0}
            aria-label={`Enviar todos os informes do ano ${yearBase} por email`}
          >
            <Mail size={16} aria-hidden="true" />
            Enviar por Email
          </button>
          <button
            type="button"
            className="income-statements-page__btn income-statements-page__btn--primary"
            onClick={() => setShowGenerateModal(true)}
          >
            <FileText size={16} aria-hidden="true" />
            Gerar Informes
          </button>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div
          className="income-statements-page__alert income-statements-page__alert--error"
          role="alert"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </div>
      )}
      {successMessage && (
        <div
          className="income-statements-page__alert income-statements-page__alert--success"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {/* Year selector */}
      <section className="income-statements-page__filters" aria-label="Filtros">
        <div className="income-statements-page__form-group">
          <label htmlFor="year-base-filter" className="income-statements-page__label">
            Ano-Base
          </label>
          <input
            id="year-base-filter"
            type="number"
            value={yearBase}
            onChange={(e) => setYearBase(parseInt(e.target.value, 10))}
            min={2000}
            max={getCurrentYear()}
            className="income-statements-page__input income-statements-page__input--year"
          />
        </div>
      </section>

      {/* RAIS Banner (per D-15) */}
      <RaisBanner
        yearBase={yearBase}
        onCheckConsistency={handleCheckRais}
        consistency={consistencyForBanner}
        checking={checkingRais}
      />

      {/* Statements Table */}
      <section className="income-statements-page__table-section" aria-label="Informes de rendimentos">
        <div className="income-statements-page__table-wrapper">
          <table
            className="income-statements-page__table"
            aria-label={`Informes de rendimentos ${yearBase}`}
          >
            <thead>
              <tr>
                <th scope="col">COLABORADOR</th>
                <th scope="col">CPF</th>
                <th scope="col">ANO-BASE</th>
                <th scope="col">TRIBUTAVEL</th>
                <th scope="col">INSS</th>
                <th scope="col">IRRF</th>
                <th scope="col">ISENTOS</th>
                <th scope="col">ENVIADO</th>
                <th scope="col">ACOES</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                : statements.map((stmt) => (
                    <tr key={stmt.id}>
                      <td className="income-statements-page__employee-name">
                        {stmt.employeeName}
                      </td>
                      <td className="income-statements-page__mono">{formatCpf(stmt.employeeCpf)}</td>
                      <td>{stmt.yearBase}</td>
                      <td className="income-statements-page__currency">
                        {formatCurrency(stmt.totalTaxable)}
                      </td>
                      <td className="income-statements-page__currency">
                        {formatCurrency(stmt.totalInss)}
                      </td>
                      <td className="income-statements-page__currency">
                        {formatCurrency(stmt.totalIrrf)}
                      </td>
                      <td className="income-statements-page__currency">
                        {formatCurrency(stmt.totalExempt)}
                      </td>
                      <td>{formatDate(stmt.sentAt)}</td>
                      <td className="income-statements-page__actions">
                        <button
                          type="button"
                          className="income-statements-page__action-btn"
                          onClick={() => downloadStatement(stmt.id, stmt.employeeName, stmt.yearBase)}
                          aria-label={`Baixar informe de ${stmt.employeeName}`}
                          title="Baixar PDF"
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="income-statements-page__action-btn"
                          onClick={() => handleSendSingle(stmt)}
                          aria-label={`Enviar informe de ${stmt.employeeName} por email`}
                          title="Enviar por email"
                        >
                          <Mail size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && statements.length === 0 && (
            <div className="income-statements-page__empty" role="status">
              <FileText
                size={48}
                aria-hidden="true"
                className="income-statements-page__empty-icon"
              />
              <p className="income-statements-page__empty-title">Nenhum informe gerado</p>
              <p className="income-statements-page__empty-desc">
                Gere os informes a partir das folhas do ano-base {yearBase}
              </p>
              <button
                type="button"
                className="income-statements-page__btn income-statements-page__btn--primary"
                onClick={() => setShowGenerateModal(true)}
              >
                <FileText size={16} aria-hidden="true" />
                Gerar Informes
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateModal
          onClose={() => setShowGenerateModal(false)}
          onSubmit={handleGenerate}
        />
      )}
    </main>
  );
}
