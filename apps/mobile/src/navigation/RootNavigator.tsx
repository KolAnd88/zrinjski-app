import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { isOnboarded } from '../lib/onboarding';
import { C, F } from '../theme';
import type { RootStackParamList, TabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { StandingsScreen } from '../screens/StandingsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { InfoScreen } from '../screens/InfoScreen';
import { LiveScreen } from '../screens/LiveScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { NotifSettingsScreen } from '../screens/NotifSettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { MyTeamScreen } from '../screens/MyTeamScreen';
import { AdminHomeScreen } from '../screens/AdminHomeScreen';
import { AdminLiveScreen } from '../screens/AdminLiveScreen';
import { AdminTvScreen } from '../screens/AdminTvScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.card,
    text: C.txt,
    border: C.line,
    primary: C.red,
    notification: C.red,
  },
};

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Schedule: 'calendar',
  Standings: 'trophy',
  Stats: 'stats-chart',
  Gallery: 'images',
  Info: 'information-circle',
};

function Tabs() {
  const { t } = useT();
  const label: Record<keyof TabParamList, string> = {
    Home: t('nav.home'),
    Schedule: t('nav.schedule'),
    Standings: t('nav.standings'),
    Stats: t('nav.stats'),
    Gallery: t('nav.gallery'),
    Info: t('nav.info'),
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.red,
        tabBarInactiveTintColor: C.mut,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        tabBarLabelStyle: { fontFamily: F.headMed, fontSize: 11 },
        tabBarLabel: label[route.name],
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Standings" component={StandingsScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Gallery" component={GalleryScreen} />
      <Tab.Screen name="Info" component={InfoScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const [onboarded, setOnboardedState] = useState<boolean | null>(null);

  useEffect(() => {
    void isOnboarded().then(setOnboardedState);
  }, []);

  // Dok ne znamo status onboardinga, prazni tamni ekran (sprječava bljesak).
  if (onboarded === null) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={onboarded ? 'Tabs' : 'Onboarding'}
        screenOptions={{
          headerStyle: { backgroundColor: C.card },
          headerTintColor: C.txt,
          headerTitleStyle: { fontFamily: F.headSemi },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Live" component={LiveScreen} options={{ title: '' }} />
        <Stack.Screen name="Team" component={TeamScreen} options={{ title: '' }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: '' }} />
        <Stack.Screen name="NotifSettings" component={NotifSettingsScreen} options={{ title: '' }} />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ title: '' }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: '' }} />
        <Stack.Screen name="MyTeam" component={MyTeamScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminLive" component={AdminLiveScreen} options={{ title: '' }} />
        <Stack.Screen name="AdminTv" component={AdminTvScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
