import { createServerFn } from "@tanstack/react-start";
import { appendDriverAcceptance } from "@/lib/swift-order";

export interface DispatchAssignInput {
  tripId: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  vehicleMake?: string;
  vehicleType?: string;
  plateNumber?: string;
  rating?: number;
}

export interface DispatchReassignInput {
  tripId: string;
  oldDriverId?: string | null;
  newDriverId: string;
  newDriverName: string;
  newDriverPhone?: string;
  newVehicleMake?: string;
  newVehicleType?: string;
  newPlateNumber?: string;
  newRating?: number;
  reason: string;
}

export interface DispatchCancelInput {
  tripId: string;
  assignedDriverId?: string | null;
  reason: string;
}

/**
 * 1. Assign Driver to Order (Bypasses RLS via Supabase Admin)
 * Updates swift_deliveries, vehicle_hire_bookings and active_drivers
 */
export const dispatchAssignTrip = createServerFn({ method: "POST" })
  .validator((input: DispatchAssignInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    // 1. Fetch the target delivery
    const { data: order, error: fetchErr } = await admin
      .from("swift_deliveries")
      .select("*")
      .eq("id", data.tripId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[dispatchAssignTrip] Fetch error:", fetchErr);
      throw new Error(`Failed to load order: ${fetchErr.message}`);
    }

    const existingPackageType = order?.package_type || "Standard Parcel";
    const enrichedPackageType = appendDriverAcceptance(existingPackageType, {
      name: data.driverName,
      phone: data.driverPhone || "",
      carModel: data.vehicleMake || data.vehicleType || "Fleet Vehicle",
      plate: data.plateNumber || "PL-101-JS",
      rating: data.rating || 5,
    });

    // 2. Update swift_deliveries with service role
    const { data: updatedDelivery, error: updateErr } = await admin
      .from("swift_deliveries")
      .update({
        driver_id: data.driverId,
        status: "accepted",
        package_type: enrichedPackageType,
      })
      .eq("id", data.tripId)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error("[dispatchAssignTrip] Update error:", updateErr);
      throw new Error(`Failed to assign driver: ${updateErr.message}`);
    }

    // 3. Update vehicle_hire_bookings if matching id
    try {
      await admin
        .from("vehicle_hire_bookings")
        .update({
          status: "matched",
          driver_name: data.driverName,
          driver_phone: data.driverPhone || "",
          vehicle_details: `${data.vehicleMake || ""} • ${data.plateNumber || ""}`,
        })
        .eq("id", data.tripId);
    } catch {}

    // 4. Update driver status in active_drivers
    try {
      await admin.from("active_drivers").upsert(
        {
          driver_id: data.driverId,
          status: "busy",
          last_updated: new Date().toISOString(),
        },
        { onConflict: "driver_id" }
      );
    } catch {}

    console.log(`[dispatchAssignTrip] Successfully assigned ${data.driverName} to order ${data.tripId}`);
    return { success: true, order: updatedDelivery };
  });

/**
 * 2. Reassign Driver (Bypasses RLS via Supabase Admin)
 */
export const dispatchReassignTrip = createServerFn({ method: "POST" })
  .validator((input: DispatchReassignInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const { data: order } = await admin
      .from("swift_deliveries")
      .select("*")
      .eq("id", data.tripId)
      .maybeSingle();

    const basePkg = order?.package_type || "Standard Order";
    const reassignNote = `${basePkg} |||REASSIGNED:${data.newDriverName}|||REASON:${data.reason}`;
    const enriched = appendDriverAcceptance(reassignNote, {
      name: data.newDriverName,
      phone: data.newDriverPhone || "",
      carModel: data.newVehicleMake || data.newVehicleType || "Fleet Vehicle",
      plate: data.newPlateNumber || "PL-REASSIGN",
      rating: data.newRating || 5,
    });

    const { error: upErr } = await admin
      .from("swift_deliveries")
      .update({
        driver_id: data.newDriverId,
        status: "accepted",
        package_type: enriched,
      })
      .eq("id", data.tripId);

    if (upErr) throw new Error(`Reassign failed: ${upErr.message}`);

    // Free old driver if present
    if (data.oldDriverId) {
      try {
        await admin
          .from("active_drivers")
          .update({ status: "available" })
          .eq("driver_id", data.oldDriverId);
      } catch {}
    }

    // Set new driver to busy
    try {
      await admin.from("active_drivers").upsert(
        {
          driver_id: data.newDriverId,
          status: "busy",
          last_updated: new Date().toISOString(),
        },
        { onConflict: "driver_id" }
      );
    } catch {}

    return { success: true };
  });

/**
 * 3. Cancel Trip (Bypasses RLS via Supabase Admin)
 */
export const dispatchCancelTrip = createServerFn({ method: "POST" })
  .validator((input: DispatchCancelInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const { error: upErr } = await admin
      .from("swift_deliveries")
      .update({
        status: "cancelled",
      })
      .eq("id", data.tripId);

    if (upErr) throw new Error(`Cancel failed: ${upErr.message}`);

    try {
      await admin
        .from("vehicle_hire_bookings")
        .update({ status: "cancelled" })
        .eq("id", data.tripId);
    } catch {}

    // Release driver back to available
    if (data.assignedDriverId) {
      try {
        await admin
          .from("active_drivers")
          .update({ status: "available" })
          .eq("driver_id", data.assignedDriverId);
      } catch {}
    }

    return { success: true };
  });
export interface AdminForceStatusInput {
  orderId: string;
  newStatus: string;
  isVehicleBooking?: boolean;
  paymentReference?: string | null;
}

