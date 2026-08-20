import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { crestColorFor } from '@zrinjski/ui-tokens';
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
 * Grb ekipe (krug). Dva stanja:
 *  1. `logoUrl` postoji → slika, uklopljena (contain), nikad obrezana
 *  2. inače → krug u boji crestColorFor(index) s 2–3 slovnom kraticom
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
  const bg = color ?? (index != null ? crestColorFor(index) : 'var(--card2)');
  const label = (code || '?').slice(0, 3).toUpperCase();
  return (
    <span
      className="crest"
      style={{
        width: size,
        height: size,
        // Iza prozirnog logotipa treba neutralna podloga, ne boja ekipe.
        background: logoUrl ? 'var(--card2)' : bg,
        fontSize: Math.round(size * 0.34),
      }}
    >
      {logoUrl ? <img src={logoUrl} alt={label} /> : label}
    </span>
  );
}
