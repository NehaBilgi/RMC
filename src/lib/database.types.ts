// Starter database shapes for the bundled migration. Regenerate with the Supabase
// CLI after changing the live schema: supabase gen types typescript --linked.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | 'READ_ONLY';
export type SiteStatus = 'active' | 'completed' | 'on_hold';

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string;
          username: string;
          role: UserRole;
          page_access: string[];
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          username: string;
          role?: UserRole;
          page_access?: string[];
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          username?: string;
          role?: UserRole;
          page_access?: string[];
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          code: string | null;
          client_name: string;
          location: string;
          status: SiteStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          code?: string | null;
          client_name?: string;
          location?: string;
          status?: SiteStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          code?: string | null;
          client_name?: string;
          location?: string;
          status?: SiteStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_records: {
        Row: {
          id: string;
          company_id: string;
          site_id: string | null;
          page_id: string;
          record_type: string;
          data: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          site_id?: string | null;
          page_id: string;
          record_type: string;
          data?: Json;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string | null;
          page_id?: string;
          record_type?: string;
          data?: Json;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_company_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      has_page_access: { Args: { requested_page: string }; Returns: boolean };
      can_access_any_page: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
