import { useCallback, useEffect, useState } from 'react';
import type { Day, LocationRow, LocationType, ProgramItem } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import type { StringKey } from '../../i18n/strings';
import { formatDayLabel } from '../../i18n/dateLabels';
import { Button } from '../../components/ui';
import {
  createLocation,
  createProgramItem,
  deleteLocation,
  deleteProgramItem,
  fetchLocations,
  fetchProgram,
  updateLocation,
  updateProgramItem,
} from '../../lib/data';
import './ProgramEditor.css';

const TYPES: { type: LocationType; key: StringKey }[] = [
  { type: 'hall', key: 'loc.type.hall' },
  { type: 'tent', key: 'loc.type.tent' },
  { type: 'dinner', key: 'loc.type.dinner' },
  { type: 'hotel', key: 'loc.type.hotel' },
  { type: 'other', key: 'loc.type.other' },
];

/** "18:00:00" → "18:00" za <input type="time">; prazno kad nema vremena. */
function toInput(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
}

/**
 * Lokacije i program po danima.
 *
 * Obje tablice postoje od prve migracije i mobilna app ih prikazuje (Info,
 * Početna), ali admin dosad nije imao gdje ih unijeti. Bez ovoga stavka
 * programa nema ni sat ni mjesto, pa u app dolazi kao goli naslov.
 */
