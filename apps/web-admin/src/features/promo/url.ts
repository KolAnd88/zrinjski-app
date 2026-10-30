// url.ts — provjera adrese prije nego od nje nastane QR kod.
//
// Plakat je jedina stvar u projektu koja se ISPISUJE. Kad se jednom zalijepi
// po dvorani, kriva adresa se ne može povući — a kriv QR izgleda potpuno
// jednako kao ispravan. Zato se ovdje adresa odbija prije nego uđe u kod,
// umjesto da se pogreška otkrije tek kad je netko skenira.

/** Duže od ovoga ne stane u QR (verzija 40, razina M ≈ 2331 znakova). */
const MAX = 2000;

export type PromoUrlState =
  | { key: 'empty' }
  /** Ispravna adresa; `url` je očišćen od suvišnih razmaka. */
  | { key: 'ok'; url: string }
  /** Ne može se pročitati kao adresa ("ovo-nije-adresa"). */
  | { key: 'invalid' }
  /** Protokol nije http(s) — npr. `ftp:` ili zalijepljeni `javascript:`. */
  | { key: 'notHttp' }
  /** Nema naziva domene ("https://foo"). */
  | { key: 'noHost' }
  | { key: 'tooLong' };

/**
 * Pročitaj adresu koju je organizator upisao.
 *
 * Namjerno je stroža nego što `new URL` traži: `https://foo` je za preglednik
 * valjana adresa, ali na plakatu je to sigurno pogreška u tipkanju.
 */
export function checkPromoUrl(raw: string): PromoUrlState {
  const s = raw.trim();
  if (!s) return { key: 'empty' };
  if (s.length > MAX) return { key: 'tooLong' };

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { key: 'invalid' };
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { key: 'notHttp' };
  // Prava domena ima točku; `localhost` je iznimka jer se na njemu isprobava.
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { key: 'noHost' };

  return { key: 'ok', url: s };
}

/** Aplikacija na Google Playu — kamo vodi Android kod na plakatu. */
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=ba.vhmrkzrinjski.app';

/** Web verzija za iPhone. */
export const WEB_URL = 'https://ponoshercegovine.com';

/**
 * Kamo vodi Android poveznica.
 *
 * Aplikacija je na Google Playu, pa plakat mora voditi onamo. APK s GitHuba
 * se i dalje može upisati, ali je zamka: Play aplikaciju potpisuje svojim
 * ključem, pa telefon APK smatra drugom aplikacijom i Play je NIKAD ne
 * ažurira — čovjek ostaje na staroj verziji do kraja turnira.
 *
 * Ništa od ovoga ne blokira preuzimanje — samo upozorava. Null za praznu
 * ili nevaljanu adresu (ona ima svoju poruku).
 */
export function androidLinkKind(raw: string): 'play' | 'apk' | 'other' | null {
  const st = checkPromoUrl(raw);
  if (st.key !== 'ok') return null;
  try {
    const u = new URL(st.url);
    if (u.hostname === 'play.google.com' && u.pathname.startsWith('/store/apps/details')) return 'play';
    if (u.pathname.toLowerCase().endsWith('.apk')) return 'apk';
    return 'other';
  } catch {
    return null;
  }
}
