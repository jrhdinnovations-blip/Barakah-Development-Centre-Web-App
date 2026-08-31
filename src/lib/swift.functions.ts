import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSwiftStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { count, error } = await supabase
      .from("swift_deliveries")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw new Error(error.message);
    }

    return { totalDeliveries: count || 0 };
  });

export const getSharedRide = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    return {
      status: "in_progress",
      pickup_address: "Pickup",
      destination_address: "Destination",
      driver_name: "Driver",
      vehicle_description: "Vehicle",
      plate_number: "",
      ended: false,
      driver_lat: null,
      driver_lng: null
    };
  });