// types.ts — tipovi navigacije.
export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Live: { matchId: string };
  Team: { teamId: string };
  Search: undefined;
  NotifSettings: undefined;
};

export type TabParamList = {
  Home: undefined;
  Schedule: undefined;
  Standings: undefined;
  Stats: undefined;
  Gallery: undefined;
  Info: undefined;
};
