import type { FarmLocationMapItem } from '@/types/farm-location';
import { PASTURE_STATUS_LABELS, FACILITY_TYPE_LABELS } from '@/types/farm-location';
import type { PastureStatus, FacilityType } from '@/types/farm-location';
import './LocationLegend.css';

interface LocationLegendProps {
  locations: FarmLocationMapItem[];
  showPastures: boolean;
  showFacilities: boolean;
}

export const PASTURE_STATUS_COLORS: Record<string, string> = {
  EM_USO: '#2E7D32',
  DESCANSO: '#FFA000',
  REFORMANDO: '#C62828',
};

export const FACILITY_TYPE_COLORS: Record<string, string> = {
  GALPAO: '#1565C0',
  BEZERREIRO: '#7B1FA2',
  CURRAL: '#4E342E',
  BAIA: '#00695C',
  SALA_ORDENHA: '#0277BD',
  ESTABULO: '#558B2F',
  CONFINAMENTO: '#D84315',
  OUTRO: '#757575',
};

function LocationLegend({ locations, showPastures, showFacilities }: LocationLegendProps) {
  const pastures = locations.filter((l) => l.type === 'PASTURE');
  const facilities = locations.filter((l) => l.type === 'FACILITY');

  const pasturesByStatus = new Map<string, number>();
  for (const p of pastures) {
    const key = p.pastureStatus ?? 'EM_USO';
    pasturesByStatus.set(key, (pasturesByStatus.get(key) ?? 0) + 1);
  }

  const facilitiesByType = new Map<string, number>();
  for (const f of facilities) {
    const key = f.facilityType ?? 'OUTRO';
    facilitiesByType.set(key, (facilitiesByType.get(key) ?? 0) + 1);
  }

  const hasPastures = showPastures && pastures.length > 0;
  const hasFacilities = showFacilities && facilities.length > 0;

  if (!hasPastures && !hasFacilities) return null;

  return (
    <div className="location-legend" aria-label="Legenda de locais">
      {hasPastures && (
        <div className="location-legend__section">
          <span className="location-legend__section-title">Pastos</span>
          {Array.from(pasturesByStatus.entries()).map(([status, count]) => (
            <div key={status} className="location-legend__item">
              <span
                className="location-legend__swatch"
                style={{ backgroundColor: PASTURE_STATUS_COLORS[status] ?? '#6B7280' }}
                aria-hidden="true"
              />
              <span className="location-legend__label">
                {PASTURE_STATUS_LABELS[status as PastureStatus] ?? status}
              </span>
              <span className="location-legend__count">{count}</span>
            </div>
          ))}
        </div>
      )}
      {hasFacilities && (
        <div className="location-legend__section">
          <span className="location-legend__section-title">Instalações</span>
          {Array.from(facilitiesByType.entries()).map(([type, count]) => (
            <div key={type} className="location-legend__item">
              <span
                className="location-legend__swatch"
                style={{ backgroundColor: FACILITY_TYPE_COLORS[type] ?? '#757575' }}
                aria-hidden="true"
              />
              <span className="location-legend__label">
                {FACILITY_TYPE_LABELS[type as FacilityType] ?? type}
              </span>
              <span className="location-legend__count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LocationLegend;
