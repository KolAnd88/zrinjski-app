import type { ButtonHTMLAttributes, ReactNode } from 'react';
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

/** Grb ekipe — zaobljeni kvadrat u boji ekipe s 3-slovnom kraticom. */
export function Crest({
  code,
  color,
  size = 48,
}: {
  code: string | null | undefined;
  color: string | null | undefined;
  size?: number;
}) {
  return (
    <span
      className="crest"
      style={{
        width: size,
        height: size,
        background: color || 'var(--card2)',
        fontSize: Math.round(size * 0.34),
      }}
    >
      {(code || '?').slice(0, 3).toUpperCase()}
    </span>
  );
}
