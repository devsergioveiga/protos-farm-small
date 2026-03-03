import { useCallback, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, ScrollText, ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import './AdminLayout.css';

const NAV_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/organizations', label: 'Organizações', icon: Building2 },
  { to: '/admin/audit-logs', label: 'Auditoria', icon: ScrollText },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-layout">
      <button
        type="button"
        className="admin-hamburger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu de navegação"
      >
        <Menu size={24} aria-hidden="true" />
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="admin-overlay admin-overlay--visible"
          onClick={closeSidebar}
          aria-label="Fechar menu"
          tabIndex={-1}
        />
      )}

      <aside
        className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`}
        aria-label="Navegação admin"
      >
        <div className="admin-sidebar__header">
          <Link to="/admin" className="admin-sidebar__logo" aria-label="Ir para o dashboard admin">
            Protos Farm
          </Link>
          <span className="admin-sidebar__badge">Admin</span>
          {sidebarOpen && (
            <button
              type="button"
              className="admin-hamburger"
              style={{
                position: 'static',
                display: 'inline-flex',
                boxShadow: 'none',
                border: 'none',
                marginLeft: 'auto',
              }}
              onClick={closeSidebar}
              aria-label="Fechar menu de navegação"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="admin-sidebar__nav" aria-label="Menu admin">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              className={`admin-sidebar__link ${isActive(to, exact) ? 'admin-sidebar__link--active' : ''}`}
              onClick={closeSidebar}
              aria-current={isActive(to, exact) ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          ))}

          <div className="admin-sidebar__separator" role="separator" />

          <Link
            to="/dashboard"
            className="admin-sidebar__link admin-sidebar__link--back"
            onClick={closeSidebar}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Voltar ao app
          </Link>
        </nav>

        <div className="admin-sidebar__footer">
          <span className="admin-sidebar__email">{user?.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-sidebar__logout"
            aria-label="Sair da conta"
          >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="admin-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
