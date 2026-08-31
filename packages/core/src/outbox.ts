import type { NotificationType } from './types/database';
// outbox.ts — red čekanja za unos bez mreže (čista logika, bez React Native-a).
//
// Zapisnik u dvorani bez signala ne smije stati: akcija se odmah primijeni
// lokalno i upiše ovdje, a red se prazni čim upis prolazi. Spremanje i slanje
// se ubrizgavaju izvana (AsyncStorage + Supabase u aplikaciji, lažnjaci u
// testovima) — zato je ovo ovdje, a ne u apps/mobile.

export type EventKind = 'goal' | 'save' | 'red_card' | 'suspension_2min';

export type PendingOp =
  | {
      kind: 'event.insert';
      /** ID s uređaja — ponovljeno slanje ne može napraviti duplikat. */
      id: string;
      match_id: string;
      team_id: string;
      player_id: string | null;
      type: EventKind;
      minute: number;
      created_at: string;
    }
  | { kind: 'event.delete'; id: string }
  | { kind: 'match.update'; id: string; patch: Record<string, unknown> }
  /**
   * Obavijest gledateljima. Ide kroz red cekanja kao i sve ostalo: delegat
   * cesto radi bez mreze, a bez reda bi obavijest o zavrsetku utakmice tiho
   * propala. Red uz to donosi ponovni pokusaj, koji izravno slanje nema.
   */
  | {
      kind: 'notify';
      /** ID s uredaja — ponovljeno slanje ne smije poslati dvije obavijesti. */
      id: string;
      tournament_id: string;
      type: NotificationType;
      audience: string;
      title: string;
      body: string | null;
    };

export type OutboxEntry = { op: PendingOp; tries: number };

export type OutboxStatus = {
  pending: number;
  /** Nešto uporno ne prolazi — vrijeme je da korisnik sazna. */
  failing: boolean;
};

export type SendResult = 'ok' | 'retry';

export type OutboxDeps = {
  load: () => Promise<string | null>;
  save: (raw: string) => Promise<void>;
  /** 'ok' = gotovo (uključujući "već postoji"); 'retry' = pokušaj opet. */
  send: (op: PendingOp) => Promise<SendResult>;
};

/** Nakon toliko neuspjelih pokušaja status prelazi u "failing". */
export const TRIES_BEFORE_ALARM = 4;

export class Outbox {
  private queue: OutboxEntry[] = [];
  private flushing = false;
  private listeners = new Set<(s: OutboxStatus) => void>();

  constructor(private deps: OutboxDeps) {}

  get size(): number {
    return this.queue.length;
  }

  status(): OutboxStatus {
    return {
      pending: this.queue.length,
      failing: this.queue.some((e) => e.tries >= TRIES_BEFORE_ALARM),
    };
  }

  subscribe(fn: (s: OutboxStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    const s = this.status();
    this.listeners.forEach((fn) => fn(s));
  }

  private async persist() {
    try {
      await this.deps.save(JSON.stringify(this.queue));
    } catch {
      // Red i dalje živi u memoriji; gubi se tek gašenjem aplikacije.
    }
  }

  /** Učitaj red spremljen prije gašenja aplikacije. */
  async load(): Promise<void> {
    try {
      const raw = await this.deps.load();
      if (raw) this.queue = JSON.parse(raw) as OutboxEntry[];
    } catch {
      this.queue = [];
    }
    this.notify();
  }

  /**
   * Dodaj akciju.
   *  • uzastopne izmjene iste utakmice se stapaju — inače bi tipkanje po +/-
   *    napravilo desetak zapisa umjesto jednog konačnog stanja
   *  • poništavanje događaja koji još nije poslan samo ga izbaci iz reda
   */
  enqueue(op: PendingOp): void {
    if (op.kind === 'match.update') {
      const existing = [...this.queue]
        .reverse()
        .find((e) => e.op.kind === 'match.update' && e.op.id === op.id);
      if (existing && existing.op.kind === 'match.update') {
        existing.op.patch = { ...existing.op.patch, ...op.patch };
        existing.tries = 0;
        void this.persist();
        this.notify();
        return;
      }
    }

    if (op.kind === 'event.delete') {
      const i = this.queue.findIndex((e) => e.op.kind === 'event.insert' && e.op.id === op.id);
      if (i >= 0) {
        this.queue.splice(i, 1);
        void this.persist();
        this.notify();
        return;
      }
    }

    this.queue.push({ op, tries: 0 });
    void this.persist();
    this.notify();
  }

  /**
   * Pošalji akcije redom. Staje na prvoj koja ne prođe — redoslijed je bitan
   * (gol pa njegovo poništavanje ne smiju zamijeniti mjesta).
   * Vraća broj uspješno poslanih.
   */
  async flush(): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    let sent = 0;
    try {
      while (this.queue.length > 0) {
        const entry = this.queue[0]!;
        let res: SendResult;
        try {
          res = await this.deps.send(entry.op);
        } catch {
          res = 'retry';
        }
        if (res === 'retry') {
          entry.tries += 1;
          await this.persist();
          this.notify();
          return sent;
        }
        this.queue.shift();
        sent += 1;
        await this.persist();
        this.notify();
      }
    } finally {
      this.flushing = false;
    }
    return sent;
  }
}
