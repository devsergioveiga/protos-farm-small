import { useState, useCallback } from 'react';
import { X, Clock } from 'lucide-react';
import { useBoundaryVersions } from '@/hooks/useBoundaryVersions';
import type { BoundaryVersionItem } from '@/types/farm';
import './BoundaryVersionsPanel.css';

interface BoundaryVersionsPanelProps {
  farmId: string;
  registrationId?: string;
  entityLabel: string;
  onClose: () => void;
  onPreviewVersion: (geojson: GeoJSON.Polygon | null) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatArea(areaHa: number): string {
  return `${areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

function SkeletonCards() {
  return (
    <div className="bv-panel__skeleton" aria-busy="true" aria-label="Carregando versões">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bv-panel__skeleton-card">
          <div className="bv-panel__skeleton-line bv-panel__skeleton-line--wide" />
          <div className="bv-panel__skeleton-line bv-panel__skeleton-line--medium" />
          <div className="bv-panel__skeleton-line bv-panel__skeleton-line--narrow" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bv-panel__empty">
      <Clock size={48} aria-hidden="true" className="bv-panel__empty-icon" />
      <h3 className="bv-panel__empty-title">Nenhuma versão anterior</h3>
      <p className="bv-panel__empty-text">
        O histórico de versões aparecerá aqui quando o perímetro for atualizado.
      </p>
    </div>
  );
}

function VersionCard({
  version,
  isCurrent,
  isSelected,
  isLoadingGeometry,
  onSelect,
}: {
  version: BoundaryVersionItem;
  isCurrent: boolean;
  isSelected: boolean;
  isLoadingGeometry: boolean;
  onSelect: () => void;
}) {
  const cardClasses = [
    'bv-card',
    isCurrent ? 'bv-card--current' : '',
    isSelected ? 'bv-card--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cardClasses}
      onClick={isCurrent ? undefined : onSelect}
      aria-label={
        isCurrent
          ? `Versão ${version.version} (atual)`
          : `Visualizar versão ${version.version} no mapa`
      }
      aria-pressed={isSelected}
      disabled={isCurrent}
    >
      <div className="bv-card__header">
        <span className="bv-card__version-badge">v{version.version}</span>
        {isCurrent && <span className="bv-card__current-badge">Atual</span>}
      </div>
      <p className="bv-card__date">{formatDate(version.uploadedAt)}</p>
      <div className="bv-card__details">
        <span className="bv-card__area">{formatArea(version.boundaryAreaHa)}</span>
        {version.filename && <span className="bv-card__filename">{version.filename}</span>}
      </div>
      {isLoadingGeometry && (
        <span className="bv-card__loading" aria-live="polite">
          Carregando geometria…
        </span>
      )}
    </button>
  );
}

function BoundaryVersionsPanel({
  farmId,
  registrationId,
  entityLabel,
  onClose,
  onPreviewVersion,
}: BoundaryVersionsPanelProps) {
  const { versions, isLoading, error, fetchVersionGeometry } = useBoundaryVersions(
    farmId,
    registrationId,
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (version: BoundaryVersionItem) => {
      if (selectedVersionId === version.id) {
        setSelectedVersionId(null);
        onPreviewVersion(null);
        return;
      }

      setLoadingVersionId(version.id);
      const detail = await fetchVersionGeometry(version.id);
      setLoadingVersionId(null);

      if (detail) {
        setSelectedVersionId(version.id);
        onPreviewVersion(detail.boundaryGeoJSON);
      }
    },
    [selectedVersionId, fetchVersionGeometry, onPreviewVersion],
  );

  const maxVersion = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) : 0;

  return (
    <div className="bv-panel" role="region" aria-label={`Histórico de perímetro ${entityLabel}`}>
      <div className="bv-panel__header">
        <h2 className="bv-panel__title">Histórico {entityLabel}</h2>
        <button
          type="button"
          className="bv-panel__close"
          onClick={onClose}
          aria-label="Fechar histórico de versões"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="bv-panel__body">
        {isLoading ? (
          <SkeletonCards />
        ) : error ? (
          <div className="bv-panel__error" role="alert">
            <p>{error}</p>
          </div>
        ) : versions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="bv-panel__list">
            {versions.map((version) => (
              <li key={version.id}>
                <VersionCard
                  version={version}
                  isCurrent={version.version === maxVersion}
                  isSelected={selectedVersionId === version.id}
                  isLoadingGeometry={loadingVersionId === version.id}
                  onSelect={() => void handleSelect(version)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default BoundaryVersionsPanel;
