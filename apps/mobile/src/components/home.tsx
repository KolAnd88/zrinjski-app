// home.tsx — komadi Početne koji su dovoljno samostalni da imaju svoje mjesto:
// dekorativna lenta, rotirajuća traka sponzora i odbrojavanje.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
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

/** Razmak među pločicama; širina trake se računa iz njega, ne mjeri. */
const TILE_GAP = 9;

/**
 * Brzina je zadana u PIKSELIMA PO SEKUNDI, ne trajanjem kruga.
 *
 * S fiksnim trajanjem (prije: 14 s po krugu) brzina je ovisila o tome koliko
 * sponzora ima i koliko su pločice široke — mjereno 9,4 px/s za jednog
 * partnera, 37,4 px/s za četvoricu. Isti kod, sasvim drugi dojam. Ovako svaka
 * traka ide jednako, bez obzira na razred i broj sponzora.
 *
 * Jedini broj koji treba dirati ako se traži brže ili sporije.
 */
const MARQUEE_PX_PER_SEC = 40;

/**
 * Veličine pločica po razredu. Svi razredi se vrte, pa razliku nosi isključivo
 * veličina i boja ruba — visina pada od srebrnog prema partnerima.
 */
// Boje ruba su pune, ne prozirne: pločica s logom ima BIJELU podlogu, a
// prozirni sivi/brončani rub na bijelom nestane — pa bi razred nestao točno
// kod sponzora koji su poslali logo, dakle kod većine.
export const MARQUEE_SIZE = {
  silver: { w: 163, h: 78, border: C.silverTxt },
  bronze: { w: 163, h: 60, border: C.bronzeTxt },
  partner: { w: 122, h: 52, border: C.line },
} as const;

export function SponsorMarquee({
  sponsors,
  tier = 'partner',
}: {
  sponsors: MarqueeSponsor[];
  tier?: keyof typeof MARQUEE_SIZE;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const { w, h, border } = MARQUEE_SIZE[tier];
  // Širinu jedne kopije znamo unaprijed. Mjerenje kroz onLayout vraćalo je
  // širinu spremnika (koji je uži od sadržaja), pa se traka pomicala
  // premalo ili nikako.
  const half = sponsors.length * (w + TILE_GAP);

  useEffect(() => {
    if (half <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: -half,
        duration: (half / MARQUEE_PX_PER_SEC) * 1000,
        easing: Easing.linear,
        // Na webu nativni pogon ne pomiče stil, pa bi traka stajala.
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [half, x]);

  if (sponsors.length === 0) return null;
  const doubled = [...sponsors, ...sponsors];

  return (
    <View style={styles.mqMask}>
      <Animated.View
        style={[styles.mqTrack, { width: half * 2, transform: [{ translateX: x }] }]}
      >
        {doubled.map((sp, i) => (
          <View
            key={`${sp.name}-${i}`}
            style={[
              styles.mqTile,
              { width: w, height: h, borderColor: border },
              !!sp.logo_url && styles.mqTileLogo,
            ]}
          >
            {sp.logo_url ? (
              // contain — cijeli logo mora stati u pločicu, nikad obrezan.
              // Podloga je bijela jer logotipi dolaze i kao JPEG s bijelim
              // rubom; na tamnoj pločici bi izgledali kao zakrpa.
              <Image source={{ uri: sp.logo_url }} style={styles.mqLogo} resizeMode="contain" />
            ) : (
              <Txt style={[styles.mqName, tier !== 'partner' && { fontSize: 14 }]} numberOfLines={2}>
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
  mqTrack: { flexDirection: 'row', gap: TILE_GAP },
  mqTile: {
    // Bez ovoga se pločice stisnu na širinu ekrana i traka nema što klizati.
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: R.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  // Rub NE diramo — dolazi iz razreda (MARQUEE_SIZE) i mora ostati vidljiv.
  mqTileLogo: { backgroundColor: '#fff', padding: 9 },
  mqLogo: { width: '100%', height: '100%' },
  mqName: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
    color: C.txt2,
  },
});
