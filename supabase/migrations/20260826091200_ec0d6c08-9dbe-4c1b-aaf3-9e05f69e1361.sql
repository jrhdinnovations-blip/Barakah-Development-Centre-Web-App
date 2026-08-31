-- ============ PHASE 4 — SWIFT MOVE (CORE RIDE-HAILING) ============

-- 1. Roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'swift_dispatcher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'swift_manager';

-- Swift dispatchers/managers count as staff (compare as text: new enum values can't be used in the same transaction)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND status = 'active'
      AND role::text IN ('administrator','programme_officer','content_editor','swift_dispatcher','swift_manager')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_swift_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND status = 'active'
      AND role::text IN ('administrator','swift_dispatcher','swift_manager')
  )
$function$;

-- 2. Enums
CREATE TYPE public.driver_status AS ENUM ('pending_verification','approved','rejected','active','suspended','offline');
CREATE TYPE public.ride_status AS ENUM ('requested','searching_driver','driver_assigned','driver_en_route','driver_arrived','trip_started','trip_completed','payment_pending','payment_completed','cancelled_by_customer','cancelled_by_driver','cancelled_by_system','disputed');

-- 3. Financial separation: rides pay through the shared payments table
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_entity_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_entity_type_check
  CHECK (entity_type IN ('booking','order','travel_instalment','donation','swift_ride'));

INSERT INTO public.legal_entities (name, registration_number, description, status)
SELECT 'Swift Move', NULL, 'Ride-hailing and mobility services within the Barakah ecosystem.', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.legal_entities WHERE name = 'Swift Move');

-- 4. Service types (Swift Ride only this phase)
CREATE TABLE public.service_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  capacity int not null default 4,
  icon text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT ON public.service_types TO anon, authenticated;
