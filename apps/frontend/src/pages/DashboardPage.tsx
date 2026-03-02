import { useAuth } from '@/stores/AuthContext';

function DashboardPage() {
  const { user } = useAuth();

  return (
    <section
      style={{
        padding: 'var(--space-8)',
        maxWidth: 'var(--container-max)',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--color-neutral-800)',
          marginBottom: 'var(--space-4)',
        }}
      >
        Dashboard
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--color-neutral-600)',
        }}
      >
        Bem-vindo, <strong>{user?.email}</strong>
      </p>
    </section>
  );
}

export default DashboardPage;
