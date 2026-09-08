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
