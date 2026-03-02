import { Map, Satellite, Layers } from 'lucide-react';
import './BaseMapSelector.css';

export type BaseMapType = 'topographic' | 'satellite' | 'hybrid';

interface BaseMapSelectorProps {
  selected: BaseMapType;
  onChange: (type: BaseMapType) => void;
}

const options: { type: BaseMapType; label: string; icon: typeof Map }[] = [
  { type: 'topographic', label: 'Topo', icon: Map },
  { type: 'satellite', label: 'Satélite', icon: Satellite },
  { type: 'hybrid', label: 'Híbrido', icon: Layers },
];

function BaseMapSelector({ selected, onChange }: BaseMapSelectorProps) {
  return (
    <div className="basemap-selector" role="group" aria-label="Tipo de mapa base">
      {options.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          className="basemap-selector__btn"
          aria-pressed={selected === type}
          onClick={() => onChange(type)}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default BaseMapSelector;
