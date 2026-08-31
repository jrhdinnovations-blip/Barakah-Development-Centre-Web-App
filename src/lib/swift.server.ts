import { getAdmin } from "./payments.server";
import { haversineKm, estimateDurationMin } from "./maps.server";

export const OFFER_TIMEOUT_MS = 60_000;
export const REQUEST_TIMEOUT_MS = 5 * 60_000;
export const MATCH_RADIUS_KM = 15;

export function makePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function getActivePricing(supabase: any, serviceTypeCode = "swift_ride") {
  const { data: st } = await supabase
    .from("service_types")
    .select("id, code, name, capacity, description")
    .eq("code", serviceTypeCode)
    .eq("status", "active")
    .single();
  if (!st) throw new Error("Service type unavailable");
  const { data: rule } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("service_type_id", st.id)
    .eq("status", "active")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rule) throw new Error("Pricing not configured");
  return { serviceType: st, rule };
}

export function computeFareKobo(
  rule: any,
  distanceKm: number,
  durationMin: number,
  waitingMin = 0,
) {
  const raw =
    Number(rule.base_fare_kobo) +
    Math.round(distanceKm * Number(rule.per_km_kobo)) +
    Math.round(durationMin * Number(rule.per_minute_kobo)) +
    Math.round(waitingMin * Number(rule.waiting_per_minute_kobo)) +
    Number(rule.booking_fee_kobo);
  const withFloor = Math.max(raw, Number(rule.min_fare_kobo));
  return Math.round(withFloor * Number(rule.surge_multiplier ?? 1));
}

export async function swiftLegalEntityId(supabase: any) {
  const { data } = await supabase
    .from("legal_entities")
    .select("id")
    .eq("name", "Swift Move")
    .maybeSingle();
  return data?.id ?? null;
}

export async function estimateRide(supabase: any, input: {
  pickupLat: number; pickupLng: number; destLat: number; destLng: number;
}) {
  const { serviceType, rule } = await getActivePricing(supabase);
  const distanceKm = haversineKm(input.pickupLat, input.pickupLng, input.destLat, input.destLng) * 1.3;
  const durationMin = estimateDurationMin(distanceKm);
  const fare = computeFareKobo(rule, distanceKm, durationMin);
  return {
    serviceType,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMin,
    fareKobo: fare,
    currency: rule.currency ?? "NGN",
  };
}

/**
 * Sequential dispatch: expire stale offers, then offer the request to the
 * nearest online active driver who hasn't declined it. Uses the admin client
 * because matching writes rows on behalf of other users.
 */
