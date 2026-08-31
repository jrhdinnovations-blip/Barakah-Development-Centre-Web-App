-- Phase 5: Swift Move expansion (delivery, service types, corporate, scheduled rides, promotions, wallet, incentives, zones/surge)

create type public.delivery_status as enum ('requested','assigned','pickup_en_route','arrived_for_pickup','package_collected','in_transit','arrived_at_destination','delivered','failed_delivery','cancelled');
create type public.wallet_transaction_type as enum ('top_up','ride_payment','delivery_payment','refund','promo_credit','incentive_payout','adjustment');

alter table public.payments drop constraint if exists payments_entity_type_check;
alter table public.payments add constraint payments_entity_type_check check (entity_type = any (array['booking','order','travel_instalment','donation','swift_ride','swift_delivery','wallet_topup','corporate_invoice']));

alter table public.drivers add column accepts_deliveries boolean not null default true;
alter table public.vehicles add column vehicle_class text not null default 'standard';
alter table public.vehicles add constraint vehicles_vehicle_class_check check (vehicle_class in ('standard','comfort','xl'));
alter table public.ride_requests add column promotion_id uuid;
alter table public.ride_requests add column discount_kobo bigint not null default 0;
alter table public.ride_requests add column corporate_account_id uuid;
alter table public.ride_payments add column corporate_account_id uuid;
alter table public.driver_earnings add column kind text not null default 'ride';
alter table public.driver_earnings add column notes text;

-- Platform feature toggles
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- New service types
insert into public.service_types (code, name, description, capacity, status) values
  ('swift_delivery', 'Swift Delivery', 'Door-to-door package delivery across the city.', 0, 'active'),
  ('swift_comfort', 'Swift Comfort', 'Newer, higher-comfort vehicles for a smoother ride.', 4, 'active'),
  ('swift_xl', 'Swift XL', 'Larger vehicles for groups and extra luggage.', 6, 'active'),
  ('swift_business', 'Swift Business', 'Rides billed to your corporate account.', 4, 'active')
on conflict do nothing;

insert into public.pricing_rules (service_type_id, base_fare_kobo, min_fare_kobo, per_km_kobo, per_minute_kobo, waiting_per_minute_kobo, booking_fee_kobo, cancellation_fee_kobo, cancellation_grace_minutes, commission_percent, currency, status)
select st.id, v.base, v.minf, v.km, v.min, v.wait, v.fee, v.cancel, 5, v.commission, 'NGN', 'active'
from public.service_types st
join (values
  ('swift_delivery', 80000::bigint, 80000::bigint, 12000::bigint, 2000::bigint, 3000::bigint, 10000::bigint, 50000::bigint, 15::numeric),
  ('swift_comfort', 150000::bigint, 150000::bigint, 20000::bigint, 3500::bigint, 4000::bigint, 15000::bigint, 75000::bigint, 15::numeric),
  ('swift_xl', 180000::bigint, 180000::bigint, 24000::bigint, 4000::bigint, 4000::bigint, 15000::bigint, 90000::bigint, 15::numeric),
  ('swift_business', 160000::bigint, 160000::bigint, 21000::bigint, 3500::bigint, 4000::bigint, 0::bigint, 0::bigint, 15::numeric)
) as v(code, base, minf, km, min, wait, fee, cancel, commission) on v.code = st.code
where not exists (select 1 from public.pricing_rules pr where pr.service_type_id = st.id);

