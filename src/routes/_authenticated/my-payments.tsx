import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PaymentReturn } from "@/components/PaymentReturn";
import { myOrders } from "@/lib/marketplace.functions";
import { myPayments, requestRefund, retryPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/my-payments")({
  head: () => ({
    meta: [
      { title: "My Payments — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPayments,
});

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Client-safe currency formatter for Kobo amounts
function formatNairaKobo(koboAmount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(koboAmount / 100);
}

function MyPayments() {
  const queryClient = useQueryClient();
  const payments = useQuery({ queryKey: ["my-payments"], queryFn: () => myPayments() });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => myOrders() });
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    queryClient.invalidateQueries({ queryKey: ["my-orders"] });
  };

  const retry = useMutation({
    mutationFn: (paymentId: string) => retryPayment({ paymentId }),
    onSuccess: (r) => {
      if (r.configured && r.authorizationUrl) window.location.href = r.authorizationUrl;
      else toast.info("Online payment isn't live yet — our team will contact you.");
    },
    onError: (e) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: () => requestRefund({ paymentId: refundFor!, reason }),
    onSuccess: () => {
      toast.success("Refund requested. Our team will review it.");
      setRefundFor(null);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const pays = payments.data?.payments ?? [];
  const refunds = payments.data?.refunds ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">My Payments</h1>
      <p className="mt-1 text-muted-foreground">Payments, receipts, refunds and orders.</p>
      <div className="mt-6">
        <PaymentReturn onVerified={refresh} />
      </div>

      <section className="card-surface mt-6 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Wallet className="h-5 w-5 text-primary" /> Payments
        </h2>
        {pays.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pays.map((p: any) => {
              const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
              const receipt = Array.isArray(p.receipt) ? p.receipt[0] : p.receipt;
              const openRefund = refunds.some((r: any) => r.payment_id === p.id && ["requested", "approved"].includes(r.status));
              return (
                <li key={p.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{invoice?.description ?? p.entity_type.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmt(p.created_at)}{invoice?.invoice_number ? ` · ${invoice.invoice_number}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{formatNairaKobo(p.amount_kobo, p.currency)}</span>
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{p.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {receipt && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Receipt className="h-3.5 w-3.5" /> Receipt {receipt.receipt_number}
                      </span>
                    )}
                    {["pending", "failed"].includes(p.status) && (
                      <button onClick={() => retry.mutate(p.id)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <RotateCcw className="h-3.5 w-3.5" /> Retry payment
                      </button>
                    )}
                    {p.status === "completed" && !openRefund && (
                      <button onClick={() => setRefundFor(p.id)} className="text-xs font-medium text-destructive hover:underline">
                        Request refund
                      </button>
                    )}
                    {openRefund && <span className="text-xs text-muted-foreground">Refund in progress</span>}
                  </div>
                  {refundFor === p.id && (
                    <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); refund.mutate(); }}>
                      <input className={inputCls} required minLength={5} maxLength={500} placeholder="Reason for refund" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-3">
                        <button className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Submit request</button>
                        <button type="button" onClick={() => setRefundFor(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card-surface mt-6 p-6">
        <h2 className="text-lg font-semibold text-foreground">Orders</h2>
        {(orders.data?.orders ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No orders yet. <Link to="/market" className="text-primary hover:underline">Visit the marketplace</Link>.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(orders.data?.orders ?? []).map((o: any) => {
              const items = (orders.data?.items ?? []).filter((i: any) => i.order_id === o.id);
              return (
                <li key={o.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{o.status.replace(/_/g, " ")}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {items.map((i: any) => {
                      const prod = Array.isArray(i.product) ? i.product[0] : i.product;
                      return <li key={i.id}>{i.quantity} × {prod?.title} — {formatNairaKobo(i.unit_price_kobo * i.quantity, o.currency)}</li>;
                    })}
                  </ul>
                  <p className="mt-2 text-sm font-semibold text-foreground">{formatNairaKobo(o.total_kobo, o.currency)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {refunds.length > 0 && (
        <section className="card-surface mt-6 p-6">
          <h2 className="text-lg font-semibold text-foreground">Refund requests</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {refunds.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-foreground">{formatNairaKobo(r.amount_kobo)} · {r.reason}</span>
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}