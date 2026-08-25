// database.ts — TypeScript tipovi baze (kompatibilno s `supabase gen types typescript`).
//
// NAPOMENA: Ovo je ručno usklađena verzija sheme iz supabase/migrations/*.sql.
// Kad Supabase projekt bude spojen, regeneriraj iz žive baze:
//   npm run db:types        (supabase gen types typescript --local)
// i ova datoteka će biti zamijenjena točnim izlazom.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enumi ────────────────────────────────────────────────────────────────
export type Gender = 'm' | 'z';
export type Stage = 'group' | 'semifinal' | 'third_place' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type EventType = 'goal' | 'save' | 'red_card' | 'suspension_2min';
export type SponsorTier = 'gold' | 'silver' | 'bronze' | 'partner';
export type LocationType = 'hall' | 'tent' | 'dinner' | 'hotel' | 'other';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType =
  | 'team_playing_soon'
  | 'team_goal'
  | 'match_end'
  | 'schedule_change'
  | 'program'
  | 'custom';

/** Jedan igrač u nacrtu sastava (javna prijava ekipe). */
export type RegistrationPlayer = {
  name: string;
  number: number | null;
};

export type ReminderPrefs = {
  day_before_18: boolean;
  thirty_min_before: boolean;
  schedule_change: boolean;
};

export type NotificationPrefs = {
  team_playing_soon: boolean;
  team_goal: boolean;
  match_end: boolean;
  schedule_change: boolean;
  program: boolean;
};

