import { useEffect, useMemo, useState } from 'react';
import type { Gender, Grp, Match, Team } from '@zrinjski/core';
import {
  computeStandings,
  drawBye,
  finalsConfigFromRow,
  finalsConfigToRow,
  finalsInSync,
  finalsSlots,
  finalsStarted,
  isFinalGroupMatch,
  planFinals,
  qualifierCount,
  resolveQualifiers,
  validateFinalsConfig,
  type FinalsBlocker,
  type FinalsConfig,
  type FinalsProblem,
} from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button, Crest } from '../../components/ui';
import {
  fetchFinalsConfig,
  saveFinalsConfig,
  setKnockoutTeams,
  syncFinalsMatches,
  updateTournament,
} from '../../lib/data';
import './KnockoutPanel.css';
import './FinalsPanel.css';

/** Redoslijed igranja: polufinala, 3. mjesto, finale; završna skupina redom. */
function slotRank(slot: string | null): number {
  if (!slot) return 99;
  if (slot.startsWith('fg')) return 10 + Number(slot.slice(2));
  return { sf1: 0, sf2: 1, third: 2, final: 3 }[slot] ?? 50;
}

const sameConfig = (a: FinalsConfig, b: FinalsConfig) =>
  (Object.keys(a) as (keyof FinalsConfig)[]).every((k) => a[k] === b[k]);

/**
 * Završnica jedne konkurencije: način, usklađivanje utakmica, popunjavanje
 * iz ljestvica, ždrijeb i ručna promjena svakog mjesta.
 *
 * Sve se radi u ovom redu jer je tako i na turniru: prvo se dogovori način,
 * pa se utakmice stave u satnicu s oznakama ("A1", "Pobjednik B"), a ekipe se
 * upišu kad grupe završe. Organizator uvijek ima zadnju riječ — lucky loser,
 * odustajanje i ždrijeb uživo upisuje ručno, i to automatsko popunjavanje
 * nikad ne pregazi.
 */
