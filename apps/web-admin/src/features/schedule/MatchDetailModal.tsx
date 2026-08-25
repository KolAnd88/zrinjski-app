import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventType, Match, MatchEvent, Player } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import type { StringKey } from '../../i18n/strings';
import { formatDayLabel } from '../../i18n/dateLabels';
import { Button, Crest } from '../../components/ui';
import { fetchEvents, fetchPlayersByTeams } from '../../lib/data';
import { isoToLocalHHMM } from '../../lib/timeFormat';
import type { TeamLite } from './useScheduleMatches';
import './MatchDetailModal.css';

const STAGE: Record<string, StringKey> = {
  group: 'mdet.stage.group',
  semifinal: 'mdet.stage.semifinal',
  third_place: 'mdet.stage.third',
  final: 'mdet.stage.final',
};

const EVENT: Record<EventType, StringKey> = {
  goal: 'mdet.ev.goal',
  save: 'mdet.ev.save',
  suspension_2min: 'mdet.ev.susp',
  red_card: 'mdet.ev.red',
};

/**
 * Detalj utakmice iz rasporeda.
 *
 * Zamišljen kao brzi uvid, ne kao drugi zapisnik: tko je igrao, što se
 * dogodilo i koliko je bilo. Za papir i potpise vodi na pravi zapisnik.
 */
export function MatchDetailModal({
  m,
  teamsById,
  dayDate,
  onClose,
}: {
  m: Match;
  teamsById: Map<string, TeamLite>;
  dayDate: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const home = m.home_team_id ? teamsById.get(m.home_team_id) : undefined;
  const away = m.away_team_id ? teamsById.get(m.away_team_id) : undefined;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const teamIds = [m.home_team_id, m.away_team_id].filter((x): x is string => !!x);
      const [ev, ps] = await Promise.all([
        fetchEvents(m.id),
        teamIds.length ? fetchPlayersByTeams(teamIds) : Promise.resolve([] as Player[]),
      ]);
      if (!alive) return;
      setEvents(ev);
      setPlayers(ps);
    })();
    return () => {
      alive = false;
    };
  }, [m.id, m.home_team_id, m.away_team_id]);

  // Zatvaranje tipkovnicom — dijalog se otvara klikom, pa mora imati i izlaz
  // bez miša.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const playerName = (id: string | null) => players.find((p) => p.id === id)?.name ?? null;

  // Po minuti utakmice, ne po vremenu upisa — zakašnjeli unos inače završi
  // na krivom mjestu.
  const ordered = [...(events ?? [])].sort(
    (a, b) => a.minute - b.minute || a.created_at.localeCompare(b.created_at)
  );

  // Tekući rezultat uz svaki gol — čitatelj vidi kad se utakmica prelomila.
  let h = 0;
  let a = 0;
  const flow = ordered.map((e) => {
    if (e.type === 'goal') {
      if (e.team_id === m.home_team_id) h++;
      else if (e.team_id === m.away_team_id) a++;
    }
    return { e, score: e.type === 'goal' ? `${h}:${a}` : null };
  });

  const goalsOf = (playerId: string) =>
    ordered.filter((e) => e.type === 'goal' && e.player_id === playerId).length;

  const roster = (teamId: string | null | undefined) =>
    teamId ? players.filter((p) => p.team_id === teamId) : [];

  const statusKey: StringKey =
    m.status === 'live' ? 'mdet.statusLive' : m.status === 'finished' ? 'mdet.statusFinished' : 'mdet.statusScheduled';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal mdet" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{t('mdet.title')}</h2>
          <button className="modal__close" aria-label="×" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mdet__meta">
          <span className={`mdet__status is-${m.status}`}>{t(statusKey)}</span>
          <span>{t(STAGE[m.stage] ?? 'mdet.stage.group')}</span>
          {dayDate && <span>{formatDayLabel(dayDate, locale)}</span>}
          {isoToLocalHHMM(m.scheduled_time) && <span>{isoToLocalHHMM(m.scheduled_time)}</span>}
        </div>

        <div className="mdet__score">
          <div className="mdet__side">
            <Crest code={home?.short_code} index={home?.sort_order ?? null} logoUrl={home?.logo_url ?? null} size={44} />
            <span className="mdet__team">{home?.name ?? m.home_placeholder ?? '—'}</span>
          </div>
          <div className="mdet__result">
            {m.home_score} : {m.away_score}
          </div>
          <div className="mdet__side mdet__side--right">
            <span className="mdet__team">{away?.name ?? m.away_placeholder ?? '—'}</span>
            <Crest code={away?.short_code} index={away?.sort_order ?? null} logoUrl={away?.logo_url ?? null} size={44} />
          </div>
        </div>

        {m.best_player_id && (
          <div className="mdet__best">
            <span>{t('live.bestPlayer')}</span>
            <b>{playerName(m.best_player_id) ?? '—'}</b>
          </div>
        )}

        {events === null ? (
          <p className="mdet__empty">{t('common.loading')}</p>
        ) : (
          <>
            <div className="mdet__cols">
              {[
                { team: home, id: m.home_team_id },
                { team: away, id: m.away_team_id },
              ].map((s, i) => (
                <section key={i}>
                  <h3 className="section-label">{s.team?.name ?? '—'}</h3>
                  {roster(s.id).length === 0 ? (
                    <p className="mdet__empty">{t('mdet.noRoster')}</p>
                  ) : (
                    <ul className="mdet__roster">
                      {roster(s.id).map((p) => {
                        const g = goalsOf(p.id);
                        return (
                          <li key={p.id}>
                            <span className="mdet__num">{p.number ?? '–'}</span>
                            <span className="mdet__pname">
                              {p.name}
                              {p.is_captain && <em> (K)</em>}
                            </span>
                            {g > 0 && <span className="mdet__goals">{g}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <h3 className="section-label" style={{ marginTop: 'var(--sp-lg)' }}>
              {t('report.timeline')}
            </h3>
            {flow.length === 0 ? (
              <p className="mdet__empty">
                {m.status === 'scheduled' ? t('mdet.notPlayed') : t('report.noEvents')}
              </p>
            ) : (
              <div className="mdet__flow">
                {flow.map(({ e, score }) => (
                  <div key={e.id} className={`mdet__ev ${e.team_id === m.away_team_id ? 'is-away' : ''}`}>
                    <span className="mdet__min">{e.minute}'</span>
                    <span className="mdet__evtype">{t(EVENT[e.type])}</span>
                    <span className="mdet__evplayer">{playerName(e.player_id) ?? '—'}</span>
                    {score && <span className="mdet__evscore">{score}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mdet__actions">
          <Button variant="primary" onClick={() => navigate(`/zapisnik?match=${m.id}`)}>
            {t('mdet.openReport')}
          </Button>
          <Button onClick={() => navigate(`/live?match=${m.id}`)}>{t('mdet.openLive')}</Button>
          <span className="mdet__hint">{t('mdet.reportHint')}</span>
        </div>
      </div>
    </div>
  );
}
