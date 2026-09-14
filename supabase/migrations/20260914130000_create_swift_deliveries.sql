-- ============================================================
-- Migration: Create swift_deliveries table
-- Purpose:   Stores parcel dispatch orders for SwiftMove Logistics
-- ============================================================

CREATE TABLE IF NOT EXISTS public.swift_deliveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  pickup_address    TEXT        NOT NULL,
  dropoff_address   TEXT        NOT NULL,

  package_type      TEXT        NOT NULL DEFAULT 'Standard Parcel',
  weight_kg         NUMERIC(6,2) NOT NULL DEFAULT 1,
  distance_km       NUMERIC(8,2) NOT NULL DEFAULT 0,
  estimated_price   NUMERIC(12,2) NOT NULL DEFAULT 0,

  payment_reference TEXT        NULL,

  -- Status lifecycle:
  -- pending → accepted → picked_up → delivered
  -- cancelled (from pending only)
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled')),

  -- Driver GPS coordinates (updated in real-time by driver app)
  driver_lat        DOUBLE PRECISION NULL,
  driver_lng        DOUBLE PRECISION NULL,

  -- Customer rating after delivery
  rating            SMALLINT    NULL CHECK (rating BETWEEN 1 AND 5),
  rating_note       TEXT        NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS swift_deliveries_customer_id_idx ON public.swift_deliveries (customer_id);
CREATE INDEX IF NOT EXISTS swift_deliveries_driver_id_idx  ON public.swift_deliveries (driver_id);
CREATE INDEX IF NOT EXISTS swift_deliveries_status_idx     ON public.swift_deliveries (status);
CREATE INDEX IF NOT EXISTS swift_deliveries_created_at_idx ON public.swift_deliveries (created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_swift_deliveries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_swift_deliveries_updated_at ON public.swift_deliveries;
CREATE TRIGGER trg_swift_deliveries_updated_at
  BEFORE UPDATE ON public.swift_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_swift_deliveries_updated_at();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.swift_deliveries ENABLE ROW LEVEL SECURITY;

-- Customers can see their own orders
CREATE POLICY "customer_select_own_deliveries"
  ON public.swift_deliveries FOR SELECT
  USING (auth.uid() = customer_id);

-- Customers can insert their own orders
CREATE POLICY "customer_insert_own_deliveries"
  ON public.swift_deliveries FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Customers can cancel their own pending orders
CREATE POLICY "customer_cancel_own_pending_delivery"
  ON public.swift_deliveries FOR UPDATE
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Assigned driver can see their deliveries
CREATE POLICY "driver_select_assigned_delivery"
  ON public.swift_deliveries FOR SELECT
  USING (auth.uid() = driver_id);

-- Driver can update location and status on their assigned delivery
CREATE POLICY "driver_update_assigned_delivery"
  ON public.swift_deliveries FOR UPDATE
  USING (auth.uid() = driver_id);

-- Admin / swift roles bypass RLS
-- Valid app_role enum values: administrator, swift_dispatcher, swift_manager, driver, etc.
CREATE POLICY "staff_admin_all_deliveries"
  ON public.swift_deliveries FOR ALL
  USING (
    public.has_role(auth.uid(), 'administrator')
    OR public.has_role(auth.uid(), 'swift_dispatcher')
    OR public.has_role(auth.uid(), 'swift_manager')
  );

-- ── Realtime publication ─────────────────────────────────────
-- Ensures the table is included in Supabase Realtime broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE public.swift_deliveries;
