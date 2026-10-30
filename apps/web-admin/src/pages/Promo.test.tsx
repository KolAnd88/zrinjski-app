// Plakat je jedina stvar u projektu koja se ISPISUJE, pa se kriva adresa
// ne može povući. Ovi testovi drže na okupu ono što se ne vidi golim okom:
// kriv QR izgleda potpuno jednako kao ispravan.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';

vi.mock('../features/tournament/useTournamentData', () => ({
  useTournamentData: () => ({
    loading: false,
    configured: true,
    error: null,
    tournament: { id: 't1', name: 'Ponos Hercegovine 2026' },
    days: [],
    reload: vi.fn(),
  }),
}));

vi.mock('../features/promo/usePromo', () => ({
  usePromo: () => ({
    loading: false,
    configured: true,
    matches: [],
    teamsById: new Map(),
    goldSponsor: null,
  }),
}));

const { Promo } = await import('./Promo');

const view = () =>
  render(
    <I18nProvider>
      <Promo />
    </I18nProvider>
  );

const iosField = () => screen.getByPlaceholderText('https://…netlify.app');
const apkField = () => screen.getByPlaceholderText('https://play.google.com/store/apps/details?id=…');
const downloadBtn = () => screen.getByRole('button', { name: /preuzmi plakat/i });

beforeEach(() => localStorage.clear());

describe('Promo — provjera adrese', () => {
  // Prvi put su već upisane prave adrese: web za iPhone, Google Play za Android.
  it('zadane adrese su web verzija i Google Play, plakat se može preuzeti', async () => {
    view();
    expect((iosField() as HTMLInputElement).value).toBe('https://ponoshercegovine.com');
    expect((apkField() as HTMLInputElement).value).toContain('play.google.com/store/apps/details');
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
  });

  it('bez adresa se plakat ne može preuzeti', async () => {
    view();
    await userEvent.clear(iosField());
    await userEvent.clear(apkField());
    await waitFor(() => expect(downloadBtn()).toBeDisabled());
  });

  // Ovo je slučaj koji je prošao prije: tekst je davao uredan QR kod.
  it('tekst koji nije adresa javlja grešku i zaključava preuzimanje', async () => {
    view();
    await userEvent.clear(iosField());
    await userEvent.type(iosField(), 'ovo-nije-adresa');
    expect(await screen.findByText(/nije web adresa/i)).toBeTruthy();
    expect(downloadBtn()).toBeDisabled();
  });

  // Jedna kriva adresa kvari cijeli plakat, pa je i druga zaključana.
  it('kriva druga adresa zaključava plakat i kad je prva dobra', async () => {
    view();
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
    await userEvent.clear(apkField());
    await userEvent.type(apkField(), 'htp://krivo');
    await waitFor(() => expect(downloadBtn()).toBeDisabled());
  });

  // APK s GitHuba Play nikad ne ažurira — plakat s njim ostavio bi ljude na
  // staroj verziji. Upozorava, nudi ispravak, ali ne blokira.
  it('APK poveznica dobiva upozorenje i gumb za Play', async () => {
    view();
    await userEvent.clear(apkField());
    await userEvent.type(apkField(), 'https://primjer.ba/app.apk');
    expect(await screen.findByText(/skida APK/i)).toBeTruthy();
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /upiši play poveznicu/i }));
    expect((apkField() as HTMLInputElement).value).toContain('play.google.com');
    expect(screen.queryByText(/skida APK/i)).toBeNull();
  });

  it('web adresa u polju za Android upozorava da ne vodi na Play', async () => {
    view();
    await userEvent.clear(apkField());
    await userEvent.type(apkField(), 'https://ponos.netlify.app');
    expect(await screen.findByText(/ne vodi na Google Play/i)).toBeTruthy();
  });

  it('Play poveznica nema upozorenja', () => {
    view();
    expect(screen.queryByText(/skida APK/i)).toBeNull();
    expect(screen.queryByText(/ne vodi na Google Play/i)).toBeNull();
  });

  it('adrese se pamte u pregledniku', async () => {
    view();
    await userEvent.clear(iosField());
    await userEvent.type(iosField(), 'https://ponos.netlify.app');
    await waitFor(() => expect(localStorage.getItem('promo.url.ios')).toBe('https://ponos.netlify.app'));
  });
});
