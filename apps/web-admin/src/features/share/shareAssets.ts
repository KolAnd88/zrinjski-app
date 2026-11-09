// shareAssets.ts — stalni dijelovi slike rezultata, složeni jednom u adminu.
//
// Slika rezultata se pravi na mobitelu. Ranije je u nju ugrađivala logotipe
// svih sponzora i grbove u punoj veličini (~2,9 MB), što je na Androidu rušilo
// aplikaciju. Sada admin unaprijed složi:
//   • traku sa svim sponzorima — jedna JPEG slika (tournament.share_sponsors_url);
//   • umanjene grbove ekipa — 192 px PNG (team.logo_small_url).
// Mobitel pri dijeljenju slaže samo grbove, rezultat i strijelce.
import { sponsorStripSvg, SHARE_STRIP_H, SHARE_STRIP_W, type Team } from '@zrinjski/core';
import { fetchAllTeams, fetchShareSponsors, saveShareSponsorStrip, saveTeamLogoSmall } from '../../lib/data';

/** Najveća stranica umanjenog grba. Na slici rezultata grb je 200 px. */
const CREST_PX = 192;
/** Traka se crta dvostruko da sitni logotipi ostanu oštri. */
const STRIP_SCALE = 2;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('slika'))), type, quality)
  );
}

/** SVG (s ugrađenim slikama) → JPEG preko canvasa. */
function svgToJpeg(svg: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvasBlob(canvas, 'image/jpeg', 0.88).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg'));
    };
    img.src = url;
  });
}

/**
 * Slika iz datoteke kroz <img>, ne createImageBitmap — ovaj u Chromeu ne
 * prima SVG, a grb ekipe smije biti i SVG.
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('grb se ne da učitati'));
    };
    img.src = url;
  });
}

/** Grb (datoteka ili poveznica) → PNG do 192 px, proziran rub ostaje. */
export async function smallCrestPng(source: Blob | string): Promise<Blob> {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  const img = await loadImage(blob);
  // SVG bez width/height daje 0 — tada se crta u punoj veličini grba.
  const iw = img.naturalWidth || CREST_PX;
  const ih = img.naturalHeight || CREST_PX;
  const k = Math.min(1, CREST_PX / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvasBlob(canvas, 'image/png');
}

/** Složi traku sponzora iz aktivnih sponzora i spremi je uz turnir. */
export async function refreshSponsorStrip(tournamentId: string): Promise<string | null> {
  const sponsors = await fetchShareSponsors(tournamentId);
  if (sponsors.length === 0) return saveShareSponsorStrip(tournamentId, null);
  const jpeg = await svgToJpeg(
    sponsorStripSvg(sponsors, STRIP_SCALE),
    SHARE_STRIP_W * STRIP_SCALE,
    SHARE_STRIP_H * STRIP_SCALE
  );
  return saveShareSponsorStrip(tournamentId, jpeg);
}

/**
 * Promjene sponzora stižu jedna za drugom (spremi, isključi, obriši…). Slaganje
 * ide u nizu, a novo se zakazuje tek kad prethodno završi — inače bi sporije
 * slaganje starijeg stanja moglo prebrisati novije.
 */
let chain: Promise<unknown> = Promise.resolve();
export function scheduleSponsorStrip(tournamentId: string): void {
  chain = chain
    .catch(() => undefined)
    .then(() => refreshSponsorStrip(tournamentId))
    .catch((e) => console.warn('[traka sponzora]', e));
}

/** Umanji grb jedne ekipe iz već spremljenog logotipa. */
export async function refreshTeamCrest(team: Pick<Team, 'id' | 'logo_url'>): Promise<string | null> {
  if (!team.logo_url) return null;
  return saveTeamLogoSmall(team.id, await smallCrestPng(team.logo_url));
}

export type ShareAssetsResult = { strip: boolean; crests: number; failed: string[] };

/** Sve odjednom: traka sponzora + umanjeni grbovi svih ekipa s logotipom. */
export async function refreshAllShareAssets(tournamentId: string): Promise<ShareAssetsResult> {
  const failed: string[] = [];
  let strip = false;
  try {
    strip = (await refreshSponsorStrip(tournamentId)) !== null;
  } catch (e) {
    failed.push(`sponzori: ${e instanceof Error ? e.message : String(e)}`);
  }
  let crests = 0;
  for (const team of (await fetchAllTeams(tournamentId)).filter((t) => t.logo_url)) {
    try {
      await refreshTeamCrest(team);
      crests += 1;
    } catch (e) {
      failed.push(`${team.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { strip, crests, failed };
}
