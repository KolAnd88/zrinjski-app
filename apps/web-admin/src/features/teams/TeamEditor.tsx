import { useEffect, useState } from 'react';
import type { Grp, Player, Team, TablesUpdate } from '@zrinjski/core';
import { colors as tokenColors } from '@zrinjski/ui-tokens';
import { useT } from '../../i18n/I18nProvider';
import { Crest } from '../../components/ui';
import type { TeamsData } from './useTeamsData';

function PlayerRow({
  player,
  onEdit,
  onRemove,
}: {
  player: Player;
  onEdit: (patch: TablesUpdate<'player'>) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useT();
  const [num, setNum] = useState(player.number?.toString() ?? '');
  const [name, setName] = useState(player.name);

  useEffect(() => {
    setNum(player.number?.toString() ?? '');
    setName(player.name);
  }, [player.id, player.number, player.name]);

  return (
    <div className="prow">
      <input
        className="input prow__num"
        value={num}
        inputMode="numeric"
        placeholder={t('teams.playerNumber')}
        onChange={(e) => setNum(e.target.value)}
        onBlur={() => {
          const n = num.trim() === '' ? null : Number(num);
          if (n !== player.number && (n === null || Number.isFinite(n))) void onEdit({ number: n });
        }}
      />
      <input
        className="input prow__name"
        value={name}
        placeholder={t('teams.playerName')}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== player.name) void onEdit({ name: name.trim() });
        }}
      />
      <button
        className={`prow__cap ${player.is_captain ? 'is-on' : ''}`}
        title={t('teams.captain')}
        onClick={() => void onEdit({ is_captain: !player.is_captain })}
      >
        C
      </button>
      <button
        className="prow__del"
        aria-label="×"
        onClick={() => {
          if (confirm(t('teams.deletePlayerConfirm'))) void onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = 'text',
  maxLength,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="input"
        type={type}
        value={local}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onSave(local)}
      />
    </div>
  );
}

export function TeamEditor({
  team,
  players,
  groups,
  data,
}: {
  team: Team;
  players: Player[];
  groups: Grp[];
  data: TeamsData;
}) {
  const { t } = useT();
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');

  async function addPlayer() {
    if (!newName.trim()) return;
    await data.addPlayer(team.id, {
      name: newName.trim(),
      number: newNum.trim() ? Number(newNum) : null,
    });
    setNewNum('');
    setNewName('');
  }

  return (
    <div className="teditor">
      <div className="teditor__head">
        <Crest code={team.short_code} color={team.color} />
        <h2 className="teditor__title">
          {t('teams.editPrefix')}: {team.name}
        </h2>
      </div>

      <div className="teditor__grid">
        <Field label={t('teams.name')} value={team.name} onSave={(v) => v.trim() && data.editTeam(team.id, { name: v.trim() })} />
        <Field
          label={t('teams.shortCode')}
          value={team.short_code ?? ''}
          maxLength={3}
          placeholder="ZRI"
          onSave={(v) => data.editTeam(team.id, { short_code: v.trim().toUpperCase() || null })}
        />
      </div>

      <div>
        <label className="field-label">{t('teams.color')}</label>
        <div className="swatches">
          {tokenColors.teamColors.map((c) => (
            <button
              key={c}
              className={`swatch ${team.color === c ? 'is-on' : ''}`}
              style={{ background: c }}
              aria-label={c}
              onClick={() => void data.editTeam(team.id, { color: c })}
            />
          ))}
          <input
            type="color"
            className="swatch swatch--custom"
            value={team.color ?? '#888888'}
            onChange={(e) => void data.editTeam(team.id, { color: e.target.value })}
          />
        </div>
      </div>

      <div className="teditor__grid">
        <div>
          <label className="field-label">{t('teams.group')}</label>
          <select
            className="input"
            value={team.group_id ?? ''}
            onChange={(e) => void data.editTeam(team.id, { group_id: e.target.value || null })}
          >
            <option value="">{t('teams.noGroup')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          label={t('teams.coach')}
          value={team.coach_name ?? ''}
          onSave={(v) => data.editTeam(team.id, { coach_name: v.trim() || null })}
        />
      </div>

      <Field
        label={t('teams.repEmail')}
        type="email"
        value={team.rep_email ?? ''}
        placeholder="predstavnik@klub.ba"
        onSave={(v) => data.editTeam(team.id, { rep_email: v.trim() || null })}
      />

      <div>
        <h3 className="section-label" style={{ margin: 'var(--sp-md) 0 var(--sp-sm)' }}>
          {t('teams.playersTitle')}
        </h3>
        <div className="plist">
          {players.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              onEdit={(patch) => data.editPlayer(p.id, patch)}
              onRemove={() => data.removePlayer(p.id)}
            />
          ))}
        </div>

        <div className="prow prow--add">
          <input
            className="input prow__num"
            value={newNum}
            inputMode="numeric"
            placeholder={t('teams.playerNumber')}
            onChange={(e) => setNewNum(e.target.value)}
          />
          <input
            className="input prow__name"
            value={newName}
            placeholder={t('teams.playerName')}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addPlayer()}
          />
          <button className="prow__add" onClick={() => void addPlayer()}>
            {t('teams.addPlayer')}
          </button>
        </div>
      </div>

      <button
        className="btn-link teditor__delete"
        onClick={() => {
          if (confirm(t('teams.deleteTeamConfirm'))) void data.removeTeam(team.id);
        }}
      >
        × {t('teams.deleteTeam')}
      </button>
    </div>
  );
}
