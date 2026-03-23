import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Wrench,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useMaintenancePlans } from '@/hooks/useMaintenancePlans';
import { useFarms } from '@/hooks/useFarms';
import MaintenancePlanModal from '@/components/maintenance/MaintenancePlanModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { MaintenancePlan, ListMaintenancePlansQuery, MaintenanceTriggerType } from '@/types/maintenance';
import { TRIGGER_TYPE_LABELS } from '@/types/maintenance';
import './MaintenancePlansPage.css';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatMeter(plan: MaintenancePlan): string {
  if (plan.triggerType === 'HOURMETER') return `A cada ${plan.intervalValue}h`;
  if (plan.triggerType === 'ODOMETER') return `A cada ${plan.intervalValue} km`;
  return `A cada ${plan.intervalValue} dias`;
}

function formatNextDue(plan: MaintenancePlan): { label: string; overdue: boolean } {
  if (plan.triggerType === 'CALENDAR') {
    if (!plan.nextDueAt) return { label: '—', overdue: false };
    return {
      label: formatDate(plan.nextDueAt),
      overdue: isOverdue(plan.nextDueAt),
    };
  }
  if (plan.nextDueMeter !== null) {
    const unit = plan.triggerType === 'HOURMETER' ? 'h' : ' km';
    return { label: `${plan.nextDueMeter}${unit}`, overdue: false };
  }
  return { label: '—', overdue: false };
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="maint-plans__skeleton" aria-label="Carregando planos" role="status">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="maint-plans__skeleton-row" />
      ))}
    </div>
  );
}

// ─── Mobile Card ────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: MaintenancePlan;
  onEdit: (plan: MaintenancePlan) => void;
  onToggle: (plan: MaintenancePlan) => void;
}