/**
 * 4. Admin Force-Update Order Status (Bypasses RLS via Supabase Admin)
 * Works for both swift_deliveries and vehicle_hire_bookings.
 * Also frees the assigned driver when an order is cancelled/delivered.
 */
export const adminForceStatus = createServerFn({ method: "POST" })
  .validator((input: AdminForceStatusInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const hireEquiv =
      data.newStatus === "delivered" ? "completed" : data.newStatus;

    if (data.isVehicleBooking) {
      // Update vehicle_hire_bookings
      const { error } = await admin
        .from("vehicle_hire_bookings")
        .update({ status: hireEquiv })
        .eq("id", data.orderId);
      if (error) throw new Error(`VHB status update failed: ${error.message}`);
    } else {
      // Update swift_deliveries
      const { data: updated, error } = await admin
        .from("swift_deliveries")
        .update({ status: data.newStatus })
        .eq("id", data.orderId)
        .select("driver_id")
        .maybeSingle();
      if (error) throw new Error(`Delivery status update failed: ${error.message}`);

      // If this is a ride and has a matching vehicle_hire_booking, sync it too
      if (data.paymentReference) {
        try {
          await admin
            .from("vehicle_hire_bookings")
            .update({ status: hireEquiv })
            .eq("payment_reference", data.paymentReference);
        } catch {}
      }

      // Release driver back to available when order is finished
      if (
        updated?.driver_id &&
        (data.newStatus === "delivered" || data.newStatus === "cancelled")
      ) {
        try {
          await admin
            .from("active_drivers")
            .update({ status: "available" })
            .eq("driver_id", updated.driver_id);
        } catch {}
      }
    }

    console.log(
      `[adminForceStatus] Order ${data.orderId} → ${data.newStatus}`
    );
    return { success: true };
  });

/**
 * 5. Admin Fetch All Orders (Bypasses RLS via Supabase Admin)
 * Returns all swift_deliveries and vehicle_hire_bookings without RLS filtering.
 * Required because the anon client only returns the logged-in user's own records.
 */
export const adminFetchAllOrders = createServerFn({ method: "POST" })
  .validator((d?: any) => d)
  .handler(async () => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const [delRes, vhRes, actDrvRes, profilesRes, rolesRes] = await Promise.all([
      admin
        .from("swift_deliveries")
        .select("*")
        .order("created_at", { ascending: false }),
      admin
        .from("vehicle_hire_bookings")
        .select("*")
        .order("created_at", { ascending: false }),
      admin.from("drivers").select("*"),
      admin.from("profiles").select("*"),
      admin.from("user_roles").select("*"),
    ]);

    if (delRes.error) console.error("[adminFetchAllOrders] deliveries error:", delRes.error.message);
    if (vhRes.error) console.error("[adminFetchAllOrders] bookings error:", vhRes.error.message);

    return {
      deliveries: delRes.data ?? [],
      vehicleBookings: vhRes.data ?? [],
      activeDrivers: actDrvRes.data ?? [],
      profiles: profilesRes.data ?? [],
      userRoles: rolesRes.data ?? [],
    };
  });

/**
 * 6. Dispatcher Fetch All Deliveries (Bypasses RLS via Supabase Admin)
 * Returns all swift_deliveries so dispatcher can see every dispatch order,
 * including those from customers they don't own.
 * Also fetches profiles and user_roles for the full data model.
 */
export const dispatcherFetchAllDeliveries = createServerFn({ method: "POST" })
  .validator((d?: any) => d)
  .handler(async () => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const [delRes, actDrvRes, profilesRes, rolesRes] = await Promise.all([
      admin
        .from("swift_deliveries")
        .select("*")
        .order("created_at", { ascending: false }),
      admin.from("drivers").select("*"),
      admin.from("profiles").select("*"),
      admin.from("user_roles").select("*"),
    ]);

    return {
      deliveries: delRes.data ?? [],
      activeDrivers: actDrvRes.data ?? [],
      profiles: profilesRes.data ?? [],
      userRoles: rolesRes.data ?? [],
    };
  });

export interface DriverFetchInput {
  driverId: string;
  serviceMode?: "dispatch_rider" | "driver";
}

export interface DriverAcceptInput {
  orderId: string;
  driverId: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

export interface DriverUpdateStatusInput {
  orderId: string;
  driverId: string;
  status: "picked_up" | "in_transit" | "delivered";
}

/**
 * 7. Driver Fetch Cockpit Jobs (Bypasses RLS via Supabase Admin)
 * Allows online drivers to receive all pending passenger ride requests
 * and their own assigned jobs without being blocked by client RLS.
 */
export const driverFetchCockpitJobs = createServerFn({ method: "POST" })
  .validator((input: DriverFetchInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata } = await import("@/lib/swift-order");
    const admin = await getAdmin();

    // Resolve all possible IDs associated with this driver (auth user_id vs public.drivers.id)
    const driverIds = new Set<string>([data.driverId]);
    try {
      const { data: drv } = await admin
        .from("drivers")
        .select("id, user_id")
        .or(`id.eq.${data.driverId},user_id.eq.${data.driverId}`)
        .maybeSingle();
      if (drv) {
        if (drv.id) driverIds.add(drv.id);
        if (drv.user_id) driverIds.add(drv.user_id);
      }
    } catch {}

    const { data: deliveries, error } = await admin
      .from("swift_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[driverFetchCockpitJobs] error:", error.message);
      return { deliveries: [] };
    }

    const result = (deliveries || []).filter((d: any) => {
      const isDeclined = Array.from(driverIds).some((id) =>
        (d.package_type || "").includes(`DECLINED_BY:${id}`)
      );
      if (isDeclined) {
        d.is_declined_by_me = true;
        return true;
      }

      // 1. Any order already assigned to this driver
      if (d.driver_id && driverIds.has(d.driver_id)) return true;

      // 2. Any pending passenger ride (for vehicle drivers / driver mode)
      if (d.status === "pending") {
        const meta = parseOrderMetadata(d.package_type);
        if (data.serviceMode === "driver" && meta.isRide) {
          return true;
        }
      }
      return false;
    });

