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
      agent_configs: {
        Row: {
          approval_mode: string
          approval_telegram_chat_id: string | null
          created_at: string
          enabled: boolean
          id: string
          model: string
          organization_id: string
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          approval_telegram_chat_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string
          organization_id: string
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          approval_telegram_chat_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string
          organization_id?: string
          system_prompt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_approvals: {
        Row: {
          action: Json | null
          conversation_id: string
          created_at: string
          draft: string
          id: string
          organization_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          action?: Json | null
          conversation_id: string
          created_at?: string
          draft: string
          id?: string
          organization_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          action?: Json | null
          conversation_id?: string
          created_at?: string
          draft?: string
          id?: string
          organization_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_approvals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          service_id: string
        }
        Insert: {
          appointment_id: string
          service_id: string
        }
        Update: {
          appointment_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          branch_id: string
          client_id: string | null
          created_at: string
          ends_at: string
          followup_sent_at: string | null
          id: string
          notes: string | null
          organization_id: string
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          source: string
          staff_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          branch_id: string
          client_id?: string | null
          created_at?: string
          ends_at: string
          followup_sent_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          source?: string
          staff_id?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          branch_id?: string
          client_id?: string | null
          created_at?: string
          ends_at?: string
          followup_sent_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          source?: string
          staff_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
          timezone: string
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: string
          timezone?: string
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          branch_id: string
          close_time: string
          id: string
          is_closed: boolean
          open_time: string
          weekday: number
        }
        Insert: {
          branch_id: string
          close_time: string
          id?: string
          is_closed?: boolean
          open_time: string
          weekday: number
        }
        Update: {
          branch_id?: string
          close_time?: string
          id?: string
          is_closed?: boolean
          open_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string | null
          endpoint: string
          p256dh: string
          auth: string
          device_name: string | null
          browser: string | null
          user_agent: string | null
          created_at: string
          last_used_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          endpoint: string
          p256dh: string
          auth: string
          device_name?: string | null
          browser?: string | null
          user_agent?: string | null
          created_at?: string
          last_used_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          endpoint?: string
          p256dh?: string
          auth?: string
          device_name?: string | null
          browser?: string | null
          user_agent?: string | null
          created_at?: string
          last_used_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Json
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          credentials: Json | null
          display_name: string | null
          external_id: string
          id: string
          organization_id: string
          status: string
          type: string
          waba_id: string | null
        }
        Insert: {
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id: string
          id?: string
          organization_id: string
          status?: string
          type: string
          waba_id?: string | null
        }
        Update: {
          created_at?: string
          credentials?: Json | null
          display_name?: string | null
          external_id?: string
          id?: string
          organization_id?: string
          status?: string
          type?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          client_id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          tag_id: string
        }
        Update: {
          client_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          ai_paused_until: string | null
          assigned_agent_id: string | null
          channel_id: string
          client_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          organization_id: string
          status: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_paused_until?: string | null
          assigned_agent_id?: string | null
          channel_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          organization_id: string
          status?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_paused_until?: string | null
          assigned_agent_id?: string | null
          channel_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          source: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          source?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_id: string | null
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          media_path: string | null
          sender: string
        }
        Insert: {
          agent_id?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          media_path?: string | null
          sender: string
        }
        Update: {
          agent_id?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          media_path?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json | null
          contact_email: string | null
          created_at: string
          id: string
          name: string
          onboarding_email_sent_at: string | null
          phone: string | null
          web_slug: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          branding?: Json | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          onboarding_email_sent_at?: string | null
          phone?: string | null
          web_slug?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          branding?: Json | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          onboarding_email_sent_at?: string | null
          phone?: string | null
          web_slug?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          organization_id: string
          price: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          organization_id: string
          price?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_branch_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          phone: string | null
          role: string
        }
        Insert: {
          assigned_branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          role?: string
        }
        Update: {
          assigned_branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_branch_id_fkey"
            columns: ["assigned_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalogs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          organization_id: string
          price: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          organization_id: string
          price?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_catalogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          branch_id: string
          end_time: string
          id: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          branch_id: string
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Update: {
          branch_id?: string
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          ends_at: string
          id: string
          reason: string | null
          staff_id: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          reason?: string | null
          staff_id: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ai_tier: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          has_domain: boolean
          id: string
          organization_id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_seats: number
          trial_end: string | null
          trial_ending_email_sent_at: string | null
          updated_at: string
        }
        Insert: {
          ai_tier?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          has_domain?: boolean
          id?: string
          organization_id: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_seats?: number
          trial_end?: string | null
          trial_ending_email_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_tier?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          has_domain?: boolean
          id?: string
          organization_id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_seats?: number
          trial_end?: string | null
          trial_ending_email_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_global_stats: { Args: never; Returns: Json }
      admin_list_organizations: {
        Args: never
        Returns: {
          id: string
          name: string
          country: string | null
          city: string | null
          created_at: string
          owner_email: string | null
          owner_name: string | null
          plan: string
          sub_status: string
          ai_tier: string
          has_domain: boolean
          team_seats: number
          trial_end: string | null
          current_period_end: string | null
          users_count: number
          conversations_count: number
          appointments_count: number
          clients_count: number
          last_activity: string | null
        }[]
      }
      assert_org_access: { Args: { p_org: string }; Returns: undefined }
      claim_reminder: {
        Args: { p_appointment_id: string; p_kind: string }
        Returns: boolean
      }
      cancel_appointment_from_chat: {
        Args: {
          p_appointment_id: string
          p_channel_type: string
          p_client_phone: string
          p_external_id: string
        }
        Returns: undefined
      }
      create_ai_approval: {
        Args: { p_action?: Json; p_conversation_id: string; p_draft: string }
        Returns: Json
      }
      create_appointment: {
        Args: {
          p_branch_id: string
          p_client_id?: string
          p_notes?: string
          p_service_ids: string[]
          p_source?: string
          p_staff_id?: string
          p_starts_at: string
        }
        Returns: string
      }
      create_appointment_from_chat: {
        Args: {
          p_branch_id?: string
          p_channel_type: string
          p_client_phone: string
          p_external_id: string
          p_service_ids: string[]
          p_staff_id?: string
          p_starts_at: string
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: {
          p_branch_name?: string
          p_city?: string
          p_country?: string
          p_org_name: string
          p_owner_name?: string
          p_phone?: string
          p_terms_version?: string
        }
        Returns: string
      }
      create_public_appointment: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_service_ids: string[]
          p_slug: string
          p_starts_at: string
        }
        Returns: string
      }
      get_agent_context: {
        Args: {
          p_channel_type: string
          p_external_id: string
          p_from_handle: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          p_branch_id: string
          p_date: string
          p_service_ids: string[]
          p_slot_interval?: number
          p_staff_id?: string
        }
        Returns: {
          slot_end: string
          slot_start: string
          staff_id: string
        }[]
      }
      get_due_reminders: { Args: { p_kind: string }; Returns: Json }
      get_my_branch: { Args: never; Returns: string }
      get_my_org: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_public_booking_context: { Args: { p_slug: string }; Returns: Json }
      log_outbound_message: {
        Args: {
          p_body: string
          p_conversation_id: string
          p_external_id?: string
          p_sender?: string
        }
        Returns: string
      }
      org_has_ai: { Args: { p_org: string }; Returns: boolean }
      org_is_active: { Args: { p_org: string }; Returns: boolean }
      pause_ai: {
        Args: { p_conversation_id: string; p_minutes?: number }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_staff_id?: string
          p_new_starts_at: string
        }
        Returns: undefined
      }
      reschedule_appointment_from_chat: {
        Args: {
          p_appointment_id: string
          p_channel_type: string
          p_client_phone: string
          p_external_id: string
          p_new_starts_at: string
        }
        Returns: undefined
      }
      resolve_ai_approval: {
        Args: { p_approval_id: string; p_approved: boolean }
        Returns: Json
      }
      resume_ai: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      get_appointment_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      confirm_appointment_by_token: {
        Args: { p_token: string }
        Returns: undefined
      }
      cancel_appointment_by_token: {
        Args: { p_token: string }
        Returns: undefined
      }
      reschedule_appointment_by_token: {
        Args: { p_token: string; p_new_starts_at: string }
        Returns: undefined
      }
      get_manage_token_from_chat: {
        Args: {
          p_channel_type: string
          p_external_id: string
          p_client_phone: string
          p_appointment_id: string
        }
        Returns: string
      }
      confirm_appointment_from_chat: {
        Args: {
          p_channel_type: string
          p_external_id: string
          p_client_phone: string
          p_appointment_id: string
        }
        Returns: Json
      }
      route_inbound_message: {
        Args: {
          p_body: string
          p_channel_type: string
          p_ext_msg_id?: string
          p_external_id: string
          p_from_handle: string
          p_media_path?: string
        }
        Returns: Json
      }
      set_ai_enabled: {
        Args: { p_conversation_id: string; p_enabled: boolean }
        Returns: undefined
      }
      set_appointment_status: {
        Args: { p_appointment_id: string; p_status: string }
        Returns: undefined
      }
      set_conversation_status: {
        Args: { p_conversation_id: string; p_status: string }
        Returns: undefined
      }
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
