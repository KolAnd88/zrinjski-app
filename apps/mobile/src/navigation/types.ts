// types.ts — tipovi navigacije.
export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Live: { matchId: string };
  Team: { teamId: string };
  Search: undefined;
  NotifSettings: undefined;
  // Mobilni admin (skriveni ulaz)
  /**
   * `club` — predstavnik kluba (prijava ekipe i sastav).
   * `staff` — organizacija (zapisnik, unos uživo).
   * Ista prijava, ali natpisi moraju odgovarati onome tko je došao: klubu je
   * "Pristup samo za delegate" poruka da nema što tražiti ovdje.
   */
  AdminLogin: { mode?: 'club' | 'staff' } | undefined;
  Signup: undefined;
  // Portal predstavnika ekipe
  MyTeam: undefined;
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
  /** Kartica predstavnika kluba. Ime se razlikuje od stack rute `Team`
      (detalj ekipe), da navigacija ne bude dvoznacna. */
  Klub: undefined;
  Info: undefined;
};
