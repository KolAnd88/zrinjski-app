import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Match, MatchEvent, Player, Team, Tournament } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import {
  fetchActiveTournament,
  fetchEvents,
  fetchMatch,
  fetchPlayers,
  fetchTeam,
} from '../lib/data';
import { isoToLocalHHMM } from '../lib/timeFormat';
import { formatDayLabel } from '../i18n/dateLabels';
import './MatchReport.css';

const STAGE: Record<string, string> = {
  group: 'Grupa',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
};

const EVENT_LABEL: Record<string, string> = {
  goal: 'Gol',
  save: 'Obrana',
  suspension_2min: "Isključenje 2'",
  red_card: 'Crveni karton',
};

type Side = { team: Team | null; players: Player[] };

/**
 * Službeni zapisnik utakmice za ispis i potpis.
 *
 * Namjerno je obična stranica, a ne PDF iz knjižnice: preglednikov dijalog za
 * ispis nudi i "Spremi kao PDF", pa jedan ekran pokriva i papir i datoteku.
 * Ispisni stil je crno na bijelom — tamna tema bi potrošila pola patrone.
 */
export function MatchReport() {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get('match');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<Side>({ team: null, players: [] });
  const [away, setAway] = useState<Side>({ team: null, players: [] });
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [tr, m] = await Promise.all([fetchActiveTournament(), fetchMatch(matchId)]);
        if (!active) return;
        setTournament(tr);
        setMatch(m);
        if (!m) return;

        const [ht, at, ev] = await Promise.all([
          m.home_team_id ? fetchTeam(m.home_team_id) : Promise.resolve(null),
          m.away_team_id ? fetchTeam(m.away_team_id) : Promise.resolve(null),
          fetchEvents(matchId),
        ]);
        const [hp, ap] = await Promise.all([
          m.home_team_id ? fetchPlayers(m.home_team_id) : Promise.resolve([]),
          m.away_team_id ? fetchPlayers(m.away_team_id) : Promise.resolve([]),
        ]);
        if (!active) return;
        setHome({ team: ht, players: hp });
        setAway({ team: at, players: ap });
        setEvents(ev);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  if (loading) return <div className="report__msg">{t('common.loading')}</div>;
  if (!match) return <div className="report__msg">{t('common.empty')}</div>;

  /** Broj golova po igraču — zapisnik mora pokazati tko je zabio koliko. */
  const goalsOf = (playerId: string) =>
    events.filter((e) => e.type === 'goal' && e.player_id === playerId).length;

  /** Kartoni i isključenja po igraču, kao kratke oznake. */
  const marksOf = (playerId: string) =>
    events
      .filter((e) => e.player_id === playerId && e.type !== 'goal' && e.type !== 'save')
      .map((e) => (e.type === 'red_card' ? 'C' : "2'"))
      .join(' ');

  const playerName = (id: string | null) =>
    [...home.players, ...away.players].find((p) => p.id === id)?.name ?? '—';

  const teamShort = (id: string) =>
    id === home.team?.id ? home.team?.short_code ?? '' : away.team?.short_code ?? '';

  // Po minuti utakmice, ne po vremenu upisa — zakasnjeli unos inace zavrsi
  // na krivom mjestu u zapisniku.
  const ordered = [...events].sort(
    (a, b) => a.minute - b.minute || a.created_at.localeCompare(b.created_at)
  );

  const Roster = ({ side }: { side: Side }) => (
    <table className="report__roster">
      <thead>
        <tr>
          <th className="c-num">Br.</th>
          <th>Igrač</th>
          <th className="c-num">Gol</th>
          <th className="c-num">Kazne</th>
        </tr>
      </thead>
      <tbody>
        {side.players.length === 0 ? (
          <tr>
            <td colSpan={4} className="report__empty">
              —
            </td>
          </tr>
        ) : (
          side.players.map((p) => (
            <tr key={p.id}>
              <td className="c-num">{p.number ?? ''}</td>
              <td>
                {p.name}
                {p.is_captain && <span className="report__cap"> (K)</span>}
              </td>
              <td className="c-num">{goalsOf(p.id) || ''}</td>
              <td className="c-num">{marksOf(p.id)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="report">
      {/* Traka s akcijama — ne ide na papir */}
      <div className="report__bar">
        <button className="btn btn--secondary" onClick={() => navigate(-1)}>
          ← {t('common.back')}
        </button>
        <button className="btn btn--primary" onClick={() => window.print()}>
          {t('report.print')}
        </button>
        <span className="report__barhint">{t('report.saveHint')}</span>
      </div>

      <div className="report__sheet">
        <header className="report__head">
          <div>
            <div className="report__cup">{tournament?.name ?? ''}</div>
            <div className="report__sub">
              {STAGE[match.stage] ?? match.stage}
              {' · '}
              {match.gender === 'm' ? 'Muška konkurencija' : 'Ženska konkurencija'}
            </div>
          </div>
          <div className="report__meta">
            <div>{match.scheduled_time ? formatDayLabel(match.scheduled_time.slice(0, 10), locale) : ''}</div>
            <div>{isoToLocalHHMM(match.scheduled_time)}</div>
          </div>
        </header>

        <div className="report__score">
          <div className="report__teamname">{home.team?.name ?? match.home_placeholder ?? '—'}</div>
          <div className="report__result">
            {match.home_score} : {match.away_score}
          </div>
          <div className="report__teamname report__teamname--right">
            {away.team?.name ?? match.away_placeholder ?? '—'}
          </div>
        </div>

        <div className="report__cols">
          <section>
            <h2 className="report__h2">{home.team?.name ?? '—'}</h2>
            <Roster side={home} />
          </section>
          <section>
            <h2 className="report__h2">{away.team?.name ?? '—'}</h2>
            <Roster side={away} />
          </section>
        </div>

        <section className="report__flow">
          <h2 className="report__h2">{t('report.timeline')}</h2>
          {ordered.length === 0 ? (
            <div className="report__empty">{t('report.noEvents')}</div>
          ) : (
            <table className="report__events">
              <thead>
                <tr>
                  <th className="c-num">Min</th>
                  <th className="c-num">Ekipa</th>
                  <th>Događaj</th>
                  <th>Igrač</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e) => (
                  <tr key={e.id}>
                    <td className="c-num">{e.minute}'</td>
                    <td className="c-num">{teamShort(e.team_id)}</td>
                    <td>{EVENT_LABEL[e.type] ?? e.type}</td>
                    <td>{playerName(e.player_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Potpisi — prazne crte, popunjavaju se rukom */}
        <section className="report__sigs">
          {[t('report.sigDelegate'), t('report.sigHome'), t('report.sigAway')].map((label) => (
            <div key={label} className="report__sig">
              <div className="report__sigline" />
              <div className="report__siglabel">{label}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
