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
      app_settings: {
        Row: {
          daily_redirect_enabled: boolean
          fallback_url: string
          id: boolean
          injection_count: number
          injection_threshold: number
          our_adsterra_url: string
          updated_at: string
        }
        Insert: {
          daily_redirect_enabled?: boolean
          fallback_url?: string
          id?: boolean
          injection_count?: number
          injection_threshold?: number
          our_adsterra_url?: string
          updated_at?: string
        }
        Update: {
          daily_redirect_enabled?: boolean
          fallback_url?: string
          id?: boolean
          injection_count?: number
          injection_threshold?: number
          our_adsterra_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          pattern: string
          rule_type: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          pattern: string
          rule_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          pattern?: string
          rule_type?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          bot_reason: string | null
          challenge_passed: boolean
          country: string | null
          created_at: string
          id: string
          ip: string | null
          is_bot: boolean
          link_id: string
          prelanding_shown: boolean
          routed_to: string
          ua: string | null
        }
        Insert: {
          bot_reason?: string | null
          challenge_passed?: boolean
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          link_id: string
          prelanding_shown?: boolean
          routed_to?: string
          ua?: string | null
        }
        Update: {
          bot_reason?: string | null
          challenge_passed?: boolean
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          link_id?: string
          prelanding_shown?: boolean
          routed_to?: string
          ua?: string | null
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
      links: {
        Row: {
          adsterra_url: string
          bot_clicks_count: number
          clicks_count: number
          created_at: string
          id: string
          is_active: boolean
          prelanding_template: string
          safe_url: string
          short_code: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adsterra_url: string
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prelanding_template?: string
          safe_url?: string
          short_code: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adsterra_url?: string
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prelanding_template?: string
          safe_url?: string
          short_code?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          click_quota: number | null
          created_at: string
          id: string
          is_active: boolean
          link_limit: number | null
          name: string
          price_usd: number
          slug: string
          sort_order: number
        }
        Insert: {
          click_quota?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_limit?: number | null
          name: string
          price_usd?: number
          slug: string
          sort_order?: number
        }
        Update: {
          click_quota?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_limit?: number | null
          name?: string
          price_usd?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          click_quota: number | null
          clicks_period_start: string
          clicks_used: number
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          last_daily_redirect_at: string | null
          link_limit: number | null
          links_used: number
          plan_slug: string
          telegram: string | null
          updated_at: string
        }
        Insert: {
          click_quota?: number | null
          clicks_period_start?: string
          clicks_used?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          last_daily_redirect_at?: string | null
          link_limit?: number | null
          links_used?: number
          plan_slug?: string
          telegram?: string | null
          updated_at?: string
        }
        Update: {
          click_quota?: number | null
          clicks_period_start?: string
          clicks_used?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          last_daily_redirect_at?: string | null
          link_limit?: number | null
          links_used?: number
          plan_slug?: string
          telegram?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["slug"]
          },
        ]
      }
      upgrade_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          package_slug: string
          plisio_invoice_id: string | null
          plisio_invoice_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          package_slug: string
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          package_slug?: string
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_requests_package_slug_fkey"
            columns: ["package_slug"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["slug"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