export async function dispatchNext(requestId: string) {
  const admin = await getAdmin();
  const { data: req } = await admin
    .from("ride_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req || req.status !== "matching") return { offered: false };

  const ageMs = Date.now() - new Date(req.created_at).getTime();
  if (ageMs > REQUEST_TIMEOUT_MS) {
    await admin
      .from("ride_requests")
      .update({ status: "cancelled_by_system" })
      .eq("id", requestId)
      .eq("status", "matching");
    await admin.rpc("notify_user", {
      _user_id: req.customer_id,
      _type: "ride_no_driver",
      _title: "No drivers available right now",
      _body: "We couldn't find an available driver for your trip. Please try again in a few minutes.",
      _link: "/my-swift-move",
    });
    return { offered: false };
  }

  // Expire stale pending offers
  const cutoff = new Date(Date.now() - OFFER_TIMEOUT_MS).toISOString();
  await admin
    .from("ride_offers")
    .update({ status: "expired", responded_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .eq("status", "pending")
    .lt("offered_at", cutoff);

  const { data: tried } = await admin
    .from("ride_offers")
    .select("driver_id")
    .eq("request_id", requestId);
  const triedIds = (tried ?? []).map((t: any) => t.driver_id);

  const { data: drivers } = await admin
    .from("drivers")
    .select("id, user_id, current_lat, current_lng")
    .eq("status", "active")
    .eq("is_online", true)
    .not("current_lat", "is", null);

  const candidates = (drivers ?? [])
    .filter((d: any) => !triedIds.includes(d.id))
    .map((d: any) => ({
      ...d,
      dist: haversineKm(req.pickup_lat, req.pickup_lng, d.current_lat, d.current_lng),
    }))
    .filter((d: any) => d.dist <= MATCH_RADIUS_KM)
    .sort((a: any, b: any) => a.dist - b.dist);

  // Driver must have an active vehicle assignment and no active ride
  for (const c of candidates) {
    const { data: assign } = await admin
      .from("driver_vehicle_assignments")
      .select("id")
      .eq("driver_id", c.id)
      .eq("status", "active")
      .maybeSingle();
    if (!assign) continue;
    const { count: busy } = await admin
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", c.id)
      .in("status", ["driver_assigned", "driver_en_route", "driver_arrived", "trip_started"]);
    if ((busy ?? 0) > 0) continue;

    const { error } = await admin.from("ride_offers").insert({
      request_id: requestId,
      driver_id: c.id,
    });
    if (!error) {
      await admin.rpc("notify_user", {
        _user_id: c.user_id,
        _type: "ride_offer",
        _title: "New ride request",
        _body: `${req.pickup_address} → ${req.destination_address}`,
        _link: "/drive",
      });
      return { offered: true };
    }
  }
  return { offered: false };
}

/** Records earnings + commission and closes out a paid ride. Idempotent. */
export async function settleRidePayment(admin: any, opts: {
  rideId: string;
  paymentId?: string | null;
  method: "gateway" | "cash_manual";
}) {
  const { data: ride } = await admin.from("rides").select("*").eq("id", opts.rideId).single();
  if (!ride) throw new Error("Ride not found");

  const { data: rp } = await admin
    .from("ride_payments")
    .select("id, status")
    .eq("ride_id", opts.rideId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rp) {
    await admin.from("ride_payments").update({ status: "paid", payment_id: opts.paymentId ?? null, method: opts.method }).eq("id", rp.id);
  } else {
    await admin.from("ride_payments").insert({ ride_id: opts.rideId, payment_id: opts.paymentId ?? null, method: opts.method, status: "paid" });
  }

  if (ride.status !== "payment_completed") {
    await admin.from("rides").update({ status: "payment_completed" }).eq("id", opts.rideId);
  }

  const { data: fare } = await admin.from("ride_fares").select("*").eq("ride_id", opts.rideId).maybeSingle();
  const gross = Number(fare?.total_kobo ?? 0);
  if (gross > 0) {
    const { data: st } = await admin.from("service_types").select("id").eq("id", ride.service_type_id).single();
    const { data: rule } = await admin
      .from("pricing_rules")
      .select("commission_percent")
      .eq("service_type_id", st?.id ?? ride.service_type_id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rate = Number(rule?.commission_percent ?? 15);
    const commission = Math.round((gross * rate) / 100);
    const { count: existing } = await admin
      .from("driver_earnings")
      .select("id", { count: "exact", head: true })
      .eq("ride_id", opts.rideId);
    if ((existing ?? 0) === 0) {
      await admin.from("driver_earnings").insert({
        driver_id: ride.driver_id,
        ride_id: opts.rideId,
        gross_kobo: gross,
        commission_kobo: commission,
        net_kobo: gross - commission,
      });
      await admin.from("commissions").insert({
        ride_id: opts.rideId,
        rate_percent: rate,
        amount_kobo: commission,
      });
    }
    const { data: driver } = await admin.from("drivers").select("user_id").eq("id", ride.driver_id).single();
    if (driver) {
      await admin.rpc("notify_user", {
        _user_id: driver.user_id,
        _type: "ride_payment",
        _title: "Ride payment received",
        _body: `Earnings recorded for your trip to ${ride.destination_address}.`,
        _link: "/drive",
      });
    }
    await admin.rpc("notify_user", {
      _user_id: ride.customer_id,
      _type: "ride_payment",
      _title: "Ride payment confirmed",
      _body: "Thanks for riding with Swift Move. You can rate your driver now.",
      _link: "/my-swift-move",
    });
  }
}
