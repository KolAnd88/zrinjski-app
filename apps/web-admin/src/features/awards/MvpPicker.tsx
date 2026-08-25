import { useMemo, useState } from 'react';
import type { Gender, Player, Team } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button, Card, Crest } from '../../components/ui';
import './MvpPicker.css';

/**
 * Ručni odabir najboljeg igrača / igračice turnira.
 *
 * Pokazuje SVE prijavljene igrače odabrane konkurencije, grupirane po ekipama,
 * jer organizator odluku donosi gledajući turnir, a ne tablicu golova — nagradu
 * može dobiti i vratar ili netko tko je odigrao samo dvije utakmice.
 *
 * Ovaj izbor ima prednost pred glasanjem predstavnika: glasovi ostaju
 * zabilježeni, ali zadnju riječ ima organizator.
 */
export function MvpPicker({
  gender,
  teams,
  players,
  selected,
  onSelect,
}: {
  gender: Gender;
  teams: Team[];
  players: Player[];
  selected: string | null;
  onSelect: (playerId: string | null) => Promise<void>;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const genderTeams = useMemo(
    () => teams.filter((x) => x.gender === gender).sort((a, b) => a.name.localeCompare(b.name)),
    [teams, gender]
  );

  const needle = q.trim().toLowerCase();
  const groups = useMemo(
    () =>
      genderTeams
        .map((team) => ({
          team,
          players: players
            .filter((p) => p.team_id === team.id)
            .filter(
              (p) =>
                !needle ||
                p.name.toLowerCase().includes(needle) ||
                team.name.toLowerCase().includes(needle)
            )
            .sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
        }))
        .filter((g) => g.players.length > 0),
    [genderTeams, players, needle]
  );

  const total = groups.reduce((n, g) => n + g.players.length, 0);
  const chosen = selected ? players.find((p) => p.id === selected) ?? null : null;
  const chosenTeam = chosen ? teams.find((x) => x.id === chosen.team_id) : undefined;

  async function pick(id: string | null) {
    setBusy(true);
    try {
      await onSelect(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mvpp__head">
        <div>
          <h2 className="section-label" style={{ margin: 0 }}>
            {gender === 'm' ? t('mvpp.titleM') : t('mvpp.titleZ')}
          </h2>
          <p className="mvpp__hint">{t('mvpp.hint')}</p>
        </div>
        {chosen && (
          <Button disabled={busy} onClick={() => void pick(null)}>
            {t('mvpp.clear')}
          </Button>
        )}
      </div>

      {chosen && (
        <div className="mvpp__chosen">
          <Crest
            code={chosenTeam?.short_code}
            index={chosenTeam?.sort_order ?? 0}
            logoUrl={chosenTeam?.logo_url}
            size={40}
          />
          <div className="mvpp__chosenmain">
            <div className="mvpp__chosenname">
              {chosen.number ? `${chosen.number}. ` : ''}
              {chosen.name}
            </div>
            <div className="mvpp__chosenteam">{chosenTeam?.name}</div>
          </div>
          <span className="mvpp__badge">{t('mvpp.chosen')}</span>
        </div>
      )}

      <input
        className="input mvpp__search"
        value={q}
        placeholder={t('mvpp.search')}
        onChange={(e) => setQ(e.target.value)}
      />

      {total === 0 ? (
        <p className="mvpp__empty">{needle ? t('mvpp.noMatch') : t('mvpp.noPlayers')}</p>
      ) : (
        <>
          <div className="mvpp__count">{t('mvpp.count', { n: total })}</div>
          <div className="mvpp__list">
            {groups.map((g) => (
              <div key={g.team.id}>
                <div className="mvpp__team">
                  <Crest
                    code={g.team.short_code}
                    index={g.team.sort_order}
                    logoUrl={g.team.logo_url}
                    size={20}
                  />
                  {g.team.name}
                </div>
                {g.players.map((p) => (
                  <button
                    key={p.id}
                    className={`mvpp__row ${p.id === selected ? 'is-on' : ''}`}
                    disabled={busy}
                    onClick={() => void pick(p.id)}
                  >
                    <span className="mvpp__num">{p.number ?? '–'}</span>
                    <span className="mvpp__name">
                      {p.name}
                      {p.is_captain && <em> (K)</em>}
                    </span>
                    {p.id === selected && <span className="mvpp__tick">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