function PlanCard({ plan, onEdit, onToggle }: PlanCardProps) {
  const nextDue = formatNextDue(plan);
  return (
    <article className="maint-plans__card">
      <div className="maint-plans__card-header">
        <span className="maint-plans__card-name">{plan.name}</span>
        <span className={`maint-plans__active-badge ${plan.isActive ? 'maint-plans__active-badge--active' : 'maint-plans__active-badge--inactive'}`}>
          {plan.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>
      <div className="maint-plans__card-meta">
        <span>{plan.asset?.name ?? '—'}</span>
        <span>{TRIGGER_TYPE_LABELS[plan.triggerType]}</span>
        <span>{formatMeter(plan)}</span>
      </div>
      {nextDue.overdue ? (
        <div className="maint-plans__card-due maint-plans__card-due--overdue">
          <AlertCircle size={14} aria-hidden="true" />
          <span aria-label="Vencido">{nextDue.label}</span>
        </div>
      ) : (
        <div className="maint-plans__card-due">{nextDue.label}</div>
      )}
      <div className="maint-plans__card-actions">
        <button
          type="button"
          className="maint-plans__action-btn"
          onClick={() => onEdit(plan)}
          aria-label={`Editar plano ${plan.name}`}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="maint-plans__action-btn"
          onClick={() => onToggle(plan)}
          aria-label={plan.isActive ? `Desativar plano ${plan.name}` : `Ativar plano ${plan.name}`}
        >
          {plan.isActive ? (
            <ToggleRight size={20} aria-hidden="true" />
          ) : (
            <ToggleLeft size={20} aria-hidden="true" />
          )}
        </button>
      </div>
    </article>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function MaintenancePlansPage() {
  const {
    plans,
    loading,
    error,
    total,
    totalPages,
    fetchPlans,
    toggleActive,
  } = useMaintenancePlans();
  const { farms } = useFarms();

  // Filters
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [triggerFilter, setTriggerFilter] = useState<'' | MaintenanceTriggerType>('');
  const [farmFilter, setFarmFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);

  // Toggle confirm
  const [showToggleConfirm, setShowToggleConfirm] = useState(false);
  const [planToToggle, setPlanToToggle] = useState<MaintenancePlan | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const currentQuery: ListMaintenancePlansQuery = {
    page: currentPage,
    limit: 20,
    isActive: activeFilter === '' ? undefined : activeFilter === 'true',
    triggerType: (triggerFilter as MaintenanceTriggerType) || undefined,
    farmId: farmFilter || undefined,
  };

  const loadData = useCallback(() => {
    void fetchPlans(currentQuery);
  }, [fetchPlans, currentPage, activeFilter, triggerFilter, farmFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleNewPlan() {
    setSelectedPlan(null);
    setShowModal(true);
  }

  function handleEditPlan(plan: MaintenancePlan) {
    setSelectedPlan(plan);
    setShowModal(true);
  }

  function handleToggleRequest(plan: MaintenancePlan) {
    setPlanToToggle(plan);
    setShowToggleConfirm(true);
  }

  async function handleToggleConfirm() {
    if (!planToToggle) return;
    setIsToggling(true);
    try {
      await toggleActive(planToToggle.id, !planToToggle.isActive);
      setToast(
        planToToggle.isActive
          ? `Plano "${planToToggle.name}" desativado.`
          : `Plano "${planToToggle.name}" ativado.`,
      );
      void fetchPlans(currentQuery);
    } catch {
      setToast('Nao foi possivel alterar o status do plano. Verifique sua conexao e tente novamente.');
    } finally {
      setIsToggling(false);
      setShowToggleConfirm(false);
      setPlanToToggle(null);
    }
  }

  function handleModalSuccess() {
    setShowModal(false);
    setSelectedPlan(null);
    void fetchPlans(currentQuery);
    setToast(selectedPlan ? 'Plano atualizado.' : 'Plano de manutencao criado com sucesso.');
  }

  const hasFilters = Boolean(activeFilter || triggerFilter || farmFilter);
  const isEmpty = !loading && !error && plans.length === 0;

  return (
    <main className="maint-plans" id="main-content">
      {/* Breadcrumb */}
      <nav className="maint-plans__breadcrumb" aria-label="Caminho de navegacao">
        <span className="maint-plans__breadcrumb-item">Patrimonio</span>
        <span className="maint-plans__breadcrumb-sep" aria-hidden="true">&gt;</span>
        <span
          className="maint-plans__breadcrumb-item maint-plans__breadcrumb-item--current"
          aria-current="page"
        >
          Planos de Manutencao
        </span>
      </nav>

      {/* Header */}
      <header className="maint-plans__header">
        <h1 className="maint-plans__title">Planos de Manutencao</h1>
        <button
          type="button"
          className="maint-plans__btn maint-plans__btn--primary"
          onClick={handleNewPlan}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Plano
        </button>
      </header>

      {/* Filter bar */}
      <section className="maint-plans__filters" aria-label="Filtros">
        <div className="maint-plans__filter-row">
          {/* Ativo/inativo */}
          <div className="maint-plans__filter-field">
            <label htmlFor="filter-active" className="maint-plans__filter-label">
              Status
            </label>
            <select
              id="filter-active"
              className="maint-plans__select"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as '' | 'true' | 'false');
                setCurrentPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          {/* Gatilho */}
          <div className="maint-plans__filter-field">
            <label htmlFor="filter-trigger" className="maint-plans__filter-label">
              Tipo de gatilho
            </label>
            <select
              id="filter-trigger"
              className="maint-plans__select"
              value={triggerFilter}
              onChange={(e) => {
                setTriggerFilter(e.target.value as '' | MaintenanceTriggerType);
                setCurrentPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="HOURMETER">Horimetro</option>
              <option value="ODOMETER">Km</option>
              <option value="CALENDAR">Calendario</option>
            </select>
          </div>

          {/* Fazenda */}
          <div className="maint-plans__filter-field">
            <label htmlFor="filter-farm" className="maint-plans__filter-label">
              Fazenda
            </label>
            <select
              id="filter-farm"
              className="maint-plans__select"
              value={farmFilter}
              onChange={(e) => {
                setFarmFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Todas as fazendas</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="maint-plans__content" aria-label="Lista de planos de manutencao">
        {loading && <TableSkeleton />}

        {error && !loading && (
          <div className="maint-plans__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="maint-plans__btn maint-plans__btn--secondary"
              onClick={loadData}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isEmpty && hasFilters && !error && (
          <div className="maint-plans__empty">
            <Wrench size={48} aria-hidden="true" className="maint-plans__empty-icon" />
            <p className="maint-plans__empty-text">
              Nenhum plano encontrado com esses filtros.
            </p>
          </div>
        )}

        {isEmpty && !hasFilters && !error && (
          <div className="maint-plans__empty">
            <Wrench size={48} aria-hidden="true" className="maint-plans__empty-icon" />
            <h2 className="maint-plans__empty-title">Nenhum plano de manutencao</h2>
            <p className="maint-plans__empty-desc">
              Crie planos preventivos para receber alertas antes que o prazo venca.
            </p>
            <button
              type="button"
              className="maint-plans__btn maint-plans__btn--primary"
              onClick={handleNewPlan}
            >
              <Plus size={20} aria-hidden="true" />
              Novo Plano
            </button>
          </div>
        )}

        {!loading && !error && plans.length > 0 && (
          <>
            {/* Mobile: card stack */}
            <div className="maint-plans__cards">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={handleEditPlan}
                  onToggle={handleToggleRequest}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="maint-plans__table-wrapper">
              <table className="maint-plans__table">
                <caption className="sr-only">Planos de manutencao preventiva</caption>
                <thead>
                  <tr>
                    <th scope="col" className="maint-plans__th">Nome do plano</th>
                    <th scope="col" className="maint-plans__th">Ativo</th>
                    <th scope="col" className="maint-plans__th">Gatilho</th>
                    <th scope="col" className="maint-plans__th">Intervalo</th>
                    <th scope="col" className="maint-plans__th">Proxima execucao</th>
                    <th scope="col" className="maint-plans__th">Ultimo executado</th>
                    <th scope="col" className="maint-plans__th maint-plans__th--right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => {
                    const nextDue = formatNextDue(plan);
                    return (
                      <tr key={plan.id} className="maint-plans__tr">
                        <td className="maint-plans__td">{plan.name}</td>
                        <td className="maint-plans__td">{plan.asset?.name ?? '—'}</td>
                        <td className="maint-plans__td">{TRIGGER_TYPE_LABELS[plan.triggerType]}</td>
                        <td className="maint-plans__td">{formatMeter(plan)}</td>
                        <td className="maint-plans__td">
                          {nextDue.overdue ? (
                            <span className="maint-plans__overdue">
                              <AlertCircle size={14} aria-hidden="true" />
                              <span aria-label="Vencido">{nextDue.label}</span>
                            </span>
                          ) : (
                            nextDue.label
                          )}
                        </td>
                        <td className="maint-plans__td">{formatDate(plan.lastExecutedAt)}</td>
                        <td className="maint-plans__td maint-plans__td--right">
                          <div className="maint-plans__row-actions">
                            <button
                              type="button"
                              className="maint-plans__action-btn"
                              onClick={() => handleEditPlan(plan)}
                              aria-label={`Editar plano ${plan.name}`}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="maint-plans__action-btn"
                              onClick={() => handleToggleRequest(plan)}
                              aria-label={plan.isActive ? `Desativar plano ${plan.name}` : `Ativar plano ${plan.name}`}
                            >
                              {plan.isActive ? (
                                <ToggleRight size={20} aria-hidden="true" />
                              ) : (
                                <ToggleLeft size={20} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="maint-plans__pagination" aria-label="Paginacao">
                <button
                  type="button"
                  className="maint-plans__pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className="maint-plans__pagination-info">
                  Pagina {currentPage} de {totalPages} ({total} planos)
                </span>
                <button
                  type="button"
                  className="maint-plans__pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Proxima pagina"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Plan Modal (create/edit) */}
      {showModal && (
        <MaintenancePlanModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedPlan(null);
          }}
          onSuccess={handleModalSuccess}
          plan={selectedPlan ?? undefined}
        />
      )}

      {/* Toggle confirmation */}
      <ConfirmModal
        isOpen={showToggleConfirm}
        title={planToToggle?.isActive ? 'Desativar plano' : 'Ativar plano'}
        message={
          planToToggle?.isActive
            ? `Desativar o plano "${planToToggle?.name}"? Ele nao gerara mais alertas.`
            : `Ativar o plano "${planToToggle?.name}"? Os alertas voltarao a ser gerados.`
        }
        confirmLabel={planToToggle?.isActive ? 'Desativar' : 'Ativar'}
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={isToggling}
        onConfirm={() => void handleToggleConfirm()}
        onCancel={() => {
          setShowToggleConfirm(false);
          setPlanToToggle(null);
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="maint-plans__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
