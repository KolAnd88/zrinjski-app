// shareResult.ts — slika rezultata za dijeljenje na društvene mreže.
//
// Sastavljanje (koja ekipa, koji strijelci, koji sponzori) je ovdje; sam crtež
// je u @zrinjski/core (shareCardSvg), isti koji koristi i web admin.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Match, MatchEvent, Player, Sponsor, Team } from '@zrinjski/core';
import { shareCardSvg, type ShareCardOpts, type ShareScorer, type ShareSponsor } from '@zrinjski/core';

/**
 * Logotipi se UGRAĐUJU u sliku kao data URI, ne povezuju.
 *
 * Slika odlazi na tuđi uređaj i u tuđu objavu — poveznica na naš Storage ondje
 * ne bi bila dohvatljiva. Skinuti logotipi se pamte jer se tijekom turnira ne
 * mijenjaju, a inače bi se skidali iznova za svaku utakmicu.
 */
const logoCache = new Map<string, string | null>();

async function logoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  const hit = logoCache.get(url);
  if (hit !== undefined) return hit;

  try {
    const dir = new Directory(Paths.cache, 'sponzori');
    if (!dir.exists) dir.create({ intermediates: true });

    // Ime iz putanje; različiti sponzori tako ne pišu preko istog spremišta.
    const name = url.split('/').pop()?.split('?')[0] || `logo-${logoCache.size}`;
    const file = await File.downloadFileAsync(url, new File(dir, name), { idempotent: true });
    const type = name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : name.toLowerCase().endsWith('.svg')
        ? 'image/svg+xml'
        : 'image/png';
    const data = `data:${type};base64,${await file.base64()}`;
    logoCache.set(url, data);
    return data;
  } catch {
    // Sponzor bez dohvatljivog logotipa pada na ime — slika se svejedno radi.
    logoCache.set(url, null);
    return null;
  }
}

/** Golovi po igraču jedne ekipe, od najviše prema najmanje. */
function scorersOf(events: MatchEvent[], players: Player[], teamId: string | null): ShareScorer[] {
  if (!teamId) return [];
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'goal' || e.team_id !== teamId || !e.player_id) continue;
    counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, goals]) => ({ name: players.find((p) => p.id === id)?.name ?? '—', goals }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

export type BuildInput = {
  match: Match;
  home: Team | undefined;
  away: Team | undefined;
  events: MatchEvent[];
  players: Player[];
  sponsors: Sponsor[];
  tournamentName: string;
  stageLabel: string;
  dateLabel: string;
};

export async function buildShareCard(i: BuildInput): Promise<string> {
  const active = i.sponsors.filter((s) => s.is_active);
  const sponsors: ShareSponsor[] = await Promise.all(
    active.map(async (s) => ({ name: s.name, tier: s.tier, logo: await logoDataUri(s.logo_url) }))
  );

  const opts: ShareCardOpts = {
    home: {
      name: i.home?.name ?? i.match.home_placeholder ?? '—',
      code: i.home?.short_code ?? null,
      crestIndex: i.home?.sort_order ?? 0,
      score: i.match.home_score,
    },
    away: {
      name: i.away?.name ?? i.match.away_placeholder ?? '—',
      code: i.away?.short_code ?? null,
      crestIndex: i.away?.sort_order ?? 1,
      score: i.match.away_score,
    },
    stageLabel: i.stageLabel,
    dateLabel: i.dateLabel,
    tournamentName: i.tournamentName,
    scorers: {
      home: scorersOf(i.events, i.players, i.match.home_team_id),
      away: scorersOf(i.events, i.players, i.match.away_team_id),
    },
    sponsors,
    isFinal: i.match.stage === 'final',
  };

  return shareCardSvg(opts);
}

/**
 * Spremi PNG u privremenu mapu i otvori izbornik dijeljenja.
 *
 * Datoteka ide u cache, ne u dokumente: nakon dijeljenja je ne treba nitko, a
 * sustav je smije obrisati kad zatreba mjesta.
 */
/** Ispod ovoga PNG ove veličine ne može biti ispravan — 1080×1350 daje stotine kB. */
const MIN_PNG_BYTES = 20000;

export async function sharePng(base64: string, filename: string): Promise<string> {
  // toDataURL zna vratiti i puni data URI; zapisujemo samo sadržaj, inače
  // datoteka dobije "data:image/png;base64," na početku i nije valjani PNG.
  // Zarez je siguran biljeg: u base64 abecedi (A–Z a–z 0–9 + / =) ga nema.
  const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  if (!clean) throw new Error('prazna slika');

  const file = new File(Paths.cache, filename);
  try {
    if (file.exists) file.delete();
    file.create({ overwrite: true });
    file.write(clean, { encoding: 'base64' });
  } catch (e) {
    throw new Error(`zapis datoteke: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Provjera veličine razlučuje dva posve različita kvara koja izvana izgledaju
  // isto: neispravnu sliku (Android tada nudi samo preglednik datoteka, jer je
  // ne prepoznaje kao sliku) i ispravnu sliku koju odbija ciljna aplikacija.
  const bytes = file.info().size ?? 0;
  if (bytes < MIN_PNG_BYTES) {
    throw new Error(`slika je neispravna (${bytes} B, base64 ${clean.length} znakova)`);
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('dijeljenje nije dostupno na uređaju');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    dialogTitle: filename,
    UTI: 'public.png',
  });

  return `${Math.round(bytes / 1024)} kB`;
}