    return { deliveries: result };
  });

/**
 * 8. Driver Accept Ride Request (Bypasses RLS via Supabase Admin)
 * Atomically assigns the pending ride to the driver with their vehicle details.
 */
export const driverAcceptRideRequest = createServerFn({ method: "POST" })
  .validator((input: DriverAcceptInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata, appendDriverAcceptance } = await import("@/lib/swift-order");
    const admin = await getAdmin();

    const { data: order, error: fetchErr } = await admin
      .from("swift_deliveries")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      throw new Error("Ride order not found.");
    }

    if (order.status !== "pending") {
      throw new Error(`Ride has already been ${order.status}.`);
    }

    const updatedPackageType = appendDriverAcceptance(order.package_type, {
      name: data.driverName || "Swift Driver",
      phone: data.driverPhone || "08000000000",
      plate: data.vehiclePlate || "JOS-829-AA",
      carModel: data.vehicleModel || "Toyota Corolla",
      color: data.vehicleColor || "Active",
      rating: 4.9,
    });

    // Query driver's current position from public.drivers to position them on the map
    let driverLat: number | null = null;
    let driverLng: number | null = null;
    try {
      const { data: driverRow } = await admin
        .from("drivers")
        .select("current_lat, current_lng, full_name, phone, rating_avg")
        .eq("user_id", data.driverId)
        .maybeSingle();
      if (driverRow) {
        driverLat = driverRow.current_lat ?? null;
        driverLng = driverRow.current_lng ?? null;
      }
    } catch {}

    const { data: updated, error: updErr } = await admin
      .from("swift_deliveries")
      .update({
        status: "accepted",
        driver_id: data.driverId,
        driver_lat: driverLat,
        driver_lng: driverLng,
        package_type: updatedPackageType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .select()
      .single();

    if (updErr) throw new Error(updErr.message);

    const meta = parseOrderMetadata(order.package_type);
    if (meta.isRide) {
      try {
        await admin
          .from("vehicle_hire_bookings")
          .update({
            status: "matched",
            driver_name: data.driverName,
            driver_phone: data.driverPhone,
            vehicle_details: `${data.vehicleModel || "Active Vehicle"} • ${data.vehiclePlate || "JOS-829-AA"}`,
          })
          .eq("pickup_location", order.pickup_address)
          .in("status", ["pending", "booked"]);
      } catch (err) {
        console.warn("Syncing vehicle_hire_bookings on accept:", err);
      }
    }

    return { success: true, order: updated };
  });

/**
 * 9. Driver Update Trip Status (Bypasses RLS via Supabase Admin)
 */
export const driverUpdateTripStatus = createServerFn({ method: "POST" })
  .validator((input: DriverUpdateStatusInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata } = await import("@/lib/swift-order");
    const admin = await getAdmin();

    const { data: updated, error: updErr } = await admin
      .from("swift_deliveries")
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("driver_id", data.driverId)
      .select()
      .single();

    if (updErr) throw new Error(updErr.message);

    if (updated) {
      const meta = parseOrderMetadata(updated.package_type);
      if (meta.isRide) {
        const hireStatus = data.status === "delivered" ? "completed" : "in_progress";
        try {
          await admin
            .from("vehicle_hire_bookings")
            .update({ status: hireStatus })
            .eq("pickup_location", updated.pickup_address)
            .in("status", ["matched", "in_progress"]);
        } catch (err) {
          console.warn("Syncing vehicle_hire_bookings status:", err);
        }
      }
    }

    return { success: true, order: updated };
  });

export interface CreateRideInput {
  customerId: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  capacity?: number;
  distanceKm: number;
  fare: number;
  trackingId: string;
  category?: string;
  subCategoryDb?: string;
}

/**
 * 10. Customer Create Ride Request (Bypasses Client JWT Expiration)
 * Inserts the ride into swift_deliveries and vehicle_hire_bookings via service role
 * so customers are never blocked by expired client tokens.
 */
export const customerCreateRideRequest = createServerFn({ method: "POST" })
  .validator((input: CreateRideInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    let finalPackageType = data.packageType;
    if (!finalPackageType.includes("CPHONE:")) {
      try {
        const { data: prof } = await admin
          .from("profiles")
          .select("phone")
          .eq("user_id", data.customerId)
          .maybeSingle();
        if (prof?.phone) {
          finalPackageType += `|||CPHONE:${prof.phone}`;
        }
      } catch (_) {}
    }

    const { data: delivData, error: delivErr } = await admin
      .from("swift_deliveries")
      .insert({
        customer_id: data.customerId,
        pickup_address: data.pickupAddress,
        dropoff_address: data.dropoffAddress,
        package_type: finalPackageType,
        weight_kg: data.capacity || 4,
        distance_km: data.distanceKm,
        estimated_price: data.fare,
        payment_reference: data.trackingId,
        status: "pending",
      })
      .select()
      .single();

    if (delivErr) {
      console.error("[customerCreateRideRequest] delivErr:", delivErr.message);
      throw new Error(delivErr.message);
    }

    let bookingId: string | null = null;
    try {
      const { data: vhData } = await admin
        .from("vehicle_hire_bookings")
        .insert({
          customer_id: data.customerId,
          category: data.category || "Standard",
          sub_category: data.subCategoryDb || "sedan",
          pickup_location: data.pickupAddress,
          destination: data.dropoffAddress,
          start_date: new Date().toISOString().split("T")[0]!,
          duration_days: 1,
          total_price: data.fare,
          status: "booked",
          payment_reference: data.trackingId,
        })
        .select()
        .single();
      if (vhData) bookingId = vhData.id;
    } catch (e: any) {
      console.warn("[customerCreateRideRequest] booking insert error:", e?.message);
    }

    return {
      success: true,
      delivery: delivData,
      bookingId,
    };
  });

