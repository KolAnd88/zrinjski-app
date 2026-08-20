import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/strings';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { setOnboarded } from '../lib/onboarding';
import { C, F, R, S } from '../theme';
import { Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

export function OnboardingScreen() {
  const { t, locale, setLocale } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const { followed, toggleFollow, master, setMaster } = useFollow();
  const [step, setStep] = useState(0);

  async function finish() {
    await setOnboarded();
    nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.lenta} />

      <View style={styles.brand}>
        <View style={styles.logo}>
          <Txt style={{ fontFamily: F.head, color: '#fff', fontSize: 22 }}>Z</Txt>
        </View>
        <Txt variant="h1">{t('appName')}</Txt>
      </View>

      {/* Koraci (3 točke) */}
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
        ))}
      </View>

      <View style={styles.body}>
        {step === 0 && (
          <>
            <Txt variant="h1" style={styles.title}>
              {t('onb.langTitle')}
            </Txt>
            <Txt color={C.sub} style={styles.sub}>
              {t('onb.langSub')}
            </Txt>
            <View style={{ gap: S.md, marginTop: S.lg }}>
              {(['hr', 'en'] as Locale[]).map((l) => (
                <Pressable
                  key={l}
                  style={[styles.choice, locale === l && styles.choiceOn]}
                  onPress={() => setLocale(l)}
                >
                  <Txt style={[styles.choiceTxt, locale === l && { color: '#fff' }]}>
                    {l === 'hr' ? 'Hrvatski' : 'English'}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Txt variant="h1" style={styles.title}>
              {t('onb.followTitle')}
            </Txt>
            <Txt color={C.sub} style={styles.sub}>
              {t('onb.followSub')}
            </Txt>
            <ScrollView style={{ marginTop: S.md }} contentContainerStyle={{ gap: S.sm }}>
              {d.teams.map((tm) => {
                const on = followed.includes(tm.id);
                return (
                  <Pressable key={tm.id} style={[styles.teamRow, on && styles.teamOn]} onPress={() => toggleFollow(tm.id)}>
                    <Crest code={tm.short_code} index={tm.sort_order} size={32} />
                    <Txt style={styles.teamName}>{tm.name}</Txt>
                    <Txt style={{ fontFamily: F.head, color: on ? C.red : C.mut, fontSize: 18 }}>{on ? '✓' : '+'}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {step === 2 && (
          <>
            <Txt variant="h1" style={styles.title}>
              {t('onb.notifTitle')}
            </Txt>
            <Txt color={C.sub} style={styles.sub}>
              {t('onb.notifSub')}
            </Txt>
            <Pressable
              style={[styles.choice, master && styles.choiceOn, { marginTop: S.lg }]}
              onPress={() => setMaster(!master)}
            >
              <Txt style={[styles.choiceTxt, master && { color: '#fff' }]}>
                {master ? t('onb.enableNotif') + ' ✓' : t('onb.enableNotif')}
              </Txt>
            </Pressable>
          </>
        )}
      </View>

      {/* Akcije */}
      <View style={styles.actions}>
        {step < 2 ? (
          <>
            <Pressable style={styles.primary} onPress={() => setStep((s) => s + 1)}>
              <Txt style={styles.primaryTxt}>{t('onb.next')}</Txt>
            </Pressable>
            <Pressable onPress={() => void finish()}>
              <Txt color={C.sub} style={styles.skip}>
                {t('onb.skip')}
              </Txt>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.primary} onPress={() => void finish()}>
            <Txt style={styles.primaryTxt}>{t('onb.start')}</Txt>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, padding: S.lg },
  lenta: {
    position: 'absolute',
    top: 120,
    left: -40,
    right: -40,
    height: 90,
    backgroundColor: C.redDk,
    opacity: 0.4,
    transform: [{ rotate: '-12deg' }],
  },
  brand: { alignItems: 'center', gap: S.sm, marginTop: S.xl },
  logo: { width: 64, height: 64, borderRadius: 16, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: S.sm, marginTop: S.lg },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.line },
  dotOn: { backgroundColor: C.red, width: 22 },
  body: { flex: 1, marginTop: S.xl },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: S.xs },
  choice: {
    minHeight: 56,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: C.red, borderColor: C.red },
  choiceTxt: { fontFamily: F.headSemi, fontSize: 18, color: C.sub },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
  },
  teamOn: { borderColor: C.red },
  teamName: { flex: 1, fontFamily: F.bodySemi, fontSize: 15 },
  actions: { gap: S.md, alignItems: 'center' },
  primary: {
    backgroundColor: C.red,
    minHeight: 56,
    borderRadius: R.chip,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryTxt: { fontFamily: F.head, color: '#fff', fontSize: 18 },
  skip: { paddingVertical: S.sm },
});
