import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDraft } from './useDraft';

type Row = { name: string; gap: number; rules: string | null };

const base: Row = { name: 'Turnir', gap: 5, rules: null };

describe('useDraft — spremanje tek na gumb', () => {
  it('na početku nema izmjena i nema što spremiti', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft(base, save));
    expect(result.current.dirty).toBe(false);
    expect(result.current.value).toEqual(base);
  });

  it('izmjena ne dira bazu dok se ne pritisne Spremi', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft(base, save));

    act(() => result.current.set('name', 'Ponos Hercegovine 2026'));
    expect(result.current.dirty).toBe(true);
    expect(result.current.value.name).toBe('Ponos Hercegovine 2026');
    // Ovo je cijela poanta obrasca: dosad se spremalo na onBlur.
    expect(save).not.toHaveBeenCalled();

    await act(async () => void (await result.current.save()));
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(false);
    expect(result.current.saved).toBe(true);
  });

  // Slanje cijelog obrasca pregazilo bi polje koje je u međuvremenu promijenio
  // netko drugi, a mi ga nismo ni dirali.
  it('šalje SAMO promijenjena polja', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft(base, save));

    act(() => result.current.set('gap', 7));
    await act(async () => void (await result.current.save()));

    expect(save).toHaveBeenCalledWith({ gap: 7 });
  });

  it('Odustani vraća na zadnje stanje iz baze', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft(base, save));

    act(() => result.current.set('name', 'Krivo ime'));
    act(() => result.current.reset());

    expect(result.current.value).toEqual(base);
    expect(result.current.dirty).toBe(false);
  });

  it('vraćanje na polaznu vrijednost više nije izmjena', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft(base, save));

    act(() => result.current.set('gap', 9));
    act(() => result.current.set('gap', 5));
    await act(async () => void (await result.current.save()));

    // Nema stvarne razlike → nema poziva prema bazi.
    expect(save).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
  });

  it('greška pri spremanju zadržava izmjene i javlja razlog', async () => {
    const save = vi.fn().mockRejectedValue(new Error('nema veze s bazom'));
    const { result } = renderHook(() => useDraft(base, save));

    act(() => result.current.set('name', 'Novo'));
    await act(async () => void (await result.current.save()));

    expect(result.current.error).toBe('nema veze s bazom');
    // Rad se NE smije izgubiti samo zato što je upis pao.
    expect(result.current.dirty).toBe(true);
    expect(result.current.value.name).toBe('Novo');
  });

  it('svježi podaci izvana osvježe obrazac dok korisnik ništa ne dira', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ src }) => useDraft(src, save), {
      initialProps: { src: base },
    });

    rerender({ src: { ...base, name: 'Promijenjeno drugdje' } });
    await waitFor(() => expect(result.current.value.name).toBe('Promijenjeno drugdje'));
  });

  // Bez ovoga bi realtime osvježenje obrisalo tekst koji korisnik upravo piše.
  it('svježi podaci izvana NE gaze nespremljeni rad', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ src }) => useDraft(src, save), {
      initialProps: { src: base },
    });

    act(() => result.current.set('name', 'Moj nespremljeni unos'));
    rerender({ src: { ...base, name: 'Promijenjeno drugdje' } });

    await waitFor(() => expect(result.current.value.name).toBe('Moj nespremljeni unos'));
    expect(result.current.dirty).toBe(true);
  });

  it('prazan tekst se smije spremiti kao brisanje sadržaja', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraft({ ...base, rules: 'Stara pravila' }, save));

    act(() => result.current.set('rules', ''));
    await act(async () => void (await result.current.save()));

    expect(save).toHaveBeenCalledWith({ rules: '' });
  });
});