export interface CreateDispatchInput {
  customerId: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  weightKg?: number;
  distanceKm: number;
  fare: number;
  trackingId: string;
}

/**
 * 10b. Customer Create Dispatch Order (Bypasses Client JWT Expiration)
 * Inserts parcel dispatch order into swift_deliveries via service role
 */
export const customerCreateDispatchOrder = createServerFn({ method: "POST" })
  .validator((input: CreateDispatchInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    let finalPackageType = data.packageType;
    if (!finalPackageType.includes("CPHONE:")) {
      try {
        const { data: prof } = await admin
          .from("profiles")
          .select("phone")
          .eq("user_id", data.customerId)
          .maybeSingle();
        if (prof?.phone) {
          finalPackageType += `|||CPHONE:${prof.phone}`;
        }
      } catch (_) {}
    }

    const { data: delivData, error: delivErr } = await admin
      .from("swift_deliveries")
      .insert({
        customer_id: data.customerId,
        pickup_address: data.pickupAddress,
        dropoff_address: data.dropoffAddress,
        package_type: finalPackageType,
        weight_kg: data.weightKg || 1,
        distance_km: data.distanceKm,
        estimated_price: data.fare,
        payment_reference: data.trackingId,
        status: "pending",
      })
      .select()
      .single();

    if (delivErr) {
      console.error("[customerCreateDispatchOrder] delivErr:", delivErr.message);
      throw new Error(delivErr.message);
    }

    return {
      success: true,
      delivery: delivData,
    };
  });

/**
 * 11. Customer Cancel Ride Request (Bypasses Client JWT Expiration)
 */
export const customerCancelRideRequest = createServerFn({ method: "POST" })
  .validator((input: { orderId: string; customerId: string; bookingId?: string | null }) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const { error } = await admin
      .from("swift_deliveries")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .eq("customer_id", data.customerId)
      .eq("status", "pending");

    if (error) throw new Error(error.message);

    if (data.bookingId) {
      try {
        await admin
          .from("vehicle_hire_bookings")
          .update({ status: "cancelled" })
          .eq("id", data.bookingId);
      } catch (e: any) {
        console.warn("[customerCancelRideRequest] booking cancel error:", e?.message);
      }
    }

    return { success: true };
  });

export interface ToggleOnlineInput {
  driverId: string;
  isOnline: boolean;
  lat?: number | null;
  lng?: number | null;
}

/**
 * 12. Driver Toggle Online Status (Bypasses RLS via Supabase Admin)
 * Upserts the driver's row in public.drivers (user_id key, is_online boolean)
 * with their latest GPS location. Falls back gracefully if auth metadata is missing.
 */
export const driverToggleOnlineStatus = createServerFn({ method: "POST" })
  .validator((input: ToggleOnlineInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    // Fetch driver auth metadata so we can populate name/email if row is new
    let driverMeta: { full_name?: string; phone?: string; email?: string } = {};
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(data.driverId);
      if (authUser?.user) {
        driverMeta = {
          full_name: authUser.user.user_metadata?.full_name || "",
          phone: authUser.user.user_metadata?.phone || "",
          email: authUser.user.email || "",
        };
      }
    } catch (_) {}

    const { error } = await admin
      .from("drivers")
      .upsert(
        {
          user_id: data.driverId,
          ...(driverMeta.full_name ? { full_name: driverMeta.full_name } : {}),
          ...(driverMeta.phone ? { phone: driverMeta.phone } : {}),
          ...(driverMeta.email ? { email: driverMeta.email } : {}),
          is_online: data.isOnline,
          status: data.isOnline ? "active" : "inactive",
          current_lat: data.lat ?? null,
          current_lng: data.lng ?? null,
          location_updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[driverToggleOnlineStatus] error:", error.message);
      throw new Error(error.message);
    }

    return { success: true };
  });

export interface FetchAvailableDriversInput {
  centerLat?: number;
  centerLng?: number;
  tierId?: string;
}

/**
 * 13. Fetch Available Drivers for Passenger (Bypasses RLS via Supabase Admin)
 * Queries public.drivers (is_online=true) and enriches with auth metadata
 * and vehicle info. Falls back to seeded nearby drivers so the map always
 * has cars visible near the passenger.
 */
