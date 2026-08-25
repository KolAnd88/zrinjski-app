// repData.ts — podaci za portal predstavnika ekipe.
//
// Odvojeno od useData (koji drži cijeli turnir u memoriji za gledatelje) jer
// je ovo mali, osobni skup: moja prijava i moj sastav. RLS na bazi jamči da
// predstavnik vidi i mijenja samo svoje.
import type { Gender, Player, RegistrationPlayer, RegistrationStatus, Team } from '@zrinjski/core';
import { supabase } from './supabase';

export type MyRegistration = {
  id: string;
  team_name: string;
  gender: Gender;
  status: RegistrationStatus;
  players: RegistrationPlayer[];
  approved_team_id: string | null;
};

function sb() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

/** Prijava koju je poslao prijavljeni korisnik; null ako je još nema. */
export async function fetchMyRegistration(): Promise<MyRegistration | null> {
  const c = sb();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { data, error } = await c
    .from('registration')
    .select('id, team_name, gender, status, players, approved_team_id')
    .eq('created_by', uid)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MyRegistration) ?? null;
}

/** Prijavi vlastitu ekipu. Ponovni poziv vraća postojeću prijavu. */
export async function submitMyRegistration(input: {
  team_name: string;
  gender: Gender;
  rep_name: string;
}): Promise<void> {
  const { error } = await sb().rpc('submit_my_registration', {
    p_team_name: input.team_name,
    p_gender: input.gender,
    p_rep_name: input.rep_name,
  });
  if (error) throw error;
}

/** Nacrt sastava dok prijava čeka odobrenje. */
export async function saveMyRegistrationPlayers(players: RegistrationPlayer[]): Promise<void> {
  const { error } = await sb().rpc('update_my_registration_players', { p_players: players });
  if (error) throw error;
}

/** Odobrena ekipa sa svojim sastavom. */
export async function fetchTeamWithPlayers(
  teamId: string
): Promise<{ team: Team; players: Player[] } | null> {
  const c = sb();
  const [teamRes, playersRes] = await Promise.all([
    c.from('team').select('*').eq('id', teamId).maybeSingle(),
    c.from('player').select('*').eq('team_id', teamId).order('sort_order', { ascending: true }),
  ]);
  if (teamRes.error) throw teamRes.error;
  if (playersRes.error) throw playersRes.error;
  if (!teamRes.data) return null;
  return { team: teamRes.data, players: playersRes.data ?? [] };
}

export async function createPlayer(row: {
  team_id: string;
  name: string;
  number: number | null;
  sort_order: number;
}): Promise<Player> {
  const { data, error } = await sb().from('player').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id: string, patch: Partial<Player>): Promise<void> {
  const { error } = await sb().from('player').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await sb().from('player').delete().eq('id', id);
  if (error) throw error;
}

// ── Glasanje za najboljeg igrača turnira ───────────────────────────────────
// Isti RPC-i kao u web adminu; provjere (otvoreno glasanje, ne za vlastitu
// ekipu, ista konkurencija) su u bazi pa ih ne dupliramo ovdje.

export type MvpVoteError =
  | 'closed'
  | 'not_a_rep'
  | 'own_team'
  | 'other_gender'
  | 'no_player';

export class MvpVoteFailed extends Error {
  constructor(public readonly code: MvpVoteError) {
    super(code);
    this.name = 'MvpVoteFailed';
  }
}

/** Za koga je prijavljeni predstavnik glasao; null ako još nije. */
export async function fetchMyMvpVote(): Promise<string | null> {
  const c = sb();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await c.from('mvp_vote').select('player_id').eq('voter_id', uid).maybeSingle();
  if (error) throw error;
  return data?.player_id ?? null;
}

/** Predaj ili promijeni glas. */
export async function castMyMvpVote(playerId: string): Promise<void> {
  const { error } = await sb().rpc('cast_my_mvp_vote', { p_player_id: playerId });
  if (!error) return;

  const m = error.message.toLowerCase();
  if (m.includes('vote_closed')) throw new MvpVoteFailed('closed');
  if (m.includes('vote_not_a_rep')) throw new MvpVoteFailed('not_a_rep');
  if (m.includes('vote_own_team')) throw new MvpVoteFailed('own_team');
  if (m.includes('vote_other_competition')) throw new MvpVoteFailed('other_gender');
  if (m.includes('vote_no_player')) throw new MvpVoteFailed('no_player');
  throw error;
}

