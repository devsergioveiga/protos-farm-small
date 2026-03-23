import type { SQLiteDatabase } from 'expo-sqlite';

export interface LocalMaintenanceRequest {
  localId: string;
  assetId: string;
  title: string;
  description: string | null;
  photoBase64: string | null;
  geoLat: number | null;
  geoLon: number | null;
  status: 'local' | 'syncing' | 'synced' | 'error';
  createdAt: string;
  syncedAt?: string;
  errorMessage?: string;
}

export function createMaintenanceRequestRepository(db: SQLiteDatabase) {
  return {
    async initTable(): Promise<void> {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS maintenance_requests (
          local_id TEXT PRIMARY KEY NOT NULL,
          asset_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          photo_base64 TEXT,
          geo_lat REAL,
          geo_lon REAL,
          status TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          synced_at TEXT,
          error_message TEXT
        );
      `);
    },

    async saveRequest(data: LocalMaintenanceRequest): Promise<void> {
      await db.runAsync(
        `INSERT INTO maintenance_requests (
          local_id, asset_id, title, description, photo_base64,
          geo_lat, geo_lon, status, created_at, synced_at, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.localId,
        data.assetId,
        data.title,
        data.description ?? null,
        data.photoBase64 ?? null,
        data.geoLat ?? null,
        data.geoLon ?? null,
        data.status,
        data.createdAt,
        data.syncedAt ?? null,
        data.errorMessage ?? null,
      );
    },

    async getUnsyncedRequests(): Promise<LocalMaintenanceRequest[]> {
      const rows = await db.getAllAsync<{
        local_id: string;
        asset_id: string;
        title: string;
        description: string | null;
        photo_base64: string | null;
        geo_lat: number | null;
        geo_lon: number | null;
        status: string;
        created_at: string;
        synced_at: string | null;
        error_message: string | null;
      }>(
        "SELECT * FROM maintenance_requests WHERE status IN ('local', 'error') ORDER BY created_at ASC",
      );

      return rows.map((r) => ({
        localId: r.local_id,
        assetId: r.asset_id,
        title: r.title,
        description: r.description,
        photoBase64: r.photo_base64,
        geoLat: r.geo_lat,
        geoLon: r.geo_lon,
        status: r.status as LocalMaintenanceRequest['status'],
        createdAt: r.created_at,
        syncedAt: r.synced_at ?? undefined,
        errorMessage: r.error_message ?? undefined,
      }));
    },

    async markSynced(localId: string): Promise<void> {
      await db.runAsync(
        "UPDATE maintenance_requests SET status = 'synced', synced_at = ? WHERE local_id = ?",
        new Date().toISOString(),
        localId,
      );
    },

    async markError(localId: string, error: string): Promise<void> {
      await db.runAsync(
        "UPDATE maintenance_requests SET status = 'error', error_message = ? WHERE local_id = ?",
        error,
        localId,
      );
    },

    async listAll(): Promise<LocalMaintenanceRequest[]> {
      const rows = await db.getAllAsync<{
        local_id: string;
        asset_id: string;
        title: string;
        description: string | null;
        photo_base64: string | null;
        geo_lat: number | null;
        geo_lon: number | null;
        status: string;
        created_at: string;
        synced_at: string | null;
        error_message: string | null;
      }>('SELECT * FROM maintenance_requests ORDER BY created_at DESC');

      return rows.map((r) => ({
        localId: r.local_id,
        assetId: r.asset_id,
        title: r.title,
        description: r.description,
        photoBase64: r.photo_base64,
        geoLat: r.geo_lat,
        geoLon: r.geo_lon,
        status: r.status as LocalMaintenanceRequest['status'],
        createdAt: r.created_at,
        syncedAt: r.synced_at ?? undefined,
        errorMessage: r.error_message ?? undefined,
      }));
    },
  };
}
