import { useState } from 'react';
import { Layers } from 'lucide-react';
import './LayerControlPanel.css';

export interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
  disabled?: boolean;
  futureLabel?: string;
}

interface LayerControlPanelProps {
  layers: LayerConfig[];
  onToggle: (layerId: string) => void;
}

function LayerControlPanel({ layers, onToggle }: LayerControlPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const panelContent = (
    <ul className="layer-panel__list">
      {layers.map((layer) => (
        <li key={layer.id} className="layer-panel__item">
          <button
            type="button"
            role="switch"
            aria-checked={layer.enabled}
            aria-label={`Camada ${layer.label}`}
            className="layer-panel__toggle"
            disabled={layer.disabled}
            onClick={() => onToggle(layer.id)}
          />
          <span
            className={`layer-panel__label${layer.disabled ? ' layer-panel__label--disabled' : ''}`}
          >
            {layer.label}
          </span>
          {layer.futureLabel && <span className="layer-panel__badge">{layer.futureLabel}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* FAB for mobile */}
      <button
        type="button"
        className="layer-panel__fab"
        aria-label="Abrir painel de camadas"
        onClick={() => setMobileOpen(true)}
      >
        <Layers size={20} aria-hidden="true" />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="layer-panel__overlay layer-panel__overlay--open"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop panel (always visible >=768px) / Mobile bottom sheet */}
      <div
        className={`layer-panel${mobileOpen ? ' layer-panel--mobile-open' : ''}`}
        role="region"
        aria-label="Camadas do mapa"
      >
        <h3 className="layer-panel__title">Camadas</h3>
        {panelContent}
      </div>
    </>
  );
}

export default LayerControlPanel;
