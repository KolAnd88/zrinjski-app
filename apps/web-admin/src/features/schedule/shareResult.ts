// shareResult.ts — slika rezultata iz podataka o utakmici, spremna za objavu.
//
// Sastavljanje (koja ekipa, koji strijelci, koji sponzori) živi ovdje; sam
// crtež je u @zrinjski/core (shareCardSvg) da ga mobilna app može dijeliti.
import type { Match, MatchEvent, Player, Team } from '@zrinjski/core';
import { shareCardSvg, type ShareScorer } from '@zrinjski/core';
import { fetchShareSponsors } from '../../lib/data';

const STAGE_LABEL: Record<string, string> = {
  group: 'Grupa',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
};

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

export type ShareInput = {
  match: Match;
  home: Pick<Team, 'name' | 'short_code' | 'sort_order'> | undefined;
  away: Pick<Team, 'name' | 'short_code' | 'sort_order'> | undefined;
  events: MatchEvent[];
  players: Player[];
  tournamentId: string;
  tournamentName: string;
  dateLabel: string;
  groupName?: string | null;
};

export async function buildShareCard(i: ShareInput): Promise<string> {
  const sponsors = await fetchShareSponsors(i.tournamentId);
  const stage =
    i.match.stage === 'group' ? i.groupName || STAGE_LABEL.group! : STAGE_LABEL[i.match.stage] ?? '';

  return shareCardSvg({
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
    stageLabel: stage,
    dateLabel: i.dateLabel,
    tournamentName: i.tournamentName,
    scorers: {
      home: scorersOf(i.events, i.players, i.match.home_team_id),
      away: scorersOf(i.events, i.players, i.match.away_team_id),
    },
    sponsors,
    isFinal: i.match.stage === 'final',
  });
}

/**
 * SVG → PNG preko canvasa, pa preuzimanje.
 *
 * Fontovi se u sliku NE ugrađuju — canvas crta onim što preglednik ima. Oswald
 * i Inter su učitani na stranici (Google Fonts u index.html), pa su dostupni.
 */
export function downloadCardPng(svg: string, filename: string, scale = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080 * scale;
      canvas.height = 1350 * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('png'));
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg'));
    };
    img.src = url;
  });
}
