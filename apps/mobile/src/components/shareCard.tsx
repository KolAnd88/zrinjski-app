import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

type SvgRef = { toDataURL: (cb: (base64: string) => void, options?: object) => void };

/** Slika je 1080×1350; i na sporom uređaju to je gotovo u par sekundi. */
const EXPORT_TIMEOUT_MS = 12000;

/**
 * Pretvaranje SVG-a u PNG na uređaju.
 *
 * SVG se mora STVARNO nacrtati da bi se mogao izvesti, pa se crta izvan
 * vidljivog dijela ekrana. `SvgXml` ne prosljeđuje ref, ali `override` proširuje
 * unutarnji `<Svg>` — a on ima `toDataURL`. Time izbjegavamo dodatnu native
 * ovisnost (react-native-view-shot) samo radi snimanja jednog pogleda.
 *
 * Vraća komponentu koju treba postaviti u stablo i funkciju koja daje PNG
 * u base64 obliku.
 */
export function useShareCardExport() {
  const [xml, setXml] = useState<string | null>(null);
  const svgRef = useRef<SvgRef | null>(null);
  const waiting = useRef<{ resolve: (b64: string) => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    if (!xml || !waiting.current) return;

    /** Zatvori posao jednom — drugi poziv nakon isteka roka nema učinka. */
    const finish = (fn: (p: NonNullable<typeof waiting.current>) => void) => {
      const pending = waiting.current;
      if (!pending) return;
      waiting.current = null;
      setXml(null);
      fn(pending);
    };

    // Rok: `toDataURL` prima povratni poziv koji se na Androidu zna nikad ne
    // javiti (crtež izvan ekrana). Bez roka bi obećanje visjelo zauvijek —
    // gumb ostane u radu, greška se ne pojavi i kvar izgleda kao "ništa se ne
    // događa". Radije javi grešku nego da čekaš u prazno.
    const bail = setTimeout(() => {
      finish((p) => p.reject(new Error('izrada slike je predugo trajala')));
    }, EXPORT_TIMEOUT_MS);

    // Crtež se mora stići postaviti prije izvoza. Logotipi sponzora ugrađeni su
    // kao data URI i moraju se dekodirati, pa jedan okvir zna biti prekratak.
    const id = setTimeout(() => {
      const ref = svgRef.current;
      if (!waiting.current) return;
      if (!ref?.toDataURL) {
        finish((p) => p.reject(new Error('crtež nije spreman za izvoz')));
        return;
      }
      try {
        ref.toDataURL((base64) => {
          if (!base64) finish((p) => p.reject(new Error('izvoz je vratio praznu sliku')));
          else finish((p) => p.resolve(base64));
        });
      } catch (e) {
        finish((p) => p.reject(new Error(`izvoz: ${e instanceof Error ? e.message : String(e)}`)));
      }
    }, 350);

    return () => {
      clearTimeout(id);
      clearTimeout(bail);
    };
  }, [xml]);

  const toPngBase64 = useCallback((svg: string) => {
    return new Promise<string>((resolve, reject) => {
      // Prethodni posao se odbija, inače bi njegovo obećanje ostalo neriješeno
      // i pozivatelj bi zauvijek čekao odgovor koji više nitko ne šalje.
      waiting.current?.reject(new Error('izrada slike je prekinuta novom'));
      waiting.current = { resolve, reject };
      setXml(svg);
    });
  }, []);

  const Renderer = useCallback(
    () =>
      xml ? (
        <View style={styles.offscreen} pointerEvents="none">
          <SvgXml
            xml={xml}
            width={1080}
            height={1350}
            override={{ ref: svgRef, width: 1080, height: 1350 }}
          />
        </View>
      ) : null,
    [xml]
  );

  return { Renderer, toPngBase64 };
}

const styles = StyleSheet.create({
  // Izvan ekrana, ali stvarno nacrtano — prazan izvoz bi nastao da je skriveno
  // kroz display:none ili nultu veličinu.
  offscreen: { position: 'absolute', left: -5000, top: 0, width: 1080, height: 1350 },
});
