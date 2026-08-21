import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useT } from '../i18n/I18nProvider';
import { useData } from '../lib/useData';
import { formatDayLabel } from '../lib/dates';
import { C, R, S } from '../theme';
import { Screen, Txt } from '../components/base';

export function GalleryScreen() {
  const { t, locale } = useT();
  const d = useData();
  const { width } = useWindowDimensions();
  const cols = 3;
  const gap = S.sm;
  const tile = (Math.min(width, 720) - S.lg * 2 - gap * (cols - 1)) / cols;

  return (
    <Screen>
      <Txt variant="h1" style={{ marginBottom: S.md }}>
        {t('gallery.title').toUpperCase()}
      </Txt>

      {d.days.map((day) => {
        const photos = d.gallery.filter((g) => g.day_id === day.id);
        if (photos.length === 0) return null;
        return (
          <View key={day.id} style={{ marginBottom: S.lg }}>
            <Txt variant="label" style={{ marginBottom: S.sm }}>
              {formatDayLabel(day.date, locale)}
            </Txt>
            <View style={[styles.grid, { gap }]}>
              {photos.map((p) => (
                // Boja ostaje kao podloga dok se slika učitava (i ako je nema).
                <View
                  key={p.id}
                  style={{
                    width: tile,
                    height: tile,
                    borderRadius: R.chip,
                    backgroundColor: p.color,
                    opacity: 0.85,
                    overflow: 'hidden',
                  }}
                >
                  {p.url && (
                    <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {d.gallery.length === 0 && <Txt color={C.sub}>{t('common.empty')}</Txt>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
