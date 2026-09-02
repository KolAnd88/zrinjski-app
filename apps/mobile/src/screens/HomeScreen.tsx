import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Match } from '@zrinjski/core';
import { crestPair } from '@zrinjski/ui-tokens';
import { pickCurrentDayId } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { isoToHHMM, shortDayLabel, timeToHHMM } from '../lib/dates';
import { openMaps } from '../lib/maps';
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
  const { t, locale } = useT();
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

  const gold = d.sponsors.filter((s) => s.tier === 'gold' && s.is_active);

  // Sponzori po razredu. Razred se mora vidjeti — klub ga naplaćuje.
  const byTier = (tier: 'silver' | 'bronze' | 'partner') =>
    d.sponsors
      .filter((s) => s.tier === tier && s.is_active)
      .map((s) => ({ name: s.name, logo_url: s.logo_url }));

  const silver = byTier('silver');
  const bronze = byTier('bronze');
  const partners = byTier('partner');
  const hasSponsors = silver.length + bronze.length + partners.length > 0;

  // Program dana. Dok utakmica traje gleda se njezin dan, inače današnji
  // (ili prvi sljedeći) — `d.days[0]` bi cijeli turnir pokazivao prvi dan.
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const programDayId = live?.day_id ?? pickCurrentDayId(d.days, todayIso);
  const programDay = d.days.find((x) => x.id === programDayId);
  const todayProgram = d.program
    .filter((p) => p.day_id === programDayId)
    .sort((a, b) => a.sort_order - b.sort_order || (a.time ?? '').localeCompare(b.time ?? ''));

  const teamOf = (id: string | null | undefined) => d.teamById(id);

  // Zadnji odigrani rezultati — dok raspored još nije popunjen ovo je jedino
  // što ekran ima za pokazati, a pred kraj turnira je i najzanimljivije.
  const recent = d.matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => (b.scheduled_time ?? '').localeCompare(a.scheduled_time ?? ''))
    .slice(0, 3);

  // Turnir u brojkama. Uvijek ima vrijednost, pa ekran nikad nije prazan.
  const stats = [
    { value: d.teams.length, label: t('home.statTeams') },
    { value: d.matches.length, label: t('home.statMatches') },
    // Golovi iz REZULTATA odigranih utakmica, ne iz događaja: brojka tako
    // uvijek odgovara onome što piše na semaforima i u poretku. Utakmica u
    // tijeku se ne broji — polovičan rezultat nije podatak o turniru.
    {
      value: d.matches
        .filter((m) => m.status === 'finished')
        .reduce((n, m) => n + m.home_score + m.away_score, 0),
      label: t('home.statGoals'),
    },
    { value: d.days.length, label: t('home.statDays') },
  ];

  // Naziv turnira dolazi iz baze, ne iz koda — mijenja se u adminu, a stoji i
  // na zapisniku i na slici za mreže.
  //
  // U zaglavlju ostaje samo ~173px (grb + dvije ikone pojedu ostatak), pa se
  // duži naziv PRELAMA u dva retka umjesto da se gura u jedan. Mjereno:
  // "PONOS HERCEGOVINE 2026" u jednom retku traži 13px slova — presitno da se
  // pročita u prolazu. U dva retka staje na 17px.
  const brandTitle = (d.tournament?.name ?? t('appName')).toUpperCase();
  const brandSize = brandTitle.length > 28 ? 15 : brandTitle.length > 16 ? 17 : 21;

  const shortcuts = [
    { icon: 'calendar-outline', label: t('nav.schedule'), screen: 'Schedule' },
    { icon: 'trophy-outline', label: t('nav.standings'), screen: 'Standings' },
    { icon: 'stats-chart-outline', label: t('nav.stats'), screen: 'Stats' },
    { icon: 'images-outline', label: t('nav.gallery'), screen: 'Gallery' },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      {/* Brand header */}
      <View style={styles.header}>
        <Image source={require('../../assets/crest.png')} style={styles.logo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Txt style={[styles.brandName, { fontSize: brandSize, lineHeight: brandSize + 3 }]} numberOfLines={2}>
            {brandTitle}
          </Txt>
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

        {/* ── ZLATNI SPONZORI ──────────────────────────────────────────── */}
        {/* Zlatni i dalje dobiva mjesto odmah ispod rezultata i najkrupnije
            pločice, ali od kad ih može biti više, vrti se kao i ostali razredi.
            Ranije je to bila kartica preko cijele širine i prikazivala je SAMO
            prvog pronađenog — ostali zlatni sponzori nisu se vidjeli nigdje. */}
        {gold.length > 0 && (
          <>
            <SectionLabel>
              {gold.length === 1 ? t('home.goldSponsor') : t('home.goldSponsors')}
            </SectionLabel>
            <SponsorMarquee sponsors={gold} tier="gold" />
          </>
        )}

        {/* ── TURNIR U BROJKAMA ────────────────────────────────────────── */}
        <SectionLabel>{t('home.inNumbers')}</SectionLabel>
        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Txt style={styles.statVal}>{s.value}</Txt>
              <Txt style={styles.statLabel}>{s.label}</Txt>
            </View>
          ))}
        </View>

        {/* ── PREČACI ──────────────────────────────────────────────────── */}
        <View style={styles.shortRow}>
          {shortcuts.map((s) => (
            <Pressable
              key={s.screen}
              style={styles.shortTile}
              onPress={() => nav.navigate('Tabs', { screen: s.screen } as never)}
            >
              <Ionicons name={s.icon} size={19} color={C.redLt} />
              <Txt style={styles.shortLabel} numberOfLines={1}>
                {s.label}
              </Txt>
            </Pressable>
          ))}
        </View>

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

        {/* ── ZADNJI REZULTATI ─────────────────────────────────────────── */}
        {recent.length > 0 && (
          <>
            <SectionLabel
              right={
                <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Schedule' } as never)}>
                  <LinkTxt size={11}>{t('home.fullSchedule')}</LinkTxt>
                </Pressable>
              }
            >
              {t('home.lastResults')}
            </SectionLabel>
            <View style={styles.listCard}>
              {recent.map((m, i) => {
                const home = teamOf(m.home_team_id);
                const away = teamOf(m.away_team_id);
                const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 0);
                const homeWon = m.home_score > m.away_score;
                const awayWon = m.away_score > m.home_score;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => nav.navigate('Live', { matchId: m.id })}
                    style={[styles.resRow, i > 0 && styles.upRowBorder]}
                  >
                    <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={28} />
                    <Txt style={[styles.resName, homeWon && styles.resWin]} numberOfLines={1}>
                      {home?.name}
                    </Txt>
                    <Txt style={styles.resScore}>
                      {m.home_score}:{m.away_score}
                    </Txt>
                    <Txt style={[styles.resName, { textAlign: 'right' }, awayWon && styles.resWin]} numberOfLines={1}>
                      {away?.name}
                    </Txt>
                    <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={28} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── SPONZORI PO RAZREDU ──────────────────────────────────────── */}
        {/* Srebrni su veći i dvoje u redu, brončani manji i troje, partneri
            u traci koja klizi. Razlika je namjerno u veličini, a ne samo u
            boji — vidi se i na crno-bijelom snimku zaslona. */}
        {hasSponsors && (
          <>
            <SectionLabel>{t('home.sponsors')}</SectionLabel>

            {silver.length > 0 && (
              <>
                <Txt style={[styles.tierLabel, { color: C.silverTxt }]}>
                  {t('home.tierSilver').toUpperCase()}
                </Txt>
                <SponsorMarquee sponsors={silver} tier="silver" />
              </>
            )}

            {bronze.length > 0 && (
              <>
                <Txt style={[styles.tierLabel, { color: C.bronzeTxt }]}>
                  {t('home.tierBronze').toUpperCase()}
                </Txt>
                <SponsorMarquee sponsors={bronze} tier="bronze" />
              </>
            )}

            {partners.length > 0 && (
              <>
                <Txt style={[styles.tierLabel, { color: C.sub }]}>
                  {t('home.tierPartner').toUpperCase()}
                </Txt>
                <SponsorMarquee sponsors={partners} />
              </>
            )}
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

        {/* ── PROGRAM DANA ─────────────────────────────────────────────── */}
        {/* Svaka stavka mora reći KADA i GDJE — bez toga je popis naslova.
            Vrijeme je Postgres `time` ("18:00:00"), ne timestamp: isoToHHMM
            ga je vraćao prazno, pa se satnica nikad nije ni vidjela. */}
        {todayProgram.length > 0 && (
          <>
            <SectionLabel
              right={
                programDay ? (
                  <Txt style={styles.progDay}>{shortDayLabel(programDay.date, locale)}</Txt>
                ) : undefined
              }
            >
              {t('home.programTitle')}
            </SectionLabel>
            <View style={styles.listCard}>
              {todayProgram.map((p, i) => {
                const loc = d.locations.find((l) => l.id === p.location_id);
                const canNavigate = !!loc && loc.lat != null && loc.lng != null;
                const Row = canNavigate ? Pressable : View;
                return (
                  <Row
                    key={p.id}
                    style={[styles.progRow, i > 0 && styles.progRowBorder]}
                    {...(canNavigate
                      ? { onPress: () => openMaps(loc!.lat!, loc!.lng!, loc!.name) }
                      : {})}
                  >
                    <View style={styles.progTimeBox}>
                      <Txt style={styles.progTime}>{timeToHHMM(p.time) || '—'}</Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt style={styles.progTitle}>{p.title}</Txt>
                      {loc ? (
                        <View style={styles.progLocRow}>
                          <Ionicons
                            name="location"
                            size={13}
                            color={canNavigate ? C.blue : C.sub}
                          />
                          {/* Mjesto koje se može otvoriti izgleda kao poveznica —
                              plavo i podcrtano. Bez toga nitko ne pogodi da red
                              uopće nešto radi na dodir. */}
                          <Txt
                            style={[styles.progLoc, canNavigate && styles.progLocLink]}
                            numberOfLines={1}
                          >
                            {loc.name}
                          </Txt>
                          {canNavigate && (
                            <Txt style={styles.progOpen}>{t('home.openMap')}</Txt>
                          )}
                        </View>
                      ) : (
                        <Txt style={styles.progNoLoc}>{t('home.noVenue')}</Txt>
                      )}
                    </View>
                    {canNavigate && <Ionicons name="chevron-forward" size={16} color={C.blue} />}
                  </Row>
                );
              })}
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
  logo: { width: 46, height: 46 },
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
  // ── Glavni pokrovitelj ──────────────────────────────────────────────────
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SP.gap,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.4)',
    backgroundColor: 'rgba(217,178,74,.1)',
  },
  goldBadgeTxt: { fontFamily: F.headSemi, fontSize: 10, letterSpacing: 1.1, color: C.goldTxt },

  /** Podnaslov razreda sponzora — manji od SectionLabel, da hijerarhija ostane jasna. */
  tierLabel: {
    fontFamily: F.headSemi,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: SP.divider,
    marginBottom: SP.gap,
  },

  // ── Turnir u brojkama ───────────────────────────────────────────────────
  statRow: { flexDirection: 'row', gap: SP.gap },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SP.divider,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
  },
  statVal: { fontFamily: F.head, fontSize: 22, color: C.txt, lineHeight: 26 },
  statLabel: {
    fontFamily: F.body,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: 2,
  },

  // ── Prečaci ─────────────────────────────────────────────────────────────
  shortRow: { flexDirection: 'row', gap: SP.gap, marginTop: SP.gap },
  shortTile: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    minHeight: 62,
    justifyContent: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
  },
  shortLabel: { fontFamily: F.bodySemi, fontSize: 11, color: C.sub },

  // ── Zadnji rezultati ────────────────────────────────────────────────────
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    paddingVertical: SP.rowY,
    paddingHorizontal: 14,
  },
  resName: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.sub },
  /** Pobjednik podebljano — rezultat se čita brže nego brojke. */
  resWin: { fontFamily: F.bodySemi, color: C.txt },
  resScore: { fontFamily: F.head, fontSize: 16, color: C.txt, minWidth: 46, textAlign: 'center' },

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

  progDay: { fontFamily: F.headSemi, fontSize: 11, letterSpacing: 0.6, color: C.sub },
  progRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.cardGap,
    minHeight: 56,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  progRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  /** Vrijeme u vlastitoj kutiji — satnica se tako čita okomito, kao raspored. */
  progTimeBox: {
    minWidth: 52,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: R.chip,
    backgroundColor: 'rgba(225,29,42,.1)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,42,.28)',
    alignItems: 'center',
  },
  progTime: { fontFamily: F.head, fontSize: 14, color: C.redLt },
  progTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  progLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  progLoc: { flexShrink: 1, fontFamily: F.body, fontSize: 12, color: C.sub },
  progLocLink: { color: C.blue, textDecorationLine: 'underline' },
  progOpen: {
    fontFamily: F.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: C.blue,
    borderWidth: 1,
    borderColor: 'rgba(45,108,223,.45)',
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  progNoLoc: { fontFamily: F.body, fontSize: 12, color: C.mut, marginTop: 3 },
});
