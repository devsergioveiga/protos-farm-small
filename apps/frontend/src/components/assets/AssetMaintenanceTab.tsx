import { Wrench } from 'lucide-react';

// ─── AssetMaintenanceTab ──────────────────────────────────────────────

interface AssetMaintenanceTabProps {
  assetId: string;
}

export default function AssetMaintenanceTab(props: AssetMaintenanceTabProps) {
  if (!props.assetId) return null;
  return (
    <div className="maintenance-tab">
      <div className="maintenance-tab__empty">
        <Wrench
          size={48}
          aria-hidden="true"
          className="maintenance-tab__icon"
          color="var(--color-neutral-400)"
        />
        <p className="maintenance-tab__text">
          Manutencoes disponiveis na Fase 18. Por enquanto, os ativos estao sendo cadastrados.
        </p>
      </div>
    </div>
  );
}
