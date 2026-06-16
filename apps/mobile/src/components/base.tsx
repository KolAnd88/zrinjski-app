import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F, R, S, type as T } from '../theme';

type TxtVariant = keyof typeof T;

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
  const inner = (
    <View style={padded ? styles.padded : undefined}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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

export function Crest({
  code,
  color,
  size = 48,
}: {
  code?: string | null;
  color?: string | null;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.crest,
        { width: size, height: size, backgroundColor: color || C.card2, borderRadius: R.chip },
      ]}
    >
      <Text style={{ fontFamily: F.head, color: '#fff', fontSize: Math.round(size * 0.34) }}>
        {(code || '?').slice(0, 3).toUpperCase()}
      </Text>
    </View>
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
