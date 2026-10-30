import { useEffect, useMemo, useState } from 'react';
import type { Gender, Match, ProgramItem, Stage } from '@zrinjski/core';
import { addMinutesToTime, isFinalGroupMatch, timeToMinutes } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { formatDayLabel } from '../i18n/dateLabels';
import { Button, Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { DaysEditor } from '../features/tournament/DaysEditor';
import { swappableNeighbour } from '@zrinjski/core';
import { useScheduleMatches, type TeamLite } from '../features/schedule/useScheduleMatches';
import { FinalsPanel } from '../features/schedule/FinalsPanel';
import { MatchDetailModal } from '../features/schedule/MatchDetailModal';
import { MatchTimeModal } from '../features/schedule/MatchTimeModal';
import { PauseEditor } from '../features/schedule/PauseEditor';
import { notifyScheduleChange } from '../lib/data';
import { toInputTime, isoToLocalHHMM } from '../lib/timeFormat';
import './Schedule.css';

const STAGE_SHORT: Record<Stage, string> = {
  group: '',
  semifinal: 'PF',
  third_place: '3.',
  final: 'FIN',
};

function side(
  teamId: string | null,
  placeholder: string | null,
  teamsById: Map<string, TeamLite>
): { name: string; code: string | null; index: number | null; logoUrl: string | null; ph: boolean } {
  if (teamId && teamsById.has(teamId)) {
    const tm = teamsById.get(teamId)!;
    return { name: tm.name, code: tm.short_code, index: tm.sort_order, logoUrl: tm.logo_url, ph: false };
  }
  return { name: placeholder ?? '—', code: null, index: null, logoUrl: null, ph: true };
}

function MatchRow({
  m,
  teamsById,
  onOpen,
  onTime,
  onMove,
  canUp,
  canDown,
  busy,
}: {
  m: Match;
  teamsById: Map<string, TeamLite>;
  onOpen: () => void;
  onTime: () => void;
  onMove: (dir: 'up' | 'down') => void;
  canUp: boolean;
  canDown: boolean;
  busy: boolean;
}) {
  const { t } = useT();
  const home = side(m.home_team_id, m.home_placeholder, teamsById);
  const away = side(m.away_team_id, m.away_placeholder, teamsById);
  const time = isoToLocalHHMM(m.scheduled_time);
  const isFinal = m.stage === 'final';
  const stage = isFinalGroupMatch(m) ? 'ZS' : STAGE_SHORT[m.stage];
  const locked = m.status !== 'scheduled';

  return (
    <div className="mrow-wrap">
      {/* Vrijeme je zaseban gumb: klik mijenja termin ili dan. Izvan retka jer
          je redak gumb (otvara detalj), a gumbi se ne smiju gnijezditi. */}
      <button
        type="button"
        className="mrow__timebtn"
        disabled={locked || busy}
        title={locked ? t('tm.locked') : t('tm.edit')}
        aria-label={`${t('tm.edit')} ${time}`}
        onClick={onTime}
      >
        {time || '—'}
      </button>
      <button
        type="button"
        className={`mrow ${isFinal ? 'mrow--final' : ''}`}
        onClick={onOpen}
        title={t('mdet.open')}
      >
        <Crest code={home.code} index={home.index} logoUrl={home.logoUrl} size={28} />
        <div className={`mrow__team ${home.ph ? 'is-ph' : ''}`}>{home.name}</div>
        <div className="mrow__mid">
          {m.status === 'live' ? (
            <span className="mrow__live">
              {t('schedule.live')} {m.home_score}:{m.away_score}
            </span>
          ) : m.status === 'finished' ? (
            <span className="mrow__score">
              {m.home_score}:{m.away_score}
            </span>
          ) : (
            <span className="mrow__vs">{t('schedule.vs')}</span>
          )}
        </div>
        <div className={`mrow__team mrow__team--away ${away.ph ? 'is-ph' : ''}`}>{away.name}</div>
        <Crest code={away.code} index={away.index} logoUrl={away.logoUrl} size={28} />
        {stage && <span className="mrow__stage">{stage}</span>}
      </button>

      {/* Zamjena termina sa susjednom utakmicom. Izvan gornjeg gumba jer se
          gumbi ne smiju gnijezditi. */}
      <div className="mrow__move">
        <button
          type="button"
          className="mrow__arrow"
          disabled={!canUp || busy}
          title={t('schedule.moveUp')}
          aria-label={t('schedule.moveUp')}
          onClick={() => onMove('up')}
        >
          ▲
        </button>
        <button
          type="button"
          className="mrow__arrow"
          disabled={!canDown || busy}
          title={t('schedule.moveDown')}
          aria-label={t('schedule.moveDown')}
          onClick={() => onMove('down')}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

/** Pauza u dvorani, među utakmicama svog dana. */
function PauseRow({ p }: { p: ProgramItem }) {
  const { t } = useT();
  const s = toInputTime(p.time);
  return (
    <div className="prow">
      <span className="prow__time">
        {s}–{addMinutesToTime(s, p.duration_min ?? 0)}
      </span>
      <span className="prow__label">{t('pause.label')}</span>
      <span>{p.title}</span>
    </div>
  );
}

type DayRow = { kind: 'match'; m: Match; at: number } | { kind: 'pause'; p: ProgramItem; at: number };

export function Schedule() {
  const { t, locale } = useT();
  const data = useTournamentData();
  const sched = useScheduleMatches(data.tournament?.id ?? null);
  const [koGender, setKoGender] = useState<Gender>('m');
  const [duration, setDuration] = useState('');
  const [gap, setGap] = useState('');
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [timeMatch, setTimeMatch] = useState<Match | null>(null);
  const [moving, setMoving] = useState(false);
  /** Utakmice kojima se termin promijenio od zadnje obavijesti. */
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data.tournament) {
      setDuration(String(data.tournament.match_duration_min));
      setGap(String(data.tournament.gap_min));
    }
  }, [data.tournament]);

  /**
   * Utakmice i pauze po danu, KRONOLOŠKI. Utakmica bez termina ide na kraj,
   * redom igranja — tako se odmah vidi što još nema vrijeme.
   */
  const rowsByDay = useMemo(() => {
    const map = new Map<string, DayRow[]>();
    const push = (dayId: string, r: DayRow) => {
      const arr = map.get(dayId) ?? [];
      arr.push(r);
      map.set(dayId, arr);
    };
    for (const m of sched.matches) {
      if (!m.day_id) continue;
      const hhmm = isoToLocalHHMM(m.scheduled_time);
      push(m.day_id, { kind: 'match', m, at: hhmm ? timeToMinutes(hhmm) : 10_000 + m.sort_order });
    }
    for (const p of sched.pauses) push(p.day_id, { kind: 'pause', p, at: timeToMinutes(toInputTime(p.time)) - 0.5 });
    for (const arr of map.values()) arr.sort((a, b) => a.at - b.at);
    return map;
  }, [sched.matches, sched.pauses]);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (!data.tournament) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;

  const tr = data.tournament;
  const daysWithTime = data.days.filter((d) => !!d.first_match_time);
  const scheduleLocked = sched.matches.some((m) => m.status !== 'scheduled');
  const params = { matchDurationMin: tr.match_duration_min, gapMin: tr.gap_min };

  async function commitNum(key: 'match_duration_min' | 'gap_min', raw: string, fallback: number) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n !== fallback) await data.saveSettings({ [key]: n });
  }

  async function handleGenerate() {
    // Generiranje računa termine iznova, redom igranja — ručno postavljeni
    // termini i pauze prije toga bi se izgubili bez pitanja.
    if (sched.matches.some((m) => m.scheduled_time) && !window.confirm(t('sched.regenConfirm'))) return;
    setDoneMsg(null);
    const n = await sched.generate(tr, data.days);
    setChanged((prev) => new Set([...prev, ...sched.matches.map((m) => m.id)]));
    setDoneMsg(t('schedule.done', { n }));
    setTimeout(() => setDoneMsg(null), 3000);
  }

  const markChanged = (ids: string[]) => {
    setNotifyMsg(null);
    setChanged((prev) => new Set([...prev, ...ids]));
  };

  /**
   * Jedna obavijest po ekipi, samo onima koji je prate: "Petak u 11:00:
   * Zrinjski – Široki". Utakmica bez upisanih ekipa nema kome javiti.
   */
  async function notify() {
    if (notifying) return;
    const byTeam = new Map<string, string[]>();
    for (const id of changed) {
      const m = sched.matches.find((x) => x.id === id);
      if (!m || !m.scheduled_time) continue;
      const day = data.days.find((d) => d.id === m.day_id);
      const h = m.home_team_id ? sched.teamsById.get(m.home_team_id)?.name : null;
      const a = m.away_team_id ? sched.teamsById.get(m.away_team_id)?.name : null;
      const line = t('sched.notifyLine', {
        day: day ? formatDayLabel(day.date, locale) : '',
        time: isoToLocalHHMM(m.scheduled_time),
        match: `${h ?? m.home_placeholder ?? '?'} – ${a ?? m.away_placeholder ?? '?'}`,
      });
      for (const teamId of [m.home_team_id, m.away_team_id]) {
        if (!teamId) continue;
        byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), line]);
      }
    }
    if (byTeam.size === 0) {
      setNotifyMsg({ ok: false, text: t('sched.notifyNone') });
      return;
    }
    setNotifying(true);
    setNotifyMsg(null);
    try {
      const r = await notifyScheduleChange(
        tr.id,
        [...byTeam].map(([teamId, lines]) => ({ teamId, title: t('sched.notifyTitle'), body: lines.join('\n') }))
      );
      setChanged(new Set());
      setNotifyMsg({ ok: true, text: t('sched.notifySent', { teams: r.teams, n: r.sent }) });
    } catch (e) {
      setNotifyMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setNotifying(false);
    }
  }

  return (
    <div className="sched">
      {/* Lijevo: postavke + dani + pauze + generiraj */}
      <div className="sched__left">
        <Card>
          <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
            {t('schedule.autoTitle')}
          </h2>
          <div className="grid-2">
            <div className="numfield">
              <label className="field-label">{t('tournament.duration')}</label>
              <div className="input-wrap">
                <input
                  className="input numfield__input"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  onBlur={() => void commitNum('match_duration_min', duration, tr.match_duration_min)}
                />
                <span className="input-affix">{t('tournament.min')}</span>
              </div>
            </div>
            <div className="numfield">
              <label className="field-label">{t('tournament.gap')}</label>
              <div className="input-wrap">
                <input
                  className="input numfield__input"
                  type="number"
                  min={0}
                  value={gap}
                  onChange={(e) => setGap(e.target.value)}
                  onBlur={() => void commitNum('gap_min', gap, tr.gap_min)}
                />
                <span className="input-affix">{t('tournament.min')}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <DaysEditor days={data.days} onAdd={data.addDay} onEdit={data.editDay} onRemove={data.removeDay} />
        </Card>

        <Card>
          <PauseEditor
            tournamentId={tr.id}
            days={data.days}
            program={sched.program}
            matches={sched.matches}
            matchDurationMin={tr.match_duration_min}
            onChanged={sched.reload}
          />
        </Card>

        <Button
          variant="primary"
          size="lg"
          block
          disabled={sched.generating || scheduleLocked || daysWithTime.length === 0 || sched.matches.length === 0}
          onClick={() => void handleGenerate()}
        >
          {sched.generating ? t('schedule.generating') : t('schedule.generate')}
        </Button>

        {scheduleLocked && <div className="banner banner--info">{t('schedule.locked')}</div>}
        {daysWithTime.length === 0 && <div className="banner banner--info">{t('schedule.noDaysWarn')}</div>}
        {sched.matches.length === 0 && !sched.loading && (
          <div className="banner banner--info">{t('schedule.noMatches')}</div>
        )}
        {doneMsg && <div className="banner banner--ok">{doneMsg}</div>}

        <div className="sched__note">{t('schedule.delayNote')}</div>
      </div>

      {/* Desno: satnica po danima */}
      <div className="sched__right">
        <div className="sched__right-head">
          <h2 className="section-label">{t('schedule.generated')}</h2>
          <Button disabled={changed.size === 0 || notifying} onClick={() => void notify()}>
            {notifying ? t('form.saving') : t('sched.notify', { n: changed.size })}
          </Button>
        </div>
        {notifyMsg && (
          <div className={`banner ${notifyMsg.ok ? 'banner--ok' : 'banner--info'}`}>{notifyMsg.text}</div>
        )}
        <p className="sched__swaphint">{t('sched.timeHint')}</p>

        {data.days.map((d) => {
          const rows = rowsByDay.get(d.id) ?? [];
          return (
            <div key={d.id} className="sched__day">
              <div className="sched__day-title">
                {formatDayLabel(d.date, locale)}
                {d.first_match_time ? ` · ${toInputTime(d.first_match_time)}` : ''}
              </div>
              {rows.length === 0 ? (
                <div className="sched__day-empty">{t('schedule.noMatches')}</div>
              ) : (
                <div className="sched__rows">
                  {rows.map((r) =>
                    r.kind === 'pause' ? (
                      <PauseRow key={r.p.id} p={r.p} />
                    ) : (
                      <MatchRow
                        key={r.m.id}
                        m={r.m}
                        teamsById={sched.teamsById}
                        onOpen={() => setOpenMatch(r.m)}
                        onTime={() => setTimeMatch(r.m)}
                        canUp={!!swappableNeighbour(sched.matches, r.m.id, 'up')}
                        canDown={!!swappableNeighbour(sched.matches, r.m.id, 'down')}
                        busy={moving}
                        onMove={(dir) => {
                          const other = swappableNeighbour(sched.matches, r.m.id, dir);
                          setMoving(true);
                          void sched
                            .swap(r.m.id, dir)
                            .then(() => markChanged([r.m.id, ...(other ? [other.id] : [])]))
                            .finally(() => setMoving(false));
                        }}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
        {data.days.length === 0 && <Card>{t('tournament.noDays')}</Card>}

        {/* Završnica: bez ovoga polufinale zauvijek ostaje "A1 vs B2" i
            zapisničar ga ne može voditi. */}
        <Card>
          <div className="gender-toggle" style={{ marginBottom: 'var(--sp-md)' }}>
            {(['m', 'z'] as const).map((g) => (
              <button
                key={g}
                className={`gender-toggle__btn ${koGender === g ? 'is-active' : ''}`}
                onClick={() => setKoGender(g)}
              >
                {t(g === 'm' ? 'teams.men' : 'teams.women')}
              </button>
            ))}
          </div>
          <FinalsPanel
            tournamentId={tr.id}
            gender={koGender}
            matches={sched.matches}
            teams={sched.teams}
            groups={sched.groups}
            points={{ pointsWin: tr.points_win, pointsDraw: tr.points_draw, pointsLoss: tr.points_loss }}
            // Zadnji dan s utakmicama je onaj na kojem se igra završnica.
            finalsDayId={[...data.days].reverse().find((d) => !!d.first_match_time)?.id ?? null}
            onChanged={sched.reload}
          />
        </Card>
      </div>

      {openMatch && (
        <MatchDetailModal
          m={openMatch}
          teamsById={sched.teamsById}
          dayDate={data.days.find((d) => d.id === openMatch.day_id)?.date ?? null}
          tournamentId={tr.id}
          tournamentName={tr.name}
          onClose={() => setOpenMatch(null)}
        />
      )}

      {timeMatch && (
        <MatchTimeModal
          m={timeMatch}
          matches={sched.matches}
          days={data.days}
          pauses={sched.pauses}
          params={params}
          teamsById={sched.teamsById}
          onClose={() => setTimeMatch(null)}
          onSave={async (changes) => {
            await sched.setTimes(changes);
            markChanged(changes.map((c) => c.id));
          }}
        />
      )}
    </div>
  );
}