export function FinalsPanel({
  tournamentId,
  gender,
  matches,
  teams,
  groups,
  points,
  finalsDayId,
  onChanged,
}: {
  tournamentId: string;
  gender: Gender;
  matches: Match[];
  teams: Team[];
  groups: Grp[];
  points: { pointsWin: number; pointsDraw: number; pointsLoss: number };
  /** Dan na koji idu nove utakmice završnice (zadnji dan s utakmicama). */
  finalsDayId: string | null;
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const genderGroups = useMemo(
    () => groups.filter((g) => g.gender === gender).sort((a, b) => a.sort_order - b.sort_order),
    [groups, gender]
  );
  const groupCount = genderGroups.length;
  const groupSizes = genderGroups.map((g) => teams.filter((tm) => tm.group_id === g.id).length);
  const genderTeams = useMemo(
    () => teams.filter((tm) => tm.gender === gender).sort((a, b) => a.name.localeCompare(b.name, 'hr')),
    [teams, gender]
  );

  const [saved, setSaved] = useState<FinalsConfig | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [draft, setDraft] = useState<FinalsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSaved(null);
    setDraft(null);
    setMsg(null);
    setErr(null);
    fetchFinalsConfig(tournamentId, gender)
      .then((row) => {
        if (!live) return;
        const c = finalsConfigFromRow(row, groupCount);
        setSaved(c);
        setDraft(c);
        setPersisted(!!row);
      })
      .catch((e) => live && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [tournamentId, gender, groupCount]);

  const genderMatches = useMemo(() => matches.filter((m) => m.gender === gender), [matches, gender]);
  const finalsMatches = useMemo(
    () => genderMatches.filter((m) => m.finals_slot).sort((a, b) => slotRank(a.finals_slot) - slotRank(b.finals_slot)),
    [genderMatches]
  );
  const started = finalsStarted(genderMatches);

  const standings = useMemo(
    () =>
      genderGroups.map((g) =>
        computeStandings(
          teams.filter((tm) => tm.group_id === g.id),
          matches.filter((m) => m.grp_id === g.id),
          { ...points, advancePerGroup: saved?.advancePerGroup ?? 0 }
        )
      ),
    [genderGroups, teams, matches, points, saved]
  );
  const remaining = genderMatches.filter(
    (m) => m.stage === 'group' && !m.finals_slot && m.status !== 'finished'
  ).length;
  /**
   * Utakmice završnice slažu se tek nakon ždrijeba. Starije verzije
   * aplikacije smatraju ždrijeb objavljenim čim postoji ijedna utakmica
   * grupne faze — a završna skupina je također faza 'group'. Napravljena
   * prije ždrijeba, gledateljima bi umjesto popisa prijavljenih pokazala
   * prazne tablice.
   */
  const drawDone = genderMatches.some((m) => m.stage === 'group' && !m.finals_slot);

  if (groupCount === 0) {
    return (
      <div className="ko">
        <h2 className="section-label">{t('fin.title')}</h2>
        <p className="ko__hint">{t('fin.noGroups')}</p>
      </div>
    );
  }
  if (!saved || !draft) {
    return (
      <div className="ko">
        <h2 className="section-label">{t('fin.title')}</h2>
        <p className="ko__hint">{err ?? t('common.loading')}</p>
      </div>
    );
  }

  const problems = validateFinalsConfig(draft, groupSizes);
  const n = qualifierCount(draft, groupCount);
  const draftSlots = problems.length === 0 ? finalsSlots(draft, groupCount) : [];
  const dirty = !persisted || !sameConfig(saved, draft);
  const savedSlots = finalsSlots(saved, groupCount);
  const inSync = finalsInSync(savedSlots, genderMatches);

  const planInput = { cfg: saved, groups: standings, groupMatchesRemaining: remaining, matches: finalsMatches };
  const plan = planFinals(planInput);
  const qualifiers = resolveQualifiers(planInput);
  const canDraw =
    saved.format === 'bracket' &&
    saved.byeRule === 'draw' &&
    qualifierCount(saved, groupCount) === 3 &&
    !!qualifiers &&
    plan.blockers.some((b) => b.key === 'draw_needed');

  const set = <K extends keyof FinalsConfig>(k: K, v: FinalsConfig[K]) => {
    setMsg(null);
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };
  const nameOf = (id: string | null) => (id ? (teams.find((tm) => tm.id === id)?.name ?? '—') : null);
  const stageLabel = (m: Match | undefined) =>
    !m ? '' : isFinalGroupMatch(m) ? t('fin.stageGroup') : t(`mdet.stage.${m.stage === 'third_place' ? 'third' : m.stage}`);
  const matchOf = (id: string) => finalsMatches.find((m) => m.id === id);

  const errText = (e: unknown) => {
    const s = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
    if (s.includes('finals_started')) return t('fin.started');
    if (s.includes('partial_write')) return t('fin.raced');
    if (s.includes('not_authorized')) return t('fin.notAuthorized');
    return s;
  };

  async function run(action: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const done = await action();
      await onChanged();
      setMsg(done);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await saveFinalsConfig(tournamentId, gender, finalsConfigToRow(draft));
      // Starije verzije aplikacije znaju samo jedan broj za cijeli turnir.
      // Neka bude muški: muški kostur stare verzije crtaju kako treba.
      if (gender === 'm') await updateTournament(tournamentId, { advance_per_group: draft.advancePerGroup });
      setSaved(draft);
      setPersisted(true);
      if (!drawDone) return t('fin.savedNoDraw');
      const r = await syncFinalsMatches(tournamentId, gender, finalsDayId, draftSlots);
      return t('fin.saved', { c: r.created, u: r.updated, d: r.deleted });
    });

  const sync = () =>
    run(async () => {
      const r = await syncFinalsMatches(tournamentId, gender, finalsDayId, savedSlots);
      return t('fin.saved', { c: r.created, u: r.updated, d: r.deleted });
    });

  const apply = () =>
    run(async () => {
      await setKnockoutTeams(plan.patches);
      return t('ko.applied', { n: plan.patches.length });
    });

  const draw = () =>
    run(async () => {
      if (!qualifiers) return null;
      const [a, b, c] = qualifiers.seeds;
      const r = drawBye([a!, b!, c!]);
      const sf1 = finalsMatches.find((m) => m.finals_slot === 'sf1');
      const fin = finalsMatches.find((m) => m.finals_slot === 'final');
      if (!sf1 || !fin) return null;
      await setKnockoutTeams([
        { id: sf1.id, home_team_id: r.semi[0], away_team_id: r.semi[1] },
        { id: fin.id, home_team_id: r.bye, away_team_id: fin.away_team_id },
      ]);
      return t('fin.drawn', { team: nameOf(r.bye) ?? '' });
    });

  const problemText = (p: FinalsProblem) => {
    switch (p.key) {
      case 'bracket_size':
        return t('fin.pBracketSize', { n: p.n });
      case 'too_few':
        return t('fin.pTooFew');
      case 'too_many_lucky':
        return t('fin.pTooManyLucky', { max: p.max });
      case 'group_too_small':
        return t('fin.pGroupSmall', { g: p.group, size: p.size, need: p.need });
      case 'no_groups':
        return t('fin.noGroups');
    }
  };

  const blockerText = (b: FinalsBlocker) => {
    switch (b.key) {
      case 'groups_unfinished':
        return t('ko.blockGroups', { n: b.remaining });
      case 'group_short':
        return t('fin.bShort', { g: b.group });
      case 'out_of_sync':
        return t('fin.outOfSync');
      case 'draw_needed':
        return t('fin.bDraw');
      case 'semifinal_drawn':
        return t('ko.blockDrawn');
      case 'semifinal_unfinished':
        return t('ko.blockSemisPending');
    }
  };

  const side = (id: string | null, fallback: string | null) => {
    const tm = id ? teams.find((x) => x.id === id) : undefined;
    return (
      <span className="ko__side">
        {tm && <Crest code={tm.short_code} index={tm.sort_order} logoUrl={tm.logo_url} size={22} />}
        <span className={tm ? 'ko__team' : 'ko__ph'}>{nameOf(id) ?? fallback ?? '?'}</span>
      </span>
    );
  };

  const isBracket = draft.format === 'bracket';

  return (
    <div className="ko">
      <h2 className="section-label">{t('fin.title')}</h2>

      {/* ── Način ──────────────────────────────────────────────────────── */}
      <fieldset className="fin__form" disabled={started || busy}>
        <div className="fin__field">
          <span className="field-label">{t('fin.format')}</span>
          <div className="gender-toggle">
            {(['bracket', 'group'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`gender-toggle__btn ${draft.format === f ? 'is-active' : ''}`}
                onClick={() => set('format', f)}
              >
                {t(f === 'bracket' ? 'fin.formatBracket' : 'fin.formatGroup')}
              </button>
            ))}
          </div>
        </div>

        <div className="fin__grid">
          <label className="fin__field">
            <span className="field-label">{t('fin.advance')}</span>
            <input
              className="input numfield__input"
              type="number"
              min={1}
              max={8}
              value={draft.advancePerGroup}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) set('advancePerGroup', Math.max(1, Math.min(8, v)));
              }}
            />
          </label>

          <label className="fin__field">
            <span className="field-label">{t('fin.lucky')}</span>
            <select
              className="input"
              value={draft.luckyLosers}
              onChange={(e) => set('luckyLosers', Number(e.target.value))}
            >
              {Array.from({ length: groupCount + 1 }, (_, k) => (
                <option key={k} value={k}>
                  {k === 0 ? t('fin.luckyNone') : String(k)}
                </option>
              ))}
            </select>
          </label>

          {isBracket && n === 4 && (
            <label className="fin__check">
              <input type="checkbox" checked={draft.thirdPlace} onChange={(e) => set('thirdPlace', e.target.checked)} />
              {t('fin.third')}
            </label>
          )}

          {isBracket && n === 3 && (
            <label className="fin__field">
              <span className="field-label">{t('fin.bye')}</span>
              <select
                className="input"
                value={draft.byeRule}
                onChange={(e) => set('byeRule', e.target.value as FinalsConfig['byeRule'])}
              >
                <option value="seed">{t('fin.byeSeed')}</option>
                <option value="draw">{t('fin.byeDraw')}</option>
              </select>
            </label>
          )}

          {!isBracket && draft.advancePerGroup >= 2 && (
            <label className="fin__field">
              <span className="field-label">{t('fin.rematch')}</span>
              <select
                className="input"
                value={draft.rematchRule}
                onChange={(e) => set('rematchRule', e.target.value as FinalsConfig['rematchRule'])}
              >
                <option value="replay">{t('fin.rematchReplay')}</option>
                <option value="carry">{t('fin.rematchCarry')}</option>
              </select>
            </label>
          )}
        </div>
      </fieldset>

      {draft.luckyLosers > 0 && <p className="ko__hint">{t('fin.luckyHint')}</p>}
      {problems.length === 0 && (
        <p className="fin__summary">{t('fin.summary', { n, m: draftSlots.length })}</p>
      )}
      {problems.length > 0 && (
        <ul className="ko__blockers">
          {problems.map((p, i) => (
            <li key={`${p.key}-${i}`}>{problemText(p)}</li>
          ))}
        </ul>
      )}
      {started && <div className="banner banner--info">{t('fin.started')}</div>}

      <div className="savebar">
        <Button
          variant="primary"
          disabled={!dirty || problems.length > 0 || started || busy}
          onClick={() => void save()}
        >
          {busy ? t('form.saving') : t('fin.save')}
        </Button>
        {msg && <span className="savebar__ok">{msg}</span>}
        {err && <span className="savebar__err">{err}</span>}
      </div>

      {!drawDone && <p className="ko__hint">{t('fin.afterDraw')}</p>}

      {drawDone && !dirty && !inSync && !started && problems.length === 0 && (
        <div className="banner banner--info fin__sync">
          <span>{t('fin.outOfSync')}</span>
          <Button disabled={busy} onClick={() => void sync()}>
            {t('fin.sync')}
          </Button>
        </div>
      )}

      {/* ── Popuni iz ljestvica ───────────────────────────────────────── */}
      {finalsMatches.length > 0 && (
        <>
          <h3 className="fin__sub">{t('fin.fill')}</h3>
          <p className="ko__hint">{t('fin.fillHint')}</p>

          {plan.patches.length > 0 ? (
            <ul className="ko__list">
              {plan.patches.map((p) => {
                const m = matchOf(p.id);
                return (
                  <li key={p.id} className="ko__row">
                    <span className="ko__stage">{stageLabel(m)}</span>
                    <span className="ko__pair">
                      {side(p.home_team_id, m?.home_placeholder ?? null)}
                      <span className="ko__vs">{t('schedule.vs')}</span>
                      {side(p.away_team_id, m?.away_placeholder ?? null)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ko__none">{t('ko.nothing')}</p>
          )}

          {plan.blockers.filter((b) => b.key !== 'out_of_sync').length > 0 && (
            <ul className="ko__blockers">
              {plan.blockers
                .filter((b) => b.key !== 'out_of_sync')
                .map((b, i) => (
                  <li key={`${b.key}-${i}`}>{blockerText(b)}</li>
                ))}
            </ul>
          )}

          {plan.notes.length > 0 && (
            <ul className="ko__blockers fin__notes">
              {plan.notes.map((nt) => {
                const m = matchOf(nt.matchId);
                const cur = nt.side === 'home' ? m?.home_team_id : m?.away_team_id;
                return (
                  <li key={`${nt.matchId}-${nt.side}`}>
                    {t('fin.note', {
                      m: stageLabel(m),
                      team: nameOf(cur ?? null) ?? '',
                      exp: nameOf(nt.expectedTeamId) ?? '',
                    })}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="savebar">
            <Button variant="primary" disabled={plan.patches.length === 0 || busy} onClick={() => void apply()}>
              {busy ? t('form.saving') : t('ko.apply')}
            </Button>
            {canDraw && (
              <Button disabled={busy} onClick={() => void draw()}>
                {t('fin.draw')}
              </Button>
            )}
          </div>

          {/* ── Ručno ─────────────────────────────────────────────────── */}
          <h3 className="fin__sub">{t('fin.manual')}</h3>
          <p className="ko__hint">{t('fin.manualHint')}</p>
          <ul className="ko__list">
            {finalsMatches.map((m) => (
              <ManualRow
                key={m.id}
                m={m}
                label={stageLabel(m)}
                teams={genderTeams}
                onSave={async (home, away) => {
                  await setKnockoutTeams([{ id: m.id, home_team_id: home, away_team_id: away }]);
                  await onChanged();
                }}
                errText={errText}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Jedno mjesto u završnici s ručnim izborom obje ekipe. */
function ManualRow({
  m,
  label,
  teams,
  onSave,
  errText,
}: {
  m: Match;
  label: string;
  teams: Team[];
  onSave: (home: string | null, away: string | null) => Promise<void>;
  errText: (e: unknown) => string;
}) {
  const { t } = useT();
  const [home, setHome] = useState(m.home_team_id ?? '');
  const [away, setAway] = useState(m.away_team_id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setHome(m.home_team_id ?? '');
    setAway(m.away_team_id ?? '');
  }, [m.home_team_id, m.away_team_id]);

  const locked = m.status !== 'scheduled';
  const changed = home !== (m.home_team_id ?? '') || away !== (m.away_team_id ?? '');
  const same = !!home && home === away;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await onSave(home || null, away || null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const options = (ph: string | null) => (
    <>
      <option value="">— {ph ?? '?'} —</option>
      {teams.map((tm) => (
        <option key={tm.id} value={tm.id}>
          {tm.name}
        </option>
      ))}
    </>
  );

  return (
    <li className="ko__row fin__mrow">
      <span className="ko__stage">{label}</span>
      <span className="ko__pair">
        <select
          className="input fin__sel"
          aria-label={`${label} — ${m.home_placeholder ?? ''}`}
          disabled={locked || busy}
          value={home}
          onChange={(e) => setHome(e.target.value)}
        >
          {options(m.home_placeholder)}
        </select>
        <span className="ko__vs">{t('schedule.vs')}</span>
        <select
          className="input fin__sel"
          aria-label={`${label} — ${m.away_placeholder ?? ''}`}
          disabled={locked || busy}
          value={away}
          onChange={(e) => setAway(e.target.value)}
        >
          {options(m.away_placeholder)}
        </select>
      </span>
      <Button disabled={!changed || locked || busy || same} onClick={() => void save()}>
        {busy ? t('form.saving') : t('fin.saveRow')}
      </Button>
      {same && <span className="savebar__err">{t('fin.sameTeam')}</span>}
      {err && <span className="savebar__err">{err}</span>}
    </li>
  );
}