export type Database = {
  public: {
    Tables: {
      tournament: {
        Row: {
          id: string;
          name: string;
          season_year: number;
          match_duration_min: number;
          gap_min: number;
          points_win: number;
          points_draw: number;
          points_loss: number;
          advance_per_group: number;
          reminder_prefs: ReminderPrefs;
          registration_open: boolean;
          registration_deadline: string | null;
          mvp_voting_open: boolean;
          mvp_m_player_id: string | null;
          mvp_z_player_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          season_year: number;
          match_duration_min?: number;
          gap_min?: number;
          points_win?: number;
          points_draw?: number;
          points_loss?: number;
          advance_per_group?: number;
          reminder_prefs?: ReminderPrefs;
          registration_open?: boolean;
          registration_deadline?: string | null;
          mvp_voting_open?: boolean;
          mvp_m_player_id?: string | null;
          mvp_z_player_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tournament']['Insert']>;
        Relationships: [];
      };
      day: {
        Row: {
          id: string;
          tournament_id: string;
          date: string;
          first_match_time: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          date: string;
          first_match_time?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['day']['Insert']>;
        Relationships: [];
      };
      grp: {
        Row: {
          id: string;
          tournament_id: string;
          gender: Gender;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          gender: Gender;
          name: string;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['grp']['Insert']>;
        Relationships: [];
      };
      team: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          short_code: string | null;
          /** @deprecated Boja grba se računa iz sort_order (crestColorFor). Ostaje radi kompatibilnosti. */
          color: string | null;
          gender: Gender;
          group_id: string | null;
          coach_name: string | null;
          rep_email: string | null;
          logo_url: string | null;
          /** Redoslijed ekipe — određuje i boju grba: crestColorFor(sort_order). */
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          short_code?: string | null;
          color?: string | null;
          gender: Gender;
          group_id?: string | null;
          coach_name?: string | null;
          rep_email?: string | null;
          logo_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['team']['Insert']>;
        Relationships: [];
      };
      player: {
        Row: {
          id: string;
          team_id: string;
          number: number | null;
          name: string;
          is_captain: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          team_id: string;
          number?: number | null;
          name: string;
          is_captain?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['player']['Insert']>;
        Relationships: [];
      };
      match: {
        Row: {
          id: string;
          tournament_id: string;
          day_id: string | null;
          gender: Gender;
          stage: Stage;
          grp_id: string | null;
          home_team_id: string | null;
          away_team_id: string | null;
          home_placeholder: string | null;
          away_placeholder: string | null;
          home_score: number;
          away_score: number;
          scheduled_time: string | null;
          status: MatchStatus;
          sort_order: number;
          best_player_id: string | null;
          current_minute: number | null;
          current_half: number | null;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          day_id?: string | null;
          gender: Gender;
          stage?: Stage;
          grp_id?: string | null;
          home_team_id?: string | null;
          away_team_id?: string | null;
          home_placeholder?: string | null;
          away_placeholder?: string | null;
          home_score?: number;
          away_score?: number;
          scheduled_time?: string | null;
          status?: MatchStatus;
          sort_order?: number;
          best_player_id?: string | null;
          current_minute?: number | null;
          current_half?: number | null;
        };
        Update: Partial<Database['public']['Tables']['match']['Insert']>;
        Relationships: [];
      };
      match_event: {
        Row: {
          id: string;
          match_id: string;
          team_id: string;
          player_id: string | null;
          type: EventType;
          minute: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          team_id: string;
          player_id?: string | null;
          type: EventType;
          minute: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_event']['Insert']>;
        Relationships: [];
      };
      sponsor: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          tier: SponsorTier;
          logo_url: string | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          tier: SponsorTier;
          logo_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['sponsor']['Insert']>;
        Relationships: [];
      };
      location: {
        Row: {
          id: string;
          tournament_id: string;
          type: LocationType;
          name: string;
          description: string | null;
          lat: number | null;
          lng: number | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          type: LocationType;
          name: string;
          description?: string | null;
          lat?: number | null;
          lng?: number | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['location']['Insert']>;
        Relationships: [];
      };
      program_item: {
        Row: {
          id: string;
          tournament_id: string;
          day_id: string;
          time: string;
          title: string;
          location_id: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          day_id: string;
          time: string;
          title: string;
          location_id?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['program_item']['Insert']>;
        Relationships: [];
      };
      registration: {
        Row: {
          created_by: string | null;
          id: string;
          tournament_id: string;
          team_name: string;
          gender: Gender;
          rep_name: string;
          rep_email: string;
          player_count: number | null;
          /** Nacrt sastava iz javne prijave; kod odobrenja se prepisuje u `player`. */
          players: RegistrationPlayer[];
          status: RegistrationStatus;
          approved_team_id: string | null;
          processed_at: string | null;
          processed_by: string | null;
          created_at: string;
        };
        Insert: {
          created_by?: string | null;
          id?: string;
          tournament_id: string;
          team_name: string;
          gender: Gender;
          rep_name: string;
          rep_email: string;
          player_count?: number | null;
          players?: RegistrationPlayer[];
          status?: RegistrationStatus;
          approved_team_id?: string | null;
          processed_at?: string | null;
          processed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['registration']['Insert']>;
        Relationships: [];
      };
      gallery_photo: {
        Row: {
          id: string;
          tournament_id: string;
          day_id: string | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          day_id?: string | null;
          storage_path: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['gallery_photo']['Insert']>;
        Relationships: [];
      };
      app_user: {
        Row: {
          id: string;
          email: string;
          role: string;
          team_id: string | null;
        };
        Insert: {
          id: string;
          email: string;
          role?: string;
          team_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['app_user']['Insert']>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: string;
          tournament_id: string;
          type: NotificationType;
          audience: string;
          title: string;
          body: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          type: NotificationType;
          audience: string;
          title: string;
          body?: string | null;
          sent_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notification_log']['Insert']>;
        Relationships: [];
      };
      device: {
        Row: {
          id: string;
          expo_push_token: string | null;
          language: string;
          followed_team_ids: string[];
          prefs: NotificationPrefs;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expo_push_token?: string | null;
          language?: string;
          followed_team_ids?: string[];
          prefs?: NotificationPrefs;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['device']['Insert']>;
        Relationships: [];
      };
      mvp_vote: {
        Row: {
          id: string;
          tournament_id: string;
          gender: Gender;
          voter_id: string;
          voter_team_id: string | null;
          player_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          gender: Gender;
          voter_id: string;
          voter_team_id?: string | null;
          player_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mvp_vote']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_rep_of_team: { Args: { p_team_id: string }; Returns: boolean };
      register_device: {
        Args: {
          p_token: string;
          p_language?: string;
          p_followed?: string[];
          p_prefs?: NotificationPrefs;
          p_enabled?: boolean;
        };
        Returns: undefined;
      };
      submit_registration: {
        Args: {
          p_tournament_id: string;
          p_team_name: string;
          p_gender: Gender;
          p_rep_name: string;
          p_rep_email: string;
          p_player_count?: number | null;
          p_players?: RegistrationPlayer[];
        };
        Returns: string;
      };
      approve_registration: {
        Args: { p_registration_id: string; p_short_code?: string | null };
        Returns: string;
      };
      ensure_my_profile: { Args: Record<string, never>; Returns: undefined };
      submit_my_registration: {
        Args: { p_team_name: string; p_gender: Gender; p_rep_name: string };
        Returns: string;
      };
      update_my_registration_players: {
        Args: { p_players: RegistrationPlayer[] };
        Returns: undefined;
      };
      reject_registration: {
        Args: { p_registration_id: string };
        Returns: undefined;
      };
      cast_my_mvp_vote: {
        Args: { p_player_id: string };
        Returns: undefined;
      };
      /** Prazno dok je glasanje otvoreno i pozivatelj nije admin. */
      mvp_results: {
        Args: Record<string, never>;
        Returns: { player_id: string; gender: Gender; votes: number }[];
      };
    };
    Enums: {
      gender: Gender;
      stage: Stage;
      match_status: MatchStatus;
      event_type: EventType;
      sponsor_tier: SponsorTier;
      location_type: LocationType;
      registration_status: RegistrationStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ── Pomoćni aliasi za udobnije korištenje u app kodu ───────────────────────
type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];

export type Tournament = Tables<'tournament'>;
export type Day = Tables<'day'>;
export type Grp = Tables<'grp'>;
export type Team = Tables<'team'>;
export type Player = Tables<'player'>;
export type Match = Tables<'match'>;
export type MatchEvent = Tables<'match_event'>;
export type Sponsor = Tables<'sponsor'>;
export type LocationRow = Tables<'location'>;
export type ProgramItem = Tables<'program_item'>;
export type Registration = Tables<'registration'>;
export type GalleryPhoto = Tables<'gallery_photo'>;
export type AppUser = Tables<'app_user'>;
export type NotificationLog = Tables<'notification_log'>;
export type Device = Tables<'device'>;
export type MvpVote = Tables<'mvp_vote'>;
