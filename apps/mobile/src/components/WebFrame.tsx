import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { C } from '../theme';

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
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web' || width <= PHONE_MAX) return <>{children}</>;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.column, shadow]}>{children}</View>
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
