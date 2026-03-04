import { X, Pencil, Scissors, BookOpen, FileEdit } from 'lucide-react';
import { getCropColor, formatArea } from './FarmMap';
import type { FieldPlot } from '@/types/farm';
import './PlotDetailsPanel.css';

interface PlotDetailsPanelProps {
  plot: FieldPlot | null;
  onClose: () => void;
  onEditAttributes?: (plot: FieldPlot) => void;
  onEditGeometry?: (plot: FieldPlot) => void;
  onSubdivide?: (plot: FieldPlot) => void;
  onViewHistory?: (plot: FieldPlot) => void;
}

function formatSoilType(soilType: string): string {
  return soilType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function PlotDetailsPanel({
  plot,
  onClose,
  onEditAttributes,
  onEditGeometry,
  onSubdivide,
  onViewHistory,
}: PlotDetailsPanelProps) {
  if (!plot) return null;

  const cropColor = getCropColor(plot.currentCrop);

  return (
    <div className="plot-details" role="region" aria-label="Detalhes do talhão">
      <div className="plot-details__header">
        <div className="plot-details__title-row">
          <span
            className="plot-details__swatch"
            style={{ backgroundColor: cropColor }}
            aria-hidden="true"
          />
          <h2 className="plot-details__name">{plot.name}</h2>
        </div>
        <div className="plot-details__header-actions">
          {onViewHistory && (
            <button
              type="button"
              className="plot-details__action-btn"
              onClick={() => onViewHistory(plot)}
              aria-label="Ver histórico do talhão"
            >
              <BookOpen size={20} aria-hidden="true" />
            </button>
          )}
          {onEditAttributes && (
            <button
              type="button"
              className="plot-details__action-btn"
              onClick={() => onEditAttributes(plot)}
              aria-label="Editar atributos do talhão"
            >
              <FileEdit size={20} aria-hidden="true" />
            </button>
          )}
          {onSubdivide && (
            <button
              type="button"
              className="plot-details__action-btn"
              onClick={() => onSubdivide(plot)}
              aria-label="Subdividir talhão"
            >
              <Scissors size={20} aria-hidden="true" />
            </button>
          )}
          {onEditGeometry && (
            <button
              type="button"
              className="plot-details__action-btn"
              onClick={() => onEditGeometry(plot)}
              aria-label="Editar perímetro"
            >
              <Pencil size={20} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="plot-details__close"
            onClick={onClose}
            aria-label="Fechar detalhes do talhão"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="plot-details__fields">
        {plot.code && (
          <>
            <dt>Código</dt>
            <dd>{plot.code}</dd>
          </>
        )}

        <dt>Cultura atual</dt>
        <dd>{plot.currentCrop ?? 'Não definida'}</dd>

        {plot.previousCrop && (
          <>
            <dt>Cultura anterior</dt>
            <dd>{plot.previousCrop}</dd>
          </>
        )}

        {plot.soilType && (
          <>
            <dt>Tipo de solo</dt>
            <dd>{formatSoilType(plot.soilType)}</dd>
          </>
        )}

        <dt>Área</dt>
        <dd className="plot-details__area-value">{formatArea(plot.boundaryAreaHa)}</dd>

        {plot.notes && (
          <>
            <dt>Observações</dt>
            <dd className="plot-details__notes">{plot.notes}</dd>
          </>
        )}

        <dt>Criado em</dt>
        <dd>{formatDate(plot.createdAt)}</dd>
      </dl>
    </div>
  );
}

export default PlotDetailsPanel;
