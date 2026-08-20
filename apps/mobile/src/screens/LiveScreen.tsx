import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { EventType, MatchEvent } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { crestColorFor } from '@zrinjski/ui-tokens';
import { useData } from '../lib/useData';
import { C, F, R, S } from '../theme';
import { Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

const STAGE: Record<string, StringKey> = {
  semifinal: 'standings.semifinal',
  third_place: 'standings.thirdPlace',
  final: 'schedule.final',
};
const EV: Record<EventType, { letter: string; color: string; label: StringKey }> = {
  goal: { letter: 'G', color: C.red, label: 'live.type.goal' },
  save: { letter: 'O', color: C.blue, label: 'live.type.save' },
  suspension_2min: { letter: "2'", color: C.gold, label: 'live.type.susp' },
  red_card: { letter: 'R', color: C.redDk, label: 'live.type.red' },
};

type Tab = 'flow' | 'rosters' | 'stats';

export function LiveScreen() {
  const { t } = useT();
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Live'>>();
  const d = useData();
  const [tab, setTab] = useState<Tab>('flow');

  const m = d.matchById(route.params.matchId);
  const home = d.teamById(m?.home_team_id);
  const away = d.teamById(m?.away_team_id);

  useLayoutEffect(() => {
    if (!m) return;
    const stage = m.stage === 'group' ? '' : `${t(STAGE[m.stage]!)} · `;
    nav.setOptions({
      title: `${stage}${m.gender === 'm' ? t('common.men') : t('common.women')}`,
      headerRight: () => (
        <Pressable hitSlop={10}>
          <Txt color={C.red} style={{ fontFamily: F.headSemi }}>
            {t('live.share')}
          </Txt>
        </Pressable>
      ),
    });
  }, [m, nav, t]);

  if (!m) {
    return (
      <View style={styles.safe}>
        <Txt color={C.sub} style={{ padding: S.lg }}>
          {t('common.empty')}
        </Txt>
      </View>
    );
  }

  // Tijek + tekući rezultat.
  const asc = d.eventsOf(m.id).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  let h = 0;
  let a = 0;
  const feed = asc.map((e) => {
    if (e.type === 'goal') {
      if (e.team_id === m.home_team_id) h++;
      else if (e.team_id === m.away_team_id) a++;
    }
    return { e, score: e.type === 'goal' ? `${h}:${a}` : null };
  });
  feed.reverse();

  const playerName = (id: string | null) => d.players.find((p) => p.id === id)?.name ?? '—';
  const teamCode = (id: string) => d.teamById(id)?.short_code ?? '';

  const tabBtn = (id: Tab, key: StringKey) => (
    <Pressable style={styles.tab} onPress={() => setTab(id)}>
      <Txt style={[styles.tabTxt, tab === id && { color: C.txt }]}>{t(key)}</Txt>
      {tab === id && <View style={styles.tabUnderline} />}
    </Pressable>
  );

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ paddingBottom: S.xxl }}>
      {/* Rezultat */}
      <View style={styles.scoreWrap}>
        {m.status === 'live' && (
          <View style={styles.liveRow}>
            <View style={styles.dot} />
            <Txt style={styles.liveTxt}>{t('common.live')}</Txt>
          </View>
        )}
        <View style={styles.scoreRow}>
          <View style={styles.side}>
            <Crest code={home?.short_code} index={home?.sort_order} logoUrl={home?.logo_url} size={72} />
            <Txt style={styles.sideName}>{home?.name?.toUpperCase()}</Txt>
          </View>
          <Txt style={styles.big}>
            {m.home_score} : {m.away_score}
          </Txt>
          <View style={styles.side}>
            <Crest code={away?.short_code} index={away?.sort_order} logoUrl={away?.logo_url} size={72} />
            <Txt style={styles.sideName}>{away?.name?.toUpperCase()}</Txt>
          </View>
        </View>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, ((m.current_minute ?? 0) / (d.tournament?.match_duration_min ?? 15)) * 100)}%` },
            ]}
          />
        </View>
        {m.status === 'live' && (
          <Txt variant="caption" style={{ textAlign: 'center', marginTop: S.sm }}>
            {m.current_half ?? 1}. {t('common.half')} · {m.current_minute}:00
          </Txt>
        )}
      </View>

      {/* Tabovi */}
      <View style={styles.tabs}>
        {tabBtn('flow', 'live.flow')}
        {tabBtn('rosters', 'live.rosters')}
        {tabBtn('stats', 'live.statsTab')}
      </View>

      <View style={{ padding: S.lg }}>
        {tab === 'flow' && (
          <>
            <Txt variant="label" style={{ marginBottom: S.sm }}>
              {t('live.flowTitle')}
            </Txt>
            {feed.length === 0 ? (
              <Txt color={C.sub}>{m.status === 'scheduled' ? t('live.scheduledMsg') : t('live.noEvents')}</Txt>
            ) : (
              feed.map(({ e, score }, i) => (
                <FeedRow
                  key={e.id}
                  e={e}
                  score={score}
                  last={i === feed.length - 1}
                  isHome={e.team_id === m.home_team_id}
                  color={crestColorFor(d.teamById(e.team_id)?.sort_order ?? 0)}
                  playerName={playerName}
                  teamCode={teamCode}
                />
              ))
            )}
          </>
        )}

        {tab === 'rosters' && (
          <View style={styles.rosters}>
            {[home, away].map(
              (tm) =>
                tm && (
                  <View key={tm.id} style={styles.roster}>
                    <View style={[styles.rosterHead, { backgroundColor: crestColorFor(tm.sort_order) }]}>
                      <Crest code={tm.short_code} index={tm.sort_order} logoUrl={tm.logo_url} size={24} />
                      <Txt style={styles.rosterName}>{tm.name}</Txt>
                    </View>
                    {d.playersOf(tm.id).map((p) => (
                      <View key={p.id} style={styles.pRow}>
                        <Txt style={styles.pNum}>{p.number ?? '–'}</Txt>
                        <Txt style={styles.pName}>
                          {p.name}
                          {p.is_captain ? '  (K)' : ''}
                        </Txt>
                      </View>
                    ))}
                  </View>
                )
            )}
          </View>
        )}

        {tab === 'stats' && <MatchStats matchEvents={asc} />}
      </View>
    </ScrollView>
  );
}

function FeedRow({
  e,
  score,
  last,
  isHome,
  color,
  playerName,
  teamCode,
}: {
  e: MatchEvent;
  score: string | null;
  last: boolean;
  isHome: boolean;
  color: string;
  playerName: (id: string | null) => string;
  teamCode: (id: string) => string;
}) {
  const { t } = useT();
  const meta = EV[e.type];
  const align = isHome ? 'flex-end' : 'flex-start';
  // Traka u boji ekipe na vanjskom rubu (domaći: lijevo, gosti: desno).
  const stripe = isHome
    ? { borderLeftWidth: 3, borderLeftColor: color }
    : { borderRightWidth: 3, borderRightColor: color };

  const card = (
    <View style={[styles.evCard, { alignItems: align }, stripe]}>
      <Txt style={[styles.feedName, !isHome && { textAlign: 'left' }, isHome && { textAlign: 'right' }]}>
        {playerName(e.player_id)}
      </Txt>
      <Txt variant="caption" style={isHome ? { textAlign: 'right' } : { textAlign: 'left' }}>
        {t(meta.label)} · {teamCode(e.team_id)}
      </Txt>
      {score && (
        <View style={styles.feedScore}>
          <Txt style={styles.feedScoreTxt}>{score}</Txt>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.feedRow}>
      <View style={styles.sideLeft}>{isHome ? card : null}</View>
      <View style={styles.center}>
        <Txt style={styles.feedMin}>{e.minute}'</Txt>
        <View style={[styles.feedBadge, { backgroundColor: meta.color }]}>
          <Txt style={styles.feedBadgeTxt}>{meta.letter}</Txt>
        </View>
        {!last && <View style={styles.feedBar} />}
      </View>
      <View style={styles.sideRight}>{!isHome ? card : null}</View>
    </View>
  );
}

function MatchStats({ matchEvents }: { matchEvents: MatchEvent[] }) {
  const { t } = useT();
  const d = useData();
  const counts = new Map<string, number>();
  for (const e of matchEvents) if (e.type === 'goal' && e.player_id) counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return <Txt color={C.sub}>{t('live.noEvents')}</Txt>;
  return (
    <>
      <Txt variant="label" style={{ marginBottom: S.sm }}>
        {t('stats.scorers')}
      </Txt>
      {rows.map(([pid, n]) => {
        const p = d.players.find((x) => x.id === pid);
        const team = p ? d.teamById(p.team_id) : undefined;
        return (
          <View key={pid} style={styles.statRow}>
            <Crest code={team?.short_code} index={team?.sort_order} logoUrl={team?.logo_url} size={28} />
            <Txt style={{ flex: 1, fontFamily: F.bodySemi }}>{p?.name}</Txt>
            <Txt style={{ fontFamily: F.head, fontSize: 18 }}>{n}</Txt>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scoreWrap: { backgroundColor: C.card, padding: S.lg, overflow: 'hidden' },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginBottom: S.sm },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.red },
  liveTxt: { fontFamily: F.head, color: C.red, letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', gap: 6, width: 100 },
  sideName: { fontFamily: F.headSemi, fontSize: 13, textAlign: 'center' },
  big: { fontFamily: F.head, fontSize: 56 },
  progress: { height: 4, backgroundColor: C.line, borderRadius: 999, overflow: 'hidden', marginTop: S.md },
  progressFill: { height: 4, backgroundColor: C.red },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: S.md },
  tabTxt: { fontFamily: F.headSemi, fontSize: 15, color: C.sub },
  tabUnderline: { height: 2, backgroundColor: C.red, alignSelf: 'stretch', marginTop: 8 },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sideLeft: { flex: 1, alignItems: 'flex-end', paddingRight: S.sm, paddingBottom: S.lg },
  sideRight: { flex: 1, alignItems: 'flex-start', paddingLeft: S.sm, paddingBottom: S.lg },
  center: { width: 44, alignItems: 'center', alignSelf: 'stretch' },
  feedMin: { fontFamily: F.headSemi, color: C.sub, fontSize: 12, marginBottom: 4 },
  feedBadge: { width: 36, height: 36, borderRadius: R.chip, alignItems: 'center', justifyContent: 'center' },
  feedBadgeTxt: { fontFamily: F.head, color: '#fff', fontSize: 14 },
  feedBar: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 2 },
  evCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    gap: 2,
    maxWidth: '100%',
  },
  feedName: { fontFamily: F.bodySemi, fontSize: 15 },
  feedScore: { backgroundColor: C.card2, borderRadius: R.chip, paddingHorizontal: S.sm, paddingVertical: 3, marginTop: 4 },
  feedScoreTxt: { fontFamily: F.head, color: C.red, fontSize: 14 },
  rosters: { gap: S.md },
  roster: { borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' },
  rosterHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm },
  rosterName: { fontFamily: F.head, color: '#fff' },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 6, paddingHorizontal: S.md, borderTopWidth: 1, borderTopColor: C.line },
  pNum: { width: 28, textAlign: 'center', fontFamily: F.headSemi, color: C.sub },
  pName: { fontFamily: F.body, fontSize: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
});
