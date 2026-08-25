import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button } from './ui';
import './ImageEditor.css';

/**
 * Uređivanje slike prije slanja — bez vanjske knjižnice, sve na canvasu.
 *
 * Dva načina, jer dvije vrste slika traže suprotno:
 *  • `crop`  — grb ekipe: kvadrat, pomiče se i zumira, višak se odreže
 *  • `fit`   — logo sponzora: cijeli logo mora ostati vidljiv, pa se uklapa
 *              unutar okvira i dobiva rub da ne dodiruje rubove pločice
 *
 * Izlaz je uvijek PNG u zadanoj veličini, pa prevelike slike ne mogu ni pasti
 * na provjeri — uređivač ih usput smanji.
 */
export type EditorMode = 'crop' | 'fit';

const VIEW = 300; // strana pregleda u pikselima

export function ImageEditor({
  file,
  mode,
  size,
  onCancel,
  onDone,
}: {
  file: File;
  mode: EditorMode;
  /** Duljina strane izlaza (crop) ili dulje strane (fit). */
  size: number;
  onCancel: () => void;
  onDone: (out: File) => void;
}) {
  const { t } = useT();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Učitaj sliku i postavi početni zum tako da ispuni okvir.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      const base = Math.max(VIEW / i.naturalWidth, VIEW / i.naturalHeight);
      setImg(i);
      setZoom(base);
      setOff({
        x: (VIEW - i.naturalWidth * base) / 2,
        y: (VIEW - i.naturalHeight * base) / 2,
      });
      URL.revokeObjectURL(url);
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /** Slika mora uvijek prekrivati okvir — inače bi se vidjela prazna traka. */
  function clamp(next: { x: number; y: number }, z: number) {
    if (!img) return next;
    const w = img.naturalWidth * z;
    const h = img.naturalHeight * z;
    return {
      x: Math.min(0, Math.max(VIEW - w, next.x)),
      y: Math.min(0, Math.max(VIEW - h, next.y)),
    };
  }

  function onZoom(z: number) {
    if (!img) return;
    // Zumiraj oko sredine okvira, ne oko gornjeg lijevog kuta.
    const k = z / zoom;
    setOff((o) => clamp({ x: VIEW / 2 - (VIEW / 2 - o.x) * k, y: VIEW / 2 - (VIEW / 2 - o.y) * k }, z));
    setZoom(z);
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      if (mode === 'crop') {
        canvas.width = size;
        canvas.height = size;
        const s = size / VIEW;
        ctx.drawImage(
          img,
          -off.x / zoom,
          -off.y / zoom,
          VIEW / zoom,
          VIEW / zoom,
          0,
          0,
          size,
          size
        );
        void s;
      } else {
        // Uklopi cijeli logo i ostavi 8% ruba sa svake strane.
        const pad = 0.08;
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = ratio >= 1 ? size : Math.round(size * ratio);
        const h = ratio >= 1 ? Math.round(size / ratio) : size;
        canvas.width = w;
        canvas.height = h;
        const iw = w * (1 - pad * 2);
        const ih = h * (1 - pad * 2);
        const k = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
        const dw = img.naturalWidth * k;
        const dh = img.naturalHeight * k;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) return;
      onDone(new File([blob], file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' }));
    } finally {
      setBusy(false);
    }
  }

  const previewStyle = img
    ? {
        width: img.naturalWidth * zoom,
        height: img.naturalHeight * zoom,
        transform: `translate(${off.x}px, ${off.y}px)`,
      }
    : undefined;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="imged" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">
            {mode === 'crop' ? t('imged.titleCrop') : t('imged.titleFit')}
          </h2>
          <button className="modal__close" aria-label="×" onClick={onCancel}>
            ×
          </button>
        </div>

        <p className="imged__hint">{mode === 'crop' ? t('imged.hintCrop') : t('imged.hintFit')}</p>

        {mode === 'crop' ? (
          <div
            className="imged__view"
            onPointerDown={(e) => {
              drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOff(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }, zoom));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            {img && <img className="imged__img" src={img.src} style={previewStyle} alt="" draggable={false} />}
            <div className="imged__mask" />
          </div>
        ) : (
          <div className="imged__fit">{img && <img src={img.src} alt="" />}</div>
        )}

        {mode === 'crop' && img && (
          <label className="imged__zoom">
            <span>{t('imged.zoom')}</span>
            <input
              type="range"
              min={Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight)}
              max={Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * 4}
              step="0.01"
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
            />
          </label>
        )}

        <div className="imged__actions">
          <Button onClick={onCancel}>{t('tournament.cancel')}</Button>
          <Button variant="primary" disabled={!img || busy} onClick={() => void save()}>
            {busy ? t('imged.saving') : t('imged.use')}
          </Button>
        </div>
      </div>
    </div>
  );
}
