import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { Gender, Player, RegistrationPlayer, Team } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from '../lib/useAuth';
import {
  createPlayer,
  deletePlayer,
  fetchMyRegistration,
  fetchTeamWithPlayers,
  saveMyRegistrationPlayers,
  submitMyRegistration,
  updatePlayer,
  type MyRegistration,
} from '../lib/repData';
import { C, F, R, SP } from '../theme';
import { Crest, Txt } from '../components/base';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { MvpVoteCard } from '../components/mvpVote';
import type { RootStackParamList } from '../navigation/types';

/**
 * Portal predstavnika u mobilnoj app — tri stanja:
 *   nema prijave    → prijavi svoju ekipu
 *   čeka odobrenje  → nacrt sastava
 *   odobrena ekipa  → pravi sastav
 * Isti tok kao na webu, da klub može birati uređaj.
 */
export function MyTeamScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { teamId, signOut, refresh } = useAuth();

  const [reg, setReg] = useState<MyRegistration | null | undefined>(undefined);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (teamId) {
        const res = await fetchTeamWithPlayers(teamId);
        setTeam(res?.team ?? null);
        setPlayers(res?.players ?? []);
      } else {
        setReg(await fetchMyRegistration());
      }
    } catch {
      setReg(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await signOut();
    nav.navigate('Tabs');
  }

  const header = (title: string) => (
    <View style={styles.head}>
      <View style={{ flex: 1 }}>
        <Txt style={styles.role}>{t('rep.role')}</Txt>
        <Txt style={styles.title} numberOfLines={1}>
          {title}
        </Txt>
      </View>
      <Pressable onPress={() => void logout()}>
        <Txt style={styles.logout}>{t('rep.logout')}</Txt>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Txt color={C.sub} style={{ padding: SP.screenX }}>
          {t('common.loading')}
        </Txt>
      </SafeAreaView>
    );
  }

  // ── Odobrena ekipa ───────────────────────────────────────────────────────
  if (teamId && team) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header(team.name)}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.teamRow}>
            <Crest code={team.short_code} index={team.sort_order} logoUrl={team.logo_url} size={54} />
            <Txt style={styles.hint}>{t('rep.contactAdmin')}</Txt>
          </View>

          {/* Glasanje za najboljeg igrača — samo odobrena ekipa ima pravo glasa. */}
          <MvpVoteCard team={team} />

          <RosterEditor
            players={players}
            onAdd={async (name, number) => {
              const p = await createPlayer({
                team_id: teamId,
                name,
                number,
                sort_order: players.length,
              });
              setPlayers((xs) => [...xs, p]);
            }}
            onPatch={async (id, patch) => {
              await updatePlayer(id, patch);
              setPlayers((xs) => xs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
            }}
            onRemove={async (id) => {
              await deletePlayer(id);
              setPlayers((xs) => xs.filter((p) => p.id !== id));
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Nema prijave ─────────────────────────────────────────────────────────
  if (reg === null || reg === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header(t('setup.title'))}
        <TeamSetup
          onDone={async () => {
            await refresh();
            await load();
          }}
        />
      </SafeAreaView>
    );
  }

  // ── Čeka odobrenje ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {header(reg.team_name)}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Ionicons name="hourglass-outline" size={16} color={C.gold} />
          <Txt style={styles.noticeTxt}>{t('pending.waiting')}</Txt>
        </View>

        <DraftEditor
          rows={reg.players ?? []}
          onSave={async (next) => {
            await saveMyRegistrationPlayers(next.filter((r) => r.name.trim()));
            setReg({ ...reg, players: next });
          }}
        />

        <SecondaryButton
          label={t('pending.refresh')}
          style={{ marginTop: SP.cardGap }}
          onPress={() => {
            void refresh();
            void load();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Obrazac prijave ekipe. */
function TeamSetup({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [repName, setRepName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await submitMyRegistration({ team_name: name.trim(), gender, rep_name: repName.trim() });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Txt style={styles.hint}>{t('setup.intro')}</Txt>
      {err && <Txt style={styles.err}>{err}</Txt>}

      <Txt style={styles.label}>{t('setup.teamName')}</Txt>
      <Input value={name} onChange={setName} placeholder={t('setup.teamNamePh')} />

      <Txt style={styles.label}>{t('setup.gender')}</Txt>
      <View style={styles.segs}>
        {(['m', 'z'] as const).map((g) => (
          <Pressable
            key={g}
            onPress={() => setGender(g)}
            style={[styles.seg, gender === g && styles.segOn]}
          >
            <Txt style={[styles.segTxt, gender === g && { color: '#fff' }]}>
              {g === 'm' ? t('common.men') : t('common.women')}
            </Txt>
          </Pressable>
        ))}
      </View>

      <Txt style={styles.label}>{t('setup.repName')}</Txt>
      <Input value={repName} onChange={setRepName} placeholder={t('setup.repNamePh')} />

      <PrimaryButton
        label={busy ? t('setup.sending') : t('setup.submit')}
        disabled={busy || !name.trim()}
        style={{ marginTop: SP.section }}
        onPress={() => void submit()}
      />
      <Txt style={styles.hint}>{t('setup.afterNote')}</Txt>
    </ScrollView>
  );
}

/** Nacrt sastava (prijava još čeka) — sprema se na izlazak iz polja. */
function DraftEditor({
  rows,
  onSave,
}: {
  rows: RegistrationPlayer[];
  onSave: (next: RegistrationPlayer[]) => Promise<void>;
}) {
  const { t } = useT();
  const [local, setLocal] = useState<RegistrationPlayer[]>(rows);

  const filled = local.filter((r) => r.name.trim()).length;

  return (
    <View>
      <Txt style={styles.section}>{t('rep.rosterTitle')}</Txt>
      <Txt style={styles.hint}>{t('pending.rosterHint', { n: filled })}</Txt>

      {local.map((row, i) => (
        <View key={i} style={styles.pRow}>
          <Input
            value={row.number != null ? String(row.number) : ''}
            onChange={(v) => {
              const next = [...local];
              next[i] = { ...row, number: v.trim() ? Number(v) : null };
              setLocal(next);
            }}
            onBlur={() => void onSave(local)}
            placeholder="#"
            width={56}
            numeric
          />
          <Input
            value={row.name}
            onChange={(v) => {
              const next = [...local];
              next[i] = { ...row, name: v };
              setLocal(next);
            }}
            onBlur={() => void onSave(local)}
            placeholder={t('rep.playerName')}
            flex
          />
          <Pressable
            onPress={() => {
              const next = local.filter((_, n) => n !== i);
              setLocal(next);
              void onSave(next);
            }}
            style={styles.del}
          >
            <Ionicons name="close" size={18} color={C.sub} />
          </Pressable>
        </View>
      ))}

      <SecondaryButton
        label={t('rep.addPlayer')}
        style={{ marginTop: SP.gap }}
        onPress={() => setLocal([...local, { name: '', number: null }])}
      />
      <Txt style={styles.hint}>{t('pending.afterApproval')}</Txt>
    </View>
  );
}

/** Sastav odobrene ekipe — pravi igrači. */
function RosterEditor({
  players,
  onAdd,
  onPatch,
  onRemove,
}: {
  players: Player[];
  onAdd: (name: string, number: number | null) => Promise<void>;
  onPatch: (id: string, patch: Partial<Player>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [num, setNum] = useState('');

  return (
    <View style={{ marginTop: SP.cardGap }}>
      <Txt style={styles.section}>{t('rep.rosterTitle')}</Txt>
      <Txt style={styles.hint}>
        {players.length} {t('rep.playersCount')}
      </Txt>

      {players.map((p) => (
        <View key={p.id} style={styles.pRow}>
          <Input
            value={p.number != null ? String(p.number) : ''}
            onChange={(v) => void onPatch(p.id, { number: v.trim() ? Number(v) : null })}
            placeholder="#"
            width={56}
            numeric
          />
          <Input
            value={p.name}
            onChange={(v) => void onPatch(p.id, { name: v })}
            placeholder={t('rep.playerName')}
            flex
          />
          <Pressable onPress={() => void onRemove(p.id)} style={styles.del}>
            <Ionicons name="close" size={18} color={C.sub} />
          </Pressable>
        </View>
      ))}

      <View style={styles.pRow}>
        <Input value={num} onChange={setNum} placeholder="#" width={56} numeric />
        <Input value={name} onChange={setName} placeholder={t('rep.playerName')} flex />
      </View>
      <PrimaryButton
        label={t('rep.addPlayer')}
        disabled={!name.trim()}
        style={{ marginTop: SP.gap }}
        onPress={() => {
          void onAdd(name.trim(), num.trim() ? Number(num) : null);
          setName('');
          setNum('');
        }}
      />
    </View>
  );
}

/** Jednostavno polje — RN nema <input>, a stil je isti na svim mjestima. */
function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  width,
  flex,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  width?: number;
  flex?: boolean;
  numeric?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.mut}
      keyboardType={numeric ? 'number-pad' : 'default'}
      style={[styles.input, width ? { width } : null, flex ? { flex: 1 } : null]}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.cardGap,
    paddingHorizontal: SP.screenX,
    paddingTop: 8,
    paddingBottom: SP.gap,
    borderBottomWidth: 1,
    borderBottomColor: C.lineSub,
  },
  role: { fontFamily: F.headSemi, fontSize: 11, letterSpacing: 1.4, color: C.sub },
  title: { fontFamily: F.head, fontSize: 22, letterSpacing: 0.4, color: C.txt, marginTop: 2 },
  logout: { fontFamily: F.bodySemi, fontSize: 13, color: C.redLt },

  content: { paddingHorizontal: SP.screenX, paddingTop: SP.cardGap, paddingBottom: 40 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: SP.divider },
  hint: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: SP.gap, lineHeight: 18 },
  err: { fontFamily: F.body, fontSize: 13, color: C.redLt, marginTop: SP.gap },
  label: {
    fontFamily: F.headSemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: SP.cardGap,
    marginBottom: SP.hair,
  },
  section: {
    fontFamily: F.headSemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: SP.cardGap,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    backgroundColor: 'rgba(217,178,74,.1)',
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.4)',
    borderRadius: R.chip,
    padding: SP.divider,
  },
  noticeTxt: { flex: 1, fontFamily: F.body, fontSize: 12, color: C.goldTxt, lineHeight: 17 },

  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    paddingHorizontal: SP.rowY,
    paddingVertical: 10,
    color: C.txt,
    fontFamily: F.body,
    fontSize: 14,
    minHeight: 44,
  },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: SP.gap, marginTop: SP.gap },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  segs: { flexDirection: 'row', gap: SP.gap },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SP.rowY,
    borderRadius: R.chip,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  segOn: { backgroundColor: C.red, borderColor: C.red },
  segTxt: { fontFamily: F.headSemi, fontSize: 14, color: C.sub },
});
