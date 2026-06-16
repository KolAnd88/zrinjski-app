import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Match } from '@zrinjski/core';
import { computeStandings } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { C, F, R, S } from '../theme';
import { Crest, Txt } from '../components/base';
import { MatchRow } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

export function TeamScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Team'>>();
  const d = useData();
  const [tab, setTab] = useState<'squad' | 'matches'>('squad');

  const team = d.teamById(route.params.teamId);

  useLayoutEffect(() => {
    nav.setOptions({
      title: t('team.title'),
      headerRight: () => (
        <Txt color={C.red} style={{ fontFamily: F.headSemi }}>
          {t('live.share')}
        </Txt>
      ),
    });
  }, [nav, t]);

  if (!team) {
    return (
      <View style={styles.safe}>
        <Txt color={C.sub} style={{ padding: S.lg }}>
          {t('common.empty')}
        </Txt>
      </View>
    );
  }

  const players = d.playersOf(team.id);
  const coach = team.coach_name;
  const group = d.groups.find((g) => g.id === team.group_id);

  // Standing iz grupe.
  const cfg = {
    pointsWin: d.tournament?.points_win ?? 2,
    pointsDraw: d.tournament?.points_draw ?? 1,
    pointsLoss: d.tournament?.points_loss ?? 0,
    advancePerGroup: d.tournament?.advance_per_group ?? 2,
  };
  const groupTeams = d.teams.filter((tm) => tm.group_id === team.group_id);
  const groupMatches = d.matches.filter((m) => m.grp_id === team.group_id);
  const standing = group ? computeStandings(groupTeams, groupMatches, cfg).find((r) => r.teamId === team.id) : undefined;

  // Utakmice ekipe.
  const teamMatches = d.matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
  const finished = teamMatches.filter((m) => m.status === 'finished');

  const resultOf = (m: Match) => {
    const isHome = m.home_team_id === team.id;
    const own = isHome ? m.home_score : m.away_score;
    const opp = isHome ? m.away_score : m.home_score;
    const oppTeam = d.teamById(isHome ? m.away_team_id : m.home_team_id);
    const res: { key: StringKey; color: string } =
      own > opp
        ? { key: 'team.resWin', color: C.green }
        : own < opp
          ? { key: 'team.resLoss', color: C.red }
          : { key: 'team.resDraw', color: C.mut };
    return { res, own, opp, oppName: oppTeam?.name ?? '—' };
  };

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ paddingBottom: S.xxl }}>
      {/* Zaglavlje u boji ekipe */}
      <View style={[styles.header, { backgroundColor: team.color ?? C.card2 }]}>
        <Crest code={team.short_code} color="rgba(0,0,0,0.25)" size={84} />
        <View style={{ flex: 1 }}>
          <Txt style={styles.teamName}>{team.name.toUpperCase()}</Txt>
          {standing && (
            <>
              <Txt style={styles.headerMeta}>
                {group?.name} · {standing.rank}. {t('team.place')} · {standing.points} {t('team.pts')}
              </Txt>
              <Txt style={styles.headerSub}>
                {standing.wins} {t('team.w')} · {standing.draws} {t('team.d')} · {standing.losses} {t('team.l')}
              </Txt>
            </>
          )}
        </View>
      </View>

      {/* Tabovi */}
      <View style={styles.tabs}>
        {(['squad', 'matches'] as const).map((tb) => (
          <Pressable key={tb} style={styles.tab} onPress={() => setTab(tb)}>
            <Txt style={[styles.tabTxt, tab === tb && { color: C.txt }]}>
              {tb === 'squad' ? t('team.squad') : t('team.matches')}
            </Txt>
            {tab === tb && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <View style={{ padding: S.lg }}>
        {tab === 'squad' ? (
          <>
            <Txt variant="label" style={{ marginBottom: S.sm }}>
              {t('team.players')}
            </Txt>
            {players.map((p) => (
              <View key={p.id} style={styles.pRow}>
                <View style={styles.pNum}>
                  <Txt style={{ fontFamily: F.headSemi, color: C.sub }}>{p.number ?? '–'}</Txt>
                </View>
                <Txt style={styles.pName}>{p.name}</Txt>
                {p.is_captain && (
                  <View style={styles.capBadge}>
                    <Txt style={{ fontFamily: F.head, color: '#fff', fontSize: 12 }}>K</Txt>
                  </View>
                )}
              </View>
            ))}

            {coach && (
              <View style={styles.coachCard}>
                <Txt variant="label">{t('team.coachLabel')}</Txt>
                <Txt style={{ fontFamily: F.headSemi, fontSize: 18 }}>{coach}</Txt>
              </View>
            )}

            {finished.length > 0 && (
              <>
                <Txt variant="label" style={{ marginTop: S.lg, marginBottom: S.sm }}>
                  {t('team.results')}
                </Txt>
                {finished.map((m) => {
                  const r = resultOf(m);
                  return (
                    <View key={m.id} style={styles.resRow}>
                      <View style={[styles.resDot, { backgroundColor: r.res.color }]} />
                      <Txt style={{ flex: 1 }}>
                        {t(r.res.key)} · {r.oppName}
                      </Txt>
                      <Txt style={{ fontFamily: F.head, fontSize: 16 }}>
                        {r.own}:{r.opp}
                      </Txt>
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <View style={{ gap: S.sm }}>
            {teamMatches.length === 0 ? (
              <Txt color={C.sub}>{t('team.noMatches')}</Txt>
            ) : (
              teamMatches.map((m) => (
                <MatchRow key={m.id} match={m} teamById={d.teamById} onPress={() => nav.navigate('Live', { matchId: m.id })} />
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg, margin: S.lg, borderRadius: R.card },
  teamName: { fontFamily: F.head, fontSize: 24, color: '#fff' },
  headerMeta: { fontFamily: F.bodySemi, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  headerSub: { fontFamily: F.body, color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, marginHorizontal: S.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: S.md },
  tabTxt: { fontFamily: F.headSemi, fontSize: 16, color: C.sub },
  tabUnderline: { height: 2, backgroundColor: C.red, alignSelf: 'stretch', marginTop: 8 },
  pRow: {
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
  pNum: { width: 36, height: 36, borderRadius: 999, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  pName: { flex: 1, fontFamily: F.headSemi, fontSize: 18 },
  capBadge: { backgroundColor: C.red, borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 4 },
  coachCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    marginTop: S.sm,
  },
  resRow: {
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
  resDot: { width: 10, height: 10, borderRadius: 999 },
});
