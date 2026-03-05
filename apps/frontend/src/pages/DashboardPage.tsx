import {
  MapPin,
  Grid3X3,
  Ruler,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import type { OrgDashboardStats } from '@/types/dashboard';
import './DashboardPage.css';

// ─── Action label mapping ────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  CREATE_FARM: 'Cadastrou uma fazenda',
  UPDATE_FARM: 'Editou uma fazenda',
  DELETE_FARM: 'Excluiu uma fazenda',
  UPDATE_FARM_STATUS: 'Alterou status de fazenda',
  ADD_FARM_REGISTRATION: 'Adicionou matrícula',
  UPDATE_FARM_REGISTRATION: 'Editou matrícula',
  DELETE_FARM_REGISTRATION: 'Removeu matrícula',
  UPLOAD_FARM_BOUNDARY: 'Enviou perímetro de fazenda',
  DELETE_FARM_BOUNDARY: 'Removeu perímetro de fazenda',
  UPLOAD_REGISTRATION_BOUNDARY: 'Enviou perímetro de matrícula',
  DELETE_REGISTRATION_BOUNDARY: 'Removeu perímetro de matrícula',
  CREATE_FIELD_PLOT: 'Cadastrou um talhão',
  UPDATE_FIELD_PLOT: 'Editou um talhão',
  DELETE_FIELD_PLOT: 'Excluiu um talhão',
  UPDATE_FIELD_PLOT_BOUNDARY: 'Editou perímetro de talhão',
  EDIT_FIELD_PLOT_BOUNDARY: 'Editou geometria de talhão',
  BULK_IMPORT_FIELD_PLOTS: 'Importou talhões em lote',
  SUBDIVIDE_FIELD_PLOT: 'Subdividiu um talhão',
  MERGE_FIELD_PLOTS: 'Mesclou talhões',
  CREATE_USER: 'Cadastrou um usuário',
  UPDATE_USER: 'Editou um usuário',
  DEACTIVATE_USER: 'Desativou um usuário',
  ACTIVATE_USER: 'Ativou um usuário',
  CREATE_PRODUCER: 'Cadastrou um produtor',
  UPDATE_PRODUCER: 'Editou um produtor',
  CREATE_CROP_SEASON: 'Registrou safra',
  CREATE_SOIL_ANALYSIS: 'Registrou análise de solo',
};

// ─── Relative time helper ────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem atrás`;
}

// ─── Number formatter ────────────────────────────────────────────────

const areaFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

// ─── Skeleton Loading ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <section className="org-dashboard" aria-live="polite">
      <div className="org-dashboard__header">
        <div className="org-dashboard__skeleton" style={{ width: '240px', height: '32px' }} />
      </div>
      <div className="org-dashboard__stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="org-dashboard__skeleton" style={{ height: '100px' }} />
        ))}
      </div>
      <div className="org-dashboard__skeleton" style={{ height: '200px', marginBottom: '32px' }} />
      <div className="org-dashboard__bottom-grid">
        <div className="org-dashboard__skeleton" style={{ height: '240px' }} />
        <div className="org-dashboard__skeleton" style={{ height: '240px' }} />
      </div>
    </section>
  );
}

// ─── Alerts Section ──────────────────────────────────────────────────

