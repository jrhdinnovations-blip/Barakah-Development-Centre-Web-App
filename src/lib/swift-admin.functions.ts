import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, driverReviewSchema, pricingRuleSchema, requireSwiftStaff, uuid } from "./staff.server";

export const swiftOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);
    const [activeRides, requests, driversOnline, completedToday, pendingDrivers, openReports] = await Promise.all([
      supabase.from("rides").select("id", { count: "exact", head: true }).in("status", ["driver_assigned", "driver_en_route", "driver_arrived", "trip_started"]),
      supabase.from("ride_requests").select("id", { count: "exact", head: true }).eq("status", "matching"),
      supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_online", true),
      supabase.from("rides").select("id", { count: "exact", head: true }).in("status", ["trip_completed", "payment_pending", "payment_completed"]).gte("created_at", today),
      supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "pending_verification"),
      supabase.from("ride_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

    const [{ data: liveRides }, { data: liveRequests }] = await Promise.all([
      supabase
        .from("rides")
        .select("id, status, pickup_address, destination_address, created_at, verification_pin, driver:drivers(full_name, is_online), fare:ride_fares(total_kobo)")
        .in("status", ["driver_assigned", "driver_en_route", "driver_arrived", "trip_started", "payment_pending"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ride_requests")
        .select("id, pickup_address, destination_address, estimated_fare_kobo, created_at, offers:ride_offers(status, driver:drivers(full_name))")
        .eq("status", "matching")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      counts: {
        activeRides: activeRides.count ?? 0,
        matchingRequests: requests.count ?? 0,
        driversOnline: driversOnline.count ?? 0,
        completedToday: completedToday.count ?? 0,
        pendingDrivers: pendingDrivers.count ?? 0,
        openReports: openReports.count ?? 0,
      },
      liveRides: liveRides ?? [],
      liveRequests: liveRequests ?? [],
    };
  });

export const swiftListDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ status: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    let q = supabase
      .from("drivers")
      .select("*, documents:driver_documents(id, document_type, status), vehicles(make, model, plate_number, inspection_status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status) q = q.eq("status", data.status as "active" | "approved" | "offline" | "pending_verification" | "rejected" | "suspended");
    const { data: rows } = await q;
    return rows ?? [];
  });

export const reviewDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => driverReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const statusMap = { approve: "active", reject: "rejected", suspend: "suspended", reactivate: "active" } as const;
    const { data: driver } = await supabase.from("drivers").select("id, user_id").eq("id", data.driverId).single();
    if (!driver) throw new Error("Driver not found");
    const { error } = await supabase
      .from("drivers")
      .update({
        status: statusMap[data.action],
        staff_notes: data.notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ...(data.action === "suspend" ? { is_online: false } : {}),
      })
      .eq("id", data.driverId);
    if (error) throw new Error(error.message);

    // Grant/revoke the driver role via admin client
    const { getAdmin } = await import("./payments.server");
    const admin = await getAdmin();
    if (data.action === "approve" || data.action === "reactivate") {
      await admin.from("user_roles").upsert({ user_id: driver.user_id, role: "driver", status: "active" }, { onConflict: "user_id,role" });
      await admin.from("user_roles").update({ status: "active" }).eq("user_id", driver.user_id).eq("role", "driver");
    } else {
      await admin.from("user_roles").update({ status: "suspended" }).eq("user_id", driver.user_id).eq("role", "driver");
    }

    await supabase.rpc("notify_user", {
      _user_id: driver.user_id,
      _type: "driver_review",
      _title: `Driver application ${data.action === "approve" || data.action === "reactivate" ? "approved" : data.action === "suspend" ? "suspended" : "updated"}`,
      _body: data.notes ?? "",
      _link: "/drive",
    });
    await audit({ supabase, userId }, `driver_${data.action}`, "driver", data.driverId, { notes: data.notes });
    return { ok: true };
  });

export const verifyDriverDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ docId: uuid, kind: z.enum(["driver", "vehicle"]), status: z.enum(["verified", "rejected"]), notes: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const table = data.kind === "driver" ? "driver_documents" : "vehicle_documents";
    const { error } = await supabase.from(table).update({ status: data.status, notes: data.notes ?? null }).eq("id", data.docId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setVehicleInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ vehicleId: uuid, status: z.enum(["passed", "failed"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    await supabase.from("vehicles").update({ inspection_status: data.status }).eq("id", data.vehicleId);
    return { ok: true };
  });

export const swiftPricingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const { data } = await supabase
      .from("pricing_rules")
      .select("*, service_type:service_types(name, code)")
      .order("effective_from", { ascending: false });
    return data ?? [];
  });

