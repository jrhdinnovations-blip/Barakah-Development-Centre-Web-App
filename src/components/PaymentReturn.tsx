import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyPayment } from "@/lib/payments.functions";

type Result = { ok: boolean; message: string } | null;

/**
 * Handles return from the hosted payment checkout: reads ?verify=<reference>
 * from the URL, verifies the charge, and shows a banner.
 */
export function PaymentReturn({ onVerified }: { onVerified?: () => void }) {
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("verify") || params.get("reference") || params.get("trxref");
    if (!ref) return;
    window.history.replaceState({}, "", window.location.pathname);
    // ref could be a UUID paymentId or a gateway reference
    // verifyPayment supports both UUID and gateway references
    verifyPayment({ data: { paymentId: ref } })
      .then((r) => {
        const ok = r.status === "completed";
        setResult({
          ok,
          message: ok
            ? "Payment confirmed. Your records have been updated and a receipt issued."
            : `Payment ${r.status.replace(/_/g, " ")} — if you were charged, contact us with your reference: ${ref}`,
        });
        if (ok) onVerified?.();
      })
      .catch((e) => setResult({ ok: false, message: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;
  return (
    <div
      className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm ${
        result.ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      {result.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
      {result.message}
    </div>
  );
}
