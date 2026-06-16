import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { C, F } from '../theme';
import type { RootStackParamList, TabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { StandingsScreen } from '../screens/StandingsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { InfoScreen } from '../screens/InfoScreen';

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
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
