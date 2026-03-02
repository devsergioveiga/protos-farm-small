import { useEffect, useRef, useState, useCallback } from 'react';
import { Save, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import turfArea from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import type { FieldPlot } from '@/types/farm';
import type { BoundaryInfo } from '@/types/farm';
import { formatArea } from './FarmMap';
import './PlotGeometryEditor.css';

interface PlotBoundaryRef {
  plotId: string;
  plot: FieldPlot;
  boundary: BoundaryInfo;
}

interface PlotGeometryEditorProps {
  plot: FieldPlot;
  plotBoundary: GeoJSON.Polygon;
  farmBoundary: GeoJSON.Polygon | null;
  otherPlots: PlotBoundaryRef[];
  onSave: (geojson: GeoJSON.Polygon, previousAreaHa: number) => void;
  onCancel: () => void;
}

function computeAreaHa(polygon: GeoJSON.Polygon): number {
  const feature = turfPolygon(polygon.coordinates);
  return turfArea(feature) / 10000;
}

function PlotGeometryEditor({
  plot,
  plotBoundary,
  farmBoundary,
  otherPlots,
  onSave,
  onCancel,
}: PlotGeometryEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const editableLayerRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [currentAreaHa, setCurrentAreaHa] = useState(() => computeAreaHa(plotBoundary));

  const getEditedPolygon = useCallback((): GeoJSON.Polygon | null => {
    const layer = editableLayerRef.current;
    if (!layer) return null;
    const layers = layer.getLayers();
    if (layers.length === 0) return null;
    const geoJson = (layers[0] as L.Polygon).toGeoJSON();
    return geoJson.geometry as GeoJSON.Polygon;
  }, []);

  const handleSave = useCallback(() => {
    const polygon = getEditedPolygon();
    if (!polygon) return;
    onSave(polygon, plot.boundaryAreaHa);
  }, [getEditedPolygon, onSave, plot.boundaryAreaHa]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      preferCanvas: true,
      zoomControl: true,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri',
        maxZoom: 19,
      },
    ).addTo(map);

    // Farm boundary reference layer (read-only, dashed green)
    if (farmBoundary) {
      L.geoJSON(farmBoundary, {
        style: {
          color: '#2E7D32',
          weight: 2,
          dashArray: '8 4',
          fill: false,
          interactive: false,
        },
      }).addTo(map);
    }

    // Other plots as read-only reference
    for (const pb of otherPlots) {
      if (!pb.boundary.boundaryGeoJSON) continue;
      L.geoJSON(pb.boundary.boundaryGeoJSON, {
        style: {
          color: '#888',
          weight: 1,
          fillOpacity: 0.15,
          interactive: false,
        },
      }).addTo(map);
    }

    // Editable layer with the target plot
    const editableGroup = new L.FeatureGroup();
    const plotLayer = L.geoJSON(plotBoundary, {
      style: {
        color: '#1976D2',
        weight: 3,
        fillColor: '#1976D2',
        fillOpacity: 0.25,
      },
    });

    plotLayer.eachLayer((layer) => {
      editableGroup.addLayer(layer);
    });

    editableGroup.addTo(map);
    editableLayerRef.current = editableGroup;

    // Fit bounds to the plot
    const bounds = editableGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }

    // Initialize draw control for editing only (no new shapes)
    const drawControl = new L.Control.Draw({
      draw: false as never,
      edit: {
        featureGroup: editableGroup,
        remove: false,
      } as unknown as L.Control.DrawConstructorOptions['edit'],
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Enable edit mode immediately
    const editToolbar = (
      drawControl as unknown as {
        _toolbars: Record<string, { _modes: Record<string, { handler: { enable: () => void } }> }>;
      }
    )._toolbars;
    if (editToolbar?.edit?._modes?.edit?.handler) {
      editToolbar.edit._modes.edit.handler.enable();
    }

    // Listen for edit events to recalculate area
    map.on(L.Draw.Event.EDITED, () => {
      const polygon = getEditedPolygon();
      if (polygon) {
        setCurrentAreaHa(computeAreaHa(polygon));
      }
    });

    // Also listen for vertex drag in real-time
    map.on('draw:editvertex' as string, () => {
      const polygon = getEditedPolygon();
      if (polygon) {
        setCurrentAreaHa(computeAreaHa(polygon));
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      editableLayerRef.current = null;
      drawControlRef.current = null;
    };
  }, [plotBoundary, farmBoundary, otherPlots, getEditedPolygon]);

  return (
    <div className="plot-editor" role="region" aria-label="Editor de geometria do talhão">
      <div className="plot-editor__toolbar">
        <h2 className="plot-editor__title">Editando: {plot.name}</h2>
        <div className="plot-editor__actions">
          <button
            type="button"
            className="plot-editor__btn plot-editor__btn--secondary"
            onClick={onCancel}
          >
            <X size={20} aria-hidden="true" />
            Cancelar
          </button>
          <button
            type="button"
            className="plot-editor__btn plot-editor__btn--primary"
            onClick={handleSave}
          >
            <Save size={20} aria-hidden="true" />
            Salvar
          </button>
        </div>
      </div>

      <div className="plot-editor__map-container" ref={mapContainerRef}>
        <div className="plot-editor__area-badge" aria-live="polite">
          <span className="plot-editor__area-label">Área:</span>
          <span className="plot-editor__area-value">{formatArea(currentAreaHa)}</span>
        </div>
      </div>
    </div>
  );
}

export default PlotGeometryEditor;
