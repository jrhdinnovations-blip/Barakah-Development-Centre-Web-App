import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Gateway not configured", { status: 503 });

        const signature = request.headers.get("x-paystack-signature");
        const body = await request.text();
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        if (
          !signature ||
          signature.length !== expected.length ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body);
        if (event?.event === "charge.success" && event?.data?.reference) {
          const { finalizePayment } = await import("@/lib/payments.server");
          await finalizePayment(event.data.reference, event.data.reference);
        } else if (event?.event === "charge.failed" && event?.data?.reference) {
          const { getAdmin } = await import("@/lib/payments.server");
          const admin = await getAdmin();
          await admin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", event.data.reference)
            .eq("status", "pending");
        }
        return new Response("ok");
      },
    },
  },
});
