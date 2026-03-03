import { Building2 } from 'lucide-react';

function AdminOrganizationsPage() {
  return (
    <section>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--color-neutral-800)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Organizações
      </h1>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-12)',
          background: 'var(--color-neutral-50)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-neutral-200)',
        }}
      >
        <Building2 size={48} color="var(--color-neutral-400)" aria-hidden="true" />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-neutral-500)',
          }}
        >
          Em construção. O gerenciamento de organizações será implementado aqui.
        </p>
      </div>
    </section>
  );
}

export default AdminOrganizationsPage;
