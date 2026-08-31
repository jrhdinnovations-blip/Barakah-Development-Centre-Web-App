import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
    recipient_email: string;
    customer_name?: string;
    reference: string;
    status: string;
    event_type: "ORDER_CREATED" | "DRIVER_ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
    pickup_address?: string;
    dropoff_address?: string;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload: NotificationPayload = await req.json();
        const { recipient_email, reference, status, event_type, pickup_address, dropoff_address } = payload;

        if (!recipient_email) {
            throw new Error("Missing recipient email address.");
        }

        let subject = `Swift Move Update - Order #${reference.slice(-8)}`;
        let htmlContent = "";

        switch (event_type) {
            case "ORDER_CREATED":
                subject = `Booking Confirmed - Ref #${reference.slice(-8)}`;
                htmlContent = `
          <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; rounded-lg: 12px;">
            <h2 style="color: #3b82f6;">Order Booking Confirmed</h2>
            <p>Your order <strong>#${reference}</strong> has been created and is awaiting driver dispatch.</p>
            <hr style="border-color: #334155;" />
            <p><strong>Pickup:</strong> ${pickup_address || "N/A"}</p>
            <p><strong>Dropoff:</strong> ${dropoff_address || "N/A"}</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Thank you for using Swift Move Logistics.</p>
          </div>
        `;
                break;

            case "DRIVER_ASSIGNED":
                subject = `Driver Assigned - Ref #${reference.slice(-8)}`;
                htmlContent = `
          <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #a855f7;">Driver Assigned</h2>
            <p>A driver has accepted your dispatch order <strong>#${reference}</strong> and is en route to pickup.</p>
          </div>
        `;
                break;

            case "IN_TRANSIT":
                subject = `Package In Transit - Ref #${reference.slice(-8)}`;
                htmlContent = `
          <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #3b82f6;">Parcel In Transit</h2>
            <p>Your package is picked up and currently on its way to destination.</p>
          </div>
        `;
                break;

            case "DELIVERED":
                subject = `Delivery Completed - Ref #${reference.slice(-8)}`;
                htmlContent = `
          <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #10b981;">Delivery Completed</h2>
            <p>Order <strong>#${reference}</strong> was successfully delivered.</p>
          </div>
        `;
                break;
        }

        // Dispatch via Resend HTTP API
        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Swift Move Alerts <notifications@swiftmove.com>",
                to: [recipient_email],
                subject,
                html: htmlContent,
            }),
        });

        const resendData = await resendResponse.json();

        return new Response(JSON.stringify({ success: true, resendData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});