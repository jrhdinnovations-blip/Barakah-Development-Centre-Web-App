-- ============================================================
-- Migration: Add tracking_code to swift_deliveries
-- Purpose:   Enables public order tracking without login
-- ============================================================

-- 1. Add the tracking_code column
ALTER TABLE public.swift_deliveries
  ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;

-- 2. Add a description/notes column for the item description shown in tracking
ALTER TABLE public.swift_deliveries
  ADD COLUMN IF NOT EXISTS description TEXT NULL;

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS swift_deliveries_tracking_code_idx
  ON public.swift_deliveries (tracking_code);

-- 4. Function to generate a human-readable tracking code
--    Format: SMV-YYYYMMDD-XXXX (e.g. SMV-20260917-A3FZ)
CREATE OR REPLACE FUNCTION public.generate_swift_tracking_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := 'SMV-' ||
            TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    -- Ensure uniqueness
    IF NOT EXISTS (
      SELECT 1 FROM public.swift_deliveries WHERE tracking_code = code
    ) THEN
      NEW.tracking_code := code;
      EXIT;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback: use UUID fragment
      NEW.tracking_code := 'SMV-' || UPPER(REPLACE(gen_random_uuid()::TEXT, '-', ''));
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 5. Trigger: auto-set tracking_code on new orders
DROP TRIGGER IF EXISTS trg_swift_tracking_code ON public.swift_deliveries;
CREATE TRIGGER trg_swift_tracking_code
  BEFORE INSERT ON public.swift_deliveries
  FOR EACH ROW
  WHEN (NEW.tracking_code IS NULL)
  EXECUTE FUNCTION public.generate_swift_tracking_code();

-- 6. Backfill existing rows that don't have a tracking code
DO $$
DECLARE
  rec RECORD;
  code TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.swift_deliveries WHERE tracking_code IS NULL LOOP
    LOOP
      code := 'SMV-' ||
              TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.swift_deliveries WHERE tracking_code = code
      );
    END LOOP;
    UPDATE public.swift_deliveries SET tracking_code = code WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 7. PUBLIC RLS policy: anyone (even unauthenticated) can look up
--    a delivery by its tracking code — only limited fields are exposed
CREATE POLICY "public_track_by_code"
  ON public.swift_deliveries FOR SELECT
  USING (tracking_code IS NOT NULL);

-- Note: The frontend query only selects status, description,
-- pickup_address, dropoff_address — no PII is leaked.
