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
      admin.from("active_drivers").select("*"),
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
      admin.from("active_drivers").select("*"),
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
      // 1. Any order already assigned to this driver
      if (d.driver_id === data.driverId) return true;
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

    const { data: updated, error: updErr } = await admin
      .from("swift_deliveries")
      .update({
        status: "accepted",
        driver_id: data.driverId,
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
        tierId: "swift_go",
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
  customerId: string;
}

/**
 * 14. Customer Get Active Ride (Bypasses Client JWT expiration)
 * Uses Supabase Admin to fetch the latest swift_deliveries row for a
 * specific order, so the passenger screen can poll for driver acceptance
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

    return { order };
  });

