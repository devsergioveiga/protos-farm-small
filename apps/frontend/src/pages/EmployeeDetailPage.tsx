import { useState, useId } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UserRound, AlertCircle, Pencil } from 'lucide-react';
import { useEmployee } from '@/hooks/useEmployees';
import { useEmployeeContracts } from '@/hooks/useEmployeeContracts';
import { useEmployeeMovements, useEmployeeTimeline } from '@/hooks/useEmployeeMovements';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';
import EmployeeStatusBadge from '@/components/employees/EmployeeStatusBadge';
import EmployeeStatusModal from '@/components/employees/EmployeeStatusModal';
import PersonalDataTab from '@/components/employees/tabs/PersonalDataTab';
import ContractTab from '@/components/employees/tabs/ContractTab';
import EvolutionTab from '@/components/employees/tabs/EvolutionTab';
import DocumentsTab from '@/components/employees/tabs/DocumentsTab';
import HistoryTab from '@/components/employees/tabs/HistoryTab';
import PayslipTab from '@/components/employees/tabs/PayslipTab';
import type { DocumentType } from '@/types/employee';
import './EmployeeDetailPage.css';

// ─── Tab definitions ────────────────────────────────────────────────

type TabId = 'personal' | 'contract' | 'evolution' | 'documents' | 'history' | 'payslips';

const TABS: { id: TabId; label: string }[] = [
  { id: 'personal', label: 'Dados Pessoais' },
  { id: 'contract', label: 'Contrato' },
  { id: 'evolution', label: 'Evolução' },
  { id: 'documents', label: 'Documentos' },
  { id: 'history', label: 'Histórico' },
  { id: 'payslips', label: 'Holerites' },
];

