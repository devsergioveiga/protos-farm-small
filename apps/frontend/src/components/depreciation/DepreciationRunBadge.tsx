import type { DepreciationRun } from '@/types/depreciation';

// ─── DepreciationRunBadge ─────────────────────────────────────────────────────

interface DepreciationRunBadgeProps {
  run: DepreciationRun | null;
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DepreciationRunBadge({ run }: DepreciationRunBadgeProps) {
  if (!run) {
    return (
      <span
        className="depreciation-run-badge depreciation-run-badge--none"
        role="status"
        aria-live="polite"
      >
        <span className="depreciation-run-badge__dot" aria-hidden="true" />
        Nenhuma execucao
      </span>
    );
  }

  if (run.status === 'PENDING') {
    return (
      <span
        className="depreciation-run-badge depreciation-run-badge--pending"
        role="status"
        aria-live="polite"
      >
        <span className="depreciation-run-badge__spinner" aria-hidden="true" />
        Em execucao...
      </span>
    );
  }

  if (run.status === 'COMPLETED') {
    return (
      <span
        className="depreciation-run-badge depreciation-run-badge--completed"
        role="status"
        aria-live="polite"
      >
        <span className="depreciation-run-badge__dot" aria-hidden="true" />
        {run.completedAt ? `Executado em ${formatDateTime(run.completedAt)}` : 'Concluido'}
      </span>
    );
  }

  if (run.status === 'PARTIAL') {
    return (
      <span
        className="depreciation-run-badge depreciation-run-badge--partial"
        role="status"
        aria-live="polite"
      >
        <span className="depreciation-run-badge__dot" aria-hidden="true" />
        Parcial &mdash; {run.skippedCount} ativo{run.skippedCount !== 1 ? 's' : ''} ignorado
        {run.skippedCount !== 1 ? 's' : ''}
      </span>
    );
  }

  // FAILED
  return (
    <span
      className="depreciation-run-badge depreciation-run-badge--failed"
      role="status"
      aria-live="polite"
    >
      <span className="depreciation-run-badge__dot" aria-hidden="true" />
      Falhou &mdash; ver detalhes
    </span>
  );
}
