import { useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button, Card } from '../components/ui';
import { formatDayLabel } from '../i18n/dateLabels';
import { PhotoValidationError } from '../lib/data';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useGallery } from '../features/gallery/useGallery';
import './Gallery.css';

export function Gallery() {
  const { t, locale } = useT();
  const tournament = useTournamentData();
  const data = useGallery(tournament.tournament?.id ?? null);

  // Fotografija se veže uz dan turnira — tako je gledatelji vide grupirane.
  const [dayId, setDayId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      // Više odjednom: organizator obično ubaci cijelu seriju s utakmice.
      for (const file of Array.from(files)) {
        await data.add(dayId || null, file);
      }
    } catch (e) {
      if (e instanceof PhotoValidationError) {
        const msg = {
          type: 'gallery.badType',
          size: 'gallery.tooBig',
          tooSmall: 'gallery.tooSmallPx',
          tooLarge: 'gallery.tooLargePx',
        } as const;
        setErr(t(msg[e.reason]));
      } else {
        setErr(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!tournament.tournament) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;

  const dayLabel = (id: string | null) => {
    const d = data.days.find((x) => x.id === id);
    return d ? formatDayLabel(d.date, locale) : t('gallery.noDay');
  };

  // Grupiraj po danu, poredano kao i sami dani; bez dana ide na kraj.
  const groups = [
    ...data.days.map((d) => ({ id: d.id as string | null, photos: data.photos.filter((p) => p.day_id === d.id) })),
    { id: null, photos: data.photos.filter((p) => !p.day_id) },
  ].filter((g) => g.photos.length > 0);

  return (
    <div className="gallery">
      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('gallery.add')}
        </h2>

        <div className="gallery__form">
          <div className="gallery__field">
            <label className="field-label">{t('gallery.day')}</label>
            <select className="input" value={dayId} onChange={(e) => setDayId(e.target.value)}>
              <option value="">{t('gallery.noDay')}</option>
              {data.days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayLabel(d.date, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="gallery__field">
            <label className="field-label">{t('gallery.file')}</label>
            <input
              ref={fileRef}
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        </div>

        {busy && <div className="banner" style={{ marginTop: 'var(--sp-md)' }}>{t('gallery.uploading')}</div>}
        {err && <div className="banner banner--error" style={{ marginTop: 'var(--sp-md)' }}>{err}</div>}
        <p className="gallery__note">{t('gallery.hint')}</p>
        {data.demo && <p className="gallery__note">{t('gallery.demoNote')}</p>}
      </Card>

      {data.error && <Card accent>{data.error}</Card>}

      {groups.length === 0 ? (
        <Card style={{ maxWidth: 560 }}>{t('gallery.empty')}</Card>
      ) : (
        groups.map((g) => (
          <div key={g.id ?? 'none'}>
            <h2 className="section-label">{dayLabel(g.id)}</h2>
            <div className="gallery__grid">
              {g.photos.map((p) => (
                <figure key={p.id} className="gphoto">
                  <img src={p.storage_path} alt="" loading="lazy" />
                  <button
                    className="gphoto__del"
                    title={t('gallery.remove')}
                    onClick={() => {
                      if (confirm(t('gallery.removeConfirm'))) void data.remove(p.id);
                    }}
                  >
                    ×
                  </button>
                </figure>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
