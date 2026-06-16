import { Pressable, StyleSheet, View } from 'react-native';
import type { LocationRow } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useData } from '../lib/useData';
import { openMaps } from '../lib/maps';
import { C, F, R, S } from '../theme';
import { Card, Screen, Txt } from '../components/base';

function LocRow({ loc }: { loc: LocationRow }) {
  const { t } = useT();
  return (
    <View style={styles.locRow}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: F.bodySemi, fontSize: 15 }}>{loc.name}</Txt>
        {loc.description && <Txt variant="caption">{loc.description}</Txt>}
      </View>
      {loc.lat != null && loc.lng != null && (
        <Pressable style={styles.mapBtn} onPress={() => openMaps(loc.lat!, loc.lng!, loc.name)}>
          <Txt style={{ color: C.blue, fontFamily: F.bodySemi }}>{t('common.map')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

function Section({ titleKey, body }: { titleKey: StringKey; body: string }) {
  const { t } = useT();
  return (
    <View style={{ marginBottom: S.md }}>
      <Txt variant="h2" style={{ marginBottom: S.sm }}>
        {t(titleKey)}
      </Txt>
      <Card>
        <Txt color={C.sub} style={{ lineHeight: 21 }}>
          {body}
        </Txt>
      </Card>
    </View>
  );
}

export function InfoScreen() {
  const { t } = useT();
  const d = useData();
  const venues = d.locations.filter((l) => l.type !== 'hotel');
  const hotels = d.locations.filter((l) => l.type === 'hotel');

  return (
    <Screen>
      <Txt variant="h1" style={{ marginBottom: S.md }}>
        {t('nav.info').toUpperCase()}
      </Txt>

      <Section titleKey="info.about" body={t('info.aboutBody')} />
      <Section titleKey="info.aboutTournament" body={t('info.aboutTournamentBody')} />

      <Txt variant="h2" style={{ marginBottom: S.sm }}>
        {t('info.locations')}
      </Txt>
      <Card style={{ marginBottom: S.md, padding: 0 }}>
        {venues.map((l, i) => (
          <View key={l.id} style={i > 0 ? styles.divided : undefined}>
            <LocRow loc={l} />
          </View>
        ))}
      </Card>

      <Txt variant="h2" style={{ marginBottom: S.sm }}>
        {t('info.hotels')}
      </Txt>
      <Card style={{ marginBottom: S.md, padding: 0 }}>
        {hotels.map((l, i) => (
          <View key={l.id} style={i > 0 ? styles.divided : undefined}>
            <LocRow loc={l} />
          </View>
        ))}
      </Card>

      <Section titleKey="info.rules" body={t('info.rulesBody')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  locRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  divided: { borderTopWidth: 1, borderTopColor: C.line },
  mapBtn: { borderWidth: 1, borderColor: C.blue, borderRadius: R.chip, paddingVertical: 8, paddingHorizontal: S.md },
});
