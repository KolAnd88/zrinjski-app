import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { I18nProvider } from './src/i18n/I18nProvider';
import { DataProvider } from './src/lib/useData';
import { AuthProvider } from './src/lib/useAuth';
import { FollowProvider } from './src/lib/useFollow';
import { GenderProvider } from './src/lib/useGender';
import { RootNavigator } from './src/navigation/RootNavigator';
import { C } from './src/theme';

// Zadano se splash skriva čim se JS učita, a fontovi stižu tek nakon toga —
// između bi bljesnuo prazan tamni ekran. Zato ga držimo dok fontovi ne dođu.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Splash je još gore; ovo je samo podloga iste boje da nema bljeska.
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
        <DataProvider>
          <FollowProvider>
            <GenderProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </GenderProvider>
          </FollowProvider>
        </DataProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
