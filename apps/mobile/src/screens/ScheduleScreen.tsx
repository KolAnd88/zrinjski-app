import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { crestPair } from '@zrinjski/ui-tokens';
import { pickCurrentDayId } from '@zrinjski/core';
import type { Match, ProgramItem } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { openMaps } from '../lib/maps';
import { dayMonth, isoToHHMM, timeToHHMM, weekdayShort } from '../lib/dates';
import { C, F, R, SP } from '../theme';
import { BrandStripe } from '../components/home';
import { Crest, Txt, useRefreshControl } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

type Row =
  | { kind: 'match'; time: string; match: Match }
  | { kind: 'program'; time: string; item: ProgramItem };

export function ScheduleScreen() {
  const { t, locale } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const [dayId, setDayId] = useState('');
  const refreshControl = useRefreshControl();

  // Dani stižu asinkrono; otvori TEKUĆI dan čim su tu, ali ne gazi korisnikov
  // odabir. Dok turnir traje gledatelj želi današnji raspored, ne prvi dan.
  useEffect(() => {
    if (dayId || d.days.length === 0) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const id = pickCurrentDayId(d.days, todayIso);
    if (id) setDayId(id);
  }, [d.days, dayId]);

  const rows: Row[] = [
    ...d.matches
      .filter((m) => m.day_id === dayId)
      .map((m) => ({ kind: 'match' as const, time: isoToHHMM(m.scheduled_time), match: m })),
    ...d.program
      .filter((p) => p.day_id === dayId)
      .map((p) => ({ kind: 'program' as const, time: timeToHHMM(p.time), item: p })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      <View style={styles.titleWrap}>
        <Txt style={styles.title}>{t('schedule.title').toUpperCase()}</Txt>
      </View>

      {/* Birač dana — svi dani stanu u red, jednake širine */}
      <View style={styles.days}>
        {d.days.map((day) => {
          const on = day.id === dayId;
          const inner = (
            <>
              <Txt style={[styles.dayDow, on && styles.dayDowOn]}>{weekdayShort(day.date, locale)}</Txt>
              <Txt style={styles.dayDate}>{dayMonth(day.date)}</Txt>
            </>
          );
          return (
            <Pressable key={day.id} style={{ flex: 1 }} onPress={() => setDayId(day.id)}>
              {on ? (
                <LinearGradient
                  colors={[C.red, C.redDk]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={[styles.dayTab, styles.dayTabOn]}
                >
                  {inner}
                </LinearGradient>
              ) : (
                <View style={styles.dayTab}>{inner}</View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {rows.length === 0 && <Txt color={C.sub}>{t('common.empty')}</Txt>}

        {rows.map((row, i) => {
          const isLive = row.kind === 'match' && row.match.status === 'live';
          const isFinal = row.kind === 'match' && row.match.stage === 'final';
          const last = i === rows.length - 1;
          return (
            <View key={row.kind === 'match' ? row.match.id : row.item.id} style={styles.tlRow}>
              <Txt style={styles.tlTime}>{row.time}</Txt>

              {/* Okomita crta ide kroz sve redove osim zadnjeg */}
              <View style={styles.tlGutter}>
                <View style={[styles.tlDot, isLive && styles.tlDotLive]} />
                {!last && <View style={styles.tlBar} />}
              </View>

              <View style={styles.tlBody}>
                {row.kind === 'match' ? (
                  <MatchRow
                    match={row.match}
                    isFinal={isFinal}
                    onPress={() => nav.navigate('Live', { matchId: row.match.id })}
                  />
                ) : (
                  <ProgramRow item={row.item} />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchRow({ match, isFinal, onPress }: { match: Match; isFinal: boolean; onPress: () => void }) {
  const { t } = useT();
  const d = useData();
  const home = d.teamById(match.home_team_id);
  const away = d.teamById(match.away_team_id);
  const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 0);

  return (
    <>
      {isFinal && (
        <View style={styles.finalTag}>
          <Txt style={styles.finalTagTxt}>{t('schedule.final').toUpperCase()}</Txt>
        </View>
      )}
      <Pressable onPress={onPress} style={[styles.card, isFinal && styles.cardFinal]}>
        <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={28} />
        <Txt style={styles.teamName} numberOfLines={1}>
          {home?.name ?? match.home_placeholder}
        </Txt>

        <View style={styles.mid}>
          {match.status === 'live' ? (
            <LinearGradient
              colors={[C.red, C.redDk]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.livePill}
            >
              <Txt style={styles.livePillTxt}>
                {t('common.live')} {match.home_score}:{match.away_score}
              </Txt>
            </LinearGradient>
          ) : match.status === 'finished' ? (
            <>
              <Txt style={styles.doneScore}>
                {match.home_score}:{match.away_score}
              </Txt>
              <Txt style={styles.doneLabel}>{t('common.finished')}</Txt>
            </>
          ) : (
            <Txt style={styles.vs}>{t('common.vs')}</Txt>
          )}
        </View>

        <Txt style={[styles.teamName, styles.teamNameRight]} numberOfLines={1}>
          {away?.name ?? match.away_placeholder}
        </Txt>
        <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={28} />
      </Pressable>
    </>
  );
}

function ProgramRow({ item }: { item: ProgramItem }) {
  const { t } = useT();
  const d = useData();
  const loc = d.locations.find((l) => l.id === item.location_id);
  // Večera i dodjela su zlatne (svečani dio); ostalo prigušeno.
  const gold = /dodjel|večer|vecer/i.test(item.title);

  return (
    <View style={styles.progCard}>
      <Ionicons
        name={gold ? 'trophy-outline' : 'cafe-outline'}
        size={17}
        color={gold ? C.gold : C.sub}
      />
      <Txt style={styles.progTitle} numberOfLines={1}>
        {item.title}
      </Txt>
      {loc?.lat != null && loc.lng != null && (
        <Pressable style={styles.mapBtn} onPress={() => openMaps(loc.lat!, loc.lng!, loc.name)}>
          <Txt style={styles.mapBtnTxt}>{t('common.map')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleWrap: { paddingHorizontal: SP.headerX, paddingTop: 8, paddingBottom: 6 },
  title: { fontFamily: F.head, fontSize: 28, letterSpacing: 0.6, color: C.txt },

  days: { flexDirection: 'row', gap: SP.gap, paddingHorizontal: SP.screenX, paddingTop: 8, paddingBottom: SP.cardGap },
  dayTab: {
    alignItems: 'center',
    paddingVertical: SP.gap,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  dayTabOn: {
    borderColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  dayDow: { fontFamily: F.body, fontSize: 11, letterSpacing: 0.4, color: C.sub },
  dayDowOn: { color: 'rgba(255,255,255,.85)' },
  dayDate: { fontFamily: F.head, fontSize: 16, color: C.txt },

  content: { paddingHorizontal: SP.screenX, paddingTop: 6, paddingBottom: 28 },

  // Timeline: 44px vrijeme · 22px žlijeb s točkom i crtom · kartica
  tlRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tlTime: {
    width: 44,
    textAlign: 'right',
    fontFamily: F.headSemi,
    fontSize: 13,
    color: C.sub,
    paddingTop: 11,
  },
  tlGutter: { width: 22, alignItems: 'center', alignSelf: 'stretch' },
  tlDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: C.mut,
    borderWidth: 2,
    borderColor: C.bg,
    marginTop: SP.cardGap,
  },
  tlDotLive: {
    backgroundColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  tlBar: { flex: 1, width: 2, backgroundColor: C.lineSub, marginTop: 2 },
  tlBody: { flex: 1, marginBottom: SP.cardGap },

  finalTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 7,
    marginTop: 8,
  },
  finalTagTxt: { fontFamily: F.headSemi, fontSize: 11, letterSpacing: 1.4, color: C.gold },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingVertical: SP.rowY,
    paddingHorizontal: SP.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  cardFinal: { borderColor: 'rgba(217,178,74,.5)' },
  teamName: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  teamNameRight: { textAlign: 'right' },

  mid: { minWidth: 60, alignItems: 'center' },
  livePill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  livePillTxt: { fontFamily: F.head, fontSize: 11, color: '#fff' },
  doneScore: { fontFamily: F.head, fontSize: 16, color: C.sub },
  doneLabel: { fontFamily: F.headSemi, fontSize: 9, letterSpacing: 1, color: C.mut, marginTop: 1 },
  vs: { fontFamily: F.headSemi, fontSize: 14, color: C.mut },

  progCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.rowY,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: SP.rowY,
    paddingHorizontal: SP.divider,
    marginTop: 8,
  },
  progTitle: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  mapBtn: {
    borderWidth: 1,
    borderColor: 'rgba(45,108,223,.55)',
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  mapBtnTxt: { fontFamily: F.bodySemi, fontSize: 12, color: C.blue },
});
