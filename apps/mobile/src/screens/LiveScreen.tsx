import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventType, MatchEvent } from '@zrinjski/core';
import { crestGradientFor, crestPair } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { isoToHHMM } from '../lib/dates';
import { C, F, R, SP } from '../theme';
import { Crest, HeroCard, SectionLabel, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

const STAGE: Record<string, StringKey> = {
  semifinal: 'standings.semifinal',
  third_place: 'standings.thirdPlace',
  final: 'schedule.final',
};

/** Ikona i naziv događaja; boja podloge dolazi iz ekipe koja ga je napravila. */
const EV: Record<EventType, { icon: keyof typeof Ionicons.glyphMap; label: StringKey }> = {
  goal: { icon: 'football-outline', label: 'live.type.goal' },
  save: { icon: 'hand-left-outline', label: 'live.type.save' },
  suspension_2min: { icon: 'time-outline', label: 'live.type.susp' },
  red_card: { icon: 'square', label: 'live.type.red' },
};

export function LiveScreen() {
  const { t } = useT();
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Live'>>();
  const d = useData();

  const m = d.matchById(route.params.matchId);
  const home = d.teamById(m?.home_team_id);
  const away = d.teamById(m?.away_team_id);

  // Maketa ima vlastito zaglavlje (natrag + faza + status) pa nativno gasimo.
  useLayoutEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

  if (!m) {
    return (
      <SafeAreaView style={styles.safe}>
        <Txt color={C.sub} style={{ padding: SP.screenX }}>
          {t('common.empty')}
        </Txt>
      </SafeAreaView>
    );
  }

  const isLive = m.status === 'live';
  const isDone = m.status === 'finished';
  const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 1);

  // Redoslijed je po MINUTI utakmice, ne po vremenu upisa: zapisničar koji
  // upiše gol s zakašnjenjem inače završi na krivom mjestu. Vrijeme upisa
  // ostaje samo kao razrješenje kad su dva događaja u istoj minuti.
  const asc = d
    .eventsOf(m.id)
    .slice()
    .sort((x, y) => x.minute - y.minute || x.created_at.localeCompare(y.created_at));

  let h = 0;
  let a = 0;
  const feed = asc.map((e) => {
    if (e.type === 'goal') {
      if (e.team_id === m.home_team_id) h++;
      else if (e.team_id === m.away_team_id) a++;
    }
    return { e, score: e.type === 'goal' ? `${h}:${a}` : null };
  });

  // Dok traje — najnovije na vrhu (gledatelj prati zadnju akciju).
  // Kad završi — od početka prema kraju, jer se tada čita kao izvještaj.
  if (m.status !== 'finished') feed.reverse();

  const stageTitle =
    m.stage === 'group'
      ? d.groups.find((g) => g.id === m.grp_id)?.name ?? t('team.group')
      : t(STAGE[m.stage]!);

  const venue = d.locations.find((l) => l.type === 'hall')?.name;
  const subtitle = [isoToHHMM(m.scheduled_time), venue].filter(Boolean).join(' · ');

  const quick = [
    { value: asc.filter((e) => e.type === 'goal').length, label: t('live.qGoals') },
    { value: asc.filter((e) => e.type === 'save').length, label: t('live.qSaves') },
    {
      value: asc.filter((e) => e.type === 'suspension_2min' || e.type === 'red_card').length,
      label: t('live.qCards'),
    },
  ];

  const statusLine = isLive
    ? `${t('home.halfN', { n: m.current_half ?? 1 }).toUpperCase()} · ${m.current_minute ?? 0}'`
    : isDone
      ? t('common.finished')
      : isoToHHMM(m.scheduled_time);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Zaglavlje */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={18} color={C.txt} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt style={styles.stageTitle}>{stageTitle}</Txt>
          {!!subtitle && <Txt style={styles.subtitle}>{subtitle}</Txt>}
        </View>
        {isLive ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Txt style={styles.livePillTxt}>{t('common.live')}</Txt>
          </View>
        ) : isDone ? (
          <View style={styles.donePill}>
            <Txt style={styles.donePillTxt}>{t('common.finished')}</Txt>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rezultat */}
        <HeroCard live={isLive} style={{ paddingBottom: 16 }}>
          <View style={styles.scoreGrid}>
            <View style={styles.side}>
              <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={56} />
              <Txt style={styles.sideName} numberOfLines={1}>
                {home?.name}
              </Txt>
            </View>
            <View style={styles.scoreMid}>
              <View style={styles.scoreRow}>
                <Txt style={styles.scoreNum}>{m.home_score}</Txt>
                <Txt style={styles.scoreSep}>:</Txt>
                <Txt style={styles.scoreNum}>{m.away_score}</Txt>
              </View>
              <Txt style={styles.statusLine}>{statusLine}</Txt>
            </View>
            <View style={styles.side}>
              <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={56} />
              <Txt style={styles.sideName} numberOfLines={1}>
                {away?.name}
              </Txt>
            </View>
          </View>
        </HeroCard>

        {/* Brze brojke */}
        <View style={styles.quickRow}>
          {quick.map((q) => (
            <View key={q.label} style={styles.quickCard}>
              <Txt style={styles.quickVal}>{q.value}</Txt>
              <Txt style={styles.quickLabel}>{q.label}</Txt>
            </View>
          ))}
        </View>

        {/* Najbolji igrač — postavlja ga organizator nakon utakmice */}
        {m.best_player_id && (
          <View style={styles.bestRow}>
            <Ionicons name="star" size={15} color={C.gold} />
            <Txt style={styles.bestLabel}>{t('live.bestPlayer')}</Txt>
            <Txt style={styles.bestName} numberOfLines={1}>
              {d.players.find((p) => p.id === m.best_player_id)?.name ?? '—'}
            </Txt>
          </View>
        )}

        {/* Tijek utakmice — cik-cak: domaći lijevo, gosti desno */}
        <SectionLabel>{t('live.flowTitle')}</SectionLabel>
        <View style={styles.flowCard}>
          {feed.length === 0 ? (
            <Txt color={C.sub} style={styles.flowEmpty}>
              {m.status === 'scheduled' ? t('live.scheduledMsg') : t('live.noEvents')}
            </Txt>
          ) : (
            feed.map(({ e, score }) => (
              <FeedRow
                key={e.id}
                e={e}
                score={score}
                isHome={e.team_id === m.home_team_id}
                chip={crestGradientFor(e.team_id === m.home_team_id ? crests[0] : crests[1])[0]}
                playerName={d.players.find((p) => p.id === e.player_id)?.name ?? null}
              />
            ))
          )}
        </View>

        {/* Sastavi */}
        <SectionLabel>{t('live.rosters')}</SectionLabel>
        {[home, away].map(
          (tm, i) =>
            tm && (
              <View key={tm.id} style={styles.roster}>
                <LinearGradient
                  colors={[crestGradientFor(crests[i]!)[0], crestGradientFor(crests[i]!)[1]]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.rosterHead}
                >
                  <Crest code={tm.short_code} index={crests[i]} logoUrl={tm.logo_url} size={24} />
                  <Txt style={styles.rosterName}>{tm.name}</Txt>
                </LinearGradient>
                {d.playersOf(tm.id).map((p) => (
                  <View key={p.id} style={styles.pRow}>
                    <Txt style={styles.pNum}>{p.number ?? '–'}</Txt>
                    <Txt style={styles.pName} numberOfLines={1}>
                      {p.name}
                    </Txt>
                    {p.is_captain && <Txt style={styles.pCaptain}>{t('team.captain')}</Txt>}
                  </View>
                ))}
              </View>
            )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedRow({
  e,
  score,
  isHome,
  chip,
  playerName,
}: {
  e: MatchEvent;
  score: string | null;
  isHome: boolean;
  chip: string;
  playerName: string | null;
}) {
  const { t } = useT();
  const meta = EV[e.type];

  return (
    <View style={[styles.evRow, !isHome && styles.evRowAway]}>
      <Txt style={styles.evMin}>{e.minute}'</Txt>
      <View style={[styles.evChip, { backgroundColor: chip }]}>
        <Ionicons name={meta.icon} size={15} color="#fff" />
      </View>
      <View style={[styles.evBody, !isHome && { alignItems: 'flex-end' }]}>
        <Txt style={styles.evPlayer} numberOfLines={1}>
          {playerName ?? t(meta.label)}
        </Txt>
        <Txt style={styles.evNote}>{t(meta.label)}</Txt>
      </View>
      <Txt style={[styles.evScore, !score && { color: C.mut }]}>{score ?? ''}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SP.screenX,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: R.chip,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTitle: { fontFamily: F.head, fontSize: 19, letterSpacing: 0.5, color: C.txt },
  subtitle: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 3 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(225,29,42,.14)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,42,.4)',
    borderRadius: R.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.red },
  livePillTxt: { fontFamily: F.head, fontSize: 11, letterSpacing: 1.2, color: C.redLt },
  donePill: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  donePillTxt: { fontFamily: F.headSemi, fontSize: 11, letterSpacing: 1.2, color: C.sub },

  content: { paddingHorizontal: SP.screenX, paddingTop: 2, paddingBottom: 40 },

  scoreGrid: { flexDirection: 'row', alignItems: 'center', gap: SP.tight },
  side: { flex: 1, alignItems: 'center', gap: SP.gap },
  sideName: {
    fontFamily: F.headSemi,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.txt,
  },
  scoreMid: { alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  scoreNum: { fontFamily: F.head, fontSize: 54, letterSpacing: 1, color: C.txt, lineHeight: 56 },
  scoreSep: { fontFamily: F.head, fontSize: 30, color: C.mut },
  statusLine: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 0.5, color: C.sub, marginTop: 8 },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: SP.cardGap },
  quickCard: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingVertical: SP.rowY,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quickVal: { fontFamily: F.head, fontSize: 19, color: C.txt, lineHeight: 21 },
  quickLabel: {
    fontFamily: F.body,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: 2,
  },

  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    marginTop: SP.cardGap,
    paddingVertical: SP.rowY,
    paddingHorizontal: SP.divider,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.4)',
    backgroundColor: 'rgba(217,178,74,.08)',
  },
  bestLabel: { fontFamily: F.headSemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.goldTxt },
  bestName: { flex: 1, textAlign: 'right', fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  flowCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  flowEmpty: { padding: 16 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  // Gost se crta zrcalno — događaj stoji na strani ekipe koja ga je napravila.
  evRowAway: { flexDirection: 'row-reverse' },
  evMin: { width: 34, textAlign: 'center', fontFamily: F.head, fontSize: 13, color: C.sub },
  evChip: { width: 30, height: 30, borderRadius: R.crestSm, alignItems: 'center', justifyContent: 'center' },
  evBody: { flex: 1, gap: 1 },
  evPlayer: { fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  evNote: { fontFamily: F.body, fontSize: 11, color: C.sub },
  evScore: { fontFamily: F.head, fontSize: 13, letterSpacing: 0.5, color: C.txt },

  roster: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
    marginBottom: 10,
  },
  rosterHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: SP.cardGap },
  rosterName: { flex: 1, fontFamily: F.headSemi, fontSize: 14, color: '#fff' },
  pRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: SP.cardGap,
    borderTopWidth: 1,
    borderTopColor: C.lineRow,
  },
  pNum: { width: 24, textAlign: 'center', fontFamily: F.head, fontSize: 13, color: C.sub },
  pName: { flex: 1, fontFamily: F.bodyMed, fontSize: 13, color: C.txt2 },
  pCaptain: { fontFamily: F.headSemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.red },
});
