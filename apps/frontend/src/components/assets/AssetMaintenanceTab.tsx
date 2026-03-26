import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  AlertCircle,
  Circle,
  Loader2,
  PackageX,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useMaintenancePlans } from '@/hooks/useMaintenancePlans';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import type { MaintenanceTriggerType, WorkOrderStatus } from '@/types/maintenance';
import WorkOrderModal from '@/components/maintenance/WorkOrderModal';
import MaintenancePlanModal from '@/components/maintenance/MaintenancePlanModal';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetMaintenanceTabProps {
  assetId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<MaintenanceTriggerType, string> = {
  HOURMETER: 'Horimetro',
  ODOMETER: 'Odometro',
  CALENDAR: 'Calendario',
};

const STATUS_ICONS: Record<WorkOrderStatus, React.ElementType> = {
  ABERTA: Circle,
  EM_ANDAMENTO: Loader2,
  AGUARDANDO_PECA: PackageX,
  ENCERRADA: CheckCircle2,
  CANCELADA: XCircle,
};

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_PECA: 'Aguardando peca',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Main component ────────────────────────────────────────────────────

export default function AssetMaintenanceTab({ assetId }: AssetMaintenanceTabProps) {
  const { plans, loading: plansLoading, fetchPlans } = useMaintenancePlans();
  const { workOrders, loading: ordersLoading, fetchWorkOrders } = useWorkOrders();

  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const loadData = useCallback(() => {
    void fetchPlans({ assetId });
    void fetchWorkOrders({ assetId, limit: 10 });
  }, [fetchPlans, fetchWorkOrders, assetId]);

  useEffect(() => {
    if (!assetId) return;
    loadData();
  }, [loadData, assetId]);

  if (!assetId) return null;

  const hasNoData = !plansLoading && !ordersLoading && plans.length === 0 && workOrders.length === 0;

  return (
    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={() => setShowPlanModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-primary-600)',
            borderRadius: 'var(--radius-md, 6px)',
            background: 'transparent',
            color: 'var(--color-primary-600)',
            fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '40px',
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Novo Plano
        </button>
        <button
          type="button"
          onClick={() => setShowWorkOrderModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            background: 'var(--color-primary-600)',
            color: '#ffffff',
            fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '40px',
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Nova OS
        </button>
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
          <Wrench size={48} aria-hidden="true" color="var(--color-neutral-400)" />
          <h3 style={{ fontFamily: 'var(--font-display, "DM Sans", system-ui, sans-serif)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-700)', margin: 0 }}>
            Nenhuma manutencao registrada
          </h3>
          <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.875rem', margin: 0 }}>
            Abra uma OS ou configure um plano preventivo para este ativo.
          </p>
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-600)',
              fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Novo Plano
          </button>
        </div>
      )}

      {/* Planos de Manutencao */}
      {(plans.length > 0 || plansLoading) && (
        <section aria-labelledby="plans-section-title">
          <h3 style={{
            fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-neutral-500)',
            margin: '0 0 var(--space-3)',
          }} id="plans-section-title">Planos de Manutencao</h3>

          {plansLoading ? (
            <div style={{ height: '60px', background: 'var(--color-neutral-200)', borderRadius: 'var(--radius-sm, 4px)', opacity: 0.5 }} aria-hidden="true" />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)', fontSize: '0.875rem' }}>
              <caption className="sr-only">Planos de manutencao do ativo</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-100)', textAlign: 'left', fontWeight: 600, color: 'var(--color-neutral-600)', borderBottom: '1px solid var(--color-neutral-200)' }}>Nome</th>
                  <th scope="col" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-100)', textAlign: 'left', fontWeight: 600, color: 'var(--color-neutral-600)', borderBottom: '1px solid var(--color-neutral-200)' }}>Gatilho</th>
                  <th scope="col" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-100)', textAlign: 'left', fontWeight: 600, color: 'var(--color-neutral-600)', borderBottom: '1px solid var(--color-neutral-200)' }}>Proxima</th>
                  <th scope="col" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-100)', textAlign: 'left', fontWeight: 600, color: 'var(--color-neutral-600)', borderBottom: '1px solid var(--color-neutral-200)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const overdue = isOverdue(plan.nextDueAt);
                  return (
                    <tr key={plan.id}>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}>{plan.name}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}>{TRIGGER_LABELS[plan.triggerType]}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-100)' }}>
                        {plan.nextDueAt ? (
                          overdue ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-error-500)' }}>
                              <AlertCircle size={14} aria-label="Vencido" />
                              {formatDate(plan.nextDueAt)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-neutral-700)' }}>{formatDate(plan.nextDueAt)}</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--color-neutral-400)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-100)' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px var(--space-2)',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: plan.isActive ? 'var(--color-success-100, #e8f5e9)' : 'var(--color-neutral-100)',
                          color: plan.isActive ? 'var(--color-success-700, #1b5e20)' : 'var(--color-neutral-500)',
                        }}>
                          {plan.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Historico de OS */}
      {(workOrders.length > 0 || ordersLoading) && (
        <section aria-labelledby="os-history-title">
          <h3 style={{
            fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-neutral-500)',
            margin: '0 0 var(--space-3)',
          }} id="os-history-title">Historico de OS</h3>

          {ordersLoading ? (
            <div style={{ height: '60px', background: 'var(--color-neutral-200)', borderRadius: 'var(--radius-sm, 4px)', opacity: 0.5 }} aria-hidden="true" />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {workOrders.slice(0, 10).map((wo) => {
                const StatusIcon = STATUS_ICONS[wo.status];
                return (
                  <li key={wo.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderBottom: '1px solid var(--color-neutral-100)',
                    fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
                    fontSize: '0.875rem',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', color: 'var(--color-neutral-800)' }}>
                      #{String(wo.sequentialNumber).padStart(4, '0')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-neutral-600)', fontSize: '0.8125rem' }}>
                      <StatusIcon size={14} aria-hidden="true" />
                      {STATUS_LABELS[wo.status]}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', color: 'var(--color-neutral-700)' }}>
                      {formatBRL(wo.totalCost)}
                    </span>
                    <span style={{ color: 'var(--color-neutral-500)', fontSize: '0.8125rem' }}>
                      {formatDate(wo.openedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Modals */}
      <WorkOrderModal
        isOpen={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        onSuccess={() => { setShowWorkOrderModal(false); loadData(); }}
        assetId={assetId}
      />

      <MaintenancePlanModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSuccess={() => { setShowPlanModal(false); loadData(); }}
        assetId={assetId}
      />
    </div>
  );
}