-- Delivery tables
create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  service_type_id uuid references public.service_types(id),
  driver_id uuid references public.drivers(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  recipient_name text not null,
  recipient_phone text not null,
  package_category text not null,
  package_size text not null default 'small',
  package_weight_kg numeric,
  package_photo_document_id uuid,
  speed text not null default 'standard' check (speed in ('standard','express')),
  estimated_distance_km numeric,
  estimated_price_kobo bigint,
  final_price_kobo bigint,
  discount_kobo bigint not null default 0,
  promotion_id uuid,
  corporate_account_id uuid,
  currency text not null default 'NGN',
  status public.delivery_status not null default 'requested',
  requested_at timestamptz not null default now(),
  assigned_at timestamptz,
  collected_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.delivery_offers (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.delivery_orders(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz
);
create table public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.delivery_orders(id) on delete cascade,
  from_status public.delivery_status,
  to_status public.delivery_status not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create table public.delivery_proof (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.delivery_orders(id) on delete cascade,
  recipient_name text not null,
  signature_url text,
  photo_url text,
  otp_verified boolean not null default false,
  delivered_lat double precision,
  delivered_lng double precision,
  delivered_at timestamptz not null default now(),
  created_by uuid
);
create table public.scheduled_rides (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  service_type_id uuid references public.service_types(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  scheduled_for timestamptz not null,
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekdays','weekly')),
  recurrence_until date,
  lead_minutes integer not null default 60,
  status text not null default 'scheduled' check (status in ('scheduled','dispatched','cancelled','completed')),
  generated_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  kind text not null check (kind in ('percent','fixed')),
  value numeric not null,
  applies_to text not null default 'both' check (applies_to in ('ride','delivery','both')),
  service_type_codes text[],
  min_fare_kobo bigint not null default 0,
  max_redemptions integer,
  per_user_limit integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'active' check (status in ('active','paused','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  user_id uuid not null,
  ride_id uuid,
  delivery_id uuid,
  discount_kobo bigint not null,
  created_at timestamptz not null default now()
);
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'active' check (status in ('active','frozen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type public.wallet_transaction_type not null,
  amount_kobo bigint not null,
  payment_id uuid references public.payments(id),
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.corporate_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  contact_phone text,
  legal_entity_id uuid references public.legal_entities(id),
  monthly_cap_kobo bigint,
  status text not null default 'pending' check (status in ('pending','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.corporate_employees (
  id uuid primary key default gen_random_uuid(),
  corporate_account_id uuid not null references public.corporate_accounts(id) on delete cascade,
  user_id uuid,
  invited_email text not null,
  role text not null default 'employee' check (role in ('admin','employee')),
  spending_limit_kobo bigint,
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (corporate_account_id, invited_email)
);
create table public.corporate_spending_limits (
  id uuid primary key default gen_random_uuid(),
  corporate_account_id uuid not null references public.corporate_accounts(id) on delete cascade,
  employee_id uuid references public.corporate_employees(id) on delete cascade,
  period text not null default 'monthly' check (period in ('monthly','total')),
  limit_kobo bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.corporate_invoices (
  id uuid primary key default gen_random_uuid(),
  corporate_account_id uuid not null references public.corporate_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_kobo bigint not null default 0,
  status text not null default 'draft' check (status in ('draft','issued','paid','disputed')),
  generated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.driver_incentives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  metric text not null check (metric in ('trips_completed','deliveries_completed')),
  threshold integer not null,
  reward_kobo bigint not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.incentive_progress (
  id uuid primary key default gen_random_uuid(),
  incentive_id uuid not null references public.driver_incentives(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  progress integer not null default 0,
  completed boolean not null default false,
  awarded boolean not null default false,
  awarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incentive_id, driver_id)
);
create table public.pricing_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric not null default 5,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create table public.surge_events (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.pricing_zones(id) on delete cascade,
  multiplier numeric not null check (multiplier >= 1 and multiplier <= 5),
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Grants
grant select on public.platform_settings to anon, authenticated;
grant all on public.platform_settings to service_role;
grant select, insert, update on public.delivery_orders to authenticated;
grant all on public.delivery_orders to service_role;
grant select, insert, update on public.delivery_offers to authenticated;
grant all on public.delivery_offers to service_role;
grant select on public.delivery_status_history to authenticated;
grant all on public.delivery_status_history to service_role;
grant select, insert on public.delivery_proof to authenticated;
grant all on public.delivery_proof to service_role;
grant select, insert, update, delete on public.scheduled_rides to authenticated;
grant all on public.scheduled_rides to service_role;
grant select, insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;
grant select, insert, update on public.promotion_redemptions to authenticated;
grant all on public.promotion_redemptions to service_role;
grant select, insert on public.wallets to authenticated;
grant all on public.wallets to service_role;
grant select, insert on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
grant select, insert, update on public.corporate_accounts to authenticated;
grant all on public.corporate_accounts to service_role;
grant select, insert, update, delete on public.corporate_employees to authenticated;
grant all on public.corporate_employees to service_role;
grant select, insert, update, delete on public.corporate_spending_limits to authenticated;
grant all on public.corporate_spending_limits to service_role;
grant select, insert, update on public.corporate_invoices to authenticated;
grant all on public.corporate_invoices to service_role;
grant select, insert, update, delete on public.driver_incentives to authenticated;
grant all on public.driver_incentives to service_role;
grant select on public.incentive_progress to authenticated;
grant all on public.incentive_progress to service_role;
grant select, insert, update, delete on public.pricing_zones to authenticated;
grant all on public.pricing_zones to service_role;
grant select, insert, update on public.surge_events to authenticated;
grant all on public.surge_events to service_role;

-- RLS
alter table public.platform_settings enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_offers enable row level security;
alter table public.delivery_status_history enable row level security;
alter table public.delivery_proof enable row level security;
alter table public.scheduled_rides enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.corporate_accounts enable row level security;
alter table public.corporate_employees enable row level security;
alter table public.corporate_spending_limits enable row level security;
alter table public.corporate_invoices enable row level security;
alter table public.driver_incentives enable row level security;
alter table public.incentive_progress enable row level security;
alter table public.pricing_zones enable row level security;
alter table public.surge_events enable row level security;

-- Policies
create policy "settings_public_read" on public.platform_settings for select to anon, authenticated using (true);
create policy "settings_staff_write" on public.platform_settings for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "delivery_customer_read" on public.delivery_orders for select to authenticated using (customer_id = auth.uid());
create policy "delivery_customer_insert" on public.delivery_orders for insert to authenticated with check (customer_id = auth.uid());
create policy "delivery_customer_update" on public.delivery_orders for update to authenticated using (customer_id = auth.uid() and status in ('requested')) with check (customer_id = auth.uid());
create policy "delivery_driver_read" on public.delivery_orders for select to authenticated using (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "delivery_driver_update" on public.delivery_orders for update to authenticated using (driver_id in (select id from public.drivers where user_id = auth.uid())) with check (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "delivery_staff_all" on public.delivery_orders for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "delivery_offer_driver" on public.delivery_offers for select to authenticated using (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "delivery_offer_driver_update" on public.delivery_offers for update to authenticated using (driver_id in (select id from public.drivers where user_id = auth.uid())) with check (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "delivery_offer_customer_read" on public.delivery_offers for select to authenticated using (delivery_id in (select id from public.delivery_orders where customer_id = auth.uid()));
create policy "delivery_offer_staff" on public.delivery_offers for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "delivery_history_read" on public.delivery_status_history for select to authenticated using (
  delivery_id in (select id from public.delivery_orders where customer_id = auth.uid())
  or delivery_id in (select id from public.delivery_orders where driver_id in (select id from public.drivers where user_id = auth.uid()))
  or public.is_swift_staff(auth.uid())
);

create policy "proof_read" on public.delivery_proof for select to authenticated using (
  delivery_id in (select id from public.delivery_orders where customer_id = auth.uid())
  or delivery_id in (select id from public.delivery_orders where driver_id in (select id from public.drivers where user_id = auth.uid()))
  or public.is_swift_staff(auth.uid())
);
create policy "proof_driver_insert" on public.delivery_proof for insert to authenticated with check (
  delivery_id in (select id from public.delivery_orders where driver_id in (select id from public.drivers where user_id = auth.uid()))
);

create policy "sched_owner" on public.scheduled_rides for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "sched_staff" on public.scheduled_rides for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "promo_read_active" on public.promotions for select to authenticated using (status = 'active' or public.is_swift_staff(auth.uid()));
create policy "promo_staff_write" on public.promotions for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "redemption_own" on public.promotion_redemptions for select to authenticated using (user_id = auth.uid());
create policy "redemption_insert" on public.promotion_redemptions for insert to authenticated with check (user_id = auth.uid());
create policy "redemption_update_own" on public.promotion_redemptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "redemption_staff" on public.promotion_redemptions for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "wallet_own_read" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "wallet_own_insert" on public.wallets for insert to authenticated with check (user_id = auth.uid());
create policy "wallet_staff_read" on public.wallets for select to authenticated using (public.is_swift_staff(auth.uid()));

create policy "wtxn_own_read" on public.wallet_transactions for select to authenticated using (wallet_id in (select id from public.wallets where user_id = auth.uid()));
create policy "wtxn_staff_read" on public.wallet_transactions for select to authenticated using (public.is_swift_staff(auth.uid()));
create policy "wtxn_insert" on public.wallet_transactions for insert to authenticated with check (wallet_id in (select id from public.wallets where user_id = auth.uid()));

create policy "corp_member_read" on public.corporate_accounts for select to authenticated using (
  id in (select corporate_account_id from public.corporate_employees where user_id = auth.uid() and status = 'active')
  or public.is_swift_staff(auth.uid())
);
create policy "corp_apply_insert" on public.corporate_accounts for insert to authenticated with check (created_by = auth.uid());
create policy "corp_admin_update" on public.corporate_accounts for update to authenticated using (
  id in (select corporate_account_id from public.corporate_employees where user_id = auth.uid() and role = 'admin' and status = 'active')
  or public.is_swift_staff(auth.uid())
) with check (
  id in (select corporate_account_id from public.corporate_employees where user_id = auth.uid() and role = 'admin' and status = 'active')
  or public.is_swift_staff(auth.uid())
);

create policy "corp_emp_member_read" on public.corporate_employees for select to authenticated using (
  user_id = auth.uid()
  or invited_email = (select email from auth.users where id = auth.uid())
  or corporate_account_id in (select corporate_account_id from public.corporate_employees ce where ce.user_id = auth.uid() and ce.role = 'admin' and ce.status = 'active')
  or public.is_swift_staff(auth.uid())
);
create policy "corp_emp_admin_write" on public.corporate_employees for all to authenticated using (
  corporate_account_id in (select corporate_account_id from public.corporate_employees ce where ce.user_id = auth.uid() and ce.role = 'admin' and ce.status = 'active')
  or public.is_swift_staff(auth.uid())
) with check (
  corporate_account_id in (select corporate_account_id from public.corporate_employees ce where ce.user_id = auth.uid() and ce.role = 'admin' and ce.status = 'active')
  or public.is_swift_staff(auth.uid())
);
create policy "corp_emp_self_accept" on public.corporate_employees for update to authenticated using (
  invited_email = (select email from auth.users where id = auth.uid())
) with check (user_id = auth.uid());

create policy "corp_limit_member_read" on public.corporate_spending_limits for select to authenticated using (
  corporate_account_id in (select corporate_account_id from public.corporate_employees where user_id = auth.uid() and status = 'active')
  or public.is_swift_staff(auth.uid())
);
create policy "corp_limit_admin_write" on public.corporate_spending_limits for all to authenticated using (
  corporate_account_id in (select corporate_account_id from public.corporate_employees ce where ce.user_id = auth.uid() and ce.role = 'admin' and ce.status = 'active')
  or public.is_swift_staff(auth.uid())
) with check (
  corporate_account_id in (select corporate_account_id from public.corporate_employees ce where ce.user_id = auth.uid() and ce.role = 'admin' and ce.status = 'active')
  or public.is_swift_staff(auth.uid())
);

create policy "corp_inv_member_read" on public.corporate_invoices for select to authenticated using (
  corporate_account_id in (select corporate_account_id from public.corporate_employees where user_id = auth.uid() and status = 'active')
  or public.is_swift_staff(auth.uid())
);
create policy "corp_inv_staff_write" on public.corporate_invoices for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "incentive_read" on public.driver_incentives for select to authenticated using (true);
create policy "incentive_staff_write" on public.driver_incentives for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "incentive_progress_driver" on public.incentive_progress for select to authenticated using (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "incentive_progress_staff" on public.incentive_progress for select to authenticated using (public.is_swift_staff(auth.uid()));

create policy "zone_read" on public.pricing_zones for select to authenticated using (true);
create policy "zone_staff_write" on public.pricing_zones for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

create policy "surge_read" on public.surge_events for select to authenticated using (true);
create policy "surge_staff_write" on public.surge_events for all to authenticated using (public.is_swift_staff(auth.uid())) with check (public.is_swift_staff(auth.uid()));

-- Triggers & functions
create trigger update_delivery_orders_updated_at before update on public.delivery_orders for each row execute function public.update_updated_at_column();
create trigger update_scheduled_rides_updated_at before update on public.scheduled_rides for each row execute function public.update_updated_at_column();
create trigger update_promotions_updated_at before update on public.promotions for each row execute function public.update_updated_at_column();
create trigger update_wallets_updated_at before update on public.wallets for each row execute function public.update_updated_at_column();
create trigger update_corporate_accounts_updated_at before update on public.corporate_accounts for each row execute function public.update_updated_at_column();
create trigger update_corporate_employees_updated_at before update on public.corporate_employees for each row execute function public.update_updated_at_column();
create trigger update_corp_limits_updated_at before update on public.corporate_spending_limits for each row execute function public.update_updated_at_column();
create trigger update_corp_invoices_updated_at before update on public.corporate_invoices for each row execute function public.update_updated_at_column();
create trigger update_driver_incentives_updated_at before update on public.driver_incentives for each row execute function public.update_updated_at_column();
create trigger update_incentive_progress_updated_at before update on public.incentive_progress for each row execute function public.update_updated_at_column();
create trigger update_pricing_zones_updated_at before update on public.pricing_zones for each row execute function public.update_updated_at_column();

create or replace function public.log_delivery_status() returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if TG_OP = 'INSERT' or old.status is distinct from new.status then
    insert into public.delivery_status_history (delivery_id, from_status, to_status, actor_id)
    values (new.id, case when TG_OP = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;
revoke execute on function public.log_delivery_status() from public, anon, authenticated;
create trigger trg_delivery_status after insert or update on public.delivery_orders for each row execute function public.log_delivery_status();

create or replace function public.wallet_txn_guard() returns trigger language plpgsql security definer set search_path = 'public' as $$
declare bal bigint;
begin
  if new.type in ('promo_credit','adjustment','refund','incentive_payout')
     and not (public.is_swift_staff(auth.uid()) or public.is_staff(auth.uid()) or auth.uid() is null) then
    raise exception 'Not permitted to post % transactions', new.type;
  end if;
  select balance_kobo into bal from public.wallets where id = new.wallet_id for update;
  if bal is null then raise exception 'Wallet not found'; end if;
  if bal + new.amount_kobo < 0 then raise exception 'Insufficient wallet balance'; end if;
  update public.wallets set balance_kobo = balance_kobo + new.amount_kobo where id = new.wallet_id;
  return new;
end $$;
revoke execute on function public.wallet_txn_guard() from public, anon, authenticated;
create trigger trg_wallet_txn before insert on public.wallet_transactions for each row execute function public.wallet_txn_guard();

insert into public.platform_settings (key, value, description) values
  ('wallet_enabled', 'true', 'Enable Swift Move wallet top-ups and payments'),
  ('swift_bike_enabled', 'false', 'Swift Bike service type (pending legal confirmation)'),
  ('delivery_express_multiplier', '1.5', 'Price multiplier for Express deliveries');