export const fetchAvailableDrivers = createServerFn({ method: "POST" })
  .validator((input?: FetchAvailableDriversInput) => input || {})
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const cLat = data?.centerLat || 9.8965; // Jos center
    const cLng = data?.centerLng || 8.8583;

    // 1. Query online drivers from public.drivers (is_online = true)
    const { data: dbDrivers, error: drvErr } = await admin
      .from("drivers")
      .select("user_id, full_name, phone, email, is_online, status, current_lat, current_lng, location_updated_at, rating_avg")
      .eq("is_online", true);

    if (drvErr) console.warn("[fetchAvailableDrivers] db error:", drvErr.message);

    const activeList = dbDrivers || [];
    const driverIds = activeList.map((d) => d.user_id);

    // 2. Fetch vehicle info from fleet_vehicles OR auth metadata
    const vehiclesMap: Record<string, any> = {};
    if (driverIds.length > 0) {
      const { data: vehs } = await admin
        .from("fleet_vehicles")
        .select("assigned_driver_id, make, model, plate_number, color")
        .in("assigned_driver_id", driverIds);
      vehs?.forEach((v) => { if (v.assigned_driver_id) vehiclesMap[v.assigned_driver_id] = v; });
    }

    // Also try public.profiles for any extra info
    const profilesMap: Record<string, any> = {};
    if (driverIds.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", driverIds);
      profs?.forEach((p) => { profilesMap[p.user_id] = p; });
    }

    // 3. Build real driver marker objects from public.drivers rows
    const realDrivers = activeList.map((d, index) => {
      const prof = profilesMap[d.user_id] || {};
      const veh = vehiclesMap[d.user_id] || {};

      // If driver toggled online from Jos default coords, use their actual GPS
      const lat = d.current_lat || (cLat + ((index % 2 === 0 ? 1 : -1) * (0.002 + index * 0.0015)));
      const lng = d.current_lng || (cLng + ((index % 3 === 0 ? 1 : -1) * (0.0025 + index * 0.0012)));

      // Vehicle details: prefer fleet_vehicles, fallback to auth metadata via drivers row
      const vehicleMake = veh.make || "Toyota";
      const vehicleModel = veh.model || "Corolla";
      const vehicleColor = veh.color || "Silver";
      const plateNumber = veh.plate_number || "JOS-829-AA";

      return {
        id: d.user_id,
        name: d.full_name || prof.full_name || `Driver ${d.user_id.slice(-4)}`,
        phone: d.phone || prof.phone || "08000000000",
        rating: d.rating_avg || 4.9,
        trips: 420 + index * 75,
        vehicleType: `${vehicleMake} ${vehicleModel}`,
        vehicleMake,
        plateNumber,
        vehicleColor,
        vehicleModel: `${vehicleColor} ${vehicleMake} ${vehicleModel}`,
        lat,
        lng,
        tierId: "swift_regular",
      };
    });

    // 4. Supplement with seeded nearby drivers so map always has cars visible
    const { generateNearbyDrivers } = await import("@/lib/ride-pricing");
    const seedDrivers = generateNearbyDrivers(cLat, cLng);

    // Merge — real drivers first, seed drivers fill any gaps
    const combined = [...realDrivers];
    for (const s of seedDrivers) {
      if (!combined.some((c) => c.id === s.id)) {
        combined.push(s);
      }
    }

    return {
      drivers: combined,
      realCount: realDrivers.length,
      totalCount: combined.length,
    };
  });

export interface CustomerGetActiveRideInput {
  orderId: string;
  customerId?: string;
}

/**
 * 14. Customer Get Active Ride (Bypasses Client JWT expiration)
 * Uses Supabase Admin to fetch the latest swift_deliveries row for a
 * specific order, enriched with real-time driver coordinates from public.drivers,
 * so the passenger screen can poll for driver acceptance and live GPS location
 * even when the client Supabase session token has expired.
 */
export const customerGetActiveRide = createServerFn({ method: "POST" })
  .validator((input: CustomerGetActiveRideInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const { data: order, error } = await admin
      .from("swift_deliveries")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) {
      console.error("[customerGetActiveRide] error:", error.message);
      throw new Error(error.message);
    }

    if (order && order.driver_id) {
      try {
        const { data: driverRow } = await admin
          .from("drivers")
          .select("current_lat, current_lng, full_name, phone, rating_avg")
          .eq("user_id", order.driver_id)
          .maybeSingle();

        if (driverRow) {
          if (driverRow.current_lat != null) {
            order.driver_lat = driverRow.current_lat;
            order.driver_lng = driverRow.current_lng;
          }
          if (driverRow.full_name) (order as any).driver_name = driverRow.full_name;
          if (driverRow.phone) (order as any).driver_phone = driverRow.phone;
          if (driverRow.rating_avg) (order as any).driver_rating = driverRow.rating_avg;
        }
      } catch (e: any) {
        console.warn("[customerGetActiveRide] enrich driver error:", e?.message);
      }
    }

    return { order };
  });

export interface CustomerFindActiveRideInput {
  customerId: string;
}

/**
 * 15. Customer Find Active Ride (Bypasses Client JWT expiration)
 * Uses Supabase Admin to restore active ride state for a customer on mount or refresh,
 * completely immune to client-side token expiration.
 */
export const customerFindActiveRide = createServerFn({ method: "POST" })
  .validator((input: CustomerFindActiveRideInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    const { data: order, error } = await admin
      .from("swift_deliveries")
      .select("*")
      .eq("customer_id", data.customerId)
      .in("status", ["pending", "accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[customerFindActiveRide] error:", error.message);
      return { order: null };
    }

    if (order && order.driver_id) {
      try {
        const { data: driverRow } = await admin
          .from("drivers")
          .select("current_lat, current_lng, full_name, phone, rating_avg")
          .eq("user_id", order.driver_id)
          .maybeSingle();

        if (driverRow) {
          if (driverRow.current_lat != null) {
            order.driver_lat = driverRow.current_lat;
            order.driver_lng = driverRow.current_lng;
          }
          if (driverRow.full_name) (order as any).driver_name = driverRow.full_name;
          if (driverRow.phone) (order as any).driver_phone = driverRow.phone;
          if (driverRow.rating_avg) (order as any).driver_rating = driverRow.rating_avg;
        }
      } catch (e: any) {
        console.warn("[customerFindActiveRide] enrich driver error:", e?.message);
      }
    }

    return { order };
  });

export interface CustomerRateRideInput {
  orderId: string;
  customerId: string;
  rating: number;
  bookingId?: string | null;
}

/**
 * 16. Customer Rate Ride (Bypasses Client JWT expiration)
 */
