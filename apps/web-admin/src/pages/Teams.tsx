import { useEffect, useMemo, useState } from 'react';
import type { Gender } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Button, Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useTeamsData } from '../features/teams/useTeamsData';
import { TeamEditor } from '../features/teams/TeamEditor';
import './Teams.css';

export function Teams() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = useTeamsData(tournament.tournament?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingName, setAddingName] = useState('');
  const [genMsg, setGenMsg] = useState<string | null>(null);

  // Promjena spola → očisti selekciju.
  useEffect(() => {
    setSelectedId(null);
  }, [data.gender]);

  const selectedTeam = useMemo(
    () => data.teams.find((tm) => tm.id === selectedId) ?? null,
    [data.teams, selectedId]
  );
  const selectedPlayers = useMemo(
    () =>
      selectedId
        ? data.players
            .filter((p) => p.team_id === selectedId)
            .sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [data.players, selectedId]
  );

  const groupName = (id: string | null) =>
    id ? (data.groups.find((g) => g.id === id)?.name ?? '') : '';

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (data.error) return <Card accent style={{ maxWidth: 560 }}>{data.error}</Card>;
  if (!tournament.tournament) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;

  async function handleAddTeam() {
    if (!addingName.trim()) return;
    const team = await data.addTeam(addingName.trim());
    setAddingName('');
    setSelectedId(team.id);
  }

  function handleAddGroup() {
    const name = window.prompt(t('teams.groupNamePrompt'));
    if (name && name.trim()) void data.addGroup(name.trim());
  }

  async function handleGenerate() {
    setGenMsg(null);
    const { created, skipped } = await data.generateGroupMatches(tournament.days);
    setGenMsg(t('teams.genMatchesDone', { created, skipped }));
    setTimeout(() => setGenMsg(null), 4000);
  }

  const genderBtn = (g: Gender, label: string) => (
    <button
      className={`gender-toggle__btn ${data.gender === g ? 'is-active' : ''}`}
      onClick={() => data.setGender(g)}
    >
      {label}
    </button>
  );

  return (
    <div className="teams">
      {/* Lijevo: popis */}
      <div className="teams__left">
        <div className="gender-toggle">
          {genderBtn('m', t('teams.men'))}
          {genderBtn('z', t('teams.women'))}
        </div>

        {/* Grupe */}
        <div className="groups-bar">
          <span className="section-label">{t('teams.groups')}:</span>
          {data.groups.map((g) => (
            <span key={g.id} className="group-chip">
              {g.name}
              <button
                className="group-chip__del"
                aria-label="×"
                onClick={() => {
                  if (confirm(t('teams.deleteGroupConfirm'))) void data.removeGroup(g.id);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <button className="group-chip group-chip--add" onClick={handleAddGroup}>
            {t('teams.addGroup')}
          </button>
        </div>

        {/* Dodaj ekipu */}
        <div className="add-team">
          <input
            className="input"
            value={addingName}
            placeholder={t('teams.newTeamName')}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAddTeam()}
          />
          <Button variant="primary" onClick={() => void handleAddTeam()} disabled={!addingName.trim()}>
            {t('teams.addTeam')}
          </Button>
        </div>

        {/* Popis ekipa */}
        {data.teams.length === 0 ? (
          <div className="teams__empty">{t('teams.noTeams')}</div>
        ) : (
          <div className="team-list">
            {data.teams.map((tm) => (
              <button
                key={tm.id}
                className={`team-row ${selectedId === tm.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(tm.id)}
              >
                <Crest code={tm.short_code} index={tm.sort_order} size={40} />
                <div className="team-row__main">
                  <div className="team-row__name">{tm.name}</div>
                  {groupName(tm.group_id) && (
                    <div className="team-row__group">{groupName(tm.group_id)}</div>
                  )}
                </div>
                <div className="team-row__count">
                  {data.playerCount(tm.id)} {t('teams.players')}
                </div>
              </button>
            ))}
          </div>
        )}

        <Button
          size="lg"
          block
          disabled={data.groups.length === 0 || data.teams.length < 2}
          onClick={() => void handleGenerate()}
        >
          {t('teams.genMatches')}
        </Button>
        {genMsg && <div className="banner banner--ok">{genMsg}</div>}
      </div>

      {/* Desno: uređivanje */}
      <div className="teams__right">
        {selectedTeam ? (
          <Card accent>
            <TeamEditor team={selectedTeam} players={selectedPlayers} groups={data.groups} data={data} />
          </Card>
        ) : (
          <Card>
            <div className="teams__hint">{t('teams.select')}</div>
          </Card>
        )}
      </div>
    </div>
  );
}
