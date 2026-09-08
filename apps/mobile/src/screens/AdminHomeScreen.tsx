import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { useAdminRegistrations } from '../lib/adminRegistrations';
import { supabase } from '../lib/supabase';
import { C, F, R, S } from '../theme';
import { Screen, Txt } from '../components/base';
import { MatchRow } from '../components/match';
import type { RootStackParamList } from '../navigation/types';

export function AdminHomeScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  // Prijave se dohvacaju posebno; ovaj ekran je jedini kojemu trebaju.
  const prijave = useAdminRegistrations(true);

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

      {/* Prijave koje čekaju odluku — iznad utakmica jer su vremenski
          osjetljivije: klub čeka odgovor, utakmica ne. Prikazuje se samo kad
          ih ima, da nadzorna ploča na dan turnira ostane prazna i brza. */}
      {prijave.items.length > 0 && (
        <>
          <Txt variant="label" style={{ marginBottom: S.sm }}>
            {t('admin.pendingTitle')} · {prijave.items.length}
          </Txt>
          {prijave.error && (
            <Txt color={C.redLt} style={{ marginBottom: S.sm, fontSize: 13 }}>
              {prijave.error}
            </Txt>
          )}
          <View style={{ gap: S.sm, marginBottom: S.lg }}>
            {prijave.items.map((r) => (
              <View key={r.id} style={styles.prijava}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={styles.prijavaNaziv}>{r.team_name}</Txt>
                  <Txt style={styles.prijavaMeta}>
                    {r.gender === 'm' ? t('admin.men') : t('admin.women')} · {r.rep_name}
                    {r.status === 'waitlist' ? ` · ${t('admin.waitlist')}` : ''}
                  </Txt>
                  <Txt style={styles.prijavaMeta}>{r.rep_email}</Txt>
                </View>
                <Pressable
                  disabled={prijave.busyId === r.id}
                  onPress={() => void prijave.odobri(r)}
                  style={[styles.odobri, prijave.busyId === r.id && { opacity: 0.5 }]}
                  hitSlop={6}
                >
                  <Txt style={styles.odobriTxt}>
                    {prijave.busyId === r.id ? t('admin.processing') : t('admin.approve')}
                  </Txt>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

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
  prijava: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    padding: S.md,
  },
  prijavaNaziv: { fontFamily: F.headSemi, fontSize: 16, color: C.txt },
  prijavaMeta: { fontSize: 12.5, color: C.sub },
  // Zelena, ne crvena: ovo je potvrda, a crvena je u aplikaciji rezervirana
  // za akcent i za odjavu.
  odobri: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: S.lg,
    borderRadius: R.chip,
    backgroundColor: C.green,
  },
  odobriTxt: { fontFamily: F.headSemi, fontSize: 14, color: '#0B0B0E' },
});