export const upsertPricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => pricingRuleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    // Archive existing active rule for the service type, then insert the new one
    await supabase.from("pricing_rules").update({ status: "archived" }).eq("service_type_id", data.serviceTypeId).eq("status", "active");
    const { error } = await supabase.from("pricing_rules").insert({
      service_type_id: data.serviceTypeId,
      base_fare_kobo: data.baseFareKobo,
      min_fare_kobo: data.minFareKobo,
      per_km_kobo: data.perKmKobo,
      per_minute_kobo: data.perMinuteKobo,
      waiting_per_minute_kobo: data.waitingPerMinuteKobo,
      booking_fee_kobo: data.bookingFeeKobo,
      cancellation_fee_kobo: data.cancellationFeeKobo,
      cancellation_grace_minutes: data.cancellationGraceMinutes,
      commission_percent: data.commissionPercent,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    await audit({ supabase, userId }, "pricing_rule_updated", "pricing_rule", data.serviceTypeId, data);
    return { ok: true };
  });

export const swiftCancelRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rideId: uuid, reason: z.string().trim().min(3).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const { data: ride } = await supabase.from("rides").select("id, customer_id, driver_id, status, drivers(user_id)").eq("id", data.rideId).single();
    if (!ride) throw new Error("Ride not found");
    await supabase
      .from("rides")
      .update({ status: "cancelled_by_system", cancelled_at: new Date().toISOString(), cancelled_by: "staff", cancel_reason: data.reason })
      .eq("id", ride.id);
    await supabase.rpc("notify_user", {
      _user_id: ride.customer_id,
      _type: "ride_cancelled",
      _title: "Ride cancelled by Swift Move",
      _body: data.reason,
      _link: "/my-swift-move",
    });
    const driverUser = (ride as any).drivers?.user_id;
    if (driverUser) {
      await supabase.rpc("notify_user", {
        _user_id: driverUser,
        _type: "ride_cancelled",
        _title: "Ride cancelled by dispatch",
        _body: data.reason,
        _link: "/drive",
      });
    }
    await audit({ supabase, userId }, "ride_cancelled_by_staff", "ride", ride.id, { reason: data.reason });
    return { ok: true };
  });

export const swiftReassignRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rideId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const { data: ride } = await supabase.from("rides").select("*").eq("id", data.rideId).single();
    if (!ride) throw new Error("Ride not found");
    if (["trip_started", "trip_completed", "payment_pending", "payment_completed"].includes(ride.status))
      throw new Error("Ride can no longer be reassigned");
    await supabase
      .from("rides")
      .update({ status: "cancelled_by_system", cancelled_at: new Date().toISOString(), cancelled_by: "staff", cancel_reason: "Reassigned by dispatch" })
      .eq("id", ride.id);
    const { getAdmin } = await import("./payments.server");
    const admin = await getAdmin();
    const { data: req } = await admin
      .from("ride_requests")
      .update({ status: "matching" })
      .eq("id", ride.request_id)
      .select("id")
      .single();
    if (req) {
      const { dispatchNext } = await import("./swift.server");
      await dispatchNext(req.id);
    }
    await audit({ supabase, userId }, "ride_reassigned", "ride", ride.id, {});
    return { ok: true };
  });

export const swiftListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const { data } = await supabase
      .from("ride_reports")
      .select("*, ride:rides(pickup_address, destination_address, created_at)")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reportId: uuid, status: z.enum(["investigating", "resolved"]), notes: z.string().trim().max(1000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    await supabase
      .from("ride_reports")
      .update({ status: data.status, resolution_notes: data.notes ?? null })
      .eq("id", data.reportId);
    return { ok: true };
  });

export const confirmCashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rideId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSwiftStaff(supabase, userId);
    const { getAdmin } = await import("./payments.server");
    const admin = await getAdmin();
    const { settleRidePayment } = await import("./swift.server");
    await settleRidePayment(admin, { rideId: data.rideId, method: "cash_manual" });
    await audit({ supabase, userId }, "ride_cash_confirmed", "ride", data.rideId, {});
    return { ok: true };
  });
