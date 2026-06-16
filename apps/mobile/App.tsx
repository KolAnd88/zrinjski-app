import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { I18nProvider } from './src/i18n/I18nProvider';
import { DataProvider } from './src/lib/useData';
import { FollowProvider } from './src/lib/useFollow';
import { RootNavigator } from './src/navigation/RootNavigator';
import { C } from './src/theme';

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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <DataProvider>
          <FollowProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </FollowProvider>
        </DataProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