function AlertsSection({ alerts }: { alerts: OrgDashboardStats['alerts'] }) {
  const items: Array<{ key: string; text: string; detail?: string; warning: boolean }> = [];

  if (alerts.farmLimit.warning) {
    items.push({
      key: 'farm-limit',
      text: `${alerts.farmLimit.percentage}% do limite de fazendas utilizado`,
      detail: `${alerts.farmLimit.current} de ${alerts.farmLimit.max}`,
      warning: true,
    });
  }

  if (alerts.userLimit.warning) {
    items.push({
      key: 'user-limit',
      text: `${alerts.userLimit.percentage}% do limite de usuários utilizado`,
      detail: `${alerts.userLimit.current} de ${alerts.userLimit.max}`,
      warning: true,
    });
  }

  for (const contract of alerts.expiringContracts.alerts) {
    const dateStr = contract.expiresAt
      ? new Date(contract.expiresAt).toLocaleDateString('pt-BR')
      : '';
    items.push({
      key: contract.id,
      text: `Contrato de ${contract.producerName} vence em ${dateStr}`,
      detail: contract.farmName ?? undefined,
      warning: true,
    });
  }

  if (items.length === 0) {
    return (
      <div className="org-dashboard__empty">
        <CheckCircle aria-hidden="true" size={32} />
        <p>Nenhum alerta no momento</p>
      </div>
    );
  }

  return (
    <ul className="org-dashboard__alert-list">
      {items.map((item) => (
        <li key={item.key} className="org-dashboard__alert-item">
          <AlertTriangle
            aria-hidden="true"
            size={20}
            className={
              item.warning
                ? 'org-dashboard__alert-icon--warning'
                : 'org-dashboard__alert-icon--info'
            }
          />
          <div>
            <p className="org-dashboard__alert-text">{item.text}</p>
            {item.detail && <p className="org-dashboard__alert-detail">{item.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

function DashboardPage() {
  const { stats, isLoading, error } = useDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <section className="org-dashboard">
        <header className="org-dashboard__header">
          <h1 className="org-dashboard__title">Dashboard</h1>
        </header>
        <div className="org-dashboard__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const maxUfCount = Math.max(...stats.farmsByUf.map((u) => u.count), 1);

  return (
    <section className="org-dashboard">
      <header className="org-dashboard__header">
        <h1 className="org-dashboard__title">Dashboard</h1>
        <p className="org-dashboard__subtitle">Visão geral da sua organização</p>
      </header>

      {/* CA1: Summary cards */}
      <div className="org-dashboard__stats">
        <div className="org-dashboard__card">
          <div className="org-dashboard__card-icon org-dashboard__card-icon--green">
            <MapPin aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="org-dashboard__card-label">FAZENDAS</p>
            <p className="org-dashboard__card-value">{stats.summary.totalFarms}</p>
          </div>
        </div>

        <div className="org-dashboard__card">
          <div className="org-dashboard__card-icon org-dashboard__card-icon--blue">
            <Grid3X3 aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="org-dashboard__card-label">TALHÕES</p>
            <p className="org-dashboard__card-value">{stats.summary.totalPlots}</p>
          </div>
        </div>

        <div className="org-dashboard__card">
          <div className="org-dashboard__card-icon org-dashboard__card-icon--amber">
            <Ruler aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="org-dashboard__card-label">ÁREA TOTAL</p>
            <p className="org-dashboard__card-value">
              {areaFormatter.format(stats.summary.totalAreaHa)} ha
            </p>
          </div>
        </div>

        <div className="org-dashboard__card">
          <div className="org-dashboard__card-icon org-dashboard__card-icon--purple">
            <Users aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="org-dashboard__card-label">USUÁRIOS ATIVOS</p>
            <p className="org-dashboard__card-value">{stats.summary.activeUsers}</p>
          </div>
        </div>
      </div>

      {/* CA2: Farms by UF */}
      <section>
        <h2 className="org-dashboard__section-title">Fazendas por UF</h2>
        <div className="org-dashboard__uf-chart">
          {stats.farmsByUf.length === 0 ? (
            <div className="org-dashboard__empty">
              <MapPin aria-hidden="true" size={32} />
              <p>Nenhuma fazenda cadastrada</p>
            </div>
          ) : (
            stats.farmsByUf.map((item) => (
              <div key={item.uf} className="org-dashboard__uf-item">
                <span className="org-dashboard__uf-name">{item.uf}</span>
                <div className="org-dashboard__uf-bar-wrapper">
                  <div
                    className="org-dashboard__uf-bar"
                    style={{ width: `${(item.count / maxUfCount) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin={0}
                    aria-valuemax={maxUfCount}
                    aria-label={`${item.uf}: ${item.count} fazenda${item.count !== 1 ? 's' : ''}`}
                  />
                </div>
                <span className="org-dashboard__uf-count">{item.count}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* CA3 + CA4: Activity + Alerts */}
      <div className="org-dashboard__bottom-grid">
        <section className="org-dashboard__panel">
          <h2 className="org-dashboard__section-title">Atividade recente</h2>
          {stats.recentActivity.length === 0 ? (
            <div className="org-dashboard__empty">
              <FileText aria-hidden="true" size={32} />
              <p>Nenhuma atividade registrada</p>
            </div>
          ) : (
            <ul className="org-dashboard__activity-list">
              {stats.recentActivity.map((activity) => (
                <li key={activity.id} className="org-dashboard__activity-item">
                  <span className="org-dashboard__activity-dot" aria-hidden="true" />
                  <div>
                    <p className="org-dashboard__activity-text">
                      <span className="org-dashboard__activity-actor">
                        {activity.actorEmail.split('@')[0]}
                      </span>{' '}
                      {ACTION_LABELS[activity.action] ??
                        activity.action.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    <p className="org-dashboard__activity-time">{timeAgo(activity.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="org-dashboard__panel">
          <h2 className="org-dashboard__section-title">Alertas</h2>
          <AlertsSection alerts={stats.alerts} />
        </section>
      </div>
    </section>
  );
}

export default DashboardPage;
