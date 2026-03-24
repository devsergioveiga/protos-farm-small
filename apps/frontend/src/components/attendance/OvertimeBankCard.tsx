import { Clock, Coins, ArrowDownCircle, AlertTriangle } from 'lucide-react';
import type { OvertimeBankSummary } from '@/types/attendance';

interface OvertimeBankCardProps {
  summary: OvertimeBankSummary;
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${h}h${m > 0 ? `${String(m).padStart(2, '0')}m` : ''}`;
}

export default function OvertimeBankCard({ summary }: OvertimeBankCardProps) {
  const hasBalance = summary.currentBalance > 0;
  const hasExpiryWarning = summary.expiringIn30Days > 0;
  const hasExpiryUrgent = summary.expiringIn7Days > 0;

  return (
    <article className="overtime-card" aria-label={`Banco de horas de ${summary.employeeName}`}>
      <header className="overtime-card__header">
        <div className="overtime-card__employee">
          <span className="overtime-card__employee-name">{summary.employeeName}</span>
        </div>
        <div className={`overtime-card__balance ${!hasBalance ? 'overtime-card__balance--zero' : ''}`}>
          <span className="overtime-card__balance-value" aria-label={`Saldo atual: ${formatMinutesToHours(summary.currentBalance)}`}>
            {formatMinutesToHours(summary.currentBalance)}
          </span>
          <span className="overtime-card__balance-label">saldo atual</span>
        </div>
      </header>

      {/* Expiry alerts */}
      {hasExpiryUrgent && (
        <div className="overtime-card__alert overtime-card__alert--urgent" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>{formatMinutesToHours(summary.expiringIn7Days)}</strong> vencem em 7 dias
          </span>
        </div>
      )}
      {hasExpiryWarning && !hasExpiryUrgent && (
        <div className="overtime-card__alert overtime-card__alert--warning" role="alert">
          <Clock size={16} aria-hidden="true" />
          <span>
            <strong>{formatMinutesToHours(summary.expiringIn30Days)}</strong> vencem em 30 dias
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="overtime-card__stats">
        <div className="overtime-card__stat">
          <Coins size={14} aria-hidden="true" className="overtime-card__stat-icon overtime-card__stat-icon--credit" />
          <span className="overtime-card__stat-label">Créditos</span>
          <span className="overtime-card__stat-value">{formatMinutesToHours(summary.totalCredits)}</span>
        </div>
        <div className="overtime-card__stat">
          <ArrowDownCircle size={14} aria-hidden="true" className="overtime-card__stat-icon overtime-card__stat-icon--comp" />
          <span className="overtime-card__stat-label">Compensações</span>
          <span className="overtime-card__stat-value">{formatMinutesToHours(summary.totalCompensations)}</span>
        </div>
      </div>

      {/* Empty state */}
      {!hasBalance && summary.entries.length === 0 && (
        <div className="overtime-card__empty">
          <p className="overtime-card__empty-title">Sem saldo no banco de horas</p>
          <p className="overtime-card__empty-body">Nenhuma hora extra acumulada para este período.</p>
        </div>
      )}

      {/* Entries list (expiring) */}
      {hasExpiryWarning && summary.entries.length > 0 && (
        <details className="overtime-card__entries">
          <summary className="overtime-card__entries-toggle">
            Ver entradas com vencimento
          </summary>
          <ul className="overtime-card__entries-list">
            {summary.entries
              .filter((e) => e.expiresAt)
              .map((entry) => (
                <li key={entry.id} className="overtime-card__entry">
                  <span className="overtime-card__entry-month">{entry.referenceMonth}</span>
                  <span className="overtime-card__entry-minutes overtime-card__entry-minutes--mono">
                    {formatMinutesToHours(entry.minutes)}
                  </span>
                  <span className="overtime-card__entry-expires">
                    vence {new Date(entry.expiresAt).toLocaleDateString('pt-BR')}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </article>
  );
}
