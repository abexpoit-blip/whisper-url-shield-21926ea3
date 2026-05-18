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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_protection_config: {
        Row: {
          block_threshold_score: number
          id: number
          ip_rate_limit_per_min: number
          ip_rate_limit_window_sec: number
          safe_page_message: string
          suspicious_action: string
          updated_at: string
        }
        Insert: {
          block_threshold_score?: number
          id?: number
          ip_rate_limit_per_min?: number
          ip_rate_limit_window_sec?: number
          safe_page_message?: string
          suspicious_action?: string
          updated_at?: string
        }
        Update: {
          block_threshold_score?: number
          id?: number
          ip_rate_limit_per_min?: number
          ip_rate_limit_window_sec?: number
          safe_page_message?: string
          suspicious_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          bot_reason: string | null
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          ip_address: string | null
          is_bot: boolean
          link_id: string
          os: string | null
          referer: string | null
          referer_host: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          variant: string | null
        }
        Insert: {
          bot_reason?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          link_id: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          variant?: string | null
        }
        Update: {
          bot_reason?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          link_id?: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domains: {
        Row: {
          created_at: string
          dns_target: string
          domain: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          status: string
          updated_at: string
          user_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_target?: string
          domain: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_target?: string
          domain?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      link_destinations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          link_id: string
          updated_at: string
          url: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          link_id: string
          updated_at?: string
          url: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          link_id?: string
          updated_at?: string
          url?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "link_destinations_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_variant_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          link_id: string
          note: string | null
          updated_at: string
          variant_slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          link_id: string
          note?: string | null
          updated_at?: string
          variant_slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          link_id?: string
          note?: string | null
          updated_at?: string
          variant_slug?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          bot_clicks_count: number
          clicks_count: number
          created_at: string
          destination_url: string
          expires_at: string | null
          id: string
          short_code: string
          status: Database["public"]["Enums"]["link_status"]
          targeting: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          destination_url: string
          expires_at?: string | null
          id?: string
          short_code: string
          status?: Database["public"]["Enums"]["link_status"]
          targeting?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          destination_url?: string
          expires_at?: string | null
          id?: string
          short_code?: string
          status?: Database["public"]["Enums"]["link_status"]
          targeting?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          link_limit: number
          name: string
          price_monthly: number
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number
          name: string
          price_monthly?: number
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number
          name?: string
          price_monthly?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      prelander_variants: {
        Row: {
          category: string
          created_at: string
          id: string
          intro: string
          is_active: boolean
          outro: string
          sections: Json
          slug: string
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          intro?: string
          is_active?: boolean
          outro?: string
          sections?: Json
          slug: string
          sort_order?: number
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          intro?: string
          is_active?: boolean
          outro?: string
          sections?: Json
          slug?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          link_quota: number
          links_used: number
          plan_slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          link_quota?: number
          links_used?: number
          plan_slug?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          link_quota?: number
          links_used?: number
          plan_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      link_status: "active" | "paused" | "expired"
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
    Enums: {
      app_role: ["admin", "user"],
      link_status: ["active", "paused", "expired"],
    },
  },
} as const
