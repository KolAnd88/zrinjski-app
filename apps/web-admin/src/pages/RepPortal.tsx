import { useCallback, useEffect, useState } from 'react';
import type { Player, RegistrationPlayer, Team } from '@zrinjski/core';
import { useAuth } from '../auth/AuthProvider';
import { useT } from '../i18n/I18nProvider';
import { Button, Card, Crest } from '../components/ui';
import {
  createPlayer,
  deletePlayer,
  fetchMyRegistration,
  fetchTeamWithPlayers,
  saveMyRegistrationPlayers,
  type MyRegistration,
  updatePlayer,
} from '../lib/data';
import { MyTeamSetup } from './MyTeamSetup';
import './RepPortal.css';

/**
 * Portal predstavnika ekipe (uloga 'rep').
 * Vidi i uređuje SAMO sastav svoje ekipe — RLS na bazi to i tehnički jamči
 * (player_rep_write / is_rep_of_team). Naziv, grupu i logo mijenja organizator.
 */
function ApprovedTeamPortal() {
  const { t } = useT();
  const { teamId, signOut } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchTeamWithPlayers(teamId);
      setTeam(res?.team ?? null);
      setPlayers(res?.players ?? []);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  function ok() {
    setErr(null);
    setFlash(t('rep.saved'));
    setTimeout(() => setFlash(null), 1500);
  }
  function fail() {
    setErr(t('rep.saveError'));
  }

  async function addPlayer() {
    if (!teamId || !newName.trim()) return;
    try {
      const p = await createPlayer({
        team_id: teamId,
        name: newName.trim(),
        number: newNum.trim() ? Number(newNum) : null,
        sort_order: players.length,
      });
      setPlayers((xs) => [...xs, p]);
      setNewNum('');
      setNewName('');
      ok();
    } catch {
      fail();
    }
  }

  async function patchPlayer(id: string, patch: Partial<Player>) {
    try {
      await updatePlayer(id, patch);
      setPlayers((xs) => xs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      ok();
    } catch {
      fail();
    }
  }

  async function removePlayer(id: string) {
    if (!confirm(t('rep.deletePlayerConfirm'))) return;
    try {
      await deletePlayer(id);
      setPlayers((xs) => xs.filter((p) => p.id !== id));
      ok();
    } catch {
      fail();
    }
  }

  if (loading) return <div className="rep"><Card>{t('common.loading')}</Card></div>;

  if (!teamId || !team) {
    return (
      <div className="rep">
        <Card accent>
          <p style={{ margin: 0 }}>{t('rep.noTeam')}</p>
          <Button style={{ marginTop: 'var(--sp-md)' }} onClick={() => void signOut()}>
            {t('rep.logout')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="rep">
      <header className="rep__head">
        <Crest code={team.short_code} index={team.sort_order} logoUrl={team.logo_url} size={56} />
        <div className="rep__headmain">
          <div className="rep__label">{t('rep.subtitle')}</div>
          <h1 className="rep__title">{team.name}</h1>
        </div>
        <button className="btn-link" onClick={() => void signOut()}>
          {t('rep.logout')}
        </button>
      </header>

      {flash && <div className="banner banner--ok">{flash}</div>}
      {err && <div className="banner banner--error">{err}</div>}

      <Card>
        <div className="rep__rosterhead">
          <h2 className="section-label" style={{ margin: 0 }}>
            {t('rep.rosterTitle')}
          </h2>
          <span className="rep__count">
            {players.length} {t('rep.playersCount')}
          </span>
        </div>
        <p className="rep__hint">{t('rep.rosterHint')}</p>

        <div className="rep__list">
          {players.map((p) => (
            <div key={p.id} className="rep__row">
              <input
                className="input rep__num"
                defaultValue={p.number?.toString() ?? ''}
                inputMode="numeric"
                placeholder={t('rep.playerNumber')}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const n = v ? Number(v) : null;
                  if (n !== p.number) void patchPlayer(p.id, { number: Number.isFinite(n as number) ? n : null });
                }}
              />
              <input
                className="input"
                defaultValue={p.name}
                placeholder={t('rep.playerName')}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== p.name) void patchPlayer(p.id, { name: v });
                }}
              />
              <button
                className={`rep__cap ${p.is_captain ? 'is-on' : ''}`}
                title={t('rep.captain')}
                onClick={() => void patchPlayer(p.id, { is_captain: !p.is_captain })}
              >
                C
              </button>
              <button className="rep__del" aria-label="×" onClick={() => void removePlayer(p.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="rep__row rep__row--add">
          <input
            className="input rep__num"
            value={newNum}
            inputMode="numeric"
            placeholder={t('rep.playerNumber')}
            onChange={(e) => setNewNum(e.target.value)}
          />
          <input
            className="input"
            value={newName}
            placeholder={t('rep.playerName')}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addPlayer()}
          />
          <Button variant="primary" disabled={!newName.trim()} onClick={() => void addPlayer()}>
            {t('rep.addPlayer')}
          </Button>
        </div>

        <p className="rep__hint" style={{ marginTop: 'var(--sp-lg)' }}>
          {t('rep.contactAdmin')}
        </p>
      </Card>
    </div>
  );
}

/**
 * Nacrt sastava dok prijava čeka odobrenje. Igrači se drže u
 * `registration.players` i pri odobrenju se prepišu u prave igrače, pa
 * predstavnik ne mora čekati organizatora da bi popunio ekipu.
 */
function PendingRoster({ reg, onReload }: { reg: MyRegistration; onReload: () => void }) {
  const { t } = useT();
  const { signOut } = useAuth();
  const [rows, setRows] = useState<RegistrationPlayer[]>(reg.players ?? []);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filled = rows.filter((r) => r.name.trim()).length;

  async function save(next: RegistrationPlayer[]) {
    setRows(next);
    setBusy(true);
    setErr(null);
    try {
      await saveMyRegistrationPlayers(next.filter((r) => r.name.trim()));
      setFlash(t('rep.saved'));
      setTimeout(() => setFlash(null), 1500);
    } catch {
      setErr(t('rep.saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rep">
      <div className="rep__head">
        <div style={{ flex: 1 }}>
          <div className="rep__role">{t('rep.subtitle')}</div>
          <h1 className="rep__team">{reg.team_name}</h1>
        </div>
        <button className="btn-link" onClick={() => void signOut()}>
          {t('nav.logout')}
        </button>
      </div>

      <div className="banner" style={{ marginBottom: 'var(--sp-md)' }}>
        {t('pending.waiting')}
      </div>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-xs)' }}>
          {t('rep.rosterTitle')}
        </h2>
        <p className="rep__hint" style={{ marginTop: 0 }}>
          {t('pending.rosterHint', { n: filled })}
        </p>

        {err && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{err}</div>}
        {flash && <div className="banner banner--ok" style={{ marginBottom: 'var(--sp-md)' }}>{flash}</div>}

        {rows.map((row, i) => (
          <div key={i} className="rep__row">
            <input
              className="input"
              inputMode="numeric"
              value={row.number ?? ''}
              placeholder={t('rep.playerNumber')}
              onChange={(e) => {
                const v = e.target.value.trim();
                const next = [...rows];
                next[i] = { ...row, number: v ? Number(v) : null };
                setRows(next);
              }}
              onBlur={() => void save(rows)}
            />
            <input
              className="input"
              value={row.name}
              placeholder={t('rep.playerName')}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, name: e.target.value };
                setRows(next);
              }}
              onBlur={() => void save(rows)}
            />
            <span />
            <button
              className="btn-link"
              onClick={() => void save(rows.filter((_, n) => n !== i))}
            >
              ×
            </button>
          </div>
        ))}

        <Button
          disabled={busy}
          style={{ marginTop: 'var(--sp-md)' }}
          onClick={() => setRows([...rows, { name: '', number: null }])}
        >
          {t('rep.addPlayer')}
        </Button>

        <p className="rep__hint">{t('pending.afterApproval')}</p>
        <button className="btn-link" onClick={onReload}>
          {t('pending.refresh')}
        </button>
      </Card>
    </div>
  );
}

/**
 * Ulaz za predstavnika — bira ekran prema stanju računa:
 *   nema prijave  → prijavi ekipu
 *   čeka odobrenje → nacrt sastava
 *   odobrena ekipa → uređivanje pravih igrača
 */
export function RepPortal() {
  const { t } = useT();
  const { teamId } = useAuth();
  const [reg, setReg] = useState<MyRegistration | null | undefined>(undefined);

  const loadReg = useCallback(async () => {
    setReg(undefined);
    try {
      setReg(await fetchMyRegistration());
    } catch {
      setReg(null);
    }
  }, []);

  useEffect(() => {
    if (!teamId) void loadReg();
  }, [teamId, loadReg]);

  if (teamId) return <ApprovedTeamPortal />;
  if (reg === undefined) return <div className="rep"><Card>{t('common.loading')}</Card></div>;
  if (reg === null) return <MyTeamSetup onDone={() => void loadReg()} />;
  return <PendingRoster reg={reg} onReload={() => void loadReg()} />;
}
