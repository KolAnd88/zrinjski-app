import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from '../lib/useAuth';
import { C, F, R, SP } from '../theme';
import { Card, SectionLabel, Txt } from '../components/base';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { MyTeamScreen } from './MyTeamScreen';
import type { RootStackParamList } from '../navigation/types';

/**
 * Kartica "Ekipa" — ulaz za predstavnike klubova.
 *
 * Portal predstavnika postojao je i prije, ali samo kao skriveni redak na dnu
 * Info kartice. Klubovi ga ondje nisu nalazili, pa je prijava ekipe u praksi
 * išla preko organizatora. Sad stoji u traci, uz ostale.
 *
 * Prijavljeni predstavnik odmah vidi svoju ekipu; ostali dobiju objašnjenje
 * čemu kartica služi, da gledatelj ne pomisli da mu nešto fali.
 */
export function TeamTabScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role, loading } = useAuth();

  // Predstavnik ide ravno u svoj portal — bez međukoraka.
  if (role === 'rep') return <MyTeamScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Ionicons name="people" size={20} color={C.red} />
        <Txt style={styles.title}>{t('team.tabTitle')}</Txt>
      </View>

      <View style={styles.body}>
        <SectionLabel>{t('team.forClubs')}</SectionLabel>
        <Card>
          <Txt color={C.sub} style={styles.p}>
            {t('team.intro')}
          </Txt>

          <PrimaryButton
            label={t('team.signIn')}
            onPress={() => nav.navigate('AdminLogin', { mode: 'club' })}
          />
          <View style={{ height: SP.gap }} />
          <SecondaryButton label={t('team.signUp')} onPress={() => nav.navigate('Signup')} />
        </Card>

        {/* Gledatelju treba reći da ovo NIJE za njega — inače izgleda kao da
            mu prijava nedostaje da bi pratio turnir. */}
        <Txt color={C.mut} style={styles.note}>
          {loading ? t('common.loading') : t('team.spectatorNote')}
        </Txt>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.gap,
    paddingHorizontal: SP.screenX,
    paddingTop: SP.gap,
    paddingBottom: SP.divider,
  },
  title: { fontFamily: F.head, fontSize: 21, letterSpacing: 0.5, color: C.txt },
  body: { paddingHorizontal: SP.screenX, gap: SP.gap },
  p: { lineHeight: 21, marginBottom: SP.cardGap },
  note: { fontSize: 12, lineHeight: 18, marginTop: SP.gap },
});
