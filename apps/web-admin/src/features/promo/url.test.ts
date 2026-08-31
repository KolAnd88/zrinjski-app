import { describe, expect, it } from 'vitest';
import { checkPromoUrl, looksLikeApk } from './url';

describe('checkPromoUrl', () => {
  it('prazno polje nije greška — kod se jednostavno ne radi', () => {
    expect(checkPromoUrl('')).toEqual({ key: 'empty' });
    expect(checkPromoUrl('   ')).toEqual({ key: 'empty' });
  });

  it('prihvaća obične adrese', () => {
    expect(checkPromoUrl('https://ponos.netlify.app')).toEqual({
      key: 'ok',
      url: 'https://ponos.netlify.app',
    });
    expect(checkPromoUrl('http://primjer.ba/app.apk').key).toBe('ok');
  });

  it('reže razmake oko zalijepljene adrese', () => {
    expect(checkPromoUrl('  https://ponos.netlify.app  ')).toEqual({
      key: 'ok',
      url: 'https://ponos.netlify.app',
    });
  });

  // Ovo je slučaj zbog kojeg provjera postoji: prije je od ovoga nastajao
  // uredan QR kod koji ne otvara ništa.
  it('odbija tekst koji nije adresa', () => {
    expect(checkPromoUrl('ovo-nije-adresa')).toEqual({ key: 'invalid' });
    expect(checkPromoUrl('www.primjer.ba')).toEqual({ key: 'invalid' });
  });

  it('traži http(s)', () => {
    expect(checkPromoUrl('ftp://primjer.ba')).toEqual({ key: 'notHttp' });
    expect(checkPromoUrl('javascript:alert(1)')).toEqual({ key: 'notHttp' });
  });

  it('traži naziv domene, ali dopušta localhost', () => {
    expect(checkPromoUrl('https://foo')).toEqual({ key: 'noHost' });
    expect(checkPromoUrl('http://localhost:5173').key).toBe('ok');
  });

  // Predugačka adresa je prije rušila izradu koda, a na ekranu je ostajao
  // PRETHODNI kod — plakat bi se preuzeo s krivim.
  it('odbija adresu koja ne stane u QR', () => {
    expect(checkPromoUrl(`https://primjer.ba/${'x'.repeat(2100)}`)).toEqual({ key: 'tooLong' });
  });
});

describe('looksLikeApk', () => {
  it('prepoznaje .apk', () => {
    expect(looksLikeApk('https://primjer.ba/app.apk')).toBe(true);
    expect(looksLikeApk('https://expo.dev/artifacts/eas/abc.apk')).toBe(true);
  });

  it('upozorava kad je upisana web adresa umjesto datoteke', () => {
    expect(looksLikeApk('https://ponos.netlify.app')).toBe(false);
  });

  it('ne dodaje svoje upozorenje na nevaljanu adresu', () => {
    expect(looksLikeApk('ovo-nije-adresa')).toBe(true);
  });
});
