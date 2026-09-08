import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NotificationPrefs } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { C, F, R, S } from '../theme';
import { Crest, Txt } from '../components/base';

const TYPES: { key: keyof NotificationPrefs; label: StringKey }[] = [
  { key: 'team_playing_soon', label: 'notif.teamSoon' },
  { key: 'team_goal', label: 'notif.teamGoal' },
  { key: 'match_end', label: 'notif.matchEnd' },
  { key: 'schedule_change', label: 'notif.scheduleChange' },
  { key: 'program', label: 'notif.program' },
];

export function NotifSettingsScreen() {
  const { t } = useT();
  const nav = useNavigation();
  const d = useData();
  const { prefs, setPref, master, setMaster, followed, toggleFollow, pushSpreman, pokusajPonovno } =
    useFollow();

  useLayoutEffect(() => {
    nav.setOptions({ title: t('notif.title') });
  }, [nav, t]);

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ padding: S.lg, paddingBottom: S.xxl }}>
      {/* Glavni prekidač */}
      <View style={[styles.row, styles.masterRow]}>
        <Txt style={{ fontFamily: F.headSemi, fontSize: 18 }}>{t('notif.master')}</Txt>
        <Switch
          value={master}
          onValueChange={setMaster}
          trackColor={{ true: C.red, false: C.line }}
          thumbColor="#fff"
        />
      </View>

      {/* Uređaj nije registriran, a prekidač je uključen.
          Ovo je dosad prolazilo nijemo: korisnik vidi "uključeno", uređaja
          nema u bazi i obavijesti ne stižu — a nigdje ne piše zašto. */}
      {master && !pushSpreman && (
        <View style={styles.upozorenje}>
          <Txt style={styles.upozorenjeNaslov}>{t('notif.notReadyTitle')}</Txt>
          <Txt style={styles.upozorenjeTekst}>{t('notif.notReadyBody')}</Txt>
          <Pressable onPress={pokusajPonovno} style={styles.upozorenjeGumb} hitSlop={8}>
            <Txt style={styles.upozorenjeGumbTxt}>{t('notif.retry')}</Txt>
          </Pressable>
        </View>
      )}

      {/* Po tipu */}
      <View style={{ opacity: master ? 1 : 0.45 }}>
        {TYPES.map((row) => (
          <View key={row.key} style={styles.row}>
            <Txt style={styles.rowLabel}>{t(row.label)}</Txt>
            <Switch
              value={prefs[row.key]}
              onValueChange={(v) => setPref(row.key, v)}
              disabled={!master}
              trackColor={{ true: C.red, false: C.line }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      {/* Praćene ekipe */}
      <Txt variant="label" style={{ marginTop: S.lg, marginBottom: S.sm }}>
        {t('notif.followed')}
      </Txt>
      {d.teams.map((tm) => {
        const on = followed.includes(tm.id);
        return (
          <Pressable key={tm.id} style={styles.teamRow} onPress={() => toggleFollow(tm.id)}>
            <Crest code={tm.short_code} index={tm.sort_order} logoUrl={tm.logo_url} size={32} />
            <Txt style={styles.rowName}>{tm.name}</Txt>
            <View style={[styles.followPill, on && styles.followOn]}>
              <Txt style={[styles.followTxt, on && { color: '#fff' }]}>
                {on ? '✓' : '+'}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  // Crveni rub, ne cijela crvena ploha: ovo je stanje koje treba popraviti,
  // ne greška zbog koje je nešto propalo.
  upozorenje: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: R.chip,
    padding: S.lg,
    marginTop: S.md,
    gap: 6,
  },
  upozorenjeNaslov: { fontFamily: F.headSemi, fontSize: 15, color: C.txt },
  upozorenjeTekst: { fontSize: 13.5, lineHeight: 19, color: C.txt2 },
  upozorenjeGumb: { minHeight: 44, justifyContent: 'center' },
  upozorenjeGumbTxt: { fontFamily: F.headSemi, fontSize: 14, color: C.redLt },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    marginBottom: S.sm,
  },
  masterRow: { backgroundColor: C.card2 },
  rowLabel: { fontFamily: F.bodySemi, fontSize: 15 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    marginBottom: S.sm,
  },
  rowName: { flex: 1, fontFamily: F.bodySemi, fontSize: 15 },
  followPill: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followOn: { backgroundColor: C.red, borderColor: C.red },
  followTxt: { fontFamily: F.head, color: C.sub, fontSize: 16 },
});
