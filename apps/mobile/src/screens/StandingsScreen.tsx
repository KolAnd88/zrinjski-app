import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Grp } from '@zrinjski/core';
import { buildBracket, computeStandings, type StandingRow } from '@zrinjski/core';
import { crestPair } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useFollow } from '../lib/useFollow';
import { useGender } from '../lib/useGender';
import { C, F, R, SP } from '../theme';
import { BrandStripe } from '../components/home';
import { Crest, Txt, useRefreshControl } from '../components/base';
import { GenderToggle } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

export function StandingsScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const { gender, setGender } = useGender();
  const { followed } = useFollow();
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

  const bracket =
    groups.length >= 2
      ? buildBracket({ gender, groupA: standingsOf(groups[0]!), groupB: standingsOf(groups[1]!) })
      : [];

  /**
   * Do ždrijeba ovaj ekran nije imao što pokazati — ni jedna grupa nema ekipa,
   * pa je ispod prekidača ostajala praznina. Tada prikazujemo popis prijavljenih,
   * jer je to jedino što se u toj fazi zna i jedino što ljude zanima.
   */
  // Abecedno, ne po `sort_order`: taj redoslijed nosi boju grba i nema veze s
  // imenom, pa bi čovjek koji traži svoj klub morao čitati cijeli popis.
  const registered = d.teams
    .filter((tm) => tm.gender === gender)
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'));

  /**
   * Ždrijeb se smatra objavljenim kad POSTOJE GRUPNE UTAKMICE.
   *
   * To je jedini pouzdan znak: utakmice se generiraju tek nakon spremljenog
   * ždrijeba, pa ih prije njega nema. Dva ranija pravila nisu valjala —
   * "barem jedna ekipa ima grupu" pokazivalo je tablicu s jednom ekipom već
   * usred raspoređivanja, a "sve ekipe imaju grupu" je bilo prekruto: jedna
   * probna ili naknadno prijavljena ekipa bez grupe sakrila bi cijeli poredak
   * iako je turnir odavno u tijeku.
   */
  const drawn = d.matches.some((m) => m.gender === gender && m.stage === 'group');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      <View style={styles.titleWrap}>
        <Txt style={styles.title}>{t('standings.title').toUpperCase()}</Txt>
      </View>
      <View style={styles.toggleWrap}>
        <GenderToggle value={gender} onChange={setGender} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* ── PRIJAVLJENE EKIPE (do ždrijeba) ──────────────────────────── */}
        {!drawn && (
          <>
            <View style={styles.regHead}>
              <Txt style={styles.groupLabel}>{t('standings.registered').toUpperCase()}</Txt>
              {registered.length > 0 && (
                <Txt style={styles.regCount}>
                  {t('standings.registeredCount', { n: registered.length })}
                </Txt>
              )}
            </View>

            {registered.length === 0 ? (
              <Txt style={styles.regEmpty}>{t('standings.registeredEmpty')}</Txt>
            ) : (
              <>
                <View style={styles.table}>
                  {registered.map((tm, i) => {
                    const mine = followed.includes(tm.id);
                    return (
                      <Pressable
                        key={tm.id}
                        onPress={() => nav.navigate('Team', { teamId: tm.id })}
                        // Bez zaglavlja tablice prvi red ne smije nositi gornju
                        // crtu — inače visi odvojen od ruba kartice.
                        style={[styles.trow, i === 0 && styles.trowFirst, mine && styles.trowMine]}
                      >
                        <Crest
                          code={tm.short_code}
                          index={tm.sort_order}
                          logoUrl={tm.logo_url}
                          size={26}
                        />
                        <Txt numberOfLines={1} style={[styles.tName, mine ? styles.tNameMine : null]}>
                          {tm.name}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
                <Txt style={styles.regHint}>{t('standings.registeredHint')}</Txt>
              </>
            )}
          </>
        )}

        {/* Tablice i završnica postoje tek nakon ždrijeba — prazna grupa bez
            ekipa nikome ništa ne govori, samo zbunjuje. */}
        {drawn && groups.map((g) => (
          <View key={g.id}>
            <Txt style={styles.groupLabel}>{g.name}</Txt>

            <View style={styles.table}>
              {/* Zaglavlje tablice */}
              <View style={styles.thead}>
                <Txt style={[styles.hCell, styles.cRank]}>#</Txt>
                <Txt style={[styles.hCell, { flex: 1 }]}>{t('standings.team')}</Txt>
                <Txt style={[styles.hCell, styles.cPlayed]}>{t('standings.colPlayed')}</Txt>
                <Txt style={[styles.hCell, styles.cGd]}>{t('standings.gd')}</Txt>
                <Txt style={[styles.hCell, styles.cPts, { color: C.sub }]}>{t('standings.pts')}</Txt>
              </View>

              {standingsOf(g).map((r) => {
                const team = d.teamById(r.teamId);
                const mine = followed.includes(r.teamId);
                // Prvo mjesto je zlatno, ostali koji prolaze zeleni, ostatak prigušen.
                const rankColor = r.rank === 1 ? C.gold : r.qualifies ? C.green : C.mut;
                return (
                  <Pressable
                    key={r.teamId}
                    onPress={() => nav.navigate('Team', { teamId: r.teamId })}
                    style={[styles.trow, mine && styles.trowMine]}
                  >
                    <View style={styles.cRank}>
                      {r.qualifies && <View style={styles.qualBar} />}
                      <Txt style={[styles.rankTxt, { color: rankColor }]}>{r.rank}</Txt>
                    </View>
                    <Crest
                      code={team?.short_code}
                      index={team?.sort_order ?? 0}
                      logoUrl={team?.logo_url}
                      size={26}
                    />
                    <Txt
                      numberOfLines={1}
                      style={[styles.tName, mine ? styles.tNameMine : null]}
                    >
                      {r.teamName}
                    </Txt>
                    <Txt style={[styles.num, styles.cPlayed]}>{r.played}</Txt>
                    <Txt style={[styles.num, styles.cGd, r.goalDiff < 0 && { color: C.navOff }]}>
                      {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                    </Txt>
                    <Txt style={[styles.ptsTxt, styles.cPts]}>{r.points}</Txt>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendDot} />
              <Txt style={styles.legendTxt}>{t('standings.advance', { n: cfg.advancePerGroup })}</Txt>
            </View>
          </View>
        ))}

        {/* ── ZAVRŠNICA ────────────────────────────────────────────────── */}
        {drawn && bracket.length > 0 && (
          <>
            <Txt style={[styles.groupLabel, { marginTop: SP.section }]}>{t('standings.bracket')}</Txt>
            {bracket.map((bm) => {
              const isFinal = bm.key === 'final';
              const home = bm.home.teamId ? d.teamById(bm.home.teamId) : undefined;
              const away = bm.away.teamId ? d.teamById(bm.away.teamId) : undefined;
              const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 1);
              return (
                <View key={bm.key} style={[styles.bcard, isFinal && styles.bcardFinal]}>
                  <Txt style={[styles.bLabel, isFinal && { color: C.gold }]}>{bm.label}</Txt>
                  <View style={styles.brow}>
                    <View style={styles.bside}>
                      <Crest
                        code={home?.short_code ?? bm.home.placeholder}
                        index={crests[0]}
                        logoUrl={home?.logo_url}
                        size={24}
                      />
                      <Txt numberOfLines={1} style={styles.bname}>
                        {home?.name ?? bm.home.placeholder}
                      </Txt>
                    </View>
                    <Txt style={[styles.bvs, isFinal && { color: C.gold }]}>{t('common.vs')}</Txt>
                    <View style={[styles.bside, styles.bsideRight]}>
                      <Txt numberOfLines={1} style={[styles.bname, { textAlign: 'right' }]}>
                        {away?.name ?? bm.away.placeholder}
                      </Txt>
                      <Crest
                        code={away?.short_code ?? bm.away.placeholder}
                        index={crests[1]}
                        logoUrl={away?.logo_url}
                        size={24}
                      />
                    </View>
                  </View>
                </View>
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
  titleWrap: { paddingHorizontal: SP.headerX, paddingTop: 8, paddingBottom: 6 },
  title: { fontFamily: F.head, fontSize: 28, letterSpacing: 0.6, color: C.txt },
  toggleWrap: { paddingHorizontal: SP.screenX, paddingTop: 8, paddingBottom: SP.hair },
  content: { paddingHorizontal: SP.screenX, paddingTop: 8, paddingBottom: 28 },

  groupLabel: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.mut,
    marginTop: 10,
    marginBottom: SP.gap,
    marginHorizontal: SP.hair,
  },

  table: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SP.gap,
    paddingHorizontal: SP.cardGap,
    backgroundColor: C.card2,
  },
  hCell: {
    fontFamily: F.headSemi,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.mut,
    textAlign: 'center',
  },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: SP.cardGap,
    borderTopWidth: 1,
    borderTopColor: C.lineRow,
  },
  trowFirst: { borderTopWidth: 0 },
  // Praćena ekipa dobiva blagi crveni podložak i jači tekst.
  trowMine: { backgroundColor: 'rgba(225,29,42,.06)' },

  regHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  regCount: {
    fontFamily: F.headSemi,
    fontSize: 11,
    letterSpacing: 0.8,
    color: C.sub,
    marginHorizontal: SP.hair,
  },
  regHint: {
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 18,
    color: C.mut,
    marginTop: SP.gap,
    marginHorizontal: SP.hair,
  },
  regEmpty: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 20,
    color: C.sub,
    marginHorizontal: SP.hair,
  },

  cRank: { width: 16, alignItems: 'center', justifyContent: 'center' },
  cPlayed: { width: 26 },
  cGd: { width: 36 },
  cPts: { width: 24 },

  qualBar: {
    position: 'absolute',
    left: -9,
    top: 2,
    bottom: 2,
    width: 3,
    borderRadius: 2,
    backgroundColor: C.green,
  },
  rankTxt: { fontFamily: F.head, fontSize: 13 },
  tName: { flex: 1, fontFamily: F.bodyMed, fontSize: 13, color: C.txt2 },
  tNameMine: { fontFamily: F.bodyBold, color: C.txt },
  num: { fontFamily: F.body, fontSize: 13, color: C.sub, textAlign: 'center' },
  ptsTxt: { fontFamily: F.head, fontSize: 15, color: C.txt, textAlign: 'center' },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: SP.gap, marginHorizontal: SP.hair },
  legendDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.green },
  legendTxt: { fontFamily: F.body, fontSize: 12, color: C.green },

  bcard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: SP.divider,
    paddingHorizontal: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  bcardFinal: { borderColor: 'rgba(217,178,74,.5)' },
  bLabel: {
    fontFamily: F.headSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.sub,
    marginBottom: 10,
  },
  brow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bside: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bsideRight: { justifyContent: 'flex-end' },
  bname: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  bvs: { fontFamily: F.headSemi, fontSize: 15, color: C.sub },
});
