// maps.ts — deep-link na zadanu navigaciju (Google/Apple Maps), ne ugrađena karta.
import { Linking, Platform } from 'react-native';

export function openMaps(lat: number, lng: number, label?: string): void {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${q}`
      : Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${lat},${lng}(${q})`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  void Linking.openURL(url).catch(() => {
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}
