import { Database as SupabaseDatabase } from '@/integrations/supabase/types';

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type DeliveryStatus = string;
export type BookingStatus = string;

export type Database = SupabaseDatabase;

// Convenience Helper Types for React Components
export type SwiftDelivery = SupabaseDatabase['public']['Tables']['swift_deliveries']['Row']
export type InsertSwiftDelivery = SupabaseDatabase['public']['Tables']['swift_deliveries']['Insert']

export type VehicleHireBooking = SupabaseDatabase['public']['Tables']['vehicle_hire_bookings']['Row']
export type InsertVehicleHireBooking = SupabaseDatabase['public']['Tables']['vehicle_hire_bookings']['Insert']