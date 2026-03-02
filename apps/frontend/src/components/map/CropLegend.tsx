import { useMemo, useState } from 'react';
import { Palette, X } from 'lucide-react';
import { getCropColor, formatArea } from './FarmMap';
import type { FarmMapData } from '@/hooks/useFarmMap';
import './CropLegend.css';

type PlotBoundary = FarmMapData['plotBoundaries'][number];

interface CropGroup {
  key: string;
  label: string;
  color: string;
  count: number;
  totalAreaHa: number;
}

interface CropLegendProps {
  plotBoundaries: PlotBoundary[];
  cropFilter: Set<string>;
  onToggleCrop: (cropKey: string) => void;
}

function CropLegend({ plotBoundaries, cropFilter, onToggleCrop }: CropLegendProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, CropGroup>();

    for (const pb of plotBoundaries) {
      const crop = pb.plot.currentCrop;
      const key = crop?.toLowerCase().trim() ?? '__none__';
      const label = crop ?? 'Sem cultura';
      const color = getCropColor(crop);

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalAreaHa += pb.plot.boundaryAreaHa ?? 0;
      } else {
        map.set(key, {
          key,
          label,
          color,
          count: 1,
          totalAreaHa: pb.plot.boundaryAreaHa ?? 0,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalAreaHa - a.totalAreaHa);
  }, [plotBoundaries]);

  const totals = useMemo(() => {
    let count = 0;
    let area = 0;
    for (const g of groups) {
      count += g.count;
      area += g.totalAreaHa;
    }
    return { count, area };
  }, [groups]);

  const hasFilter = cropFilter.size > 0;

  const legendContent = (
    <div className="crop-legend__content">
      <div className="crop-legend__header">
        <h3 className="crop-legend__title">Culturas</h3>
        {hasFilter && (
          <button
            type="button"
            className="crop-legend__clear"
            onClick={() => {
              for (const g of groups) {
                if (cropFilter.has(g.key)) {
                  onToggleCrop(g.key);
                }
              }
            }}
            aria-label="Limpar filtros de cultura"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <ul className="crop-legend__list">
        {groups.map((group) => {
          const isFiltered = hasFilter && !cropFilter.has(group.key);
          return (
            <li key={group.key}>
              <button
                type="button"
                className={`crop-legend__item${isFiltered ? ' crop-legend__item--filtered' : ''}`}
                onClick={() => onToggleCrop(group.key)}
                aria-pressed={hasFilter ? cropFilter.has(group.key) : undefined}
                aria-label={`Filtrar por ${group.label}`}
              >
                <span
                  className="crop-legend__swatch"
                  style={{ backgroundColor: group.color }}
                  aria-hidden="true"
                />
                <span className="crop-legend__label">{group.label}</span>
                <span className="crop-legend__count">{group.count}</span>
                <span className="crop-legend__area">{formatArea(group.totalAreaHa)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="crop-legend__total">
        {totals.count} talhões · {formatArea(totals.area)}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile FAB */}
      <button
        type="button"
        className="crop-legend__fab"
        aria-label="Abrir legenda de culturas"
        onClick={() => setMobileOpen(true)}
      >
        <Palette size={20} aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="crop-legend__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop panel / Mobile bottom sheet */}
      <div
        className={`crop-legend${mobileOpen ? ' crop-legend--mobile-open' : ''}`}
        role="region"
        aria-label="Legenda de culturas"
      >
        {mobileOpen && (
          <button
            type="button"
            className="crop-legend__close-mobile"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar legenda"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        {legendContent}
      </div>
    </>
  );
}

export default CropLegend;
