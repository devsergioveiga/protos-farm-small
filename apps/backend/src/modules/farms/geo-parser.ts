import area from '@turf/area';
import kinks from '@turf/kinks';
import { polygon as turfPolygon } from '@turf/helpers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shapefile = require('shapefile') as {
  read: (shp: ArrayBuffer, dbf?: ArrayBuffer) => Promise<GeoJSON.FeatureCollection>;
};
import { kml } from '@tmcw/togeojson';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

// ─── Types ──────────────────────────────────────────────────────────

export type GeoFormat = 'geojson' | 'kml' | 'kmz' | 'shapefile';

export interface ParseResult {
  boundaries: GeoJSON.Polygon[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ParsedFeature {
  polygon: GeoJSON.Polygon;
  properties: Record<string, unknown>;
  sourceIndex: number;
}

export interface ParseResultWithFeatures {
  features: ParsedFeature[];
  propertyKeys: string[];
  warnings: string[];
}

// ─── Format Detection ───────────────────────────────────────────────

const EXTENSION_MAP: Record<string, GeoFormat> = {
  '.geojson': 'geojson',
  '.json': 'geojson',
  '.kml': 'kml',
  '.kmz': 'kmz',
  '.zip': 'shapefile',
};

export function detectFormat(filename: string): GeoFormat | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return EXTENSION_MAP[ext] ?? null;
}

// ─── GeoJSON Parser ─────────────────────────────────────────────────

function parseGeoJSON(buffer: Buffer): ParseResult {
  const warnings: string[] = [];
  let data: unknown;

  try {
    data = JSON.parse(buffer.toString('utf-8'));
  } catch {
    throw new Error('Arquivo GeoJSON inválido: JSON mal-formado');
  }

  const geojson = data as GeoJSON.GeoJSON;
  const polygons = extractPolygons(geojson, warnings);

  if (polygons.length === 0) {
    throw new Error('Nenhum polígono encontrado no arquivo GeoJSON');
  }

  return { boundaries: polygons, warnings };
}

// ─── KML Parser ─────────────────────────────────────────────────────

function parseKMLString(xmlString: string): ParseResult {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const geojson = kml(doc) as GeoJSON.GeoJSON;
  const polygons = extractPolygons(geojson, warnings);

  if (polygons.length === 0) {
    throw new Error('Nenhum polígono encontrado no arquivo KML');
  }

  return { boundaries: polygons, warnings };
}

function parseKML(buffer: Buffer): ParseResult {
  return parseKMLString(buffer.toString('utf-8'));
}

// ─── KMZ Parser ─────────────────────────────────────────────────────

async function parseKMZ(buffer: Buffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);

  // Find .kml file inside the zip
  let kmlContent: string | null = null;
  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.toLowerCase().endsWith('.kml') && !file.dir) {
      kmlContent = await file.async('string');
      break;
    }
  }

  if (!kmlContent) {
    throw new Error('Nenhum arquivo KML encontrado dentro do KMZ');
  }

  return parseKMLString(kmlContent);
}

// ─── Shapefile Parser ───────────────────────────────────────────────

async function parseShapefileZip(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);

  // Find .shp and .dbf files
  let shpBuffer: ArrayBuffer | null = null;
  let dbfBuffer: ArrayBuffer | null = null;

  for (const [filename, file] of Object.entries(zip.files)) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.shp') && !file.dir) {
      shpBuffer = await file.async('arraybuffer');
    } else if (lower.endsWith('.dbf') && !file.dir) {
      dbfBuffer = await file.async('arraybuffer');
    }
  }

  if (!shpBuffer) {
    throw new Error('Nenhum arquivo .shp encontrado dentro do ZIP');
  }

  const geojson = (await shapefile.read(shpBuffer, dbfBuffer ?? undefined)) as GeoJSON.GeoJSON;
  const polygons = extractPolygons(geojson, warnings);

  if (polygons.length === 0) {
    throw new Error('Nenhum polígono encontrado no Shapefile');
  }

  return { boundaries: polygons, warnings };
}

// ─── Polygon Extraction ─────────────────────────────────────────────

