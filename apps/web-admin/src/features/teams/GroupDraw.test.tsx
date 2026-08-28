import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Grp, Team } from '@zrinjski/core';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { GroupDraw } from './GroupDraw';

const grp = (id: string, name: string, order: number): Grp => ({
  id,
  tournament_id: 't1',
  gender: 'm',
  name,
  sort_order: order,
});

const team = (id: string, name: string, group: string | null, order: number): Team => ({
  id,
  tournament_id: 't1',
  name,
  short_code: name.slice(0, 3).toUpperCase(),
  color: null,
  gender: 'm',
  group_id: group,
  coach_name: null,
  rep_email: null,
  logo_url: null,
  sort_order: order,
  created_at: '2026-01-01T00:00:00Z',
});

const GROUPS = [grp('ga', 'Grupa A', 0), grp('gb', 'Grupa B', 1)];
const TEAMS = [
  team('zri', 'Zrinjski', 'ga', 0),
  team('gru', 'Grude', 'ga', 1),
  team('pos', 'Posušje', 'gb', 2),
  team('cap', 'Čapljina', null, 3),
];

function setup(props: Partial<Parameters<typeof GroupDraw>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDirtyChange = vi.fn();
  render(
    <I18nProvider>
      <GroupDraw
        teams={TEAMS}
        groups={GROUPS}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
        {...props}
      />
    </I18nProvider>
  );
  const selects = () => screen.getAllByRole('combobox') as HTMLSelectElement[];
  const saveBtn = () => screen.getByRole('button', { name: /spremi ždrijeb/i });
  const cancelBtn = () => screen.getByRole('button', { name: /odustani/i });
  return { onSave, onDirtyChange, selects, saveBtn, cancelBtn };
}

describe('GroupDraw — ždrijeb', () => {
  it('bez grupa nema što raspoređivati, pa upućuje da se prvo dodaju', () => {
    render(
      <I18nProvider>
        <GroupDraw teams={TEAMS} groups={[]} onSave={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByText(/prvo dodaj barem jednu grupu/i)).toBeTruthy();
  });

  it('prikazuje sve ekipe i njihovu trenutnu grupu', () => {
    const { selects } = setup();
    expect(selects()).toHaveLength(TEAMS.length);
    expect(selects()[0]!.value).toBe('ga');
    // Neraspoređena ekipa ima praznu vrijednost, ne prvu grupu.
    expect(selects()[3]!.value).toBe('');
  });

  it('brojači po grupi prate nacrt, ne bazu', async () => {
    const user = userEvent.setup();
    const { selects } = setup();
    expect(screen.getByText(/Grupa A: 2 · Grupa B: 1/)).toBeTruthy();

    await user.selectOptions(selects()[3]!, 'gb');
    await waitFor(() => expect(screen.getByText(/Grupa A: 2 · Grupa B: 2/)).toBeTruthy());
  });

  it('gumbi miruju dok nema izmjena', () => {
    const { saveBtn, cancelBtn } = setup();
    expect(saveBtn()).toBeDisabled();
    expect(cancelBtn()).toBeDisabled();
  });

  // Cijela svrha obrasca: promjena ne smije dirati bazu prije gumba.
  it('promjena grupe ne sprema ništa dok se ne pritisne Spremi', async () => {
    const user = userEvent.setup();
    const { onSave, selects, saveBtn } = setup();

    await user.selectOptions(selects()[0]!, 'gb');
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(saveBtn()).not.toBeDisabled());

    await user.click(saveBtn());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([{ id: 'zri', group_id: 'gb' }]);
  });

  it('šalje samo stvarno promijenjene ekipe', async () => {
    const user = userEvent.setup();
    const { onSave, selects, saveBtn } = setup();

    await user.selectOptions(selects()[1]!, 'gb');
    await user.selectOptions(selects()[3]!, 'ga');
    await user.click(saveBtn());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toEqual([
      { id: 'gru', group_id: 'gb' },
      { id: 'cap', group_id: 'ga' },
    ]);
  });

  it('vraćanje na polaznu grupu poništava izmjenu', async () => {
    const user = userEvent.setup();
    const { selects, saveBtn } = setup();

    await user.selectOptions(selects()[0]!, 'gb');
    await waitFor(() => expect(saveBtn()).not.toBeDisabled());
    await user.selectOptions(selects()[0]!, 'ga');
    await waitFor(() => expect(saveBtn()).toBeDisabled());
  });

  it('Odustani vraća sve na staro', async () => {
    const user = userEvent.setup();
    const { onSave, selects, saveBtn, cancelBtn } = setup();

    await user.selectOptions(selects()[0]!, 'gb');
    await user.selectOptions(selects()[3]!, 'ga');
    await user.click(cancelBtn());

    await waitFor(() => expect(saveBtn()).toBeDisabled());
    expect(selects()[0]!.value).toBe('ga');
    expect(selects()[3]!.value).toBe('');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ekipa se smije izbaciti iz grupe', async () => {
    const user = userEvent.setup();
    const { onSave, selects, saveBtn } = setup();

    await user.selectOptions(selects()[0]!, '');
    await user.click(saveBtn());

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ id: 'zri', group_id: null }]));
  });

  // Stranica po ovome gasi gumb za generiranje utakmica — inače bi se
  // utakmice napravile po starom, još spremljenom rasporedu.
  it('javlja stranici kad ima nespremljenih izmjena', async () => {
    const user = userEvent.setup();
    const { onDirtyChange, selects, cancelBtn } = setup();

    onDirtyChange.mockClear();
    await user.selectOptions(selects()[0]!, 'gb');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    await user.click(cancelBtn());
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('pad spremanja zadržava izmjene i pokaže razlog', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('nema veze s bazom'));
    const { selects, saveBtn } = setup({ onSave });

    await user.selectOptions(selects()[0]!, 'gb');
    await user.click(saveBtn());

    await waitFor(() => expect(screen.getByText('nema veze s bazom')).toBeTruthy());
    // Rad se ne smije izgubiti — gumb ostaje aktivan za ponovni pokušaj.
    expect(saveBtn()).not.toBeDisabled();
    expect(selects()[0]!.value).toBe('gb');
  });
});
