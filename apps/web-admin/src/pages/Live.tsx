import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { EventType, Match, Player } from '@zrinjski/core';
import { clockRunning, clockSeconds, formatClock, timeoutLeft, timeoutsUsed } from '@zrinjski/core';
import { crestColorFor } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import type { StringKey } from '../i18n/strings';
import { Button, Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useEnterableMatches } from '../features/live/useEnterableMatches';
import { useLiveMatch, type LiveTeam } from '../features/live/useLiveMatch';
import { shiftScheduleFrom } from '../lib/data';
import { isoToLocalHHMM } from '../lib/timeFormat';
import './Live.css';

const EVENT_TYPES: { type: EventType; key: StringKey }[] = [
  { type: 'goal', key: 'live.ev.goal' },
  { type: 'save', key: 'live.ev.save' },
  { type: 'red_card', key: 'live.ev.red' },
  { type: 'suspension_2min', key: 'live.ev.susp' },
];
const EVENT_LABEL: Record<EventType, StringKey> = {
  goal: 'live.ev.goal',
  save: 'live.ev.save',
  red_card: 'live.ev.red',
  suspension_2min: 'live.ev.susp',
};

/**
 * Sat se računa iz stanja u bazi (core/clock), ne broji se na ekranu. Ovdje
 * samo kucka sekunda da se prikaz osvježava; zaustavljen sat pokazuje isto.
 */
function useLiveClock(match: Match | null) {
  const [now, setNow] = useState(() => Date.now());
  const live = match?.status === 'live';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  if (!match) return { minute: 0, running: false, mmss: '00:00', timeoutLeft: null };
  const sec = clockSeconds(match, now);
  return {
    minute: Math.floor(sec / 60),
    running: clockRunning(match),
    mmss: formatClock(sec),
    timeoutLeft: timeoutLeft(match, now),
  };
}

/**
 * Sudar grbova: boje se dodjeljuju po indeksu i ponavljaju se, pa dvije ekipe
 * mogu dobiti istu boju. Upozorenje je za zapisničara (grbovi izgledaju isto),
 * ne za stvarne dresove — te provjerava delegat na terenu.
 */
function crestClash(a: number | undefined, b: number | undefined): boolean {
  if (a == null || b == null) return false;
  return crestColorFor(a) === crestColorFor(b);
}

/**
 * Pauza, nastavak i time-out. Gumb „Nastavi” je velik i crven dok sat stoji —
 * zaboravljen zaustavljen sat je najčešća greška zapisničara.
 */
