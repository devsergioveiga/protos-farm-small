import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineAnimal, OfflineAnimalBreedComposition } from '@/types/offline';

export interface AnimalWithBreeds extends OfflineAnimal {
  breeds?: OfflineAnimalBreedComposition[];
}

export function createAnimalRepository(db: SQLiteDatabase) {
  return {
    async getByFarmId(farmId: string, limit = 200, offset = 0): Promise<OfflineAnimal[]> {
      return db.getAllAsync<OfflineAnimal>(
        'SELECT * FROM animals WHERE farm_id = ? ORDER BY ear_tag LIMIT ? OFFSET ?',
        farmId,
        limit,
        offset,
      );
    },

    async getById(id: string): Promise<OfflineAnimal | null> {
      return db.getFirstAsync<OfflineAnimal>('SELECT * FROM animals WHERE id = ?', id);
    },

    async getByEarTag(farmId: string, earTag: string): Promise<OfflineAnimal | null> {
      return db.getFirstAsync<OfflineAnimal>(
        'SELECT * FROM animals WHERE farm_id = ? AND ear_tag = ?',
        farmId,
        earTag,
      );
    },

    async getByLotId(lotId: string): Promise<OfflineAnimal[]> {
      return db.getAllAsync<OfflineAnimal>(
        'SELECT * FROM animals WHERE lot_id = ? ORDER BY ear_tag',
        lotId,
      );
    },

    async getByPastureId(pastureId: string): Promise<OfflineAnimal[]> {
      return db.getAllAsync<OfflineAnimal>(
        'SELECT * FROM animals WHERE pasture_id = ? ORDER BY ear_tag',
        pastureId,
      );
    },

    async search(farmId: string, query: string, limit = 50): Promise<OfflineAnimal[]> {
      const pattern = `%${query}%`;
      return db.getAllAsync<OfflineAnimal>(
        `SELECT * FROM animals WHERE farm_id = ?
         AND (ear_tag LIKE ? OR name LIKE ? OR rfid_tag LIKE ?)
         ORDER BY ear_tag LIMIT ?`,
        farmId,
        pattern,
        pattern,
        pattern,
        limit,
      );
    },

    async upsertMany(animals: OfflineAnimal[]): Promise<void> {
      if (animals.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO animals (
            id, farm_id, ear_tag, rfid_tag, name, sex, birth_date,
            birth_date_estimated, category, category_suggested, origin,
            entry_weight_kg, body_condition_score, sire_id, dam_id,
            lot_id, pasture_id, photo_url, notes, created_at, updated_at
          ) VALUES (
            $id, $farm_id, $ear_tag, $rfid_tag, $name, $sex, $birth_date,
            $birth_date_estimated, $category, $category_suggested, $origin,
            $entry_weight_kg, $body_condition_score, $sire_id, $dam_id,
            $lot_id, $pasture_id, $photo_url, $notes, $created_at, $updated_at
          )
        `);
        try {
          for (const a of animals) {
            await stmt.executeAsync({
              $id: a.id,
              $farm_id: a.farm_id,
              $ear_tag: a.ear_tag,
              $rfid_tag: a.rfid_tag,
              $name: a.name,
              $sex: a.sex,
              $birth_date: a.birth_date,
              $birth_date_estimated: a.birth_date_estimated,
              $category: a.category,
              $category_suggested: a.category_suggested,
              $origin: a.origin,
              $entry_weight_kg: a.entry_weight_kg,
              $body_condition_score: a.body_condition_score,
              $sire_id: a.sire_id,
              $dam_id: a.dam_id,
              $lot_id: a.lot_id,
              $pasture_id: a.pasture_id,
              $photo_url: a.photo_url,
              $notes: a.notes,
              $created_at: a.created_at,
              $updated_at: a.updated_at,
            });
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },

    async upsertBreedCompositions(compositions: OfflineAnimalBreedComposition[]): Promise<void> {
      if (compositions.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO animal_breed_compositions (
            id, animal_id, breed_id, breed_name, fraction, percentage
          ) VALUES (
            $id, $animal_id, $breed_id, $breed_name, $fraction, $percentage
          )
        `);
        try {
          for (const c of compositions) {
            await stmt.executeAsync({
              $id: c.id,
              $animal_id: c.animal_id,
              $breed_id: c.breed_id,
              $breed_name: c.breed_name,
              $fraction: c.fraction,
              $percentage: c.percentage,
            });
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },

    async getBreedCompositions(animalId: string): Promise<OfflineAnimalBreedComposition[]> {
      return db.getAllAsync<OfflineAnimalBreedComposition>(
        'SELECT * FROM animal_breed_compositions WHERE animal_id = ?',
        animalId,
      );
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      // Breed compositions cascade via FK
      await db.runAsync('DELETE FROM animals WHERE farm_id = ?', farmId);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM animals WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM animal_breed_compositions');
      await db.runAsync('DELETE FROM animals');
    },
  };
}
