import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Wrench,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useMaintenanceDashboard } from '@/hooks/useMaintenanceDashboard';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import MaintenanceKanban from '@/components/maintenance/MaintenanceKanban';
import type { WorkOrderStatus } from '@/types/maintenance';
import './MaintenanceDashboardPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── KPI Card ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | null;
  isMono?: boolean;
  tooltip?: string;
  loading: boolean;
}

function KpiCard({ label, value, isMono, tooltip, loading }: KpiCardProps) {
  return (
    <div className="maintenance-dashboard__kpi-card">
      <p className="maintenance-dashboard__kpi-label">{label}</p>
      {loading ? (
        <div className="maintenance-dashboard__kpi-skeleton" aria-hidden="true" />
      ) : value === null ? (
        <span
          className="maintenance-dashboard__kpi-nd"
          title={tooltip}
          aria-label={`${label}: dado indisponivel`}
        >
          N/D
        </span>
      ) : (
        <p
          className={`maintenance-dashboard__kpi-value${isMono ? ' maintenance-dashboard__kpi-value--mono' : ''}`}
          aria-label={`${label}: ${value}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function MaintenanceDashboardPage() {
  const { dashboard, loading, error, fetchDashboard } = useMaintenanceDashboard();
  const { workOrders, fetchWorkOrders, updateWorkOrder } = useWorkOrders();
  // Helper to PATCH work order status (updateWorkOrder accepts partial, cast needed for status field)
  const patchWorkOrderStatus = updateWorkOrder as unknown as (id: string, input: Record<string, unknown>) => Promise<void>;

  useEffect(() => {
    void fetchDashboard();
    void fetchWorkOrders({ status: 'ABERTA,EM_ANDAMENTO,AGUARDANDO_PECA', limit: 100 });
  }, [fetchDashboard, fetchWorkOrders]);

  async function handleStatusChange(id: string, newStatus: WorkOrderStatus) {
    try {
      await patchWorkOrderStatus(id, { status: newStatus });
      void fetchWorkOrders({ status: 'ABERTA,EM_ANDAMENTO,AGUARDANDO_PECA' });
    } catch {
      void fetchWorkOrders({ status: 'ABERTA,EM_ANDAMENTO,AGUARDANDO_PECA' });
    }
  }

  // Determine availability value string
  const availabilityStr = dashboard?.availability !== null && dashboard?.availability !== undefined
    ? `${dashboard.availability.toFixed(1)}%`
    : null;

  const mtbfStr = dashboard?.mtbfHours !== null && dashboard?.mtbfHours !== undefined
    ? `${dashboard.mtbfHours.toFixed(1)} horas`
    : null;

  const mttrStr = dashboard?.mttrHours !== null && dashboard?.mttrHours !== undefined
    ? `${dashboard.mttrHours.toFixed(1)} horas`
    : null;

  const ytdStr = dashboard !== null
    ? formatBRL(dashboard?.totalCostYTD)
    : null;

  const ND_TOOLTIP = 'Nao ha OS corretivas registradas para calcular este indicador.';

  // Empty state — no dashboard data and not loading
  const hasNoData = !loading && dashboard !== null && dashboard.totalCostYTD === 0 && workOrders.length === 0;

  return (
    <main className="maintenance-dashboard">
      {/* Breadcrumb */}
      <nav className="maintenance-dashboard__breadcrumb" aria-label="Navegacao estrutural">
        <span>Patrimonio</span>
        <span className="maintenance-dashboard__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="maintenance-dashboard__breadcrumb-item--current">Dashboard Manutencao</span>
      </nav>

      {/* Header */}
      <header className="maintenance-dashboard__header">
        <h1 className="maintenance-dashboard__title">Dashboard Manutencao</h1>
        <Link to="/work-orders" className="maintenance-dashboard__cta-link">
          Ver todas as OS
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {/* Error */}
      {error && (
        <div className="maintenance-dashboard__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {hasNoData && (
        <div className="maintenance-dashboard__empty">
          <Wrench size={48} aria-hidden="true" color="var(--color-neutral-400)" />
          <h2 className="maintenance-dashboard__empty-title">Nenhuma OS ainda</h2>
          <p className="maintenance-dashboard__empty-desc">
            As metricas de disponibilidade e custo aparecerao aqui assim que a primeira OS for encerrada.
          </p>
        </div>
      )}

      {/* KPI row — 4 cards */}
      {!hasNoData && (
        <div className="maintenance-dashboard__kpi-grid" aria-label="Indicadores de manutencao">
          <KpiCard
            label="Disponibilidade Mecanica"
            value={availabilityStr}
            loading={loading}
          />
          <KpiCard
            label="MTBF"
            value={mtbfStr}
            isMono
            tooltip={ND_TOOLTIP}
            loading={loading}
          />
          <KpiCard
            label="MTTR"
            value={mttrStr}
            isMono
            tooltip={ND_TOOLTIP}
            loading={loading}
          />
          <KpiCard
            label="Custo YTD"
            value={ytdStr}
            isMono
            loading={loading}
          />
        </div>
      )}

      {/* Alertas de planos vencidos */}
      {!loading && dashboard && (dashboard.overdueMaintenancesCount ?? 0) > 0 && (
        <section className="maintenance-dashboard__section" aria-labelledby="alerts-title">
          <h2 className="maintenance-dashboard__section-title" id="alerts-title">
            Alertas
          </h2>
          <div className="maintenance-dashboard__alerts">
            {dashboard.overduePlans && dashboard.overduePlans.length > 0 ? (
              dashboard.overduePlans.map((p) => (
                <div key={p.id} className="maintenance-dashboard__alert-item" role="alert">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <span>
                    {p.assetName} — {p.name}: manutencao vencida ha {p.daysOverdue} dias
                  </span>
                </div>
              ))
            ) : (
              <div className="maintenance-dashboard__alert-item" role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                <span>{dashboard.overdueMaintenancesCount} planos de manutencao vencidos</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* OS Abertas — Kanban */}
      {!loading && (
        <section className="maintenance-dashboard__section" aria-labelledby="kanban-title">
          <h2 className="maintenance-dashboard__section-title" id="kanban-title">
            OS Abertas
          </h2>
          <MaintenanceKanban
            workOrders={workOrders.filter((wo) =>
              ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECA'].includes(wo.status),
            )}
            onStatusChange={(id, newStatus) => void handleStatusChange(id, newStatus)}
          />
        </section>
      )}

      {/* Custo por Ativo */}
      {!loading && dashboard && dashboard.costByAsset.length > 0 && (
        <section className="maintenance-dashboard__section" aria-labelledby="cost-table-title">
          <h2 className="maintenance-dashboard__section-title" id="cost-table-title">
            Custo por Ativo
          </h2>
          <table className="maintenance-dashboard__cost-table">
            <caption>Distribuicao de custos de manutencao por ativo</caption>
            <thead>
              <tr>
                <th scope="col">Ativo</th>
                <th scope="col" className="col-right">Custo Total</th>
                <th scope="col" className="col-right">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.costByAsset
                .sort((a, b) => b.totalCost - a.totalCost)
                .map((item) => {
                  const pct =
                    dashboard.totalCostYTD > 0
                      ? ((item.totalCost / dashboard.totalCostYTD) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={item.assetId}>
                      <td>{item.assetName}</td>
                      <td className="col-right col-mono">{formatBRL(item.totalCost)}</td>
                      <td className="col-right">{pct}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
