import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { Match } from '@zrinjski/core';
import { crestPair } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { isoToHHMM } from '../lib/dates';
import { C, F, R, S, SP } from '../theme';
import {
  Card,
  Crest,
  HeroCard,
  LinkTxt,
  Pill,
  SectionLabel,
  Txt,
  useRefreshControl,
} from '../components/base';
import { PrimaryButton } from '../components/buttons';
import { BrandStripe, SponsorMarquee, useCountdown } from '../components/home';
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

  // Sljedeće tri najavljene utakmice, poredane po vremenu.
  const upcoming = d.matches
    .filter((m) => m.status === 'scheduled' && m.scheduled_time)
    .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime())
    .slice(0, 3);

  const nextMatch = upcoming[0] ?? null;
  const countdown = useCountdown(nextMatch?.scheduled_time);

  const gold = d.sponsors.find((s) => s.tier === 'gold' && s.is_active) ?? null;
  const otherSponsors = d.sponsors.filter((s) => s.tier !== 'gold').map((s) => s.name);

  const programDayId = live?.day_id ?? d.days[0]?.id;
  const todayProgram = d.program.filter((p) => p.day_id === programDayId);

  const teamOf = (id: string | null | undefined) => d.teamById(id);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      {/* Brand header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[C.red, C.redDk]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.logo}
        >
          <Txt style={styles.logoTxt}>ZC</Txt>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Txt style={styles.brandName}>{t('appName').toUpperCase()}</Txt>
          <Txt style={styles.brandSub}>{t('home.subtitle')}</Txt>
        </View>
        <Pressable onPress={() => nav.navigate('Search')} style={styles.iconBtn}>
          <Ionicons name="search" size={19} color={C.sub} />
        </Pressable>
        <Pressable onPress={() => nav.navigate('NotifSettings')} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={19} color={C.sub} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {d.loadError && (
          <Card accent style={{ marginBottom: SP.cardGap }}>
            <Txt style={{ marginBottom: S.sm }}>{t('common.loadError')}</Txt>
            <PrimaryButton label={t('common.retry')} onPress={() => void d.reload()} />
          </Card>
        )}

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        {live ? (
          <LiveHero match={live} />
        ) : nextMatch ? (
          <NextHero match={nextMatch} countdown={countdown} />
        ) : (
          <Card>
            <Txt color={C.sub}>{t('home.noLive')}</Txt>
          </Card>
        )}

        {/* ── PRATIŠ ───────────────────────────────────────────────────── */}
        <SectionLabel>{t('home.following')}</SectionLabel>
        <Pressable
          style={styles.followCard}
          onPress={() =>
            followedTeam ? nav.navigate('Team', { teamId: followedTeam.id }) : nav.navigate('Search')
          }
        >
          {followedTeam ? (
            <>
              <Crest
                code={followedTeam.short_code}
                index={followedTeam.sort_order}
                logoUrl={followedTeam.logo_url}
                size={42}
              />
              <View style={{ flex: 1 }}>
                <Txt style={styles.followName}>{followedTeam.name}</Txt>
                <Txt style={styles.followMeta}>
                  {d.groups.find((g) => g.id === followedTeam.group_id)?.name ?? ''}
                </Txt>
              </View>
              <LinkTxt>{t('home.change')}</LinkTxt>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Txt style={styles.followName}>{t('home.followCta')}</Txt>
              </View>
              <LinkTxt>{t('home.change')}</LinkTxt>
            </>
          )}
        </Pressable>

        {/* ── ZLATNI SPONZOR ───────────────────────────────────────────── */}
        {gold && (
          <LinearGradient
            colors={['rgba(217,178,74,.12)', 'rgba(217,178,74,.02)', 'transparent']}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={styles.goldCard}
          >
            <View style={styles.goldLogo}>
              <Txt style={styles.goldLogoTxt} numberOfLines={1}>
                {(gold.name || '').slice(0, 8).toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={styles.goldName}>{gold.name}</Txt>
              <Txt style={styles.goldSub}>
                {t('home.goldSponsor')} · {d.tournament?.season_year ?? ''}
              </Txt>
            </View>
          </LinearGradient>
        )}

        {/* ── SPONZORI ─────────────────────────────────────────────────── */}
        {otherSponsors.length > 0 && (
          <>
            <SectionLabel>{t('home.sponsors')}</SectionLabel>
            <SponsorMarquee names={otherSponsors} />
          </>
        )}

        {/* ── SLJEDEĆE NA RASPOREDU ────────────────────────────────────── */}
        {upcoming.length > 0 && (
          <>
            <SectionLabel
              right={
                <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Schedule' } as never)}>
                  <LinkTxt size={11}>{t('home.fullSchedule')}</LinkTxt>
                </Pressable>
              }
            >
              {t('home.next')}
            </SectionLabel>
            <View style={styles.listCard}>
              {upcoming.map((m, i) => {
                const home = teamOf(m.home_team_id);
                const away = teamOf(m.away_team_id);
                const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 0);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => nav.navigate('Live', { matchId: m.id })}
                    style={[styles.upRow, i < upcoming.length - 1 && styles.upRowBorder]}
                  >
                    <View style={styles.upTop}>
                      <Txt style={styles.upTime}>{isoToHHMM(m.scheduled_time)}</Txt>
                      <View style={styles.upSep} />
                      <Crest
                        code={home?.short_code}
                        index={crests[0]}
                       
                        logoUrl={home?.logo_url}
                        size={30}
                      />
                      <Txt style={styles.upName} numberOfLines={1}>
                        {home?.name}
                      </Txt>
                      <Txt style={styles.upVs}>{t('common.vs')}</Txt>
                      <Txt style={[styles.upName, { textAlign: 'right' }]} numberOfLines={1}>
                        {away?.name}
                      </Txt>
                      <Crest
                        code={away?.short_code}
                        index={crests[1]}
                       
                        logoUrl={away?.logo_url}
                        size={30}
                      />
                    </View>
                    {i === 0 && countdown && (
                      <View style={styles.upCountdown}>
                        <Ionicons name="time-outline" size={13} color={C.redLt} />
                        <Txt style={styles.upCountLabel}>{t('home.startsIn')}</Txt>
                        <Txt style={styles.upCountVal}>{countdown}</Txt>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── VEČERNJI PROGRAM ─────────────────────────────────────────── */}
        {todayProgram.length > 0 && (
          <>
            <SectionLabel>{t('home.eveningProgram')}</SectionLabel>
            <View style={styles.listCard}>
              {todayProgram.map((p, i) => (
                <View key={p.id} style={[styles.progRow, i > 0 && styles.progRowBorder]}>
                  <Txt style={styles.progTime}>{isoToHHMM(p.time)}</Txt>
                  <Txt style={styles.progTitle}>{p.title}</Txt>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Hero kad je utakmica uživo — rezultat, poluvrijeme, CTA i tijek golova. */
function LiveHero({ match }: { match: Match }) {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const home = d.teamById(match.home_team_id);
  const away = d.teamById(match.away_team_id);
  const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 0);
  const goals = d.eventsOf(match.id).filter((e) => e.type === 'goal');

  return (
    <Pressable onPress={() => nav.navigate('Live', { matchId: match.id })}>
      <HeroCard live>
        <View style={styles.heroTop}>
          <Pill bg="rgba(225,29,42,.14)" border="rgba(225,29,42,.4)">
            <View style={styles.liveDot} />
            <Txt style={styles.liveLabel}>
              {t('common.live')} · {(STAGE[match.stage] ?? '').toUpperCase()}
            </Txt>
          </Pill>
          {match.stage === 'final' && (
            <View style={styles.goldRow}>
              <Ionicons name="trophy-outline" size={13} color={C.gold} />
              <Txt style={styles.goldLabel}>{t('home.forGold')}</Txt>
            </View>
          )}
        </View>

        <View style={styles.heroGrid}>
          <View style={styles.heroSide}>
            <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={56} />
            <Txt style={styles.heroTeam} numberOfLines={1}>
              {home?.name}
            </Txt>
          </View>
          <View style={styles.heroScore}>
            <Txt style={styles.scoreNum}>{match.home_score}</Txt>
            <Txt style={styles.scoreSep}>:</Txt>
            <Txt style={styles.scoreNum}>{match.away_score}</Txt>
          </View>
          <View style={styles.heroSide}>
            <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={56} />
            <Txt style={styles.heroTeam} numberOfLines={1}>
              {away?.name}
            </Txt>
          </View>
        </View>

        <View style={styles.heroFoot}>
          <Txt style={styles.heroFootTxt}>
            {t('home.halfN', { n: match.current_half ?? 1 }).toUpperCase()}
            {match.current_minute != null ? ` · ${match.current_minute}'` : ''}
          </Txt>
          <Pill bg="rgba(225,29,42,.16)" border="rgba(225,29,42,.45)" style={{ paddingHorizontal: 14, paddingVertical: 7 }}>
            <Ionicons name="play-circle-outline" size={13} color={C.redLt} />
            <Txt style={styles.ctaTxt}> {t('home.openStream').toUpperCase()}</Txt>
          </Pill>
        </View>

        {goals.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.goalsRow}
          >
            {goals.map((g) => {
              const isHome = g.team_id === match.home_team_id;
              const tm = d.teamById(g.team_id);
              const player = d.players.find((p) => p.id === g.player_id);
              return (
                <Pill key={g.id} style={styles.goalChip}>
                  <View
                    style={[
                      styles.goalDot,
                      { backgroundColor: tm?.color ?? (isHome ? C.red : C.blue) },
                    ]}
                  >
                    <Txt style={styles.goalDotTxt}>{isHome ? 'D' : 'G'}</Txt>
                  </View>
                  <Txt style={styles.goalPlayer}>{player?.name ?? tm?.short_code ?? ''}</Txt>
                  <Txt style={styles.goalMin}>{g.minute}'</Txt>
                </Pill>
              );
            })}
          </ScrollView>
        )}
      </HeroCard>
    </Pressable>
  );
}

/** Hero kad ništa ne igra — sljedeća utakmica s odbrojavanjem. */
function NextHero({ match, countdown }: { match: Match; countdown: string | null }) {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const home = d.teamById(match.home_team_id);
  const away = d.teamById(match.away_team_id);
  const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 0);

  return (
    <HeroCard>
      <View style={styles.nextTop}>
        <Txt style={styles.nextLabel}>{t('home.nextMatch').toUpperCase()}</Txt>
        <View style={styles.nextLine} />
        {countdown && <Txt style={styles.nextCountdown}>{countdown}</Txt>}
      </View>

      <View style={styles.heroGrid}>
        <View style={styles.heroSide}>
          <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={56} />
          <Txt style={styles.heroTeam} numberOfLines={1}>
            {home?.name}
          </Txt>
        </View>
        <Txt style={styles.vsBig}>{t('common.vs')}</Txt>
        <View style={styles.heroSide}>
          <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={56} />
          <Txt style={styles.heroTeam} numberOfLines={1}>
            {away?.name}
          </Txt>
        </View>
      </View>

      <View style={styles.nextFoot}>
        <Txt style={styles.heroFootTxt}>
          {isoToHHMM(match.scheduled_time)} · {(STAGE[match.stage] ?? '').toUpperCase()}
        </Txt>
        <View style={styles.dotSep} />
        <Pressable onPress={() => nav.navigate('NotifSettings')}>
          <LinkTxt size={12}>{t('home.remindMe')}</LinkTxt>
        </Pressable>
      </View>
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: SP.screenX, paddingTop: SP.hair, paddingBottom: 92 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SP.headerX,
    paddingTop: 10,
    paddingBottom: SP.cardGap,
  },
  logo: { width: 42, height: 42, borderRadius: R.chip, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { fontFamily: F.head, fontSize: 17, color: '#fff' },
  brandName: { fontFamily: F.head, fontSize: 21, letterSpacing: 0.6, color: C.txt },
  brandSub: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 3 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: R.chip,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero — zajedničko
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heroGrid: { flexDirection: 'row', alignItems: 'center', gap: SP.tight },
  heroSide: { flex: 1, alignItems: 'center', gap: SP.gap },
  heroTeam: {
    fontFamily: F.headSemi,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.txt,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: SP.cardGap,
    paddingTop: SP.divider,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.07)',
  },
  heroFootTxt: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 0.5, color: C.sub },

  // Hero — live
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.red, marginRight: 8 },
  liveLabel: { fontFamily: F.head, fontSize: 11, letterSpacing: 1.4, color: C.redLt },
  goldRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goldLabel: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 0.5, color: C.gold },
  heroScore: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  scoreNum: { fontFamily: F.head, fontSize: 54, letterSpacing: 1, color: C.txt, lineHeight: 56 },
  scoreSep: { fontFamily: F.head, fontSize: 30, color: C.mut },
  ctaTxt: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 0.6, color: C.redLt },
  goalsRow: { gap: 8, paddingTop: SP.divider },
  goalChip: { paddingLeft: 7, paddingRight: 10, paddingVertical: 4 },
  goalDot: { width: 16, height: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  goalDotTxt: { fontFamily: F.head, fontSize: 9, color: '#fff' },
  goalPlayer: { fontFamily: F.bodyMed, fontSize: 11, color: C.txt2, marginRight: 6 },
  goalMin: { fontFamily: F.head, fontSize: 11, color: C.sub },

  // Hero — sljedeća
  nextTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  nextLabel: { fontFamily: F.head, fontSize: 11, letterSpacing: 1.4, color: C.sub },
  nextLine: { flex: 1, height: 1, backgroundColor: C.lineSub },
  nextCountdown: { fontFamily: F.head, fontSize: 11, letterSpacing: 0.5, color: C.redLt },
  vsBig: { fontFamily: F.headSemi, fontSize: 26, letterSpacing: 1, color: C.mut },
  nextFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SP.cardGap,
    paddingTop: SP.divider,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.06)',
  },
  dotSep: { width: 3, height: 3, borderRadius: 999, backgroundColor: C.mut },

  // Pratiš
  followCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: SP.rowY,
    paddingHorizontal: SP.cardGap,
  },
  followName: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  followMeta: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 1 },

  // Zlatni sponzor
  goldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.cardGap,
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.45)',
    borderRadius: R.card,
    paddingVertical: SP.divider,
    paddingHorizontal: 15,
    marginTop: 12,
    overflow: 'hidden',
  },
  goldLogo: {
    width: 64,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: R.crestSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldLogoTxt: { fontFamily: F.head, fontSize: 11, color: C.redDk },
  goldName: { fontFamily: F.head, fontSize: 16, letterSpacing: 0.3, color: C.txt },
  goldSub: { fontFamily: F.body, fontSize: 12, color: C.goldTxt, marginTop: 2 },

  // Liste (sljedeće + program)
  listCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  upRow: { paddingVertical: SP.divider, paddingHorizontal: 15 },
  upRowBorder: { borderBottomWidth: 1, borderBottomColor: C.lineRow },
  upTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  upTime: { fontFamily: F.head, fontSize: 15, color: C.red, width: 46, textAlign: 'center' },
  upSep: { width: 1, height: 30, backgroundColor: C.line },
  upName: { flex: 1, fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  upVs: { fontFamily: F.head, fontSize: 13, color: C.mut },
  upCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SP.rowY,
    paddingTop: SP.rowY,
    borderTopWidth: 1,
    borderTopColor: C.lineSub,
  },
  upCountLabel: { fontFamily: F.body, fontSize: 12, color: C.sub },
  upCountVal: { fontFamily: F.head, fontSize: 13, letterSpacing: 0.5, color: C.redLt },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: SP.cardGap, paddingVertical: 12, paddingHorizontal: 15 },
  progRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  progTime: { fontFamily: F.head, fontSize: 14, color: C.red, width: 46 },
  progTitle: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.txt },
});
