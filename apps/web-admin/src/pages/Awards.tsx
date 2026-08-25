import { useCallback, useEffect, useState } from 'react';
import type { Gender, Match, MatchEvent, Player, Team, Tournament } from '@zrinjski/core';
import { rankByEvent, winnerOf, type StatRow } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Button, Card, Crest } from '../components/ui';
import {
  fetchActiveTournament,
  fetchAllTeams,
  fetchEvents,
  fetchFinishedMatches,
  fetchMvpResults,
  fetchPlayersByTeams,
  updateTournament,
  type MvpResult,
} from '../lib/data';
import './Awards.css';

type Loaded = {
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  results: MvpResult[];
};

/**
 * Nagrade turnira.
 *
 * Golman i strijelac su izračun iz odigranih utakmica — organizator ih ne
 * upisuje, samo pročita. Najbolji igrač dolazi iz glasova predstavnika, a
 * dok je glasanje otvoreno brojke vidi jedino admin (mvp_results u bazi).
 */
export function Awards() {
  const { t } = useT();
  const [data, setData] = useState<Loaded | null>(null);
  const [gender, setGender] = useState<Gender>('m');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const tour = await fetchActiveTournament();
    if (!tour) return;
    const [teams, matches, results] = await Promise.all([
      fetchAllTeams(tour.id),
      fetchFinishedMatches(tour.id),
      fetchMvpResults().catch(() => [] as MvpResult[]),
    ]);
    const players = teams.length ? await fetchPlayersByTeams(teams.map((x) => x.id)) : [];
    // Događaji se čitaju po utakmici; nagrade se ionako gledaju tek pred kraj
    // turnira pa je nekoliko desetaka upita prihvatljivo.
    const events = (await Promise.all(matches.map((m) => fetchEvents(m.id)))).flat();
    setData({ tournament: tour, teams, players, matches, events, results });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <Card>{t('common.loading')}</Card>;

  const { tournament, teams, players, matches, events, results } = data;

  const matchIds = new Set(matches.filter((m) => m.gender === gender).map((m) => m.id));
  const genderEvents = events.filter((e) => matchIds.has(e.match_id));
  const genderTeamIds = new Set(teams.filter((x) => x.gender === gender).map((x) => x.id));
  const genderPlayerIds = new Set(players.filter((p) => genderTeamIds.has(p.team_id)).map((p) => p.id));

  // Baza već vraća zbrojene glasove, pa ih samo rangiramo u isti oblik
  // kakav ima statistika — da ista kartica prikaže i glasove i golove.
  const voteRows: StatRow[] = results
    .filter((r) => r.gender === gender)
    .map((r) => ({ playerId: r.player_id, count: r.votes, rank: 0 }))
    .sort((a, b) => b.count - a.count || a.playerId.localeCompare(b.playerId))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const scorerRows = rankByEvent(genderEvents, 'scorers');
  const keeperRows = rankByEvent(genderEvents, 'goalkeepers');

  const info = (playerId: string) => {
    const p = players.find((x) => x.id === playerId);
    const team = p ? teams.find((x) => x.id === p.team_id) : undefined;
    return { name: p?.name ?? '—', number: p?.number ?? null, team };
  };

  async function toggleVoting() {
    setBusy(true);
    try {
      await updateTournament(tournament.id, { mvp_voting_open: !tournament.mvp_voting_open });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const totalVotes = results.filter((r) => r.gender === gender).reduce((n, r) => n + r.votes, 0);
  const voterCount = teams.filter((x) => x.gender === gender).length;

  return (
    <div className="awards">
      <Card accent={tournament.mvp_voting_open}>
        <div className="awards__votehead">
          <div>
            <h2 className="section-label" style={{ margin: 0 }}>
              {t('awards.votingTitle')}
            </h2>
            <p className="awards__hint">
              {tournament.mvp_voting_open ? t('awards.votingOpenHint') : t('awards.votingClosedHint')}
            </p>
          </div>
          <Button
            variant={tournament.mvp_voting_open ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={() => void toggleVoting()}
          >
            {tournament.mvp_voting_open ? t('awards.closeVoting') : t('awards.openVoting')}
          </Button>
        </div>
      </Card>

      <div className="awards__genders">
        {(['m', 'z'] as const).map((g) => (
          <button
            key={g}
            className={`awards__gender ${gender === g ? 'is-on' : ''}`}
            onClick={() => setGender(g)}
          >
            {g === 'm' ? t('teams.men') : t('teams.women')}
          </button>
        ))}
      </div>

      <div className="awards__grid">
        <AwardCard
          title={t('awards.mvp')}
          note={t('awards.mvpNote', { n: totalVotes, total: voterCount })}
          unit={t('awards.unitVotes')}
          rows={voteRows}
          info={info}
          gold
        />
        <AwardCard
          title={t('awards.keeper')}
          note={t('awards.keeperNote')}
          unit={t('awards.unitSaves')}
          rows={keeperRows.filter((r) => genderPlayerIds.has(r.playerId))}
          info={info}
        />
        <AwardCard
          title={t('awards.scorer')}
          note={t('awards.scorerNote')}
          unit={t('awards.unitGoals')}
          rows={scorerRows.filter((r) => genderPlayerIds.has(r.playerId))}
          info={info}
        />
      </div>
    </div>
  );
}

function AwardCard({
  title,
  note,
  unit,
  rows,
  info,
  gold,
}: {
  title: string;
  note: string;
  unit: string;
  rows: StatRow[];
  info: (id: string) => { name: string; number: number | null; team?: Team };
  gold?: boolean;
}) {
  const { t } = useT();
  const winner = winnerOf(rows);

  return (
    <Card>
      <h2 className="section-label" style={{ margin: 0 }}>
        {title}
      </h2>
      <p className="awards__hint">{note}</p>

      {!winner ? (
        <p className="awards__empty">{t('awards.empty')}</p>
      ) : (
        <>
          <div className={`awards__winner ${gold ? 'is-gold' : ''}`}>
            <Crest
              code={info(winner.playerId).team?.short_code}
              index={info(winner.playerId).team?.sort_order ?? 0}
              logoUrl={info(winner.playerId).team?.logo_url}
              size={40}
            />
            <div className="awards__winnermain">
              <div className="awards__winnername">{info(winner.playerId).name}</div>
              <div className="awards__winnerteam">{info(winner.playerId).team?.name}</div>
            </div>
            <div className="awards__winnerval">
              {winner.count}
              <span>{unit}</span>
            </div>
          </div>
          {winner.tied.length > 1 && (
            <p className="awards__tie">{t('awards.tie', { n: winner.tied.length })}</p>
          )}

          <div className="awards__rest">
            {rows.slice(1, 6).map((r) => (
              <div key={r.playerId} className="awards__row">
                <span className="awards__rank">{r.rank}</span>
                <span className="awards__name">{info(r.playerId).name}</span>
                <span className="awards__team">{info(r.playerId).team?.name}</span>
                <span className="awards__val">{r.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
