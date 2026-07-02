export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: string
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
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
      organizations: {
        Row: {
          branding: Json | null
          contact_email: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          web_slug: string | null
        }
        Insert: {
          branding?: Json | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          web_slug?: string | null
        }
        Update: {
          branding?: Json | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          web_slug?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_owner: {
        Args: {
          p_branch_name?: string
          p_org_name: string
          p_owner_name?: string
        }
        Returns: string
      }
      get_my_branch: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_org: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
