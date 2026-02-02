export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          model_name: string | null
          provider_id: string | null
          provider_key_id: string | null
          request_path: string | null
          response_time_ms: number | null
          status: string
          status_code: number | null
          tokens_used: number | null
          unified_key_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          model_name?: string | null
          provider_id?: string | null
          provider_key_id?: string | null
          request_path?: string | null
          response_time_ms?: number | null
          status: string
          status_code?: number | null
          tokens_used?: number | null
          unified_key_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          model_name?: string | null
          provider_id?: string | null
          provider_key_id?: string | null
          request_path?: string | null
          response_time_ms?: number | null
          status?: string
          status_code?: number | null
          tokens_used?: number | null
          unified_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_provider_key_id_fkey"
            columns: ["provider_key_id"]
            isOneToOne: false
            referencedRelation: "provider_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_unified_key_id_fkey"
            columns: ["unified_key_id"]
            isOneToOne: false
            referencedRelation: "unified_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_api_keys: {
        Row: {
          api_key: string
          created_at: string
          failed_requests: number
          id: string
          is_active: boolean
          last_error: string | null
          last_used_at: string | null
          model_id: string | null
          name: string | null
          priority: number
          provider_id: string
          total_requests: number
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          failed_requests?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          model_id?: string | null
          name?: string | null
          priority?: number
          provider_id: string
          total_requests?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          failed_requests?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          model_id?: string | null
          name?: string | null
          priority?: number
          provider_id?: string
          total_requests?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_api_keys_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_api_keys_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_models: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          model_id: string
          name: string
          provider_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          model_id: string
          name: string
          provider_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          model_id?: string
          name?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      rotation_settings: {
        Row: {
          fallback_enabled: boolean
          id: string
          strategy: string
          updated_at: string
        }
        Insert: {
          fallback_enabled?: boolean
          id?: string
          strategy?: string
          updated_at?: string
        }
        Update: {
          fallback_enabled?: boolean
          id?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: []
      }
      unified_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          total_requests: number
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          total_requests?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          total_requests?: number
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
