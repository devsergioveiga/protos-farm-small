import { Clock } from 'lucide-react';
import { usePlotBoundaryVersions } from '@/hooks/usePlotBoundaryVersions';
import type { PlotBoundaryVersionItem } from '@/types/farm';
import './PlotBoundaryVersionsList.css';

interface PlotBoundaryVersionsListProps {
  farmId: string;
  plotId: string;
}

const EDIT_SOURCE_LABELS: Record<string, string> = {
  map_editor: 'Editor de mapa',
  file_upload: 'Upload de arquivo',
  subdivide: 'Subdivisão',
  merge: 'Mesclagem',
};

function translateEditSource(source: string): string {
  return EDIT_SOURCE_LABELS[source] ?? source;
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
    <div className="pbv-list__skeleton" aria-busy="true" aria-label="Carregando versões">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="pbv-list__skeleton-card">
          <div className="pbv-list__skeleton-line pbv-list__skeleton-line--wide" />
          <div className="pbv-list__skeleton-line pbv-list__skeleton-line--medium" />
          <div className="pbv-list__skeleton-line pbv-list__skeleton-line--narrow" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="pbv-list__empty">
      <Clock size={48} aria-hidden="true" className="pbv-list__empty-icon" />
      <h3 className="pbv-list__empty-title">Nenhuma versão anterior registrada</h3>
      <p className="pbv-list__empty-text">
        O histórico de versões aparecerá aqui quando o perímetro do talhão for atualizado.
      </p>
    </div>
  );
}

function VersionCard({
  version,
  isCurrent,
}: {
  version: PlotBoundaryVersionItem;
  isCurrent: boolean;
}) {
  return (
    <div className={`pbv-card ${isCurrent ? 'pbv-card--current' : ''}`}>
      <div className="pbv-card__header">
        <span className="pbv-card__version-badge">v{version.version}</span>
        {isCurrent && <span className="pbv-card__current-badge">Atual</span>}
      </div>
      <p className="pbv-card__date">{formatDate(version.editedAt)}</p>
      <div className="pbv-card__details">
        <span className="pbv-card__area">{formatArea(version.boundaryAreaHa)}</span>
        <span className="pbv-card__source">{translateEditSource(version.editSource)}</span>
      </div>
    </div>
  );
}

function PlotBoundaryVersionsList({ farmId, plotId }: PlotBoundaryVersionsListProps) {
  const { versions, isLoading, error } = usePlotBoundaryVersions(farmId, plotId);

  if (isLoading) return <SkeletonCards />;

  if (error) {
    return (
      <div className="pbv-list__error" role="alert">
        <p>Não foi possível carregar as versões do perímetro. Tente novamente.</p>
      </div>
    );
  }

  if (versions.length === 0) return <EmptyState />;

  const maxVersion = Math.max(...versions.map((v) => v.version));

  return (
    <ul className="pbv-list" role="list">
      {versions.map((version) => (
        <li key={version.id}>
          <VersionCard version={version} isCurrent={version.version === maxVersion} />
        </li>
      ))}
    </ul>
  );
}

export default PlotBoundaryVersionsList;
