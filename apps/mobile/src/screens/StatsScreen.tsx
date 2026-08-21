import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { aggregateStats, type StatCategory } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { useGender } from '../lib/useGender';
import { C, F, R, SP } from '../theme';
import { BrandStripe } from '../components/home';
import { Crest, Txt, useRefreshControl } from '../components/base';

const CATS: { cat: StatCategory; key: StringKey; unit: StringKey; leader: StringKey }[] = [
  { cat: 'scorers', key: 'stats.scorers', unit: 'stats.unit.goals', leader: 'stats.leadScorer' },
  { cat: 'goalkeepers', key: 'stats.keepers', unit: 'stats.unit.saves', leader: 'stats.leadKeeper' },
  { cat: 'suspensions', key: 'stats.suspensions', unit: 'stats.unit.susp', leader: 'stats.leadSusp' },
  { cat: 'red_cards', key: 'stats.reds', unit: 'stats.unit.reds', leader: 'stats.leadRed' },
];

export function StatsScreen() {
  const { t } = useT();
  const d = useData();
  const { gender, setGender } = useGender();
  const [cat, setCat] = useState<StatCategory>('scorers');
  const refreshControl = useRefreshControl();

  const matchIds = new Set(d.matches.filter((m) => m.gender === gender).map((m) => m.id));
  const events = d.events.filter((e) => matchIds.has(e.match_id));
  const rows = aggregateStats(events)[cat];

  const playerInfo = (playerId: string) => {
    const p = d.players.find((x) => x.id === playerId);
    const team = p ? d.teamById(p.team_id) : undefined;
    return { name: p?.name ?? '—', team };
  };

  const meta = CATS.find((c) => c.cat === cat)!;
  const top = rows[0] ?? null;
  const topInfo = top ? playerInfo(top.playerId) : null;
  // Traka je relativna prema vodećem — pokazuje razmak, ne apsolutni broj.
  const max = top?.count ?? 1;

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      {/* Naslov + M/Ž pilule */}
      <View style={styles.titleRow}>
        <Txt style={styles.title}>{t('stats.title').toUpperCase()}</Txt>
        <View style={styles.compWrap}>
          {(['m', 'z'] as const).map((g) => (
            <Pressable
              key={g}
              onPress={() => setGender(g)}
              style={[styles.compPill, gender === g && styles.compPillOn]}
            >
              <Txt style={[styles.compTxt, gender === g && { color: '#fff' }]}>
                {g === 'm' ? t('common.men') : t('common.women')}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Kategorije */}
      <View style={styles.segs}>
        {CATS.map((c) => (
          <Pressable
            key={c.cat}
            onPress={() => setCat(c.cat)}
            style={[styles.seg, cat === c.cat && styles.segOn]}
          >
            <Txt style={[styles.segTxt, cat === c.cat && { color: '#fff' }]} numberOfLines={1}>
              {t(c.key)}
            </Txt>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {rows.length === 0 ? (
          <Txt color={C.sub} style={{ paddingVertical: SP.rowY }}>
            {t('stats.emptyCat')}
          </Txt>
        ) : (
          <>
            {/* Vodeći — istaknuta kartica */}
            {top && topInfo && (
              <LinearGradient
                colors={['#23090C', C.card]}
                locations={[0, 0.6]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={styles.leader}
              >
                <Txt style={styles.leaderLabel}>{t(meta.leader).toUpperCase()}</Txt>
                <View style={styles.leaderRow}>
                  <LinearGradient
                    colors={[C.red, C.redDk]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={styles.leaderAvatar}
                  >
                    <Txt style={styles.leaderInit}>{initials(topInfo.name)}</Txt>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.leaderName} numberOfLines={1}>
                      {topInfo.name}
                    </Txt>
                    <Txt style={styles.leaderTeam} numberOfLines={1}>
                      {topInfo.team?.name}
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt style={styles.leaderValue}>{top.count}</Txt>
                    <Txt style={styles.leaderUnit}>{t(meta.unit)}</Txt>
                  </View>
                </View>
              </LinearGradient>
            )}

            <Txt style={styles.listTitle}>{t(meta.key)}</Txt>
            <View style={styles.listCard}>
              {rows.map((r, i) => {
                const info = playerInfo(r.playerId);
                return (
                  <View key={r.playerId} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <Txt style={[styles.rank, r.rank === 1 && { color: C.gold }]}>{r.rank}</Txt>
                    <Crest
                      code={info.team?.short_code}
                      index={info.team?.sort_order ?? 0}
                      logoUrl={info.team?.logo_url}
                      size={30}
                    />
                    <View style={{ flex: 1 }}>
                      <Txt style={styles.name} numberOfLines={1}>
                        {info.name}
                      </Txt>
                      <Txt style={styles.team} numberOfLines={1}>
                        {info.team?.name}
                      </Txt>
                    </View>
                    <View style={styles.bar}>
                      <LinearGradient
                        colors={[C.redDk, C.red]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={[styles.barFill, { width: `${Math.round((r.count / max) * 100)}%` }]}
                      />
                    </View>
                    <Txt style={styles.value}>{r.count}</Txt>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SP.headerX,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: { flex: 1, fontFamily: F.head, fontSize: 28, letterSpacing: 0.6, color: C.txt },
  compWrap: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
  },
  compPill: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: R.pill },
  compPillOn: { backgroundColor: C.red },
  compTxt: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 0.5, color: C.sub },

  segs: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: SP.screenX,
    marginTop: 8,
    marginBottom: SP.hair,
    padding: 4,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
  },
  seg: { flex: 1, alignItems: 'center', paddingVertical: SP.gap, borderRadius: 8 },
  segOn: {
    backgroundColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  segTxt: { fontFamily: F.headSemi, fontSize: 13, color: C.sub },

  content: { paddingHorizontal: SP.screenX, paddingTop: 10, paddingBottom: 28 },

  leader: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4A1117',
    paddingVertical: 16,
    paddingHorizontal: SP.screenX,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  leaderLabel: {
    fontFamily: F.headSemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.redLt,
    marginBottom: 12,
  },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: SP.cardGap },
  leaderAvatar: { width: 54, height: 54, borderRadius: R.card, alignItems: 'center', justifyContent: 'center' },
  leaderInit: { fontFamily: F.head, fontSize: 20, color: '#fff' },
  leaderName: { fontFamily: F.head, fontSize: 19, letterSpacing: 0.3, color: C.txt },
  leaderTeam: { fontFamily: F.body, fontSize: 13, color: C.sub, marginTop: 2 },
  leaderValue: { fontFamily: F.head, fontSize: 34, color: C.txt, lineHeight: 36 },
  leaderUnit: {
    fontFamily: F.body,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.sub,
  },

  listTitle: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.mut,
    marginBottom: SP.gap,
    marginHorizontal: SP.hair,
  },
  listCard: {
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 15 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.lineRow },
  rank: { width: 18, textAlign: 'center', fontFamily: F.head, fontSize: 14, color: C.mut },
  name: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  team: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 1 },
  bar: { width: 88, height: 8, borderRadius: 999, backgroundColor: C.card2, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999 },
  value: { width: 34, textAlign: 'right', fontFamily: F.head, fontSize: 17, color: C.txt },
});
