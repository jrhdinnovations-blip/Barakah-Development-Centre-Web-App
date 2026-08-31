import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    // Only process new dispatches that are actively searching
    if (payload.type !== 'INSERT' || record.status !== 'searching_for_driver') {
      return new Response(JSON.stringify({ message: "Ignored" }), { status: 200 });
    }

    // Initialize Supabase Admin Client to bypass RLS for system operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Searching for drivers near Dispatch ID: ${record.id}`);

    // 1. Query the PostGIS RPC to find the single closest available driver within 5km (5000m)
    const { data: nearestDrivers, error: rpcError } = await supabaseAdmin.rpc(
      'get_nearest_available_drivers',
      {
        search_lng: record.pickup_lng,
        search_lat: record.pickup_lat,
        search_radius_meters: 5000,
        max_results: 1
      }
    );

    if (rpcError) throw rpcError;

    if (!nearestDrivers || nearestDrivers.length === 0) {
      console.log("No drivers available in the radius. Job remains pending.");
      // In a production system, you'd push this to a Redis retry queue (BullMQ) here.
      return new Response(JSON.stringify({ status: "no_drivers_available" }), { headers: corsHeaders });
    }

    const assignedDriverId = nearestDrivers[0].driver_id;
    const distance = nearestDrivers[0].distance_meters;

    console.log(`Match found! Driver: ${assignedDriverId} at ${distance.toFixed(2)} meters away.`);

    // 2. Transaction: Assign the job to the driver AND lock the driver's availability
    const { error: updateDispatchError } = await supabaseAdmin
      .from('enterprise_dispatches')
      .update({ 
        assigned_driver_id: assignedDriverId, 
        status: 'driver_assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateDispatchError) throw updateDispatchError;

    const { error: updateDriverError } = await supabaseAdmin
      .from('active_drivers')
      .update({ status: 'on_job' })
      .eq('driver_id', assignedDriverId);

    if (updateDriverError) throw updateDriverError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        assigned_driver: assignedDriverId,
        distance_meters: distance
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Dispatch Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});