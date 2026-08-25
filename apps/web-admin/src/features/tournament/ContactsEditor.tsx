import { useCallback, useEffect, useState } from 'react';
import type { Contact } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { Button } from '../../components/ui';
import { createContact, deleteContact, fetchContacts, updateContact } from '../../lib/data';
import './ContactsEditor.css';

/**
 * Kontakti organizatora.
 *
 * Ovo je JAVNI popis — pojavljuje se svakom gledatelju u Info tabu, s brojem
 * na koji se može odmah nazvati. Zato uz polja stoji upozorenje: tko ne želi
 * da mu broj vidi cijeli turnir, ne upisuje se ovdje.
 */
export function ContactsEditor({ tournamentId }: { tournamentId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchContacts(tournamentId));
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

  async function add() {
    if (!name.trim()) return;
    setErr(null);
    try {
      const row = await createContact({
        tournament_id: tournamentId,
        name: name.trim(),
        role: role.trim() || null,
        phone: phone.trim() || null,
        sort_order: rows.length,
      });
      setRows((xs) => [...xs, row]);
      setName('');
      setRole('');
      setPhone('');
    } catch (e) {
      fail(e);
    }
  }

  async function patch(id: string, p: Partial<Contact>) {
    setErr(null);
    try {
      await updateContact(id, p);
      setRows((xs) => xs.map((c) => (c.id === id ? { ...c, ...p } : c)));
    } catch (e) {
      fail(e);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('contacts.deleteConfirm'))) return;
    setErr(null);
    try {
      await deleteContact(id);
      setRows((xs) => xs.filter((c) => c.id !== id));
    } catch (e) {
      fail(e);
    }
  }

  if (loading) return <p className="cont__empty">{t('common.loading')}</p>;

  return (
    <div className="cont">
      <h2 className="section-label">{t('contacts.title')}</h2>
      <p className="cont__hint">{t('contacts.hint')}</p>

      {err && <div className="banner banner--error">{err}</div>}

      {rows.length === 0 ? (
        <p className="cont__empty">{t('contacts.empty')}</p>
      ) : (
        rows.map((c) => (
          <div key={c.id} className="cont__row">
            <input
              className="input"
              defaultValue={c.name}
              placeholder={t('contacts.name')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) void patch(c.id, { name: v });
              }}
            />
            <input
              className="input"
              defaultValue={c.role ?? ''}
              placeholder={t('contacts.role')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (c.role ?? '')) void patch(c.id, { role: v || null });
              }}
            />
            <input
              className="input"
              type="tel"
              defaultValue={c.phone ?? ''}
              placeholder={t('contacts.phone')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (c.phone ?? '')) void patch(c.id, { phone: v || null });
              }}
            />
            <button className="cont__del" aria-label="×" onClick={() => void remove(c.id)}>
              ×
            </button>
          </div>
        ))
      )}

      <div className="cont__row cont__row--add">
        <input
          className="input"
          value={name}
          placeholder={t('contacts.name')}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          value={role}
          placeholder={t('contacts.role')}
          onChange={(e) => setRole(e.target.value)}
        />
        <input
          className="input"
          type="tel"
          value={phone}
          placeholder={t('contacts.phone')}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <Button variant="primary" disabled={!name.trim()} onClick={() => void add()}>
          {t('contacts.add')}
        </Button>
      </div>
    </div>
  );
}
