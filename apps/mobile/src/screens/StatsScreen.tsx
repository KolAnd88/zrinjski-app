import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aggregateStats, type StatCategory } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { useGender } from '../lib/useGender';
import { C, F, R, S } from '../theme';
import { Crest, Txt, useRefreshControl } from '../components/base';
import { GenderToggle } from '../components/match';

const CATS: { cat: StatCategory; key: StringKey; unit: StringKey }[] = [
  { cat: 'scorers', key: 'stats.scorers', unit: 'stats.unit.goals' },
  { cat: 'goalkeepers', key: 'stats.keepers', unit: 'stats.unit.saves' },
  { cat: 'suspensions', key: 'stats.suspensions', unit: 'stats.unit.susp' },
  { cat: 'red_cards', key: 'stats.reds', unit: 'stats.unit.reds' },
];

export function StatsScreen() {
  const { t } = useT();
  const d = useData();
  const { gender, setGender } = useGender();
  const [cat, setCat] = useState<StatCategory>('scorers');
  const refreshControl = useRefreshControl();

  // Događaji utakmica zadanog spola.
  const matchIds = new Set(d.matches.filter((m) => m.gender === gender).map((m) => m.id));
  const events = d.events.filter((e) => matchIds.has(e.match_id));
  const stats = aggregateStats(events);
  const rows = stats[cat];

  const playerInfo = (playerId: string) => {
    const p = d.players.find((x) => x.id === playerId);
    const team = p ? d.teamById(p.team_id) : undefined;
    return { name: p?.name ?? '—', team };
  };

  // Najbolji igrač turnira: ručno polje (best_player_id) ako postoji; inače najbolji strijelac.
  const manualBest = d.matches.find((m) => m.gender === gender && m.best_player_id)?.best_player_id;
  const bestId = manualBest ?? stats.scorers[0]?.playerId ?? null;
  const best = bestId ? playerInfo(bestId) : null;

  const unitKey = CATS.find((c) => c.cat === cat)!.unit;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={styles.head}>
          <Txt variant="h1">{t('stats.title').toUpperCase()}</Txt>
          <View style={{ width: 180 }}>
            <GenderToggle value={gender} onChange={setGender} />
          </View>
        </View>

        {/* Kategorije */}
        <View style={styles.tabs}>
          {CATS.map((c) => (
            <Pressable key={c.cat} onPress={() => setCat(c.cat)} style={styles.tab}>
              <Txt style={[styles.tabTxt, cat === c.cat && { color: C.txt }]}>{t(c.key)}</Txt>
              {cat === c.cat && <View style={styles.tabUnderline} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Txt variant="label">{t(CATS.find((c) => c.cat === cat)!.key)}</Txt>
          <Txt variant="caption">{t(unitKey)}</Txt>
        </View>

        {rows.length === 0 ? (
          <Txt color={C.sub} style={{ paddingVertical: S.md }}>
            {t('stats.emptyCat')}
          </Txt>
        ) : (
          rows.map((r) => {
            const info = playerInfo(r.playerId);
            const isTop = r.rank === 1;
            return (
              <View key={r.playerId} style={[styles.row, isTop && styles.rowTop]}>
                <Txt style={[styles.rank, isTop && { color: C.gold }]}>{r.rank}</Txt>
                <Crest code={info.team?.short_code} index={info.team?.sort_order} logoUrl={info.team?.logo_url} size={36} />
                <View style={{ flex: 1 }}>
                  <Txt style={styles.name}>{info.name}</Txt>
                  <Txt variant="caption">{info.team?.name}</Txt>
                </View>
                <Txt style={[styles.count, isTop && { color: C.gold }]}>{r.count}</Txt>
              </View>
            );
          })
        )}

        {/* Najbolji igrač turnira */}
        {best && (
          <View style={styles.bestCard}>
            <Txt variant="label" color={C.gold}>
              {t('stats.bestPlayer')}
            </Txt>
            <View style={styles.bestRow}>
              <Crest code={best.team?.short_code} index={best.team?.sort_order} logoUrl={best.team?.logo_url} size={36} />
              <Txt style={styles.bestName}>
                {best.name} · {best.team?.name}
              </Txt>
              <Txt variant="caption">{t('stats.byOrganizer')}</Txt>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: S.xxl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: S.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: S.sm },
  tabTxt: { fontFamily: F.headSemi, fontSize: 15, color: C.sub },
  tabUnderline: { height: 2, backgroundColor: C.red, alignSelf: 'stretch', marginTop: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: S.sm },
  row: {
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
  rowTop: { borderColor: C.gold, backgroundColor: 'rgba(217,178,74,0.05)' },
  rank: { width: 24, fontFamily: F.head, fontSize: 18, color: C.sub, textAlign: 'center' },
  name: { fontFamily: F.bodySemi, fontSize: 16 },
  count: { fontFamily: F.head, fontSize: 26, color: C.txt },
  bestCard: {
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: R.card,
    padding: S.md,
    marginTop: S.md,
    gap: S.sm,
    backgroundColor: 'rgba(217,178,74,0.05)',
  },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  bestName: { flex: 1, fontFamily: F.head, fontSize: 18 },
});
