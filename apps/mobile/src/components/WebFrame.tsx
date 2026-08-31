import { createContext, useContext, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { C } from '../theme';

/**
 * Stvarni okvir u kojem aplikacija živi.
 *
 * Na uređaju je to prozor, ali u web prikazu aplikacija stoji u stupcu širine
 * telefona usred širokog ekrana — a `useWindowDimensions` ondje i dalje vraća
 * cijeli ekran. Sve što se ravna po obliku kadra (npr. lenta) mora znati
 * širinu STUPCA, inače na laptopu ispadne dvostruko predebelo i pod krivim
 * kutom. `onLayout` se za to pokazao nepouzdanim (na webu ne okida), pa okvir
 * javlja onaj tko ga jedini pouzdano zna — WebFrame.
 */
const FrameCtx = createContext<{ w: number; h: number } | null>(null);

export function useAppFrame(): { w: number; h: number } {
  const { width, height } = useWindowDimensions();
  const okvir = useContext(FrameCtx);
  return okvir ?? { w: width, h: height };
}

/** Iznad ove širine prozor sigurno nije telefon. */
const PHONE_MAX = 560;
/** Širina stupca na širokom ekranu — otprilike veći telefon. */
const COLUMN = 430;

/**
 * Okvir za WEB prikaz aplikacije.
 *
 * Isti QR kod otvara iPhone i laptop. Na laptopu se telefonsko sučelje inače
 * razvuče preko cijele širine — traka kartica preko 1280 px, redovi razvučeni,
 * praznine posvuda. Ovdje se sadržaj drži u stupcu širine telefona i centrira.
 *
 * Na uređaju (iOS/Android) i na uskom pregledniku ovo NE radi ništa: vraća
 * djecu takva kakva jesu, bez ijednog dodatnog pogleda u stablu.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const okvir = useMemo(() => ({ w: COLUMN, h: height }), [height]);

  if (Platform.OS !== 'web' || width <= PHONE_MAX) return <>{children}</>;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.column, shadow]}>
        <FrameCtx.Provider value={okvir}>{children}</FrameCtx.Provider>
      </View>
    </View>
  );
}

// Sjena se na webu zadaje kroz boxShadow; RN-ove shadow* vrijednosti ondje
// ispisuju upozorenje o zastarjelosti.
const shadow = { boxShadow: '0 0 60px rgba(0,0,0,.55)' } as unknown as ViewStyle;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    // Podloga je tamnija od aplikacije da se stupac jasno odvoji od pozadine.
    backgroundColor: '#08090B',
  },
  column: {
    flex: 1,
    width: COLUMN,
    maxWidth: '100%',
    backgroundColor: C.bg,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
});
