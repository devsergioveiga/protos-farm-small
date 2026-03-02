import { getCropColor, formatArea } from './FarmMap';
import type { CropSeasonItem } from '@/types/farm';
import './PlotSeasonTimeline.css';

interface PlotSeasonTimelineProps {
  seasons: CropSeasonItem[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatSeasonType(type: string): string {
  switch (type) {
    case 'SAFRA':
      return 'Safra';
    case 'SAFRINHA':
      return 'Safrinha';
    case 'INVERNO':
      return 'Inverno';
    default:
      return type;
  }
}

function PlotSeasonTimeline({ seasons }: PlotSeasonTimelineProps) {
  if (seasons.length === 0) {
    return (
      <div className="season-timeline__empty">
        <p className="season-timeline__empty-text">Nenhuma safra registrada ainda.</p>
      </div>
    );
  }

  return (
    <ol className="season-timeline" aria-label="Histórico de safras">
      {seasons.map((season, index) => {
        const cropColor = getCropColor(season.crop);
        const isLast = index === seasons.length - 1;

        return (
          <li key={season.id} className="season-timeline__item">
            <div className="season-timeline__connector" aria-hidden="true">
              <span className="season-timeline__dot" style={{ backgroundColor: cropColor }} />
              {!isLast && <span className="season-timeline__line" />}
            </div>

            <div className="season-timeline__card">
              <div className="season-timeline__card-header">
                <span className="season-timeline__crop">{season.crop}</span>
                <span className="season-timeline__season-tag">
                  {formatSeasonType(season.seasonType)} {season.seasonYear}
                </span>
              </div>

              <dl className="season-timeline__details">
                {season.varietyName && (
                  <>
                    <dt>Variedade</dt>
                    <dd>{season.varietyName}</dd>
                  </>
                )}

                <dt>Período</dt>
                <dd>
                  {formatDate(season.startDate)} – {formatDate(season.endDate)}
                </dd>

                {season.plantedAreaHa != null && (
                  <>
                    <dt>Área plantada</dt>
                    <dd className="season-timeline__mono">{formatArea(season.plantedAreaHa)}</dd>
                  </>
                )}

                {season.productivityKgHa != null && (
                  <>
                    <dt>Produtividade</dt>
                    <dd className="season-timeline__mono">
                      {season.productivityKgHa.toLocaleString('pt-BR')} kg/ha
                    </dd>
                  </>
                )}

                {season.totalProductionKg != null && (
                  <>
                    <dt>Produção total</dt>
                    <dd className="season-timeline__mono">
                      {season.totalProductionKg.toLocaleString('pt-BR')} kg
                    </dd>
                  </>
                )}
              </dl>

              {season.notes && <p className="season-timeline__notes">{season.notes}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default PlotSeasonTimeline;
