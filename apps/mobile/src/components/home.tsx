// home.tsx — komadi Početne koji su dovoljno samostalni da imaju svoje mjesto:
// dekorativna lenta, rotirajuća traka sponzora i odbrojavanje.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, R, SP } from '../theme';
import { Txt } from './base';

/**
 * Dijagonalna crvena lenta — brend element iz makete (rotacija -62°, opacity .15).
 * Čisto dekorativno, ispod sadržaja.
 */
export function BrandStripe() {
  return (
    <View pointerEvents="none" style={styles.stripeWrap}>
      <LinearGradient
        colors={['transparent', 'rgba(156,12,24,.55)', 'rgba(225,29,42,.62)', 'transparent']}
        locations={[0, 0.38, 0.62, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.stripe}
      />
    </View>
  );
}

/** Sekunde → "1:12:03" (s satima) ili "12:03". */
export function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Odbrojavanje do zadanog trenutka; osvježava se svake sekunde.
 * Vraća null kad nema mete ili je vrijeme prošlo — pozivatelj tada ništa ne crta.
 */
export function useCountdown(targetIso: string | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const diff = (new Date(targetIso).getTime() - now) / 1000;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return formatCountdown(diff);
}

/**
 * Beskonačna traka sponzora. Popis se crta dvaput i pomiče za točno pola
 * širine — kad dođe do kraja prve kopije, skok na početak je nevidljiv.
 */
/** Sponzor u traci: logo ako postoji, inače ime. */
export type MarqueeSponsor = { name: string; logo_url: string | null };

export function SponsorMarquee({
  sponsors,
  durationMs = 22000,
}: {
  sponsors: MarqueeSponsor[];
  durationMs?: number;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const [half, setHalf] = useState(0);

  useEffect(() => {
    if (half <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: -half,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [half, durationMs, x]);

  if (sponsors.length === 0) return null;
  const doubled = [...sponsors, ...sponsors];

  return (
    <View style={styles.mqMask}>
      <Animated.View
        style={[styles.mqTrack, { transform: [{ translateX: x }] }]}
        onLayout={(e) => setHalf(e.nativeEvent.layout.width / 2)}
      >
        {doubled.map((sp, i) => (
          <View key={`${sp.name}-${i}`} style={[styles.mqTile, sp.logo_url && styles.mqTileLogo]}>
            {sp.logo_url ? (
              // contain — cijeli logo mora stati u pločicu, nikad obrezan.
              // Podloga je bijela jer logotipi dolaze i kao JPEG s bijelim
              // rubom; na tamnoj pločici bi izgledali kao zakrpa.
              <Image source={{ uri: sp.logo_url }} style={styles.mqLogo} resizeMode="contain" />
            ) : (
              <Txt style={styles.mqName} numberOfLines={1}>
                {sp.name}
              </Txt>
            )}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stripeWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: '42%',
    left: '-120%',
    right: '-120%',
    height: 178,
    opacity: 0.15,
    transform: [{ rotate: '-62deg' }],
  },
  mqMask: { overflow: 'hidden' },
  mqTrack: { flexDirection: 'row', gap: SP.gap },
  mqTile: {
    width: 110,
    height: 50,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  mqTileLogo: { backgroundColor: '#fff', borderColor: 'rgba(255,255,255,.25)', padding: 6 },
  mqLogo: { width: '100%', height: '100%' },
  mqName: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 0.5,
    color: C.sub,
  },
});
