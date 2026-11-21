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
          site_id?: string | null;
          name: string;
          site_name?: string | null;
          category?: string | null;
          location?: string | null;
          supervisor?: string | null;
          client_name?: string | null;
          phone?: string | null;
          gstin?: string | null;
          scope?: string | null;
          assigned_fleet?: number | null;
          status?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          site_id?: string | null;
          name: string;
          site_name?: string | null;
          category?: string | null;
          location?: string | null;
          supervisor?: string | null;
          client_name?: string | null;
          phone?: string | null;
          gstin?: string | null;
          scope?: string | null;
          assigned_fleet?: number | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string | null;
          name?: string;
          site_name?: string | null;
          category?: string | null;
          location?: string | null;
          supervisor?: string | null;
          client_name?: string | null;
          phone?: string | null;
          gstin?: string | null;
          scope?: string | null;
          assigned_fleet?: number | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          site_name: string;
          invoice_no: string;
          date: string;
          customer_name?: string | null;
          customer_gst?: string | null;
          mix_grade?: string | null;
          volume_m3?: number | null;
          rate_per_m3?: number | null;
          basic_amount?: number | null;
          cgst_amount?: number | null;
          sgst_amount?: number | null;
          total_tax?: number | null;
          total_amount?: number | null;
          vehicle_no?: string | null;
          payment_mode?: string | null;
          payment_status?: string | null;
          raw_data?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          site_name: string;
          invoice_no: string;
          date: string;
          customer_name?: string | null;
          customer_gst?: string | null;
          mix_grade?: string | null;
          volume_m3?: number | null;
          rate_per_m3?: number | null;
          basic_amount?: number | null;
          cgst_amount?: number | null;
          sgst_amount?: number | null;
          total_tax?: number | null;
          total_amount?: number | null;
          vehicle_no?: string | null;
          payment_mode?: string | null;
          payment_status?: string | null;
          raw_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_name?: string;
          invoice_no?: string;
          date?: string;
          customer_name?: string | null;
          customer_gst?: string | null;
          mix_grade?: string | null;
          volume_m3?: number | null;
          rate_per_m3?: number | null;
          basic_amount?: number | null;
          cgst_amount?: number | null;
          sgst_amount?: number | null;
          total_tax?: number | null;
          total_amount?: number | null;
          vehicle_no?: string | null;
          payment_mode?: string | null;
          payment_status?: string | null;
          raw_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      haulage_trips: {
        Row: {
          id: string;
          site_name: string;
          trip_date: string;
          vehicle_number: string;
          material_name: string;
          purchased_from?: string | null;
          day_trips?: number | null;
          brass_per_trip?: number | null;
          rate_per_brass?: number | null;
          total_amount?: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          site_name: string;
          trip_date: string;
          vehicle_number: string;
          material_name: string;
          purchased_from?: string | null;
          day_trips?: number | null;
          brass_per_trip?: number | null;
          rate_per_brass?: number | null;
          total_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_name?: string;
          trip_date?: string;
          vehicle_number?: string;
          material_name?: string;
          purchased_from?: string | null;
          day_trips?: number | null;
          brass_per_trip?: number | null;
          rate_per_brass?: number | null;
          total_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_tests: {
        Row: {
          id: string;
          site_name: string;
          test_date: string;
          mix_grade: string;
          batch_vehicle_no?: string | null;
          slump_mm?: number | null;
          concrete_temp_c?: number | null;
          cube_7day_mpa?: number | null;
          cube_28day_mpa?: number | null;
          test_status?: string | null;
          tested_by?: string | null;
          remarks?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          site_name: string;
          test_date: string;
          mix_grade: string;
          batch_vehicle_no?: string | null;
          slump_mm?: number | null;
          concrete_temp_c?: number | null;
          cube_7day_mpa?: number | null;
          cube_28day_mpa?: number | null;
          test_status?: string | null;
          tested_by?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_name?: string;
          test_date?: string;
          mix_grade?: string;
          batch_vehicle_no?: string | null;
          slump_mm?: number | null;
          concrete_temp_c?: number | null;
          cube_7day_mpa?: number | null;
          cube_28day_mpa?: number | null;
          test_status?: string | null;
          tested_by?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transit_mixers: {
        Row: {
          id: string;
          vehicle_no: string;
          equipment_type?: string | null;
          capacity_m3?: number | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          status?: string | null;
          ownership?: string | null;
          is_active?: boolean | null;
          site_key?: string | null;
          notes?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          vehicle_no: string;
          equipment_type?: string | null;
          capacity_m3?: number | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          status?: string | null;
          ownership?: string | null;
          is_active?: boolean | null;
          site_key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_no?: string;
          equipment_type?: string | null;
          capacity_m3?: number | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          status?: string | null;
          ownership?: string | null;
          is_active?: boolean | null;
          site_key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mix_designs: {
        Row: {
          grade: string;
          target_mpa?: number | null;
          wcr?: number | null;
          cement_kg?: number | null;
          mineral_admixture_kg?: number | null;
          water_litres?: number | null;
          m_sand_kg?: number | null;
          agg_20mm_kg?: number | null;
          agg_10mm_kg?: number | null;
          admixture_kg?: number | null;
          total_density?: number | null;
          mode?: string | null;
          updated_at: string;
        };
        Insert: {
          grade: string;
          target_mpa?: number | null;
          wcr?: number | null;
          cement_kg?: number | null;
          mineral_admixture_kg?: number | null;
          water_litres?: number | null;
          m_sand_kg?: number | null;
          agg_20mm_kg?: number | null;
          agg_10mm_kg?: number | null;
          admixture_kg?: number | null;
          total_density?: number | null;
          mode?: string | null;
          updated_at?: string;
        };
        Update: {
          grade?: string;
          target_mpa?: number | null;
          wcr?: number | null;
          cement_kg?: number | null;
          mineral_admixture_kg?: number | null;
          water_litres?: number | null;
          m_sand_kg?: number | null;
          agg_20mm_kg?: number | null;
          agg_10mm_kg?: number | null;
          admixture_kg?: number | null;
          total_density?: number | null;
          mode?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      material_categories: {
        Row: {
          id: string;
          category_type?: string | null;
          code: string;
          name?: string | null;
          unit?: string | null;
          rate?: number | null;
          target_strength?: string | null;
          slump?: string | null;
          status?: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          category_type?: string | null;
          code: string;
          name?: string | null;
          unit?: string | null;
          rate?: number | null;
          target_strength?: string | null;
          slump?: string | null;
          status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_type?: string | null;
          code?: string;
          name?: string | null;
          unit?: string | null;
          rate?: number | null;
          target_strength?: string | null;
          slump?: string | null;
          status?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      site_measurements: {
        Row: {
          id: string;
          site_name: string;
          element_name: string;
          mix_grade?: string | null;
          length_m?: number | null;
          width_m?: number | null;
          depth_m?: number | null;
          quantity?: number | null;
          volume_m3?: number | null;
          remarks?: string | null;
          date?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          site_name: string;
          element_name: string;
          mix_grade?: string | null;
          length_m?: number | null;
          width_m?: number | null;
          depth_m?: number | null;
          quantity?: number | null;
          volume_m3?: number | null;
          remarks?: string | null;
          date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_name?: string;
          element_name?: string;
          mix_grade?: string | null;
          length_m?: number | null;
          width_m?: number | null;
          depth_m?: number | null;
          quantity?: number | null;
          volume_m3?: number | null;
          remarks?: string | null;
          date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_profile: {
        Row: {
          id: string;
          name: string;
          gstin?: string | null;
          address?: string | null;
          division?: string | null;
          phone_primary?: string | null;
          phone_secondary?: string | null;
          bank_name?: string | null;
          account_name?: string | null;
          account_no?: string | null;
          ifsc_swift?: string | null;
          branch?: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          gstin?: string | null;
          address?: string | null;
          division?: string | null;
          phone_primary?: string | null;
          phone_secondary?: string | null;
          bank_name?: string | null;
          account_name?: string | null;
          account_no?: string | null;
          ifsc_swift?: string | null;
          branch?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          gstin?: string | null;
          address?: string | null;
          division?: string | null;
          phone_primary?: string | null;
          phone_secondary?: string | null;
          bank_name?: string | null;
          account_name?: string | null;
          account_no?: string | null;
          ifsc_swift?: string | null;
          branch?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_users: {
        Row: {
          id: string;
          username: string;
          name?: string | null;
          password?: string | null;
          role: string;
          page_access: string[];
          active: boolean;
          expires_at?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          name?: string | null;
          password?: string | null;
          role?: string;
          page_access?: string[];
          active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          name?: string | null;
          password?: string | null;
          role?: string;
          page_access?: string[];
          active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      silo_inward_entries: {
        Row: {
          id: string;
          date: string;
          silo: string;
          supplier_name?: string | null;
          vehicle_or_challan_no?: string | null;
          quantity_kg?: number | null;
          rate_per_kg?: number | null;
          total_amount?: number | null;
          remarks?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          date: string;
          silo: string;
          supplier_name?: string | null;
          vehicle_or_challan_no?: string | null;
          quantity_kg?: number | null;
          rate_per_kg?: number | null;
          total_amount?: number | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          silo?: string;
          supplier_name?: string | null;
          vehicle_or_challan_no?: string | null;
          quantity_kg?: number | null;
          rate_per_kg?: number | null;
          total_amount?: number | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          quote_no: string;
          site_name: string;
          date: string;
          valid_until?: string | null;
          client_name?: string | null;
          client_address?: string | null;
          client_gstin?: string | null;
          client_phone?: string | null;
          mix_grade?: string | null;
          grade_items?: Json;
          estimated_qty_m3?: number | null;
          unit_rate?: number | null;
          include_pump?: boolean | null;
          pump_rent_per_shift?: number | null;
          pump_shifts?: number | null;
          apply_gst?: boolean | null;
          grand_total?: number | null;
          status?: string | null;
          remarks?: string | null;
          terms_list?: Json;
          measurement_lines?: Json;
          raw_data?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          quote_no: string;
          site_name: string;
          date: string;
          valid_until?: string | null;
          client_name?: string | null;
          client_address?: string | null;
          client_gstin?: string | null;
          client_phone?: string | null;
          mix_grade?: string | null;
          grade_items?: Json;
          estimated_qty_m3?: number | null;
          unit_rate?: number | null;
          include_pump?: boolean | null;
          pump_rent_per_shift?: number | null;
          pump_shifts?: number | null;
          apply_gst?: boolean | null;
          grand_total?: number | null;
          status?: string | null;
          remarks?: string | null;
          terms_list?: Json;
          measurement_lines?: Json;
          raw_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_no?: string;
          site_name?: string;
          date?: string;
          valid_until?: string | null;
          client_name?: string | null;
          client_address?: string | null;
          client_gstin?: string | null;
          client_phone?: string | null;
          mix_grade?: string | null;
          grade_items?: Json;
          estimated_qty_m3?: number | null;
          unit_rate?: number | null;
          include_pump?: boolean | null;
          pump_rent_per_shift?: number | null;
          pump_shifts?: number | null;
          apply_gst?: boolean | null;
          grand_total?: number | null;
          status?: string | null;
          remarks?: string | null;
          terms_list?: Json;
          measurement_lines?: Json;
          raw_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_data_store: {
        Row: {
          id: string;
          storage_key: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          storage_key: string;
          data?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          storage_key?: string;
          data?: Json;
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