function extractPolygons(geojson: GeoJSON.GeoJSON, warnings: string[]): GeoJSON.Polygon[] {
  const polygons: GeoJSON.Polygon[] = [];

  if (geojson.type === 'Polygon') {
    polygons.push(geojson);
  } else if (geojson.type === 'MultiPolygon') {
    for (const coords of geojson.coordinates) {
      polygons.push({ type: 'Polygon', coordinates: coords });
    }
    if (geojson.coordinates.length > 1) {
      warnings.push(`MultiPolygon separado em ${geojson.coordinates.length} polígonos`);
    }
  } else if (geojson.type === 'Feature') {
    if (geojson.geometry?.type === 'Polygon') {
      polygons.push(geojson.geometry);
    } else if (geojson.geometry?.type === 'MultiPolygon') {
      for (const coords of geojson.geometry.coordinates) {
        polygons.push({ type: 'Polygon', coordinates: coords });
      }
    } else {
      warnings.push(`Feature ignorada: tipo ${geojson.geometry?.type ?? 'null'}`);
    }
  } else if (geojson.type === 'FeatureCollection') {
    let ignoredCount = 0;
    for (const feature of geojson.features) {
      if (feature.geometry?.type === 'Polygon') {
        polygons.push(feature.geometry);
      } else if (feature.geometry?.type === 'MultiPolygon') {
        for (const coords of feature.geometry.coordinates) {
          polygons.push({ type: 'Polygon', coordinates: coords });
        }
      } else {
        ignoredCount++;
      }
    }
    if (ignoredCount > 0) {
      warnings.push(`${ignoredCount} feature(s) não-polígono ignorada(s)`);
    }
  }

  return polygons;
}

// ─── Feature Extraction (preserves properties) ──────────────────────

function extractFeatures(geojson: GeoJSON.GeoJSON, warnings: string[]): ParsedFeature[] {
  const features: ParsedFeature[] = [];
  let idx = 0;

  function addFromFeature(feature: GeoJSON.Feature, sourceIndex: number): void {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    if (feature.geometry?.type === 'Polygon') {
      features.push({ polygon: feature.geometry, properties: props, sourceIndex });
    } else if (feature.geometry?.type === 'MultiPolygon') {
      for (const coords of feature.geometry.coordinates) {
        features.push({
          polygon: { type: 'Polygon', coordinates: coords },
          properties: props,
          sourceIndex,
        });
      }
    } else {
      warnings.push(`Feature ${sourceIndex} ignorada: tipo ${feature.geometry?.type ?? 'null'}`);
    }
  }

  if (geojson.type === 'Polygon') {
    features.push({ polygon: geojson, properties: {}, sourceIndex: idx });
  } else if (geojson.type === 'MultiPolygon') {
    for (const coords of geojson.coordinates) {
      features.push({
        polygon: { type: 'Polygon', coordinates: coords },
        properties: {},
        sourceIndex: idx++,
      });
    }
  } else if (geojson.type === 'Feature') {
    addFromFeature(geojson, 0);
  } else if (geojson.type === 'FeatureCollection') {
    for (const feature of geojson.features) {
      addFromFeature(feature, idx++);
    }
  }

  return features;
}

// ─── Parse With Features (format-specific) ──────────────────────────

function parseGeoJSONWithFeatures(buffer: Buffer): ParseResultWithFeatures {
  const warnings: string[] = [];
  let data: unknown;

  try {
    data = JSON.parse(buffer.toString('utf-8'));
  } catch {
    throw new Error('Arquivo GeoJSON inválido: JSON mal-formado');
  }

  const geojson = data as GeoJSON.GeoJSON;
  const features = extractFeatures(geojson, warnings);

  if (features.length === 0) {
    throw new Error('Nenhum polígono encontrado no arquivo GeoJSON');
  }

  const propertyKeys = collectPropertyKeys(features);
  return { features, propertyKeys, warnings };
}

function parseKMLStringWithFeatures(xmlString: string): ParseResultWithFeatures {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const geojson = kml(doc) as GeoJSON.GeoJSON;
  const features = extractFeatures(geojson, warnings);

  if (features.length === 0) {
    throw new Error('Nenhum polígono encontrado no arquivo KML');
  }

  const propertyKeys = collectPropertyKeys(features);
  return { features, propertyKeys, warnings };
}

