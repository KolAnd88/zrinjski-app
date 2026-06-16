import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EventType, Player } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { isoToHHMM } from '../lib/dates';
import { C, F, R, S } from '../theme';
import { Badge, Crest, Txt } from '../components/base';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import type { RootStackParamList } from '../navigation/types';

const EV: { type: EventType; label: StringKey; letter: string; color: string }[] = [
  { type: 'goal', label: 'live.type.goal', letter: 'G', color: C.red },
  { type: 'save', label: 'live.type.save', letter: 'O', color: C.blue },
  { type: 'red_card', label: 'live.type.red', letter: 'R', color: C.redDk },
  { type: 'suspension_2min', label: 'live.type.susp', letter: "2'", color: C.gold },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function AdminLiveScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AdminLive'>>();
  const d = useData();
  const m = d.matchById(params.matchId);

  const [selType, setSelType] = useState<EventType>('goal');
  const running = m?.status === 'live';
  const [sec, setSec] = useState(0);

  useEffect(() => {
    setSec(running ? (m?.current_minute ?? 0) * 60 : 0);
  }, [running, m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const minute = Math.floor(sec / 60);
  useEffect(() => {
    if (running && m) d.setMinute(m.id, minute);
  }, [minute, running]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) {
    return (
      <Screen>
        <Txt color={C.sub}>{t('common.empty')}</Txt>
      </Screen>
    );
  }

  const home = d.teamById(m.home_team_id);
  const away = d.teamById(m.away_team_id);
  const isLive = m.status === 'live';
  const matchEvents = d.eventsOf(m.id);

  const onPlus = (teamId: string, p: Player) => d.addEvent(m.id, teamId, p.id, selType, minute);

  const Roster = ({ team }: { team: typeof home }) => {
    if (!team) return null;
    const roster = d.playersOf(team.id);
    return (
      <View style={styles.roster}>
        <View style={[styles.rosterHead, { backgroundColor: team.color ?? C.card2 }]}>
          <Crest code={team.short_code} color={team.color} size={24} />
          <Txt style={styles.rosterName}>{team.name}</Txt>
        </View>
        {roster.length === 0 ? (
          <Txt color={C.sub} style={{ padding: S.md, fontSize: 13 }}>
            —
          </Txt>
        ) : (
          roster.map((p) => (
            <View key={p.id} style={styles.prow}>
              <Txt style={styles.pnum}>{p.number ?? '–'}</Txt>
              <Txt style={styles.pname} numberOfLines={1}>
                {p.name}
              </Txt>
              <Pressable style={styles.plus} onPress={() => onPlus(team.id, p)}>
                <Txt style={styles.plusTxt}>+</Txt>
              </Pressable>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rezultat + sat */}
        <View style={[styles.scoreCard, isLive && { borderColor: C.red }]}>
          <View style={styles.statusRow}>
            <Badge bg={isLive ? C.red : C.card2} color={isLive ? '#fff' : C.sub}>
              {isLive ? `● ${t('admin.live')}` : m.status === 'finished' ? t('admin.finishedBadge') : t('admin.scheduledBadge')}
            </Badge>
            <Txt style={styles.clock}>{isLive ? `${pad(minute)}:${pad(sec % 60)}` : isoToHHMM(m.scheduled_time)}</Txt>
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.sideCol}>
              <Crest code={home?.short_code} color={home?.color} size={48} />
              <Txt style={styles.sideName} numberOfLines={1}>
                {home?.name ?? '—'}
              </Txt>
            </View>
            <Txt style={styles.score}>
              {m.home_score} : {m.away_score}
            </Txt>
            <View style={styles.sideCol}>
              <Crest code={away?.short_code} color={away?.color} size={48} />
              <Txt style={styles.sideName} numberOfLines={1}>
                {away?.name ?? '—'}
              </Txt>
            </View>
          </View>

          <View style={styles.adjustRow}>
            <View style={styles.adjustGroup}>
              <Pressable style={styles.adjBtn} onPress={() => d.adjustScore(m.id, true, -1)}>
                <Txt style={styles.adjTxt}>−</Txt>
              </Pressable>
              <Txt variant="caption">{t('admin.manual')}</Txt>
              <Pressable style={styles.adjBtn} onPress={() => d.adjustScore(m.id, true, 1)}>
                <Txt style={styles.adjTxt}>+</Txt>
              </Pressable>
            </View>
            <View style={styles.adjustGroup}>
              <Pressable style={styles.adjBtn} onPress={() => d.adjustScore(m.id, false, -1)}>
                <Txt style={styles.adjTxt}>−</Txt>
              </Pressable>
              <Txt variant="caption">{t('admin.manual')}</Txt>
              <Pressable style={styles.adjBtn} onPress={() => d.adjustScore(m.id, false, 1)}>
                <Txt style={styles.adjTxt}>+</Txt>
              </Pressable>
            </View>
          </View>

          <View style={styles.startRow}>
            <PrimaryButton
              label={t('admin.start')}
              disabled={m.status !== 'scheduled'}
              onPress={() => d.startMatch(m.id)}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={t('admin.finish')}
              disabled={!isLive}
              onPress={() => d.finishMatch(m.id)}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* TV mod */}
        <Pressable style={styles.tvLine} onPress={() => nav.navigate('AdminTv', { matchId: m.id })}>
          <Txt style={{ fontFamily: F.bodySemi }}>{t('admin.tvMode')}</Txt>
          <Txt style={{ color: C.red, fontFamily: F.headSemi }}>{t('admin.open')} →</Txt>
        </Pressable>

        {/* Vrsta događaja */}
        <Txt variant="label" style={{ marginTop: S.lg, marginBottom: S.sm }}>
          {t('admin.event')}
        </Txt>
        <View style={styles.chips}>
          {EV.map((e) => (
            <Pressable
              key={e.type}
              onPress={() => setSelType(e.type)}
              style={[styles.chip, selType === e.type && { backgroundColor: C.red, borderColor: C.red }]}
            >
              <Txt style={[styles.chipTxt, selType === e.type && { color: '#fff' }]}>{t(e.label)}</Txt>
            </Pressable>
          ))}
        </View>

        {/* Sastavi */}
        <Txt variant="label" style={{ marginTop: S.lg, marginBottom: S.sm }}>
          {t('admin.rosters')}
        </Txt>
        <View style={styles.rosters}>
          <Roster team={home} />
          <Roster team={away} />
        </View>

        <View style={{ marginTop: S.lg }}>
          <SecondaryButton
            label={t('admin.undo')}
            disabled={matchEvents.length === 0}
            onPress={() => d.undoLastEvent(m.id)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Lokalni mali Screen wrapper (bez ScrollView duplikata).
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxl },
  scoreCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.lg,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md },
  clock: { fontFamily: F.head, fontSize: 18, color: C.sub },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideCol: { alignItems: 'center', gap: S.xs, width: 100 },
  sideName: { fontFamily: F.headSemi, fontSize: 12, textTransform: 'uppercase', textAlign: 'center' },
  score: { fontFamily: F.head, fontSize: 40, color: C.txt },
  adjustRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: S.md },
  adjustGroup: { flexDirection: 'row', alignItems: 'center', gap: S.sm, width: 130, justifyContent: 'center' },
  adjBtn: {
    width: 40,
    height: 40,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjTxt: { fontFamily: F.head, fontSize: 20, color: C.txt },
  startRow: { flexDirection: 'row', gap: S.md, marginTop: S.md },
  tvLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    marginTop: S.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    paddingHorizontal: S.md,
  },
  chipTxt: { fontFamily: F.headSemi, fontSize: 14, color: C.sub },
  rosters: { flexDirection: 'row', gap: S.md },
  roster: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden', backgroundColor: C.card },
  rosterHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm },
  rosterName: { fontFamily: F.head, color: '#fff', fontSize: 13, flexShrink: 1 },
  prow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 6, paddingHorizontal: S.sm, borderTopWidth: 1, borderTopColor: C.line },
  pnum: { width: 22, textAlign: 'center', fontFamily: F.headSemi, color: C.sub, fontSize: 13 },
  pname: { flex: 1, fontFamily: F.body, fontSize: 13 },
  plus: { width: 32, height: 32, borderRadius: R.chip, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { color: '#fff', fontFamily: F.head, fontSize: 18 },
});
