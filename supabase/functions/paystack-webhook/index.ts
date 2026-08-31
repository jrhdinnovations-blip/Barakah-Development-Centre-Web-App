import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Verify HMAC-SHA512 signature sent by Paystack
async function verifyPaystackSignature(body: string, signature: string): Promise<boolean> {
    if (!signature || !PAYSTACK_SECRET_KEY) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(PAYSTACK_SECRET_KEY),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
    );

    const signedBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hexSignature = Array.from(new Uint8Array(signedBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hexSignature === signature;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-paystack-signature") || "";

        // 1. Authenticate event source using Paystack signature
        const isValid = await verifyPaystackSignature(rawBody, signature);
        if (!isValid) {
            console.error("Invalid Paystack webhook signature.");
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const payload = JSON.parse(rawBody);
        const event = payload.event;
        const data = payload.data;

        // 2. Process successful payment events
        if (event === "charge.success") {
            const paymentReference = data.reference;
            const paidAmount = data.amount / 100; // Paystack sends amounts in kobo

            console.log(`Processing verified payment for reference: ${paymentReference} (₦${paidAmount})`);

            // Initialize Supabase admin client with service role key to bypass RLS
            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            // 3. Update Package Deliveries Table
            const { data: deliveryData, error: deliveryError } = await supabaseAdmin
                .from("swift_deliveries")
                .update({
                    status: "pending",
                    updated_at: new Date().toISOString(),
                })
                .eq("payment_reference", paymentReference)
                .select();

            if (deliveryError) {
                console.error("Error updating delivery status:", deliveryError);
            }

            // 4. Update Vehicle Hire Bookings Table
            const { data: vehicleData, error: vehicleError } = await supabaseAdmin
                .from("vehicle_hire_bookings")
                .update({
                    status: "booked",
                    updated_at: new Date().toISOString(),
                })
                .eq("payment_reference", paymentReference)
                .select();

            if (vehicleError) {
                console.error("Error updating vehicle booking status:", vehicleError);
            }

            console.log("Updated records:", {
                deliveriesUpdated: deliveryData?.length || 0,
                vehicleBookingsUpdated: vehicleData?.length || 0,
            });
        }

        // Always return HTTP 200 OK to acknowledge receipt of the webhook
        return new Response(JSON.stringify({ status: "success" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Webhook processing error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});