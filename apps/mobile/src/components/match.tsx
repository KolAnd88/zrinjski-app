import { Pressable, StyleSheet, View } from 'react-native';
import type { Match, Team } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { C, F, R, S, SP } from '../theme';
import { isoToHHMM } from '../lib/dates';
import { Badge, Crest, Txt } from './base';

function side(
  teamId: string | null,
  placeholder: string | null,
  teamById: (id: string | null | undefined) => Team | undefined
) {
  const tm = teamById(teamId);
  return {
    name: tm?.name ?? placeholder ?? '—',
    code: tm?.short_code ?? null,
    sort_order: tm?.sort_order ?? null,
    logo_url: tm?.logo_url ?? null,
    ph: !tm,
  };
}

export function MatchRow({
  match,
  teamById,
  onPress,
}: {
  match: Match;
  teamById: (id: string | null | undefined) => Team | undefined;
  onPress?: () => void;
}) {
  const { t } = useT();
  const h = side(match.home_team_id, match.home_placeholder, teamById);
  const a = side(match.away_team_id, match.away_placeholder, teamById);
  const isFinal = match.stage === 'final';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, isFinal && styles.final, pressed && { opacity: 0.7 }]}
    >
      <Txt style={styles.time}>{isoToHHMM(match.scheduled_time) || '—'}</Txt>
      <Crest code={h.code} index={h.sort_order} logoUrl={h.logo_url} size={28} />
      <Txt
        numberOfLines={1}
        style={[styles.name, h.ph && styles.ph]}
      >
        {h.name}
      </Txt>
      <View style={styles.mid}>
        {match.status === 'live' ? (
          <Badge bg={C.red}>
            {t('common.live')} {match.home_score}:{match.away_score}
          </Badge>
        ) : match.status === 'finished' ? (
          <Txt style={styles.score}>
            {match.home_score}:{match.away_score}
          </Txt>
        ) : (
          <Txt style={styles.vs}>{t('common.vs')}</Txt>
        )}
      </View>
      <Txt numberOfLines={1} style={[styles.name, styles.nameAway, a.ph && styles.ph]}>
        {a.name}
      </Txt>
      <Crest code={a.code} index={a.sort_order} logoUrl={a.logo_url} size={28} />
    </Pressable>
  );
}

export function GenderToggle({
  value,
  onChange,
}: {
  value: 'm' | 'z';
  onChange: (g: 'm' | 'z') => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.toggle}>
      {(['m', 'z'] as const).map((g) => (
        <Pressable
          key={g}
          onPress={() => onChange(g)}
          style={[styles.toggleBtn, value === g && styles.toggleOn]}
        >
          <Txt style={[styles.toggleTxt, value === g && { color: '#fff' }]}>
            {g === 'm' ? t('common.men') : t('common.women')}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
  },
  final: { borderColor: C.gold },
  time: { fontFamily: F.headSemi, color: C.sub, width: 44, fontSize: 13 },
  name: { flex: 1, fontFamily: F.bodySemi, fontSize: 13, color: C.txt },
  nameAway: { textAlign: 'right' },
  ph: { color: C.mut, fontFamily: F.body, fontStyle: 'italic' },
  mid: { minWidth: 56, alignItems: 'center' },
  score: { fontFamily: F.head, fontSize: 16, color: C.txt },
  vs: { color: C.mut, fontSize: 12 },
  // Segmentirani M/Ž prekidač iz makete: nosač #1C1D24 r11, segment r8.
  toggle: {
    flexDirection: 'row',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SP.gap,
    borderRadius: 8,
  },
  toggleOn: {
    backgroundColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleTxt: { fontFamily: F.headSemi, fontSize: 14, color: C.sub },
});