export const customerRateRide = createServerFn({ method: "POST" })
  .validator((input: CustomerRateRideInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    await admin
      .from("swift_deliveries")
      .update({ rating: data.rating, updated_at: new Date().toISOString() })
      .eq("id", data.orderId);

    if (data.bookingId) {
      try {
        await admin
          .from("vehicle_hire_bookings")
          .update({ status: "completed" })
          .eq("id", data.bookingId);
      } catch {}
    }

    return { success: true };
  });

export interface CustomerTripRecord {
  id: string;
  reference: string;
  createdAt: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  distanceKm?: number;
  durationText?: string;
  tierName: string;
  category?: string;
  driverName?: string | null;
  driverPhone?: string | null;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  safetyPin?: string | null;
  rating?: number | null;
  source: 'swift_deliveries' | 'vehicle_hire_bookings';
}

export interface CustomerDispatchRecord {
  id: string;
  reference: string;
  createdAt: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  distanceKm?: number;
  weightKg?: number;
  packageType: string;
  description?: string;
  riderName?: string | null;
  riderPhone?: string | null;
  paymentMethod?: string | null;
}

/**
 * 17. Customer Get Trip History (Passenger Rides)
 * Fetches and merges ride history from swift_deliveries & vehicle_hire_bookings via service role
 */
