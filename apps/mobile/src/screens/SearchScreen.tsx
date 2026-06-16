import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { isoToHHMM, shortDayLabel } from '../lib/dates';
import { C, F, R, S } from '../theme';
import { Crest, Txt } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

export function SearchScreen() {
  const { t, locale } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const [q, setQ] = useState('');

  useLayoutEffect(() => {
    nav.setOptions({ title: t('common.search') });
  }, [nav, t]);

  const norm = (s: string) => s.toLowerCase().trim();
  const query = norm(q);

  const teams = query ? d.teams.filter((tm) => norm(tm.name).includes(query) || norm(tm.short_code ?? '').includes(query)) : [];
  const players = query ? d.players.filter((p) => norm(p.name).includes(query)) : [];
  const matches = query
    ? d.matches.filter((m) => {
        const hn = d.teamById(m.home_team_id)?.name ?? m.home_placeholder ?? '';
        const an = d.teamById(m.away_team_id)?.name ?? m.away_placeholder ?? '';
        return norm(hn).includes(query) || norm(an).includes(query);
      })
    : [];

  const dayOf = (dayId: string | null) => d.days.find((x) => x.id === dayId);
  const empty = query && teams.length === 0 && players.length === 0 && matches.length === 0;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ padding: S.lg, paddingBottom: S.xxl }} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBox}>
        <Txt color={C.mut} style={{ fontSize: 16 }}>
          ⌕
        </Txt>
        <TextInput
          style={styles.input}
          placeholder={t('search.placeholder')}
          placeholderTextColor={C.mut}
          value={q}
          onChangeText={setQ}
          autoFocus
        />
      </View>

      {empty && <Txt color={C.sub} style={{ marginTop: S.lg }}>{t('search.noResults')}</Txt>}

      {teams.length > 0 && (
        <>
          <Txt variant="label" style={styles.sect}>{t('search.teams')}</Txt>
          {teams.map((tm) => (
            <Pressable key={tm.id} style={styles.row} onPress={() => nav.navigate('Team', { teamId: tm.id })}>
              <Crest code={tm.short_code} color={tm.color} size={32} />
              <Txt style={styles.rowName}>{tm.name}</Txt>
            </Pressable>
          ))}
        </>
      )}

      {players.length > 0 && (
        <>
          <Txt variant="label" style={styles.sect}>{t('search.players')}</Txt>
          {players.map((p) => {
            const team = d.teamById(p.team_id);
            return (
              <Pressable key={p.id} style={styles.row} onPress={() => team && nav.navigate('Team', { teamId: team.id })}>
                <Crest code={team?.short_code} color={team?.color} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt style={styles.rowName}>{p.name}</Txt>
                  <Txt variant="caption">{team?.name}</Txt>
                </View>
                {p.number != null && <Txt color={C.sub} style={{ fontFamily: F.headSemi }}>#{p.number}</Txt>}
              </Pressable>
            );
          })}
        </>
      )}

      {matches.length > 0 && (
        <>
          <Txt variant="label" style={styles.sect}>{t('search.matches')}</Txt>
          {matches.map((m) => {
            const day = dayOf(m.day_id);
            const hn = d.teamById(m.home_team_id)?.short_code ?? m.home_placeholder ?? '—';
            const an = d.teamById(m.away_team_id)?.short_code ?? m.away_placeholder ?? '—';
            return (
              <Pressable key={m.id} style={styles.row} onPress={() => nav.navigate('Live', { matchId: m.id })}>
                <Txt color={C.sub} style={{ fontFamily: F.headSemi, width: 88 }}>
                  {day ? shortDayLabel(day.date, locale) : ''} {isoToHHMM(m.scheduled_time)}
                </Txt>
                <Txt style={styles.rowName}>
                  {hn} – {an}
                </Txt>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    paddingHorizontal: S.md,
    height: 48,
  },
  input: { flex: 1, color: C.txt, fontFamily: F.body, fontSize: 16, height: 48 },
  sect: { marginTop: S.lg, marginBottom: S.sm },
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
  rowName: { flex: 1, fontFamily: F.bodySemi, fontSize: 15 },
});
