import { useEffect, useState } from 'react';
import type { Player, Team } from '@zrinjski/core';
import { eligibleCandidates } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button, Card } from '../../components/ui';
import {
  castMyMvpVote,
  fetchActiveTournament,
  fetchMvpResults,
  fetchMyMvpVote,
  fetchPlayersByTeams,
  fetchTeams,
  MvpVoteFailed,
} from '../../lib/data';
import './MvpVoteCard.css';

/**
 * Glasanje predstavnika za najboljeg igrača turnira.
 *
 * Vlastita ekipa namjerno nije u izborniku, a i da netko zaobiđe sučelje,
 * baza odbija takav glas (cast_my_mvp_vote → vote_own_team). Rezultat se
 * ovdje ne prikazuje dok je glasanje otvoreno — baza ga ni ne vrati.
 */
export function MvpVoteCard({ team }: { team: Team }) {
  const { t } = useT();
  const [open, setOpen] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [vote, setVote] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const tour = await fetchActiveTournament();
      if (!tour || !alive) return;
      const list = await fetchTeams(tour.id, team.gender);
      const ps = list.length ? await fetchPlayersByTeams(list.map((x) => x.id)) : [];
      const mine = await fetchMyMvpVote().catch(() => null);
      if (!alive) return;
      setOpen(tour.mvp_voting_open);
      setTeams(list);
      setPlayers(ps);
      setVote(mine);
      setChoice(mine ?? '');

      // Zatvoreno glasanje = rezultat je javan, pa pokaži pobjednika.
      if (!tour.mvp_voting_open) {
        const rows = await fetchMvpResults().catch(() => []);
        const best = rows.filter((r) => r.gender === team.gender).sort((a, b) => b.votes - a.votes)[0];
        if (alive && best) setWinnerName(ps.find((p) => p.id === best.player_id)?.name ?? null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [team.id, team.gender]);

  if (open === null) return null;

  const candidates = eligibleCandidates(players, teams, team.gender, team.id);
  const byTeam = teams
    .filter((x) => x.id !== team.id)
    .map((x) => ({ team: x, players: candidates.filter((p) => p.team_id === x.id) }))
    .filter((g) => g.players.length > 0);

  const votedName = vote ? players.find((p) => p.id === vote)?.name ?? null : null;

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setErr(null);
    try {
      await castMyMvpVote(choice);
      setVote(choice);
      setFlash(t('mvp.thanks'));
      setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      const code = e instanceof MvpVoteFailed ? e.code : null;
      setErr(
        t(
          code === 'closed'
            ? 'mvp.errClosed'
            : code === 'not_a_rep'
              ? 'mvp.errNotRep'
              : code === 'own_team'
                ? 'mvp.errOwnTeam'
                : code === 'other_gender'
                  ? 'mvp.errOtherGender'
                  : 'rep.saveError'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // Glasanje zatvoreno — nema više izbora, samo ishod.
  if (!open) {
    return (
      <Card>
        <h2 className="section-label" style={{ margin: 0 }}>
          {t('mvp.title')}
        </h2>
        <p className="mvp__hint">
          {winnerName
            ? t('mvp.winnerIs', { name: winnerName })
            : votedName
              ? t('mvp.closedYouVoted', { name: votedName })
              : t('mvp.closedNoVote')}
        </p>
      </Card>
    );
  }

  return (
    <Card accent={!vote}>
      <h2 className="section-label" style={{ margin: 0 }}>
        {t('mvp.title')}
      </h2>
      <p className="mvp__hint">{t('mvp.hint')}</p>

      {flash && <div className="banner banner--ok" style={{ marginBottom: 'var(--sp-md)' }}>{flash}</div>}
      {err && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{err}</div>}

      {byTeam.length === 0 ? (
        <p className="mvp__hint">{t('mvp.noCandidates')}</p>
      ) : (
        <>
          <div className="mvp__row">
            <select className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">{t('mvp.pick')}</option>
              {byTeam.map((g) => (
                <optgroup key={g.team.id} label={g.team.name}>
                  {g.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number ? `${p.number}. ` : ''}
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Button variant="primary" disabled={busy || !choice || choice === vote} onClick={() => void submit()}>
              {vote ? t('mvp.change') : t('mvp.submit')}
            </Button>
          </div>
          {votedName && <p className="mvp__voted">{t('mvp.yourVote', { name: votedName })}</p>}
        </>
      )}
    </Card>
  );
}
