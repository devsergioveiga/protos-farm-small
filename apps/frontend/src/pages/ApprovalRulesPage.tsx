import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';

function ApprovalRulesPage() {
  return (
    <main style={{ padding: 'var(--space-6)', maxWidth: 'var(--container-max)', margin: '0 auto' }}>
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-neutral-500)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Link to="/dashboard" style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}>
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Alcadas</span>
      </nav>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-neutral-800)',
            margin: 0,
          }}
        >
          Regras de Alcada
        </h1>
      </header>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-16) var(--space-8)',
          gap: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <Settings2 size={48} aria-hidden="true" style={{ color: 'var(--color-neutral-300)' }} />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-neutral-700)',
            margin: 0,
          }}
        >
          Nenhuma regra configurada
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-neutral-500)',
            margin: 0,
          }}
        >
          Configure as regras de alcada para aprovar requisicoes de compra.
        </p>
      </div>
    </main>
  );
}

export default ApprovalRulesPage;
