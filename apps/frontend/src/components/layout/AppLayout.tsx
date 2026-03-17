import { useState, useCallback } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { FarmProvider } from '@/stores/FarmContext';
import FarmSelector from '@/components/farm-selector/FarmSelector';
import FarmLimitBadge from '@/components/farm-limit-badge/FarmLimitBadge';
import NotificationBell from '@/components/notifications/NotificationBell';
import Sidebar from './Sidebar';
import './AppLayout.css';

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPlatformAdmin = user?.role === 'SUPER_ADMIN' && !user.organizationId;

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <FarmProvider>
      <div className="app-layout">
        <header className="app-topbar">
          <div className="app-topbar__left">
            {!isPlatformAdmin && (
              <button
                type="button"
                className="app-topbar__hamburger"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu de navegação"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            )}
            <Link
              to={isPlatformAdmin ? '/admin' : '/dashboard'}
              className="app-topbar__logo"
              aria-label="Ir para o início"
            >
              Protos Farm
            </Link>
          </div>

          {!isPlatformAdmin && (
            <div className="app-topbar__center">
              <FarmSelector />
            </div>
          )}

          <div className="app-topbar__right">
            {user?.role === 'SUPER_ADMIN' && (
              <Link to="/admin" className="app-topbar__nav-link app-topbar__nav-link--admin">
                <ShieldCheck size={16} aria-hidden="true" />
                <span className="app-topbar__nav-text">Admin</span>
              </Link>
            )}

            {!isPlatformAdmin && <FarmLimitBadge />}

            {!isPlatformAdmin && <NotificationBell />}

            <div className="app-topbar__separator" role="separator" />

            <span className="app-topbar__user">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="app-topbar__logout"
              aria-label="Sair da conta"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="app-topbar__nav-text">Sair</span>
            </button>
          </div>
        </header>

        {!isPlatformAdmin && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

        <main
          className={`app-content ${!isPlatformAdmin ? 'app-content--with-sidebar' : ''}`}
          id="main-content"
        >
          <Outlet />
        </main>
      </div>
    </FarmProvider>
  );
}

export default AppLayout;
