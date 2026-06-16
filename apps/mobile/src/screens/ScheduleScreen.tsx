import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Match, ProgramItem } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { openMaps } from '../lib/maps';
import { isoToHHMM, tabLabel, dayTitle, timeToHHMM } from '../lib/dates';
import { C, F, R, S } from '../theme';
import { Badge, Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

type Row =
  | { kind: 'match'; time: string; match: Match }
  | { kind: 'program'; time: string; item: ProgramItem };

export function ScheduleScreen() {
  const { t, locale } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const [dayId, setDayId] = useState(d.days[0]?.id ?? '');

  const stageLabel = (m: Match): string =>
    m.stage === 'group'
      ? d.groups.find((g) => g.id === m.grp_id)?.name ?? t('team.group')
      : m.stage === 'semifinal'
        ? t('standings.semifinal')
        : m.stage === 'third_place'
          ? t('standings.thirdPlace')
          : t('schedule.final');

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Txt variant="h1">{t('schedule.title').toUpperCase()}</Txt>

        {/* Dani */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {d.days.map((day) => (
            <Pressable
              key={day.id}
              onPress={() => setDayId(day.id)}
              style={[styles.dayTab, dayId === day.id && styles.dayTabOn]}
            >
              <Txt style={[styles.dayTabTxt, dayId === day.id && { color: '#fff' }]}>
                {tabLabel(day.date, locale)}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>

        {d.days.find((x) => x.id === dayId) && (
          <Txt variant="label" style={{ marginBottom: S.sm }}>
            {dayTitle(d.days.find((x) => x.id === dayId)!.date, locale)}
          </Txt>
        )}

        {/* Timeline */}
        <View>
          {rows.map((row, i) => {
            const isFinal = row.kind === 'match' && row.match.stage === 'final';
            const dotColor = row.kind === 'program' ? C.blue : isFinal ? C.gold : C.red;
            return (
              <View key={i} style={styles.tlRow}>
                <Txt style={styles.tlTime}>{row.time}</Txt>
                <View style={styles.tlLine}>
                  <View style={[styles.tlDot, { backgroundColor: dotColor }]} />
                  {i < rows.length - 1 && <View style={styles.tlBar} />}
                </View>
                <View style={styles.tlCard}>
                  {row.kind === 'match' ? (
                    <MatchCard match={row.match} stage={stageLabel(row.match)} onPress={() => nav.navigate('Live', { matchId: row.match.id })} />
                  ) : (
                    <ProgramCard item={row.item} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchCard({ match, stage, onPress }: { match: Match; stage: string; onPress: () => void }) {
  const { t } = useT();
  const d = useData();
  const home = d.teamById(match.home_team_id);
  const away = d.teamById(match.away_team_id);
  const isFinal = match.stage === 'final';
  const unknown = !home && !away;

  return (
    <Pressable onPress={onPress} style={[styles.card, isFinal && styles.cardFinal]}>
      <Txt variant="label" color={isFinal ? C.gold : C.sub}>
        {isFinal ? t('schedule.final') : stage}
      </Txt>
      {unknown ? (
        <Txt style={styles.placeholderLine}>
          {match.home_placeholder} / {match.away_placeholder}
        </Txt>
      ) : (
        <View style={styles.cardRow}>
          <Crest code={home?.short_code} color={home?.color} size={26} />
          <Txt style={styles.code}>{home?.short_code}</Txt>
          <View style={styles.cardMid}>
            {match.status === 'live' ? (
              <Badge bg={C.red}>{t('common.live')}</Badge>
            ) : match.status === 'finished' ? (
              <Badge bg={C.red}>
                {match.home_score}:{match.away_score}
              </Badge>
            ) : (
              <Txt style={styles.vs}>{t('common.vs')}</Txt>
            )}
          </View>
          <Txt style={[styles.code, { textAlign: 'right' }]}>{away?.short_code}</Txt>
          <Crest code={away?.short_code} color={away?.color} size={26} />
        </View>
      )}
    </Pressable>
  );
}

function ProgramCard({ item }: { item: ProgramItem }) {
  const { t } = useT();
  const d = useData();
  const loc = d.locations.find((l) => l.id === item.location_id);
  return (
    <View style={styles.card}>
      <View style={styles.progRow}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontFamily: F.head, fontSize: 18 }}>{item.title}</Txt>
          {loc && <Txt variant="caption">{loc.name}</Txt>}
        </View>
        {loc?.lat != null && loc.lng != null && (
          <Pressable style={styles.mapBtn} onPress={() => openMaps(loc.lat!, loc.lng!, loc.name)}>
            <Txt style={{ color: C.blue, fontFamily: F.bodySemi }}>{t('common.map')}</Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxl },
  days: { gap: S.sm, paddingVertical: S.md },
  dayTab: {
    paddingHorizontal: S.lg,
    height: 44,
    justifyContent: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
  },
  dayTabOn: { backgroundColor: C.red, borderColor: C.red },
  dayTabTxt: { fontFamily: F.headSemi, fontSize: 15, color: C.sub },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  tlTime: { width: 52, fontFamily: F.headSemi, color: C.sub, fontSize: 13, paddingTop: S.lg },
  tlLine: { width: 16, alignItems: 'center', alignSelf: 'stretch' },
  tlDot: { width: 12, height: 12, borderRadius: 999, marginTop: S.lg },
  tlBar: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 2 },
  tlCard: { flex: 1, marginBottom: S.md },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    gap: S.sm,
  },
  cardFinal: { borderColor: C.gold, backgroundColor: 'rgba(217,178,74,0.05)' },
  placeholderLine: { fontFamily: F.bodySemi, fontSize: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  code: { flex: 1, fontFamily: F.head, fontSize: 16 },
  cardMid: { minWidth: 56, alignItems: 'center' },
  vs: { color: C.mut, fontSize: 13 },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  mapBtn: { borderWidth: 1, borderColor: C.blue, borderRadius: R.chip, paddingVertical: 8, paddingHorizontal: S.md },
});
