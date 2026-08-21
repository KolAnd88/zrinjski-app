import { useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { ReminderPrefs } from '@zrinjski/core';
import { Button, Card } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useNotices } from '../features/notices/useNotices';
import './Notices.css';

type AudienceKind = 'all' | 'team' | 'followers';

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Notices() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = useNotices(tournament.tournament?.id ?? null);
  const [kind, setKind] = useState<AudienceKind>('all');
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (data.error) return <Card accent style={{ maxWidth: 560 }}>{data.error}</Card>;
  if (!tournament.tournament) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;

  const tr = tournament.tournament;
  const prefs = tr.reminder_prefs;
  const needsTeam = kind !== 'all';
  const canSend = title.trim().length > 0 && (!needsTeam || !!teamId);

  function audienceString(): string {
    if (kind === 'all') return 'all';
    if (kind === 'team') return `team:${teamId}`;
    return `followers:${teamId}`;
  }
  function audienceLabel(aud: string): string {
    if (aud === 'all') return t('notices.all');
    const [k, id] = aud.split(':');
    const team = data.teams.find((x) => x.id === id);
    const code = team?.short_code ?? team?.name ?? id;
    return k === 'team' ? `${code}` : `${t('notices.followers')} ${code}`;
  }

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setSendErr(null);
    try {
      await data.send(tr.id, audienceString(), title, body);
      setTitle('');
      setBody('');
    } catch (e) {
      // Obavijest je već u povijesti — pao je samo push. Reci točno to.
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setPref(key: keyof ReminderPrefs, val: boolean) {
    void tournament.saveSettings({ reminder_prefs: { ...prefs, [key]: val } });
  }

  const kindBtn = (k: AudienceKind, label: string) => (
    <button className={`seg ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
      {label}
    </button>
  );

  return (
    <div className="notices">
      {/* Nova obavijest */}
      <h2 className="section-label">{t('notices.newTitle')}</h2>
      <Card>
        <label className="field-label">{t('notices.to')}</label>
        <div className="seg-group">
          {kindBtn('all', t('notices.all'))}
          {kindBtn('team', t('notices.byTeam'))}
          {kindBtn('followers', t('notices.followers'))}
        </div>

        {needsTeam && (
          <select className="input notices__team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">{t('notices.selectTeam')}</option>
            {data.teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        )}

        <input
          className="input notices__title"
          placeholder={t('notices.titlePh')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input notices__body"
          placeholder={t('notices.bodyPh')}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <Button variant="primary" size="lg" block disabled={!canSend || busy} onClick={() => void send()}>
          {busy ? t('notices.sending') : t('notices.send')}
        </Button>
        {sendErr && (
          <div className="banner banner--error" style={{ marginTop: 'var(--sp-md)' }}>
            {t('notices.sendFailed', { e: sendErr })}
          </div>
        )}
        {!sendErr && data.sentCount != null && (
          <div className="banner banner--ok" style={{ marginTop: 'var(--sp-md)' }}>
            {data.sentCount > 0
              ? t('notices.delivered', { n: data.sentCount })
              : t('notices.deliveredNone')}
          </div>
        )}
        <p className="notices__pushnote">{t('notices.pushNote')}</p>
      </Card>

      {/* Poslano */}
      <h2 className="section-label">{t('notices.sent')}</h2>
      {data.notifications.length === 0 ? (
        <div className="notices__empty">{t('notices.empty')}</div>
      ) : (
        <div className="notices__list">
          {data.notifications.map((n) => (
            <div key={n.id} className="notice-row">
              <span className="notice-row__time">{timeOf(n.sent_at)}</span>
              <div className="notice-row__main">
                <div className="notice-row__title">{n.title}</div>
                <div className="notice-row__aud">→ {audienceLabel(n.audience)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Automatski podsjetnici */}
      <div className="notices__autohead">
        <h2 className="section-label">{t('notices.autoTitle')}</h2>
        <span className="notices__autohint">{t('notices.autoHint')}</span>
      </div>
      <div className="notices__toggles">
        {(
          [
            ['day_before_18', 'notices.auto.dayBefore'],
            ['thirty_min_before', 'notices.auto.thirtyMin'],
            ['schedule_change', 'notices.auto.scheduleChange'],
          ] as const
        ).map(([key, labelKey]) => (
          <div key={key} className="toggle-row">
            <span className="toggle-row__label">{t(labelKey)}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPref(key, e.target.checked)}
              />
              <span className="switch__track" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