// ─── Skeleton ───────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <main className="employee-detail" aria-live="polite" aria-label="Carregando colaborador">
      <div className="employee-detail__skeleton-header">
        <div
          className="employee-detail__skeleton employee-detail__skeleton--circle"
          style={{ width: 80, height: 80 }}
        />
        <div style={{ flex: 1 }}>
          <div className="employee-detail__skeleton" style={{ width: 240, height: 28, marginBottom: 8 }} />
          <div className="employee-detail__skeleton" style={{ width: 160, height: 20 }} />
        </div>
      </div>
      <div className="employee-detail__skeleton" style={{ width: '100%', height: 48, marginBottom: 24 }} />
      <div className="employee-detail__skeleton" style={{ height: 200 }} />
    </main>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';

  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [showStatusModal, setShowStatusModal] = useState(false);

  const tablistId = useId();

  const { employee, isLoading, error, refetch } = useEmployee(employeeId ?? null);
  const { contracts, isLoading: contractsLoading } = useEmployeeContracts({
    employeeId: employeeId,
  });
  const { movements, isLoading: movementsLoading } = useEmployeeMovements({
    employeeId: employeeId,
  });
  const { timeline, isLoading: timelineLoading } = useEmployeeTimeline(employeeId ?? null);

  // ─── Event handlers ─────────────────────────────────────────────

  const handleDocumentUpload = async (file: File, documentType: DocumentType) => {
    if (!employeeId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    await api.postFormData(`/org/${orgId}/employees/${employeeId}/documents`, formData);
    await refetch();
  };

  const handleDocumentDelete = async (docId: string) => {
    if (!employeeId) return;
    await api.delete(`/org/${orgId}/employees/${employeeId}/documents/${docId}`);
    await refetch();
  };

  const handleStatusChanged = () => {
    setShowStatusModal(false);
    void refetch();
  };

  // ─── Loading / Error states ──────────────────────────────────────

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <main className="employee-detail">
        <div className="employee-detail__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
          <button
            type="button"
            className="employee-detail__btn-secondary"
            onClick={() => void refetch()}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!employee) {
    return (
      <main className="employee-detail">
        <div className="employee-detail__empty-state">
          <UserRound size={64} aria-hidden="true" color="var(--color-neutral-400)" />
          <p className="employee-detail__empty-title">Colaborador não encontrado.</p>
          <button
            type="button"
            className="employee-detail__btn-primary"
            onClick={() => navigate('/employees')}
          >
            Voltar para Colaboradores
          </button>
        </div>
      </main>
    );
  }

  // Get current position from active contract or farms
  const activeContract = contracts.find((c) => c.isActive);
  const currentPosition = activeContract?.position?.name ?? employee.farms?.[0]?.position?.name;

  return (
    <main className="employee-detail">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="employee-detail__breadcrumb">
        <Link to="/employees">Colaboradores</Link>
        <span className="employee-detail__breadcrumb-sep" aria-hidden="true">/</span>
        <span aria-current="page">{employee.name}</span>
      </nav>

      {/* Fixed Header */}
      <header className="employee-detail__header">
        <div className="employee-detail__avatar-wrapper">
          {employee.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt={`Foto de ${employee.name}`}
              className="employee-detail__avatar"
              width={80}
              height={80}
            />
          ) : (
            <div className="employee-detail__avatar-placeholder" aria-label="Foto não disponível">
              <UserRound size={48} aria-hidden="true" color="var(--color-neutral-400)" />
            </div>
          )}
        </div>

        <div className="employee-detail__header-info">
          <h1 className="employee-detail__name">{employee.name}</h1>
          {currentPosition && (
            <p className="employee-detail__position">{currentPosition}</p>
          )}
          <EmployeeStatusBadge status={employee.status} />
        </div>

        <div className="employee-detail__header-actions">
          <button
            type="button"
            className="employee-detail__btn-secondary"
            onClick={() => setShowStatusModal(true)}
          >
            Mudar Status
          </button>
          <button
            type="button"
            className="employee-detail__btn-primary"
            aria-label={`Editar colaborador ${employee.name}`}
          >
            <Pencil size={16} aria-hidden="true" />
            Editar
          </button>
        </div>
      </header>

      {/* WAI-ARIA Tabs */}
      <div role="tablist" aria-label="Abas do colaborador" id={tablistId} className="employee-detail__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`${tablistId}-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`${tablistId}-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`employee-detail__tab ${activeTab === tab.id ? 'employee-detail__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              const idx = TABS.findIndex((t) => t.id === activeTab);
              if (e.key === 'ArrowRight') {
                const next = TABS[(idx + 1) % TABS.length];
                if (next) setActiveTab(next.id);
              } else if (e.key === 'ArrowLeft') {
                const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                if (prev) setActiveTab(prev.id);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${tablistId}-panel-${tab.id}`}
          aria-labelledby={`${tablistId}-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          tabIndex={0}
          className="employee-detail__panel"
        >
          {activeTab === tab.id && (
            <>
              {tab.id === 'personal' && (
                <PersonalDataTab
                  employee={employee}
                />
              )}
              {tab.id === 'contract' && (
                <ContractTab
                  employeeId={employee.id}
                  contracts={contracts}
                  isLoading={contractsLoading}
                  onNewContract={() => {
                    /* open modal */
                  }}
                  onAmendment={() => {
                    /* open modal */
                  }}
                  onDownloadPdf={(_contractId) => {
                    /* trigger download */
                  }}
                />
              )}
              {tab.id === 'evolution' && (
                <EvolutionTab
                  employeeId={employee.id}
                  movements={movements}
                  isMovementsLoading={movementsLoading}
                />
              )}
              {tab.id === 'documents' && (
                <DocumentsTab
                  employeeId={employee.id}
                  orgId={orgId}
                  documents={employee.documents ?? []}
                  onUpload={handleDocumentUpload}
                  onDelete={handleDocumentDelete}
                />
              )}
              {tab.id === 'history' && (
                <HistoryTab
                  timeline={timeline}
                  isLoading={timelineLoading}
                />
              )}
              {tab.id === 'payslips' && (
                <PayslipTab
                  orgId={orgId}
                  employeeId={employee.id}
                  employeeEmail={employee.email ?? undefined}
                />
              )}
            </>
          )}
        </div>
      ))}

      {/* Status change modal */}
      {showStatusModal && (
        <EmployeeStatusModal
          isOpen={showStatusModal}
          employee={employee}
          onClose={() => setShowStatusModal(false)}
          onSuccess={handleStatusChanged}
        />
      )}
    </main>
  );
}
