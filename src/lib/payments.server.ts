import { z } from "zod";

export const kobo = z.number().int().min(1).max(1_000_000_000);

export function formatNaira(koboAmount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(koboAmount / 100);
}

export function makeNumber(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function paymentsConfigured() {
  return Boolean(process.env["PAYSTACK_SECRET_KEY"]);
}

export async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

/** Calls Paystack's hosted initialize endpoint. Never handles raw card data. */
export async function initializePaystack(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}) {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) return null;
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      reference: opts.reference,
      callback_url: opts.callbackUrl,
    }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.status) throw new Error(json?.message ?? "Payment gateway error");
  return json.data.authorization_url as string;
}

type EntityType = "booking" | "order" | "travel_instalment" | "donation" | "swift_ride";

/** Creates the invoice + pending payment pair, then asks the gateway for a hosted page. */
export async function createPaymentIntent(
  supabase: any,
  userId: string,
  input: {
    entityType: EntityType;
    entityId: string;
    amountKobo: number;
    description: string;
    legalEntityId?: string | null;
    programmeId?: string | null;
    callbackPath: string;
  },
) {
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      invoice_number: makeNumber("INV"),
      payer_id: userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      description: input.description,
      amount_kobo: input.amountKobo,
      legal_entity_id: input.legalEntityId ?? null,
      programme_id: input.programmeId ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (invErr) throw new Error(invErr.message);

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      payer_id: userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      amount_kobo: input.amountKobo,
      legal_entity_id: input.legalEntityId ?? null,
      programme_id: input.programmeId ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (payErr) throw new Error(payErr.message);

  const { data: userRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();

  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) {
    return { paymentId: payment.id as string, configured: false, authorizationUrl: null as string | null };
  }
  const origin =
    process.env["SITE_URL"] ?? process.env["VITE_SITE_URL"] ?? "https://localhost:8080";
  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email ?? `${userId}@barakah.local`;
  const authorizationUrl = await initializePaystack({
    email,
    amountKobo: input.amountKobo,
    reference: payment.id,
    callbackUrl: `${origin}${input.callbackPath}`,
  });
  return { paymentId: payment.id as string, configured: true, authorizationUrl };
}

/**
 * Finalizes a payment after gateway verification (webhook or verify call).
 * Idempotent: a completed payment is left untouched. Issues a receipt and
 * updates the related entity (booking / order / travel instalment).
 */
export async function finalizePayment(paymentId: string, gatewayRef: string | null) {
  const admin = await getAdmin();
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, entity_type, entity_id, payer_id, amount_kobo, invoice_id")
    .eq("id", paymentId)
    .single();
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "completed") return { ok: true, already: true };

  await admin
    .from("payments")
    .update({ status: "completed", paid_at: new Date().toISOString(), gateway_ref: gatewayRef })
    .eq("id", paymentId);
  if (payment.invoice_id) {
    await admin.from("invoices").update({ status: "paid" }).eq("id", payment.invoice_id);
  }
  await admin.from("receipts").insert({
    receipt_number: makeNumber("RCP"),
    payment_id: paymentId,
    issued_to: payment.payer_id,
  });

  if (payment.entity_type === "booking" && payment.entity_id) {
    await admin.from("bookings").update({ status: "confirmed" }).eq("id", payment.entity_id);
  } else if (payment.entity_type === "order" && payment.entity_id) {
    await admin.from("orders").update({ status: "payment_confirmed" }).eq("id", payment.entity_id);
    // decrement stock for physical products
    const { data: items } = await admin
      .from("order_items")
      .select("product_id, quantity, product:products(is_digital, stock_quantity)")
      .eq("order_id", payment.entity_id);
    for (const item of items ?? []) {
      const p: any = Array.isArray(item.product) ? item.product[0] : item.product;
      if (p && !p.is_digital && typeof p.stock_quantity === "number") {
        await admin
          .from("products")
          .update({ stock_quantity: Math.max(0, p.stock_quantity - item.quantity) })
          .eq("id", item.product_id);
      }
    }
  } else if (payment.entity_type === "travel_instalment" && payment.entity_id) {
    await admin
      .from("payment_plan_instalments")
      .update({ status: "paid", payment_id: paymentId })
      .eq("id", payment.entity_id);
    const { data: inst } = await admin
      .from("payment_plan_instalments")
      .select("plan_id")
      .eq("id", payment.entity_id)
      .single();
    if (inst) {
      const { count: remaining } = await admin
        .from("payment_plan_instalments")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", inst.plan_id)
        .eq("status", "due");
      if ((remaining ?? 0) === 0) {
        const { data: plan } = await admin
          .from("payment_plans")
          .update({ status: "completed" })
          .eq("id", inst.plan_id)
          .select("enrolment_id")
          .single();
        if (plan) {
          await admin
            .from("travel_enrolments")
            .update({ status: "confirmed" })
            .eq("id", plan.enrolment_id);
        }
      } else {
        const { data: plan } = await admin
          .from("payment_plans")
          .select("enrolment_id")
          .eq("id", inst.plan_id)
          .single();
        if (plan) {
          await admin
            .from("travel_enrolments")
            .update({ status: "payment_in_progress" })
            .eq("id", plan.enrolment_id)
            .eq("status", "documents_verified");
        }
      }
    }
  } else if (payment.entity_type === "swift_ride" && payment.entity_id) {
    const { settleRidePayment } = await import("./swift.server");
    await settleRidePayment(admin, {
      rideId: payment.entity_id,
      paymentId,
      method: "gateway",
    });
  }

  await admin.rpc("notify_user", {
    _user_id: payment.payer_id,
    _type: "payment_completed",
    _title: "Payment received",
    _body: `Your payment of ${formatNaira(payment.amount_kobo)} was confirmed.`,
    _link: "/my-payments",
  });
  return { ok: true };
}
