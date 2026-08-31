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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      active_drivers: {
        Row: {
          driver_id: string
          status: string
          current_lat: number | null
          current_lng: number | null
          last_updated: string | null
        }
        Insert: {
          driver_id: string
          status?: string
          current_lat?: number | null
          current_lng?: number | null
          last_updated?: string | null
        }
        Update: {
          driver_id?: string
          status?: string
          current_lat?: number | null
          current_lng?: number | null
          last_updated?: string | null
        }
        Relationships: []
      }
      application_status_history: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          created_by: string | null
          form_data: Json
          id: string
          programme_id: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_data?: Json
          id?: string
          programme_id?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_data?: Json
          id?: string
          programme_id?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      assistance_requests: {
        Row: {
          assigned_to: string | null
          circumstances: string | null
          created_at: string
          created_by: string | null
          id: string
          need_summary: string
          programme_id: string | null
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          circumstances?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          need_summary: string
          programme_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          circumstances?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          need_summary?: string
          programme_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_requests_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      booking_services: {
        Row: {
          cancel_cutoff_hours: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          price_kobo: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cancel_cutoff_hours?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          price_kobo?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cancel_cutoff_hours?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          price_kobo?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_slots: {
        Row: {
          capacity: number
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          location: string | null
          service_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          location?: string | null
          service_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          service_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_slots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          slot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "booking_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      case_assessments: {
        Row: {
          assessor_id: string
          case_id: string
          created_at: string
          id: string
          notes: string
          recommendation: string | null
          updated_at: string
        }
        Insert: {
          assessor_id: string
          case_id: string
          created_at?: string
          id?: string
          notes: string
          recommendation?: string | null
          updated_at?: string
        }
        Update: {
          assessor_id?: string
          case_id?: string
          created_at?: string
          id?: string
          notes?: string
          recommendation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_assessments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      case_eligibility: {
        Row: {
          case_id: string
          created_at: string
          criteria_notes: string | null
          determined_by: string
          eligible: boolean
          id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          criteria_notes?: string | null
          determined_by: string
          eligible: boolean
          id?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          criteria_notes?: string | null
          determined_by?: string
          eligible?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_eligibility_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      case_referrals: {
        Row: {
          case_id: string
          created_at: string
          id: string
          reason: string | null
          referred_by: string
          referred_to: string
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          reason?: string | null
          referred_by: string
          referred_to: string
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          referred_by?: string
          referred_to?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_referrals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      case_status_history: {
        Row: {
          actor_id: string | null
          case_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["case_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["case_status"]
        }
        Insert: {
          actor_id?: string | null
          case_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["case_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["case_status"]
        }
        Update: {
          actor_id?: string | null
          case_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["case_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["case_status"]
        }
        Relationships: [
          {
            foreignKeyName: "case_status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          rate_percent: number
          ride_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          id?: string
          rate_percent: number
          ride_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          rate_percent?: number
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      corporate_accounts: {
        Row: {
          contact_email: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          legal_entity_id: string | null
          monthly_cap_kobo: number | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_id?: string | null
          monthly_cap_kobo?: number | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_id?: string | null
          monthly_cap_kobo?: number | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_accounts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_employees: {
        Row: {
          corporate_account_id: string
          created_at: string
          created_by: string | null
          id: string
          invited_email: string
          role: string
          spending_limit_kobo: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          corporate_account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invited_email: string
          role?: string
          spending_limit_kobo?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          corporate_account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invited_email?: string
          role?: string
          spending_limit_kobo?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corporate_employees_corporate_account_id_fkey"
            columns: ["corporate_account_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_invoices: {
        Row: {
          corporate_account_id: string
          created_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          status: string
          total_kobo: number
          updated_at: string
        }
        Insert: {
          corporate_account_id: string
          created_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: string
          total_kobo?: number
          updated_at?: string
        }
        Update: {
          corporate_account_id?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          total_kobo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_invoices_corporate_account_id_fkey"
            columns: ["corporate_account_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_spending_limits: {
        Row: {
          corporate_account_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          id: string
          limit_kobo: number
          period: string
          updated_at: string
        }
        Insert: {
          corporate_account_id: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          limit_kobo: number
          period?: string
          updated_at?: string
        }
        Update: {
          corporate_account_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          limit_kobo?: number
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_spending_limits_corporate_account_id_fkey"
            columns: ["corporate_account_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_spending_limits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "corporate_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          self_enrol: boolean
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          self_enrol?: boolean
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          self_enrol?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          driver_id: string
          id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          driver_id: string
          id?: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          driver_id?: string
          id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          delivery_id: string
          driver_id: string
          id: string
          offered_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          delivery_id: string
          driver_id: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          delivery_id?: string
          driver_id?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          assigned_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          collected_at: string | null
          corporate_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          delivered_at: string | null
          destination_address: string
          destination_lat: number
          destination_lng: number
          discount_kobo: number
          driver_id: string | null
          estimated_distance_km: number | null
          estimated_price_kobo: number | null
          final_price_kobo: number | null
          id: string
          package_category: string
          package_photo_document_id: string | null
          package_size: string
          package_weight_kg: number | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promotion_id: string | null
          recipient_name: string
          recipient_phone: string
          requested_at: string
          service_type_id: string | null
          speed: string
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          collected_at?: string | null
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          delivered_at?: string | null
          destination_address: string
          destination_lat: number
          destination_lng: number
          discount_kobo?: number
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_price_kobo?: number | null
          final_price_kobo?: number | null
          id?: string
          package_category: string
          package_photo_document_id?: string | null
          package_size?: string
          package_weight_kg?: number | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promotion_id?: string | null
          recipient_name: string
          recipient_phone: string
          requested_at?: string
          service_type_id?: string | null
          speed?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          collected_at?: string | null
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          delivered_at?: string | null
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          discount_kobo?: number
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_price_kobo?: number | null
          final_price_kobo?: number | null
          id?: string
          package_category?: string
          package_photo_document_id?: string | null
          package_size?: string
          package_weight_kg?: number | null
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          promotion_id?: string | null
          recipient_name?: string
          recipient_phone?: string
          requested_at?: string
          service_type_id?: string | null
          speed?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proof: {
        Row: {
          created_by: string | null
          delivered_at: string
          delivered_lat: number | null
          delivered_lng: number | null
          delivery_id: string
          id: string
          otp_verified: boolean
          photo_url: string | null
          recipient_name: string
          signature_url: string | null
        }
        Insert: {
          created_by?: string | null
          delivered_at?: string
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_id: string
          id?: string
          otp_verified?: boolean
          photo_url?: string | null
          recipient_name: string
          signature_url?: string | null
        }
        Update: {
          created_by?: string | null
          delivered_at?: string
          delivered_lat?: number | null
          delivered_lng?: number | null
          delivery_id?: string
          id?: string
          otp_verified?: boolean
          photo_url?: string | null
          recipient_name?: string
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proof_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          delivery_id: string
          from_status: Database["public"]["Enums"]["delivery_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delivery_id: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: string
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delivery_id?: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          action?: string
          actor_id?: string | null
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          file_name: string
          file_path: string
          id: string
          mime_type: string
          owner_id: string
          size_bytes: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          owner_id: string
          size_bytes: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          owner_id?: string
          size_bytes?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          document_type: string
          driver_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type: string
          driver_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type?: string
          driver_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          commission_kobo: number
          created_at: string
          created_by: string | null
          currency: string
          driver_id: string
          gross_kobo: number
          id: string
          kind: string
          net_kobo: number
          notes: string | null
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_kobo: number
          created_at?: string
          created_by?: string | null
          currency?: string
          driver_id: string
          gross_kobo: number
          id?: string
          kind?: string
          net_kobo: number
          notes?: string | null
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_kobo?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          driver_id?: string
          gross_kobo?: number
          id?: string
          kind?: string
          net_kobo?: number
          notes?: string | null
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_incentives: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metric: string
          reward_kobo: number
          status: string
          threshold: number
          title: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric: string
          reward_kobo: number
          status?: string
          threshold: number
          title: string
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric?: string
          reward_kobo?: number
          status?: string
          threshold?: number
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      driver_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          driver_id: string
          id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          driver_id: string
          id?: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          driver_id?: string
          id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicle_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          status: string
          unassigned_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          status?: string
          unassigned_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          status?: string
          unassigned_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          accepts_deliveries: boolean
          account_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          current_lat: number | null
          current_lng: number | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          is_online: boolean
          location_updated_at: string | null
          phone: string
          photo_url: string | null
          rating_avg: number
          rating_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_deliveries?: boolean
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_lat?: number | null
          current_lng?: number | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          is_online?: boolean
          location_updated_at?: string | null
          phone: string
          photo_url?: string | null
          rating_avg?: number
          rating_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_deliveries?: boolean
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_lat?: number | null
          current_lng?: number | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          is_online?: boolean
          location_updated_at?: string | null
          phone?: string
          photo_url?: string | null
          rating_avg?: number
          rating_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          enquiry_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          enquiry_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          enquiry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_notes_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      enrolments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_dispatches: {
        Row: {
          id: string
          customer_id: string
          assigned_driver_id: string | null
          pickup_address: string
          dropoff_address: string
          pickup_point: string | null
          dropoff_point: string | null
          fare_amount: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          assigned_driver_id?: string | null
          pickup_address: string
          dropoff_address: string
          pickup_point?: string | null
          dropoff_point?: string | null
          fare_amount: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          assigned_driver_id?: string | null
          pickup_address?: string
          dropoff_address?: string
          pickup_point?: string | null
          dropoff_point?: string | null
          fare_amount?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          due_date: string
          enquiry_id: string | null
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          enquiry_id?: string | null
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          enquiry_id?: string | null
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_progress: {
        Row: {
          awarded: boolean
          awarded_at: string | null
          completed: boolean
          created_at: string
          driver_id: string
          id: string
          incentive_id: string
          progress: number
          updated_at: string
        }
        Insert: {
          awarded?: boolean
          awarded_at?: string | null
          completed?: boolean
          created_at?: string
          driver_id: string
          id?: string
          incentive_id: string
          progress?: number
          updated_at?: string
        }
        Update: {
          awarded?: boolean
          awarded_at?: string | null
          completed?: boolean
          created_at?: string
          driver_id?: string
          id?: string
          incentive_id?: string
          progress?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_progress_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_progress_incentive_id_fkey"
            columns: ["incentive_id"]
            isOneToOne: false
            referencedRelation: "driver_incentives"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_kobo: number
          created_at: string
          created_by: string | null
          currency: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          invoice_number: string
          legal_entity_id: string | null
          payer_id: string | null
          programme_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          invoice_number: string
          legal_entity_id?: string | null
          payer_id?: string | null
          programme_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invoice_number?: string
          legal_entity_id?: string | null
          payer_id?: string | null
          programme_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          registration_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolment_id: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolment_id: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolment_id?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body: string | null
          content_type: string
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          body?: string | null
          content_type?: string
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          body?: string | null
          content_type?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          key: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          status?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price_kobo: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price_kobo: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          total_kobo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          order_number: string
          status?: Database["public"]["Enums"]["order_status"]
          total_kobo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_kobo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      passenger_details: {
        Row: {
          created_at: string
          date_of_birth: string | null
          enrolment_id: string
          full_name: string
          id: string
          medical_notes: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          passport_expiry: string | null
          passport_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          enrolment_id: string
          full_name: string
          id?: string
          medical_notes?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          enrolment_id?: string
          full_name?: string
          id?: string
          medical_notes?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_details_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "travel_enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          gateway: string
          id: string
          label: string | null
          token_ref: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gateway: string
          id?: string
          label?: string | null
          token_ref: string
          user_id: string
        }
        Update: {
          created_at?: string
          gateway?: string
          id?: string
          label?: string | null
          token_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_plan_instalments: {
        Row: {
          amount_kobo: number
          created_at: string
          due_date: string
          id: string
          label: string
          payment_id: string | null
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          due_date: string
          id?: string
          label: string
          payment_id?: string | null
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          payment_id?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_instalments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_instalments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          currency: string
          enrolment_id: string
          id: string
          status: string
          total_kobo: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          enrolment_id: string
          id?: string
          status?: string
          total_kobo: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          enrolment_id?: string
          id?: string
          status?: string
          total_kobo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "travel_enrolments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kobo: number
          created_at: string
          created_by: string | null
          currency: string
          entity_id: string | null
          entity_type: string
          gateway: string
          gateway_ref: string | null
          id: string
          invoice_id: string | null
          legal_entity_id: string | null
          paid_at: string | null
          payer_id: string
          programme_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entity_id?: string | null
          entity_type: string
          gateway?: string
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          paid_at?: string | null
          payer_id: string
          programme_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entity_id?: string | null
          entity_type?: string
          gateway?: string
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          paid_at?: string | null
          payer_id?: string
          programme_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          base_fare_kobo: number
          booking_fee_kobo: number
          cancellation_fee_kobo: number
          cancellation_grace_minutes: number
          commission_percent: number
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          id: string
          min_fare_kobo: number
          per_km_kobo: number
          per_minute_kobo: number
          service_type_id: string
          status: string
          surge_multiplier: number
          updated_at: string
          waiting_per_minute_kobo: number
        }
        Insert: {
          base_fare_kobo?: number
          booking_fee_kobo?: number
          cancellation_fee_kobo?: number
          cancellation_grace_minutes?: number
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          id?: string
          min_fare_kobo?: number
          per_km_kobo?: number
          per_minute_kobo?: number
          service_type_id: string
          status?: string
          surge_multiplier?: number
          updated_at?: string
          waiting_per_minute_kobo?: number
        }
        Update: {
          base_fare_kobo?: number
          booking_fee_kobo?: number
          cancellation_fee_kobo?: number
          cancellation_grace_minutes?: number
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          id?: string
          min_fare_kobo?: number
          per_km_kobo?: number
          per_minute_kobo?: number
          service_type_id?: string
          status?: string
          surge_multiplier?: number
          updated_at?: string
          waiting_per_minute_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_zones: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          radius_km: number
          status: string
          updated_at: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          radius_km?: number
          status?: string
          updated_at?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          radius_km?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_digital: boolean
          legal_entity_id: string | null
          price_kobo: number
          programme_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          stock_quantity: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_digital?: boolean
          legal_entity_id?: string | null
          price_kobo?: number
          programme_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          stock_quantity?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_digital?: boolean
          legal_entity_id?: string | null
          price_kobo?: number
          programme_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          stock_quantity?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          consent_given: boolean
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          location: string | null
          phone: string | null
          preferences: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          consent_given?: boolean
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          location?: string | null
          phone?: string | null
          preferences?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          consent_given?: boolean
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          location?: string | null
          phone?: string | null
          preferences?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          legal_entity_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_entity_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_redemptions: {
        Row: {
          created_at: string
          delivery_id: string | null
          discount_kobo: number
          id: string
          promotion_id: string
          ride_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          discount_kobo: number
          id?: string
          promotion_id: string
          ride_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          discount_kobo?: number
          id?: string
          promotion_id?: string
          ride_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          max_redemptions: number | null
          min_fare_kobo: number
          per_user_limit: number
          service_type_codes: string[] | null
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          value: number
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: string
          max_redemptions?: number | null
          min_fare_kobo?: number
          per_user_limit?: number
          service_type_codes?: string[] | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value: number
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          min_fare_kobo?: number
          per_user_limit?: number
          service_type_codes?: string[] | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          issued_to: string
          payment_id: string
          receipt_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_to: string
          payment_id: string
          receipt_number: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_to?: string
          payment_id?: string
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_kobo: number
          created_at: string
          id: string
          payment_id: string
          processed_by: string | null
          reason: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          id?: string
          payment_id: string
          processed_by?: string | null
          reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          id?: string
          payment_id?: string
          processed_by?: string | null
          reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_fares: {
        Row: {
          base_kobo: number
          booking_fee_kobo: number
          cancellation_fee_kobo: number
          created_at: string
          created_by: string | null
          currency: string
          distance_km: number | null
          distance_kobo: number
          duration_min: number | null
          estimated_total_kobo: number | null
          id: string
          kind: string
          ride_id: string
          time_kobo: number
          total_kobo: number
          updated_at: string
          waiting_kobo: number
        }
        Insert: {
          base_kobo?: number
          booking_fee_kobo?: number
          cancellation_fee_kobo?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          distance_km?: number | null
          distance_kobo?: number
          duration_min?: number | null
          estimated_total_kobo?: number | null
          id?: string
          kind?: string
          ride_id: string
          time_kobo?: number
          total_kobo?: number
          updated_at?: string
          waiting_kobo?: number
        }
        Update: {
          base_kobo?: number
          booking_fee_kobo?: number
          cancellation_fee_kobo?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          distance_km?: number | null
          distance_kobo?: number
          duration_min?: number | null
          estimated_total_kobo?: number | null
          id?: string
          kind?: string
          ride_id?: string
          time_kobo?: number
          total_kobo?: number
          updated_at?: string
          waiting_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_fares_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_locations: {
        Row: {
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          ride_id: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          ride_id: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          offered_at: string
          request_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          offered_at?: string
          request_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          offered_at?: string
          request_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_payments: {
        Row: {
          corporate_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          method: string
          payment_id: string | null
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          payment_id?: string | null
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          payment_id?: string | null
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_payments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_reports: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          reporter_id: string
          resolution_notes: string | null
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          reporter_id: string
          resolution_notes?: string | null
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          reporter_id?: string
          resolution_notes?: string | null
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          corporate_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          discount_kobo: number
          estimated_distance_km: number | null
          estimated_duration_min: number | null
          estimated_fare_kobo: number | null
          id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promotion_id: string | null
          service_type_id: string
          status: string
          updated_at: string
        }
        Insert: {
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          discount_kobo?: number
          estimated_distance_km?: number | null
          estimated_duration_min?: number | null
          estimated_fare_kobo?: number | null
          id?: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promotion_id?: string | null
          service_type_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          corporate_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          discount_kobo?: number
          estimated_distance_km?: number | null
          estimated_duration_min?: number | null
          estimated_fare_kobo?: number | null
          id?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          promotion_id?: string | null
          service_type_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ride_status"] | null
          id: string
          note: string | null
          ride_id: string
          to_status: Database["public"]["Enums"]["ride_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ride_status"] | null
          id?: string
          note?: string | null
          ride_id: string
          to_status: Database["public"]["Enums"]["ride_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ride_status"] | null
          id?: string
          note?: string | null
          ride_id?: string
          to_status?: Database["public"]["Enums"]["ride_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ride_status_history_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          accepted_at: string
          arrived_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_id: string
          final_distance_km: number | null
          final_duration_min: number | null
          id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          request_id: string
          service_type_id: string
          share_token: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
          vehicle_id: string | null
          verification_pin: string
        }
        Insert: {
          accepted_at?: string
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_id: string
          final_distance_km?: number | null
          final_duration_min?: number | null
          id?: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          request_id: string
          service_type_id: string
          share_token?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
          vehicle_id?: string | null
          verification_pin: string
        }
        Update: {
          accepted_at?: string
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          driver_id?: string
          final_distance_km?: number | null
          final_duration_min?: number | null
          id?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          request_id?: string
          service_type_id?: string
          share_token?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
          vehicle_id?: string | null
          verification_pin?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          lat: number | null
          lng: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_rides: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          generated_request_id: string | null
          id: string
          lead_minutes: number
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          recurrence: string
          recurrence_until: string | null
          scheduled_for: string
          service_type_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          generated_request_id?: string | null
          id?: string
          lead_minutes?: number
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          recurrence?: string
          recurrence_until?: string | null
          scheduled_for: string
          service_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          generated_request_id?: string | null
          id?: string
          lead_minutes?: number
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          recurrence?: string
          recurrence_until?: string | null
          scheduled_for?: string
          service_type_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_rides_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          capacity: number
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      surge_events: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          multiplier: number
          reason: string | null
          starts_at: string
          status: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          multiplier: number
          reason?: string | null
          starts_at?: string
          status?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          multiplier?: number
          reason?: string | null
          starts_at?: string
          status?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surge_events_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "pricing_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      swift_deliveries: {
        Row: {
          id: string
          customer_id: string
          driver_id: string | null
          pickup_address: string
          dropoff_address: string
          package_type: string
          weight_kg: number
          distance_km: number
          estimated_price: number
          payment_reference: string | null
          status: string
          driver_lat: number | null
          driver_lng: number | null
          rating: number | null
          rating_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          driver_id?: string | null
          pickup_address: string
          dropoff_address: string
          package_type?: string
          weight_kg?: number
          distance_km: number
          estimated_price: number
          payment_reference?: string | null
          status?: string
          driver_lat?: number | null
          driver_lng?: number | null
          rating?: number | null
          rating_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          driver_id?: string | null
          pickup_address?: string
          dropoff_address?: string
          package_type?: string
          weight_kg?: number
          distance_km?: number
          estimated_price?: number
          payment_reference?: string | null
          status?: string
          driver_lat?: number | null
          driver_lng?: number | null
          rating?: number | null
          rating_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      travel_enrolments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          package_id: string
          status: Database["public"]["Enums"]["travel_enrolment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_id: string
          status?: Database["public"]["Enums"]["travel_enrolment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_id?: string
          status?: Database["public"]["Enums"]["travel_enrolment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_enrolments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "travel_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_packages: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          currency: string
          ends_on: string | null
          id: string
          itinerary: string | null
          legal_entity_id: string | null
          price_kobo: number
          programme_id: string | null
          provider_name: string | null
          provider_notes: string | null
          slug: string
          starts_on: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on?: string | null
          id?: string
          itinerary?: string | null
          legal_entity_id?: string | null
          price_kobo?: number
          programme_id?: string | null
          provider_name?: string | null
          provider_notes?: string | null
          slug: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on?: string | null
          id?: string
          itinerary?: string | null
          legal_entity_id?: string | null
          price_kobo?: number
          programme_id?: string | null
          provider_name?: string | null
          provider_notes?: string | null
          slug?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_packages_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_packages_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          id: string
          user_id: string
          title: string
          file_url: string
          document_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          file_url: string
          document_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          file_url?: string
          document_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          document_type: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          colour: string | null
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          inspection_status: string
          make: string
          model: string
          plate_number: string
          status: string
          updated_at: string
          vehicle_class: string
          year: number | null
        }
        Insert: {
          colour?: string | null
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          inspection_status?: string
          make: string
          model: string
          plate_number: string
          status?: string
          updated_at?: string
          vehicle_class?: string
          year?: number | null
        }
        Update: {
          colour?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          inspection_status?: string
          make?: string
          model?: string
          plate_number?: string
          status?: string
          updated_at?: string
          vehicle_class?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_hire_bookings: {
        Row: {
          id: string
          customer_id: string
          category: string
          sub_category: string
          pickup_location: string
          destination: string
          start_date: string
          duration_days: number
          total_price: number
          payment_reference: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          category: string
          sub_category?: string
          pickup_location: string
          destination: string
          start_date: string
          duration_days?: number
          total_price: number
          payment_reference?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          category?: string
          sub_category?: string
          pickup_location?: string
          destination?: string
          start_date?: string
          duration_days?: number
          total_price?: number
          payment_reference?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_applications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          opportunity_id: string
          status: Database["public"]["Enums"]["volunteer_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          opportunity_id: string
          status?: Database["public"]["Enums"]["volunteer_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          opportunity_id?: string
          status?: Database["public"]["Enums"]["volunteer_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "volunteer_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_assignments: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          id: string
          opportunity_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "volunteer_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_assignments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "volunteer_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_hours: {
        Row: {
          assignment_id: string
          created_at: string
          hours: number
          id: string
          note: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          work_date: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          hours: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          work_date: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_hours_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "volunteer_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_opportunities: {
        Row: {
          commitment: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_remote: boolean
          location: string | null
          programme_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          commitment?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_remote?: boolean
          location?: string | null
          programme_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          commitment?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_remote?: boolean
          location?: string | null
          programme_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_opportunities_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteers: {
        Row: {
          availability: string | null
          bio: string | null
          created_at: string
          id: string
          skills: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          skills?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          skills?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_kobo: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          payment_id: string | null
          reference: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_id?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_id?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_kobo: number
          created_at: string
          currency: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      get_shared_ride: {
        Args: { _token: string }
        Returns: {
          destination_address: string
          driver_lat: number
          driver_lng: number
          driver_name: string
          ended: boolean
          pickup_address: string
          plate_number: string
          status: Database["public"]["Enums"]["ride_status"]
          vehicle_description: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_case_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_swift_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_user: {
        Args: {
          _body?: string
          _link?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      update_driver_location: {
        Args: {
          p_driver_id: string
          p_lat: number
          p_lng: number
          p_status: string
        }
        Returns: unknown
      }
    }
    Enums: {
      app_role:
        | "registered_user"
        | "administrator"
        | "programme_officer"
        | "content_editor"
        | "case_officer"
        | "driver"
        | "swift_dispatcher"
        | "swift_manager"
      application_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "waitlisted"
        | "withdrawn"
      booking_status:
        | "requested"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      case_status:
        | "submitted"
        | "intake"
        | "assessment"
        | "eligibility_review"
        | "approved"
        | "declined"
        | "referred"
        | "in_support"
        | "follow_up"
        | "closed"
      content_status: "draft" | "review" | "approved" | "published" | "archived"
      delivery_status:
        | "requested"
        | "assigned"
        | "pickup_en_route"
        | "arrived_for_pickup"
        | "package_collected"
        | "in_transit"
        | "arrived_at_destination"
        | "delivered"
        | "failed_delivery"
        | "cancelled"
      driver_status:
        | "pending_verification"
        | "approved"
        | "rejected"
        | "active"
        | "suspended"
        | "offline"
      order_status:
        | "placed"
        | "payment_confirmed"
        | "processing"
        | "fulfilled"
        | "cancelled"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      ride_status:
        | "requested"
        | "searching_driver"
        | "driver_assigned"
        | "driver_en_route"
        | "driver_arrived"
        | "trip_started"
        | "trip_completed"
        | "payment_pending"
        | "payment_completed"
        | "cancelled_by_customer"
        | "cancelled_by_driver"
        | "cancelled_by_system"
        | "disputed"
      travel_enrolment_status:
        | "enrolled"
        | "documents_pending"
        | "documents_verified"
        | "payment_in_progress"
        | "confirmed"
        | "completed"
        | "cancelled"
      volunteer_application_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      wallet_transaction_type:
        | "top_up"
        | "ride_payment"
        | "delivery_payment"
        | "refund"
        | "promo_credit"
        | "incentive_payout"
        | "adjustment"
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
      app_role: [
        "registered_user",
        "administrator",
        "programme_officer",
        "content_editor",
        "case_officer",
        "driver",
        "swift_dispatcher",
        "swift_manager",
      ],
      application_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "waitlisted",
        "withdrawn",
      ],
      booking_status: [
        "requested",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      case_status: [
        "submitted",
        "intake",
        "assessment",
        "eligibility_review",
        "approved",
        "declined",
        "referred",
        "in_support",
        "follow_up",
        "closed",
      ],
      content_status: ["draft", "review", "approved", "published", "archived"],
      delivery_status: [
        "requested",
        "assigned",
        "pickup_en_route",
        "arrived_for_pickup",
        "package_collected",
        "in_transit",
        "arrived_at_destination",
        "delivered",
        "failed_delivery",
        "cancelled",
      ],
      driver_status: [
        "pending_verification",
        "approved",
        "rejected",
        "active",
        "suspended",
        "offline",
      ],
      order_status: [
        "placed",
        "payment_confirmed",
        "processing",
        "fulfilled",
        "cancelled",
      ],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      ride_status: [
        "requested",
        "searching_driver",
        "driver_assigned",
        "driver_en_route",
        "driver_arrived",
        "trip_started",
        "trip_completed",
        "payment_pending",
        "payment_completed",
        "cancelled_by_customer",
        "cancelled_by_driver",
        "cancelled_by_system",
        "disputed",
      ],
      travel_enrolment_status: [
        "enrolled",
        "documents_pending",
        "documents_verified",
        "payment_in_progress",
        "confirmed",
        "completed",
        "cancelled",
      ],
      volunteer_application_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      wallet_transaction_type: [
        "top_up",
        "ride_payment",
        "delivery_payment",
        "refund",
        "promo_credit",
        "incentive_payout",
        "adjustment",
      ],
    },
  },
} as const