function ClockControls({
  clock,
  timeoutTeam,
  teams,
  used,
  onPause,
  onResume,
  onTimeout,
}: {
  clock: ReturnType<typeof useLiveClock>;
  timeoutTeam: LiveTeam | null;
  teams: (LiveTeam | null)[];
  used: (teamId: string) => number;
  onPause: () => void;
  onResume: () => void;
  onTimeout: (teamId: string) => void;
}) {
  const { t } = useT();
  const inTimeout = clock.timeoutLeft !== null;
  return (
    <div className="live__clockctl">
      {inTimeout ? (
        <div className={`live__timeout ${clock.timeoutLeft === 0 ? 'is-over' : ''}`}>
          <span>{t('live.timeoutRunning', { team: timeoutTeam?.name ?? '—' })}</span>
          <span className="live__timeout-left">{formatClock(clock.timeoutLeft ?? 0)}</span>
          {clock.timeoutLeft === 0 && <span className="live__timeout-hint">{t('live.timeoutOver')}</span>}
        </div>
      ) : (
        !clock.running && <p className="live__hint">{t('live.pausedHint')}</p>
      )}

      {clock.running ? (
        <Button variant="secondary" onClick={onPause}>
          {t('live.pause')}
        </Button>
      ) : (
        <Button variant="primary" onClick={onResume}>
          {t('live.resume')}
        </Button>
      )}

      <div className="live__timeouts">
        {teams.map((team) =>
          team ? (
            <button
              key={team.id}
              type="button"
              className="live__tobtn"
              disabled={inTimeout}
              onClick={() => onTimeout(team.id)}
            >
              <span className="live__tobtn-main">
                {t('live.timeout')} · {team.short_code || team.name}
              </span>
              <span className="live__tobtn-sub">{t('live.timeoutUsed', { n: used(team.id) })}</span>
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}

function Roster({
  team,
  onPlus,
  canEnter,
}: {
  team: LiveTeam | null;
  onPlus: (player: Player) => void;
  /** Bez pokrenute utakmice nema unosa — gumbi su ugaseni, ne skriveni. */
  canEnter: boolean;
}) {
  const { t } = useT();
  if (!team) return <Card>{t('live.teamUnknown')}</Card>;
  return (
    <div className="roster">
      <div className="roster__head" style={{ background: crestColorFor(team.sort_order) }}>
        <Crest code={team.short_code} index={team.sort_order} logoUrl={team.logo_url} size={28} />
        <span className="roster__name">{team.name}</span>
      </div>
      {team.players.length === 0 ? (
        <div className="roster__empty">{t('live.noPlayers')}</div>
      ) : (
        team.players.map((p) => (
          <div key={p.id} className="proster">
            <span className="proster__num">{p.number ?? '–'}</span>
            <span className="proster__name">{p.name}</span>
            <button
              className="proster__plus"
              disabled={!canEnter}
              onClick={() => onPlus(p)}
              aria-label="+"
            >
              +
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function MatchPicker({ tournamentId }: { tournamentId: string | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { loading, matches, teamsById } = useEnterableMatches(tournamentId);

  const sideName = (id: string | null, ph: string | null) =>
    (id && teamsById.get(id)?.name) || ph || '—';

  if (loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  return (
    <Card style={{ maxWidth: 720 }}>
      <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
        {t('live.pickMatch')}
      </h2>
      {matches.length === 0 ? (
        <div style={{ color: 'var(--sub)' }}>{t('live.noMatches')}</div>
      ) : (
        <div className="picker">
          {matches.map((m) => (
            <button key={m.id} className="picker__row" onClick={() => navigate(`/live?match=${m.id}`)}>
              <span className="picker__time">{isoToLocalHHMM(m.scheduled_time) || '—'}</span>
              <span className="picker__teams">
                {sideName(m.home_team_id, m.home_placeholder)} – {sideName(m.away_team_id, m.away_placeholder)}
              </span>
              {m.status === 'live' && <span className="badge picker__live">{t('live.live')}</span>}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Scorer({ matchId, tournamentId }: { matchId: string; tournamentId: string | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  // Uloga se dohvaća ODMAH, uz ostale kuke. Ranije je stajala ispod ranih
  // izlaza (učitavanje, greška, nema utakmice), pa se u tim prolazima nije ni
  // pozvala — React je vidio 41 pa 42 kuke i javljao promjenu redoslijeda.
  // To je pravilo React-a, ne stilska sitnica: nesklad veže stanje jedne kuke
  // na drugu i ruši upravo ovaj ekran, na kojem se vodi utakmica.
  const { role } = useAuth();
  const live = useLiveMatch(matchId);
  const enterable = useEnterableMatches(tournamentId);
  const clock = useLiveClock(live.match);
  const [selectedType, setSelectedType] = useState<EventType>('goal');
  const [delayMsg, setDelayMsg] = useState<string | null>(null);
  const [delayBusy, setDelayBusy] = useState(false);

  async function handleDelay(minutes: number) {
    setDelayBusy(true);
    try {
      const moved = await shiftScheduleFrom(matchId, minutes, t('live.delayNotif', { n: minutes }));
      setDelayMsg(moved > 0 ? t('live.delayDone', { n: minutes, m: moved }) : t('live.delayNone'));
      await enterable.reload();
      setTimeout(() => setDelayMsg(null), 4000);
    } finally {
      setDelayBusy(false);
    }
  }

  // Sinkroniziraj minutu na bazu (jednom po minuti) dok je uživo.
  useEffect(() => {
    if (clock.running) void live.persistMinute(clock.minute);
  }, [clock.minute, clock.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const playerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of [...(live.home?.players ?? []), ...(live.away?.players ?? [])]) map.set(p.id, p.name);
    return map;
  }, [live.home, live.away]);

  if (!live.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (live.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (live.error) return <Card accent style={{ maxWidth: 560 }}>{live.error}</Card>;
  if (!live.match) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <Button onClick={() => navigate('/live')}>{t('live.backToList')}</Button>
      </Card>
    );
  }

  const m = live.match;
  const isLive = m.status === 'live';
  // Unos traje dok i utakmica. Prije pocetka ne moze nitko; nakon zavrsetka
  // samo admin, da se rezultat moze ispraviti.
  const canEnter = isLive || (m.status === 'finished' && role === 'admin');
  const clash = crestClash(live.home?.sort_order, live.away?.sort_order);
  const recentFeed = [...live.feed].reverse().slice(0, 5);
  const nextMatches = enterable.matches.filter((x) => x.id !== matchId).slice(0, 3);

  function handlePlus(teamId: string, player: Player) {
    void live.addEvent(teamId, player.id, selectedType, clock.minute);
  }

  return (
    <div className="live">
      {/* Lijevi stupac: kontrola */}
      <div className="live__control">
        <Card accent={isLive}>
          <div className="live__status">
            <span className={`badge ${isLive && clock.running ? 'live__livebadge' : 'live__schedbadge'}`}>
              {isLive
                ? clock.running
                  ? `● ${t('live.live')}`
                  : t('live.pausedBadge')
                : m.status === 'finished'
                  ? t('live.finishedBadge')
                  : t('live.scheduledBadge')}
            </span>
            <span className="live__clock">{isLive ? clock.mmss : isoToLocalHHMM(m.scheduled_time)}</span>
          </div>

          <div className="live__scorerow">
            <div className="live__side">
              <Crest code={live.home?.short_code} index={live.home?.sort_order} logoUrl={live.home?.logo_url} size={56} />
              <span className="live__sidename">{live.home?.name ?? '—'}</span>
            </div>
            <div className="live__score">
              {m.home_score} : {m.away_score}
            </div>
            <div className="live__side live__side--away">
              <span className="live__sidename">{live.away?.name ?? '—'}</span>
              <Crest code={live.away?.short_code} index={live.away?.sort_order} logoUrl={live.away?.logo_url} size={56} />
            </div>
          </div>


          {isLive && (
            <ClockControls
              clock={clock}
              timeoutTeam={
                m.timeout_team_id === live.home?.id ? live.home : m.timeout_team_id === live.away?.id ? live.away : null
              }
              teams={[live.home, live.away]}
              used={(id) => timeoutsUsed(m, id)}
              onPause={() => void live.pause()}
              onResume={() => void live.resume()}
              onTimeout={(id) => void live.timeout(id)}
            />
          )}

          <div className="live__startfinish">
            <Button variant="primary" disabled={m.status !== 'scheduled'} onClick={() => void live.start()}>
              {t('live.start')}
            </Button>
            <Button variant="secondary" disabled={!isLive} onClick={() => void live.finish()}>
              {t('live.finish')}
            </Button>
          </div>
        </Card>

        {/* Najbolji igrač — ima smisla tek kad je utakmica odigrana. */}
        {m.status === 'finished' && (
          <Card>
            <h3 className="section-label" style={{ marginBottom: 'var(--sp-sm)' }}>
              {t('live.bestPlayer')}
            </h3>
            <select
              className="input"
              value={m.best_player_id ?? ''}
              onChange={(e) => void live.setBestPlayer(e.target.value || null)}
            >
              <option value="">{t('live.bestPlayerNone')}</option>
              {[live.home, live.away].map(
                (tm) =>
                  tm && (
                    <optgroup key={tm.id} label={tm.name}>
                      {tm.players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.number != null ? p.number + '. ' : ''}
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )
              )}
            </select>
            <p className="live__hint">{t('live.bestPlayerHint')}</p>
          </Card>
        )}

        <Card>
          <div className="live__tvline">
            <span>{t('live.tvMode')}</span>
            <button className="btn-link" onClick={() => navigate(`/tv?match=${matchId}`)}>
              {t('live.open')} →
            </button>
          </div>
          {/* Zapisnik za ispis i potpis — otvara se u istoj kartici. */}
          <div className="live__tvline">
            <span>{t('report.open')}</span>
            <button className="btn-link" onClick={() => navigate(`/zapisnik?match=${matchId}`)}>
              {t('live.open')} →
            </button>
          </div>
        </Card>

        <div className={`live__jersey ${clash ? 'is-clash' : 'is-ok'}`}>
          ● {t('live.jersey')} — {clash ? t('live.jerseyClash') : t('live.jerseyOk')}
        </div>

        {/* Kašnjenje uživo → pomak satnice (spec: sve kasnije utakmice se pomiču + obavijest) */}
        <Card>
          <h3 className="section-label" style={{ marginBottom: 'var(--sp-sm)' }}>
            {t('live.delay')}
          </h3>
          <div className="live__delay">
            {[5, 10, 15].map((min) => (
              <Button key={min} disabled={delayBusy || !m.day_id} onClick={() => void handleDelay(min)}>
                +{min} min
              </Button>
            ))}
          </div>
          {delayMsg && <div className="banner banner--ok" style={{ marginTop: 'var(--sp-sm)' }}>{delayMsg}</div>}
        </Card>

        {/* Vrsta događaja */}
        <Card>
          <h3 className="section-label" style={{ marginBottom: 'var(--sp-sm)' }}>
            {t('live.eventType')}
          </h3>
          <div className="live__events">
            {EVENT_TYPES.map((e) => (
              <button
                key={e.type}
                className={`evchip ${selectedType === e.type ? 'is-on' : ''}`}
                onClick={() => setSelectedType(e.type)}
              >
                {t(e.key)}
              </button>
            ))}
          </div>
        </Card>

        {nextMatches.length > 0 && (
          <Card>
            <h3 className="section-label" style={{ marginBottom: 'var(--sp-sm)' }}>
              {t('live.next')}
            </h3>
            <div className="live__next">
              {nextMatches.map((nm) => (
                <button key={nm.id} className="live__next-row" onClick={() => navigate(`/live?match=${nm.id}`)}>
                  <span>{isoToLocalHHMM(nm.scheduled_time) || '—'}</span>
                  <span>
                    {(nm.home_team_id && enterable.teamsById.get(nm.home_team_id)?.name) || nm.home_placeholder || '—'}
                    {' – '}
                    {(nm.away_team_id && enterable.teamsById.get(nm.away_team_id)?.name) || nm.away_placeholder || '—'}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Srednji stupac. Poruke moraju biti UNUTAR njega: kao zasebna djeca
          mreze zauzele bi srednji stupac i gurnule sastave u uski desni. */}
      <div className="live__middle">
        {!canEnter && (
          <div className="banner">
            {m.status === 'finished' ? t('live.finishedLocked') : t('live.notStarted')}
          </div>
        )}

        {/* Admin smije ispravljati odigranu utakmicu, ali dosad nije bilo nikakve
            naznake da mijenja objavljen rezultat — sastavi su izgledali isto kao
            uživo. Rezultat je vec na korisnickim uredajima i na slici za mreze. */}
        {canEnter && m.status === 'finished' && (
          <div className="banner banner--info">{t('live.finishedEditing')}</div>
        )}

        {/* Sastavi */}
        <div className="live__rosters">
          <Roster team={live.home} canEnter={canEnter} onPlus={(p) => live.home && handlePlus(live.home.id, p)} />
          <Roster team={live.away} canEnter={canEnter} onPlus={(p) => live.away && handlePlus(live.away.id, p)} />
        </div>
      </div>

      {/* Tijek uživo */}
      <div className="live__feed">
        <div className="live__feed-head">
          <h3 className="section-label">
            {t('live.feed')} · {t('live.feedLast')}
          </h3>
          <button className="btn-link" disabled={live.events.length === 0} onClick={() => void live.undoLast()}>
            {t('live.undo')}
          </button>
        </div>
        <div className="feedlist">
          {recentFeed.map((f) => (
            <div key={f.event.id} className="feedrow">
              <span className="feedrow__min">{f.event.minute}'</span>
              <span className={`feedrow__type feedrow__type--${f.event.type}`}>{t(EVENT_LABEL[f.event.type])}</span>
              <span className="feedrow__player">{f.event.player_id ? playerName.get(f.event.player_id) ?? '—' : '—'}</span>
              <span className="feedrow__score">
                {f.homeScore}:{f.awayScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Live() {
  const tournament = useTournamentData();
  const [params] = useSearchParams();
  const matchId = params.get('match');
  const tId = tournament.tournament?.id ?? null;

  if (!tournament.configured) {
    return <PickerOrNotConfigured />;
  }
  return matchId ? <Scorer matchId={matchId} tournamentId={tId} /> : <MatchPicker tournamentId={tId} />;
}

function PickerOrNotConfigured() {
  const { t } = useT();
  return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
}
