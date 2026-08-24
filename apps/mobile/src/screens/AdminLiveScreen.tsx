import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventType, Team } from '@zrinjski/core';
import { crestGradientFor, crestPair } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { useAuth } from '../lib/useAuth';
import { C, F, R, SP } from '../theme';
import { Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

/** Gumbi po strani. Prvi je glavni (gradijent ekipe), ostali su prigušeni. */
const ACTIONS: { type: EventType; label: StringKey; sub: StringKey; icon: keyof typeof Ionicons.glyphMap; primary?: boolean }[] = [
  { type: 'goal', label: 'live.type.goal', sub: 'admin.subGoal', icon: 'football-outline', primary: true },
  { type: 'save', label: 'live.type.save', sub: 'admin.subSave', icon: 'hand-left-outline' },
  { type: 'suspension_2min', label: 'live.type.susp', sub: 'admin.subSusp', icon: 'time-outline' },
  { type: 'red_card', label: 'live.type.red', sub: 'admin.subRed', icon: 'square' },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function AdminLiveScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AdminLive'>>();
  const d = useData();
  const { isAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const m = d.matchById(params.matchId);

  // Tablet u landscapeu dobiva tri stupca; na užem ekranu se slaže okomito.
  const wide = width >= 900;

  const [picker, setPicker] = useState<{ team: Team; type: EventType } | null>(null);
  const running = m?.status === 'live';
  const [sec, setSec] = useState(0);

  useEffect(() => {
    setSec(running ? (m?.current_minute ?? 0) * 60 : 0);
  }, [running, m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const minute = Math.floor(sec / 60);
  useEffect(() => {
    if (running && m) d.setMinute(m.id, minute);
  }, [minute, running]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) {
    return (
      <SafeAreaView style={styles.safe}>
        <Txt color={C.sub} style={{ padding: SP.screenX }}>
          {t('common.empty')}
        </Txt>
      </SafeAreaView>
    );
  }

  const home = d.teamById(m.home_team_id);
  const away = d.teamById(m.away_team_id);
  const crests = crestPair(home?.sort_order ?? 0, away?.sort_order ?? 1);
  const isLive = m.status === 'live';
  // Unos je moguc dok utakmica traje. Prije pocetka ne moze nitko; nakon
  // zavrsetka samo admin, da se rezultat moze ispraviti ali ne i mijenjati
  // usput od strane delegata.
  const canEnter = isLive || (m.status === 'finished' && isAdmin);
  const matchEvents = d.eventsOf(m.id);

  // Tijek: najnovije na vrhu, s tekućim rezultatom uz golove.
  const asc = matchEvents.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  let h = 0;
  let a = 0;
  const feed = asc
    .map((e) => {
      if (e.type === 'goal') {
        if (e.team_id === m.home_team_id) h++;
        else if (e.team_id === m.away_team_id) a++;
      }
      return { e, score: e.type === 'goal' ? `${h}:${a}` : '' };
    })
    .reverse();

  const pick = (playerId: string | null) => {
    if (!picker) return;
    d.addEvent(m.id, picker.team.id, playerId, picker.type, minute);
    setPicker(null);
  };

  const Controls = ({ team, side }: { team: Team | undefined; side: 0 | 1 }) => {
    if (!team) return null;
    const g = crestGradientFor(crests[side]!);
    return (
      <View style={[styles.controls, wide && { flex: 1 }]}>
        {ACTIONS.map((act) =>
          act.primary ? (
            <Pressable key={act.type} onPress={() => setPicker({ team, type: act.type })} disabled={!canEnter}>
              <LinearGradient
                colors={[g[0], g[1]]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={[styles.actBtn, styles.actPrimary, !canEnter && styles.actOff]}
              >
                <View style={styles.actIcon}>
                  <Ionicons name={act.icon} size={20} color="#fff" />
                </View>
                <Txt style={styles.actLabel}>{t(act.label).toUpperCase()}</Txt>
                <Txt style={styles.actSubOn}>{t(act.sub)}</Txt>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              key={act.type}
              disabled={!canEnter}
              onPress={() => setPicker({ team, type: act.type })}
              style={[styles.actBtn, styles.actSecondary, !canEnter && styles.actOff]}
            >
              <View style={styles.actIconDim}>
                <Ionicons name={act.icon} size={20} color={C.txt} />
              </View>
              <Txt style={styles.actLabel}>{t(act.label).toUpperCase()}</Txt>
              <Txt style={styles.actSub}>{t(act.sub)}</Txt>
            </Pressable>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Gornja traka */}
      <View style={styles.topBar}>
        <Pressable style={styles.chipBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={15} color={C.sub} />
          <Txt style={styles.chipTxt}>{t('admin.dashboard')}</Txt>
        </Pressable>

        {isLive && (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Txt style={styles.livePillTxt}>{t('admin.live')}</Txt>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <Pressable style={styles.chipBtn} onPress={() => nav.navigate('AdminTv', { matchId: m.id })}>
          <Ionicons name="tv-outline" size={15} color={C.sub} />
          <Txt style={styles.chipTxt}>{t('admin.tvMode')}</Txt>
        </Pressable>

        <Pressable
          style={[styles.undoBtn, matchEvents.length === 0 && styles.actOff]}
          disabled={matchEvents.length === 0}
          onPress={() => d.undoLastEvent(m.id)}
        >
          <Ionicons name="arrow-undo-outline" size={17} color={C.txt} />
          <Txt style={styles.undoTxt}>{t('admin.undo')}</Txt>
        </Pressable>
      </View>

      {/* Rezultat + sat */}
      <View style={styles.scoreBar}>
        <View style={styles.teamSide}>
          <Crest code={home?.short_code} index={crests[0]} logoUrl={home?.logo_url} size={54} />
          <Txt style={styles.teamName} numberOfLines={1}>
            {home?.name ?? '—'}
          </Txt>
        </View>

        <View style={styles.center}>
          <ScoreWithAdjust value={m.home_score} disabled={!canEnter} onAdjust={(dv) => d.adjustScore(m.id, true, dv)} />
          <View style={styles.clockCol}>
            <Pressable
              style={styles.clockBtn}
              onPress={() => (isLive ? d.finishMatch(m.id) : d.startMatch(m.id))}
            >
              <Txt style={[styles.clockTxt, isLive && { color: C.redLt }]}>
                {pad(minute)}:{pad(sec % 60)}
              </Txt>
              <Ionicons name={isLive ? 'stop' : 'play'} size={17} color={isLive ? C.redLt : C.green} />
            </Pressable>
            <Txt style={styles.halfTxt}>
              {isLive ? t('home.halfN', { n: m.current_half ?? 1 }).toUpperCase() : t('admin.scheduledBadge')}
            </Txt>
          </View>
          <ScoreWithAdjust value={m.away_score} disabled={!canEnter} onAdjust={(dv) => d.adjustScore(m.id, false, dv)} />
        </View>

        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Txt style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>
            {away?.name ?? '—'}
          </Txt>
          <Crest code={away?.short_code} index={crests[1]} logoUrl={away?.logo_url} size={54} />
        </View>
      </View>

      {!canEnter && (
        <Txt style={styles.lockNote}>
          {m.status === 'finished' ? t('admin.finishedLocked') : t('admin.notStarted')}
        </Txt>
      )}

      {/* Kontrole + tijek */}
      <View style={[styles.main, wide && styles.mainWide]}>
        <Controls team={home} side={0} />

        {/* Na širokom ekranu tijek je fiksnih 330px, a kontrole dijele ostatak. */}
        <View style={[styles.feed, wide ? { width: 330 } : { flex: 1 }]}>
          <Txt style={styles.feedHead}>{t('live.flowTitle')}</Txt>
          <ScrollView showsVerticalScrollIndicator={false}>
            {feed.length === 0 ? (
              <Txt color={C.sub} style={{ padding: 16, fontSize: 13 }}>
                {t('live.noEvents')}
              </Txt>
            ) : (
              feed.map(({ e, score }) => {
                const isHome = e.team_id === m.home_team_id;
                const player = d.players.find((p) => p.id === e.player_id);
                const tm = d.teamById(e.team_id);
                return (
                  <View key={e.id} style={styles.feedRow}>
                    <Txt style={styles.feedMin}>{e.minute}'</Txt>
                    <View
                      style={[
                        styles.feedDot,
                        { backgroundColor: crestGradientFor(isHome ? crests[0]! : crests[1]!)[0] },
                      ]}
                    />
                    <Txt style={styles.feedTxt} numberOfLines={1}>
                      {t(ACTIONS.find((x) => x.type === e.type)?.label ?? 'live.type.goal')}
                      {player ? ` · ${player.name}` : ''}
                      {tm?.short_code ? ` (${tm.short_code})` : ''}
                    </Txt>
                    <Txt style={styles.feedScore}>{score}</Txt>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        <Controls team={away} side={1} />
      </View>

      {/* Odabir igrača */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Crest
                code={picker?.team.short_code}
                index={picker?.team.id === home?.id ? crests[0] : crests[1]}
                logoUrl={picker?.team.logo_url}
                size={40}
              />
              <Txt style={styles.sheetTitle} numberOfLines={1}>
                {picker ? t(ACTIONS.find((x) => x.type === picker.type)!.label).toUpperCase() : ''}
              </Txt>
              <Txt style={styles.sheetSub}>— {t('admin.pickPlayer')}</Txt>
              <View style={{ flex: 1 }} />
              <Pressable style={styles.chipBtn} onPress={() => setPicker(null)}>
                <Ionicons name="close" size={14} color={C.sub} />
                <Txt style={styles.chipTxt}>{t('common.cancel')}</Txt>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetGrid}>
              {picker &&
                d.playersOf(picker.team.id).map((p) => (
                  <Pressable key={p.id} style={styles.pCard} onPress={() => pick(p.id)}>
                    <Txt style={styles.pNum}>{p.number ?? '–'}</Txt>
                    <Txt style={styles.pName} numberOfLines={1}>
                      {p.name}
                    </Txt>
                  </Pressable>
                ))}
              {/* Bez igrača — kad zapisničar ne stigne vidjeti tko je. */}
              <Pressable style={[styles.pCard, styles.pCardAnon]} onPress={() => pick(null)}>
                <Ionicons name="help" size={18} color={C.sub} />
                <Txt style={[styles.pName, { color: C.sub }]}>{t('admin.noPlayer')}</Txt>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Rezultat s malim ručnim ispravkom — sigurnosni ventil kad unos zapne. */
function ScoreWithAdjust({
  value,
  onAdjust,
  disabled,
}: {
  value: number;
  onAdjust: (d: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.scoreCol}>
      <Txt style={styles.scoreNum}>{value}</Txt>
      <View style={styles.adjRow}>
        <Pressable style={[styles.adjBtn, disabled && styles.actOff]} disabled={disabled} onPress={() => onAdjust(-1)}>
          <Txt style={styles.adjTxt}>−</Txt>
        </Pressable>
        <Pressable style={[styles.adjBtn, disabled && styles.actOff]} disabled={disabled} onPress={() => onAdjust(1)}>
          <Txt style={styles.adjTxt}>+</Txt>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.cardGap,
    paddingHorizontal: 20,
    paddingVertical: SP.cardGap,
    borderBottomWidth: 1,
    borderBottomColor: C.lineSub,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: SP.cardGap,
    paddingVertical: SP.gap,
  },
  chipTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.sub },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(225,29,42,.14)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,42,.4)',
    borderRadius: R.pill,
    paddingHorizontal: SP.divider,
    paddingVertical: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.red },
  livePillTxt: { fontFamily: F.head, fontSize: 12, letterSpacing: 1.4, color: C.redLt },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  undoTxt: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },

  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: SP.cardGap,
  },
  teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SP.cardGap },
  teamSideRight: { justifyContent: 'flex-end' },
  teamName: { flex: 1, fontFamily: F.headSemi, fontSize: 22, letterSpacing: 0.4, color: C.txt },

  center: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreCol: { alignItems: 'center', gap: 4 },
  scoreNum: { fontFamily: F.head, fontSize: 64, lineHeight: 66, letterSpacing: 1, color: C.txt },
  adjRow: { flexDirection: 'row', gap: 6 },
  adjBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjTxt: { fontFamily: F.head, fontSize: 17, color: C.sub },

  clockCol: { alignItems: 'center', gap: 6 },
  clockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  clockTxt: { fontFamily: F.head, fontSize: 28, letterSpacing: 1, color: C.txt },
  halfTxt: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 1, color: C.sub },

  lockNote: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.sub,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: SP.gap,
  },
  main: { flex: 1, gap: 16, paddingHorizontal: 20, paddingBottom: 20, minHeight: 0 },
  mainWide: { flexDirection: 'row' },

  controls: { gap: 11 },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.cardGap,
    paddingHorizontal: 22,
    minHeight: 60,
    borderRadius: 16,
  },
  actPrimary: { borderWidth: 1, borderColor: 'transparent' },
  actSecondary: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  actOff: { opacity: 0.45 },
  actIcon: {
    width: 38,
    height: 38,
    borderRadius: R.chip,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actIconDim: {
    width: 38,
    height: 38,
    borderRadius: R.chip,
    backgroundColor: 'rgba(255,255,255,.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actLabel: { fontFamily: F.headSemi, fontSize: 18, letterSpacing: 0.6, color: C.txt },
  actSub: { marginLeft: 'auto', fontFamily: F.body, fontSize: 12, color: C.mut },
  actSubOn: { marginLeft: 'auto', fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,.75)' },

  feed: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 160,
  },
  feedHead: {
    paddingVertical: SP.divider,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.lineSub,
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.sub,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.rowY,
    paddingVertical: SP.rowY,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.lineRow,
  },
  feedMin: { width: 32, fontFamily: F.head, fontSize: 13, color: C.sub },
  feedDot: { width: 8, height: 8, borderRadius: 999 },
  feedTxt: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.txt2 },
  feedScore: { fontFamily: F.head, fontSize: 13, color: C.txt },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6,6,9,.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '86%',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: SP.divider, marginBottom: 18 },
  sheetTitle: { fontFamily: F.headSemi, fontSize: 20, letterSpacing: 0.5, color: C.txt },
  sheetSub: { fontFamily: F.body, fontSize: 13, color: C.sub },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  pCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 180,
    flexGrow: 1,
    minHeight: 60,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 15,
  },
  pCardAnon: { borderStyle: 'dashed' },
  pNum: { width: 30, textAlign: 'center', fontFamily: F.head, fontSize: 21, color: C.sub },
  pName: { flex: 1, fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
});
