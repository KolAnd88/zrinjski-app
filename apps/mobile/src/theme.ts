// theme.ts — tema mobilne app iz dijeljenih tokena (@zrinjski/ui-tokens).
// Tamna tema je jedina. Crvena = akcent/UŽIVO; zlatna SAMO finale + zlatni sponzor.
import { colors, radius, spacing } from '@zrinjski/ui-tokens';
import { TextStyle } from 'react-native';

export const C = colors;
export const S = spacing;
export const R = radius;

// Obitelji fontova (@expo-google-fonts).
export const F = {
  head: 'Oswald_700Bold',
  headSemi: 'Oswald_600SemiBold',
  headMed: 'Oswald_500Medium',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const fontsToLoad = {
  // Popunjava se u App.tsx iz @expo-google-fonts paketa.
};

// Tipografske presete (vidi DIZAJN.md skalu).
export const type = {
  display: { fontFamily: F.head, fontSize: 56, color: C.txt } as TextStyle,
  h1: { fontFamily: F.head, fontSize: 26, color: C.txt } as TextStyle,
  h2: {
    fontFamily: F.headSemi,
    fontSize: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.txt,
  } as TextStyle,
  label: {
    fontFamily: F.head,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.sub,
  } as TextStyle,
  body: { fontFamily: F.body, fontSize: 15, color: C.txt } as TextStyle,
  bodyStrong: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt } as TextStyle,
  caption: { fontFamily: F.body, fontSize: 12, color: C.sub } as TextStyle,
};

export const TOUCH = 44;
