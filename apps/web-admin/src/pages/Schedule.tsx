import { useEffect, useMemo, useState } from 'react';
import type { Match, Stage } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { formatDayLabel } from '../i18n/dateLabels';
import { Button, Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { DaysEditor } from '../features/tournament/DaysEditor';
import { useScheduleMatches, type TeamLite } from '../features/schedule/useScheduleMatches';
import { MatchDetailModal } from '../features/schedule/MatchDetailModal';
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
  onMove,
  canUp,
  canDown,
  busy,
}: {
  m: Match;
  teamsById: Map<string, TeamLite>;
  onOpen: () => void;
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
  // Odigrane i tekuće utakmice se ne premještaju — termin im je već prošao,
  // a zamjena bi pomaknula rezultat na tuđe vrijeme.
  const movable = m.status === 'scheduled';

  return (
    <div className="mrow-wrap">
      <button
        type="button"
        className={`mrow ${isFinal ? 'mrow--final' : ''}`}
        onClick={onOpen}
        title={t('mdet.open')}
      >
      <div className="mrow__time">{time || '—'}</div>
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
        {STAGE_SHORT[m.stage] && <span className="mrow__stage">{STAGE_SHORT[m.stage]}</span>}
      </button>

      {/* Zamjena termina sa susjednom utakmicom. Izvan gornjeg gumba jer se
          gumbi ne smiju gnijezditi. */}
      <div className="mrow__move">
        <button
          type="button"
          className="mrow__arrow"
          disabled={!movable || !canUp || busy}
          title={t('schedule.moveUp')}
          aria-label={t('schedule.moveUp')}
          onClick={() => onMove('up')}
        >
          ▲
        </button>
        <button
          type="button"
          className="mrow__arrow"
          disabled={!movable || !canDown || busy}
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

export function Schedule() {
  const { t, locale } = useT();
  const data = useTournamentData();
  const sched = useScheduleMatches(data.tournament?.id ?? null);
  const [duration, setDuration] = useState('');
  const [gap, setGap] = useState('');
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (data.tournament) {
      setDuration(String(data.tournament.match_duration_min));
      setGap(String(data.tournament.gap_min));
    }
  }, [data.tournament]);

  const matchesByDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of sched.matches) {
      if (!m.day_id) continue;
      const arr = map.get(m.day_id) ?? [];
      arr.push(m);
      map.set(m.day_id, arr);
    }
    return map;
  }, [sched.matches]);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (!data.tournament) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;

  const tr = data.tournament;
  const daysWithTime = data.days.filter((d) => !!d.first_match_time);

  async function commitNum(key: 'match_duration_min' | 'gap_min', raw: string, fallback: number) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n !== fallback) await data.saveSettings({ [key]: n });
  }

  async function handleGenerate() {
    setDoneMsg(null);
    const n = await sched.generate(tr, data.days);
    setDoneMsg(t('schedule.done', { n }));
    setTimeout(() => setDoneMsg(null), 3000);
  }

  return (
    <div className="sched">
      {/* Lijevo: postavke + dani + generiraj */}
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

        <Button
          variant="primary"
          size="lg"
          block
          disabled={sched.generating || daysWithTime.length === 0 || sched.matches.length === 0}
          onClick={() => void handleGenerate()}
        >
          {sched.generating ? t('schedule.generating') : t('schedule.generate')}
        </Button>

        {daysWithTime.length === 0 && <div className="banner banner--info">{t('schedule.noDaysWarn')}</div>}
        {sched.matches.length === 0 && !sched.loading && (
          <div className="banner banner--info">{t('schedule.noMatches')}</div>
        )}
        {doneMsg && <div className="banner banner--ok">{doneMsg}</div>}

        <div className="sched__note">{t('schedule.delayNote')}</div>
      </div>

      {/* Desno: generirana satnica po danima */}
      <div className="sched__right">
        <div className="sched__right-head">
          <h2 className="section-label">{t('schedule.generated')}</h2>
          <span className="sched__auto">{t('schedule.auto')}</span>
        </div>
        <p className="sched__swaphint">{t('schedule.swapHint')}</p>

        {data.days.map((d) => {
          const ms = matchesByDay.get(d.id) ?? [];
          return (
            <div key={d.id} className="sched__day">
              <div className="sched__day-title">
                {formatDayLabel(d.date, locale)}
                {d.first_match_time ? ` · ${toInputTime(d.first_match_time)}` : ''}
              </div>
              {ms.length === 0 ? (
                <div className="sched__day-empty">{t('schedule.noMatches')}</div>
              ) : (
                <div className="sched__rows">
                  {ms.map((m, i) => (
                    <MatchRow
                      key={m.id}
                      m={m}
                      teamsById={sched.teamsById}
                      onOpen={() => setOpenMatch(m)}
                      canUp={i > 0}
                      canDown={i < ms.length - 1}
                      busy={moving}
                      onMove={(dir) => {
                        setMoving(true);
                        void sched.swap(m.id, dir).finally(() => setMoving(false));
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {data.days.length === 0 && <Card>{t('tournament.noDays')}</Card>}
      </div>

      {openMatch && (
        <MatchDetailModal
          m={openMatch}
          teamsById={sched.teamsById}
          dayDate={data.days.find((d) => d.id === openMatch.day_id)?.date ?? null}
          onClose={() => setOpenMatch(null)}
        />
      )}
    </div>
  );
}
