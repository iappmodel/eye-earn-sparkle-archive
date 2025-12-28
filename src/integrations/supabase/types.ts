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
      abuse_logs: {
        Row: {
          abuse_type: string
          created_at: string
          details: Json | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          abuse_type: string
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          abuse_type?: string
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          executed_at: string | null
          id: string
          reason: string | null
          scheduled_deletion_at: string
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at: string
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      content_flags: {
        Row: {
          action_taken: string | null
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          flagged_by: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          content_id: string
          content_type?: string
          created_at?: string
          description?: string | null
          flagged_by: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          flagged_by?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_interactions: {
        Row: {
          attention_score: number | null
          category: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          liked: boolean | null
          shared: boolean | null
          skipped: boolean | null
          tags: string[] | null
          total_duration: number | null
          user_id: string
          watch_completion_rate: number | null
          watch_duration: number | null
        }
        Insert: {
          attention_score?: number | null
          category?: string | null
          content_id: string
          content_type?: string
          created_at?: string
          id?: string
          liked?: boolean | null
          shared?: boolean | null
          skipped?: boolean | null
          tags?: string[] | null
          total_duration?: number | null
          user_id: string
          watch_completion_rate?: number | null
          watch_duration?: number | null
        }
        Update: {
          attention_score?: number | null
          category?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          liked?: boolean | null
          shared?: boolean | null
          skipped?: boolean | null
          tags?: string[] | null
          total_duration?: number | null
          user_id?: string
          watch_completion_rate?: number | null
          watch_duration?: number | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          role: string
          unread_count: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          unread_count?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_reward_caps: {
        Row: {
          created_at: string
          date: string
          icoin_earned: number
          id: string
          promo_views: number
          updated_at: string
          user_id: string
          vicoin_earned: number
        }
        Insert: {
          created_at?: string
          date?: string
          icoin_earned?: number
          id?: string
          promo_views?: number
          updated_at?: string
          user_id: string
          vicoin_earned?: number
        }
        Update: {
          created_at?: string
          date?: string
          icoin_earned?: number
          id?: string
          promo_views?: number
          updated_at?: string
          user_id?: string
          vicoin_earned?: number
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          created_at: string
          error_message: string | null
          expires_at: string | null
          file_url: string | null
          id: string
          processed_at: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          created_at: string
          device_info: Json | null
          fingerprint_hash: string
          first_seen_at: string
          flag_reason: string | null
          flagged: boolean | null
          id: string
          is_trusted: boolean | null
          last_seen_at: string
          trust_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          fingerprint_hash: string
          first_seen_at?: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          is_trusted?: boolean | null
          last_seen_at?: string
          trust_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          fingerprint_hash?: string
          first_seen_at?: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          is_trusted?: boolean | null
          last_seen_at?: string
          trust_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          created_at: string
          document_country: string | null
          document_number: string | null
          document_type: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_country?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_country?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_ai_generated: boolean
          media_url: string | null
          read_by: string[] | null
          reply_to_id: string | null
          sender_id: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          media_url?: string | null
          read_by?: string[] | null
          reply_to_id?: string | null
          sender_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          media_url?: string | null
          read_by?: string[] | null
          reply_to_id?: string | null
          sender_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          categories: string[] | null
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          seen: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          seen?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          seen?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      privacy_consents: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          ip_address: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          followers_count: number | null
          following_count: number | null
          icoin_balance: number | null
          id: string
          is_verified: boolean | null
          kyc_status: string | null
          phone_number: string | null
          phone_verified: boolean | null
          referred_by: string | null
          total_likes: number | null
          total_views: number | null
          updated_at: string
          user_id: string
          username: string | null
          vicoin_balance: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          icoin_balance?: number | null
          id?: string
          is_verified?: boolean | null
          kyc_status?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referred_by?: string | null
          total_likes?: number | null
          total_views?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
          vicoin_balance?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number | null
          following_count?: number | null
          icoin_balance?: number | null
          id?: string
          is_verified?: boolean | null
          kyc_status?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referred_by?: string | null
          total_likes?: number | null
          total_views?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
          vicoin_balance?: number | null
        }
        Relationships: []
      }
      promotion_claims: {
        Row: {
          claimed_at: string
          id: string
          promotion_id: string
          reward_amount: number | null
          status: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          claimed_at?: string
          id?: string
          promotion_id: string
          reward_amount?: number | null
          status: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          claimed_at?: string
          id?: string
          promotion_id?: string
          reward_amount?: number | null
          status?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_claims_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          address: string | null
          business_id: string | null
          business_name: string
          category: string | null
          created_at: string
          current_claims: number
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number
          longitude: number
          max_claims: number | null
          required_action: string
          reward_amount: number
          reward_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          business_name: string
          category?: string | null
          created_at?: string
          current_claims?: number
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude: number
          longitude: number
          max_claims?: number | null
          required_action: string
          reward_amount: number
          reward_type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string | null
          business_name?: string
          category?: string | null
          created_at?: string
          current_claims?: number
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number
          longitude?: number
          max_claims?: number | null
          required_action?: string
          reward_amount?: number
          reward_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          total_earnings: number
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          total_earnings?: number
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          commission_rate: number
          created_at: string
          earnings_shared: number
          expires_at: string | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          earnings_shared?: number
          expires_at?: string | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          earnings_shared?: number
          expires_at?: string | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_logs: {
        Row: {
          amount: number
          attention_score: number | null
          coin_type: string
          content_id: string
          created_at: string
          id: string
          reward_type: string
          user_id: string
        }
        Insert: {
          amount: number
          attention_score?: number | null
          coin_type: string
          content_id: string
          created_at?: string
          id?: string
          reward_type: string
          user_id: string
        }
        Update: {
          amount?: number
          attention_score?: number | null
          coin_type?: string
          content_id?: string
          created_at?: string
          id?: string
          reward_type?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_status: {
        Row: {
          created_at: string
          id: string
          is_subscribed: boolean
          product_id: string | null
          stripe_customer_id: string | null
          subscription_end: string | null
          tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_subscribed?: boolean
          product_id?: string | null
          stripe_customer_id?: string | null
          subscription_end?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_subscribed?: boolean
          product_id?: string | null
          stripe_customer_id?: string | null
          subscription_end?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          goal: number
          icon: string | null
          id: string
          is_active: boolean
          reward_type: string
          reward_value: number
          target_roles: string[] | null
          title: string
          type: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          goal?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_type?: string
          reward_value?: number
          target_roles?: string[] | null
          title: string
          type?: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          goal?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_type?: string
          reward_value?: number
          target_roles?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          coin_type: string
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          coin_type: string
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          coin_type?: string
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string | null
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          reason: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_levels: {
        Row: {
          created_at: string
          current_xp: number
          id: string
          last_active_date: string | null
          level: number
          longest_streak: number
          streak_days: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_xp?: number
          id?: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          streak_days?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_xp?: number
          id?: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          streak_days?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          avg_watch_time: number | null
          created_at: string
          disliked_tags: string[] | null
          engagement_score: number | null
          focus_score: number | null
          id: string
          last_seen_content: string[] | null
          liked_tags: string[] | null
          preferred_categories: string[] | null
          total_content_views: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_watch_time?: number | null
          created_at?: string
          disliked_tags?: string[] | null
          engagement_score?: number | null
          focus_score?: number | null
          id?: string
          last_seen_content?: string[] | null
          liked_tags?: string[] | null
          preferred_categories?: string[] | null
          total_content_views?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_watch_time?: number | null
          created_at?: string
          disliked_tags?: string[] | null
          engagement_score?: number | null
          focus_score?: number | null
          id?: string
          last_seen_content?: string[] | null
          liked_tags?: string[] | null
          preferred_categories?: string[] | null
          total_content_views?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_by: string
          reported_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_by: string
          reported_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_by?: string
          reported_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
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
      user_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          goal: number
          id: string
          period_end: string | null
          period_start: string
          progress: number
          reward_claimed: boolean
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          goal: number
          id?: string
          period_end?: string | null
          period_start?: string
          progress?: number
          reward_claimed?: boolean
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          goal?: number
          id?: string
          period_end?: string | null
          period_start?: string
          progress?: number
          reward_claimed?: boolean
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "user" | "creator" | "moderator" | "admin"
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
      app_role: ["user", "creator", "moderator", "admin"],
    },
  },
} as const
