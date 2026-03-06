import { X, Trash2 } from 'lucide-react';
import { formatArea } from '@/components/map/FarmMap';
import OccupancyBadge from './OccupancyBadge';
import type { FarmLocationMapItem } from '@/types/farm-location';
import {
  PASTURE_STATUS_LABELS,
  FACILITY_STATUS_LABELS,
  FACILITY_TYPE_LABELS,
  FORAGE_TYPE_LABELS,
} from '@/types/farm-location';
import type {
  PastureStatus,
  FacilityStatus,
  ForageType,
  FacilityType,
} from '@/types/farm-location';
import './LocationDetailsPanel.css';

interface LocationDetailsPanelProps {
  location: FarmLocationMapItem | null;
  onClose: () => void;
  onDelete?: (location: FarmLocationMapItem) => void;
}

const PASTURE_STATUS_COLORS: Record<string, string> = {
  EM_USO: '#2E7D32',
  DESCANSO: '#FFA000',
  REFORMANDO: '#C62828',
};

function LocationDetailsPanel({ location, onClose, onDelete }: LocationDetailsPanelProps) {
  if (!location) return null;

  const isPasture = location.type === 'PASTURE';
  const statusLabel = isPasture
    ? (PASTURE_STATUS_LABELS[location.pastureStatus as PastureStatus] ?? '—')
    : (FACILITY_STATUS_LABELS[location.facilityStatus as FacilityStatus] ?? '—');
  const statusColor = isPasture
    ? (PASTURE_STATUS_COLORS[location.pastureStatus ?? ''] ?? '#6B7280')
    : undefined;

  return (
    <aside className="location-details" aria-label={`Detalhes: ${location.name}`}>
      <div className="location-details__header">
        <div className="location-details__header-left">
          {statusColor && (
            <span
              className="location-details__swatch"
              style={{ backgroundColor: statusColor }}
              aria-hidden="true"
            />
          )}
          <h2 className="location-details__name">{location.name}</h2>
        </div>
        <div className="location-details__header-actions">
          {onDelete && (
            <button
              type="button"
              className="location-details__action-btn location-details__action-btn--delete"
              onClick={() => onDelete(location)}
              aria-label={`Excluir ${location.name}`}
            >
              <Trash2 size={20} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="location-details__action-btn"
            onClick={onClose}
            aria-label="Fechar painel"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="location-details__body">
        <dl className="location-details__fields">
          <dt>Tipo</dt>
          <dd>{isPasture ? 'Pasto' : 'Instalação'}</dd>

          <dt>Status</dt>
          <dd>{statusLabel}</dd>

          {isPasture && location.forageType && (
            <>
              <dt>Forrageira</dt>
              <dd>
                {FORAGE_TYPE_LABELS[location.forageType as ForageType] ?? location.forageType}
              </dd>
            </>
          )}

          {!isPasture && location.facilityType && (
            <>
              <dt>Tipo instalação</dt>
              <dd>
                {FACILITY_TYPE_LABELS[location.facilityType as FacilityType] ??
                  location.facilityType}
              </dd>
            </>
          )}

          {location.boundaryAreaHa != null && (
            <>
              <dt>Área</dt>
              <dd className="location-details__area-value">
                {formatArea(location.boundaryAreaHa)}
              </dd>
            </>
          )}

          {(location.capacityUA != null || location.capacityAnimals != null) && (
            <>
              <dt>Capacidade</dt>
              <dd>
                {location.capacityUA != null && `${location.capacityUA} UA`}
                {location.capacityAnimals != null && `${location.capacityAnimals} animais`}
              </dd>
            </>
          )}

          <dt>Ocupação</dt>
          <dd>
            <OccupancyBadge
              occupancyPercent={location.occupancy.occupancyPercent}
              level={location.occupancy.level}
            />
            {location.occupancy.totalAnimals > 0 && (
              <span className="location-details__animal-count">
                {' '}
                ({location.occupancy.totalAnimals}{' '}
                {location.occupancy.totalAnimals === 1 ? 'animal' : 'animais'})
              </span>
            )}
          </dd>
        </dl>

        {location.description && (
          <div className="location-details__description">
            <strong>Descrição</strong>
            <p>{location.description}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default LocationDetailsPanel;
