import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LENTA, LENTA_RN } from '@zrinjski/ui-tokens';

/**
 * Dijagonalna lenta — isti znak kao na dresu Zrinjskog.
 *
 * Oblik i kut dolaze iz `packages/ui-tokens/src/lenta.ts`, zajedno sa
 * slikom rezultata, plakatom i TV prikazom. Ovdje se samo slaže od
 * pogleda, jer React Native u pozadini nema SVG.
 *
 * Čisto dekorativno i uvijek ispod sadržaja — ne prima dodire.
 */
export function Lenta({
  cy = 0.5,
  thickness,
  strength = LENTA.strength.soft,
  gold = false,
}: {
  /** Sredina lente po visini roditelja, 0..1. */
  cy?: number;
  /** Debljina u točkama; podrazumijevano po kraćoj strani ekrana. */
  thickness?: number;
  strength?: number;
  /** Zlatna nit — samo finale i zlatni pokrovitelj. */
  gold?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const debljina = thickness ?? Math.round(Math.min(width, height) * LENTA.band);
  // Nit i razmak drže isti odnos prema lenti kao u SVG inačici.
  const nit = Math.max(2, Math.round((debljina * LENTA.hairline) / LENTA.band));
  const razmak = Math.round((debljina * LENTA.gap) / LENTA.band);

  const vodoravno = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } as const;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap]}>
      <View
        style={[
          styles.rot,
          {
            top: `${cy * 100}%`,
            marginTop: -(debljina / 2 + razmak + nit),
            opacity: strength,
          },
        ]}
      >
        <LinearGradient
          colors={[...(gold ? LENTA_RN.nitGold : LENTA_RN.nit)]}
          locations={[0, 0.5, 1]}
          {...vodoravno}
          style={{ height: nit }}
        />
        <View style={{ height: razmak }} />
        <LinearGradient
          colors={[...LENTA_RN.colors]}
          locations={[...LENTA_RN.locations]}
          {...vodoravno}
          style={{ height: debljina }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Kadar reže lentu, kao što šav reže lentu na dresu.
  wrap: { overflow: 'hidden' },
  rot: {
    position: 'absolute',
    // Pod 30° lenta mora biti šira od ekrana da joj krajevi padnu izvan kadra.
    left: '-60%',
    right: '-60%',
    transform: [{ rotate: `${LENTA.angleDeg}deg` }],
  },
});
