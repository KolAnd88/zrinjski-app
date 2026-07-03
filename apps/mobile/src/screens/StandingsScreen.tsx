import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Gender, Grp, Match } from '@zrinjski/core';
import { buildBracket, computeStandings, type StandingRow } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { C, F, R, S } from '../theme';
import { Crest, Txt, useRefreshControl } from '../components/base';
import { GenderToggle, MatchRow } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

export function StandingsScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const [gender, setGender] = useState<Gender>('m');
  const refreshControl = useRefreshControl();

  const groups = d.groups.filter((g) => g.gender === gender);
  const cfg = {
    pointsWin: d.tournament?.points_win ?? 2,
    pointsDraw: d.tournament?.points_draw ?? 1,
    pointsLoss: d.tournament?.points_loss ?? 0,
    advancePerGroup: d.tournament?.advance_per_group ?? 2,
  };

  const standingsOf = (g: Grp): StandingRow[] => {
    const teams = d.teams.filter((tm) => tm.group_id === g.id);
    const matches = d.matches.filter((m) => m.grp_id === g.id);
    return computeStandings(teams, matches, cfg);
  };

  const groupMatches = (g: Grp): Match[] =>
    d.matches
      .filter((m) => m.grp_id === g.id)
      .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));

  // Bracket (treba 2 grupe).
  const bracket =
    groups.length >= 2
      ? buildBracket({ gender, groupA: standingsOf(groups[0]!), groupB: standingsOf(groups[1]!) })
      : [];

  const codeOf = (teamId: string | null, ph: string) =>
    teamId ? d.teamById(teamId)?.short_code ?? ph : ph;
  const colorOf = (teamId: string | null) => (teamId ? d.teamById(teamId)?.color : null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={styles.head}>
          <Txt variant="h1">{t('standings.title').toUpperCase()}</Txt>
        </View>
        <GenderToggle value={gender} onChange={setGender} />

        {groups.map((g) => {
          const rows = standingsOf(g);
          return (
            <View key={g.id} style={{ marginTop: S.lg }}>
              <Txt variant="label" style={{ marginBottom: S.sm }}>
                {g.name}
              </Txt>

              {/* Tablica */}
              <View style={styles.table}>
                <View style={[styles.trow, styles.thead]}>
                  <Txt style={[styles.cRank]}> </Txt>
                  <Txt style={styles.cName}> </Txt>
                  <Txt style={styles.cNum}>{t('standings.colPlayed')}</Txt>
                  <Txt style={styles.cNum}>{t('standings.gd')}</Txt>
                  <Txt style={styles.cNum}>{t('standings.pts')}</Txt>
                </View>
                {rows.map((r) => (
                  <Pressable key={r.teamId} style={styles.trow} onPress={() => nav.navigate('Team', { teamId: r.teamId })}>
                    <Txt style={[styles.cRank, r.qualifies && { color: C.green }]}>{r.rank}</Txt>
                    <View style={[styles.cName, styles.nameCell]}>
                      <Crest code={d.teamById(r.teamId)?.short_code} color={d.teamById(r.teamId)?.color} size={22} />
                      <Txt numberOfLines={1} style={styles.teamName}>
                        {r.teamName}
                      </Txt>
                    </View>
                    <Txt style={styles.cNum}>{r.played}</Txt>
                    <Txt style={styles.cNum}>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</Txt>
                    <Txt style={[styles.cNum, styles.pts]}>{r.points}</Txt>
                  </Pressable>
                ))}
              </View>
              <Txt variant="caption" color={C.green} style={{ marginTop: 4 }}>
                {t('standings.advance')}
              </Txt>

              {/* Raspored grupe */}
              <View style={{ marginTop: S.sm, gap: S.sm }}>
                {groupMatches(g).map((m) => (
                  <MatchRow key={m.id} match={m} teamById={d.teamById} onPress={() => nav.navigate('Live', { matchId: m.id })} />
                ))}
              </View>
            </View>
          );
        })}

        {/* Završnica */}
        {bracket.length > 0 && (
          <View style={{ marginTop: S.xl }}>
            <Txt variant="h2" style={{ marginBottom: S.sm }}>
              {t('standings.bracket')}
            </Txt>
            {bracket.map((bm) => {
              const isFinal = bm.key === 'final';
              return (
                <View key={bm.key} style={[styles.bcard, isFinal && styles.bcardFinal]}>
                  <Txt variant="label" color={isFinal ? C.gold : C.sub}>
                    {bm.label}
                  </Txt>
                  <View style={styles.brow}>
                    <View style={styles.bside}>
                      <Crest code={codeOf(bm.home.teamId, bm.home.placeholder)} color={colorOf(bm.home.teamId)} size={24} />
                      <Txt numberOfLines={1} style={styles.bname}>
                        {bm.home.teamId ? d.teamById(bm.home.teamId)?.name : bm.home.placeholder}
                      </Txt>
                    </View>
                    <Txt style={styles.bvs}>{t('common.vs')}</Txt>
                    <View style={[styles.bside, { justifyContent: 'flex-end' }]}>
                      <Txt numberOfLines={1} style={[styles.bname, { textAlign: 'right' }]}>
                        {bm.away.teamId ? d.teamById(bm.away.teamId)?.name : bm.away.placeholder}
                      </Txt>
                      <Crest code={codeOf(bm.away.teamId, bm.away.placeholder)} color={colorOf(bm.away.teamId)} size={24} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxl },
  head: { marginBottom: S.md },
  table: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  thead: { backgroundColor: C.card2 },
  cRank: { width: 24, fontFamily: F.head, color: C.txt, fontSize: 14 },
  cName: { flex: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  teamName: { fontFamily: F.bodySemi, fontSize: 14, flexShrink: 1 },
  cNum: { width: 38, textAlign: 'center', fontFamily: F.body, color: C.sub, fontSize: 13 },
  pts: { fontFamily: F.head, color: C.txt, fontSize: 15 },
  bcard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    marginBottom: S.sm,
    gap: S.sm,
  },
  bcardFinal: { borderColor: C.gold, backgroundColor: 'rgba(217,178,74,0.05)' },
  brow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bside: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bname: { flex: 1, fontFamily: F.bodySemi, fontSize: 13 },
  bvs: { color: C.mut, fontSize: 12 },
});
