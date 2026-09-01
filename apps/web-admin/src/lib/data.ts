// data.ts — pristup podacima za web admin.
// Dvije grane: DEMO (lokalni podaci u memoriji, demoDb) i Supabase (pravi backend).
// DEMO grana omogućuje pregled cijelog admina bez baze; ukloni se kad DEMO = false.
import type {
  AppUser,
  Contact,
  Day,
  GalleryPhoto,
  Gender,
  Grp,
  LocationRow,
  Match,
  MatchEvent,
  MvpResult,
  NotificationLog,
  Player,
  ProgramItem,
  Registration,
  RegistrationPlayer,
  RegistrationStatus,
  SlotPatch,
  ShareSponsor,
  Sponsor,
  Team,
  Tournament,
  TablesInsert,
  TablesUpdate,
} from '@zrinjski/core';
import { DEMO, supabase } from './supabase';
import { db, genId } from './demoDb';

const ASSETS_BUCKET = 'public-assets';

export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase nije konfiguriran.');
    this.name = 'NotConfiguredError';
  }
}

export type RegistrationSubmissionErrorCode =
  | 'closed'
  | 'duplicate'
  | 'rate_limited'
  | 'invalid'
  | 'unavailable';

export class RegistrationSubmissionError extends Error {
  constructor(public readonly code: RegistrationSubmissionErrorCode) {
    super(code);
    this.name = 'RegistrationSubmissionError';
  }
}

function client() {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}

function patch<T extends { id: string }>(arr: T[], id: string, p: Partial<T>): void {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = { ...arr[i]!, ...p };
}

/** Timestamp za sortiranje — Date-based (tekstualna usporedba vara kod miješanih zapisa zone). */
const TS_MAX = 8.64e15; // najveći valjani Date ms (konačan → nema NaN u komparatoru)
function ts(iso: string | null | undefined): number {
  if (!iso) return TS_MAX; // bez vremena → na kraj (uzlazno)
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? TS_MAX : t;
}

