// onboarding.ts — je li korisnik prošao onboarding (prvi put).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zrinjski.onboarded';

export async function isOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}
