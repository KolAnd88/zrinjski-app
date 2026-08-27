import { useEffect, useState } from 'react';
import type { Grp, Player, Team, TablesUpdate } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Crest } from '../../components/ui';
import { deleteTeamLogo, LogoValidationError, uploadTeamLogo } from '../../lib/data';
import { ImageEditor } from '../../components/ImageEditor';
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

/** Logo ekipe — upload, pretpregled, brisanje. Logo je opcionalan. */
function LogoField({ team, onChanged }: { team: Team; onChanged: () => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Odabrana datoteka ide prvo u uređivač; upload tek nakon kadriranja.
  const [editing, setEditing] = useState<File | null>(null);

  function pick(file: File | null) {
    if (!file) return;
    setErr(null);
    // SVG je vektor — nema što kadrirati, ide izravno.
    if (file.type === 'image/svg+xml') {
      void upload(file);
      return;
    }
    setEditing(file);
  }

  async function upload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      await uploadTeamLogo(team.id, file);
      onChanged();
    } catch (e) {
      if (e instanceof LogoValidationError) {
        const msg = {
          type: 'teams.logoErrType',
          size: 'teams.logoErrSize',
          tooSmall: 'teams.logoErrTooSmall',
          tooLarge: 'teams.logoErrTooLarge',
        } as const;
        setErr(t(msg[e.reason]));
      } else {
        setErr(t('teams.logoErrUpload'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t('teams.logoRemoveConfirm'))) return;
    setBusy(true);
    try {
      await deleteTeamLogo(team.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="field-label">{t('teams.logo')}</label>
      <div className="logo-field">
        <div className="logo-field__preview">
          {team.logo_url ? (
            <img src={team.logo_url} alt={team.short_code ?? team.name} />
          ) : (
            <Crest code={team.short_code} index={team.sort_order} size={64} />
          )}
        </div>
        <div className="logo-field__actions">
          <label className={`btn btn--secondary ${busy ? 'btn--busy' : ''}`}>
            {busy ? t('teams.logoUploading') : team.logo_url ? t('teams.logoChange') : t('teams.logoUpload')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              hidden
              disabled={busy}
              onChange={(e) => {
                pick(e.target.files?.[0] ?? null);
                e.target.value = ''; // dopušta ponovni odabir iste datoteke
              }}
            />
          </label>
          {editing && (
            <ImageEditor
              file={editing}
              mode="crop"
              size={512}
              onCancel={() => setEditing(null)}
              onDone={(out) => {
                setEditing(null);
                void upload(out);
              }}
            />
          )}
          {team.logo_url && (
            <button className="btn-link logo-field__remove" disabled={busy} onClick={() => void remove()}>
              {t('teams.logoRemove')}
            </button>
          )}
          <p className="logo-field__hint">{team.logo_url ? t('teams.logoHint') : t('teams.logoNone')}</p>
        </div>
      </div>
      {err && <div className="banner banner--error" style={{ marginTop: 'var(--sp-sm)' }}>{err}</div>}
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
        <Crest code={team.short_code} index={team.sort_order} logoUrl={team.logo_url} />
        <h2 className="teditor__title">
          {t('teams.editPrefix')}: {team.name}
        </h2>
      </div>

      <LogoField team={team} onChanged={() => void data.reload()} />

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

      <div className="teditor__grid">
        {/* Grupa se ovdje samo prikazuje. Mijenja se u ždrijebu iznad, gdje se
            vidi cjelina i gdje se sprema tek na gumb — dva mjesta za istu
            promjenu, od kojih jedno sprema odmah, samo su zbunjivala. */}
        <div>
          <label className="field-label">{t('teams.group')}</label>
          <div className="input teditor__readonly">
            {groups.find((g) => g.id === team.group_id)?.name ?? t('teams.noGroup')}
          </div>
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
