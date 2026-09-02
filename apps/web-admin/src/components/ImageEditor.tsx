import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button } from './ui';
import {
  centered,
  clampCover,
  clampVisible,
  coverZoom,
  FIT_H,
  FIT_W,
  fitDraw,
  fitZoom,
  previewScale,
  zoomAroundCenter,
  type Kadar,
} from './imageFrame';
import './ImageEditor.css';

/**
 * Uređivanje slike prije slanja — bez vanjske knjižnice, sve na canvasu.
 *
 * Dva načina, jer dvije vrste slika traže suprotno:
 *  • `crop`  — grb ekipe: kvadrat, pomiče se i zumira, višak se odreže
 *  • `fit`   — logo sponzora: logo se smješta u okvir STALNOG omjera, koji je
 *              isti za sve sponzore
 *
 * Zašto stalan omjer: ranije je izlazna slika poprimala oblik originala, pa je
 * širok logo davao široku sliku a visok visoku. Aplikacija ih uklapa
 * (`contain`) u iste okvire, pa je svaki ispao druge veličine — otud dojam da
 * ništa ne stoji u redu. Sada svi dobivaju isti okvir, a razlike u obliku
 * logotipa organizator izravna zumom i pomicanjem.
 *
 * Izlaz je uvijek PNG, pa prevelike slike ne mogu ni pasti na provjeri —
 * uređivač ih usput smanji.
 */
export type EditorMode = 'crop' | 'fit';

/** Strana pregleda pri izrezivanju. */
const VIEW = 300;

/**
 * Mjesta na kojima se logo stvarno pojavljuje u aplikaciji, u točkama uređaja.
 * Brojevi su prepisani iz `apps/mobile/src/components/home.tsx` (MARQUEE_SIZE)
 * — ako se ondje mijenjaju, mijenjaju se i ovdje, inače pregled laže.
 */
const MJESTA = [
  { key: 'imged.spotGold', w: 186, h: 88, pad: 9 },
  { key: 'imged.spotSilver', w: 163, h: 78, pad: 9 },
  { key: 'imged.spotPartner', w: 122, h: 52, pad: 9 },
] as const;

