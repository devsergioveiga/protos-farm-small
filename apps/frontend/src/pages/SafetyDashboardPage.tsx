import { Shield } from 'lucide-react';

export default function SafetyDashboardPage() {
  return (
    <main id="main-content" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Shield size={24} aria-hidden="true" style={{ color: 'var(--color-primary-600)' }} />
        <h1
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: '1.5rem',
            color: 'var(--color-neutral-800)',
            margin: 0,
          }}
        >
          Dashboard NR-31
        </h1>
      </div>
      <p style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", color: 'var(--color-neutral-500)' }}>
        Módulo em implementação.
      </p>
    </main>
  );
}