async function parseKMZWithFeatures(buffer: Buffer): Promise<ParseResultWithFeatures> {
  const zip = await JSZip.loadAsync(buffer);

  let kmlContent: string | null = null;
  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.toLowerCase().endsWith('.kml') && !file.dir) {
      kmlContent = await file.async('string');
      break;
    }
  }

  if (!kmlContent) {
    throw new Error('Nenhum arquivo KML encontrado dentro do KMZ');
  }

  return parseKMLStringWithFeatures(kmlContent);
}

async function parseShapefileZipWithFeatures(buffer: Buffer): Promise<ParseResultWithFeatures> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);

  let shpBuffer: ArrayBuffer | null = null;
  let dbfBuffer: ArrayBuffer | null = null;

  for (const [filename, file] of Object.entries(zip.files)) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.shp') && !file.dir) {
      shpBuffer = await file.async('arraybuffer');
    } else if (lower.endsWith('.dbf') && !file.dir) {
      dbfBuffer = await file.async('arraybuffer');
    }
  }

  if (!shpBuffer) {
    throw new Error('Nenhum arquivo .shp encontrado dentro do ZIP');
  }

  const geojson = (await shapefile.read(shpBuffer, dbfBuffer ?? undefined)) as GeoJSON.GeoJSON;
  const features = extractFeatures(geojson, warnings);

  if (features.length === 0) {
    throw new Error('Nenhum polígono encontrado no Shapefile');
  }

  const propertyKeys = collectPropertyKeys(features);
  return { features, propertyKeys, warnings };
}

function collectPropertyKeys(features: ParsedFeature[]): string[] {
  const keys = new Set<string>();
  for (const f of features) {
    for (const k of Object.keys(f.properties)) {
      keys.add(k);
    }
  }
  return Array.from(keys).sort();
}

// ─── Geometry Validation ────────────────────────────────────────────

export function validateGeometry(polygon: GeoJSON.Polygon): ValidationResult {
  const errors: string[] = [];

  // Check minimum coordinates (4 for a closed ring: 3 vertices + closing)
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    errors.push('Polígono deve ter no mínimo 3 vértices');
    return { valid: false, errors };
  }

  // Check ring is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    errors.push('Anel do polígono não está fechado');
    return { valid: false, errors };
  }

  // Check for self-intersections using @turf/kinks
  try {
    const tPoly = turfPolygon(polygon.coordinates as number[][][]);
    const selfIntersections = kinks(tPoly);
    if (selfIntersections.features.length > 0) {
      errors.push(`Polígono possui ${selfIntersections.features.length} auto-interseção(ões)`);
    }
  } catch {
    errors.push('Erro ao validar auto-interseções do polígono');
  }

  // Check coordinates are valid lat/lng
  for (const coord of ring) {
    const [lng, lat] = coord;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      errors.push('Coordenadas fora dos limites válidos (WGS84)');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Calculate Area in Hectares ─────────────────────────────────────

export function calculateAreaHa(polygon: GeoJSON.Polygon): number {
  const tPoly = turfPolygon(polygon.coordinates as number[][][]);
  const sqMeters = area(tPoly);
  return Math.round((sqMeters / 10000) * 10000) / 10000; // 4 decimal places
}

// ─── Main Parse Function ────────────────────────────────────────────

export async function parseGeoFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const format = detectFormat(filename);
  if (!format) {
    throw new Error(`Formato não suportado: ${filename}`);
  }

  switch (format) {
    case 'geojson':
      return parseGeoJSON(buffer);
    case 'kml':
      return parseKML(buffer);
    case 'kmz':
      return parseKMZ(buffer);
    case 'shapefile':
      return parseShapefileZip(buffer);
  }
}

export async function parseGeoFileWithFeatures(
  buffer: Buffer,
  filename: string,
): Promise<ParseResultWithFeatures> {
  const format = detectFormat(filename);
  if (!format) {
    throw new Error(`Formato não suportado: ${filename}`);
  }

  switch (format) {
    case 'geojson':
      return parseGeoJSONWithFeatures(buffer);
    case 'kml':
      return parseKMLStringWithFeatures(buffer.toString('utf-8'));
    case 'kmz':
      return parseKMZWithFeatures(buffer);
    case 'shapefile':
      return parseShapefileZipWithFeatures(buffer);
  }
}
