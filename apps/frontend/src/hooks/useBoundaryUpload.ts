import { useState, useCallback } from 'react';
import turfArea from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { api } from '@/services/api';
import type { BoundaryUploadResult } from '@/types/farm';

export type BoundaryUploadStep = 'idle' | 'parsing' | 'previewing' | 'uploading' | 'done';

export interface ClientPreview {
  polygon: GeoJSON.Polygon;
  areaHa: number;
  divergencePercentage: number | null;
}

interface BoundaryUploadState {
  step: BoundaryUploadStep;
  file: File | null;
  clientPreview: ClientPreview | null;
  canPreview: boolean;
  result: BoundaryUploadResult | null;
  error: string | null;
}

const GEOJSON_EXTENSIONS = ['.geojson', '.json'];
const ACCEPTED_EXTENSIONS = ['.geojson', '.json', '.kml', '.kmz', '.zip'];

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot).toLowerCase() : '';
}

/**
 * Extracts a Polygon from various GeoJSON structures.
 * Supports: FeatureCollection (first polygon), Feature, Polygon, MultiPolygon (first polygon).
 */
export function extractPolygon(data: unknown): GeoJSON.Polygon | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  const type = obj.type as string | undefined;

  if (type === 'Polygon') {
    return data as GeoJSON.Polygon;
  }

  if (type === 'MultiPolygon') {
    const mp = data as GeoJSON.MultiPolygon;
    if (mp.coordinates.length > 0) {
      return { type: 'Polygon', coordinates: mp.coordinates[0] };
    }
    return null;
  }

  if (type === 'Feature') {
    const feature = data as GeoJSON.Feature;
    return extractPolygon(feature.geometry);
  }

  if (type === 'FeatureCollection') {
    const fc = data as GeoJSON.FeatureCollection;
    for (const feature of fc.features) {
      const poly = extractPolygon(feature.geometry);
      if (poly) return poly;
    }
    return null;
  }

  return null;
}

function calculateAreaHa(polygon: GeoJSON.Polygon): number {
  const feature = turfPolygon(polygon.coordinates);
  return turfArea(feature) / 10000;
}

export function useBoundaryUpload() {
  const [state, setState] = useState<BoundaryUploadState>({
    step: 'idle',
    file: null,
    clientPreview: null,
    canPreview: false,
    result: null,
    error: null,
  });

  const selectFile = useCallback((file: File, farmTotalAreaHa: number) => {
    const ext = getExtension(file.name);

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setState((prev) => ({
        ...prev,
        error: `Formato não suportado: ${ext}. Use GeoJSON, KML, KMZ ou Shapefile (.zip).`,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      step: 'parsing',
      file,
      error: null,
      clientPreview: null,
      canPreview: false,
      result: null,
    }));

    if (GEOJSON_EXTENSIONS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(reader.result as string);
          const polygon = extractPolygon(parsed);

          if (!polygon) {
            setState((prev) => ({
              ...prev,
              step: 'idle',
              file: null,
              error: 'Nenhum polígono encontrado no arquivo. Verifique o formato.',
            }));
            return;
          }

          const areaHa = calculateAreaHa(polygon);
          const divergencePercentage =
            farmTotalAreaHa > 0
              ? Math.abs(((areaHa - farmTotalAreaHa) / farmTotalAreaHa) * 100)
              : null;

          setState((prev) => ({
            ...prev,
            step: 'previewing',
            canPreview: true,
            clientPreview: { polygon, areaHa, divergencePercentage },
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            step: 'idle',
            file: null,
            error: 'Arquivo GeoJSON inválido. Verifique o conteúdo.',
          }));
        }
      };
      reader.onerror = () => {
        setState((prev) => ({
          ...prev,
          step: 'idle',
          file: null,
          error: 'Não foi possível ler o arquivo.',
        }));
      };
      reader.readAsText(file);
    } else {
      // KML, KMZ, Shapefile — can't preview client-side, go straight to previewing without map
      setState((prev) => ({
        ...prev,
        step: 'previewing',
        canPreview: false,
        clientPreview: null,
      }));
    }
  }, []);

  const upload = useCallback(
    async (uploadUrl: string) => {
      if (!state.file) return;

      setState((prev) => ({ ...prev, step: 'uploading', error: null }));

      try {
        const formData = new FormData();
        formData.append('file', state.file);

        const result = await api.postFormData<BoundaryUploadResult>(uploadUrl, formData);

        setState((prev) => ({ ...prev, step: 'done', result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não foi possível enviar o perímetro.';
        setState((prev) => ({ ...prev, step: 'idle', error: message }));
      }
    },
    [state.file],
  );

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      file: null,
      clientPreview: null,
      canPreview: false,
      result: null,
      error: null,
    });
  }, []);

  return {
    step: state.step,
    file: state.file,
    clientPreview: state.clientPreview,
    canPreview: state.canPreview,
    result: state.result,
    error: state.error,
    selectFile,
    upload,
    reset,
  };
}
