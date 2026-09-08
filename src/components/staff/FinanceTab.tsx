import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira } from "@/lib/currency";
import { staffFinanceOverview, staffProcessRefund } from "@/lib/payments.functions";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function FinanceTab() {
  const queryClient = useQueryClient();
  const finance = useQuery({ queryKey: ["staff-finance"], queryFn: () => staffFinanceOverview() });

  const processRefund = useMutation({
    mutationFn: (v: { refundId: string; action: "approved" | "processed" | "declined" }) =>
      staffProcessRefund({ data: v }),
    onSuccess: () => {
      toast.success("Refund updated.");
      queryClient.invalidateQueries({ queryKey: ["staff-finance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const d = finance.data;

  return (
    <div className="mt-8 space-y-8">
      {!d?.gatewayConfigured && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          The payment gateway is not configured yet. Payment records, invoices and reconciliation
          work now; live card collection activates once the gateway key is added.
        </div>
      )}

      <div className="card-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Payments</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Payer</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {(d?.payments ?? []).map((p: any) => {
                const payer = Array.isArray(p.payer) ? p.payer[0] : p.payer;
                const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">{invoice?.invoice_number ?? "—"}</td>
                    <td className="py-2 pr-4">{payer?.full_name ?? "—"}</td>
                    <td className="py-2 pr-4 capitalize">{p.entity_type.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4">{formatNaira(p.amount_kobo, p.currency)}</td>
                    <td className="py-2 pr-4 capitalize">{p.status}</td>
                    <td className="py-2 text-xs text-muted-foreground">{fmt(p.created_at)}</td>
                  </tr>
                );
              })}
              {(d?.payments ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Refund requests</h2>
          <ul className="mt-4 space-y-3">
            {(d?.refunds ?? []).map((r: any) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{formatNaira(r.amount_kobo)}</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{r.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                {["requested", "approved"].includes(r.status) && (
                  <div className="mt-2 flex gap-2">
                    {r.status === "requested" && (
                      <button onClick={() => processRefund.mutate({ refundId: r.id, action: "approved" })} className="text-xs font-medium text-primary hover:underline">Approve</button>
                    )}
                    <button onClick={() => processRefund.mutate({ refundId: r.id, action: "processed" })} className="text-xs font-medium text-primary hover:underline">Mark processed</button>
                    <button onClick={() => processRefund.mutate({ refundId: r.id, action: "declined" })} className="text-xs font-medium text-destructive hover:underline">Decline</button>
                  </div>
                )}
              </li>
            ))}
            {(d?.refunds ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No refund requests.</p>
            )}
          </ul>
        </div>

        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(d?.invoices ?? []).map((i: any) => {
              const payer = Array.isArray(i.payer) ? i.payer[0] : i.payer;
              return (
                <li key={i.id} className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <span className="font-mono text-xs">{i.invoice_number}</span>
                    <span className="ml-2 text-muted-foreground">{i.description}</span>
                  </div>
                  <span className="text-xs">
                    {formatNaira(i.amount_kobo, i.currency)} · <span className="capitalize">{i.status}</span>
                    {payer?.full_name ? ` · ${payer.full_name}` : ""}
                  </span>
                </li>
              );
            })}
            {(d?.invoices ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
