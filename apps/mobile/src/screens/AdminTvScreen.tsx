import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { Stage } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { C, F, S } from '../theme';
import { Crest, LiveDot, Txt } from '../components/base';
import { Lenta } from '../components/lenta';
import type { RootStackParamList } from '../navigation/types';

const STAGE: Record<Stage, string> = {
  group: 'GRUPA',
  semifinal: 'POLUFINALE',
  third_place: 'ZA 3. MJESTO',
  final: 'FINALE',
};

export function AdminTvScreen() {
  const { t } = useT();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AdminTv'>>();
  const d = useData();
  const m = d.matchById(params.matchId);
  if (!m) return <View style={styles.tv} />;

  const home = d.teamById(m.home_team_id);
  const away = d.teamById(m.away_team_id);
  const isLive = m.status === 'live';
  // Svi zlatni, ne samo prvi — na semaforu ih vidi cijela dvorana.
  const golds = d.sponsors.filter((s) => s.tier === 'gold' && s.is_active);

  return (
    <View style={styles.tv}>
      <Lenta />

      <View style={styles.top}>
        {/* Naziv turnira dolazi iz baze, kao i na početnom zaslonu. Zakucano
            "VHMRK ZRINJSKI CUP" ostalo je od starog imena, a ovaj se zaslon
            baca na projektor — krivo ime vidjela bi cijela dvorana. */}
        <Txt style={styles.cup}>{(d.tournament?.name ?? '').toUpperCase()}</Txt>
        <View style={styles.state}>
          {isLive && <LiveDot />}
          <Txt style={styles.stateTxt}>
            {isLive ? t('admin.live') : m.status === 'finished' ? t('admin.finishedBadge') : ''} · {STAGE[m.stage]}
          </Txt>
        </View>
        <Pressable onPress={() => nav.goBack()}>
          <Txt style={styles.exit}>‹ {t('admin.exitTv')}</Txt>
        </Pressable>
      </View>

      <View style={styles.main}>
        <View style={styles.team}>
          <Crest code={home?.short_code} index={home?.sort_order} logoUrl={home?.logo_url} size={96} />
          <Txt style={styles.teamName} numberOfLines={1}>
            {home?.name ?? '—'}
          </Txt>
        </View>
        <View style={styles.center}>
          <Txt style={styles.score}>
            {m.home_score} : {m.away_score}
          </Txt>
          <Txt style={styles.meta}>
            {STAGE[m.stage]}
            {isLive && m.current_minute != null ? ` · ${m.current_minute}'` : ''}
          </Txt>
        </View>
        <View style={styles.team}>
          <Crest code={away?.short_code} index={away?.sort_order} logoUrl={away?.logo_url} size={96} />
          <Txt style={styles.teamName} numberOfLines={1}>
            {away?.name ?? '—'}
          </Txt>
        </View>
      </View>

      <View style={styles.bottom}>
        {golds.length > 0 ? (
          <Txt style={styles.sponsor} numberOfLines={1}>
            {golds.length === 1 ? t('home.goldSponsor') : t('home.goldSponsors')}:{' '}
            <Txt style={styles.sponsorName}>{golds.map((g) => g.name).join(' · ')}</Txt>
          </Txt>
        ) : (
          <View />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tv: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: S.lg },
  cup: { fontFamily: F.head, fontSize: 14, letterSpacing: 1, color: C.txt },
  state: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateTxt: { fontFamily: F.head, fontSize: 14, letterSpacing: 1, color: C.red },
  exit: { color: C.sub, fontFamily: F.bodySemi },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: S.lg },
  team: { alignItems: 'center', gap: S.md, width: 120 },
  teamName: { fontFamily: F.head, fontSize: 22, color: C.txt, textAlign: 'center' },
  center: { alignItems: 'center' },
  score: { fontFamily: F.head, fontSize: 88, color: C.txt },
  meta: {
    fontFamily: F.headSemi,
    fontSize: 14,
    letterSpacing: 1,
    color: C.sub,
    marginTop: S.sm,
    borderTopWidth: 2,
    borderTopColor: C.line,
    paddingTop: S.sm,
  },
  bottom: { padding: S.lg, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'flex-end' },
  sponsor: { color: C.sub, fontSize: 13 },
  sponsorName: { color: C.gold, fontFamily: F.head },
});
