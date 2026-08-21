import type { ReactNode } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { crestGradientFor } from '@zrinjski/ui-tokens';
import { useData } from '../lib/useData';
import { C, F, R, S, SP, type as T } from '../theme';

type TxtVariant = keyof typeof T;

/**
 * Povuci-za-osvježi vezan na globalni reload podataka.
 * U demo modu (bez baze) vraća undefined — nema što osvježavati.
 * Napomena: na webu je RefreshControl no-op; radi na Androidu/iOS-u.
 */
export function useRefreshControl() {
  const d = useData();
  if (d.demo) return undefined;
  return (
    <RefreshControl
      refreshing={d.reloading}
      onRefresh={() => void d.reload()}
      tintColor={C.red}
      colors={[C.red]}
      progressBackgroundColor={C.card}
    />
  );
}

export function Txt({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: TextProps & { variant?: TxtVariant; color?: string; children?: ReactNode }) {
  return (
    <Text style={[T[variant], color ? { color } : null, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const refreshControl = useRefreshControl();
  const inner = (
    <View style={padded ? styles.padded : undefined}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  accent,
  gold,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: boolean;
  gold?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        accent && { borderColor: C.red },
        gold && { borderColor: C.gold },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Radijus grba prati veličinu (vidi DIZAJN.md): 7 → 9 → 11 → 15 → 17. */
function crestRadius(size: number) {
  if (size <= 26) return 7;
  if (size <= 32) return R.crestSm;
  if (size <= 46) return R.chip;
  if (size <= 60) return R.crestLg;
  return 17;
}

/**
 * Grb ekipe — zaobljeni kvadrat s gradijentom (150°) i 2–3 slovnom kraticom.
 * Dva stanja:
 *  1. `logoUrl` postoji → slika, `resizeMode="contain"` (nikad obrezana)
 *  2. inače → gradijent iz palete po indeksu ekipe
 * Nikad prazna rupa ni generička placeholder ikona.
 *
 * `color` je izlaz za ekipu koja ima izričito upisan `team.color` (npr. domaćin
 * u brend-crvenoj); tada se crta ravna ploha te boje.
 */
export function Crest({
  code,
  color,
  index,
  logoUrl,
  size = 48,
}: {
  code?: string | null;
  color?: string | null;
  index?: number | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const radius = crestRadius(size);
  const label = (code || '?').slice(0, 3).toUpperCase();
  const text = (
    <Text style={{ fontFamily: F.head, color: '#fff', fontSize: Math.round(size * 0.32) }}>
      {label}
    </Text>
  );
  const box = { width: size, height: size, borderRadius: radius, overflow: 'hidden' as const };

  if (logoUrl) {
    return (
      // Iza prozirnog logotipa ide neutralna podloga, ne boja ekipe.
      <View style={[styles.crest, box, { backgroundColor: C.card2 }]}>
        <Image
          source={{ uri: logoUrl }}
          resizeMode="contain"
          style={{ width: size * 0.82, height: size * 0.82 }}
        />
      </View>
    );
  }

  if (color) {
    return <View style={[styles.crest, box, { backgroundColor: color }]}>{text}</View>;
  }

  const g = crestGradientFor(index ?? 0);
  return (
    <LinearGradient
      colors={[g[0], g[1]]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.crest, box]}
    >
      {text}
    </LinearGradient>
  );
}

export function Badge({
  children,
  bg = C.red,
  color = '#fff',
}: {
  children: ReactNode;
  bg?: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ fontFamily: F.head, fontSize: 11, letterSpacing: 1, color }}>{children}</Text>
    </View>
  );
}

/** Točkica koja pulsira nije nužna; jednostavna oznaka UŽIVO. */
export function LiveDot() {
  return <View style={styles.liveDot} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={[T.h2, styles.sectionTitle]}>{children}</Text>;
}

/**
 * Label sekcije iz makete: Oswald 12/600, uppercase, letter-spacing 1.4,
 * margina 22 gore / 9 dolje. `right` je opcionalna akcija ("Cijeli raspored").
 */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelTxt}>{children}</Text>
      {right}
    </View>
  );
}

/** Tekstualni link u plavoj (accent/blue) — "Promijeni", "Cijeli raspored". */
export function LinkTxt({ children, size = 13 }: { children: ReactNode; size?: number }) {
  return <Text style={{ fontFamily: F.bodySemi, fontSize: size, color: C.blue }}>{children}</Text>;
}

/**
 * Hero kartica — gradijent odozgo prema dolje, veći radijus (20px).
 * `live` prebacuje na crvenkastu varijantu s crvenim rubom.
 */
export function HeroCard({
  children,
  live,
  style,
}: {
  children: ReactNode;
  live?: boolean;
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={live ? ['#23090C', C.card, C.cardLo] : [C.cardHi, C.card, C.cardLo]}
      locations={live ? [0, 0.52, 1] : [0, 0.55, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.hero, live ? styles.heroLive : null, style]}
    >
      {children}
    </LinearGradient>
  );
}

/** Pill/chip s rubom — koristi se za UŽIVO badge, CTA i chipove u timelineu. */
export function Pill({
  children,
  bg = 'rgba(255,255,255,.04)',
  border = 'rgba(255,255,255,.07)',
  style,
}: {
  children: ReactNode;
  bg?: string;
  border?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: S.xxl },
  padded: { paddingHorizontal: S.lg, paddingTop: S.md },
  card: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.lg,
    // Sjena iz makete: 0 6px 16px -10px rgba(0,0,0,.8)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  hero: {
    borderRadius: R.hero,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: SP.screenX,
    paddingTop: SP.screenX,
    paddingBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 8,
  },
  heroLive: { borderColor: '#4A1117', shadowColor: C.red, shadowOpacity: 0.4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: R.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: SP.section,
    marginBottom: SP.gap,
    marginHorizontal: SP.hair,
  },
  sectionLabelTxt: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.sub,
  },
  crest: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.chip,
    alignSelf: 'flex-start',
  },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.red },
  sectionTitle: { marginBottom: S.md },
});
