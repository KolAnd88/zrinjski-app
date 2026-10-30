import { describe, expect, it } from 'vitest';
import { androidLinkKind, checkPromoUrl, PLAY_URL } from './url';

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

describe('androidLinkKind', () => {
  it('Google Play je ispravno odredište', () => {
    expect(androidLinkKind(PLAY_URL)).toBe('play');
    expect(androidLinkKind('https://play.google.com/store/apps/details?id=ba.vhmrkzrinjski.app&hl=hr')).toBe('play');
  });

  // APK s GitHuba Play nikad ne ažurira — zato zaseban slučaj, ne "u redu".
  it('prepoznaje APK', () => {
    expect(androidLinkKind('https://github.com/KolAnd88/zrinjski-app/releases/latest/download/app.apk')).toBe('apk');
    expect(androidLinkKind('https://expo.dev/artifacts/eas/abc.apk')).toBe('apk');
  });

  it('web adresa u polju za Android', () => {
    expect(androidLinkKind('https://ponos.netlify.app')).toBe('other');
    expect(androidLinkKind('https://play.google.com/')).toBe('other');
  });

  it('ne dodaje svoje upozorenje na praznu ili nevaljanu adresu', () => {
    expect(androidLinkKind('')).toBeNull();
    expect(androidLinkKind('ovo-nije-adresa')).toBeNull();
  });
});
