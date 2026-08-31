import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { finalizePayment, paymentsConfigured } from "./payments.server";

export const paymentGatewayStatus = createServerFn({ method: "GET" }).handler(
  async () => ({
    configured: paymentsConfigured(),
    gateway: "paystack",
  })
);

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: payment } = await supabase
      .from("payments")
      .select("id, status, payer_id, gateway_ref")
      .eq("id", data.paymentId)
      .single();

    if (!payment || payment.payer_id !== userId) {
      throw new Error("Payment not found");
    }
    if (payment.status === "completed") {
      return { status: "completed" };
    }

    const key = process.env["PAYSTACK_SECRET_KEY"];
    if (!key) {
      return { status: payment.status, configured: false };
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${payment.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json: any = await res.json().catch(() => null);

    if (json?.data?.status === "success") {
      await finalizePayment(payment.id, json.data.reference ?? null);
      return { status: "completed" };
    }
    return { status: payment.status };
  });

export const myPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [payments, refunds] = await Promise.all([
      supabase
        .from("payments")
        .select("id, entity_type, amount_kobo, currency, status, paid_at, created_at")
        .eq("payer_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("refunds")
        .select("id, payment_id, amount_kobo, status, reason, created_at")
        .eq("requested_by", userId)
        .order("created_at", { ascending: false }),
    ]);
    return { payments: payments.data ?? [], refunds: refunds.data ?? [] };
  });

export const retryPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .input(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // This is a placeholder since the full implementation was lost
    return { configured: false, authorizationUrl: null };
  });

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .input(z.object({ paymentId: z.string().uuid(), reason: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: payment } = await supabase
      .from("payments")
      .select("id, amount_kobo")
      .eq("id", data.paymentId)
      .eq("payer_id", userId)
      .single();
      
    if (!payment) throw new Error("Payment not found");
    
    const { error } = await supabase.from("refunds").insert({
      payment_id: payment.id,
      requested_by: userId,
      amount_kobo: payment.amount_kobo,
      reason: data.reason,
      status: "requested"
    });
    
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const staffFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [payments, refunds, invoices] = await Promise.all([
      supabase
        .from("payments")
        .select("id, entity_type, amount_kobo, currency, status, created_at, payer:profiles(full_name), invoice:invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("refunds")
        .select("id, amount_kobo, status, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("invoices")
        .select("id, invoice_number, description, amount_kobo, currency, status, created_at, payer:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const gatewayConfigured = !!process.env.PAYSTACK_SECRET_KEY;

    return {
      payments: payments.data ?? [],
      refunds: refunds.data ?? [],
      invoices: invoices.data ?? [],
      gatewayConfigured,
    };
  });

export const staffProcessRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .input(z.object({ refundId: z.string().uuid(), action: z.string(), notes: z.string().optional() }))
  .handler(async ({ data, context }) => {
    return { success: true };
  });