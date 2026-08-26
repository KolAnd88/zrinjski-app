import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

type SvgRef = { toDataURL: (cb: (base64: string) => void, options?: object) => void };

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

    // Jedan okvir da se crtež stigne postaviti prije izvoza.
    const id = setTimeout(() => {
      const ref = svgRef.current;
      const pending = waiting.current;
      if (!pending) return;
      if (!ref?.toDataURL) {
        waiting.current = null;
        setXml(null);
        pending.reject(new Error('svg_export_unavailable'));
        return;
      }
      ref.toDataURL((base64) => {
        waiting.current = null;
        setXml(null);
        pending.resolve(base64);
      });
    }, 120);

    return () => clearTimeout(id);
  }, [xml]);

  const toPngBase64 = useCallback((svg: string) => {
    return new Promise<string>((resolve, reject) => {
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
