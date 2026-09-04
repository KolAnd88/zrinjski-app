import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Match } from '@zrinjski/core';
import { computeStandings } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { dayMonth, isoToHHMM } from '../lib/dates';
import { C, F, R, SP } from '../theme';
import { Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

export function TeamScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Team'>>();
  const d = useData();
  const { isFollowing, toggleFollow } = useFollow();
  const [tab, setTab] = useState<'squad' | 'matches'>('squad');

  const team = d.teamById(route.params.teamId);

  useLayoutEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

  if (!team) {
    return (
      <SafeAreaView style={styles.safe}>
        <Txt color={C.sub} style={{ padding: SP.screenX }}>
          {t('common.empty')}
        </Txt>
      </SafeAreaView>
    );
  }

  const players = d.playersOf(team.id);
  const group = d.groups.find((g) => g.id === team.group_id);
  const following = isFollowing(team.id);

  const cfg = {
    pointsWin: d.tournament?.points_win ?? 2,
    pointsDraw: d.tournament?.points_draw ?? 1,
    pointsLoss: d.tournament?.points_loss ?? 0,
    advancePerGroup: d.tournament?.advance_per_group ?? 2,
  };
  const groupTeams = d.teams.filter((tm) => tm.group_id === team.group_id);
  const groupMatches = d.matches.filter((m) => m.grp_id === team.group_id);
  const standing = group
    ? computeStandings(groupTeams, groupMatches, cfg).find((r) => r.teamId === team.id)
    : undefined;

  const teamMatches = d.matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));

  // Golovi po igraču — za oznaku desno u sastavu.
  const goalsOf = (playerId: string) =>
    d.events.filter((e) => e.type === 'goal' && e.player_id === playerId).length;

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');

  const stats = standing
    ? [
        // Iste boje kao u tablici poretka: pobjede zelene, porazi crveni.
        // Ranije su ovdje stajali samo odigrano i pobjede, pa se iz kartice
        // nije vidjelo kako je ekipa dosla do bodova.
        { value: String(standing.wins), label: t('standings.w'), color: standing.wins ? C.green : C.mut },
        { value: String(standing.draws), label: t('standings.d'), color: standing.draws ? C.txt2 : C.mut },
        { value: String(standing.losses), label: t('standings.l'), color: standing.losses ? C.redLt : C.mut },
        {
          value: standing.goalDiff > 0 ? `+${standing.goalDiff}` : String(standing.goalDiff),
          label: t('standings.gd'),
          color: standing.goalDiff > 0 ? C.green : standing.goalDiff < 0 ? C.redLt : C.txt,
        },
        { value: String(standing.points), label: t('standings.pts'), color: C.txt },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Gornja traka */}
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={18} color={C.sub} />
          <Txt style={styles.backTxt}>{t('common.back')}</Txt>
        </Pressable>
        <Pressable style={styles.follow} onPress={() => toggleFollow(team.id)}>
          <Ionicons name={following ? 'heart' : 'heart-outline'} size={16} color={C.redLt} />
          <Txt style={styles.followTxt}>{following ? t('team.following') : t('team.follow')}</Txt>
        </Pressable>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={['#23090C', C.card, C.cardLo]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <Crest code={team.short_code} index={team.sort_order} logoUrl={team.logo_url} size={66} />
          <View style={{ flex: 1 }}>
            <Txt style={styles.teamName} numberOfLines={1}>
              {team.name}
            </Txt>
            <View style={styles.metaRow}>
              <Txt style={styles.metaTxt}>{group?.name ?? ''}</Txt>
              {standing && (
                <>
                  <Txt style={styles.metaTxt}> · </Txt>
                  <Txt style={[styles.metaRank, standing.rank === 1 && { color: C.gold }]}>
                    {t('home.placeN', { n: standing.rank })}
                  </Txt>
                </>
              )}
            </View>
          </View>
        </View>

        {stats.length > 0 && (
          <View style={styles.tiles}>
            {stats.map((s) => (
              <View key={s.label} style={styles.tile}>
                <Txt style={[styles.tileVal, { color: s.color }]}>{s.value}</Txt>
                <Txt style={styles.tileLabel}>{s.label}</Txt>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>

      {/* Tabovi */}
      <View style={styles.tabs}>
        {(['squad', 'matches'] as const).map((tb) => (
          <Pressable key={tb} style={[styles.tab, tab === tb && styles.tabOn]} onPress={() => setTab(tb)}>
            <Txt style={[styles.tabTxt, tab === tb && { color: C.txt }]}>
              {tb === 'squad' ? t('team.squad') : t('team.matches')}
            </Txt>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'squad' ? (
          players.length === 0 ? (
            <Txt color={C.sub}>{t('common.empty')}</Txt>
          ) : (
            players.map((p) => {
              const goals = goalsOf(p.id);
              return (
                <View key={p.id} style={styles.pRow}>
                  <Txt style={styles.pNum}>{p.number ?? '–'}</Txt>
                  <View style={styles.pAvatar}>
                    <Txt style={styles.pInit}>{initials(p.name)}</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.pName} numberOfLines={1}>
                      {p.name}
                    </Txt>
                    {p.is_captain && <Txt style={styles.pSub}>{t('team.captain')}</Txt>}
                  </View>
                  {goals > 0 && (
                    <View style={styles.goalBadge}>
                      <Ionicons name="football-outline" size={13} color={C.redLt} />
                      <Txt style={styles.goalTxt}>{goals}</Txt>
                    </View>
                  )}
                </View>
              );
            })
          )
        ) : teamMatches.length === 0 ? (
          <Txt color={C.sub}>{t('team.noMatches')}</Txt>
        ) : (
          teamMatches.map((m) => (
            <MatchCard key={m.id} match={m} teamId={team.id} onPress={() => nav.navigate('Live', { matchId: m.id })} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchCard({ match, teamId, onPress }: { match: Match; teamId: string; onPress: () => void }) {
  const { t } = useT();
  const d = useData();
  const isHome = match.home_team_id === teamId;
  const opp = d.teamById(isHome ? match.away_team_id : match.home_team_id);
  const own = isHome ? match.home_score : match.away_score;
  const other = isHome ? match.away_score : match.home_score;
  const isLive = match.status === 'live';
  const done = match.status === 'finished';

  // Boja rezultata nosi ishod: zelena pobjeda, crvena poraz, prigušeno neriješeno.
  const resultColor = !done ? C.sub : own > other ? C.green : own < other ? C.red : C.mut;
  const day = d.days.find((x) => x.id === match.day_id);

  return (
    <Pressable onPress={onPress} style={[styles.mCard, isLive && styles.mCardLive]}>
      <View style={styles.mWhen}>
        <Txt style={styles.mDate}>{day ? dayMonth(day.date) : ''}</Txt>
        <Txt style={[styles.mTime, isLive && { color: C.redLt }]}>{isoToHHMM(match.scheduled_time)}</Txt>
      </View>
      <View style={styles.mSep} />
      <Txt style={styles.mOpp} numberOfLines={1}>
        {opp?.name ?? '—'}
      </Txt>
      {isLive ? (
        <Txt style={[styles.mResult, { color: C.redLt }]}>{t('common.live')}</Txt>
      ) : done ? (
        <Txt style={[styles.mResult, { color: resultColor }]}>
          {own}:{other}
        </Txt>
      ) : (
        <Txt style={[styles.mResult, { color: C.mut }]}>{t('common.vs')}</Txt>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.screenX,
    paddingTop: 8,
    paddingBottom: SP.hair,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backTxt: { fontFamily: F.bodyMed, fontSize: 14, color: C.sub },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  followTxt: { fontFamily: F.headSemi, fontSize: 13, letterSpacing: 0.5, color: C.redLt },

  hero: {
    paddingTop: SP.cardGap,
    paddingBottom: 20,
    paddingHorizontal: SP.headerX,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  teamName: { fontFamily: F.head, fontSize: 24, letterSpacing: 0.4, color: C.txt },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaTxt: { fontFamily: F.body, fontSize: 13, color: C.sub },
  metaRank: { fontFamily: F.bodySemi, fontSize: 13, color: C.txt2 },

  tiles: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileVal: { fontFamily: F.head, fontSize: 22, lineHeight: 24 },
  tileLabel: {
    fontFamily: F.body,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: 2,
  },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: SP.divider },
  tabOn: { borderBottomWidth: 2, borderBottomColor: C.red },
  tabTxt: { fontFamily: F.headSemi, fontSize: 14, color: C.sub },

  content: { paddingHorizontal: SP.screenX, paddingTop: SP.cardGap, paddingBottom: 28 },

  pRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.divider,
    paddingVertical: SP.rowY,
    paddingHorizontal: SP.hair,
    borderBottomWidth: 1,
    borderBottomColor: C.lineRow,
  },
  pNum: { width: 26, textAlign: 'center', fontFamily: F.head, fontSize: 16, color: C.mut },
  pAvatar: {
    width: 38,
    height: 38,
    borderRadius: R.chip,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pInit: { fontFamily: F.head, fontSize: 13, color: C.sub },
  pName: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  pSub: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 1 },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalTxt: { fontFamily: F.head, fontSize: 14, color: C.redLt },

  mCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: SP.cardGap,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  mCardLive: { borderColor: 'rgba(225,29,42,.45)' },
  mWhen: { width: 42, alignItems: 'center' },
  mDate: { fontFamily: F.headSemi, fontSize: 11, color: C.sub },
  mTime: { fontFamily: F.head, fontSize: 13, color: C.red },
  mSep: { width: 1, height: 30, backgroundColor: C.line },
  mOpp: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  mResult: { fontFamily: F.head, fontSize: 15, letterSpacing: 0.5 },
});
