import type { SQLiteDatabase } from 'expo-sqlite';

export interface LocalPurchaseRequest {
  localId: string; // uuid generated locally
  serverId?: string;
  productName: string;
  quantity: number;
  unitName: string;
  urgency: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  photoUri?: string;
  observation?: string;
  farmId: string;
  geolat?: number;
  geolon?: number;
  status: 'local' | 'syncing' | 'synced' | 'error';
  serverStatus?: string; // RASCUNHO, PENDENTE, etc. after sync
  createdAt: string;
  syncedAt?: string;
  errorMessage?: string;
}

export function createPurchaseRequestRepository(db: SQLiteDatabase) {
  return {
    async initPurchaseRequestTable(): Promise<void> {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS purchase_requests (
          local_id TEXT PRIMARY KEY NOT NULL,
          server_id TEXT,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_name TEXT NOT NULL,
          urgency TEXT NOT NULL DEFAULT 'NORMAL',
          photo_uri TEXT,
          observation TEXT,
          farm_id TEXT NOT NULL,
          geolat REAL,
          geolon REAL,
          status TEXT NOT NULL DEFAULT 'local',
          server_status TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT,
          error_message TEXT
        );
      `);
    },

    async savePurchaseRequest(data: LocalPurchaseRequest): Promise<void> {
      await db.runAsync(
        `INSERT INTO purchase_requests (
          local_id, server_id, product_name, quantity, unit_name, urgency,
          photo_uri, observation, farm_id, geolat, geolon, status,
          server_status, created_at, synced_at, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.localId,
        data.serverId ?? null,
        data.productName,
        data.quantity,
        data.unitName,
        data.urgency,
        data.photoUri ?? null,
        data.observation ?? null,
        data.farmId,
        data.geolat ?? null,
        data.geolon ?? null,
        data.status,
        data.serverStatus ?? null,
        data.createdAt,
        data.syncedAt ?? null,
        data.errorMessage ?? null,
      );
    },

    async listPurchaseRequests(farmId?: string): Promise<LocalPurchaseRequest[]> {
      let rows: Array<{
        local_id: string;
        server_id: string | null;
        product_name: string;
        quantity: number;
        unit_name: string;
        urgency: string;
        photo_uri: string | null;
        observation: string | null;
        farm_id: string;
        geolat: number | null;
        geolon: number | null;
        status: string;
        server_status: string | null;
        created_at: string;
        synced_at: string | null;
        error_message: string | null;
      }>;

      if (farmId) {
        rows = await db.getAllAsync(
          'SELECT * FROM purchase_requests WHERE farm_id = ? ORDER BY created_at DESC',
          farmId,
        );
      } else {
        rows = await db.getAllAsync('SELECT * FROM purchase_requests ORDER BY created_at DESC');
      }

      return rows.map((r) => ({
        localId: r.local_id,
        serverId: r.server_id ?? undefined,
        productName: r.product_name,
        quantity: r.quantity,
        unitName: r.unit_name,
        urgency: r.urgency as LocalPurchaseRequest['urgency'],
        photoUri: r.photo_uri ?? undefined,
        observation: r.observation ?? undefined,
        farmId: r.farm_id,
        geolat: r.geolat ?? undefined,
        geolon: r.geolon ?? undefined,
        status: r.status as LocalPurchaseRequest['status'],
        serverStatus: r.server_status ?? undefined,
        createdAt: r.created_at,
        syncedAt: r.synced_at ?? undefined,
        errorMessage: r.error_message ?? undefined,
      }));
    },

    async getPurchaseRequestByLocalId(localId: string): Promise<LocalPurchaseRequest | null> {
      const row = await db.getFirstAsync<{
        local_id: string;
        server_id: string | null;
        product_name: string;
        quantity: number;
        unit_name: string;
        urgency: string;
        photo_uri: string | null;
        observation: string | null;
        farm_id: string;
        geolat: number | null;
        geolon: number | null;
        status: string;
        server_status: string | null;
        created_at: string;
        synced_at: string | null;
        error_message: string | null;
      }>('SELECT * FROM purchase_requests WHERE local_id = ?', localId);

      if (!row) return null;

      return {
        localId: row.local_id,
        serverId: row.server_id ?? undefined,
        productName: row.product_name,
        quantity: row.quantity,
        unitName: row.unit_name,
        urgency: row.urgency as LocalPurchaseRequest['urgency'],
        photoUri: row.photo_uri ?? undefined,
        observation: row.observation ?? undefined,
        farmId: row.farm_id,
        geolat: row.geolat ?? undefined,
        geolon: row.geolon ?? undefined,
        status: row.status as LocalPurchaseRequest['status'],
        serverStatus: row.server_status ?? undefined,
        createdAt: row.created_at,
        syncedAt: row.synced_at ?? undefined,
        errorMessage: row.error_message ?? undefined,
      };
    },

    async updateSyncStatus(
      localId: string,
      status: LocalPurchaseRequest['status'],
      serverId?: string,
      serverStatus?: string,
    ): Promise<void> {
      await db.runAsync(
        `UPDATE purchase_requests
         SET status = ?, server_id = COALESCE(?, server_id),
             server_status = COALESCE(?, server_status),
             synced_at = CASE WHEN ? = 'synced' THEN ? ELSE synced_at END,
             error_message = CASE WHEN ? = 'error' THEN NULL ELSE error_message END
         WHERE local_id = ?`,
        status,
        serverId ?? null,
        serverStatus ?? null,
        status,
        new Date().toISOString(),
        status,
        localId,
      );
    },
  };
}
