import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineFieldTeam, OfflineFieldTeamMember } from '@/types/offline';

export function createFieldTeamRepository(db: SQLiteDatabase) {
  return {
    async upsertMany(teams: OfflineFieldTeam[]): Promise<void> {
      if (teams.length === 0) return;
      const stmt = await db.prepareAsync(`
        INSERT OR REPLACE INTO field_teams (
          id, farm_id, name, team_type, is_temporary,
          leader_id, leader_name, notes, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $name, $team_type, $is_temporary,
          $leader_id, $leader_name, $notes, $created_at, $updated_at
        )
      `);
      try {
        for (const t of teams) {
          await stmt.executeAsync({
            $id: t.id,
            $farm_id: t.farm_id,
            $name: t.name,
            $team_type: t.team_type,
            $is_temporary: t.is_temporary,
            $leader_id: t.leader_id,
            $leader_name: t.leader_name,
            $notes: t.notes,
            $created_at: t.created_at,
            $updated_at: t.updated_at,
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async upsertMembers(members: OfflineFieldTeamMember[]): Promise<void> {
      if (members.length === 0) return;
      const stmt = await db.prepareAsync(`
        INSERT OR REPLACE INTO field_team_members (
          id, team_id, user_id, user_name, joined_at, left_at
        ) VALUES (
          $id, $team_id, $user_id, $user_name, $joined_at, $left_at
        )
      `);
      try {
        for (const m of members) {
          await stmt.executeAsync({
            $id: m.id,
            $team_id: m.team_id,
            $user_id: m.user_id,
            $user_name: m.user_name,
            $joined_at: m.joined_at,
            $left_at: m.left_at,
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineFieldTeam[]> {
      return db.getAllAsync<OfflineFieldTeam>(
        'SELECT * FROM field_teams WHERE farm_id = ? ORDER BY name ASC',
        farmId,
      );
    },

    async getActiveMembers(teamId: string): Promise<OfflineFieldTeamMember[]> {
      return db.getAllAsync<OfflineFieldTeamMember>(
        'SELECT * FROM field_team_members WHERE team_id = ? AND left_at IS NULL ORDER BY user_name ASC',
        teamId,
      );
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      const teamIds = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM field_teams WHERE farm_id = ?',
        farmId,
      );
      if (teamIds.length > 0) {
        const ids = teamIds.map((t) => `'${t.id}'`).join(',');
        await db.execAsync(`DELETE FROM field_team_members WHERE team_id IN (${ids})`);
      }
      await db.runAsync('DELETE FROM field_teams WHERE farm_id = ?', farmId);
    },

    async clear(): Promise<void> {
      await db.execAsync('DELETE FROM field_team_members');
      await db.execAsync('DELETE FROM field_teams');
    },
  };
}
