/**
 * ID mapping between Firebird integer IDs and Protos Farm UUIDs.
 * Persisted to disk so imports can be resumed/re-run.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MAP_DIR = join(__dirname, '..', '..', '..', '..', '.import-data');

export class IdMap {
  private maps: Map<string, Map<number, string>> = new Map();
  private filePath: string;

  constructor(filename = 'id-map.json') {
    if (!existsSync(MAP_DIR)) {
      mkdirSync(MAP_DIR, { recursive: true });
    }
    this.filePath = join(MAP_DIR, filename);
    this.load();
  }

  /**
   * Set a mapping: fbTable.fbId → protosFarmUuid
   */
  set(table: string, fbId: number, uuid: string): void {
    if (!this.maps.has(table)) {
      this.maps.set(table, new Map());
    }
    this.maps.get(table)!.set(fbId, uuid);
  }

  /**
   * Get the Protos Farm UUID for a Firebird ID.
   */
  get(table: string, fbId: number | null): string | undefined {
    if (fbId === null || fbId === undefined) return undefined;
    return this.maps.get(table)?.get(fbId);
  }

  /**
   * Check if a mapping exists.
   */
  has(table: string, fbId: number): boolean {
    return this.maps.get(table)?.has(fbId) ?? false;
  }

  /**
   * Get the first mapped UUID for a table.
   */
  first(table: string): string | undefined {
    const map = this.maps.get(table);
    if (!map || map.size === 0) return undefined;
    return map.values().next().value;
  }

  /**
   * Get count of mappings for a table.
   */
  count(table: string): number {
    return this.maps.get(table)?.size ?? 0;
  }

  /**
   * Persist to disk.
   */
  save(): void {
    const serializable: Record<string, Record<string, string>> = {};
    for (const [table, map] of this.maps) {
      serializable[table] = {};
      for (const [fbId, uuid] of map) {
        serializable[table][String(fbId)] = uuid;
      }
    }
    writeFileSync(this.filePath, JSON.stringify(serializable, null, 2));
  }

  /**
   * Load from disk.
   */
  private load(): void {
    if (!existsSync(this.filePath)) return;

    const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
    for (const [table, entries] of Object.entries(data as Record<string, Record<string, string>>)) {
      const map = new Map<number, string>();
      for (const [fbId, uuid] of Object.entries(entries)) {
        map.set(Number(fbId), uuid);
      }
      this.maps.set(table, map);
    }
    console.log(
      `  Loaded ID map: ${[...this.maps.entries()].map(([t, m]) => `${t}(${m.size})`).join(', ')}`,
    );
  }
}
