/**
 * Supabase `Database` shape for the typed client (`utils/supabase.ts`).
 * Aligns with `Docs/Designing the AP.md`; extend when schema evolves.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          xp: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          xp?: number;
          created_at?: string;
        };
        Update: {
          email?: string;
          xp?: number;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          completed: boolean;
          xp_value: number;
          proof_url: string | null;
          learning_path_id: string | null;
          skill_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          completed?: boolean;
          xp_value: number;
          proof_url?: string | null;
          learning_path_id?: string | null;
          skill_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          completed?: boolean;
          xp_value?: number;
          proof_url?: string | null;
          learning_path_id?: string | null;
          skill_id?: string | null;
        };
        Relationships: [];
      };
      learning_paths: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          source_name: string | null;
          source_kind: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          source_name?: string | null;
          source_kind?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          source_name?: string | null;
          source_kind?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          user_id: string;
          learning_path_id: string;
          name: string;
          description: string;
          order_index: number;
          unlock_xp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          learning_path_id: string;
          name: string;
          description?: string;
          order_index?: number;
          unlock_xp?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          order_index?: number;
          unlock_xp?: number;
        };
        Relationships: [];
      };
      task_quiz_rewards: {
        Row: {
          user_id: string;
          task_id: string;
          bonus_xp: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          task_id: string;
          bonus_xp: number;
          created_at?: string;
        };
        Update: {
          bonus_xp?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
