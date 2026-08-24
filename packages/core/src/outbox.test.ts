import { describe, expect, it } from 'vitest';
import { Outbox, TRIES_BEFORE_ALARM, type PendingOp, type SendResult } from './outbox';

/** Lažni spremnik i pošiljatelj — testiramo logiku reda, ne mrežu. */
function makeOutbox(sendImpl: (op: PendingOp) => SendResult | Promise<SendResult>) {
  let stored: string | null = null;
  const sent: PendingOp[] = [];
  const box = new Outbox({
    load: async () => stored,
    save: async (raw) => {
      stored = raw;
    },
    send: async (op) => {
      const res = await sendImpl(op);
      if (res === 'ok') sent.push(op);
      return res;
    },
  });
  return { box, sent, dump: () => stored };
}

const goal = (id: string, minute = 1): PendingOp => ({
  kind: 'event.insert',
  id,
  match_id: 'm1',
  team_id: 't1',
  player_id: null,
  type: 'goal',
  minute,
  created_at: '2026-06-06T10:00:00Z',
});

describe('Outbox', () => {
  it('prazni red kad slanje prolazi', async () => {
    const { box, sent } = makeOutbox(() => 'ok');
    box.enqueue(goal('a'));
    box.enqueue(goal('b'));
    expect(box.size).toBe(2);

    const n = await box.flush();
    expect(n).toBe(2);
    expect(box.size).toBe(0);
    expect(sent.map((o) => (o.kind === 'event.insert' ? o.id : ''))).toEqual(['a', 'b']);
  });

  it('zadrži akcije kad slanje ne prolazi i staje na prvoj', async () => {
    const { box, sent } = makeOutbox(() => 'retry');
    box.enqueue(goal('a'));
    box.enqueue(goal('b'));

    expect(await box.flush()).toBe(0);
    expect(box.size).toBe(2); // ništa se ne gubi
    expect(sent).toHaveLength(0);
  });

  it('nastavi točno tamo gdje je stao kad se mreža vrati', async () => {
    let online = false;
    const { box, sent } = makeOutbox(() => (online ? 'ok' : 'retry'));
    box.enqueue(goal('a'));
    box.enqueue(goal('b'));

    await box.flush();
    expect(box.size).toBe(2);

    online = true;
    expect(await box.flush()).toBe(2);
    expect(box.size).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('čuva redoslijed: gol pa njegovo poništavanje', async () => {
    const order: string[] = [];
    const { box } = makeOutbox((op) => {
      order.push(op.kind);
      return 'ok';
    });
    box.enqueue(goal('a'));
    await box.flush(); // gol je otišao
    box.enqueue({ kind: 'event.delete', id: 'a' });
    await box.flush();

    expect(order).toEqual(['event.insert', 'event.delete']);
  });

  it('poništavanje neposlanog gola samo ga izbaci iz reda', async () => {
    const { box, sent } = makeOutbox(() => 'ok');
    box.enqueue(goal('a'));
    box.enqueue({ kind: 'event.delete', id: 'a' });

    expect(box.size).toBe(0); // ništa se ne šalje u bazu
    await box.flush();
    expect(sent).toHaveLength(0);
  });

  it('stapa uzastopne izmjene iste utakmice u jedan zapis', async () => {
    const { box, sent } = makeOutbox(() => 'ok');
    box.enqueue({ kind: 'match.update', id: 'm1', patch: { home_score: 1 } });
    box.enqueue({ kind: 'match.update', id: 'm1', patch: { home_score: 2 } });
    box.enqueue({ kind: 'match.update', id: 'm1', patch: { away_score: 1 } });

    expect(box.size).toBe(1);
    await box.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ patch: { home_score: 2, away_score: 1 } });
  });

  it('ne stapa izmjene različitih utakmica', async () => {
    const { box } = makeOutbox(() => 'ok');
    box.enqueue({ kind: 'match.update', id: 'm1', patch: { home_score: 1 } });
    box.enqueue({ kind: 'match.update', id: 'm2', patch: { home_score: 1 } });
    expect(box.size).toBe(2);
  });

  it('javi da nešto ne valja nakon ponovljenih neuspjeha', async () => {
    const { box } = makeOutbox(() => 'retry');
    box.enqueue(goal('a'));

    expect(box.status().failing).toBe(false);
    for (let i = 0; i < TRIES_BEFORE_ALARM; i++) await box.flush();
    expect(box.status().failing).toBe(true);
    expect(box.size).toBe(1); // i dalje ne gubimo podatak
  });

  it('preživi gašenje aplikacije', async () => {
    const { box, dump } = makeOutbox(() => 'retry');
    box.enqueue(goal('a'));
    await box.flush();

    // Novi red, isti spremnik — kao ponovno pokretanje app.
    const raw = dump();
    const box2 = new Outbox({
      load: async () => raw,
      save: async () => {},
      send: async () => 'ok',
    });
    await box2.load();
    expect(box2.size).toBe(1);
    expect(await box2.flush()).toBe(1);
  });

  it('obavještava pretplatnike o promjeni stanja', async () => {
    const seen: number[] = [];
    const { box } = makeOutbox(() => 'ok');
    box.subscribe((s) => seen.push(s.pending));

    box.enqueue(goal('a'));
    await box.flush();

    expect(seen[0]).toBe(0); // odmah pri pretplati
    expect(seen).toContain(1); // nakon dodavanja
    expect(seen[seen.length - 1]).toBe(0); // nakon pražnjenja
  });
});
