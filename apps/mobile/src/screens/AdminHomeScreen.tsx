import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { C, F, S } from '../theme';
import { Screen, Txt } from '../components/base';
import { MatchRow } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

export function AdminHomeScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();

  const enterable = d.matches
    .filter((m) => m.status !== 'finished')
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Txt variant="label" color={C.red}>
            {t('admin.organizer')}
          </Txt>
          <Txt variant="h1">{t('admin.dashboard').toUpperCase()}</Txt>
        </View>
        <Pressable onPress={() => nav.reset({ index: 0, routes: [{ name: 'Tabs' }] })}>
          <Txt style={{ color: C.red, fontFamily: F.headSemi }}>{t('admin.logout')}</Txt>
        </Pressable>
      </View>

      <Txt variant="label" style={{ marginBottom: S.sm }}>
        {t('admin.pickMatch')}
      </Txt>

      {enterable.length === 0 ? (
        <Txt color={C.sub}>{t('admin.noMatches')}</Txt>
      ) : (
        <View style={{ gap: S.sm }}>
          {enterable.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              teamById={d.teamById}
              onPress={() => nav.navigate('AdminLive', { matchId: m.id })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: S.lg,
  },
});
