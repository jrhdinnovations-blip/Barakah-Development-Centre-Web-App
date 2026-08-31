import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCaseAssessment,
  addCaseReferral,
  assignCase,
  caseDetail,
  caseQueue,
  recordEligibility,
  setCaseStatus,
} from "@/lib/cases.functions";
import { supabase } from "@/integrations/supabase/client";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

const NEXT_STATUSES = [
  "intake", "assessment", "eligibility_review", "approved", "declined",
  "referred", "in_support", "follow_up", "closed",
] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CasesTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [officers, setOfficers] = useState<{ user_id: string; full_name: string }[] | null>(null);

  const queue = useQuery({ queryKey: ["case-queue"], queryFn: () => caseQueue() });
  const detail = useQuery({
    queryKey: ["case-detail", selectedId],
    queryFn: () => caseDetail({ data: { caseId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const loadOfficers = async () => {
    if (officers) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "case_officer")
      .eq("status", "active");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return setOfficers([]);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    setOfficers(profiles ?? []);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["case-queue"] });
    queryClient.invalidateQueries({ queryKey: ["case-detail", selectedId] });
  };

  const assign = useMutation({
    mutationFn: (v: { caseId: string; officerId: string }) => assignCase({ data: v }),
    onSuccess: () => { toast.success("Case assigned."); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { caseId: string; status: (typeof NEXT_STATUSES)[number] }) => setCaseStatus({ data: v }),
    onSuccess: () => { toast.success("Status updated."); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const assess = useMutation({
    mutationFn: (v: { caseId: string; notes: string; recommendation?: string | undefined }) =>
      addCaseAssessment({
        data: { caseId: v.caseId, notes: v.notes, ...(v.recommendation ? { recommendation: v.recommendation } : {}) },
      }),
    onSuccess: () => { toast.success("Assessment saved."); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const eligibility = useMutation({
    mutationFn: (v: { caseId: string; eligible: boolean; criteriaNotes?: string | undefined }) =>
      recordEligibility({
        data: { caseId: v.caseId, eligible: v.eligible, ...(v.criteriaNotes ? { criteriaNotes: v.criteriaNotes } : {}) },
      }),
    onSuccess: () => { toast.success("Eligibility recorded."); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const refer = useMutation({
    mutationFn: (v: { caseId: string; referredTo: string; reason?: string | undefined }) =>
      addCaseReferral({
        data: { caseId: v.caseId, referredTo: v.referredTo, ...(v.reason ? { reason: v.reason } : {}) },
      }),
    onSuccess: () => { toast.success("Referral recorded."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const [notes, setNotes] = useState("");
  const [reco, setReco] = useState("");
  const [eligNotes, setEligNotes] = useState("");
  const [refTo, setRefTo] = useState("");
  const [refReason, setRefReason] = useState("");

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="card-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Case queue</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Only cases assigned to you are visible. Confidential — handle with care.
        </p>
        <ul className="mt-4 space-y-2">
          {(queue.data ?? []).map((c: any) => {
            const requester = Array.isArray(c.requester) ? c.requester[0] : c.requester;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedId === c.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{c.need_summary}</span>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {requester?.full_name ?? "Requester"} · {fmt(c.created_at)}
                  </p>
                </button>
              </li>
            );
          })}
          {(queue.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No cases in your queue.</p>
          )}
        </ul>

        {isAdmin && (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Assign a case (admin)</h3>
            <div className="mt-2 flex gap-2">
              <select
                className={inputCls}
                defaultValue=""
                onFocus={loadOfficers}
                onChange={(e) => {
                  if (selectedId && e.target.value)
                    assign.mutate({ caseId: selectedId, officerId: e.target.value });
                }}
              >
                <option value="">Select case officer…</option>
                {(officers ?? []).map((o) => (
                  <option key={o.user_id} value={o.user_id}>{o.full_name}</option>
                ))}
              </select>
            </div>
            {!selectedId && (
              <p className="mt-1 text-xs text-muted-foreground">Select a case first.</p>
            )}
          </div>
        )}
      </div>

      <div className="card-surface p-6">
        {!selectedId || !detail.data ? (
          <p className="text-sm text-muted-foreground">Select a case to review it.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">{detail.data.case.need_summary}</h2>
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">
                  {detail.data.case.status.replace(/_/g, " ")}
                </span>
              </div>
              {detail.data.case.circumstances && (
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {detail.data.case.circumstances}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Move to status</label>
              <select
                className={`${inputCls} mt-1`}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value)
                    setStatus.mutate({ caseId: selectedId, status: e.target.value as any });
                }}
              >
                <option value="">Choose…</option>
                {NEXT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                assess.mutate({ caseId: selectedId, notes, recommendation: reco || undefined });
                setNotes(""); setReco("");
              }}
              className="space-y-2 border-t border-border pt-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Add assessment</h3>
              <textarea className={inputCls} rows={3} required minLength={5} placeholder="Assessment notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <input className={inputCls} placeholder="Recommendation (optional)" value={reco} onChange={(e) => setReco(e.target.value)} />
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save assessment</button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const eligible = (form.elements.namedItem("eligible") as HTMLSelectElement).value === "yes";
                eligibility.mutate({ caseId: selectedId, eligible, criteriaNotes: eligNotes || undefined });
                setEligNotes("");
              }}
              className="space-y-2 border-t border-border pt-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Eligibility determination</h3>
              <select name="eligible" className={inputCls} required defaultValue="">
                <option value="" disabled>Eligible?</option>
                <option value="yes">Eligible</option>
                <option value="no">Not eligible</option>
              </select>
              <input className={inputCls} placeholder="Criteria notes (optional)" value={eligNotes} onChange={(e) => setEligNotes(e.target.value)} />
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Record</button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                refer.mutate({ caseId: selectedId, referredTo: refTo, reason: refReason || undefined });
                setRefTo(""); setRefReason("");
              }}
              className="space-y-2 border-t border-border pt-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Refer case</h3>
              <input className={inputCls} required minLength={2} placeholder="Referred to (organisation / person)" value={refTo} onChange={(e) => setRefTo(e.target.value)} />
              <input className={inputCls} placeholder="Reason (optional)" value={refReason} onChange={(e) => setRefReason(e.target.value)} />
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add referral</button>
            </form>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Status history</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {detail.data.history.map((h: any) => (
                  <li key={h.id}>
                    {h.from_status ? `${h.from_status.replace(/_/g, " ")} → ` : ""}
                    <span className="font-medium text-foreground">{h.to_status.replace(/_/g, " ")}</span>
                    {" · "}{fmt(h.created_at)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
