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
  // Posao nosi redni broj: dvije uzastopne podjele iste utakmice daju isti
  // XML, a bez broja se učinak ne bi ponovno pokrenuo.
  const [job, setJob] = useState<{ xml: string; n: number } | null>(null);
  const svgRef = useRef<SvgRef | null>(null);
  const waiting = useRef<{ resolve: (b64: string) => void; reject: (e: Error) => void } | null>(null);
  /** Traje li nativni izvoz — dok traje, drugi se ne smije pokrenuti. */
  const exporting = useRef(false);
  const counter = useRef(0);

  useEffect(() => {
    if (!job || !waiting.current) return;

    /**
     * Zatvori posao jednom; kasniji poziv (npr. nakon isteka roka) ne radi ništa.
     *
     * Crtež se NAMJERNO ne uklanja iz stabla. Ranije se ovdje radio
     * `setXml(null)`, čime se nativni pogled odspajao dok je izvoz još mogao
     * trajati — a pristup oslobođenom pogledu ruši aplikaciju. Ovisilo je o
     * milisekundama, pa je dijeljenje nekad prošlo, a nekad srušilo app.
     * Crtež ostaje izvan ekrana; košta jedno SVG stablo i ubrza sljedeću
     * podjelu.
     */
    const finish = (fn: (p: NonNullable<typeof waiting.current>) => void) => {
      const pending = waiting.current;
      if (!pending) return;
      waiting.current = null;
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
        exporting.current = true;
        ref.toDataURL((base64) => {
          exporting.current = false;
          if (!base64) finish((p) => p.reject(new Error('izvoz je vratio praznu sliku')));
          else finish((p) => p.resolve(base64));
        });
      } catch (e) {
        exporting.current = false;
        finish((p) => p.reject(new Error(`izvoz: ${e instanceof Error ? e.message : String(e)}`)));
      }
    }, 350);

    return () => {
      clearTimeout(id);
      clearTimeout(bail);
    };
  }, [job]);

  const toPngBase64 = useCallback((svg: string) => {
    return new Promise<string>((resolve, reject) => {
      // Dok nativni izvoz traje, drugi se ne smije pokrenuti: dva istodobna
      // izvoza nad istim pogledom su drugi nacin da se aplikacija sruši.
      if (exporting.current) {
        reject(new Error('izrada slike je već u tijeku'));
        return;
      }
      // Prethodni posao se odbija, inače bi njegovo obećanje ostalo neriješeno
      // i pozivatelj bi zauvijek čekao odgovor koji više nitko ne šalje.
      waiting.current?.reject(new Error('izrada slike je prekinuta novom'));
      waiting.current = { resolve, reject };
      counter.current += 1;
      setJob({ xml: svg, n: counter.current });
    });
  }, []);

  const Renderer = useCallback(
    () =>
      job ? (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <SvgXml
            xml={job.xml}
            width={1080}
            height={1350}
            override={{ ref: svgRef, width: 1080, height: 1350 }}
          />
        </View>
      ) : null,
    [job]
  );

  return { Renderer, toPngBase64 };
}

const styles = StyleSheet.create({
  // Izvan ekrana, ali stvarno nacrtano — prazan izvoz bi nastao da je skriveno
  // kroz display:none ili nultu veličinu. Uz to pogled nosi `collapsable={false}`,
  // jer Android inače izbaci iz nativnog stabla pogled koji služi samo rasporedu,
  // a tada nema što izvesti i ispada prazna ili neispravna slika.
  offscreen: { position: 'absolute', left: -5000, top: 0, width: 1080, height: 1350 },
});
