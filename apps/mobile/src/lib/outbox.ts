// outbox.ts — spajanje reda čekanja (@zrinjski/core) na uređaj i bazu.
//
// Sama logika reda živi u core-u i pokrivena je testovima; ovdje je samo
// vezivanje: AsyncStorage za spremanje i Supabase za slanje.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Outbox, type OutboxStatus, type PendingOp, type SendResult } from '@zrinjski/core';
import { supabase } from './supabase';

const KEY = 'zrinjski.outbox.v1';
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

const outbox = new Outbox({
  load: () => AsyncStorage.getItem(KEY),
  save: (raw) => AsyncStorage.setItem(KEY, raw),
  send,
});

let timer: ReturnType<typeof setTimeout> | null = null;

/** Pokušaj poslati; ako nešto ostane, zakaži novi pokušaj. */
export async function flushOutbox(): Promise<void> {
  await outbox.flush();
  if (timer) clearTimeout(timer);
  if (outbox.size > 0) {
    timer = setTimeout(() => void flushOutbox(), RETRY_MS);
  }
}

export async function loadOutbox(): Promise<void> {
  await outbox.load();
  if (outbox.size > 0) void flushOutbox();
}

export function enqueue(op: PendingOp): void {
  outbox.enqueue(op);
  void flushOutbox();
}

export function subscribeOutbox(fn: (s: OutboxStatus) => void): () => void {
  return outbox.subscribe(fn);
}

export function outboxSize(): number {
  return outbox.size;
}
