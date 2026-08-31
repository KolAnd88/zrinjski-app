import { useMemo, useState } from 'react';
import type { Gender, Grp, Match, Team } from '@zrinjski/core';
import {
  computeStandings,
  missingKnockoutMatches,
  planKnockout,
  type KnockoutBlocker,
} from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button, Crest } from '../../components/ui';
import './KnockoutPanel.css';

/**
 * Postavljanje ekipa u završnicu.
 *
 * Bracket se dosad samo crtao u aplikaciji, a utakmice završnice ostajale su
 * "A1 vs B2" — zapisničar ih nije mogao voditi jer nemaju ekipa ni sastava.
 * Ovdje organizator vidi tko po ljestvici ide gdje i to jednim gumbom zapisuje.
 *
 * Prikaz je namjerno "prije/poslije": prvo se vidi što će se promijeniti, pa
 * se tek onda sprema — isto načelo kao kod ždrijeba.
 */
export function KnockoutPanel({
  gender,
  matches,
  teams,
  groups,
  cfg,
  onApply,
  onCreate,
}: {
  gender: Gender;
  matches: Match[];
  teams: Team[];
  groups: Grp[];
  cfg: { pointsWin: number; pointsDraw: number; pointsLoss: number; advancePerGroup: number };
  onApply: (
    changes: { id: string; home_team_id: string | null; away_team_id: string | null }[]
  ) => Promise<void>;
  /** Napravi utakmice zavrsnice kojih jos nema (odluku donosi baza). */
  onCreate: () => Promise<void>;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const genderGroups = useMemo(
    () => groups.filter((g) => g.gender === gender).sort((a, b) => a.sort_order - b.sort_order),
    [groups, gender]
  );

  const plan = useMemo(() => {
    const standingsOf = (g: Grp | undefined) =>
      g
        ? computeStandings(
            teams.filter((tm) => tm.group_id === g.id),
            matches.filter((m) => m.grp_id === g.id),
            cfg
          )
        : [];
    return planKnockout({
      gender,
      matches: matches.filter((m) => m.gender === gender),
      groupA: standingsOf(genderGroups[0]),
      groupB: standingsOf(genderGroups[1]),
    });
  }, [gender, matches, teams, genderGroups, cfg]);

  const nameOf = (id: string | null) =>
    id ? (teams.find((tm) => tm.id === id)?.name ?? '—') : null;
  const teamOf = (id: string | null) => (id ? teams.find((tm) => tm.id === id) : undefined);
  const matchOf = (id: string) => matches.find((m) => m.id === id);

  const label = (m: Match | undefined) =>
    m ? t(`mdet.stage.${m.stage === 'third_place' ? 'third' : m.stage}`) : '';

  const blockerText = (b: KnockoutBlocker) => {
    switch (b.key) {
      case 'groups_unfinished':
        return t('ko.blockGroups', { n: b.remaining });
      case 'no_semifinals':
        return t('ko.blockNoSemis');
      case 'no_final':
        return t('ko.blockNoFinal');
      case 'no_third':
        return t('ko.blockNoThird');
      case 'not_enough_teams':
        return t('ko.blockTeams', { g: b.group });
      case 'semifinal_drawn':
        return t('ko.blockDrawn');
      case 'semifinal_unfinished':
        return t('ko.blockSemisPending');
      case 'already_started':
        return t('ko.blockStarted', { m: label(matchOf(b.matchId)) });
      default:
        return '';
    }
  };

  async function apply() {
    if (plan.patches.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onApply(plan.patches);
      setDone(plan.patches.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const side = (id: string | null, fallback: string | null) => {
    const tm = teamOf(id);
    return (
      <span className="ko__side">
        {tm && <Crest code={tm.short_code} index={tm.sort_order} logoUrl={tm.logo_url} size={22} />}
        <span className={tm ? 'ko__team' : 'ko__ph'}>{nameOf(id) ?? fallback ?? '?'}</span>
      </span>
    );
  };

  const missing = missingKnockoutMatches(
    matches.map((m) => ({ gender: m.gender, stage: m.stage })),
    gender
  );

  async function create() {
    if (missing.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onCreate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ko">
      <h2 className="section-label">{t('ko.title')}</h2>
      <p className="ko__hint">{t('ko.hint')}</p>

      {/* Na novom turniru utakmica završnice uopće nema — generiranje pravi
          samo grupne. Bez ovoga se nema što ni popuniti. */}
      {missing.length > 0 && (
        <div className="ko__create">
          <p className="ko__hint">{t('ko.createHint', { n: missing.length })}</p>
          <Button variant="secondary" disabled={busy} onClick={() => void create()}>
            {busy ? t('form.saving') : t('ko.create')}
          </Button>
        </div>
      )}

      {plan.patches.length > 0 ? (
        <ul className="ko__list">
          {plan.patches.map((p) => {
            const m = matchOf(p.id);
            return (
              <li key={p.id} className="ko__row">
                <span className="ko__stage">{label(m)}</span>
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

      {plan.blockers.length > 0 && (
        <ul className="ko__blockers">
          {plan.blockers.map((b, i) => (
            <li key={`${b.key}-${i}`}>{blockerText(b)}</li>
          ))}
        </ul>
      )}

      <div className="savebar">
        <Button
          variant="primary"
          disabled={plan.patches.length === 0 || busy}
          onClick={() => void apply()}
        >
          {busy ? t('form.saving') : t('ko.apply')}
        </Button>
        {done !== null && plan.patches.length === 0 && (
          <span className="savebar__ok">{t('ko.applied', { n: done })}</span>
        )}
        {err && <span className="savebar__err">{err}</span>}
      </div>
    </div>
  );
}
