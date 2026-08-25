import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Team } from '@zrinjski/core';
import { eligibleCandidates } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { castMyMvpVote, fetchMyMvpVote, MvpVoteFailed } from '../lib/repData';
import { C, F, R, SP } from '../theme';
import { Txt } from './base';
import { PrimaryButton } from './buttons';

/**
 * Glasanje predstavnika za najboljeg igrača turnira.
 *
 * Popis kandidata gradi se iz podataka koje app ionako ima (useData), a
 * vlastita ekipa se izbacuje — isto pravilo baza provjerava još jednom pri
 * upisu, pa zaobilaženje sučelja ništa ne donosi.
 */
export function MvpVoteCard({ team }: { team: Team }) {
  const { t } = useT();
  const d = useData();
  const [vote, setVote] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyMvpVote()
      .then((v) => {
        if (!alive) return;
        setVote(v);
        setChoice(v);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const votingOpen = d.tournament?.mvp_voting_open ?? false;
  const candidates = eligibleCandidates(d.players, d.teams, team.gender, team.id);
  const byTeam = d.teams
    .filter((x) => x.gender === team.gender && x.id !== team.id)
    .map((x) => ({ team: x, players: candidates.filter((p) => p.team_id === x.id) }))
    .filter((g) => g.players.length > 0);

  const nameOf = (id: string | null) => (id ? d.players.find((p) => p.id === id)?.name ?? null : null);
  const votedName = nameOf(vote);

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setErr(null);
    try {
      await castMyMvpVote(choice);
      setVote(choice);
      setOpen(false);
      setMsg(t('mvp.thanks'));
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      const code = e instanceof MvpVoteFailed ? e.code : null;
      setErr(
        t(
          code === 'closed'
            ? 'mvp.errClosed'
            : code === 'not_a_rep'
              ? 'mvp.errNotRep'
              : code === 'own_team'
                ? 'mvp.errOwnTeam'
                : code === 'other_gender'
                  ? 'mvp.errOtherGender'
                  : 'mvp.errSave'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // Zatvoreno glasanje — kartica ostaje samo ako je predstavnik glasao,
  // inače nema što reći i nepotrebno bi zauzimala ekran.
  if (!votingOpen) {
    if (!votedName) return null;
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="trophy" size={16} color={C.gold} />
          <Txt style={styles.title}>{t('mvp.title').toUpperCase()}</Txt>
        </View>
        <Txt style={styles.hint}>{t('mvp.closedYouVoted', { name: votedName })}</Txt>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="trophy" size={16} color={C.gold} />
        <Txt style={styles.title}>{t('mvp.title').toUpperCase()}</Txt>
      </View>
      <Txt style={styles.hint}>{t('mvp.hint')}</Txt>

      {!!msg && <Txt style={styles.ok}>{msg}</Txt>}
      {!!err && <Txt style={styles.err}>{err}</Txt>}

      {byTeam.length === 0 ? (
        <Txt style={styles.hint}>{t('mvp.noCandidates')}</Txt>
      ) : (
        <>
          {!!votedName && !open && <Txt style={styles.voted}>{t('mvp.yourVote', { name: votedName })}</Txt>}

          {!open ? (
            <PrimaryButton
              label={vote ? t('mvp.change') : t('mvp.pick')}
              onPress={() => setOpen(true)}
              style={{ marginTop: SP.cardGap }}
            />
          ) : (
            <>
              <View style={styles.list}>
                {byTeam.map((g) => (
                  <View key={g.team.id}>
                    <Txt style={styles.group}>{g.team.name.toUpperCase()}</Txt>
                    {g.players.map((p) => {
                      const on = choice === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setChoice(p.id)}
                          style={[styles.row, on && styles.rowOn]}
                        >
                          <Txt style={styles.num}>{p.number ?? '–'}</Txt>
                          <Txt style={[styles.name, on && { color: C.txt }]} numberOfLines={1}>
                            {p.name}
                          </Txt>
                          {on && <Ionicons name="checkmark-circle" size={18} color={C.gold} />}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
              <PrimaryButton
                label={t('mvp.submit')}
                disabled={busy || !choice || choice === vote}
                onPress={() => void submit()}
                style={{ marginTop: SP.cardGap }}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(217,178,74,.3)',
    borderRadius: R.card,
    padding: 15,
    marginBottom: SP.cardGap,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SP.gap },
  title: { fontFamily: F.headSemi, fontSize: 12, letterSpacing: 1.2, color: C.goldTxt },
  hint: { fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.sub, marginTop: SP.gap },
  ok: { fontFamily: F.bodySemi, fontSize: 13, color: C.green, marginTop: SP.gap },
  err: { fontFamily: F.bodySemi, fontSize: 13, color: C.red, marginTop: SP.gap },
  voted: { fontFamily: F.bodySemi, fontSize: 13, color: C.goldTxt, marginTop: SP.cardGap },

  list: {
    marginTop: SP.cardGap,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    overflow: 'hidden',
  },
  group: {
    fontFamily: F.headSemi,
    fontSize: 10,
    letterSpacing: 1,
    color: C.mut,
    backgroundColor: C.card2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  rowOn: { backgroundColor: 'rgba(217,178,74,.1)' },
  num: { width: 22, textAlign: 'center', fontFamily: F.head, fontSize: 13, color: C.mut },
  name: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.sub },
});
