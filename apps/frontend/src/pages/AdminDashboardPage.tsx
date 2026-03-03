import {
  Building2,
  Users,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import './AdminDashboardPage.css';

const PLAN_LABELS: Record<string, string> = {
  basic: 'Básico',
  professional: 'Profissional',
  enterprise: 'Enterprise',
};

function AdminDashboardPage() {
  const { stats, isLoading, error } = useAdminDashboard();

  if (isLoading) {
    return (
      <section className="admin-dashboard" aria-live="polite">
        <div className="admin-dashboard__header">
          <div className="admin-dashboard__skeleton" style={{ width: '240px', height: '32px' }} />
        </div>
        <div className="admin-dashboard__stats">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-dashboard__skeleton" style={{ height: '100px' }} />
          ))}
        </div>
        <div className="admin-dashboard__status-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-dashboard__skeleton" style={{ height: '100px' }} />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="admin-dashboard">
        <header className="admin-dashboard__header">
          <h1 className="admin-dashboard__title">Dashboard Admin</h1>
        </header>
        <div className="admin-dashboard__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const maxPlanCount = Math.max(...stats.organizations.byPlan.map((p) => p.count), 1);

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard__header">
        <h1 className="admin-dashboard__title">Dashboard Admin</h1>
        <p className="admin-dashboard__subtitle">Visão geral do sistema</p>
      </header>

      {/* Main stat cards */}
      <div className="admin-dashboard__stats">
        <div className="admin-dashboard__card">
          <div className="admin-dashboard__card-icon admin-dashboard__card-icon--neutral">
            <Building2 aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="admin-dashboard__card-label">Organizações</p>
            <p className="admin-dashboard__card-value">{stats.organizations.total}</p>
          </div>
        </div>

        <div className="admin-dashboard__card">
          <div className="admin-dashboard__card-icon admin-dashboard__card-icon--neutral">
            <Users aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="admin-dashboard__card-label">Usuários</p>
            <p className="admin-dashboard__card-value">{stats.users.total}</p>
          </div>
        </div>

        <div className="admin-dashboard__card">
          <div className="admin-dashboard__card-icon admin-dashboard__card-icon--neutral">
            <MapPin aria-hidden="true" size={24} />
          </div>
          <div>
            <p className="admin-dashboard__card-label">Fazendas</p>
            <p className="admin-dashboard__card-value">{stats.farms.total}</p>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="admin-dashboard__status-grid">
        <div className="admin-dashboard__status-card">
          <p className="admin-dashboard__status-value admin-dashboard__status-value--active">
            {stats.organizations.active}
          </p>
          <p className="admin-dashboard__status-label">
            <CheckCircle aria-hidden="true" size={16} />
            Ativas
          </p>
        </div>

        <div className="admin-dashboard__status-card">
          <p className="admin-dashboard__status-value admin-dashboard__status-value--suspended">
            {stats.organizations.suspended}
          </p>
          <p className="admin-dashboard__status-label">
            <AlertTriangle aria-hidden="true" size={16} />
            Suspensas
          </p>
        </div>

        <div className="admin-dashboard__status-card">
          <p className="admin-dashboard__status-value admin-dashboard__status-value--cancelled">
            {stats.organizations.cancelled}
          </p>
          <p className="admin-dashboard__status-label">
            <XCircle aria-hidden="true" size={16} />
            Canceladas
          </p>
        </div>
      </div>

      {/* Plan distribution */}
      {stats.organizations.byPlan.length > 0 && (
        <section>
          <h2 className="admin-dashboard__section-title">Distribuição por plano</h2>
          <div className="admin-dashboard__plans">
            {stats.organizations.byPlan.map((item) => (
              <div key={item.plan} className="admin-dashboard__plan-item">
                <span className="admin-dashboard__plan-name">
                  {PLAN_LABELS[item.plan] ?? item.plan}
                </span>
                <div className="admin-dashboard__plan-bar-wrapper">
                  <div
                    className="admin-dashboard__plan-bar"
                    style={{ width: `${(item.count / maxPlanCount) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin={0}
                    aria-valuemax={maxPlanCount}
                    aria-label={`${PLAN_LABELS[item.plan] ?? item.plan}: ${item.count}`}
                  />
                </div>
                <span className="admin-dashboard__plan-count">{item.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default AdminDashboardPage;
