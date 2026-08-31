// outbox.ts — spajanje reda čekanja (@zrinjski/core) na uređaj i bazu.
//
// Sama logika reda živi u core-u i pokrivena je testovima; ovdje je samo
// vezivanje: AsyncStorage za spremanje i Supabase za slanje.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Outbox, type OutboxStatus, type PendingOp, type SendResult } from '@zrinjski/core';
import { supabase } from './supabase';

const KEY = 'zrinjski.outbox.v1';
// Zaseban kljuc: obavijesti ne smiju zavrsiti u istom redu kao golovi.
const KEY_NOTIFY = 'zrinjski.outbox.notify.v1';
const RETRY_MS = 8000;

async function send(op: PendingOp): Promise<SendResult> {
  const sb = supabase;
  if (!sb) return 'retry';

  if (op.kind === 'event.insert') {
    const { error } = await sb.from('match_event').insert({
      id: op.id,
      match_id: op.match_id,
      team_id: op.team_id,
      player_id: op.player_id,
      type: op.type,
      minute: op.minute,
      created_at: op.created_at,
    });
    // 23505 = red već postoji: prošli pokušaj je stigao, odgovor se izgubio.
    if (error && (error as { code?: string }).code !== '23505') return 'retry';
    return 'ok';
  }

  if (op.kind === 'notify') {
    // Obavijest o rezultatu ne smije stići prije nego je rezultat u bazi —
    // gledatelj bi otvorio aplikaciju i vidio utakmicu koja još traje.
    if (op.match_id) {
      const { data: m } = await sb.from('match').select('status').eq('id', op.match_id).maybeSingle();
      if (!m || m.status !== 'finished') return 'retry';
    }

    // "Zabilježeno" i "poslano" su DVA stanja, i moraju se razlikovati.
    //
    // Ranije je postojanje zapisa samo po sebi značilo "već poslano". Ali ako
    // je prošli pokušaj zapisao red pa mu je SLANJE palo, sljedeći bi vidio
    // zapis i zaključio da je gotovo — obavijest se ne bi poslala nikad.
    // Zato o slanju govori `push_sent_at`, ne postojanje retka.
    const { error: logErr } = await sb.from('notification_log').insert({
      id: op.id,
      tournament_id: op.tournament_id,
      type: op.type,
      audience: op.audience,
      title: op.title,
      body: op.body,
    });
    // 23505 = zapis je već ondje iz prošlog pokušaja; to nije greška.
    if (logErr && (logErr as { code?: string }).code !== '23505') return 'retry';

    const { data: row } = await sb
      .from('notification_log')
      .select('push_sent_at')
      .eq('id', op.id)
      .maybeSingle();
    if (row?.push_sent_at) return 'ok'; // stvarno poslano — ne šalji drugi put

    const { error } = await sb.functions.invoke('send-push', {
      body: { audience: op.audience, title: op.title, body: op.body ?? undefined, type: op.type },
    });
    if (error) return 'retry';

    // Zabilježi da je poslano. Ako baš ovaj upis padne, sljedeći pokušaj bi
    // poslao još jednom — to je manja šteta od obavijesti koja nikad ne stigne.
    await sb
      .from('notification_log')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', op.id);
    return 'ok';
  }

  if (op.kind === 'event.delete') {
    const { error, data } = await sb.from('match_event').delete().eq('id', op.id).select('id');
    if (error) return 'retry';
    if (data && data.length > 0) return 'ok';

    // Nula obrisanih redova znači jedno od dvoga, a razlika je bitna:
    //  • red je već obrisan → posao je gotov;
    //  • RLS ga nije dao obrisati → posao NIJE gotov, a bez ove provjere bismo
    //    javili uspjeh, izbacili nalog iz reda i ostavili gol zauvijek u bazi
    //    dok uređaj misli da ga je poništio.
    // Čitanje `match_event` je javno, pa ovaj upit prolazi i kad brisanje ne.
    const { data: still } = await sb.from('match_event').select('id').eq('id', op.id).maybeSingle();
    return still ? 'retry' : 'ok';
  }

  const { error, data } = await sb
    .from('match')
    .update(op.patch as never)
    .eq('id', op.id)
    .select('id');
  // RLS blokada vraća "uspjeh" bez redova — to nije uspjeh.
  return !error && !!data && data.length > 0 ? 'ok' : 'retry';
}

/**
 * DVA reda, ne jedan.
 *
 * Red se prazni redom i staje na prvom neuspjehu — to je nužno za zapisnik,
 * jer gol mora biti upisan prije nego ga poništavanje briše. Ali dok su
 * obavijesti bile u istom redu, jedna neuspjela obavijest zaustavila bi SVE
 * golove iza sebe: zapisnik bi radio, a u bazu ne bi stizalo ništa.
 *
 * Zapisnik ima prednost i mora teći sam za sebe. Obavijest smije čekati.
 */
const outbox = new Outbox({
  load: () => AsyncStorage.getItem(KEY),
  save: (raw) => AsyncStorage.setItem(KEY, raw),
  send,
});

const notifyBox = new Outbox({
  load: () => AsyncStorage.getItem(KEY_NOTIFY),
  save: (raw) => AsyncStorage.setItem(KEY_NOTIFY, raw),
  send,
});

let timer: ReturnType<typeof setTimeout> | null = null;

/** Pokušaj poslati oba reda; ako nešto ostane, zakaži novi pokušaj. */
export async function flushOutbox(): Promise<void> {
  // Neovisno: pad jednog ne smije zaustaviti drugi.
  await Promise.allSettled([outbox.flush(), notifyBox.flush()]);
  if (timer) clearTimeout(timer);
  if (outbox.size > 0 || notifyBox.size > 0) {
    timer = setTimeout(() => void flushOutbox(), RETRY_MS);
  }
}

export async function loadOutbox(): Promise<void> {
  await Promise.allSettled([outbox.load(), notifyBox.load()]);
  if (outbox.size > 0 || notifyBox.size > 0) void flushOutbox();
}

export function enqueue(op: PendingOp): void {
  (op.kind === 'notify' ? notifyBox : outbox).enqueue(op);
  void flushOutbox();
}

/** Broj neposlanih iz OBA reda — pokazatelj u sučelju prati ukupno stanje. */
export function subscribeOutbox(fn: (s: OutboxStatus) => void): () => void {
  const off1 = outbox.subscribe(fn);
  const off2 = notifyBox.subscribe(fn);
  return () => {
    off1();
    off2();
  };
}

export function outboxSize(): number {
  return outbox.size + notifyBox.size;
}
