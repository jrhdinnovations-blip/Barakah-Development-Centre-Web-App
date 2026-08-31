import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { driverApplySchema, ratingSchema, uuid, vehicleSchema } from "./staff.server";

export const applyDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => driverApplySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("drivers").select("id, status").eq("user_id", userId).maybeSingle();
    if (existing) throw new Error("You already have a driver application");
    const { data: driver, error } = await supabase
      .from("drivers")
      .insert({
        user_id: userId,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        address: data.address ?? null,
        emergency_contact_name: data.emergencyContactName ?? null,
        emergency_contact_phone: data.emergencyContactPhone ?? null,
        bank_name: data.bankName ?? null,
        account_number: data.accountNumber ?? null,
        account_name: data.accountName ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { driverId: driver.id as string };
  });

export const addVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => vehicleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .insert({
        driver_id: driver.id,
        make: data.make,
        model: data.model,
        year: data.year ?? null,
        colour: data.colour ?? null,
        plate_number: data.plateNumber.toUpperCase(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Make it the active assignment (ends any previous)
    await supabase
      .from("driver_vehicle_assignments")
      .update({ status: "ended", unassigned_at: new Date().toISOString() })
      .eq("driver_id", driver.id)
      .eq("status", "active");
    await supabase.from("driver_vehicle_assignments").insert({
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      created_by: userId,
    });
    return { vehicleId: vehicle.id as string };
  });

export const linkDriverDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ documentId: uuid, documentType: z.enum(["id_card", "drivers_licence", "photo", "other"]), vehicleId: uuid.optional(), vehicleDocType: z.enum(["registration", "insurance", "inspection"]).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    if (data.vehicleId && data.vehicleDocType) {
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: data.vehicleId,
        document_type: data.vehicleDocType,
        document_id: data.documentId,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("driver_documents").insert({
        driver_id: driver.id,
        document_type: data.documentType,
        document_id: data.documentId,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setDriverOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ isOnline: z.boolean(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id, status").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    if (data.isOnline && driver.status !== "active") throw new Error("Your driver account is not active yet");
    await supabase
      .from("drivers")
      .update({ is_online: data.isOnline, current_lat: data.lat, current_lng: data.lng, location_updated_at: new Date().toISOString() })
      .eq("id", driver.id);
    return { ok: true };
  });

export const updateDriverLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), heading: z.number().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).single();
    if (!driver) return { ok: false };
    await supabase
      .from("drivers")
      .update({ current_lat: data.lat, current_lng: data.lng, location_updated_at: new Date().toISOString() })
      .eq("id", driver.id);
    const { data: activeRide } = await supabase
      .from("rides")
      .select("id")
      .eq("driver_id", driver.id)
      .in("status", ["driver_assigned", "driver_en_route", "driver_arrived", "trip_started"])
      .limit(1)
      .maybeSingle();
    if (activeRide) {
      await supabase.from("ride_locations").insert({
        ride_id: activeRide.id,
        driver_id: driver.id,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading ?? null,
      });
    }
    return { ok: true };
  });

export const getDriverConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle();
    if (!driver) return { driver: null };

    const [{ data: vehicles }, { data: docs }, { data: offers }, { data: rides }, { data: earnings }] = await Promise.all([
      supabase.from("vehicles").select("*, documents:vehicle_documents(document_type, status)").eq("driver_id", driver.id).order("created_at", { ascending: false }),
      supabase.from("driver_documents").select("id, document_type, status, notes").eq("driver_id", driver.id),
      supabase
        .from("ride_offers")
        .select("*, request:ride_requests(pickup_address, destination_address, estimated_fare_kobo, estimated_distance_km, currency)")
        .eq("driver_id", driver.id)
        .eq("status", "pending")
        .order("offered_at", { ascending: false })
        .limit(1),
      supabase
        .from("rides")
        .select("*, fare:ride_fares(total_kobo), payment:ride_payments(status, method)")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("driver_earnings").select("net_kobo, gross_kobo, created_at, status").eq("driver_id", driver.id).order("created_at", { ascending: false }).limit(50),
    ]);

    // Expire stale offer and advance dispatch if needed
    const offer = (offers ?? [])[0];
    if (offer) {
      const { OFFER_TIMEOUT_MS, dispatchNext } = await import("./swift.server");
      if (Date.now() - new Date(offer.offered_at).getTime() > OFFER_TIMEOUT_MS) {
        await dispatchNext(offer.request_id);
      }
    }

    const list = rides ?? [];
    const activeRide = list.find((r: any) =>
      ["driver_assigned", "driver_en_route", "driver_arrived", "trip_started"].includes(r.status),
    );
    const today = new Date().toISOString().slice(0, 10);
    const todayNet = (earnings ?? [])
      .filter((e: any) => e.created_at.startsWith(today))
      .reduce((s: number, e: any) => s + Number(e.net_kobo), 0);

    return {
      driver,
      vehicles: vehicles ?? [],
      documents: docs ?? [],
      offer: offer && Date.now() - new Date(offer.offered_at).getTime() <= 60_000 ? offer : null,
      activeRide: activeRide ?? null,
      history: list,
      earnings: earnings ?? [],
      todayNetKobo: todayNet,
    };
  });