export function ImageEditor({
  file,
  mode,
  size,
  onCancel,
  onDone,
}: {
  file: File;
  mode: EditorMode;
  /** Duljina strane izlaza (crop) ili ŠIRINE okvira (fit). */
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

  const boxW = mode === 'crop' ? VIEW : FIT_W;
  const boxH = mode === 'crop' ? VIEW : FIT_H;

  /** Zum pri kojem logo cijeli stane u okvir, s rubom. */
  const uklopiZoom = (i: HTMLImageElement) => fitZoom(i.naturalWidth, i.naturalHeight, boxW, boxH);

  /** Početni kadar: crop ispuni okvir, fit uklopi cijeli logo. */
  function pocetni(i: HTMLImageElement): Kadar {
    const z =
      mode === 'crop'
        ? coverZoom(i.naturalWidth, i.naturalHeight, VIEW, VIEW)
        : uklopiZoom(i);
    return centered(i.naturalWidth, i.naturalHeight, z, boxW, boxH);
  }

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      const k = pocetni(i);
      setImg(i);
      setZoom(k.zoom);
      setOff({ x: k.x, y: k.y });
    };
    i.src = url;
    // Adresa se pušta tek pri zatvaranju. Ranije se poništavala odmah po
    // učitavanju — slika je i dalje služila kao izvor za canvas, pa se ništa
    // nije primijetilo, ali svaki <img src={img.src}> u pregledu ostajao je
    // slomljen.
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, mode]);

  /**
   * Pri izrezivanju slika mora uvijek prekrivati okvir — inače bi se vidjela
   * prazna traka. Kod logotipa smije biti manja od okvira (u tome je i smisao),
   * ali ne smije se odvući skroz van: tada bi se spremila prazna slika, a
   * nigdje ne bi pisalo zašto.
   */
  function clamp(next: { x: number; y: number }, z: number) {
    if (!img) return next;
    return mode === 'fit'
      ? clampVisible(next, img.naturalWidth, img.naturalHeight, z, boxW, boxH)
      : clampCover(next, img.naturalWidth, img.naturalHeight, z, VIEW, VIEW);
  }

  function onZoom(z: number) {
    if (!img) return;
    setOff((o) => clamp(zoomAroundCenter(o, zoom, z, boxW, boxH), z));
    setZoom(z);
  }

  function uklopi() {
    if (!img) return;
    const k = pocetni(img);
    setZoom(k.zoom);
    setOff({ x: k.x, y: k.y });
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
        ctx.drawImage(img, -off.x / zoom, -off.y / zoom, VIEW / zoom, VIEW / zoom, 0, 0, size, size);
      } else {
        // Isti okvir za sve sponzore; kadar je točno onaj koji je organizator
        // vidio u pregledu, samo uvećan na izlaznu veličinu.
        const d = fitDraw(img.naturalWidth, img.naturalHeight, { zoom, ...off }, size);
        canvas.width = d.canvasW;
        canvas.height = d.canvasH;
        ctx.drawImage(img, d.dx, d.dy, d.dw, d.dh);
      }

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) return;
      onDone(new File([blob], file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' }));
    } finally {
      setBusy(false);
    }
  }

  const imgStyle = img
    ? {
        width: img.naturalWidth * zoom,
        height: img.naturalHeight * zoom,
        transform: `translate(${off.x}px, ${off.y}px)`,
      }
    : undefined;

  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      setOff(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }, zoom));
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };

  const minZoom = img
    ? mode === 'crop'
      ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight)
      : uklopiZoom(img) * 0.35
    : 0;
  const maxZoom = img ? (mode === 'crop' ? minZoom * 4 : uklopiZoom(img) * 3) : 1;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={`imged ${mode === 'fit' ? 'imged--fit' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">
            {mode === 'crop' ? t('imged.titleCrop') : t('imged.titleFit')}
          </h2>
          <button className="modal__close" aria-label="×" onClick={onCancel}>
            ×
          </button>
        </div>

        <p className="imged__hint">{mode === 'crop' ? t('imged.hintCrop') : t('imged.hintFit')}</p>

        <div
          className={mode === 'crop' ? 'imged__view' : 'imged__view imged__view--fit'}
          style={mode === 'fit' ? { width: FIT_W, height: FIT_H } : undefined}
          {...pointer}
        >
          {img && <img className="imged__img" src={img.src} style={imgStyle} alt="" draggable={false} />}
          <div className={mode === 'crop' ? 'imged__mask' : 'imged__mask imged__mask--fit'} />
        </div>

        {img && (
          <label className="imged__zoom">
            <span>{t('imged.zoom')}</span>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={(maxZoom - minZoom) / 200}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
            />
            {mode === 'fit' && (
              <button type="button" className="btn-link imged__reset" onClick={uklopi}>
                {t('imged.reset')}
              </button>
            )}
          </label>
        )}

        {/* Pregled stvarnih mjesta u aplikaciji — da se ne pogađa kako će ispasti. */}
        {mode === 'fit' && img && (
          <>
            <div className="imged__spotlabel">{t('imged.preview')}</div>
            <div className="imged__spots">
              {MJESTA.map((m) => (
                <div key={m.key} className="imged__spot">
                  <div className="imged__plaque" style={{ width: m.w, height: m.h, padding: m.pad }}>
                    <Uklop img={img} zoom={zoom} off={off} w={m.w - m.pad * 2} h={m.h - m.pad * 2} />
                  </div>
                  <span className="imged__spotname">{t(m.key)}</span>
                </div>
              ))}
            </div>
          </>
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

/**
 * Okvir logotipa uklopljen u zadanu pločicu — točno ono što `resizeMode="contain"`
 * radi u aplikaciji, pa je pregled istinit, a ne približan.
 */
function Uklop({
  img,
  zoom,
  off,
  w,
  h,
}: {
  img: HTMLImageElement;
  zoom: number;
  off: { x: number; y: number };
  w: number;
  h: number;
}) {
  const s = previewScale(w, h);
  return (
    <div className="imged__uklop" style={{ width: FIT_W * s, height: FIT_H * s }}>
      <img
        src={img.src}
        alt=""
        draggable={false}
        style={{
          width: img.naturalWidth * zoom * s,
          height: img.naturalHeight * zoom * s,
          transform: `translate(${off.x * s}px, ${off.y * s}px)`,
        }}
      />
    </div>
  );
}
