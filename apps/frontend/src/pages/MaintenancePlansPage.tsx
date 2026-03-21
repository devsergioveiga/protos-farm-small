import { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Pencil, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { useMaintenancePlans } from '@/hooks/useMaintenancePlans';
import type { MaintenancePlan, MaintenanceTriggerType } from '@/types/maintenance';
import MaintenancePlanModal from '@/components/maintenance/MaintenancePlanModal';
import './MaintenancePlansPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<MaintenanceTriggerType, string> = {
  HOURMETER: 'Horimetro',
  ODOMETER: 'Odometro',
  CALENDAR: 'Calendario',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <tr key={i} className="maintenance-plans-page__skeleton-row">
          {[1, 2, 3, 4, 5, 6, 7].map((j) => (
            <td key={j}>
              <div className="maintenance-plans-page__skeleton-cell" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function MaintenancePlansPage() {
  const { plans, loading, error, fetchPlans, toggleActive } = useMaintenancePlans();

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | undefined>(undefined);
  const [filterActive, setFilterActive] = useState<string>('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');

  const load = useCallback(() => {
    const query: Record<string, unknown> = {};
    if (filterActive !== '') query.isActive = filterActive === 'true';
    if (filterTrigger) query.triggerType = filterTrigger;
    void fetchPlans(query);
  }, [fetchPlans, filterActive, filterTrigger]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSuccess() {
    setShowModal(false);
    setEditingPlan(undefined);
    load();
  }

  function handleEdit(plan: MaintenancePlan) {
    setEditingPlan(plan);
    setShowModal(true);
  }

  async function handleToggle(plan: MaintenancePlan) {
    try {
      await toggleActive(plan.id, !plan.isActive);
      load();
    } catch {
      // silently fail — user retries
    }
  }

  return (
    <main className="maintenance-plans-page">
      {/* Breadcrumb */}
      <nav className="maintenance-plans-page__breadcrumb" aria-label="Navegacao estrutural">
        <span>Patrimonio</span>
        <span className="maintenance-plans-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="maintenance-plans-page__breadcrumb-item--current">Planos de Manutencao</span>
      </nav>

      {/* Header */}
      <header className="maintenance-plans-page__header">
        <h1 className="maintenance-plans-page__title">Planos de Manutencao</h1>
        <button
          type="button"
          className="maintenance-plans-page__btn-primary"
          onClick={() => { setEditingPlan(undefined); setShowModal(true); }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Plano
        </button>
      </header>

      {/* Filters */}
      <div className="maintenance-plans-page__filters" role="search" aria-label="Filtros">
        <label htmlFor="filter-active" className="sr-only">Status</label>
        <select
          id="filter-active"
          className="maintenance-plans-page__filter-select"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>

        <label htmlFor="filter-trigger" className="sr-only">Tipo de gatilho</label>
        <select
          id="filter-trigger"
          className="maintenance-plans-page__filter-select"
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
        >
          <option value="">Todos os gatilhos</option>
          <option value="HOURMETER">Horimetro</option>
          <option value="ODOMETER">Odometro</option>
          <option value="CALENDAR">Calendario</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="maintenance-plans-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table (desktop) */}
      <div className="maintenance-plans-page__table-wrap">
        <table className="maintenance-plans-page__table">
          <caption>Planos de manutencao preventiva</caption>
          <thead>
            <tr>
              <th scope="col">Nome do plano</th>
              <th scope="col">Ativo</th>
              <th scope="col">Gatilho</th>
              <th scope="col">Intervalo</th>
              <th scope="col">Proxima execucao</th>
              <th scope="col">Ultimo executado</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Acoes</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="maintenance-plans-page__empty">
                    <Wrench
                      size={48}
                      aria-hidden="true"
                      color="var(--color-neutral-400)"
                    />
                    <h2 className="maintenance-plans-page__empty-title">
                      Nenhum plano de manutencao
                    </h2>
                    <p className="maintenance-plans-page__empty-desc">
                      Crie planos preventivos para receber alertas antes que o prazo venca.
                    </p>
                    <button
                      type="button"
                      className="maintenance-plans-page__btn-primary"
                      onClick={() => { setEditingPlan(undefined); setShowModal(true); }}
                    >
                      <Plus size={20} aria-hidden="true" />
                      Novo Plano
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              plans.map((plan) => {
                const overdue = isOverdue(plan.nextDueAt);
                return (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>{plan.asset?.name ?? '—'}</td>
                    <td>{TRIGGER_LABELS[plan.triggerType]}</td>
                    <td>{plan.intervalValue}</td>
                    <td>
                      {plan.nextDueAt ? (
                        overdue ? (
                          <span className="maintenance-plans-page__overdue">
                            <AlertCircle size={16} aria-label="Vencido" />
                            {formatDate(plan.nextDueAt)}
                          </span>
                        ) : (
                          formatDate(plan.nextDueAt)
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{formatDate(plan.lastExecutedAt)}</td>
                    <td>
                      <span
                        className={`maintenance-plans-page__badge ${plan.isActive ? 'maintenance-plans-page__badge--active' : 'maintenance-plans-page__badge--inactive'}`}
                      >
                        {plan.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="maintenance-plans-page__actions">
                        <button
                          type="button"
                          className="maintenance-plans-page__action-btn"
                          onClick={() => handleEdit(plan)}
                          aria-label={`Editar plano ${plan.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="maintenance-plans-page__action-btn"
                          onClick={() => void handleToggle(plan)}
                          aria-label={plan.isActive ? `Desativar plano ${plan.name}` : `Ativar plano ${plan.name}`}
                        >
                          {plan.isActive ? (
                            <ToggleRight size={16} aria-hidden="true" />
                          ) : (
                            <ToggleLeft size={16} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="maintenance-plans-page__cards" aria-label="Planos de manutencao">
        {!loading && plans.map((plan) => {
          const overdue = isOverdue(plan.nextDueAt);
          return (
            <article key={plan.id} className="maintenance-plans-page__card">
              <span className="maintenance-plans-page__card-title">{plan.name}</span>
              <span className="maintenance-plans-page__card-meta">
                {plan.asset?.name ?? '—'} &middot; {TRIGGER_LABELS[plan.triggerType]}
              </span>
              {plan.nextDueAt && (
                <span className={overdue ? 'maintenance-plans-page__overdue' : ''}>
                  {overdue && <AlertCircle size={14} aria-label="Vencido" />}
                  Proxima: {formatDate(plan.nextDueAt)}
                </span>
              )}
              <div className="maintenance-plans-page__actions">
                <button
                  type="button"
                  className="maintenance-plans-page__action-btn"
                  onClick={() => handleEdit(plan)}
                  aria-label={`Editar plano ${plan.name}`}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="maintenance-plans-page__action-btn"
                  onClick={() => void handleToggle(plan)}
                  aria-label={plan.isActive ? `Desativar plano ${plan.name}` : `Ativar plano ${plan.name}`}
                >
                  {plan.isActive ? <ToggleRight size={16} aria-hidden="true" /> : <ToggleLeft size={16} aria-hidden="true" />}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal */}
      <MaintenancePlanModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingPlan(undefined); }}
        onSuccess={handleSuccess}
        plan={editingPlan}
      />
    </main>
  );
}
