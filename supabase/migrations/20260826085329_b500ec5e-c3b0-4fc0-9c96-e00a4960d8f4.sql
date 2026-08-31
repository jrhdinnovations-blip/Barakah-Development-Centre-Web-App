-- ===== PAYMENTS FOUNDATION =====
CREATE TABLE public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  legal_entity_id uuid references public.legal_entities(id),
  programme_id uuid references public.programmes(id),
  payer_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  description text not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'open' check (status in ('open','paid','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payers see own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = payer_id);
CREATE POLICY "Staff manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id),
  legal_entity_id uuid references public.legal_entities(id),
  programme_id uuid references public.programmes(id),
  payer_id uuid not null references auth.users(id),
  entity_type text not null check (entity_type in ('booking','order','travel_instalment','donation')),
  entity_id uuid,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  gateway text not null default 'paystack',
  gateway_ref text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payers see own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = payer_id);
CREATE POLICY "Payers create own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = payer_id);
CREATE POLICY "Staff manage payments" ON public.payments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  payment_id uuid not null references public.payments(id) on delete cascade,
  issued_to uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients see own receipts" ON public.receipts FOR SELECT TO authenticated USING (auth.uid() = issued_to);
CREATE POLICY "Staff manage receipts" ON public.receipts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text,
  status text not null default 'requested' check (status in ('requested','approved','processed','declined')),
  requested_by uuid not null references auth.users(id),
  processed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requesters see own refunds" ON public.refunds FOR SELECT TO authenticated USING (auth.uid() = requested_by);
CREATE POLICY "Staff manage refunds" ON public.refunds FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gateway text not null,
  token_ref text not null,
  label text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payment methods" ON public.payment_methods FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- paid bookings support
ALTER TABLE public.booking_services ADD COLUMN IF NOT EXISTS price_kobo bigint;
ALTER TABLE public.booking_services ADD COLUMN IF NOT EXISTS currency text not null default 'NGN';

-- ===== TRAVEL / PILGRIMAGE =====
CREATE TABLE public.travel_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  body text,
  provider_name text,
  provider_notes text,
  itinerary text,
  starts_on date,
  ends_on date,
  price_kobo bigint not null default 0,
  currency text not null default 'NGN',
  legal_entity_id uuid references public.legal_entities(id),
  programme_id uuid references public.programmes(id),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT ON public.travel_packages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.travel_packages TO authenticated;
GRANT ALL ON public.travel_packages TO service_role;
ALTER TABLE public.travel_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published packages" ON public.travel_packages FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Staff manage packages" ON public.travel_packages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.travel_enrolments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.travel_packages(id),
  user_id uuid not null references auth.users(id),
  status public.travel_enrolment_status not null default 'enrolled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (package_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.travel_enrolments TO authenticated;
GRANT ALL ON public.travel_enrolments TO service_role;
ALTER TABLE public.travel_enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own enrolments" ON public.travel_enrolments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users enrol themselves" ON public.travel_enrolments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage enrolments" ON public.travel_enrolments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.passenger_details (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.travel_enrolments(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  passport_number text,
  passport_expiry date,
  next_of_kin_name text,
  next_of_kin_phone text,
  medical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.passenger_details TO authenticated;
GRANT ALL ON public.passenger_details TO service_role;
ALTER TABLE public.passenger_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own passenger details" ON public.passenger_details FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.travel_enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.travel_enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid()));
CREATE POLICY "Staff manage passenger details" ON public.passenger_details FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.travel_enrolments(id) on delete cascade,
  total_kobo bigint not null check (total_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own plans" ON public.payment_plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.travel_enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid()));
CREATE POLICY "Staff manage plans" ON public.payment_plans FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payment_plan_instalments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  label text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  due_date date not null,
  payment_id uuid references public.payments(id),
  status text not null default 'due' check (status in ('due','paid','overdue','waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_plan_instalments TO authenticated;
GRANT ALL ON public.payment_plan_instalments TO service_role;
ALTER TABLE public.payment_plan_instalments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own instalments" ON public.payment_plan_instalments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_plans p JOIN public.travel_enrolments e ON e.id = p.enrolment_id WHERE p.id = plan_id AND e.user_id = auth.uid()));
CREATE POLICY "Staff manage instalments" ON public.payment_plan_instalments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== MARKETPLACE =====
CREATE TABLE public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.product_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage categories" ON public.product_categories FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id),
  slug text not null unique,
  title text not null,
  description text,
  image_url text,
  price_kobo bigint not null default 0,
  currency text not null default 'NGN',
  is_digital boolean not null default false,
  stock_quantity integer,
  legal_entity_id uuid references public.legal_entities(id),
  programme_id uuid references public.programmes(id),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published products" ON public.products FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Staff manage products" ON public.products FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id),
  status public.order_status not null default 'placed',
  total_kobo bigint not null default 0,
  currency text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price_kobo bigint not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Users add own order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Staff manage order items" ON public.order_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== HUMANITARIAN CASE MANAGEMENT (strict) =====
CREATE OR REPLACE FUNCTION public.is_case_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND status = 'active'
      AND role IN ('case_officer','administrator')
  )
$$;

CREATE TABLE public.assistance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  programme_id uuid references public.programmes(id),
  need_summary text not null,
  circumstances text,
  assigned_to uuid,
  status public.case_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.assistance_requests TO authenticated;
GRANT ALL ON public.assistance_requests TO service_role;
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester sees own case" ON public.assistance_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Requester creates own case" ON public.assistance_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Assigned officer or admin sees case" ON public.assistance_requests FOR SELECT TO authenticated
  USING (auth.uid() = assigned_to OR public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "Case staff manage cases" ON public.assistance_requests FOR UPDATE TO authenticated
  USING (public.is_case_staff(auth.uid()))
  WITH CHECK (public.is_case_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_access_case(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assistance_requests r
    WHERE r.id = _case_id AND (r.user_id = _user_id OR r.assigned_to = _user_id)
  ) OR public.has_role(_user_id, 'administrator')
$$;

CREATE TABLE public.case_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assistance_requests(id) on delete cascade,
  assessor_id uuid not null references auth.users(id),
  notes text not null,
  recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_assessments TO authenticated;
GRANT ALL ON public.case_assessments TO service_role;
ALTER TABLE public.case_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case staff read assessments" ON public.case_assessments FOR SELECT TO authenticated
  USING (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));
CREATE POLICY "Case staff write assessments" ON public.case_assessments FOR INSERT TO authenticated
  WITH CHECK (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));
CREATE POLICY "Case staff update assessments" ON public.case_assessments FOR UPDATE TO authenticated
  USING (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));

CREATE TABLE public.case_eligibility (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assistance_requests(id) on delete cascade,
  determined_by uuid not null references auth.users(id),
  eligible boolean not null,
  criteria_notes text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.case_eligibility TO authenticated;
GRANT ALL ON public.case_eligibility TO service_role;
ALTER TABLE public.case_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case staff read eligibility" ON public.case_eligibility FOR SELECT TO authenticated
  USING (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));
CREATE POLICY "Case staff write eligibility" ON public.case_eligibility FOR INSERT TO authenticated
  WITH CHECK (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));

