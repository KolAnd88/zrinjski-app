import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { crestCss, crestGradientFor } from '@zrinjski/ui-tokens';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'secondary',
  block,
  size,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  size?: 'lg';
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    block ? 'btn--block' : '',
    size === 'lg' ? 'btn--lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  accent,
  className = '',
  children,
  style,
}: {
  accent?: boolean;
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${accent ? 'card--accent' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

/**
 * Traka sa "Spremi" i "Odustani" za obrasce koji koriste `useDraft`.
 *
 * Uvijek je vidljiva, i kad nema izmjena — tako korisnik unaprijed zna da se
 * ovdje sprema tek na gumb. Da se pojavljuje tek nakon prve izmjene, prvi bi
 * unos uvijek bio korak u prazno.
 */
export function SaveBar({
  draft,
  labels,
}: {
  draft: {
    dirty: boolean;
    saving: boolean;
    error: string | null;
    saved: boolean;
    save: () => Promise<void>;
    reset: () => void;
  };
  labels: { save: string; saving: string; cancel: string; saved: string; unsaved: string };
}) {
  return (
    <div className="savebar">
      <Button
        variant="primary"
        disabled={!draft.dirty || draft.saving}
        onClick={() => void draft.save()}
      >
        {draft.saving ? labels.saving : labels.save}
      </Button>
      <Button variant="ghost" disabled={!draft.dirty || draft.saving} onClick={draft.reset}>
        {labels.cancel}
      </Button>
      {draft.dirty && !draft.saving && <span className="savebar__dirty">{labels.unsaved}</span>}
      {draft.saved && !draft.dirty && <span className="savebar__ok">{labels.saved}</span>}
      {draft.error && <span className="savebar__err">{draft.error}</span>}
    </div>
  );
}

/** Radijus grba prati veličinu (vidi DIZAJN.md): 7 → 9 → 11 → 15 → 17 → 44. */
function crestRadius(size: number) {
  if (size <= 26) return 7;
  if (size <= 32) return 9;
  if (size <= 46) return 11;
  if (size <= 60) return 15;
  if (size <= 120) return 17;
  return 44; // TV semafor
}

/**
 * Grb ekipe — zaobljeni kvadrat s gradijentom (150°). Dva stanja:
 *  1. `logoUrl` postoji → slika, uklopljena (contain), nikad obrezana
 *  2. inače → gradijent iz palete po indeksu, s 2–3 slovnom kraticom
 * Nikad prazna rupa ni generička placeholder ikona.
 *
 * Boja se NE bira ručno. `color` prop je samo za slučajeve bez ekipe
 * (npr. prijave) gdje je pozivatelj već izračunao boju.
 */
export function Crest({
  code,
  color,
  index,
  logoUrl,
  size = 48,
}: {
  code: string | null | undefined;
  color?: string | null;
  index?: number | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const bg = color ?? (index != null ? crestCss(crestGradientFor(index)) : 'var(--card2)');
  const label = (code || '?').slice(0, 3).toUpperCase();
  return (
    <span
      className="crest"
      style={{
        width: size,
        height: size,
        borderRadius: crestRadius(size),
        // Iza prozirnog logotipa treba neutralna podloga, ne boja ekipe.
        background: logoUrl ? 'var(--card2)' : bg,
        fontSize: Math.round(size * 0.32),
      }}
    >
      {logoUrl ? <img src={logoUrl} alt={label} /> : label}
    </span>
  );
}
