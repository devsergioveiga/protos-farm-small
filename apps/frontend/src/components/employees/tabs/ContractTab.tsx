import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, FilePlus, FileEdit } from 'lucide-react';
import type { EmployeeContract } from '@/types/employee-contract';
import { CONTRACT_TYPE_LABELS } from '@/types/employee-contract';

interface ContractTabProps {
  employeeId: string;
  contracts: EmployeeContract[];
  isLoading: boolean;
  onNewContract?: () => void;
  onAmendment?: (contractId: string) => void;
  onDownloadPdf?: (contractId: string) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function ContractCard({
  contract,
  isActive,
  onAmendment,
  onDownloadPdf,
}: {
  contract: EmployeeContract;
  isActive: boolean;
  onAmendment?: (id: string) => void;
  onDownloadPdf?: (id: string) => void;
}) {
  const [amendmentsOpen, setAmendmentsOpen] = useState(false);
  const amendments = contract.amendments ?? [];

  return (
    <article
      className={`employee-detail__contract-card ${isActive ? 'employee-detail__contract-card--active' : ''}`}
    >
      <div className="employee-detail__contract-header">
        <div>
          <span className="employee-detail__contract-type">
            {CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType}
          </span>
          {isActive && (
            <span className="employee-detail__badge employee-detail__badge--green">Vigente</span>
          )}
        </div>
        <div className="employee-detail__contract-actions">
          {isActive && onAmendment && (
            <button
              type="button"
              className="employee-detail__btn-secondary"
              onClick={() => onAmendment(contract.id)}
            >
              <FileEdit size={16} aria-hidden="true" />
              Aditivo
            </button>
          )}
          {onDownloadPdf && (
            <button
              type="button"
              className="employee-detail__btn-secondary"
              onClick={() => onDownloadPdf(contract.id)}
            >
              <FileText size={16} aria-hidden="true" />
              Baixar PDF
            </button>
          )}
        </div>
      </div>

      <dl className="employee-detail__grid">
        <div className="employee-detail__field">
          <dt className="employee-detail__field-label">Salário</dt>
          <dd
            className="employee-detail__field-value employee-detail__field-value--mono"
            style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}
          >
            {formatBRL(contract.salary)}
          </dd>
        </div>
        <div className="employee-detail__field">
          <dt className="employee-detail__field-label">Início</dt>
          <dd className="employee-detail__field-value">{formatDate(contract.startDate)}</dd>
        </div>
        {contract.endDate && (
          <div className="employee-detail__field">
            <dt className="employee-detail__field-label">Término</dt>
            <dd className="employee-detail__field-value">{formatDate(contract.endDate)}</dd>
          </div>
        )}
        <div className="employee-detail__field">
          <dt className="employee-detail__field-label">Horas semanais</dt>
          <dd className="employee-detail__field-value">{contract.weeklyHours}h/semana</dd>
        </div>
        {contract.workSchedule && (
          <div className="employee-detail__field">
            <dt className="employee-detail__field-label">Escala</dt>
            <dd className="employee-detail__field-value">{contract.workSchedule.name}</dd>
          </div>
        )}
        {contract.union && (
          <div className="employee-detail__field">
            <dt className="employee-detail__field-label">Sindicato</dt>
            <dd className="employee-detail__field-value">{contract.union}</dd>
          </div>
        )}
      </dl>

      {amendments.length > 0 && (
        <div className="employee-detail__amendments">
          <button
            type="button"
            className="employee-detail__amendments-toggle"
            onClick={() => setAmendmentsOpen((v) => !v)}
            aria-expanded={amendmentsOpen}
          >
            {amendmentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {amendments.length} {amendments.length === 1 ? 'aditivo' : 'aditivos'}
          </button>

          {amendmentsOpen && (
            <ol className="employee-detail__amendments-list">
              {amendments.map((am) => (
                <li key={am.id} className="employee-detail__amendment-item">
                  <div className="employee-detail__amendment-date">
                    {formatDate(am.effectiveAt)}
                  </div>
                  <div className="employee-detail__amendment-desc">{am.description}</div>
                  {Object.entries(am.changes).length > 0 && (
                    <ul className="employee-detail__amendment-changes">
                      {Object.entries(am.changes).map(([field, change]) => (
                        <li key={field}>
                          <strong>{field}:</strong> {String(change.from)} → {String(change.to)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}

export default function ContractTab({
  employeeId: _employeeId,
  contracts,
  isLoading,
  onNewContract,
  onAmendment,
  onDownloadPdf,
}: ContractTabProps) {
  const activeContracts = contracts.filter((c) => c.isActive);
  const inactiveContracts = contracts.filter((c) => !c.isActive);
  const [showInactive, setShowInactive] = useState(false);

  if (isLoading) {
    return (
      <div className="employee-detail__tab-content">
        <div className="employee-detail__skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="employee-detail__tab-content">
      <div className="employee-detail__section-header" style={{ marginBottom: 16 }}>
        <h3 className="employee-detail__section-title" style={{ margin: 0 }}>
          Contratos
        </h3>
        {onNewContract && (
          <button type="button" className="employee-detail__btn-primary" onClick={onNewContract}>
            <FilePlus size={16} aria-hidden="true" />
            Novo contrato
          </button>
        )}
      </div>

      {activeContracts.length === 0 && inactiveContracts.length === 0 ? (
        <div className="employee-detail__empty-state">
          <FileText size={48} aria-hidden="true" color="var(--color-neutral-400)" />
          <p className="employee-detail__empty-title">Nenhum contrato cadastrado.</p>
          <p className="employee-detail__empty-desc">
            Adicione o primeiro contrato deste colaborador.
          </p>
        </div>
      ) : (
        <>
          {activeContracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              isActive={true}
              onAmendment={onAmendment}
              onDownloadPdf={onDownloadPdf}
            />
          ))}

          {inactiveContracts.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="employee-detail__btn-ghost"
                onClick={() => setShowInactive((v) => !v)}
                aria-expanded={showInactive}
              >
                {showInactive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {inactiveContracts.length}{' '}
                {inactiveContracts.length === 1 ? 'contrato anterior' : 'contratos anteriores'}
              </button>

              {showInactive && (
                <div style={{ marginTop: 12 }}>
                  {inactiveContracts.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      isActive={false}
                      onDownloadPdf={onDownloadPdf}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