CREATE TABLE public.case_referrals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assistance_requests(id) on delete cascade,
  referred_by uuid not null references auth.users(id),
  referred_to text not null,
  reason text,
  status text not null default 'open' check (status in ('open','accepted','declined','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_referrals TO authenticated;
GRANT ALL ON public.case_referrals TO service_role;
ALTER TABLE public.case_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case staff read referrals" ON public.case_referrals FOR SELECT TO authenticated
  USING (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));
CREATE POLICY "Case staff write referrals" ON public.case_referrals FOR ALL TO authenticated
  USING (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()))
  WITH CHECK (public.is_case_staff(auth.uid()) AND public.can_access_case(case_id, auth.uid()));

CREATE TABLE public.case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assistance_requests(id) on delete cascade,
  from_status public.case_status,
  to_status public.case_status not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.case_status_history TO authenticated;
GRANT ALL ON public.case_status_history TO service_role;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case-scoped read" ON public.case_status_history FOR SELECT TO authenticated USING (public.can_access_case(case_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.log_case_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_status_history (case_id, from_status, to_status, actor_id)
    VALUES (NEW.id, CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_case_status AFTER INSERT OR UPDATE ON public.assistance_requests FOR EACH ROW EXECUTE FUNCTION public.log_case_status();

-- ===== VOLUNTEER MANAGEMENT =====
CREATE TABLE public.volunteer_opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  commitment text,
  location text,
  is_remote boolean not null default false,
  programme_id uuid references public.programmes(id),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT ON public.volunteer_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE ON public.volunteer_opportunities TO authenticated;
GRANT ALL ON public.volunteer_opportunities TO service_role;
ALTER TABLE public.volunteer_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published opportunities" ON public.volunteer_opportunities FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Staff manage opportunities" ON public.volunteer_opportunities FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  skills text[],
  availability text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.volunteers TO authenticated;
GRANT ALL ON public.volunteers TO service_role;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own volunteer profile" ON public.volunteers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff read volunteer profiles" ON public.volunteers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.volunteer_opportunities(id),
  user_id uuid not null references auth.users(id),
  message text,
  status public.volunteer_application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (opportunity_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.volunteer_applications TO authenticated;
GRANT ALL ON public.volunteer_applications TO service_role;
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own volunteer applications" ON public.volunteer_applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users apply themselves" ON public.volunteer_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage volunteer applications" ON public.volunteer_applications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.volunteer_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.volunteer_applications(id) on delete cascade unique,
  user_id uuid not null references auth.users(id),
  opportunity_id uuid not null references public.volunteer_opportunities(id),
  status text not null default 'active' check (status in ('active','completed','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.volunteer_assignments TO authenticated;
GRANT ALL ON public.volunteer_assignments TO service_role;
ALTER TABLE public.volunteer_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own assignments" ON public.volunteer_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff manage assignments" ON public.volunteer_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.volunteer_assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0),
  note text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.volunteer_hours TO authenticated;
GRANT ALL ON public.volunteer_hours TO service_role;
ALTER TABLE public.volunteer_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Volunteers log own hours" ON public.volunteer_hours FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff verify hours" ON public.volunteer_hours FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- updated_at triggers for new tables
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_travel_packages_updated_at BEFORE UPDATE ON public.travel_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_travel_enrolments_updated_at BEFORE UPDATE ON public.travel_enrolments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_passenger_details_updated_at BEFORE UPDATE ON public.passenger_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_instalments_updated_at BEFORE UPDATE ON public.payment_plan_instalments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assistance_requests_updated_at BEFORE UPDATE ON public.assistance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_case_assessments_updated_at BEFORE UPDATE ON public.case_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_case_referrals_updated_at BEFORE UPDATE ON public.case_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_volunteer_opportunities_updated_at BEFORE UPDATE ON public.volunteer_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_volunteers_updated_at BEFORE UPDATE ON public.volunteers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_volunteer_applications_updated_at BEFORE UPDATE ON public.volunteer_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_volunteer_assignments_updated_at BEFORE UPDATE ON public.volunteer_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_volunteer_hours_updated_at BEFORE UPDATE ON public.volunteer_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();