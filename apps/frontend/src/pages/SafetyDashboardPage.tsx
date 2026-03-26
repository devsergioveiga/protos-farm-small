import { Shield } from 'lucide-react';
import './SafetyDashboardPage.css';

export default function SafetyDashboardPage() {
  return (
    <main className="safety-dashboard-page">
      <header className="safety-dashboard-page__header">
        <h1 className="safety-dashboard-page__title">
          <Shield size={24} aria-hidden="true" />
          Dashboard NR-31
        </h1>
      </header>
      <p className="safety-dashboard-page__placeholder">
        Painel de conformidade NR-31 — em implementação.
      </p>
    </main>
  );
}
