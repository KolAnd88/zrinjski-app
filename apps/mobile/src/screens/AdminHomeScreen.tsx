import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { supabase } from '../lib/supabase';
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
        {/* Dva izlaza, i to namjerno.
            Do sada je postojala samo Odjava, pa je nadzorna ploča bila
            slijepa ulica: organizator koji se htio vratiti u aplikaciju
            morao se odjaviti. To nije bila samo nezgodna navigacija — odjava
            briše oznaku uređaja za obavijesti organizatoru (migracija 0032),
            pa je izlazak s ovog ekrana gasio ono zbog čega se prijavio. */}
        <View style={styles.izlazi}>
          <Pressable
            onPress={() => nav.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            hitSlop={8}
          >
            <Txt style={{ color: C.sub, fontFamily: F.headSemi }}>{t('admin.backToApp')}</Txt>
          </Pressable>
          <Pressable
            onPress={() => {
              void supabase?.auth.signOut();
              nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
            }}
            hitSlop={8}
          >
            <Txt style={{ color: C.red, fontFamily: F.headSemi }}>{t('admin.logout')}</Txt>
          </Pressable>
        </View>
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
  // Povratak je prigušen, odjava crvena — dvije radnje različite težine ne
  // smiju izgledati jednako vrijedno.
  izlazi: { alignItems: 'flex-end', gap: S.sm },
});