export function ProgramEditor({ tournamentId, days }: { tournamentId: string; days: Day[] }) {
  const { t, locale } = useT();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<LocationType>('dinner');
  const [locCoords, setLocCoords] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ls, ps] = await Promise.all([fetchLocations(tournamentId), fetchProgram(tournamentId)]);
      setLocations(ls);
      setItems(ps);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function fail(e: unknown) {
    setErr(e instanceof Error ? e.message : String(e));
  }

  // ── Lokacije ─────────────────────────────────────────────────────────────
  async function addLocation() {
    if (!locName.trim()) return;
    setErr(null);
    // "43.34, 17.81" — jedno polje jer se koordinate ionako kopiraju u paru
    // iz Google Mapsa. Krivi format ne ruši unos, samo ostane bez navigacije.
    const m = /(-?\d+[.,]?\d*)\s*[,;]\s*(-?\d+[.,]?\d*)/.exec(locCoords);
    try {
      const row = await createLocation({
        tournament_id: tournamentId,
        name: locName.trim(),
        type: locType,
        lat: m ? Number(m[1]!.replace(',', '.')) : null,
        lng: m ? Number(m[2]!.replace(',', '.')) : null,
        sort_order: locations.length,
      });
      setLocations((xs) => [...xs, row]);
      setLocName('');
      setLocCoords('');
    } catch (e) {
      fail(e);
    }
  }

  async function patchLocation(id: string, p: Partial<LocationRow>) {
    setErr(null);
    try {
      await updateLocation(id, p);
      setLocations((xs) => xs.map((l) => (l.id === id ? { ...l, ...p } : l)));
    } catch (e) {
      fail(e);
    }
  }

  async function removeLocation(id: string) {
    if (!confirm(t('loc.deleteConfirm'))) return;
    setErr(null);
    try {
      await deleteLocation(id);
      setLocations((xs) => xs.filter((l) => l.id !== id));
      // Stavke koje su pokazivale na nju ostaju, ali bez mjesta (FK je
      // "on delete set null"), pa osvježi da se to i vidi.
      setItems((xs) => xs.map((p) => (p.location_id === id ? { ...p, location_id: null } : p)));
    } catch (e) {
      fail(e);
    }
  }

  // ── Program ──────────────────────────────────────────────────────────────
  async function addItem(dayId: string) {
    setErr(null);
    const ofDay = items.filter((p) => p.day_id === dayId);
    try {
      const row = await createProgramItem({
        tournament_id: tournamentId,
        day_id: dayId,
        time: '20:00:00',
        title: t('prog.newItem'),
        location_id: null,
        sort_order: ofDay.length,
      });
      setItems((xs) => [...xs, row]);
    } catch (e) {
      fail(e);
    }
  }

  async function patchItem(id: string, p: Partial<ProgramItem>) {
    setErr(null);
    try {
      await updateProgramItem(id, p);
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    } catch (e) {
      fail(e);
    }
  }

  async function removeItem(id: string) {
    setErr(null);
    try {
      await deleteProgramItem(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      fail(e);
    }
  }

  if (loading) return <p className="prog__empty">{t('common.loading')}</p>;

  return (
    <div className="prog">
      {err && <div className="banner banner--error">{err}</div>}

      {/* ── Lokacije ─────────────────────────────────────────────────────── */}
      <h2 className="section-label">{t('loc.title')}</h2>
      <p className="prog__hint">{t('loc.hint')}</p>

      {locations.length > 0 && (
        <div className="prog__locs">
          {locations.map((l) => (
            <div key={l.id} className="prog__loc">
              <input
                className="input"
                defaultValue={l.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== l.name) void patchLocation(l.id, { name: v });
                }}
              />
              <select
                className="input"
                value={l.type}
                onChange={(e) => void patchLocation(l.id, { type: e.target.value as LocationType })}
              >
                {TYPES.map((x) => (
                  <option key={x.type} value={x.type}>
                    {t(x.key)}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder={t('loc.coords')}
                defaultValue={l.lat != null && l.lng != null ? `${l.lat}, ${l.lng}` : ''}
                onBlur={(e) => {
                  const m = /(-?\d+[.,]?\d*)\s*[,;]\s*(-?\d+[.,]?\d*)/.exec(e.target.value);
                  void patchLocation(l.id, {
                    lat: m ? Number(m[1]!.replace(',', '.')) : null,
                    lng: m ? Number(m[2]!.replace(',', '.')) : null,
                  });
                }}
              />
              <button className="prog__del" aria-label="×" onClick={() => void removeLocation(l.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="prog__loc prog__loc--add">
        <input
          className="input"
          value={locName}
          placeholder={t('loc.name')}
          onChange={(e) => setLocName(e.target.value)}
        />
        <select className="input" value={locType} onChange={(e) => setLocType(e.target.value as LocationType)}>
          {TYPES.map((x) => (
            <option key={x.type} value={x.type}>
              {t(x.key)}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={locCoords}
          placeholder={t('loc.coords')}
          onChange={(e) => setLocCoords(e.target.value)}
        />
        <Button variant="primary" disabled={!locName.trim()} onClick={() => void addLocation()}>
          {t('loc.add')}
        </Button>
      </div>

      {/* ── Program po danima ────────────────────────────────────────────── */}
      <h2 className="section-label" style={{ marginTop: 'var(--sp-xl, 28px)' }}>
        {t('prog.title')}
      </h2>
      <p className="prog__hint">{t('prog.hint')}</p>

      {days.length === 0 ? (
        <p className="prog__empty">{t('tournament.noDays')}</p>
      ) : (
        days.map((day) => {
          const ofDay = items
            .filter((p) => p.day_id === day.id)
            .sort((a, b) => a.sort_order - b.sort_order || (a.time ?? '').localeCompare(b.time ?? ''));
          return (
            <section key={day.id} className="prog__day">
              <div className="prog__dayhead">
                <span className="prog__daytitle">{formatDayLabel(day.date, locale)}</span>
                <Button onClick={() => void addItem(day.id)}>{t('prog.add')}</Button>
              </div>

              {ofDay.length === 0 ? (
                <p className="prog__empty">{t('prog.empty')}</p>
              ) : (
                ofDay.map((p) => (
                  <div key={p.id} className="prog__item">
                    <input
                      className="input prog__time"
                      type="time"
                      defaultValue={toInput(p.time)}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v && v !== toInput(p.time)) void patchItem(p.id, { time: `${v}:00` });
                      }}
                    />
                    <input
                      className="input"
                      defaultValue={p.title}
                      placeholder={t('prog.itemTitle')}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== p.title) void patchItem(p.id, { title: v });
                      }}
                    />
                    <select
                      className="input"
                      value={p.location_id ?? ''}
                      onChange={(e) => void patchItem(p.id, { location_id: e.target.value || null })}
                    >
                      <option value="">{t('prog.noLocation')}</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <button className="prog__del" aria-label="×" onClick={() => void removeItem(p.id)}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
