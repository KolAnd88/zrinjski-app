import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { openMaps } from '../lib/maps';
import { isoToHHMM } from '../lib/dates';
import { C, F, R, S } from '../theme';
import { Badge, Card, Crest, Txt, useRefreshControl } from '../components/base';
import { PrimaryButton } from '../components/buttons';
import { MatchRow } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

const STAGE: Record<string, string> = {
  group: 'Grupa',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
};

export function HomeScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const { followed } = useFollow();
  const refreshControl = useRefreshControl();

  const live = d.matches.find((m) => m.status === 'live') ?? null;
  const followedTeam = followed.length ? d.teamById(followed[0]) : undefined;

  const upcoming = d.matches
    .filter((m) => m.status === 'scheduled' && m.stage === 'group')
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    .slice(0, 1);
  const final = d.matches.find((m) => m.stage === 'final') ?? null;

  const gold = d.sponsors.find((s) => s.tier === 'gold' && s.is_active) ?? null;
  const others = d.sponsors.filter((s) => s.tier !== 'gold');
  const othersShown = others.slice(0, 3);

  const programDayId = live?.day_id ?? d.days[0]?.id;
  const todayProgram = d.program.filter((p) => p.day_id === programDayId);

  const tierLabel: Record<string, string> = {
    silver: 'srebrni',
    bronze: 'brončani',
    partner: 'partner',
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* Podaci se nisu učitali (mreža?) — ponudi ponovni pokušaj */}
        {d.loadError && (
          <Card accent style={{ marginBottom: S.md }}>
            <Txt style={{ marginBottom: S.sm }}>{t('common.loadError')}</Txt>
            <PrimaryButton label={t('common.retry')} onPress={() => void d.reload()} />
          </Card>
        )}
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Txt style={{ fontFamily: F.head, color: '#fff', fontSize: 16 }}>Z</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h1" style={{ fontSize: 22 }}>
              {t('appName')}
            </Txt>
            <Txt variant="label">
              TURNIR VETERANA · {d.tournament?.season_year ?? ''}
            </Txt>
          </View>
          <Pressable onPress={() => nav.navigate('Search')} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={C.sub} />
          </Pressable>
          <Pressable onPress={() => nav.navigate('NotifSettings')} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={C.sub} />
          </Pressable>
        </View>

        {/* Pratiš */}
        <Pressable
          style={styles.followRow}
          onPress={() => (followedTeam ? nav.navigate('Team', { teamId: followedTeam.id }) : nav.navigate('Search'))}
        >
          <View style={styles.followLeft}>
            <View style={styles.dot} />
            <Txt variant="label">{t('home.following')}:</Txt>
            <Txt style={{ fontFamily: F.bodySemi }}>
              {followedTeam ? followedTeam.name : t('home.followCta')}
            </Txt>
          </View>
          {live && followedTeam && (live.home_team_id === followedTeam.id || live.away_team_id === followedTeam.id) && (
            <Txt style={styles.playingNow}>{t('home.liveNow')} ›</Txt>
          )}
        </Pressable>

        {/* UŽIVO */}
        {live ? (
          <Pressable onPress={() => nav.navigate('Live', { matchId: live.id })}>
            <Card accent style={styles.liveCard}>
              <View style={styles.liveTop}>
                <View style={styles.liveTopLeft}>
                  <View style={styles.dot} />
                  <Txt style={styles.liveLabel}>
                    {t('common.live')} · {STAGE[live.stage]}
                  </Txt>
                </View>
                <Txt style={styles.clock}>
                  {live.current_minute != null ? `${live.current_minute}:00` : ''}
                </Txt>
              </View>
              <View style={styles.liveScore}>
                <View style={styles.liveSide}>
                  <Crest code={d.teamById(live.home_team_id)?.short_code} index={d.teamById(live.home_team_id)?.sort_order} logoUrl={d.teamById(live.home_team_id)?.logo_url} size={52} />
                  <Txt style={styles.liveTeam}>{d.teamById(live.home_team_id)?.name}</Txt>
                </View>
                <Txt style={styles.bigScore}>
                  {live.home_score} : {live.away_score}
                </Txt>
                <View style={styles.liveSide}>
                  <Crest code={d.teamById(live.away_team_id)?.short_code} index={d.teamById(live.away_team_id)?.sort_order} logoUrl={d.teamById(live.away_team_id)?.logo_url} size={52} />
                  <Txt style={styles.liveTeam}>{d.teamById(live.away_team_id)?.name}</Txt>
                </View>
              </View>
              <View style={styles.progress}>
                <View style={[styles.progressFill, { width: `${Math.min(100, ((live.current_minute ?? 0) / (d.tournament?.match_duration_min ?? 15)) * 100)}%` }]} />
              </View>
              <View style={styles.liveBottom}>
                <Txt variant="caption">
                  {live.current_half ?? 1}. {t('common.half')}
                </Txt>
                <Txt style={styles.liveLink}>{t('live.title')} ›</Txt>
              </View>
            </Card>
          </Pressable>
        ) : (
          <Card>
            <Txt color={C.sub}>{t('home.noLive')}</Txt>
          </Card>
        )}

        {/* Sljedeće na rasporedu */}
        <Txt variant="h2" style={styles.section}>
          {t('home.next')}
        </Txt>
        {upcoming.map((m) => (
          <View key={m.id} style={{ marginBottom: S.sm }}>
            <MatchRow match={m} teamById={d.teamById} onPress={() => nav.navigate('Live', { matchId: m.id })} />
          </View>
        ))}
        {final && (
          <MatchRow match={final} teamById={d.teamById} onPress={() => nav.navigate('Live', { matchId: final.id })} />
        )}

        {/* Zlatni sponzor */}
        {gold && (
          <>
            <Txt variant="h2" style={styles.section}>
              {t('home.goldSponsor')}
            </Txt>
            <Card gold style={styles.goldCard}>
              <Txt style={styles.goldName}>{gold.name.toUpperCase()}</Txt>
              <Txt variant="caption">generalni pokrovitelj turnira</Txt>
            </Card>
          </>
        )}

        {/* Sponzori i partneri */}
        <Txt variant="h2" style={styles.section}>
          {t('home.sponsors')}
        </Txt>
        <View style={styles.sponsorStrip}>
          {othersShown.map((s) => (
            <View key={s.id} style={styles.sponsorChip}>
              <Txt style={styles.sponsorName} numberOfLines={1}>
                {s.name}
              </Txt>
              <Txt variant="caption">{tierLabel[s.tier]}</Txt>
            </View>
          ))}
          {others.length > othersShown.length && (
            <View style={styles.sponsorChip}>
              <Txt style={styles.sponsorName}>+{others.length - othersShown.length}</Txt>
              <Txt variant="caption">partneri</Txt>
            </View>
          )}
        </View>

        {/* Danas program */}
        {todayProgram.length > 0 && (
          <>
            <Txt variant="h2" style={styles.section}>
              {t('home.todayProgram')}
            </Txt>
            {todayProgram.map((p) => {
              const loc = d.locations.find((l) => l.id === p.location_id);
              return (
                <Card key={p.id} style={styles.programCard}>
                  <Txt style={styles.programTime}>{p.time.slice(0, 5)}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontFamily: F.bodySemi, fontSize: 15 }}>{p.title}</Txt>
                    {loc && <Txt variant="caption">{loc.name}</Txt>}
                  </View>
                  {loc?.lat != null && loc.lng != null && (
                    <Pressable style={styles.mapBtn} onPress={() => openMaps(loc.lat!, loc.lng!, loc.name)}>
                      <Txt style={{ color: C.blue, fontFamily: F.bodySemi }}>{t('common.map')}</Txt>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxl, gap: S.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  logo: {
    width: 40,
    height: 40,
    borderRadius: R.chip,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: { padding: 6 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    paddingVertical: S.sm,
    paddingHorizontal: S.lg,
  },
  followLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.red },
  playingNow: { color: C.red, fontFamily: F.headSemi, fontSize: 13 },
  liveCard: { gap: S.md },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveTopLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  liveLabel: { fontFamily: F.head, color: C.red, fontSize: 13, letterSpacing: 1 },
  clock: { fontFamily: F.head, color: C.sub, fontSize: 16 },
  liveScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveSide: { alignItems: 'center', gap: 4, width: 90 },
  liveTeam: { fontFamily: F.headSemi, fontSize: 12, textAlign: 'center' },
  bigScore: { fontFamily: F.head, fontSize: 48 },
  progress: { height: 4, backgroundColor: C.line, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: C.red },
  liveBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveLink: { color: C.red, fontFamily: F.headSemi, fontSize: 13 },
  section: { marginTop: S.sm },
  goldCard: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(217,178,74,0.06)' },
  goldName: { fontFamily: F.head, color: C.gold, fontSize: 20, letterSpacing: 0.5 },
  sponsorStrip: { flexDirection: 'row', gap: S.sm },
  sponsorChip: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: S.md,
    alignItems: 'center',
    gap: 2,
  },
  sponsorName: { fontFamily: F.bodySemi, fontSize: 13 },
  programCard: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  programTime: { fontFamily: F.head, fontSize: 18, color: C.txt, width: 52 },
  mapBtn: {
    borderWidth: 1,
    borderColor: C.blue,
    borderRadius: R.chip,
    paddingVertical: 8,
    paddingHorizontal: S.md,
  },
});