export const respondToOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ offerId: uuid, accept: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id, status").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    const { data: offer } = await supabase.from("ride_offers").select("*, request:ride_requests(*)").eq("id", data.offerId).single();
    if (!offer || offer.driver_id !== driver.id) throw new Error("Offer not found");
    if (offer.status !== "pending") throw new Error("This offer has expired");

    const { OFFER_TIMEOUT_MS, dispatchNext, makePin } = await import("./swift.server");
    const stale = Date.now() - new Date(offer.offered_at).getTime() > OFFER_TIMEOUT_MS;

    if (!data.accept || stale) {
      await supabase
        .from("ride_offers")
        .update({ status: stale && data.accept ? "expired" : "declined", responded_at: new Date().toISOString() })
        .eq("id", offer.id);
      await dispatchNext(offer.request_id);
      return { accepted: false };
    }
    if (driver.status !== "active") throw new Error("Your account is not active");

    // Mark offer accepted, create the ride
    await supabase.from("ride_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offer.id);
    const req = offer.request;
    const { data: assign } = await supabase
      .from("driver_vehicle_assignments")
      .select("vehicle_id")
      .eq("driver_id", driver.id)
      .eq("status", "active")
      .maybeSingle();

    const { getAdmin } = await import("./payments.server");
    const admin = await getAdmin();
    const { data: ride, error } = await admin
      .from("rides")
      .insert({
        request_id: req.id,
        customer_id: req.customer_id,
        driver_id: driver.id,
        vehicle_id: assign?.vehicle_id ?? null,
        service_type_id: req.service_type_id,
        pickup_address: req.pickup_address,
        pickup_lat: req.pickup_lat,
        pickup_lng: req.pickup_lng,
        destination_address: req.destination_address,
        destination_lat: req.destination_lat,
        destination_lng: req.destination_lng,
        verification_pin: makePin(),
        status: "driver_assigned",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await admin.from("ride_requests").update({ status: "matched" }).eq("id", req.id);
    await admin.from("ride_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("request_id", req.id).eq("status", "pending");
    await admin.from("ride_fares").insert({
      ride_id: ride.id,
      kind: "estimate",
      estimated_total_kobo: req.estimated_fare_kobo,
      total_kobo: req.estimated_fare_kobo ?? 0,
      distance_km: req.estimated_distance_km,
      duration_min: req.estimated_duration_min,
      created_by: userId,
    });
    await admin.rpc("notify_user", {
      _user_id: req.customer_id,
      _type: "ride_accepted",
      _title: "Driver found!",
      _body: "Your Swift Ride driver is on the way. Share your verification PIN only at pickup.",
      _link: "/my-swift-move",
    });
    return { accepted: true, rideId: ride.id as string };
  });

const rideActionSchema = z.object({
  rideId: uuid,
  action: z.enum(["en_route", "arrived", "start", "complete", "cancel"]),
  pin: z.string().trim().regex(/^\d{4}$/).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const driverRideAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rideActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    const { data: ride } = await supabase.from("rides").select("*").eq("id", data.rideId).single();
    if (!ride || ride.driver_id !== driver.id) throw new Error("Ride not found");

    const now = new Date().toISOString();
    type RideStatus =
      | "driver_assigned" | "driver_en_route" | "driver_arrived" | "trip_started"
      | "trip_completed" | "cancelled_by_driver";
    const transitions = {
      en_route: { from: ["driver_assigned"], to: "driver_en_route", patch: {} },
      arrived: { from: ["driver_assigned", "driver_en_route"], to: "driver_arrived", patch: { arrived_at: now } },
      start: { from: ["driver_arrived", "driver_en_route", "driver_assigned"], to: "trip_started", patch: { started_at: now } },
      complete: { from: ["trip_started"], to: "trip_completed", patch: { completed_at: now } },
      cancel: { from: ["driver_assigned", "driver_en_route", "driver_arrived"], to: "cancelled_by_driver", patch: { cancelled_at: now, cancelled_by: "driver", cancel_reason: data.reason ?? null } },
    } as const satisfies Record<string, { from: readonly string[]; to: RideStatus; patch: Record<string, unknown> }>;
    const t = transitions[data.action];
    if (!(t.from as readonly string[]).includes(ride.status)) throw new Error(`Cannot ${data.action} from current status`);
    if (data.action === "start" && data.pin !== ride.verification_pin)
      throw new Error("Incorrect verification PIN — ask the customer for their 4-digit PIN");

    await supabase.from("rides").update({ status: t.to as never, ...t.patch }).eq("id", ride.id);

    if (data.action === "complete") {
      // Final fare from breadcrumb distance + actual duration
      const { data: locs } = await supabase
        .from("ride_locations")
        .select("lat, lng, recorded_at")
        .eq("ride_id", ride.id)
        .gte("recorded_at", ride.started_at ?? ride.accepted_at)
        .order("recorded_at", { ascending: true });
      const { haversineKm } = await import("./maps.server");
      let dist = 0;
      const pts = locs ?? [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        dist += haversineKm(a.lat, a.lng, b.lat, b.lng);
      }
      if (dist < 0.2) dist = haversineKm(ride.pickup_lat, ride.pickup_lng, ride.destination_lat, ride.destination_lng) * 1.3;
      const duration = ride.started_at ? Math.max(1, (Date.now() - new Date(ride.started_at).getTime()) / 60000) : 10;

      const { getActivePricing, computeFareKobo } = await import("./swift.server");
      const { rule } = await getActivePricing(supabase);
      const total = computeFareKobo(rule, dist, duration);
      await supabase
        .from("ride_fares")
        .update({
          kind: "final",
          base_kobo: Number(rule.base_fare_kobo),
          distance_kobo: Math.round(dist * Number(rule.per_km_kobo)),
          time_kobo: Math.round(duration * Number(rule.per_minute_kobo)),
          booking_fee_kobo: Number(rule.booking_fee_kobo),
          total_kobo: total,
          distance_km: Math.round(dist * 100) / 100,
          duration_min: Math.round(duration * 10) / 10,
        })
        .eq("ride_id", ride.id);
      await supabase.from("rides").update({ status: "payment_pending", final_distance_km: Math.round(dist * 100) / 100, final_duration_min: Math.round(duration * 10) / 10 }).eq("id", ride.id);

      const { getAdmin } = await import("./payments.server");
      const admin = await getAdmin();
      await admin.rpc("notify_user", {
        _user_id: ride.customer_id,
        _type: "ride_completed",
        _title: "Trip completed",
        _body: "Your trip has ended. Please complete payment and rate your driver.",
        _link: "/my-swift-move",
      });
    }
    if (data.action === "cancel") {
      const { getAdmin } = await import("./payments.server");
      const admin = await getAdmin();
      await admin.rpc("notify_user", {
        _user_id: ride.customer_id,
        _type: "ride_cancelled",
        _title: "Your driver cancelled",
        _body: "Your driver had to cancel. You can request a new ride.",
        _link: "/my-swift-move",
      });
    }
    return { ok: true, status: t.to as string };
  });

export const rateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ratingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId).single();
    if (!driver) throw new Error("No driver profile");
    const { data: ride } = await supabase.from("rides").select("*").eq("id", data.rideId).single();
    if (!ride || ride.driver_id !== driver.id) throw new Error("Ride not found");
    if (!["trip_completed", "payment_pending", "payment_completed"].includes(ride.status))
      throw new Error("You can rate after the trip is completed");
    const { error } = await supabase.from("customer_ratings").insert({
      ride_id: ride.id,
      customer_id: ride.customer_id,
      driver_id: driver.id,
      stars: data.stars,
      comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
