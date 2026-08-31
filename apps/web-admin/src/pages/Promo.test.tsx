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
const apkField = () => screen.getByPlaceholderText('https://…/app.apk');
const downloadBtn = () => screen.getByRole('button', { name: /preuzmi plakat/i });

beforeEach(() => localStorage.clear());

describe('Promo — provjera adrese', () => {
  it('bez adresa se plakat ne može preuzeti', () => {
    view();
    expect(downloadBtn()).toBeDisabled();
  });

  // Ovo je slučaj koji je prošao prije: tekst je davao uredan QR kod.
  it('tekst koji nije adresa javlja grešku i zaključava preuzimanje', async () => {
    view();
    await userEvent.type(iosField(), 'ovo-nije-adresa');
    expect(await screen.findByText(/nije web adresa/i)).toBeTruthy();
    expect(downloadBtn()).toBeDisabled();
  });

  it('ispravna adresa otključava preuzimanje', async () => {
    view();
    await userEvent.type(iosField(), 'https://ponos.netlify.app');
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
    expect(screen.queryByText(/nije web adresa/i)).toBeNull();
  });

  // Jedna kriva adresa kvari cijeli plakat, pa je i druga zaključana.
  it('kriva druga adresa zaključava plakat i kad je prva dobra', async () => {
    view();
    await userEvent.type(iosField(), 'https://ponos.netlify.app');
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
    await userEvent.type(apkField(), 'htp://krivo');
    await waitFor(() => expect(downloadBtn()).toBeDisabled());
  });

  it('upozorava kad Android adresa ne vodi na .apk, ali ne blokira', async () => {
    view();
    await userEvent.type(apkField(), 'https://ponos.netlify.app');
    expect(await screen.findByText(/ne završava na \.apk/i)).toBeTruthy();
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
  });

  it('adresa na .apk ne izaziva upozorenje', async () => {
    view();
    await userEvent.type(apkField(), 'https://primjer.ba/app.apk');
    await waitFor(() => expect(downloadBtn()).not.toBeDisabled());
    expect(screen.queryByText(/ne završava na \.apk/i)).toBeNull();
  });

  it('adrese se pamte u pregledniku', async () => {
    view();
    await userEvent.type(iosField(), 'https://ponos.netlify.app');
    await waitFor(() => expect(localStorage.getItem('promo.url.ios')).toBe('https://ponos.netlify.app'));
  });
});
