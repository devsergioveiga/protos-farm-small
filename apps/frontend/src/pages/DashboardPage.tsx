import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main
      style={{
        padding: 'var(--space-8)',
        maxWidth: 'var(--container-max)',
        margin: '0 auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-8)',
        }}
      >
        <h1>Dashboard</h1>
        <button
          onClick={handleLogout}
          aria-label="Sair da conta"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            padding: 'var(--space-3) var(--space-4)',
            minHeight: '48px',
            background: 'var(--color-neutral-0)',
            color: 'var(--color-neutral-700)',
            border: '1px solid var(--color-neutral-300)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          Sair
        </button>
      </header>

      <section>
        <p>
          Conectado como <strong>{user?.email}</strong>
        </p>
      </section>
    </main>
  );
}

export default DashboardPage;
