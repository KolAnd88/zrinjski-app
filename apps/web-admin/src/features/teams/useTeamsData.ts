import { useCallback, useEffect, useState } from 'react';
import type { Day, Gender, Grp, Player, Team, TablesInsert, TablesUpdate } from '@zrinjski/core';
import { roundRobinPairings } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  createGroup,
  createPlayer,
  createTeam,
  deleteGroup,
  deletePlayer,
  deleteTeam,
  fetchGroups,
  fetchGroupsWithMatches,
  fetchPlayersByTeams,
  fetchTeams,
  insertMatches,
  maxMatchSortOrder,
  setTeamGroups,
  updatePlayer,
  updateTeam,
} from '../../lib/data';

export type TeamsData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  gender: Gender;
  setGender: (g: Gender) => void;
  groups: Grp[];
  teams: Team[];
  players: Player[];
  playerCount: (teamId: string) => number;
  reload: () => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  removeGroup: (id: string) => Promise<void>;
  addTeam: (name: string) => Promise<Team>;
  editTeam: (id: string, patch: TablesUpdate<'team'>) => Promise<void>;
  assignGroups: (changes: { id: string; group_id: string | null }[]) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
  addPlayer: (teamId: string, row: Omit<TablesInsert<'player'>, 'team_id'>) => Promise<void>;
  editPlayer: (id: string, patch: TablesUpdate<'player'>) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  generateGroupMatches: (days: Day[]) => Promise<{ created: number; skipped: number }>;
};

export function useTeamsData(tournamentId: string | null): TeamsData {
  const [gender, setGender] = useState<Gender>('m');
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Grp[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [gs, ts] = await Promise.all([
        fetchGroups(tournamentId, gender),
        fetchTeams(tournamentId, gender),
      ]);
      setGroups(gs);
      setTeams(ts);
      // Igrači svih ekipa ovog spola (za brojač + uređivanje sastava).
      const ids = ts.map((t) => t.id);
      setPlayers(ids.length > 0 ? await fetchPlayersByTeams(ids) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId, gender]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const playerCount = useCallback(
    (teamId: string) => players.filter((p) => p.team_id === teamId).length,
    [players]
  );

  const addGroup = useCallback(
    async (name: string) => {
      if (!tournamentId) return;
      const g = await createGroup(tournamentId, gender, name, groups.length);
      setGroups((x) => [...x, g]);
    },
    [tournamentId, gender, groups.length]
  );

  const removeGroup = useCallback(async (id: string) => {
    await deleteGroup(id);
    setGroups((x) => x.filter((g) => g.id !== id));
    // ekipe ostaju, group_id postaje null (FK on delete set null) — osvježi lokalno
    setTeams((x) => x.map((t) => (t.group_id === id ? { ...t, group_id: null } : t)));
  }, []);

  const addTeam = useCallback(
    async (name: string) => {
      if (!tournamentId) throw new Error('no tournament');
      const t = await createTeam({ tournament_id: tournamentId, gender, name });
      setTeams((x) => [...x, t].sort((a, b) => a.name.localeCompare(b.name, 'hr')));
      return t;
    },
    [tournamentId, gender]
  );

  const editTeam = useCallback(async (id: string, patch: TablesUpdate<'team'>) => {
    await updateTeam(id, patch);
    setTeams((x) =>
      x
        .map((t) => (t.id === id ? { ...t, ...patch } : t))
        .sort((a, b) => a.name.localeCompare(b.name, 'hr'))
    );
  }, []);

  const removeTeam = useCallback(async (id: string) => {
    await deleteTeam(id);
    setTeams((x) => x.filter((t) => t.id !== id));
    setPlayers((x) => x.filter((p) => p.team_id !== id));
  }, []);

  const addPlayer = useCallback(
    async (teamId: string, row: Omit<TablesInsert<'player'>, 'team_id'>) => {
      const count = players.filter((p) => p.team_id === teamId).length;
      const p = await createPlayer({ ...row, team_id: teamId, sort_order: row.sort_order ?? count });
      setPlayers((x) => [...x, p]);
    },
    [players]
  );

  const editPlayer = useCallback(async (id: string, patch: TablesUpdate<'player'>) => {
    await updatePlayer(id, patch);
    setPlayers((x) => x.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePlayer = useCallback(async (id: string) => {
    await deletePlayer(id);
    setPlayers((x) => x.filter((p) => p.id !== id));
  }, []);

  /**
   * Spremi cijeli ždrijeb u jednoj transakciji.
   *
   * Ide kroz RPC, ne red po red: da treći upis pukne, prva bi dva ostala
   * promijenjena u bazi iako korisnik vidi grešku — ždrijeb bi tiho ostao
   * napola. Ovako prođu sve ekipe ili nijedna.
   */
  const assignGroups = useCallback(
    async (changes: { id: string; group_id: string | null }[]) => {
      await setTeamGroups(changes);
      setTeams((x) =>
        x.map((t) => {
          const c = changes.find((ch) => ch.id === t.id);
          return c ? { ...t, group_id: c.group_id } : t;
        })
      );
    },
    []
  );

  const generateGroupMatches = useCallback(
    async (days: Day[]) => {
      if (!tournamentId) return { created: 0, skipped: 0 };
      const withMatches = await fetchGroupsWithMatches(tournamentId);
      let order = (await maxMatchSortOrder(tournamentId)) + 1;
      const firstPlayingDay = days.find((d) => !!d.first_match_time) ?? null;
      const dayId = firstPlayingDay?.id ?? null;

      const rows: TablesInsert<'match'>[] = [];
      let skipped = 0;
      for (const g of groups) {
        if (withMatches.has(g.id)) {
          skipped++;
          continue;
        }
        const ids = teams.filter((t) => t.group_id === g.id).map((t) => t.id);
        const pairs = roundRobinPairings(ids);
        for (const p of pairs) {
          rows.push({
            tournament_id: tournamentId,
            gender,
            stage: 'group',
            grp_id: g.id,
            home_team_id: p.home,
            away_team_id: p.away,
            day_id: dayId,
            sort_order: order++,
          });
        }
      }
      const created = await insertMatches(rows);
      return { created, skipped };
    },
    [tournamentId, gender, groups, teams]
  );

  return {
    loading,
    configured: HAS_DATA,
    error,
    reload,
    gender,
    setGender,
    groups,
    teams,
    players,
    playerCount,
    addGroup,
    removeGroup,
    addTeam,
    editTeam,
    removeTeam,
    addPlayer,
    editPlayer,
    removePlayer,
    assignGroups,
    generateGroupMatches,
  };
}
