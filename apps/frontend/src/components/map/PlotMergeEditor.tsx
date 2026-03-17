import { useEffect, useRef, useState, useCallback } from 'react';
import { Combine, X, Eye } from 'lucide-react';
import L from 'leaflet';
import { api } from '@/services/api';
import { getCropColor, formatArea } from './FarmMap';
import type { FieldPlot, MergePreviewResult, BoundaryInfo } from '@/types/farm';
import './PlotMergeEditor.css';

interface PlotBoundaryRef {
  plotId: string;
  plot: FieldPlot;
  boundary: BoundaryInfo;
}

interface PlotMergeEditorProps {
  plotBoundaries: PlotBoundaryRef[];
  farmBoundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  farmId: string;
  onComplete: () => void;
  onCancel: () => void;
}

function PlotMergeEditor({
  plotBoundaries,
  farmBoundary,
  farmId,
  onComplete,
  onCancel,
}: PlotMergeEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const plotLayersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const previewLayerRef = useRef<L.GeoJSON | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MergePreviewResult | null>(null);
  const [mergeName, setMergeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validPlots = plotBoundaries.filter((pb) => pb.boundary.boundaryGeoJSON);

  const toggleSelectionRef = useRef<(plotId: string) => void>(() => {});

  const toggleSelection = useCallback((plotId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(plotId)) {
        next.delete(plotId);
      } else {
        next.add(plotId);
      }
      return next;
    });
    setPreview(null);
    setError(null);
  }, []);

  toggleSelectionRef.current = toggleSelection;

  const handlePreview = useCallback(async () => {
    if (selectedIds.size < 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.post<MergePreviewResult>(
        `/org/farms/${farmId}/plots/merge/preview`,
        { plotIds: Array.from(selectedIds) },
      );
      setPreview(result);
      setMergeName(result.suggestedName);

      // Show preview on map
      if (previewLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(previewLayerRef.current);
        previewLayerRef.current = null;
      }
      if (mapRef.current) {
        const layer = L.geoJSON(result.mergedGeojson, {
          style: {
            color: '#2E7D32',
            weight: 3,
            dashArray: '8 4',
            fillColor: '#2E7D32',
            fillOpacity: 0.2,
            interactive: false,
          },
        }).addTo(mapRef.current);
        previewLayerRef.current = layer;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao pré-visualizar mesclagem';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, selectedIds]);

  const handleMerge = useCallback(async () => {
    if (selectedIds.size < 2 || !mergeName) return;
    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/org/farms/${farmId}/plots/merge`, {
        plotIds: Array.from(selectedIds),
        name: mergeName,
      });
      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mesclar talhões';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, selectedIds, mergeName, onComplete]);

  // Update layer styles when selection changes
  useEffect(() => {
    plotLayersRef.current.forEach((layer, plotId) => {
      const isSelected = selectedIds.has(plotId);
      layer.setStyle({
        color: isSelected ? '#1976D2' : '#888',
        weight: isSelected ? 3 : 1,
        fillOpacity: isSelected ? 0.3 : 0.15,
      });
    });
  }, [selectedIds]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      preferCanvas: true,
      zoomControl: true,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri', maxZoom: 19 },
    ).addTo(map);

    // Farm boundary reference
    if (farmBoundary) {
      L.geoJSON(farmBoundary, {
        style: { color: '#2E7D32', weight: 2, dashArray: '8 4', fill: false, interactive: false },
      }).addTo(map);
    }

    // All plots as clickable layers
    const allBounds = L.latLngBounds([]);
    const plots = plotBoundaries.filter((pb) => pb.boundary.boundaryGeoJSON);

    for (const pb of plots) {
      if (!pb.boundary.boundaryGeoJSON) continue;

      const layer = L.geoJSON(pb.boundary.boundaryGeoJSON, {
        style: {
          color: '#888',
          weight: 1,
          fillColor: getCropColor(pb.plot.currentCrop),
          fillOpacity: 0.15,
        },
      });

      layer.on('click', () => {
        toggleSelectionRef.current(pb.plotId);
      });

      layer.bindTooltip(pb.plot.name, { sticky: true });
      layer.addTo(map);
      plotLayersRef.current.set(pb.plotId, layer);

      const layerBounds = layer.getBounds();
      if (layerBounds.isValid()) {
        allBounds.extend(layerBounds);
      }
    }

    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [60, 60] });
    }

    mapRef.current = map;

    const currentPlotLayers = plotLayersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      currentPlotLayers.clear();
      previewLayerRef.current = null;
    };
  }, [plotBoundaries, farmBoundary]);

  return (
    <div className="plot-merge" role="region" aria-label="Mesclagem de talhões">
      <div className="plot-merge__toolbar">
        <h2 className="plot-merge__title">Mesclar talhões</h2>
        <div className="plot-merge__actions">
          <button
            type="button"
            className="plot-merge__btn plot-merge__btn--secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X size={20} aria-hidden="true" />
            Cancelar
          </button>
          {!preview && (
            <button
              type="button"
              className="plot-merge__btn plot-merge__btn--secondary"
              onClick={() => void handlePreview()}
              disabled={isLoading || selectedIds.size < 2}
            >
              <Eye size={20} aria-hidden="true" />
              Pré-visualizar
            </button>
          )}
          {preview && (
            <button
              type="button"
              className="plot-merge__btn plot-merge__btn--primary"
              onClick={() => void handleMerge()}
              disabled={isLoading || !mergeName}
            >
              <Combine size={20} aria-hidden="true" />
              Mesclar
            </button>
          )}
        </div>
      </div>

      <div className="plot-merge__content">
        <div className="plot-merge__map-container" ref={mapContainerRef}>
          {selectedIds.size < 2 && !isLoading && (
            <div className="plot-merge__hint" aria-live="polite">
              Clique em pelo menos 2 talhões para mesclar
            </div>
          )}
          {isLoading && (
            <div className="plot-merge__loading" aria-live="polite">
              Processando...
            </div>
          )}
        </div>

        <aside className="plot-merge__sidebar" aria-label="Talhões selecionados">
          <h3 className="plot-merge__sidebar-title">Selecionados ({selectedIds.size})</h3>

          <ul className="plot-merge__selected-list">
            {validPlots
              .filter((pb) => selectedIds.has(pb.plotId))
              .map((pb) => (
                <li key={pb.plotId} className="plot-merge__selected-item">
                  <span
                    className="plot-merge__selected-swatch"
                    style={{ backgroundColor: getCropColor(pb.plot.currentCrop) }}
                    aria-hidden="true"
                  />
                  <span className="plot-merge__selected-name">{pb.plot.name}</span>
                  <span className="plot-merge__selected-area">
                    {formatArea(pb.plot.boundaryAreaHa)}
                  </span>
                </li>
              ))}
          </ul>

          {preview && (
            <div className="plot-merge__preview-info">
              <div className="plot-merge__area-badge">
                <span className="plot-merge__area-label">Área resultante:</span>
                <span className="plot-merge__area-value">{formatArea(preview.mergedAreaHa)}</span>
              </div>

              <label className="plot-merge__name-label">
                Nome do talhão
                <input
                  type="text"
                  className="plot-merge__name-input"
                  value={mergeName}
                  onChange={(e) => setMergeName(e.target.value)}
                  aria-required="true"
                />
              </label>
            </div>
          )}

          {error && (
            <p className="plot-merge__error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default PlotMergeEditor;
