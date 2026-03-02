import fs from 'fs';
import path from 'path';
import { detectFormat, parseGeoFile, validateGeometry, calculateAreaHa } from './geo-parser';

const fixturesDir = path.join(__dirname, '__fixtures__');
const readFixture = (name: string) => fs.readFileSync(path.join(fixturesDir, name));

// ─── detectFormat ──────────────────────────────────────────────────

describe('detectFormat', () => {
  it('should detect .geojson', () => {
    expect(detectFormat('farm.geojson')).toBe('geojson');
  });

  it('should detect .json as geojson', () => {
    expect(detectFormat('farm.json')).toBe('geojson');
  });

  it('should detect .kml', () => {
    expect(detectFormat('farm.kml')).toBe('kml');
  });

  it('should detect .kmz', () => {
    expect(detectFormat('farm.kmz')).toBe('kmz');
  });

  it('should detect .zip as shapefile', () => {
    expect(detectFormat('farm.zip')).toBe('shapefile');
  });

  it('should return null for unsupported extension', () => {
    expect(detectFormat('farm.pdf')).toBeNull();
    expect(detectFormat('farm.csv')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(detectFormat('farm.GeoJSON')).toBe('geojson');
    expect(detectFormat('farm.KML')).toBe('kml');
  });
});

// ─── parseGeoFile (GeoJSON) ────────────────────────────────────────

describe('parseGeoFile - GeoJSON', () => {
  it('should parse a valid GeoJSON Feature with Polygon', async () => {
    const buffer = readFixture('sample-polygon.geojson');
    const result = await parseGeoFile(buffer, 'farm.geojson');

    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0].type).toBe('Polygon');
    expect(result.boundaries[0].coordinates[0]).toHaveLength(5);
    expect(result.warnings).toHaveLength(0);
  });

  it('should parse a FeatureCollection with multiple polygons', async () => {
    const buffer = readFixture('multi-polygon.geojson');
    const result = await parseGeoFile(buffer, 'farm.geojson');

    expect(result.boundaries).toHaveLength(2);
    expect(result.boundaries[0].type).toBe('Polygon');
    expect(result.boundaries[1].type).toBe('Polygon');
  });

  it('should throw for invalid JSON', async () => {
    const buffer = Buffer.from('not json');
    await expect(parseGeoFile(buffer, 'farm.geojson')).rejects.toThrow('JSON mal-formado');
  });

  it('should throw when no polygons found (point-only)', async () => {
    const buffer = readFixture('point-only.geojson');
    await expect(parseGeoFile(buffer, 'farm.geojson')).rejects.toThrow(
      'Nenhum polígono encontrado',
    );
  });

  it('should throw for unsupported format', async () => {
    const buffer = Buffer.from('data');
    await expect(parseGeoFile(buffer, 'farm.pdf')).rejects.toThrow('Formato não suportado');
  });
});

// ─── parseGeoFile (KML) ────────────────────────────────────────────

describe('parseGeoFile - KML', () => {
  it('should parse a valid KML file', async () => {
    const buffer = readFixture('sample.kml');
    const result = await parseGeoFile(buffer, 'farm.kml');

    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0].type).toBe('Polygon');
  });
});

// ─── validateGeometry ──────────────────────────────────────────────

describe('validateGeometry', () => {
  it('should validate a correct polygon', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-55.75, -12.5],
          [-55.5, -12.5],
          [-55.5, -12.7],
          [-55.75, -12.7],
          [-55.75, -12.5],
        ],
      ],
    };
    const result = validateGeometry(polygon);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject a polygon with too few coordinates', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-55.75, -12.5],
          [-55.5, -12.5],
          [-55.75, -12.5],
        ],
      ],
    };
    const result = validateGeometry(polygon);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/mínimo 3 vértices/);
  });

  it('should reject a polygon with unclosed ring', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-55.75, -12.5],
          [-55.5, -12.5],
          [-55.5, -12.7],
          [-55.75, -12.7],
        ],
      ],
    };
    const result = validateGeometry(polygon);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/não está fechado/);
  });

  it('should detect self-intersecting polygon', async () => {
    const buffer = readFixture('invalid-self-intersecting.geojson');
    const parsed = await parseGeoFile(buffer, 'farm.geojson');
    const result = validateGeometry(parsed.boundaries[0]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/auto-interseção/);
  });

  it('should reject coordinates out of WGS84 bounds', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-200, -12.5],
          [-55.5, -12.5],
          [-55.5, -12.7],
          [-55.75, -12.7],
          [-200, -12.5],
        ],
      ],
    };
    const result = validateGeometry(polygon);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/limites válidos/)]),
    );
  });
});

// ─── calculateAreaHa ───────────────────────────────────────────────

describe('calculateAreaHa', () => {
  it('should calculate area in hectares for a known polygon', () => {
    // ~27km x ~22km rectangle near Sorriso, MT → ~60,000 ha
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-55.75, -12.5],
          [-55.5, -12.5],
          [-55.5, -12.7],
          [-55.75, -12.7],
          [-55.75, -12.5],
        ],
      ],
    };
    const areaHa = calculateAreaHa(polygon);
    expect(areaHa).toBeGreaterThan(50000);
    expect(areaHa).toBeLessThan(70000);
  });

  it('should return area with up to 4 decimal places', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-48.6, -22.3],
          [-48.5, -22.3],
          [-48.5, -22.35],
          [-48.6, -22.35],
          [-48.6, -22.3],
        ],
      ],
    };
    const areaHa = calculateAreaHa(polygon);
    const decimals = areaHa.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(4);
    expect(areaHa).toBeGreaterThan(0);
  });
});
