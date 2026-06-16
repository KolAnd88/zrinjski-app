// types.ts — tipovi navigacije.
export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Live: { matchId: string };
  Team: { teamId: string };
  Search: undefined;
  NotifSettings: undefined;
  // Mobilni admin (skriveni ulaz)
  AdminLogin: undefined;
  AdminHome: undefined;
  AdminLive: { matchId: string };
  AdminTv: { matchId: string };
};

export type TabParamList = {
  Home: undefined;
  Schedule: undefined;
  Standings: undefined;
  Stats: undefined;
  Gallery: undefined;
  Info: undefined;
};
