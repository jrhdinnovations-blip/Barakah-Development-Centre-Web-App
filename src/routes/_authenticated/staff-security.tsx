import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/staff-security")({
  head: () => ({
    meta: [{ title: "Staff Security — MFA" }, { name: "robots", content: "noindex" }],
  }),
  component: StaffSecurity,
});

function StaffSecurity() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"loading" | "enroll" | "challenge">("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!data) return;
      if (data.currentLevel === "aal2") {
        navigate({ to: "/staff" });
        return;
      }
      if (data.nextLevel === "aal2") {
        // Factor exists — need challenge
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          setFactorId(totp.id);
          setMode("challenge");
          return;
        }
      }
      // No factor — enroll
      const { data: enrol, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Barakah Staff",
      });
      if (error || !enrol) {
        toast.error("Could not start MFA setup.");
        return;
      }
      setFactorId(enrol.id);
      setQr(enrol.totp.qr_code);
      setMode("enroll");
    })();
  }, [navigate]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) throw new Error(chErr?.message ?? "Challenge failed");
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (error) throw new Error(error.message);
      toast.success(mode === "enroll" ? "Two-factor security enabled." : "Verified.");
      navigate({ to: "/staff" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card-surface p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <ShieldCheck className="h-6 w-6 text-primary-foreground" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Staff Security Check</h1>

        {mode === "loading" && <p className="mt-4 text-sm text-muted-foreground">Preparing…</p>}

        {mode === "enroll" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Staff accounts require two-factor authentication. Scan this code with an authenticator
              app (e.g. Google Authenticator), then enter the 6-digit code.
            </p>
            {qr && (
              <div
                className="mx-auto mt-6 w-48 overflow-hidden rounded-lg border border-border bg-background p-2"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            )}
          </>
        )}
        {mode === "challenge" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app to continue to the staff dashboard.
          </p>
        )}

        {mode !== "loading" && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              required
              className="w-full rounded-lg border border-input bg-background px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Verifying…" : mode === "enroll" ? "Enable MFA" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
