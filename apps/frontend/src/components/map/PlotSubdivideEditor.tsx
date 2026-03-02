import { useEffect, useRef, useState, useCallback } from 'react';
import { Scissors, X, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { api } from '@/services/api';
import { formatArea } from './FarmMap';
import type { FieldPlot, SubdividePreviewResult } from '@/types/farm';
import type { BoundaryInfo } from '@/types/farm';
import './PlotSubdivideEditor.css';

interface PlotBoundaryRef {
  plotId: string;
  plot: FieldPlot;
  boundary: BoundaryInfo;
}

interface PlotSubdivideEditorProps {
  plot: FieldPlot;
  plotBoundary: GeoJSON.Polygon;
  farmBoundary: GeoJSON.Polygon | null;
  otherPlots: PlotBoundaryRef[];
  farmId: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'draw' | 'preview';

function PlotSubdivideEditor({
  plot,
  plotBoundary,
  farmBoundary,
  otherPlots,
  farmId,
  onComplete,
  onCancel,
}: PlotSubdivideEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLineRef = useRef<L.Polyline | null>(null);
  const previewLayerRef = useRef<L.LayerGroup | null>(null);
  const [step, setStep] = useState<Step>('draw');
  const [preview, setPreview] = useState<SubdividePreviewResult | null>(null);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(
    async (cutLine: GeoJSON.LineString) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<SubdividePreviewResult>(
          `/org/farms/${farmId}/plots/${plot.id}/subdivide/preview`,
          { cutLine },
        );
        setPreview(result);
        setNames([result.parts[0].suggestedName, result.parts[1].suggestedName]);
        setStep('preview');

        // Show preview polygons on map
        if (previewLayerRef.current && mapRef.current) {
          previewLayerRef.current.clearLayers();

          const colors = ['#2E7D32', '#E65100'];
          result.parts.forEach((part, i) => {
            L.geoJSON(part.geojson, {
              style: {
                color: colors[i],
                weight: 3,
                fillColor: colors[i],
                fillOpacity: 0.3,
                interactive: false,
              },
            }).addTo(previewLayerRef.current!);
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao pré-visualizar subdivisão';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [farmId, plot.id],
  );

  const handleSubdivide = useCallback(async () => {
    if (!drawnLineRef.current || !names[0] || !names[1]) return;
    setIsLoading(true);
    setError(null);
    try {
      const geojson = drawnLineRef.current.toGeoJSON();
      await api.post(`/org/farms/${farmId}/plots/${plot.id}/subdivide`, {
        cutLine: geojson.geometry,
        names,
      });
      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao subdividir talhão';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, plot.id, names, onComplete]);

  const handleRedraw = useCallback(() => {
    setStep('draw');
    setPreview(null);
    setError(null);
    if (previewLayerRef.current) {
      previewLayerRef.current.clearLayers();
    }
    if (drawnLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(drawnLineRef.current);
      drawnLineRef.current = null;
    }

    // Re-enable draw mode
    if (mapRef.current) {
      const handler = new L.Draw.Polyline(mapRef.current, {
        shapeOptions: { color: '#D32F2F', weight: 3, dashArray: '10 5' },
      } as L.DrawOptions.PolylineOptions);
      handler.enable();
    }
  }, []);

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

    // Other plots as faded reference
    for (const pb of otherPlots) {
      if (!pb.boundary.boundaryGeoJSON) continue;
      L.geoJSON(pb.boundary.boundaryGeoJSON, {
        style: { color: '#888', weight: 1, fillOpacity: 0.15, interactive: false },
      }).addTo(map);
    }

    // Target plot highlighted
    const plotLayer = L.geoJSON(plotBoundary, {
      style: {
        color: '#1976D2',
        weight: 3,
        fillColor: '#1976D2',
        fillOpacity: 0.25,
        interactive: false,
      },
    }).addTo(map);

    // Preview layer for subdivide result
    const previewGroup = L.layerGroup().addTo(map);
    previewLayerRef.current = previewGroup;

    // Fit to target plot
    const bounds = plotLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    // Enable polyline draw mode
    const handler = new L.Draw.Polyline(map, {
      shapeOptions: { color: '#D32F2F', weight: 3, dashArray: '10 5' },
    } as L.DrawOptions.PolylineOptions);
    handler.enable();

    map.on(L.Draw.Event.CREATED, (e: L.DrawEvents.Created) => {
      const layer = e.layer as L.Polyline;
      drawnLineRef.current = layer;
      layer.addTo(map);

      const geojson = layer.toGeoJSON();
      void handlePreview(geojson.geometry as GeoJSON.LineString);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      previewLayerRef.current = null;
      drawnLineRef.current = null;
    };
  }, [plotBoundary, farmBoundary, otherPlots, handlePreview]);

  return (
    <div className="plot-subdivide" role="region" aria-label="Subdivisão de talhão">
      <div className="plot-subdivide__toolbar">
        <h2 className="plot-subdivide__title">Subdividir: {plot.name}</h2>
        <div className="plot-subdivide__actions">
          {step === 'preview' && (
            <button
              type="button"
              className="plot-subdivide__btn plot-subdivide__btn--secondary"
              onClick={handleRedraw}
              disabled={isLoading}
            >
              <RotateCcw size={20} aria-hidden="true" />
              Redesenhar
            </button>
          )}
          <button
            type="button"
            className="plot-subdivide__btn plot-subdivide__btn--secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X size={20} aria-hidden="true" />
            Cancelar
          </button>
          {step === 'preview' && (
            <button
              type="button"
              className="plot-subdivide__btn plot-subdivide__btn--primary"
              onClick={() => void handleSubdivide()}
              disabled={isLoading || !names[0] || !names[1]}
            >
              <Scissors size={20} aria-hidden="true" />
              Subdividir
            </button>
          )}
        </div>
      </div>

      <div className="plot-subdivide__content">
        <div className="plot-subdivide__map-container" ref={mapContainerRef}>
          {step === 'draw' && !isLoading && (
            <div className="plot-subdivide__hint" aria-live="polite">
              Desenhe uma linha de corte sobre o talhão
            </div>
          )}
          {isLoading && (
            <div className="plot-subdivide__loading" aria-live="polite">
              Processando...
            </div>
          )}
        </div>

        {step === 'preview' && preview && (
          <aside className="plot-subdivide__sidebar" aria-label="Detalhes da subdivisão">
            <div className="plot-subdivide__area-badge">
              <span className="plot-subdivide__area-label">Área original:</span>
              <span className="plot-subdivide__area-value">
                {formatArea(preview.originalAreaHa)}
              </span>
            </div>

            {preview.parts.map((part, i) => (
              <div key={i} className="plot-subdivide__part">
                <div className="plot-subdivide__part-header">
                  <span
                    className="plot-subdivide__part-swatch"
                    style={{ backgroundColor: i === 0 ? '#2E7D32' : '#E65100' }}
                    aria-hidden="true"
                  />
                  <span className="plot-subdivide__part-area">{formatArea(part.areaHa)}</span>
                </div>
                <label className="plot-subdivide__name-label">
                  Nome
                  <input
                    type="text"
                    className="plot-subdivide__name-input"
                    value={names[i]}
                    onChange={(e) => {
                      const updated = [...names] as [string, string];
                      updated[i] = e.target.value;
                      setNames(updated);
                    }}
                    aria-required="true"
                  />
                </label>
              </div>
            ))}

            {error && (
              <p className="plot-subdivide__error" role="alert">
                {error}
              </p>
            )}
          </aside>
        )}

        {step === 'draw' && error && (
          <div className="plot-subdivide__draw-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlotSubdivideEditor;
