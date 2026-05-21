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
      admin_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          reason: string | null
          resource: string | null
          status: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          resource?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          resource?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_protection_config: {
        Row: {
          block_threshold_score: number
          id: number
          inapp_browser_relief: boolean
          ip_rate_limit_per_min: number
          ip_rate_limit_window_sec: number
          safe_page_message: string
          signal_weights: Json
          soft_reasons: string[]
          suspicious_action: string
          updated_at: string
        }
        Insert: {
          block_threshold_score?: number
          id?: number
          inapp_browser_relief?: boolean
          ip_rate_limit_per_min?: number
          ip_rate_limit_window_sec?: number
          safe_page_message?: string
          signal_weights?: Json
          soft_reasons?: string[]
          suspicious_action?: string
          updated_at?: string
        }
        Update: {
          block_threshold_score?: number
          id?: number
          inapp_browser_relief?: boolean
          ip_rate_limit_per_min?: number
          ip_rate_limit_window_sec?: number
          safe_page_message?: string
          signal_weights?: Json
          soft_reasons?: string[]
          suspicious_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          bot_reason: string | null
          bot_score: number | null
          browser: string | null
          challenge_passed: boolean
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          fingerprint_hash: string | null
          id: string
          ip_address: string | null
          is_bot: boolean
          link_id: string
          os: string | null
          referer: string | null
          referer_host: string | null
          signals: Json | null
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
          bot_score?: number | null
          browser?: string | null
          challenge_passed?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          fingerprint_hash?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          link_id: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          signals?: Json | null
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
          bot_score?: number | null
          browser?: string | null
          challenge_passed?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          fingerprint_hash?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          link_id?: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          signals?: Json | null
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
      domain_health_checks: {
        Row: {
          checked_at: string
          dns_ok: boolean
          dns_target_observed: string | null
          domain_id: string
          error: string | null
          http_ok: boolean
          http_status: number | null
          id: string
        }
        Insert: {
          checked_at?: string
          dns_ok?: boolean
          dns_target_observed?: string | null
          domain_id: string
          error?: string | null
          http_ok?: boolean
          http_status?: number | null
          id?: string
        }
        Update: {
          checked_at?: string
          dns_ok?: boolean
          dns_target_observed?: string | null
          domain_id?: string
          error?: string | null
          http_ok?: boolean
          http_status?: number | null
          id?: string
        }
        Relationships: []
      }
      duplicate_clicks: {
        Row: {
          hit_count: number
          ip: string
          last_seen: string
          link_id: string
        }
        Insert: {
          hit_count?: number
          ip: string
          last_seen?: string
          link_id: string
        }
        Update: {
          hit_count?: number
          ip?: string
          last_seen?: string
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_asn_blocklist: {
        Row: {
          added_by: string | null
          asn: number | null
          created_at: string
          id: string
          ip_cidr: string | null
          is_active: boolean
          label: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          asn?: number | null
          created_at?: string
          id?: string
          ip_cidr?: string | null
          is_active?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          asn?: number | null
          created_at?: string
          id?: string
          ip_cidr?: string | null
          is_active?: boolean
          label?: string
          updated_at?: string
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
      link_device_rules: {
        Row: {
          adsterra_url: string
          created_at: string
          device: string
          id: string
          is_active: boolean
          link_id: string
          os: string
          priority: number
          updated_at: string
        }
        Insert: {
          adsterra_url: string
          created_at?: string
          device: string
          id?: string
          is_active?: boolean
          link_id: string
          os?: string
          priority?: number
          updated_at?: string
        }
        Update: {
          adsterra_url?: string
          created_at?: string
          device?: string
          id?: string
          is_active?: boolean
          link_id?: string
          os?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_device_rules_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_geo_rules: {
        Row: {
          adsterra_url: string
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          link_id: string
          priority: number
          updated_at: string
        }
        Insert: {
          adsterra_url: string
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          link_id: string
          priority?: number
          updated_at?: string
        }
        Update: {
          adsterra_url?: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          link_id?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_geo_rules_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_time_rules: {
        Row: {
          action: string
          created_at: string
          days_mask: number
          end_minute: number
          id: string
          is_active: boolean
          link_id: string
          note: string | null
          priority: number
          start_minute: number
          timezone: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          days_mask?: number
          end_minute?: number
          id?: string
          is_active?: boolean
          link_id: string
          note?: string | null
          priority?: number
          start_minute?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          days_mask?: number
          end_minute?: number
          id?: string
          is_active?: boolean
          link_id?: string
          note?: string | null
          priority?: number
          start_minute?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
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
      link_variant_tests: {
        Row: {
          bot_clicks: number
          created_at: string
          human_clicks: number
          id: string
          last_evaluated_at: string | null
          link_id: string
          paused_reason: string | null
          score: number
          status: string
          total_clicks: number
          updated_at: string
          variant_slug: string
        }
        Insert: {
          bot_clicks?: number
          created_at?: string
          human_clicks?: number
          id?: string
          last_evaluated_at?: string | null
          link_id: string
          paused_reason?: string | null
          score?: number
          status?: string
          total_clicks?: number
          updated_at?: string
          variant_slug: string
        }
        Update: {
          bot_clicks?: number
          created_at?: string
          human_clicks?: number
          id?: string
          last_evaluated_at?: string | null
          link_id?: string
          paused_reason?: string | null
          score?: number
          status?: string
          total_clicks?: number
          updated_at?: string
          variant_slug?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          adsterra_direct_link: string | null
          bot_clicks_count: number
          brand_color: string | null
          brand_logo_url: string | null
          brand_name: string | null
          brand_tagline: string | null
          clicks_count: number
          created_at: string
          destination_url: string
          duplicate_protection: boolean
          duplicate_window_minutes: number
          expires_at: string | null
          health_score: number | null
          health_updated_at: string | null
          id: string
          short_code: string
          status: Database["public"]["Enums"]["link_status"]
          targeting: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adsterra_direct_link?: string | null
          bot_clicks_count?: number
          brand_color?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_tagline?: string | null
          clicks_count?: number
          created_at?: string
          destination_url: string
          duplicate_protection?: boolean
          duplicate_window_minutes?: number
          expires_at?: string | null
          health_score?: number | null
          health_updated_at?: string | null
          id?: string
          short_code: string
          status?: Database["public"]["Enums"]["link_status"]
          targeting?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adsterra_direct_link?: string | null
          bot_clicks_count?: number
          brand_color?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_tagline?: string | null
          clicks_count?: number
          created_at?: string
          destination_url?: string
          duplicate_protection?: boolean
          duplicate_window_minutes?: number
          expires_at?: string | null
          health_score?: number | null
          health_updated_at?: string | null
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
          billing_period: string
          click_limit: number | null
          created_at: string
          features: Json
          id: string
          is_active: boolean
          link_limit: number | null
          name: string
          price_monthly: number
          price_onetime: number
          slug: string
          sort_order: number
        }
        Insert: {
          billing_period?: string
          click_limit?: number | null
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number | null
          name: string
          price_monthly?: number
          price_onetime?: number
          slug: string
          sort_order?: number
        }
        Update: {
          billing_period?: string
          click_limit?: number | null
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number | null
          name?: string
          price_monthly?: number
          price_onetime?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          id: number
          payment_instructions: string | null
          plisio_api_key: string | null
          plisio_enabled: boolean
          plisio_webhook_secret: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          payment_instructions?: string | null
          plisio_api_key?: string | null
          plisio_enabled?: boolean
          plisio_webhook_secret?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          payment_instructions?: string | null
          plisio_api_key?: string | null
          plisio_enabled?: boolean
          plisio_webhook_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plisio_activity_log: {
        Row: {
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          order_number: string | null
          outcome: string
          plisio_status: string | null
          request_id: string
          status_code: number | null
          txn_id: string | null
          upgrade_request_id: string | null
          user_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          order_number?: string | null
          outcome?: string
          plisio_status?: string | null
          request_id: string
          status_code?: number | null
          txn_id?: string | null
          upgrade_request_id?: string | null
          user_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          order_number?: string | null
          outcome?: string
          plisio_status?: string | null
          request_id?: string
          status_code?: number | null
          txn_id?: string | null
          upgrade_request_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plisio_webhook_logs: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_number: string | null
          payload: Json
          signature_valid: boolean
          status: string | null
          txn_id: string | null
          upgrade_request_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_number?: string | null
          payload?: Json
          signature_valid?: boolean
          status?: string | null
          txn_id?: string | null
          upgrade_request_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_number?: string | null
          payload?: Json
          signature_valid?: boolean
          status?: string | null
          txn_id?: string | null
          upgrade_request_id?: string | null
        }
        Relationships: []
      }
      plisio_webhook_retry_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          order_number: string | null
          payload: Json
          source: string
          status: string
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_number?: string | null
          payload?: Json
          source?: string
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_number?: string | null
          payload?: Json
          source?: string
          status?: string
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prelander_variants: {
        Row: {
          category: string
          country_codes: string[]
          created_at: string
          device: string
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
          country_codes?: string[]
          created_at?: string
          device?: string
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
          country_codes?: string[]
          created_at?: string
          device?: string
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
      referer_rules: {
        Row: {
          action: string
          created_at: string
          host_pattern: string
          id: string
          is_active: boolean
          note: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          host_pattern: string
          id?: string
          is_active?: boolean
          note?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          host_pattern?: string
          id?: string
          is_active?: boolean
          note?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      shared_domains: {
        Row: {
          added_by: string | null
          created_at: string
          domain: string
          id: string
          ip_address: string
          is_active: boolean
          label: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          domain: string
          id?: string
          ip_address: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          domain?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      upgrade_requests: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          note: string | null
          package_slug: string
          payment_method: string
          plisio_invoice_id: string | null
          plisio_invoice_url: string | null
          plisio_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_ref: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          note?: string | null
          package_slug: string
          payment_method?: string
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          plisio_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          note?: string | null
          package_slug?: string
          payment_method?: string
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          plisio_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_ref?: string | null
          user_id?: string
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
      clicks_breakdown: {
        Args: { p_dim: string; p_link_id: string; p_since: string }
        Returns: {
          bots: number
          humans: number
          key: string
          total: number
        }[]
      }
      clicks_daily: {
        Args: { p_link_id?: string; p_since: string }
        Returns: {
          bots: number
          day: string
          humans: number
          link_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_link_bot_clicks: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      increment_link_clicks: { Args: { p_link_id: string }; Returns: undefined }
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