// ── Turnir / dani ──────────────────────────────────────────────────────────
export async function fetchActiveTournament(): Promise<Tournament | null> {
  if (DEMO) return db.tournament;
  const { data, error } = await client()
    .from('tournament')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDays(tournamentId: string): Promise<Day[]> {
  if (DEMO) return db.days.filter((d) => d.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('day')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTournament(id: string, p: TablesUpdate<'tournament'>): Promise<void> {
  if (DEMO) {
    db.tournament = { ...db.tournament, ...p } as Tournament;
    return;
  }
  const { error } = await client().from('tournament').update(p).eq('id', id);
  if (error) throw error;
}

export async function createDay(tournamentId: string, date: string, sortOrder: number): Promise<Day> {
  if (DEMO) {
    const d: Day = { id: genId('d'), tournament_id: tournamentId, date, first_match_time: null, sort_order: sortOrder };
    db.days.push(d);
    return d;
  }
  const { data, error } = await client()
    .from('day')
    .insert({ tournament_id: tournamentId, date, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateDay(id: string, p: TablesUpdate<'day'>): Promise<void> {
  if (DEMO) return patch(db.days, id, p as Partial<Day>);
  const { error } = await client().from('day').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteDay(id: string): Promise<void> {
  if (DEMO) {
    db.days = db.days.filter((d) => d.id !== id);
    return;
  }
  const { error } = await client().from('day').delete().eq('id', id);
  if (error) throw error;
}

// ── Satnica ──────────────────────────────────────────────────────────────
export async function fetchMatchesForSchedule(tournamentId: string): Promise<Match[]> {
  if (DEMO) return db.matches.filter((m) => m.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Zamijeni termin i mjesto u redu dvjema utakmicama.
 *
 * Ne pregenerira satnicu — samo dva reda. Ponovno generiranje bi obrisalo
 * zabiljezena kasnjenja (shiftScheduleFrom) svim ostalim utakmicama tog dana.
 */
export async function applySlotSwap(patches: SlotPatch[]): Promise<void> {
  if (DEMO) {
    for (const p of patches) {
      patch(db.matches, p.id, { sort_order: p.sort_order, scheduled_time: p.scheduled_time });
    }
    return;
  }
  await applyMatchSlots(
    patches.map((p) => ({
      id: p.id,
      scheduled_time: p.scheduled_time,
      sort_order: p.sort_order,
    }))
  );
}

/**
 * Promijeni termin i/ili mjesto u redu više utakmica ODJEDNOM.
 *
 * Ide kroz RPC, ne kroz niz nezavisnih UPDATE-ova. Pomak zbog kašnjenja dira
 * sve kasnije utakmice tog dana; prekine li se na pola, dio ima novo vrijeme a
 * dio staro. Kod zamjene termina je gore: prođe li samo jedan red, dvije
 * utakmice završe u istom terminu.
 *
 * Broj promijenjenih se provjerava jer `update` bez `select` ne javlja grešku
 * kad RLS ne da nijedan red — sučelje bi inače reklo da je prošlo.
 */
async function applyMatchSlots(
  changes: { id: string; scheduled_time: string | null; sort_order?: number | null }[]
): Promise<void> {
  if (changes.length === 0) return;
  // Provjeru potpunosti radi BAZA (0025) i ondje ponisti transakciju. Ranija
  // provjera ovdje stizala je prekasno: upis je vec bio potvrden, a greska je
  // lazno sugerirala da se nista nije promijenilo.
  const { error } = await client().rpc('set_match_slots', { p_changes: changes });
  if (error) throw error;
}

export async function applyScheduledTimes(updates: { id: string; scheduledTime: string }[]): Promise<void> {
  if (DEMO) {
    for (const u of updates) patch(db.matches, u.id, { scheduled_time: u.scheduledTime });
    return;
  }
  await applyMatchSlots(updates.map((u) => ({ id: u.id, scheduled_time: u.scheduledTime })));
}

/**
 * Kašnjenje uživo (spec): pomakni zadanu utakmicu i SVE KASNIJE utakmice istog
 * dana za `delayMin` minuta + zabilježi obavijest "promjena satnice".
 * Radi nad stvarnim scheduled_time vrijednostima (poštuje ručne izmjene).
 * Završene utakmice se ne diraju. Vraća broj pomaknutih utakmica.
 */
export async function shiftScheduleFrom(
  matchId: string,
  delayMin: number,
  notifTitle: string
): Promise<number> {
  if (delayMin === 0) return 0;
  const cur = await fetchMatch(matchId);
  if (!cur || !cur.day_id) return 0;

  const all = await fetchMatchesForSchedule(cur.tournament_id);
  const targets = all.filter(
    (m) =>
      m.day_id === cur.day_id &&
      m.sort_order >= cur.sort_order &&
      m.status !== 'finished' &&
      m.scheduled_time
  );
  if (targets.length === 0) return 0;

  await applyScheduledTimes(
    targets.map((m) => ({
      id: m.id,
      scheduledTime: new Date(new Date(m.scheduled_time!).getTime() + delayMin * 60_000).toISOString(),
    }))
  );

  // Dosad se promjena satnice samo BILJEŽILA. Zapis u dnevniku nikoga ne
  // obavijesti — a upravo je pomak zbog kašnjenja ono zbog čega ljudi dolaze
  // uzalud.
  notifyQuietly({
    tournament_id: cur.tournament_id,
    type: 'schedule_change',
    audience: 'all',
    title: notifTitle,
    body: null,
  });

  return targets.length;
}

// ── Grupe ────────────────────────────────────────────────────────────────
export async function fetchGroups(tournamentId: string, gender: Gender): Promise<Grp[]> {
  if (DEMO)
    return db.groups
      .filter((g) => g.tournament_id === tournamentId && g.gender === gender)
      .sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('grp')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(tournamentId: string, gender: Gender, name: string, sortOrder: number): Promise<Grp> {
  if (DEMO) {
    const g: Grp = { id: genId('g'), tournament_id: tournamentId, gender, name, sort_order: sortOrder };
    db.groups.push(g);
    return g;
  }
  const { data, error } = await client()
    .from('grp')
    .insert({ tournament_id: tournamentId, gender, name, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  if (DEMO) {
    db.groups = db.groups.filter((g) => g.id !== id);
    db.teams = db.teams.map((t) => (t.group_id === id ? { ...t, group_id: null } : t));
    return;
  }
  const { error } = await client().from('grp').delete().eq('id', id);
  if (error) throw error;
}

// ── Ekipe ────────────────────────────────────────────────────────────────
export async function fetchTeams(tournamentId: string, gender: Gender): Promise<Team[]> {
  if (DEMO)
    return db.teams
      .filter((t) => t.tournament_id === tournamentId && t.gender === gender)
      .sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  const { data, error } = await client()
    .from('team')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Sve ekipe turnira (oba spola) — za grbove/mape u raznim ekranima. */
export async function fetchAllTeams(tournamentId: string): Promise<Team[]> {
  if (DEMO) return db.teams.filter((t) => t.tournament_id === tournamentId);
  const { data, error } = await client().from('team').select('*').eq('tournament_id', tournamentId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeam(id: string): Promise<Team | null> {
  if (DEMO) return db.teams.find((t) => t.id === id) ?? null;
  const { data, error } = await client().from('team').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTeam(row: TablesInsert<'team'>): Promise<Team> {
  if (DEMO) {
    const t: Team = {
      id: genId('team'),
      tournament_id: row.tournament_id,
      name: row.name,
      short_code: row.short_code ?? null,
      color: row.color ?? null,
      gender: row.gender,
      group_id: row.group_id ?? null,
      coach_name: row.coach_name ?? null,
      logo_url: row.logo_url ?? null,
      // Nova ekipa ide na kraj → dobiva sljedeću boju iz palete.
      sort_order:
        row.sort_order ??
        db.teams
          .filter((x) => x.tournament_id === row.tournament_id && x.gender === row.gender)
          .reduce((mx, x) => Math.max(mx, x.sort_order), -1) + 1,
      created_at: new Date().toISOString(),
    };
    db.teams.push(t);
    return t;
  }
  // Bez sort_order baza upiše 0 → nova ekipa dijeli boju grba s prvom i skače
  // na vrh popisa. Zato ga dodijelimo ovdje: sljedeći slobodan unutar istog spola.
  const insert =
    row.sort_order == null
      ? { ...row, sort_order: (await maxTeamSortOrder(row.tournament_id, row.gender)) + 1 }
      : row;
  const { data, error } = await client().from('team').insert(insert).select('*').single();
  if (error) throw error;
  return data;
}

/** Najveći `sort_order` među ekipama istog spola; -1 ako ih još nema. */
export async function maxTeamSortOrder(tournamentId: string, gender: Gender): Promise<number> {
  if (DEMO)
    return db.teams
      .filter((t) => t.tournament_id === tournamentId && t.gender === gender)
      .reduce((mx, t) => Math.max(mx, t.sort_order), -1);
  const { data, error } = await client()
    .from('team')
    .select('sort_order')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.sort_order ?? -1;
}

export async function updateTeam(id: string, p: TablesUpdate<'team'>): Promise<void> {
  if (DEMO) return patch(db.teams, id, p as Partial<Team>);
  const { error } = await client().from('team').update(p).eq('id', id);
  if (error) throw error;
}

/**
 * Spremi cijeli ždrijeb u jednoj transakciji.
 *
 * Red-po-red bi kod pucanja na trećoj ekipi ostavio prve dvije promijenjene, a
 * korisniku javio grešku — turnir bi tiho ostao s polovičnim ždrijebom. RPC
 * `set_team_groups` mijenja sve ekipe jednim UPDATE-om ili nijednu.
 */
export async function setTeamGroups(
  changes: { id: string; group_id: string | null }[]
): Promise<void> {
  if (changes.length === 0) return;
  if (DEMO) {
    for (const c of changes) patch(db.teams, c.id, { group_id: c.group_id } as Partial<Team>);
    return;
  }
  const { error } = await client().rpc('set_team_groups', { p_changes: changes });
  if (error) throw error;
}

/**
 * Postavi ekipe u završnicu u jednoj transakciji.
 *
 * Ide kroz RPC iz istog razloga kao ždrijeb: postavlja se dvije do četiri
 * utakmice odjednom, pa bi djelomičan upis ostavio bracket nedosljedan usred
 * turnira. Baza uz to sama odbija dirati utakmicu koja je počela.
 */
export async function setKnockoutTeams(
  changes: { id: string; home_team_id: string | null; away_team_id: string | null }[]
): Promise<void> {
  if (changes.length === 0) return;
  if (DEMO) {
    for (const c of changes)
      patch(db.matches, c.id, {
        home_team_id: c.home_team_id,
        away_team_id: c.away_team_id,
      } as Partial<Match>);
    return;
  }
  const { error } = await client().rpc('set_knockout_teams', { p_changes: changes });
  if (error) throw error;
}

/**
 * Kontakt predstavnika živi u `team_contact`, ne na `team`.
 *
 * `team` je javno čitljiv jer aplikacija gledateljima prikazuje ekipe, pa je
 * adresa ondje bila dohvatljiva svakome s anonimnim ključem — a taj je ključ
 * ugrađen u objavljenu aplikaciju.
 */
export async function fetchTeamContact(teamId: string): Promise<string | null> {
  if (DEMO) return db.teamContacts.find((c) => c.team_id === teamId)?.rep_email ?? null;
  const { data, error } = await client()
    .from('team_contact')
    .select('rep_email')
    .eq('team_id', teamId)
    .maybeSingle();
  if (error) throw error;
  return data?.rep_email ?? null;
}

export async function setTeamContact(teamId: string, email: string | null): Promise<void> {
  if (DEMO) {
    const found = db.teamContacts.find((c) => c.team_id === teamId);
    if (found) found.rep_email = email;
    else db.teamContacts.push({ team_id: teamId, rep_email: email, updated_at: new Date().toISOString() });
    return;
  }
  const { error } = await client()
    .from('team_contact')
    .upsert({ team_id: teamId, rep_email: email, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * Napravi utakmice zavrsnice koje nedostaju.
 *
 * Odluku donosi BAZA, ne preglednik: dva organizatora mogu istodobno vidjeti
 * da utakmice nedostaju i obojica ih napraviti. Funkcija se zakljucava po
 * turniru i spolu, pa drugi poziv zatekne posao gotovim.
 */
export async function ensureKnockoutMatches(
  tournamentId: string,
  gender: Gender,
  dayId: string | null
): Promise<number> {
  if (DEMO) {
    // U demou nema istodobnosti; dovoljno je ne duplicirati.
    const have = (s: string) =>
      db.matches.filter((m) => m.tournament_id === tournamentId && m.gender === gender && m.stage === s).length;
    let order = db.matches.reduce((n, m) => Math.max(n, m.sort_order), -1) + 1;
    let made = 0;
    const add = (stage: Match['stage'], h: string, a: string) => {
      db.matches.push({
        id: genId('m'), tournament_id: tournamentId, day_id: dayId, gender, stage,
        grp_id: null, home_team_id: null, away_team_id: null,
        home_placeholder: h, away_placeholder: a, home_score: 0, away_score: 0,
        scheduled_time: null, status: 'scheduled', sort_order: order++,
        best_player_id: null, current_minute: null, current_half: null,
      });
      made += 1;
    };
    const semis = have('semifinal');
    if (semis < 1) add('semifinal', 'A1', 'B2');
    if (semis < 2) add('semifinal', 'A2', 'B1');
    if (have('third_place') < 1) add('third_place', 'Poraženi PF1', 'Poraženi PF2');
    if (have('final') < 1) add('final', 'Pobjednik PF1', 'Pobjednik PF2');
    return made;
  }
  const { data, error } = await client().rpc('ensure_knockout_matches', {
    p_tournament_id: tournamentId,
    p_gender: gender,
    p_day_id: dayId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Promijeni sastav u prijavi koja jos ceka odobrenje.
 *
 * Klubovi u prijavi cesto zaborave igraca ili upisu nekoga tko ne dolazi.
 * Dosad se to moglo popraviti tek NAKON odobrenja, u ekipi — a odobrenje je
 * vec napravilo igrace, pa se visak morao brisati zasebno.
 *
 *  se drzi u skladu sa sastavom: on je ono sto se vidi na
 * kartici prijave.
 */
export async function updateRegistrationPlayers(
  id: string,
  players: RegistrationPlayer[]
): Promise<void> {
  if (DEMO) {
    patch(db.registrations, id, { players, player_count: players.length } as Partial<Registration>);
    return;
  }
  // Ide kroz funkciju, ne izravnim upisom: 0011 je oduzeo ovlast nad tablicom
  // `registration` i prijavljenima i anonimnima, pa RLS pravilo za admina nema
  // sto dopustiti — izravan `update` pada s "permission denied". Radilo bi u
  // DEMO nacinu i palo na zivoj bazi.
  const { error } = await client().rpc('set_registration_players', {
    p_registration_id: id,
    p_players: players,
  });
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  if (DEMO) {
    db.teams = db.teams.filter((t) => t.id !== id);
    db.players = db.players.filter((p) => p.team_id !== id);
    return;
  }
  const { error } = await client().from('team').delete().eq('id', id);
  if (error) throw error;
}

// ── Portal predstavnika ────────────────────────────────────────────────────
/** Ekipa + sastav za predstavnika (RLS: čitanje je javno, pisanje samo svoje). */
export async function fetchTeamWithPlayers(
  teamId: string
): Promise<{ team: Team; players: Player[] } | null> {
  const team = await fetchTeam(teamId);
  if (!team) return null;
  return { team, players: await fetchPlayers(teamId) };
}

// ── Dimenzije slike ───────────────────────────────────────────────────────
/**
 * Širina i visina slike u pikselima, pročitane u pregledniku prije uploada.
 * Vraća null kad se ne mogu utvrditi — SVG je vektor i često nema zadane
 * piksele, pa se za njega provjerava samo težina datoteke.
 */
export function readImageSize(file: File): Promise<{ w: number; h: number } | null> {
  if (file.type === 'image/svg+xml') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url); // neispravna datoteka → pusti dalje, upload će pasti
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Smanji sliku ako prelazi zadanu stranicu. Vraca original kad je vec u redu,
 * ili kad se dimenzije ne mogu utvrditi (SVG). Bolje smanjiti nego odbiti.
 */
export async function downscaleImage(file: File, maxPx: number): Promise<File> {
  const dim = await readImageSize(file);
  if (!dim) return file;
  const longest = Math.max(dim.w, dim.h);
  if (longest <= maxPx) return file;

  const k = maxPx / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(dim.w * k);
  canvas.height = Math.round(dim.h * k);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, 0.9));
    if (!blob) return file;
    return new File([blob], file.name, { type });
  } catch {
    return file; // ne uspije li smanjivanje, pusti original u provjeru
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Logotip sponzora ──────────────────────────────────────────────────────
/**
 * Sponzorski logo se u mobilnoj app crta `contain` unutar pločice 110×50 —
 * dakle nikad obrezan. Ali izduženi logo (npr. 2000×80) u toj pločici postane
 * nečitljivo sitan, pa omjer stranica ograničavamo na 4:1 u oba smjera.
 */
export const SPONSOR_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
export const SPONSOR_LOGO_MAX_BYTES = 1024 * 1024; // 1 MB
export const SPONSOR_LOGO_MIN_PX = 100;
export const SPONSOR_LOGO_MAX_PX = 3000;
export const SPONSOR_LOGO_MAX_RATIO = 4;

export class SponsorLogoError extends Error {
  constructor(public reason: 'type' | 'size' | 'tooSmall' | 'tooLarge' | 'ratio') {
    super(reason);
    this.name = 'SponsorLogoError';
  }
}

/** Provjeri sponzorski logo prije uploada. Baca SponsorLogoError. */
export async function validateSponsorLogo(file: File): Promise<void> {
  if (!SPONSOR_LOGO_TYPES.includes(file.type)) throw new SponsorLogoError('type');
  if (file.size > SPONSOR_LOGO_MAX_BYTES) throw new SponsorLogoError('size');

  const dim = await readImageSize(file);
  if (!dim) return; // SVG — vektor se skalira bez gubitka, omjer nije problem
  const min = Math.min(dim.w, dim.h);
  const max = Math.max(dim.w, dim.h);
  if (min < SPONSOR_LOGO_MIN_PX) throw new SponsorLogoError('tooSmall');
  if (max > SPONSOR_LOGO_MAX_PX) throw new SponsorLogoError('tooLarge');
  if (max / min > SPONSOR_LOGO_MAX_RATIO) throw new SponsorLogoError('ratio');
}

// ── Logotip ekipe ─────────────────────────────────────────────────────────
const TEAM_LOGOS_BUCKET = 'team-logos';
/** Ograničenja uploada logotipa (validira se prije slanja). */
export const TEAM_LOGO_MAX_BYTES = 512 * 1024; // 512 KB
export const TEAM_LOGO_TYPES = ['image/png', 'image/svg+xml'];
/** Premali logo je mutan na grbu od 190px (TV semafor); preveliki je bespotrebno težak. */
export const TEAM_LOGO_MIN_PX = 128;
export const TEAM_LOGO_MAX_PX = 2048;

export class LogoValidationError extends Error {
  constructor(public reason: 'type' | 'size' | 'tooSmall' | 'tooLarge') {
    super(reason);
    this.name = 'LogoValidationError';
  }
}

/**
 * Upload logotipa ekipe. Sprema se kao `{team_id}.png` (upsert — zamjenjuje stari)
 * i upisuje javni URL u `team.logo_url`. Vraća URL.
 */
export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  if (!TEAM_LOGO_TYPES.includes(file.type)) throw new LogoValidationError('type');
  if (file.size > TEAM_LOGO_MAX_BYTES) throw new LogoValidationError('size');

  // Piksele provjeravamo posebno od težine: mali PNG može biti lagan a mutan.
  const dim = await readImageSize(file);
  if (dim) {
    const min = Math.min(dim.w, dim.h);
    const max = Math.max(dim.w, dim.h);
    if (min < TEAM_LOGO_MIN_PX) throw new LogoValidationError('tooSmall');
    if (max > TEAM_LOGO_MAX_PX) throw new LogoValidationError('tooLarge');
  }

  if (DEMO) {
    const url = URL.createObjectURL(file);
    patch(db.teams, teamId, { logo_url: url });
    return url;
  }

  const c = client();
  const path = `${teamId}.png`;
  const { error } = await c.storage
    .from(TEAM_LOGOS_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
  if (error) throw error;

  // `?v=` razbija cache kad se logo zamijeni istim imenom.
  const base = c.storage.from(TEAM_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
  const url = `${base}?v=${Date.now()}`;
  await updateTeam(teamId, { logo_url: url });
  return url;
}

/** Ukloni logotip ekipe (datoteka + logo_url). */
export async function deleteTeamLogo(teamId: string): Promise<void> {
  if (DEMO) {
    patch(db.teams, teamId, { logo_url: null });
    return;
  }
  const c = client();
  await c.storage.from(TEAM_LOGOS_BUCKET).remove([`${teamId}.png`]);
  await updateTeam(teamId, { logo_url: null });
}

// ── Igrači ───────────────────────────────────────────────────────────────
export async function fetchPlayers(teamId: string): Promise<Player[]> {
  if (DEMO) return db.players.filter((p) => p.team_id === teamId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('player')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(row: TablesInsert<'player'>): Promise<Player> {
  if (DEMO) {
    const p: Player = {
      id: genId('p'),
      team_id: row.team_id,
      number: row.number ?? null,
      name: row.name,
      is_captain: row.is_captain ?? false,
      sort_order: row.sort_order ?? 0,
    };
    db.players.push(p);
    return p;
  }
  const { data, error } = await client().from('player').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id: string, p: TablesUpdate<'player'>): Promise<void> {
  if (DEMO) return patch(db.players, id, p as Partial<Player>);
  const { error } = await client().from('player').update(p).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  if (DEMO) {
    db.players = db.players.filter((p) => p.id !== id);
    return;
  }
  const { error } = await client().from('player').delete().eq('id', id);
  if (error) throw error;
}

// ── Generiranje grupnih utakmica ───────────────────────────────────────────
export async function fetchGroupsWithMatches(tournamentId: string): Promise<Set<string>> {
  if (DEMO)
    return new Set(
      db.matches
        .filter((m) => m.tournament_id === tournamentId && m.stage === 'group' && m.grp_id)
        .map((m) => m.grp_id as string)
    );
  const { data, error } = await client()
    .from('match')
    .select('grp_id')
    .eq('tournament_id', tournamentId)
    .eq('stage', 'group')
    .not('grp_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.grp_id).filter((x): x is string => !!x));
}

export async function maxMatchSortOrder(tournamentId: string): Promise<number> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId)
      .reduce((mx, m) => Math.max(mx, m.sort_order), -1);
  const { data, error } = await client()
    .from('match')
    .select('sort_order')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.sort_order ?? -1;
}

export async function insertMatches(rows: TablesInsert<'match'>[]): Promise<number> {
  if (rows.length === 0) return 0;
  if (DEMO) {
    for (const r of rows) {
      db.matches.push({
        id: genId('m'),
        tournament_id: r.tournament_id,
        day_id: r.day_id ?? null,
        gender: r.gender,
        stage: r.stage ?? 'group',
        grp_id: r.grp_id ?? null,
        home_team_id: r.home_team_id ?? null,
        away_team_id: r.away_team_id ?? null,
        home_placeholder: r.home_placeholder ?? null,
        away_placeholder: r.away_placeholder ?? null,
        home_score: r.home_score ?? 0,
        away_score: r.away_score ?? 0,
        scheduled_time: r.scheduled_time ?? null,
        status: r.status ?? 'scheduled',
        sort_order: r.sort_order ?? 0,
        best_player_id: r.best_player_id ?? null,
        current_minute: r.current_minute ?? null,
        current_half: r.current_half ?? null,
      });
    }
    return rows.length;
  }
  const { error, count } = await client().from('match').insert(rows, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
}

// ── Unos uživo ─────────────────────────────────────────────────────────────
export async function fetchMatch(id: string): Promise<Match | null> {
  if (DEMO) return db.matches.find((m) => m.id === id) ?? null;
  const { data, error } = await client().from('match').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchEnterableMatches(tournamentId: string): Promise<Match[]> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId && (m.status === 'scheduled' || m.status === 'live'))
      .sort((a, b) => ts(a.scheduled_time) - ts(b.scheduled_time) || a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_time', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchFinishedMatches(tournamentId: string): Promise<Match[]> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId && m.status === 'finished')
      .sort((a, b) => ts(b.scheduled_time) - ts(a.scheduled_time));
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'finished')
    .order('scheduled_time', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayersByTeams(teamIds: string[]): Promise<Player[]> {
  if (teamIds.length === 0) return [];
  if (DEMO) return db.players.filter((p) => teamIds.includes(p.team_id)).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('player')
    .select('*')
    .in('team_id', teamIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  if (DEMO) return db.events.filter((e) => e.match_id === matchId);
  const { data, error } = await client()
    .from('match_event')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertEvent(row: TablesInsert<'match_event'>): Promise<MatchEvent> {
  if (DEMO) {
    const e: MatchEvent = {
      id: genId('e'),
      match_id: row.match_id,
      team_id: row.team_id,
      player_id: row.player_id ?? null,
      type: row.type,
      minute: row.minute,
      created_at: new Date().toISOString(),
    };
    db.events.push(e);
    if (e.type === 'goal') {
      const m = db.matches.find((x) => x.id === e.match_id);
      if (m) patch(db.matches, m.id, e.team_id === m.home_team_id ? { home_score: m.home_score + 1 } : { away_score: m.away_score + 1 });
    }
    return e;
  }
  const { data, error } = await client().from('match_event').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  if (DEMO) {
    const e = db.events.find((x) => x.id === id);
    db.events = db.events.filter((x) => x.id !== id);
    if (e && e.type === 'goal') {
      const m = db.matches.find((x) => x.id === e.match_id);
      if (m)
        patch(
          db.matches,
          m.id,
          e.team_id === m.home_team_id
            ? { home_score: Math.max(0, m.home_score - 1) }
            : { away_score: Math.max(0, m.away_score - 1) }
        );
    }
    return;
  }
  const { error } = await client().from('match_event').delete().eq('id', id);
  if (error) throw error;
}

export async function updateMatch(id: string, p: TablesUpdate<'match'>): Promise<void> {
  if (DEMO) return patch(db.matches, id, p as Partial<Match>);
  const { error } = await client().from('match').update(p).eq('id', id);
  if (error) throw error;
}

// ── Sponzori ───────────────────────────────────────────────────────────────
export async function fetchSponsors(tournamentId: string): Promise<Sponsor[]> {
  if (DEMO) return db.sponsors.filter((s) => s.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('sponsor')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('tier', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSponsor(row: TablesInsert<'sponsor'>): Promise<Sponsor> {
  if (DEMO) {
    const s: Sponsor = {
      id: genId('s'),
      tournament_id: row.tournament_id,
      name: row.name,
      tier: row.tier,
      logo_url: row.logo_url ?? null,
      is_active: row.is_active ?? true,
      sort_order: row.sort_order ?? 0,
    };
    db.sponsors.push(s);
    return s;
  }
  const { data, error } = await client().from('sponsor').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateSponsor(id: string, p: TablesUpdate<'sponsor'>): Promise<void> {
  if (DEMO) return patch(db.sponsors, id, p as Partial<Sponsor>);
  const { error } = await client().from('sponsor').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteSponsor(id: string): Promise<void> {
  if (DEMO) {
    db.sponsors = db.sponsors.filter((s) => s.id !== id);
    return;
  }
  const { error } = await client().from('sponsor').delete().eq('id', id);
  if (error) throw error;
}

// ── Galerija ───────────────────────────────────────────────────────────────
// U `storage_path` držimo javni URL (isto kao logotipi sponzora) da ga mobilna
// app može prikazati izravno, bez sastavljanja putanje prema Storageu.

/** Dopušteni formati, težina i dimenzije fotografije. */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
/** Ispod ovoga je fotografija zamućena u mreži galerije; iznad je bespotrebno teška. */
export const PHOTO_MIN_PX = 600;
export const PHOTO_MAX_PX = 6000;

export class PhotoValidationError extends Error {
  constructor(public reason: 'type' | 'size' | 'tooSmall' | 'tooLarge') {
    super(reason);
  }
}

export async function fetchGalleryPhotos(tournamentId: string): Promise<GalleryPhoto[]> {
  if (DEMO)
    return db.gallery
      .filter((g) => g.tournament_id === tournamentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await client()
    .from('gallery_photo')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addGalleryPhoto(
  tournamentId: string,
  dayId: string | null,
  file: File
): Promise<GalleryPhoto> {
  if (!PHOTO_TYPES.includes(file.type)) throw new PhotoValidationError('type');

  // Prevelike fotografije smanjujemo umjesto da ih odbijemo — s telefona
  // redovito dolaze slike od 4000+ px i nema razloga tjerati korisnika da ih
  // sam priprema.
  file = await downscaleImage(file, PHOTO_MAX_PX);
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoValidationError('size');

  const dim = await readImageSize(file);
  if (dim) {
    const min = Math.min(dim.w, dim.h);
    const max = Math.max(dim.w, dim.h);
    if (min < PHOTO_MIN_PX) throw new PhotoValidationError('tooSmall');
    if (max > PHOTO_MAX_PX) throw new PhotoValidationError('tooLarge');
  }

  const url = await uploadPublicAsset(file, `gallery/${tournamentId}`);
  if (DEMO) {
    const g: GalleryPhoto = {
      id: genId('gp'),
      tournament_id: tournamentId,
      day_id: dayId,
      storage_path: url,
      created_at: new Date().toISOString(),
    };
    db.gallery.unshift(g);
    return g;
  }
  const { data, error } = await client()
    .from('gallery_photo')
    .insert({ tournament_id: tournamentId, day_id: dayId, storage_path: url })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGalleryPhoto(id: string): Promise<void> {
  if (DEMO) {
    db.gallery = db.gallery.filter((g) => g.id !== id);
    return;
  }
  // Zapis brišemo; datoteka ostaje u Storageu (jeftina je i ovako nema rizika
  // da obrišemo sliku koju netko drugi još koristi).
  const { error } = await client().from('gallery_photo').delete().eq('id', id);
  if (error) throw error;
}

// ── Obavijesti ─────────────────────────────────────────────────────────────
export async function fetchNotifications(tournamentId: string): Promise<NotificationLog[]> {
  if (DEMO)
    return db.notifications
      .filter((n) => n.tournament_id === tournamentId)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  const { data, error } = await client()
    .from('notification_log')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/** Ishod slanja — ne samo broj, nego i ono što je pošlo po zlu. */
export type PushResult = {
  /** Expo je poruku primio za toliko uređaja. */
  sent: number;
  /** Odbijeno trajno (npr. neispravan FCM ključ). Ponavljanje ne pomaže. */
  permanent: number;
  /** Uklonjeni mrtvi tokeni (odinstalirana aplikacija). */
  invalidated: number;
};

/** Sesija je istekla — poziv nema smisla ni pokušavati. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session_expired');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Pošalji push obavijest uređajima.
 *
 * Zapis u notification_log je zaseban korak — obavijest ostaje zabilježena i
 * kad slanje padne (npr. nema uređaja ili je Expo nedostupan).
 *
 * Vraća cijeli ishod, ne samo `sent`. Ranije se čitao samo broj poslanih, pa je
 * trajna greška (Expo vrati `sent: 0, permanent: 1` sa statusom 200) izgledala
 * kao mirna nula bez ijedne riječi objašnjenja.
 */
export async function sendPush(input: {
  audience: string;
  title: string;
  body?: string | null;
  type: string;
}): Promise<PushResult> {
  if (DEMO) return { sent: 0, permanent: 0, invalidated: 0 };

  // Kartica admina zna stajati otvorena satima. S istekloj sesijom poziv padne
  // još u pregledniku i do poslužitelja nikad ne dođe — zato se to provjerava
  // ovdje i kaže naglas, umjesto da izgleda kao da se ništa nije dogodilo.
  const { data: sess } = await client().auth.getSession();
  if (!sess.session) throw new SessionExpiredError();

  const { data, error } = await client().functions.invoke('send-push', {
    body: { audience: input.audience, title: input.title, body: input.body ?? undefined, type: input.type },
  });
  if (error) throw new Error(error.message);
  if (data && data.error) throw new Error(data.error);
  return {
    sent: Number(data?.sent ?? 0),
    permanent: Number(data?.permanent ?? 0),
    invalidated: Number(data?.invalidated ?? 0),
  };
}

/**
 * Zabilježi obavijest i pošalji je — ali NIKAD ne prekini posao koji je zvao.
 *
 * Zove se usred vođenja utakmice. Pad mreže, spora Edge funkcija ili greška
 * pusha ne smiju spriječiti da se gol upiše ili utakmica završi. Zato se ne
 * čeka rezultat i ne baca se iznimka — najgori ishod je obavijest koja nije
 * stigla, a ne rezultat koji nije zabilježen.
 */
export function notifyQuietly(row: TablesInsert<'notification_log'>): void {
  void (async () => {
    try {
      const created = await insertNotification(row);
      await sendPush({
        audience: row.audience ?? 'all',
        title: row.title,
        body: row.body ?? null,
        type: row.type,
      });
      // Oznaka se upisuje TEK nakon uspješnog slanja. Zapis bez nje znači
      // "zabilježeno, ali nije otišlo" — a to je stanje koje se mora vidjeti,
      // ne pretpostaviti. Web nema red čekanja, pa ovdje nema ponavljanja:
      // neposlana obavijest ostaje vidljiva u dnevniku.
      if (!DEMO) {
        await client()
          .from('notification_log')
          .update({ push_sent_at: new Date().toISOString() })
          .eq('id', created.id);
      }
    } catch (e) {
      console.warn('[obavijest]', e);
    }
  })();
}

export async function insertNotification(row: TablesInsert<'notification_log'>): Promise<NotificationLog> {
  if (DEMO) {
    const n: NotificationLog = {
      id: genId('n'),
      tournament_id: row.tournament_id,
      type: row.type,
      audience: row.audience,
      title: row.title,
      body: row.body ?? null,
      push_sent_at: null,
      sent_at: new Date().toISOString(),
    };
    db.notifications.unshift(n);
    return n;
  }
  const { data, error } = await client().from('notification_log').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

// ── Prijave ────────────────────────────────────────────────────────────────
export async function fetchRegistrations(tournamentId: string): Promise<Registration[]> {
  if (DEMO)
    return db.registrations
      .filter((r) => r.tournament_id === tournamentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data, error } = await client()
    .from('registration')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type PublicRegistrationInput = {
  team_name: string;
  gender: Gender;
  rep_name: string;
  rep_email: string;
  player_count: number | null;
  /** Nacrt sastava (može biti prazan — sastav se doda kasnije). */
  players: RegistrationPlayer[];
};

/**
 * Javna prijava bez logina. Upis ide kroz RPC koji na serveru provjerava
 * otvorenost prijava, rok, duplikate, sadržaj i osnovni rate-limit.
 */
export async function submitRegistration(input: PublicRegistrationInput): Promise<void> {
  const t = await fetchActiveTournament();
  if (!t) throw new RegistrationSubmissionError('unavailable');
  if (DEMO) {
    if (!t.registration_open || (t.registration_deadline && Date.now() > new Date(t.registration_deadline).getTime())) {
      throw new RegistrationSubmissionError('closed');
    }
    const duplicate = db.registrations.some(
      (r) =>
        r.tournament_id === t.id &&
        r.gender === input.gender &&
        r.team_name.trim().toLocaleLowerCase() === input.team_name.trim().toLocaleLowerCase() &&
        (r.status === 'pending' || r.status === 'approved')
    );
    if (duplicate) throw new RegistrationSubmissionError('duplicate');
    db.registrations.push({
      id: genId('r'),
      tournament_id: t.id,
      team_name: input.team_name,
      gender: input.gender,
      rep_name: input.rep_name,
      rep_email: input.rep_email,
      player_count: input.player_count,
      players: input.players,
      created_by: null,
      status: 'pending',
      approved_team_id: null,
      processed_at: null,
      processed_by: null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const { error } = await client().rpc('submit_registration', {
    p_tournament_id: t.id,
    p_team_name: input.team_name,
    p_gender: input.gender,
    p_rep_name: input.rep_name,
    p_rep_email: input.rep_email,
    p_player_count: input.player_count,
    p_players: input.players,
  });
  if (!error) return;

  const message = error.message.toLowerCase();
  if (message.includes('registration_closed')) throw new RegistrationSubmissionError('closed');
  if (message.includes('registration_duplicate')) throw new RegistrationSubmissionError('duplicate');
  if (message.includes('registration_rate_limited')) throw new RegistrationSubmissionError('rate_limited');
  if (message.includes('registration_invalid')) throw new RegistrationSubmissionError('invalid');
  if (message.includes('registration_unavailable')) throw new RegistrationSubmissionError('unavailable');
  throw error;
}

/** Atomski odobrava prijavu i vraća ID kreirane ili postojeće ekipe. */
export async function approveRegistration(id: string, shortCode: string): Promise<string> {
  if (DEMO) {
    const reg = db.registrations.find((r) => r.id === id);
    if (!reg) throw new Error('Prijava nije pronađena.');
    if (reg.status === 'rejected') throw new Error('Prijava je već odbijena.');
    if (reg.status === 'approved' && reg.approved_team_id) return reg.approved_team_id;

    let team = db.teams.find(
      (candidate) =>
        candidate.tournament_id === reg.tournament_id &&
        candidate.gender === reg.gender &&
        candidate.name.trim().toLocaleLowerCase() === reg.team_name.trim().toLocaleLowerCase()
    );
    if (!team) {
      team = await createTeam({
        tournament_id: reg.tournament_id,
        name: reg.team_name.trim(),
        gender: reg.gender,
        short_code: shortCode,
      });
    } else {
    }
    // Odobrena prijava je mjerodavna za kontakt predstavnika — i za novu i za
    // vec postojecu ekipu. Kontakt ide u zasebnu, nejavnu tablicu.
    await setTeamContact(team.id, reg.rep_email.trim().toLocaleLowerCase());

    const existingPlayers = db.players.filter((p) => p.team_id === team!.id);
    for (const player of reg.players ?? []) {
      const name = player.name.trim();
      if (!name) continue;
      // Igrača prepoznajemo po imenu, ne po kombinaciji imena i broja dresa:
      // broj se smije promijeniti između ručnog unosa i službene prijave.
      const existing = existingPlayers.find(
        (candidate) => candidate.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      if (existing) {
        if (player.number != null && existing.number !== player.number) {
          await updatePlayer(existing.id, { number: player.number });
          existing.number = player.number;
        }
      } else {
        const created = await createPlayer({
          team_id: team.id,
          name,
          number: player.number ?? null,
          sort_order: existingPlayers.length,
        });
        existingPlayers.push(created);
      }
    }

    patch(db.registrations, id, {
      status: 'approved',
      approved_team_id: team.id,
      processed_at: new Date().toISOString(),
    });
    return team.id;
  }

  const { data, error } = await client().rpc('approve_registration', {
    p_registration_id: id,
    p_short_code: shortCode,
  });
  if (error) throw error;
  return data;
}

export async function rejectRegistration(id: string): Promise<void> {
  if (DEMO) {
    const reg = db.registrations.find((r) => r.id === id);
    if (!reg) throw new Error('Prijava nije pronađena.');
    if (reg.status === 'approved') throw new Error('Odobrena prijava se ne može odbiti.');
    patch(db.registrations, id, { status: 'rejected', processed_at: new Date().toISOString() });
    return;
  }
  const { error } = await client().rpc('reject_registration', { p_registration_id: id });
  if (error) throw error;
}

// ── Korisnici (admin/delegate/rep) ───────────────────────────────────────────
export async function fetchAppUsers(): Promise<AppUser[]> {
  if (DEMO) return db.appUsers.map((u) => ({ ...u })) as AppUser[];
  const { data, error } = await client().from('app_user').select('*').order('email');
  if (error) throw error;
  return data ?? [];
}

export async function updateUserAccess(id: string, role: string, teamId: string | null): Promise<void> {
  if (DEMO) {
    patch(db.appUsers, id, { role, team_id: role === 'rep' ? teamId : null });
    return;
  }
  const { data, error } = await client().functions.invoke('admin-users', {
    body: { action: 'update_access', id, role, team_id: role === 'rep' ? teamId : null },
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error ?? 'Greška.');
}

export type CreateUserInput = { email: string; password: string; role: string; team_id?: string | null };

export async function adminCreateUser(input: CreateUserInput): Promise<void> {
  if (DEMO) {
    db.appUsers.push({ id: genId('u'), email: input.email, role: input.role, team_id: input.team_id ?? null });
    return;
  }
  const { data, error } = await client().functions.invoke('admin-users', {
    body: { action: 'create', ...input },
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error ?? 'Greška.');
}

export async function adminDeleteUser(id: string): Promise<void> {
  if (DEMO) {
    db.appUsers = db.appUsers.filter((u) => u.id !== id);
    return;
  }
  const { data, error } = await client().functions.invoke('admin-users', { body: { action: 'delete', id } });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error ?? 'Greška.');
}

// ── Upload (Storage) ─────────────────────────────────────────────────────────
export async function uploadPublicAsset(file: File, folder: string): Promise<string> {
  if (DEMO) return URL.createObjectURL(file); // lokalni pregled u sesiji
  const c = client();
  const ext = file.name.split('.').pop() || 'png';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await c.storage.from(ASSETS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return c.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── Prijava ekipe iz računa predstavnika ───────────────────────────────────
// Predstavnik sam otvara račun i prijavljuje svoju ekipu. Dok prijava čeka
// odobrenje, uređuje NACRT sastava (registration.players); nakon odobrenja
// isti ekran radi s pravim igračima.

export type MyRegistration = {
  id: string;
  team_name: string;
  gender: Gender;
  status: RegistrationStatus;
  players: RegistrationPlayer[];
  approved_team_id: string | null;
};

/** Prijava koju je poslao prijavljeni korisnik; null ako je još nema. */
export async function fetchMyRegistration(): Promise<MyRegistration | null> {
  if (DEMO) return null;
  const c = client();
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
  if (DEMO) return;
  const { error } = await client().rpc('submit_my_registration', {
    p_team_name: input.team_name,
    p_gender: input.gender,
    p_rep_name: input.rep_name,
  });
  if (!error) return;

  const message = error.message.toLowerCase();
  if (message.includes('registration_closed')) throw new RegistrationSubmissionError('closed');
  if (message.includes('registration_invalid')) throw new RegistrationSubmissionError('invalid');
  if (message.includes('registration_unavailable')) throw new RegistrationSubmissionError('unavailable');
  throw error;
}

/** Spremi nacrt sastava dok prijava još čeka odobrenje. */
export async function saveMyRegistrationPlayers(players: RegistrationPlayer[]): Promise<void> {
  if (DEMO) return;
  const { error } = await client().rpc('update_my_registration_players', {
    p_players: players,
  });
  if (error) throw error;
}

// ── Glasanje za najboljeg igrača turnira ───────────────────────────────────
// Golman i strijelac se računaju iz događaja (vidi @zrinjski/core awards.ts) i
// ne trebaju ništa od baze. Najbolji igrač se ne da izmjeriti brojkom, pa ga
// biraju predstavnici ekipa — jedan glas po računu, nikad za vlastitu ekipu.

export type MvpVoteError =
  | 'closed'        // admin još nije otvorio (ili je već zatvorio) glasanje
  | 'not_a_rep'     // račun nije predstavnik odobrene ekipe
  | 'own_team'      // pokušaj glasanja za vlastitog igrača
  | 'other_gender'  // igrač iz druge konkurencije
  | 'no_player';

export class MvpVoteFailed extends Error {
  constructor(public readonly code: MvpVoteError) {
    super(code);
    this.name = 'MvpVoteFailed';
  }
}

/** U DEMO grani nema prijave, pa svi glasovi idu na isti izmišljeni račun. */
const DEMO_VOTER = 'demo-rep';

/** Za koga je prijavljeni korisnik glasao; null ako još nije. */
export async function fetchMyMvpVote(): Promise<string | null> {
  if (DEMO) return db.mvpVotes.find((v) => v.voter_id === DEMO_VOTER)?.player_id ?? null;
  const c = client();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  // RLS ionako propušta samo vlastiti glas; filtar je tu radi jasnoće.
  const { data, error } = await c
    .from('mvp_vote')
    .select('player_id')
    .eq('voter_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data?.player_id ?? null;
}

/** Predaj ili promijeni glas. Provjere su u bazi — klijentu se ne vjeruje. */
export async function castMyMvpVote(playerId: string): Promise<void> {
  if (DEMO) {
    const player = db.players.find((p) => p.id === playerId);
    const gender = db.teams.find((t) => t.id === player?.team_id)?.gender ?? 'm';
    const existing = db.mvpVotes.find((v) => v.voter_id === DEMO_VOTER);
    if (existing) existing.player_id = playerId;
    else
      db.mvpVotes.push({
        id: genId('v'),
        tournament_id: db.tournament.id,
        gender,
        voter_id: DEMO_VOTER,
        voter_team_id: null,
        player_id: playerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    return;
  }
  const { error } = await client().rpc('cast_my_mvp_vote', { p_player_id: playerId });
  if (!error) return;

  const m = error.message.toLowerCase();
  if (m.includes('vote_closed')) throw new MvpVoteFailed('closed');
  if (m.includes('vote_not_a_rep')) throw new MvpVoteFailed('not_a_rep');
  if (m.includes('vote_own_team')) throw new MvpVoteFailed('own_team');
  if (m.includes('vote_other_competition')) throw new MvpVoteFailed('other_gender');
  if (m.includes('vote_no_player')) throw new MvpVoteFailed('no_player');
  throw error;
}

export type { MvpResult } from '@zrinjski/core';

/**
 * Brojevi glasova. Dok je glasanje otvoreno baza vraća prazno svima osim
 * adminu — namjerno, da se predstavnici ne povode za trenutnim vodećim.
 */
export async function fetchMvpResults(): Promise<MvpResult[]> {
  if (DEMO) {
    const counts = new Map<string, MvpResult>();
    for (const v of db.mvpVotes) {
      const row = counts.get(v.player_id) ?? { player_id: v.player_id, gender: v.gender, votes: 0 };
      row.votes += 1;
      counts.set(v.player_id, row);
    }
    return [...counts.values()].sort((a, b) => b.votes - a.votes);
  }
  const { data, error } = await client().rpc('mvp_results');
  if (error) throw error;
  return (data ?? []) as MvpResult[];
}

// ── Lokacije i program dana ────────────────────────────────────────────────
// Oboje postoji u bazi od prve migracije i mobilna app oboje prikazuje, ali
// admin dosad nije imao gdje to unijeti — jedini put bio je ručni SQL.

export async function fetchLocations(tournamentId: string): Promise<LocationRow[]> {
  if (DEMO) return db.locations.filter((l) => l.tournament_id === tournamentId);
  const { data, error } = await client()
    .from('location')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createLocation(row: TablesInsert<'location'>): Promise<LocationRow> {
  if (DEMO) {
    const l = { ...row, id: genId('l'), sort_order: row.sort_order ?? 0 } as LocationRow;
    db.locations.push(l);
    return l;
  }
  const { data, error } = await client().from('location').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, p: TablesUpdate<'location'>): Promise<void> {
  if (DEMO) {
    patch(db.locations, id, p as Partial<LocationRow>);
    return;
  }
  const { error } = await client().from('location').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteLocation(id: string): Promise<void> {
  if (DEMO) {
    db.locations = db.locations.filter((l) => l.id !== id);
    return;
  }
  const { error } = await client().from('location').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchProgram(tournamentId: string): Promise<ProgramItem[]> {
  if (DEMO) return db.program.filter((p) => p.tournament_id === tournamentId);
  const { data, error } = await client()
    .from('program_item')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('time', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProgramItem(row: TablesInsert<'program_item'>): Promise<ProgramItem> {
  if (DEMO) {
    const p = { ...row, id: genId('pr'), sort_order: row.sort_order ?? 0 } as ProgramItem;
    db.program.push(p);
    return p;
  }
  const { data, error } = await client().from('program_item').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateProgramItem(id: string, p: TablesUpdate<'program_item'>): Promise<void> {
  if (DEMO) {
    patch(db.program, id, p as Partial<ProgramItem>);
    return;
  }
  const { error } = await client().from('program_item').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteProgramItem(id: string): Promise<void> {
  if (DEMO) {
    db.program = db.program.filter((p) => p.id !== id);
    return;
  }
  const { error } = await client().from('program_item').delete().eq('id', id);
  if (error) throw error;
}

// ── Kontakti organizatora ──────────────────────────────────────────────────
// Javno vidljivi u Info tabu aplikacije. Gledatelj na terenu treba znati koga
// nazvati; do sada u aplikaciji nije bilo nijednog broja.

export async function fetchContacts(tournamentId: string): Promise<Contact[]> {
  if (DEMO) return db.contacts.filter((c) => c.tournament_id === tournamentId);
  const { data, error } = await client()
    .from('contact')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createContact(row: TablesInsert<'contact'>): Promise<Contact> {
  if (DEMO) {
    const c = {
      ...row,
      id: genId('c'),
      sort_order: row.sort_order ?? 0,
      created_at: new Date().toISOString(),
    } as Contact;
    db.contacts.push(c);
    return c;
  }
  const { data, error } = await client().from('contact').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateContact(id: string, p: TablesUpdate<'contact'>): Promise<void> {
  if (DEMO) {
    patch(db.contacts, id, p as Partial<Contact>);
    return;
  }
  const { error } = await client().from('contact').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  if (DEMO) {
    db.contacts = db.contacts.filter((c) => c.id !== id);
    return;
  }
  const { error } = await client().from('contact').delete().eq('id', id);
  if (error) throw error;
}

// ── Slika rezultata za društvene mreže ─────────────────────────────────────

/**
 * Logotipi sponzora kao data URI, spremni za ugradnju u sliku rezultata.
 *
 * Ugrađuju se, a ne povezuju: slika se dijeli dalje i otvara na tuđim
 * uređajima, gdje poveznica na Storage nije dohvatljiva, a i canvas bi je pri
 * pretvorbi u PNG "zatrovao" pa se slika ne bi dala izvesti.
 *
 * Rezultat se pamti u memoriji — logotipi se ne mijenjaju tijekom turnira, a
 * bez toga bi se skidali iznova za svaku utakmicu.
 */
const logoCache = new Map<string, string | null>();

export async function sponsorLogoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    logoCache.set(url, data);
    return data;
  } catch {
    // Sponzor bez dohvatljivog logotipa pada na ime — slika se svejedno radi.
    logoCache.set(url, null);
    return null;
  }
}

/** Aktivni sponzori s ugrađenim logotipima, u obliku koji traži shareCardSvg. */
export async function fetchShareSponsors(tournamentId: string): Promise<ShareSponsor[]> {
  const list = (await fetchSponsors(tournamentId)).filter((s) => s.is_active);
  return Promise.all(
    list.map(async (s) => ({
      name: s.name,
      tier: s.tier,
      logo: await sponsorLogoDataUri(s.logo_url),
    }))
  );
}