export const customerGetTripHistory = createServerFn({ method: "POST" })
  .validator((input: { customerId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata } = await import("@/lib/swift-order");
    const admin = await getAdmin();

    const trips: CustomerTripRecord[] = [];
    const seenRefs = new Set<string>();

    // 1. Fetch rides from swift_deliveries
    try {
      const { data: deliveries } = await admin
        .from("swift_deliveries")
        .select("*")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false });

      if (deliveries) {
        for (const del of deliveries) {
          const meta = parseOrderMetadata(del.package_type);
          if (meta.isRide) {
            const ref = del.payment_reference || `SWR-${del.id.slice(0, 8)}`;
            seenRefs.add(ref);
            trips.push({
              id: del.id,
              reference: ref,
              createdAt: del.created_at,
              status: del.status || "pending",
              pickupAddress: del.pickup_address,
              dropoffAddress: del.dropoff_address,
              fare: del.estimated_price || 0,
              distanceKm: del.distance_km ?? undefined,
              durationText: del.distance_km ? `~${Math.ceil(del.distance_km * 2.5)} mins` : undefined,
              tierName: meta.tierName || "Standard",
              driverName: meta.driverName || null,
              driverPhone: meta.driverPhone || null,
              vehiclePlate: meta.plateNumber || null,
              vehicleModel: meta.vehicleMake || null,
              vehicleColor: meta.vehicleColor || null,
              safetyPin: meta.safetyPin || meta.pin || null,
              rating: (del as any).rating || null,
              source: "swift_deliveries",
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[customerGetTripHistory] swift_deliveries error:", e?.message);
    }

    // 2. Fetch from vehicle_hire_bookings
    try {
      const { data: bookings } = await admin
        .from("vehicle_hire_bookings")
        .select("*")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false });

      if (bookings) {
        for (const b of bookings) {
          const ref = b.payment_reference || `VHC-${b.id.slice(0, 8)}`;
          if (!seenRefs.has(ref)) {
            trips.push({
              id: b.id,
              reference: ref,
              createdAt: b.created_at,
              status: b.status || "booked",
              pickupAddress: b.pickup_location,
              dropoffAddress: b.destination || "",
              fare: Number(b.total_price) || 0,
              tierName: b.sub_category || b.category || "Standard",
              category: b.category,
              driverName: (b as any).driver_name || null,
              driverPhone: (b as any).driver_phone || null,
              vehiclePlate: null,
              vehicleModel: (b as any).vehicle_details || null,
              vehicleColor: null,
              safetyPin: null,
              rating: null,
              source: "vehicle_hire_bookings",
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[customerGetTripHistory] vehicle_hire_bookings error:", e?.message);
    }

    trips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { trips };
  });

/**
 * 18. Customer Get Dispatch History (Parcel / Courier Deliveries)
 * Fetches package dispatches from swift_deliveries via service role
 */
export const customerGetDispatchHistory = createServerFn({ method: "POST" })
  .validator((input: { customerId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata } = await import("@/lib/swift-order");
    const admin = await getAdmin();

    const dispatches: CustomerDispatchRecord[] = [];

    try {
      const { data: deliveries } = await admin
        .from("swift_deliveries")
        .select("*")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false });

      if (deliveries) {
        for (const del of deliveries) {
          const meta = parseOrderMetadata(del.package_type);
          if (!meta.isRide) {
            dispatches.push({
              id: del.id,
              reference: del.payment_reference || `TRK-${del.id.slice(0, 8)}`,
              createdAt: del.created_at,
              status: del.status || "pending",
              pickupAddress: del.pickup_address,
              dropoffAddress: del.dropoff_address,
              fare: del.estimated_price || 0,
              distanceKm: del.distance_km ?? undefined,
              weightKg: del.weight_kg ?? undefined,
              packageType: meta.tierName || "Standard Parcel",
              description: meta.customerNotes || undefined,
              riderName: meta.driverName || null,
              riderPhone: meta.driverPhone || null,
              paymentMethod: (del as any).payment_method || null,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[customerGetDispatchHistory] error:", e?.message);
    }

    dispatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { dispatches };
  });

export interface DriverWalletJob {
  id: string;
  amount: number; // Driver 30% payout
  grossFare: number; // Customer total fare (100%)
  description: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  isRide: boolean;
  createdAt: string;
}

export interface DriverWalletResult {
  balance: number;
  grossCustomerFare: number;
  completedCount: number;
  transactions: DriverWalletJob[];
}

/**
 * 19. Driver Get Wallet Data (Earnings, Balance, Ledger)
 * Fetches all completed jobs, calculates 30% driver earnings, and formats transactions.
 */
export const driverGetWalletData = createServerFn({ method: "POST" })
  .validator((input: { driverId: string }) => input)
  .handler(async ({ data }): Promise<DriverWalletResult> => {
    const { getAdmin } = await import("@/lib/payments.server");
    const { parseOrderMetadata } = await import("@/lib/swift-order");
    const { calculateDriverEarnings } = await import("@/lib/ride-pricing");
    const admin = await getAdmin();

    const emptyResult: DriverWalletResult = {
      balance: 0,
      grossCustomerFare: 0,
      completedCount: 0,
      transactions: [],
    };

    if (!data?.driverId) return emptyResult;

    try {
      // 1. Resolve all IDs associated with this driver (auth user_id vs public.drivers.id)
      const driverIds = new Set<string>([data.driverId]);
      try {
        const { data: drv } = await admin
          .from("drivers")
          .select("id, user_id")
          .or(`id.eq.${data.driverId},user_id.eq.${data.driverId}`)
          .maybeSingle();
        if (drv) {
          if (drv.id) driverIds.add(drv.id);
          if (drv.user_id) driverIds.add(drv.user_id);
        }
      } catch (err: any) {
        console.warn("[driverGetWalletData] drivers table lookup notice:", err?.message);
      }

      // 2. Fetch all completed jobs for this driver from swift_deliveries
      const { data: jobs, error } = await admin
        .from("swift_deliveries")
        .select("id, driver_id, status, estimated_price, created_at, pickup_address, dropoff_address, package_type")
        .in("driver_id", Array.from(driverIds))
        .eq("status", "delivered")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[driverGetWalletData] Query error:", error.message);
        return emptyResult;
      }

      const completedJobs = jobs || [];
      const grossCustomerFare = completedJobs.reduce((sum, j) => sum + (Number(j.estimated_price) || 0), 0);
      const balance = completedJobs.reduce(
        (sum, j) => sum + calculateDriverEarnings(Number(j.estimated_price) || 0),
        0
      );

      const transactions: DriverWalletJob[] = completedJobs.map((j) => {
        const meta = parseOrderMetadata(j.package_type);
        const grossFare = Number(j.estimated_price) || 0;
        const driverShare = calculateDriverEarnings(grossFare);
        const destination = j.dropoff_address || "Completed Trip";
        const description = meta.isRide
          ? `Passenger Ride (${meta.tierName || "Swift Ride"}) — ${destination}`
          : `Express Parcel Courier — ${destination}`;

        return {
          id: j.id,
          amount: driverShare,
          grossFare,
          description,
          pickupAddress: j.pickup_address || "Pickup",
          dropoffAddress: destination,
          packageType: j.package_type || "Trip",
          isRide: meta.isRide,
          createdAt: j.created_at,
        };
      });

      return {
        balance,
        grossCustomerFare,
        completedCount: completedJobs.length,
        transactions,
      };
    } catch (err: any) {
      console.error("[driverGetWalletData] Unexpected error:", err);
      return emptyResult;
    }
  });

export interface DriverDeclineInput {
  orderId: string;
  driverId: string;
  reason?: string;
}

/**
 * 22. Driver Decline Ride Request
 * Records that the driver declined this specific order so it never reappears
 * in their active list and is preserved in their Trip History under "Declined".
 */
export const driverDeclineRideRequest = createServerFn({ method: "POST" })
  .validator((input: DriverDeclineInput) => input)
  .handler(async ({ data }) => {
    const { getAdmin } = await import("@/lib/payments.server");
    const admin = await getAdmin();

    try {
      const { data: order, error } = await admin
        .from("swift_deliveries")
        .select("package_type, status")
        .eq("id", data.orderId)
        .maybeSingle();

      if (error || !order) {
        return { success: false, message: "Order not found" };
      }

      const now = Date.now();
      const declineTag = `|||DECLINED_BY:${data.driverId}:${now}`;
      const reasonTag = data.reason ? `|||DECLINE_REASON:${encodeURIComponent(data.reason)}` : "";
      const updatedPackage = (order.package_type || "") + declineTag + reasonTag;

      await admin
        .from("swift_deliveries")
        .update({
          package_type: updatedPackage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.orderId);

      return { success: true };
    } catch (err: any) {
      console.error("[driverDeclineRideRequest] error:", err);
      return { success: false, message: err?.message || "Failed to decline ride" };
    }
  });

export interface DriverHistoryTrip {
  id: string;
  type: "ride" | "delivery";
  status: "completed" | "declined" | "in_transit" | "accepted" | "picked_up" | "cancelled";
  pickupAddress: string;
  dropoffAddress: string;
  grossFare: number;
  driverPayout: number;
  distanceKm?: number;
  createdAt: string;
  declinedAt?: string | null;
  declineReason?: string | null;
  reference: string;
  packageType: string;
  customerName?: string;
  customerPhone?: string;
  pin?: string;
  tier?: string;
}

export interface DriverTripHistoryResponse {
  trips: DriverHistoryTrip[];
  stats: {
    totalTrips: number;
    completedCount: number;
    declinedCount: number;
    activeCount: number;
    totalEarnings: number;
    grossFares: number;
  };
}

/**
 * 23. Driver Get Trip History (All Completed, In-Transit & Declined Trips)
 * Retrieves complete historical records for the driver, querying with elevated admin
 * credentials to prevent client RLS restrictions from hiding completed or declined jobs.
 */
export const driverGetTripHistory = createServerFn({ method: "POST" })
  .validator((input: { driverId: string }) => input)
  .handler(async ({ data }): Promise<DriverTripHistoryResponse> => {
    const emptyResponse: DriverTripHistoryResponse = {
      trips: [],
      stats: {
        totalTrips: 0,
        completedCount: 0,
        declinedCount: 0,
        activeCount: 0,
        totalEarnings: 0,
        grossFares: 0,
      },
    };

    if (!data.driverId) return emptyResponse;

    try {
      const { getAdmin } = await import("@/lib/payments.server");
      const { parseOrderMetadata } = await import("@/lib/swift-order");
      const { calculateDriverEarnings } = await import("@/lib/ride-pricing");
      const admin = await getAdmin();

      // Resolve all driver IDs (auth user_id vs public.drivers.id)
      const driverIds = new Set<string>([data.driverId]);
      try {
        const { data: drv } = await admin
          .from("drivers")
          .select("id, user_id")
          .or(`id.eq.${data.driverId},user_id.eq.${data.driverId}`)
          .maybeSingle();
        if (drv) {
          if (drv.id) driverIds.add(drv.id);
          if (drv.user_id) driverIds.add(drv.user_id);
        }
      } catch {}

      // Fetch all deliveries created recently
      const { data: allJobs, error: jobErr } = await admin
        .from("swift_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (jobErr) {
        console.error("[driverGetTripHistory] Query error:", jobErr.message);
        return emptyResponse;
      }

      // Filter trips relevant to this driver: assigned or declined
      const relevant = (allJobs || []).filter((job: any) => {
        const isAssigned = job.driver_id && driverIds.has(job.driver_id);
        const isDeclined = Array.from(driverIds).some((id) =>
          (job.package_type || "").includes(`DECLINED_BY:${id}`)
        );
        return isAssigned || isDeclined;
      });

      // Collect customer IDs to resolve names & phone numbers
      const customerIds = Array.from(
        new Set(relevant.map((j: any) => j.customer_id).filter(Boolean))
      );
      const customerMap = new Map<string, { name?: string; phone?: string }>();
      if (customerIds.length > 0) {
        try {
          const { data: profiles } = await admin
            .from("profiles")
            .select("user_id, id, full_name, phone")
            .or(`user_id.in.(${customerIds.join(",")}),id.in.(${customerIds.join(",")})`);
          (profiles || []).forEach((p: any) => {
            const val = { name: p.full_name, phone: p.phone };
            if (p.user_id) customerMap.set(p.user_id, val);
            if (p.id) customerMap.set(p.id, val);
          });
        } catch {}
      }

      const trips: DriverHistoryTrip[] = [];
      let completedCount = 0;
      let declinedCount = 0;
      let activeCount = 0;
      let totalEarnings = 0;
      let grossFares = 0;

      for (const job of relevant) {
        const meta = parseOrderMetadata(job.package_type);
        const grossFare = Number(job.estimated_price) || 0;
        const driverPayout = calculateDriverEarnings(grossFare);
        const isRide = meta.isRide;

        // Check if declined
        const isDeclined = Array.from(driverIds).some((id) =>
          (job.package_type || "").includes(`DECLINED_BY:${id}`)
        );

        let status: DriverHistoryTrip["status"] = "in_transit";
        let declinedAt: string | null = null;
        let declineReason: string | null = null;

        if (isDeclined) {
          status = "declined";
          declinedCount++;
          // Parse declined timestamp
          const match = (job.package_type || "").match(/DECLINED_BY:[^:]+:(\d+)/);
          if (match && match[1]) {
            declinedAt = new Date(parseInt(match[1], 10)).toISOString();
          } else {
            declinedAt = job.updated_at || job.created_at;
          }
          const reasonMatch = (job.package_type || "").match(/DECLINE_REASON:([^|]+)/);
          if (reasonMatch && reasonMatch[1]) {
            declineReason = decodeURIComponent(reasonMatch[1]);
          }
        } else if (job.status === "delivered") {
          status = "completed";
          completedCount++;
          totalEarnings += driverPayout;
          grossFares += grossFare;
        } else if (job.status === "cancelled") {
          status = "cancelled";
        } else if (job.status === "accepted") {
          status = "accepted";
          activeCount++;
        } else if (job.status === "picked_up") {
          status = "picked_up";
          activeCount++;
        } else {
          status = "in_transit";
          activeCount++;
        }

        const customer = job.customer_id ? customerMap.get(job.customer_id) : undefined;
        // Fallback to phone embedded in package_type if available
        const embeddedPhoneMatch = (job.package_type || "").match(/\|\|\|CPHONE:([\d\+\-\(\)\s]+)/);
        const customerPhone = customer?.phone || (embeddedPhoneMatch ? embeddedPhoneMatch[1] : undefined);

        trips.push({
          id: job.id,
          type: isRide ? "ride" : "delivery",
          status,
          pickupAddress: job.pickup_address || "Pickup Point",
          dropoffAddress: job.dropoff_address || "Destination Point",
          grossFare,
          driverPayout,
          distanceKm: job.distance_km,
          createdAt: job.created_at,
          declinedAt,
          declineReason,
          reference: job.payment_reference || `SWF-${job.id.slice(0, 8).toUpperCase()}`,
          packageType: job.package_type || "",
          customerName: customer?.name,
          customerPhone,
          pin: meta.pin,
          tier: meta.tierName || (meta.tier ? String(meta.tier).toUpperCase() : undefined),
        });
      }

      return {
        trips,
        stats: {
          totalTrips: trips.length,
          completedCount,
          declinedCount,
          activeCount,
          totalEarnings,
          grossFares,
        },
      };
    } catch (err: any) {
      console.error("[driverGetTripHistory] Unexpected error:", err);
      return emptyResponse;
    }
  });




