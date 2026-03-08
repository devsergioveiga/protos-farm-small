import { File, Directory, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createTileCacheRepository } from './db/tile-cache-repository';
import type { TileCacheMeta } from '@/types/offline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface TileDownloadProgress {
  total: number;
  downloaded: number;
  failed: number;
  cacheSizeBytes: number;
  status: TileCacheMeta['status'];
}

export type TileProgressCallback = (progress: TileDownloadProgress) => void;

interface TileCoord {
  z: number;
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TILE_DIR_NAME = 'tiles';
const OSM_TILE_URL = 'https://tile.openstreetmap.org';
const DEFAULT_MIN_ZOOM = 10;
const DEFAULT_MAX_ZOOM = 16;
const CONCURRENCY = 4;

function getFarmTilesDir(farmId: string): Directory {
  return new Directory(Paths.document, TILE_DIR_NAME, farmId);
}

// ─── Tile math ────────────────────────────────────────────────────────────────

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

function getTilesForBBox(bbox: BoundingBox, minZoom: number, maxZoom: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const topLeft = latLngToTile(bbox.north, bbox.west, z);
    const bottomRight = latLngToTile(bbox.south, bbox.east, z);
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

function tileFile(farmId: string, tile: TileCoord): File {
  return new File(Paths.document, TILE_DIR_NAME, farmId, `${tile.z}`, `${tile.x}`, `${tile.y}.png`);
}

function tileUrl(tile: TileCoord): string {
  return `${OSM_TILE_URL}/${tile.z}/${tile.x}/${tile.y}.png`;
}

/**
 * Compute bounding box from GeoJSON polygon coordinates.
 */
export function computeBBoxFromGeoJSON(geojsonStr: string): BoundingBox | null {
  try {
    const geojson = JSON.parse(geojsonStr);
    const coords: number[][] = geojson.coordinates?.[0];
    if (!coords || coords.length === 0) return null;

    let south = Infinity,
      west = Infinity,
      north = -Infinity,
      east = -Infinity;
    for (const [lng, lat] of coords) {
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
    }

    // Add 5% padding
    const latPad = (north - south) * 0.05;
    const lngPad = (east - west) * 0.05;
    return {
      south: south - latPad,
      west: west - lngPad,
      north: north + latPad,
      east: east + lngPad,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate bounding box from farm center + total area in hectares.
 */
export function computeBBoxFromCenter(lat: number, lng: number, areaHa: number): BoundingBox {
  const sideKm = Math.sqrt(areaHa / 100);
  const padding = sideKm * 1.5;
  const latDelta = padding / 111;
  const lngDelta = padding / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta,
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
  };
}

/**
 * Count tiles for a bounding box and zoom range.
 */
export function estimateTileCount(
  bbox: BoundingBox,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
): number {
  return getTilesForBBox(bbox, minZoom, maxZoom).length;
}

/**
 * Estimate download size in MB (avg ~15KB per tile).
 */
export function estimateSizeMB(tileCount: number): number {
  return Math.round(((tileCount * 15) / 1024) * 10) / 10;
}

// ─── Tile Cache Service ───────────────────────────────────────────────────────

export function createTileCacheService(db: SQLiteDatabase) {
  const repo = createTileCacheRepository(db);

  async function downloadTile(tile: TileCoord, farmId: string): Promise<number> {
    const file = tileFile(farmId, tile);
    if (file.exists) {
      return file.size ?? 0;
    }

    // Ensure parent directory exists
    const parentDir = file.parentDirectory;
    if (!parentDir.exists) {
      parentDir.create({ intermediates: true });
    }

    const downloaded = await File.downloadFileAsync(tileUrl(tile), file, {
      headers: {
        'User-Agent': 'ProtosFarm/1.0 (agricultural-management-app)',
      },
      idempotent: true,
    });

    return downloaded.size ?? 0;
  }

  async function downloadBatch(
    tiles: TileCoord[],
    farmId: string,
    onTileComplete: (sizeBytes: number, failed: boolean) => void,
  ): Promise<void> {
    for (let i = 0; i < tiles.length; i += CONCURRENCY) {
      const batch = tiles.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (tile) => {
          try {
            const size = await downloadTile(tile, farmId);
            onTileComplete(size, false);
          } catch {
            onTileComplete(0, true);
          }
        }),
      );
    }
  }

  return {
    /**
     * Download all tiles for a farm's bounding box.
     */
    async downloadTilesForFarm(
      farmId: string,
      bbox: BoundingBox,
      onProgress?: TileProgressCallback,
      minZoom = DEFAULT_MIN_ZOOM,
      maxZoom = DEFAULT_MAX_ZOOM,
    ): Promise<TileDownloadProgress> {
      const tiles = getTilesForBBox(bbox, minZoom, maxZoom);
      const progress: TileDownloadProgress = {
        total: tiles.length,
        downloaded: 0,
        failed: 0,
        cacheSizeBytes: 0,
        status: 'downloading',
      };

      const now = new Date().toISOString();
      await repo.upsert({
        farm_id: farmId,
        min_zoom: minZoom,
        max_zoom: maxZoom,
        total_tiles: tiles.length,
        downloaded_tiles: 0,
        cache_size_bytes: 0,
        bbox_south: bbox.south,
        bbox_west: bbox.west,
        bbox_north: bbox.north,
        bbox_east: bbox.east,
        status: 'downloading',
        created_at: now,
        updated_at: now,
      });

      onProgress?.(progress);

      await downloadBatch(tiles, farmId, (sizeBytes, failed) => {
        if (failed) {
          progress.failed++;
        } else {
          progress.downloaded++;
          progress.cacheSizeBytes += sizeBytes;
        }
        onProgress?.(progress);
      });

      const finalStatus = progress.failed > tiles.length * 0.1 ? 'error' : 'complete';
      progress.status = finalStatus;
      await repo.updateProgress(farmId, progress.downloaded, progress.cacheSizeBytes, finalStatus);
      onProgress?.(progress);

      return progress;
    },

    /**
     * Get the local tile URL template for react-native-maps UrlTile.
     */
    getTileUrlTemplate(farmId: string): string {
      const baseDir = getFarmTilesDir(farmId);
      return `${baseDir.uri}/{z}/{x}/{y}.png`;
    },

    /**
     * Check if tiles are cached for a given farm.
     */
    async getCacheMeta(farmId: string): Promise<TileCacheMeta | null> {
      return repo.getByFarmId(farmId);
    },

    /**
     * Delete cached tiles for a farm.
     */
    async clearFarmCache(farmId: string): Promise<void> {
      const dir = getFarmTilesDir(farmId);
      if (dir.exists) {
        dir.delete();
      }
      await repo.deleteByFarmId(farmId);
    },

    /**
     * Get total cache size across all farms.
     */
    async getTotalCacheSize(): Promise<number> {
      const result = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(cache_size_bytes), 0) as total FROM tile_cache_meta',
      );
      return result?.total ?? 0;
    },
  };
}
