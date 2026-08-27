import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { openMaps } from '../lib/maps';
import { formatDayLabel } from '../lib/dates';
import { C, F, R, SP } from '../theme';
import { BrandStripe } from '../components/home';
import { SectionLabel, Txt, useRefreshControl } from '../components/base';
import type { RootStackParamList } from '../navigation/types';

/** Ikona po vrsti lokacije — dvorana, šator, večera, hotel. */
const LOC_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  hall: 'basketball-outline',
  tent: 'umbrella-outline',
  dinner: 'restaurant-outline',
  hotel: 'bed-outline',
  other: 'location-outline',
};

export function InfoScreen() {
  const { t, locale } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const d = useData();
  const refreshControl = useRefreshControl();

  // Tekstovi iz admina imaju prednost; zadani ostaju samo dok organizator ne
  // upiše svoje, da ekran nikad ne ostane s praznom karticom.
  const formatTxt = d.tournament?.format?.trim() || '';
  const rulesTxt = d.tournament?.rules?.trim() || t('info.rulesBody');
  const aboutTxt = d.tournament?.about_club?.trim() || t('info.aboutBody');

  const hall = d.locations.find((l) => l.type === 'hall');
  const days = d.days;
  const dateRange =
    days.length > 0
      ? days.length === 1
        ? formatDayLabel(days[0]!.date, locale)
        : `${formatDayLabel(days[0]!.date, locale)} — ${formatDayLabel(days[days.length - 1]!.date, locale)}`
      : '—';

  const details: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'calendar-outline', label: t('info.dDates'), value: dateRange },
    { icon: 'location-outline', label: t('info.dVenue'), value: hall?.name ?? '—' },
    { icon: 'people-outline', label: t('info.dTeams'), value: String(d.teams.length) },
    {
      icon: 'trophy-outline',
      label: t('info.dFormat'),
      value: t('info.dFormatValue', { n: d.tournament?.advance_per_group ?? 2 }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandStripe />

      <View style={styles.titleWrap}>
        <Txt style={styles.title}>{t('nav.info').toUpperCase()}</Txt>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* O turniru */}
        <LinearGradient
          colors={['#23090C', C.card]}
          locations={[0, 0.62]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            {/* Grb kluba, kao i na početnoj — "ZC" je bio ostatak iz vremena
                prije nego što je grb postojao u aplikaciji. */}
            <Image
              source={require('../../assets/crest.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Txt style={styles.heroName} numberOfLines={2}>
                {d.tournament?.name ?? t('appName')}
              </Txt>
              <Txt style={styles.heroSub}>{t('home.subtitle')}</Txt>
            </View>
          </View>
        </LinearGradient>

        {/* Detalji */}
        <View style={styles.card}>
          {details.map((row, i) => (
            <View key={row.label} style={[styles.detailRow, i > 0 && styles.rowBorder]}>
              <View style={styles.iconChip}>
                <Ionicons name={row.icon} size={17} color={C.redLt} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.detailLabel}>{row.label}</Txt>
                <Txt style={styles.detailValue}>{row.value}</Txt>
              </View>
            </View>
          ))}
        </View>

        {/* Lokacije */}
        <SectionLabel>{t('info.locations')}</SectionLabel>
        <View style={styles.card}>
          {d.locations.map((l, i) => (
            <Pressable
              key={l.id}
              disabled={l.lat == null || l.lng == null}
              onPress={() => openMaps(l.lat!, l.lng!, l.name)}
              style={[styles.detailRow, i > 0 && styles.rowBorder]}
            >
              <View style={styles.iconChip}>
                <Ionicons name={LOC_ICON[l.type] ?? 'location-outline'} size={17} color={C.redLt} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.linkLabel} numberOfLines={1}>
                  {l.name}
                </Txt>
                {!!l.description && (
                  <Txt style={styles.detailLabelPlain} numberOfLines={1}>
                    {l.description}
                  </Txt>
                )}
              </View>
              {l.lat != null && l.lng != null && (
                <Ionicons name="chevron-forward" size={18} color={C.mut} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Kontakti organizatora — dodir na red zove broj. */}
        {d.contacts.length > 0 && (
          <>
            <SectionLabel>{t('info.contacts')}</SectionLabel>
            <View style={styles.card}>
              {d.contacts.map((c, i) => (
                <Pressable
                  key={c.id}
                  disabled={!c.phone}
                  onPress={() => c.phone && Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`)}
                  style={[styles.detailRow, i > 0 && styles.rowBorder]}
                >
                  <View style={styles.iconChip}>
                    <Ionicons name="call-outline" size={17} color={C.redLt} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.linkLabel} numberOfLines={1}>
                      {c.name}
                    </Txt>
                    {!!c.role && (
                      <Txt style={styles.detailLabelPlain} numberOfLines={1}>
                        {c.role}
                      </Txt>
                    )}
                  </View>
                  {!!c.phone && (
                    <>
                      <Txt style={styles.phone}>{c.phone}</Txt>
                      <Ionicons name="chevron-forward" size={18} color={C.mut} />
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Format, pravila i o klubu — unose se u adminu. Ako organizator još
            nije ništa upisao, ostaje zadani tekst umjesto prazne rupe. */}
        {!!formatTxt && (
          <>
            <SectionLabel>{t('info.dFormat')}</SectionLabel>
            <View style={[styles.card, styles.textCard]}>
              <Txt style={styles.bodyTxt}>{formatTxt}</Txt>
            </View>
          </>
        )}

        <SectionLabel>{t('info.rules')}</SectionLabel>
        <View style={[styles.card, styles.textCard]}>
          <Txt style={styles.bodyTxt}>{rulesTxt}</Txt>
        </View>

        <SectionLabel>{t('info.about')}</SectionLabel>
        <View style={[styles.card, styles.textCard]}>
          <Txt style={styles.bodyTxt}>{aboutTxt}</Txt>
        </View>

        {/* Organizator */}
        <Txt style={styles.org}>{t('info.organizer')}</Txt>

        {/* Predstavnik kluba — prijava ekipe i sastav */}
        <Pressable onPress={() => nav.navigate('AdminLogin')} style={styles.repRow}>
          <Ionicons name="people-circle-outline" size={19} color={C.redLt} />
          <View style={{ flex: 1 }}>
            <Txt style={styles.repTitle}>{t('info.repEntry')}</Txt>
            <Txt style={styles.detailLabelPlain}>{t('info.repEntrySub')}</Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.mut} />
        </Pressable>

        {/* Skriveni ulaz za organizatore */}
        <Pressable onPress={() => nav.navigate('AdminLogin')} style={styles.adminLink}>
          <Txt style={styles.adminTxt}>{t('admin.organizer')} →</Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleWrap: { paddingHorizontal: SP.headerX, paddingTop: 8, paddingBottom: 6 },
  title: { fontFamily: F.head, fontSize: 28, letterSpacing: 0.6, color: C.txt },
  content: { paddingHorizontal: SP.screenX, paddingTop: 10, paddingBottom: 28 },

  hero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4A1117',
    padding: SP.screenX,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SP.divider },
  heroLogo: { width: 48, height: 48 },
  heroName: { fontFamily: F.head, fontSize: 18, letterSpacing: 0.4, color: C.txt },
  heroSub: { fontFamily: F.body, fontSize: 13, color: C.sub, marginTop: 2 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  textCard: { paddingVertical: SP.cardGap, paddingHorizontal: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SP.divider, paddingVertical: SP.cardGap, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.lineRow },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontFamily: F.body,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.sub,
  },
  detailLabelPlain: { fontFamily: F.body, fontSize: 12, color: C.sub, marginTop: 2 },
  detailValue: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt, marginTop: 2 },
  phone: { fontFamily: F.bodySemi, fontSize: 13, color: C.blue },
  linkLabel: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },

  bodyTxt: { fontFamily: F.body, fontSize: 13, lineHeight: 21, color: C.txt2 },

  org: {
    textAlign: 'center',
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 20,
    color: C.mut,
    marginTop: SP.section,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.divider,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: SP.cardGap,
    paddingHorizontal: 16,
    marginTop: SP.section,
  },
  repTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.txt },
  adminLink: { alignItems: 'center', paddingVertical: SP.screenX },
  adminTxt: { fontFamily: F.body, fontSize: 12, color: C.mut },
});
