import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Grp, Team } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button, Crest } from '../../components/ui';
import './GroupDraw.css';

/**
 * Ždrijeb — raspoređivanje ekipa po grupama.
 *
 * Dosad se grupa mijenjala u uredniku pojedine ekipe i spremala se odmah, pa
 * se ždrijeb radio ekipu po ekipu, bez pregleda cjeline i bez mogućnosti da
 * se odustane. Ovdje se cijeli raspored slaže u nacrtu i šalje jednim
 * "Spremi", a do tada se u bazi ništa ne mijenja.
 *
 * Namjerno bez povlačenja mišem: padajući izbornik radi i na dodir, čitljiv
 * je čitačima ekrana i ne traži dodatnu biblioteku.
 */
export function GroupDraw({
  teams,
  groups,
  onSave,
  onDirtyChange,
}: {
  teams: Team[];
  groups: Grp[];
  onSave: (changes: { id: string; group_id: string | null }[]) => Promise<void>;
  /** Javlja stranici ima li nespremljenih izmjena — generiranje utakmica tada
   *  mora mirovati, jer bi radilo po starom, još spremljenom rasporedu. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useT();

  /** Polazno stanje iz baze: ekipa → grupa (ili null za neraspoređene). */
  const base = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const tm of teams) m[tm.id] = tm.group_id;
    return m;
  }, [teams]);

  const [draft, setDraft] = useState<Record<string, string | null>>(base);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changes = useMemo(
    () =>
      Object.keys(draft)
        .filter((id) => draft[id] !== base[id])
        .map((id) => ({ id, group_id: draft[id] ?? null })),
    [draft, base]
  );
  const dirty = changes.length > 0;

  // Novi podaci izvana smiju osvježiti nacrt samo ako nema nespremljenog rada.
  const baseKey = JSON.stringify(base);
  useEffect(() => {
    if (dirty) return;
    setDraft(JSON.parse(baseKey) as Record<string, string | null>);
    // `dirty` namjerno nije u ovisnostima: zanima nas samo nova baza, a
    // provjera prljavosti se radi u trenutku dolaska.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const assign = useCallback((teamId: string, groupId: string | null) => {
    setDraft((d) => ({ ...d, [teamId]: groupId }));
    setSaved(false);
    setError(null);
  }, []);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(changes);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const unassigned = teams.filter((tm) => !draft[tm.id]);
  const countIn = (gid: string) => teams.filter((tm) => draft[tm.id] === gid).length;

  if (groups.length === 0) {
    return <div className="draw__hint">{t('draw.noGroups')}</div>;
  }

  return (
    <div className="draw">
      <div className="draw__head">
        <h2 className="section-label">{t('draw.title')}</h2>
        <span className="draw__counts">
          {groups.map((g) => `${g.name}: ${countIn(g.id)}`).join(' · ')}
          {unassigned.length > 0 && ` · ${t('draw.unassigned')}: ${unassigned.length}`}
        </span>
      </div>

      <div className="draw__list">
        {teams.map((tm) => (
          <div key={tm.id} className={`draw__row ${draft[tm.id] !== base[tm.id] ? 'is-changed' : ''}`}>
            <Crest code={tm.short_code} index={tm.sort_order} logoUrl={tm.logo_url} size={28} />
            <span className="draw__name">{tm.name}</span>
            <select
              className="input draw__select"
              value={draft[tm.id] ?? ''}
              onChange={(e) => assign(tm.id, e.target.value || null)}
            >
              <option value="">{t('draw.none')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="savebar">
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? t('form.saving') : t('draw.save')}
        </Button>
        <Button
          variant="ghost"
          disabled={!dirty || saving}
          onClick={() => {
            setDraft(JSON.parse(baseKey) as Record<string, string | null>);
            setError(null);
            setSaved(false);
          }}
        >
          {t('form.cancel')}
        </Button>
        {dirty && !saving && (
          <span className="savebar__dirty">{t('draw.pending', { n: changes.length })}</span>
        )}
        {saved && !dirty && <span className="savebar__ok">{t('form.saved')}</span>}
        {error && <span className="savebar__err">{error}</span>}
      </div>
    </div>
  );
}
