// push.ts — dobivanje Expo push tokena i registracija uređaja u bazi.
//
// Tok: korisnik uključi obavijesti → tražimo dopuštenje → Expo vrati token →
// token + postavke šaljemo kroz RPC `register_device`. Slanje radi edge funkcija.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { NotificationPrefs } from '@zrinjski/core';
import { supabase } from './supabase';
import { C } from '../theme';

/** Obavijest stigla dok je app otvoren → prikaži je (ne gutaj tiho). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Zatraži dopuštenje i vrati Expo push token.
 * Vraća null kad token nije moguć: emulator, odbijeno dopuštenje ili nedostaje
 * projectId. To NIJE greška — app mora normalno raditi i bez obavijesti.
 */
export async function getPushToken(): Promise<string | null> {
  // Emulator/simulator nema pravi push kanal.
  if (!Device.isDevice) return null;

  // Android traži kanal, inače obavijest ne prikazuje kako treba.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Obavijesti',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: C.red,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    // Nema mreže ili Expo servis ne odgovara — probat ćemo sljedeći put.
    return null;
  }
}

/** Spremi uređaj i njegove postavke. Tiho odustaje ako baza nije spojena. */
export async function registerDevice(input: {
  token: string;
  language: string;
  followed: string[];
  prefs: NotificationPrefs;
  enabled: boolean;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('register_device', {
    p_token: input.token,
    p_language: input.language,
    p_followed: input.followed,
    p_prefs: input.prefs,
    p_enabled: input.enabled,
  });
  // Neuspjeh registracije ne smije srušiti app — korisnik i dalje gleda rezultate.
  if (error) console.warn('[push] registracija uređaja nije uspjela:', error.message);
}
