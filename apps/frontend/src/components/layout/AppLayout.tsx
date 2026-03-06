import { useCallback } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  LogOut,
  LayoutDashboard,
  MapPin,
  Users,
  UserCheck,
  Shield,
  ShieldCheck,
  Beef,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { FarmProvider } from '@/stores/FarmContext';
import FarmSelector from '@/components/farm-selector/FarmSelector';
import FarmLimitBadge from '@/components/farm-limit-badge/FarmLimitBadge';
import './AppLayout.css';

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const isActive = (path: string) => location.pathname.startsWith(path);
  const isPlatformAdmin = user?.role === 'SUPER_ADMIN' && !user.organizationId;

  return (
    <FarmProvider>
      <div className="app-layout">
        <header className="app-topbar">
          <div className="app-topbar__left">
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

          <nav className="app-topbar__right" aria-label="Menu principal">
            {user?.role === 'SUPER_ADMIN' && (
              <Link to="/admin" className="app-topbar__nav-link app-topbar__nav-link--admin">
                <ShieldCheck size={16} aria-hidden="true" />
                <span className="app-topbar__nav-label">Admin</span>
              </Link>
            )}
            {!isPlatformAdmin && (
              <>
                <Link
                  to="/dashboard"
                  className={`app-topbar__nav-link ${isActive('/dashboard') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <LayoutDashboard size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Início</span>
                </Link>
                <Link
                  to="/farms"
                  className={`app-topbar__nav-link ${isActive('/farms') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <MapPin size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Fazendas</span>
                </Link>
                <Link
                  to="/producers"
                  className={`app-topbar__nav-link ${isActive('/producers') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <UserCheck size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Produtores</span>
                </Link>
                <Link
                  to="/animals"
                  className={`app-topbar__nav-link ${isActive('/animals') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <Beef size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Animais</span>
                </Link>
                <Link
                  to="/lots"
                  className={`app-topbar__nav-link ${isActive('/lots') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <Layers size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Lotes</span>
                </Link>
                <Link
                  to="/users"
                  className={`app-topbar__nav-link ${isActive('/users') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <Users size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Usuários</span>
                </Link>
                <Link
                  to="/roles"
                  className={`app-topbar__nav-link ${isActive('/roles') ? 'app-topbar__nav-link--active' : ''}`}
                >
                  <Shield size={16} aria-hidden="true" />
                  <span className="app-topbar__nav-label">Papéis</span>
                </Link>

                <FarmLimitBadge />
              </>
            )}

            <div className="app-topbar__separator" role="separator" />

            <span className="app-topbar__user">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="app-topbar__logout"
              aria-label="Sair da conta"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="app-topbar__nav-label">Sair</span>
            </button>
          </nav>
        </header>

        <main className="app-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </FarmProvider>
  );
}

export default AppLayout;
