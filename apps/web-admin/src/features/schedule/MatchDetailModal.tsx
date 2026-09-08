import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventType, Match, MatchEvent, Player } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import type { StringKey } from '../../i18n/strings';
import { formatDayLabel } from '../../i18n/dateLabels';
import { Button, Crest } from '../../components/ui';
import { fetchEvents, fetchMatchSquad, fetchPlayersByTeams, setMatchSquad } from '../../lib/data';
import { isoToLocalHHMM } from '../../lib/timeFormat';
import type { TeamLite } from './useScheduleMatches';
import { buildShareCard, downloadCardPng } from './shareResult';
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
  tournamentId,
  tournamentName,
  onClose,
}: {
  m: Match;
  teamsById: Map<string, TeamLite>;
  dayDate: string | null;
  tournamentId: string;
  tournamentName: string;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareErr, setShareErr] = useState(false);
  /** Tko je na zapisniku za ovu utakmicu. Prazno = cijela ekipa. */
  const [squad, setSquad] = useState<string[]>([]);
  /** Radna verzija po ekipi — sprema se tek na gumb, po jednu ekipu. */
  const [odabir, setOdabir] = useState<Record<string, string[]>>({});
  const [spremam, setSpremam] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<{ team: string; key: StringKey } | null>(null);

  const home = m.home_team_id ? teamsById.get(m.home_team_id) : undefined;
  const away = m.away_team_id ? teamsById.get(m.away_team_id) : undefined;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const teamIds = [m.home_team_id, m.away_team_id].filter((x): x is string => !!x);
      const [ev, ps, sq] = await Promise.all([
        fetchEvents(m.id),
        teamIds.length ? fetchPlayersByTeams(teamIds) : Promise.resolve([] as Player[]),
        fetchMatchSquad(m.id),
      ]);
      if (!alive) return;
      setEvents(ev);
      setPlayers(ps);
      setSquad(sq);
      // Kad sastav još nije složen, kvačice kreću sve upaljene: zapisnik bi
      // ionako ispisao cijelu ekipu, pa ekran pokazuje isto to. Posao je onda
      // odznačiti dvojicu, a ne označiti dvanaestoricu.
      const u = new Set(sq);
      const start: Record<string, string[]> = {};
      for (const id of teamIds) {
        const svi = ps.filter((p) => p.team_id === id);
        const vec = svi.filter((p) => u.has(p.id));
        start[id] = (vec.length > 0 ? vec : svi).map((p) => p.id);
      }
      setOdabir(start);
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

  /**
   * Sastav se slaže samo dok utakmica čeka. Nakon zvižduka ga baza odbija
   * mijenjati, pa se ovdje prikazuje kao gotov popis.
   */
  const uredivo = m.status === 'scheduled';

  /**
   * Popis igrača te ekipe. Dok se sastav slaže to je cijela ekipa, jer se s
   * nje kvači; poslije je to sastav te utakmice — isto što ispisuje zapisnik.
   */
  const roster = (teamId: string | null | undefined) => {
    if (!teamId) return [];
    const svi = players.filter((p) => p.team_id === teamId);
    if (uredivo) return svi;
    const u = new Set(squad);
    const moji = svi.filter((p) => u.has(p.id));
    return moji.length > 0 ? moji : svi;
  };

  const prekvaci = (teamId: string, playerId: string) =>
    setOdabir((prev) => {
      const sad = prev[teamId] ?? [];
      return {
        ...prev,
        [teamId]: sad.includes(playerId) ? sad.filter((x) => x !== playerId) : [...sad, playerId],
      };
    });

  async function spremiSastav(teamId: string) {
    setSpremam(teamId);
    setPoruka(null);
    try {
      const izbor = odabir[teamId] ?? [];
      await setMatchSquad(m.id, teamId, izbor);
      // Zamijeni samo igrače te ekipe; protivnikov sastav ostaje kakav je bio.
      const njeni = new Set(players.filter((p) => p.team_id === teamId).map((p) => p.id));
      setSquad((prev) => [...prev.filter((id) => !njeni.has(id)), ...izbor]);
      setPoruka({ team: teamId, key: 'mdet.squadSaved' });
    } catch (e) {
      const tekst = e instanceof Error ? e.message : String(e);
      setPoruka({
        team: teamId,
        key: tekst.includes('squad_locked') ? 'mdet.squadLocked' : 'mdet.squadError',
      });
    } finally {
      setSpremam(null);
    }
  }

  /** Sastavi sliku rezultata i preuzmi je kao PNG spreman za objavu. */
  async function share() {
    setSharing(true);
    setShareErr(false);
    try {
      const svg = await buildShareCard({
        match: m,
        home,
        away,
        events: events ?? [],
        players,
        tournamentId,
        tournamentName,
        dateLabel: dayDate ? formatDayLabel(dayDate, locale) : isoToLocalHHMM(m.scheduled_time),
        groupName: null,
      });
      const naziv = `${home?.short_code ?? 'X'}-${away?.short_code ?? 'X'}-${m.home_score}-${m.away_score}`;
      await downloadCardPng(svg, `rezultat-${naziv}.png`);
    } catch {
      setShareErr(true);
    } finally {
      setSharing(false);
    }
  }

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
            {/* Uputa stoji jednom, iznad obje ekipe — dva puta ista rečenica
                samo zauzima prostor koji treba popisu igrača. */}
            {uredivo && <p className="mdet__squadhint">{t('mdet.squadHint')}</p>}

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
                        const igra = !s.id || (odabir[s.id] ?? []).includes(p.id);
                        const redak = (
                          <>
                            <span className="mdet__num">{p.number ?? '–'}</span>
                            <span className="mdet__pname">
                              {p.name}
                              {p.is_captain && <em> (K)</em>}
                            </span>
                            {g > 0 && <span className="mdet__goals">{g}</span>}
                          </>
                        );
                        // Prije početka je redak kvačica; poslije je običan
                        // popis, jer se sastav više ne mijenja.
                        return uredivo && s.id ? (
                          <li key={p.id} className={igra ? '' : 'is-out'}>
                            <label className="mdet__pick">
                              <input
                                type="checkbox"
                                checked={igra}
                                onChange={() => prekvaci(s.id!, p.id)}
                              />
                              {redak}
                            </label>
                          </li>
                        ) : (
                          <li key={p.id}>{redak}</li>
                        );
                      })}
                    </ul>
                  )}

                  {uredivo && s.id && roster(s.id).length > 0 && (
                    <div className="mdet__squadbar">
                      <Button
                        disabled={spremam === s.id}
                        onClick={() => void spremiSastav(s.id!)}
                      >
                        {spremam === s.id ? t('mdet.squadSaving') : t('mdet.squadSave')}
                      </Button>
                      {poruka?.team === s.id && <span className="mdet__hint">{t(poruka.key)}</span>}
                    </div>
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
          <Button
            disabled={sharing || m.status !== 'finished'}
            title={m.status === 'finished' ? undefined : t('mdet.shareOnlyFinished')}
            onClick={() => void share()}
          >
            {sharing ? t('mdet.sharing') : t('mdet.share')}
          </Button>
          <span className="mdet__hint">{shareErr ? t('mdet.shareError') : t('mdet.reportHint')}</span>
        </div>
      </div>
    </div>
  );
}