GRANT ALL ON public.service_types TO service_role;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active service types" ON public.service_types FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Swift staff manage service types" ON public.service_types FOR ALL TO authenticated USING (public.is_swift_staff(auth.uid())) WITH CHECK (public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_service_types_updated_at BEFORE UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_types (code, name, description, capacity, icon)
VALUES ('swift_ride', 'Swift Ride', 'Standard private ride for up to 4 passengers.', 4, 'car');

-- 5. Pricing rules
CREATE TABLE public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid not null references public.service_types(id) on delete cascade,
  base_fare_kobo bigint not null default 0,
  min_fare_kobo bigint not null default 0,
  per_km_kobo bigint not null default 0,
  per_minute_kobo bigint not null default 0,
  waiting_per_minute_kobo bigint not null default 0,
  booking_fee_kobo bigint not null default 0,
  cancellation_fee_kobo bigint not null default 0,
  cancellation_grace_minutes int not null default 5,
  commission_percent numeric(5,2) not null default 15,
  currency text not null default 'NGN',
  surge_multiplier numeric(4,2) not null default 1,
  status text not null default 'active' check (status in ('active','archived')),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read active pricing" ON public.pricing_rules FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY "Swift staff manage pricing" ON public.pricing_rules FOR ALL TO authenticated USING (public.is_swift_staff(auth.uid())) WITH CHECK (public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_rules (service_type_id, base_fare_kobo, min_fare_kobo, per_km_kobo, per_minute_kobo, waiting_per_minute_kobo, booking_fee_kobo, cancellation_fee_kobo, cancellation_grace_minutes, commission_percent)
SELECT id, 50000, 80000, 15000, 3000, 2000, 10000, 50000, 5, 15 FROM public.service_types WHERE code = 'swift_ride';

-- 6. Saved locations
CREATE TABLE public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_locations TO authenticated;
GRANT ALL ON public.saved_locations TO service_role;
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved locations" ON public.saved_locations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_saved_locations_updated_at BEFORE UPDATE ON public.saved_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Drivers
CREATE TABLE public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  photo_url text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  bank_name text,
  account_number text,
  account_name text,
  status public.driver_status not null default 'pending_verification',
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  location_updated_at timestamptz,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  staff_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers read own record" ON public.drivers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users apply as driver" ON public.drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Drivers update own limited, swift staff update all" ON public.drivers FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_swift_staff(auth.uid()));
CREATE POLICY "Swift staff read all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  document_type text not null check (document_type in ('id_card','drivers_licence','photo','other')),
  document_id uuid not null references public.documents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.driver_documents TO authenticated;
GRANT ALL ON public.driver_documents TO service_role;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers manage own documents, swift staff all" ON public.driver_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_driver_documents_updated_at BEFORE UPDATE ON public.driver_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Vehicles
CREATE TABLE public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  make text not null,
  model text not null,
  year int,
  colour text,
  plate_number text not null unique,
  inspection_status text not null default 'pending' check (inspection_status in ('pending','passed','failed')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers manage own vehicles, swift staff all" ON public.vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('registration','insurance','inspection')),
  document_id uuid not null references public.documents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers manage own vehicle docs, swift staff all" ON public.vehicle_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v JOIN public.drivers d ON d.id = v.driver_id WHERE v.id = vehicle_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v JOIN public.drivers d ON d.id = v.driver_id WHERE v.id = vehicle_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_vehicle_documents_updated_at BEFORE UPDATE ON public.vehicle_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
CREATE UNIQUE INDEX one_active_vehicle_per_driver ON public.driver_vehicle_assignments (driver_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.driver_vehicle_assignments TO authenticated;
GRANT ALL ON public.driver_vehicle_assignments TO service_role;
ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers manage own assignments, swift staff all" ON public.driver_vehicle_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_dva_updated_at BEFORE UPDATE ON public.driver_vehicle_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Ride requests & dispatch offers
CREATE TABLE public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  service_type_id uuid not null references public.service_types(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  estimated_distance_km numeric(8,2),
  estimated_duration_min numeric(8,1),
  estimated_fare_kobo bigint,
  currency text not null default 'NGN',
  status text not null default 'matching' check (status in ('matching','matched','cancelled_by_customer','cancelled_by_system','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.ride_requests TO authenticated;
GRANT ALL ON public.ride_requests TO service_role;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read own requests" ON public.ride_requests FOR SELECT TO authenticated USING (auth.uid() = customer_id OR public.is_swift_staff(auth.uid()));
CREATE POLICY "Customers create own requests" ON public.ride_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers cancel own, swift staff update all" ON public.ride_requests FOR UPDATE TO authenticated USING (auth.uid() = customer_id OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_ride_requests_updated_at BEFORE UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers see own offers, swift staff all" ON public.ride_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE POLICY "Drivers respond to own offers" ON public.ride_offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_ride_offers_updated_at BEFORE UPDATE ON public.ride_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Rides
CREATE TABLE public.rides (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ride_requests(id),
  customer_id uuid not null references auth.users(id),
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  service_type_id uuid not null references public.service_types(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  verification_pin text not null,
  share_token uuid not null default gen_random_uuid(),
  status public.ride_status not null default 'driver_assigned',
  accepted_at timestamptz not null default now(),
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  final_distance_km numeric(8,2),
  final_duration_min numeric(8,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ride participants read" ON public.rides FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE POLICY "Participants or staff update ride" ON public.rides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR auth.uid() = customer_id OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ride_status_history (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  from_status public.ride_status,
  to_status public.ride_status not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.ride_status_history TO authenticated;
GRANT ALL ON public.ride_status_history TO service_role;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read ride history" ON public.ride_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = r.driver_id AND d.user_id = auth.uid()))) OR public.is_swift_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_ride_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ride_status_history (ride_id, from_status, to_status, actor_id)
    VALUES (NEW.id, CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_ride_status AFTER INSERT OR UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.log_ride_status();

-- 11. Live locations
CREATE TABLE public.ride_locations (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  lat double precision not null,
  lng double precision not null,
  heading numeric(6,2),
  recorded_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.ride_locations TO authenticated;
GRANT ALL ON public.ride_locations TO service_role;
ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver logs own locations" ON public.ride_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Participants read ride locations" ON public.ride_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = r.driver_id AND d.user_id = auth.uid()))) OR public.is_swift_staff(auth.uid()));

-- 12. Fares
CREATE TABLE public.ride_fares (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides(id) on delete cascade,
  estimated_total_kobo bigint,
  base_kobo bigint not null default 0,
  distance_kobo bigint not null default 0,
  time_kobo bigint not null default 0,
  waiting_kobo bigint not null default 0,
  booking_fee_kobo bigint not null default 0,
  cancellation_fee_kobo bigint not null default 0,
  total_kobo bigint not null default 0,
  distance_km numeric(8,2),
  duration_min numeric(8,1),
  currency text not null default 'NGN',
  kind text not null default 'final' check (kind in ('estimate','final','cancellation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.ride_fares TO authenticated;
GRANT ALL ON public.ride_fares TO service_role;
ALTER TABLE public.ride_fares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read fare" ON public.ride_fares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = r.driver_id AND d.user_id = auth.uid()))) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_ride_fares_updated_at BEFORE UPDATE ON public.ride_fares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Ride payments / earnings / commissions
CREATE TABLE public.ride_payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  payment_id uuid references public.payments(id),
  method text not null default 'gateway' check (method in ('gateway','cash_manual')),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.ride_payments TO authenticated;
GRANT ALL ON public.ride_payments TO service_role;
ALTER TABLE public.ride_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read ride payment" ON public.ride_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = r.driver_id AND d.user_id = auth.uid()))) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_ride_payments_updated_at BEFORE UPDATE ON public.ride_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  ride_id uuid not null references public.rides(id) on delete cascade,
  gross_kobo bigint not null,
  commission_kobo bigint not null,
  net_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.driver_earnings TO authenticated;
GRANT ALL ON public.driver_earnings TO service_role;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers read own earnings, swift staff read all" ON public.driver_earnings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_driver_earnings_updated_at BEFORE UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.commissions (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  rate_percent numeric(5,2) not null,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Swift staff read commissions" ON public.commissions FOR SELECT TO authenticated USING (public.is_swift_staff(auth.uid()));

-- 14. Ratings
CREATE TABLE public.driver_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  customer_id uuid not null references auth.users(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  UNIQUE (ride_id, customer_id)
);
GRANT SELECT, INSERT ON public.driver_ratings TO authenticated;
GRANT ALL ON public.driver_ratings TO service_role;
ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers rate own rides" ON public.driver_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Participants and staff read driver ratings" ON public.driver_ratings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_driver_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.drivers d SET
    rating_avg = sub.avg_stars,
    rating_count = sub.cnt
  FROM (SELECT driver_id, AVG(stars)::numeric(3,2) AS avg_stars, COUNT(*)::int AS cnt FROM public.driver_ratings GROUP BY driver_id) sub
  WHERE d.id = sub.driver_id AND d.id = NEW.driver_id;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_driver_rating AFTER INSERT ON public.driver_ratings FOR EACH ROW EXECUTE FUNCTION public.update_driver_rating();

CREATE TABLE public.customer_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  customer_id uuid not null references auth.users(id),
  driver_id uuid not null references public.drivers(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  UNIQUE (ride_id, driver_id)
);
GRANT SELECT, INSERT ON public.customer_ratings TO authenticated;
GRANT ALL ON public.customer_ratings TO service_role;
ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers rate own ride customers" ON public.customer_ratings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Participants and staff read customer ratings" ON public.customer_ratings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.is_swift_staff(auth.uid()));

-- 15. Safety: incident reports + shared trip view
CREATE TABLE public.ride_reports (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  category text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.ride_reports TO authenticated;
GRANT ALL ON public.ride_reports TO service_role;
ALTER TABLE public.ride_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters create reports" ON public.ride_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporter and swift staff read reports" ON public.ride_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_swift_staff(auth.uid()));
CREATE POLICY "Swift staff update reports" ON public.ride_reports FOR UPDATE TO authenticated USING (public.is_swift_staff(auth.uid()));
CREATE TRIGGER update_ride_reports_updated_at BEFORE UPDATE ON public.ride_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_shared_ride(_token uuid)
RETURNS TABLE (
  status public.ride_status,
  pickup_address text,
  destination_address text,
  driver_name text,
  vehicle_description text,
  plate_number text,
  driver_lat double precision,
  driver_lng double precision,
  ended boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT r.status, r.pickup_address, r.destination_address,
         d.full_name,
         trim(concat_ws(' ', v.colour, v.make, v.model)),
         v.plate_number,
         loc.lat, loc.lng,
         (r.status IN ('trip_completed','payment_completed','cancelled_by_customer','cancelled_by_driver','cancelled_by_system')) AS ended
  FROM public.rides r
  JOIN public.drivers d ON d.id = r.driver_id
  LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
  LEFT JOIN LATERAL (
    SELECT lat, lng FROM public.ride_locations rl WHERE rl.ride_id = r.id ORDER BY recorded_at DESC LIMIT 1
  ) loc ON true
  WHERE r.share_token = _token;
$function$;
GRANT EXECUTE ON FUNCTION public.get_shared_ride(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_swift_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_swift_staff(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_ride_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ride_status() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_driver_rating() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_driver_rating() TO authenticated, service_role;