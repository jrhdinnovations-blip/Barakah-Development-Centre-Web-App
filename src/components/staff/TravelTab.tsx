import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira } from "@/lib/payments.server";
import {
  staffCreatePaymentPlan,
  staffListEnrolments,
  staffListPackages,
  staffSetEnrolmentStatus,
  staffUpsertPackage,
} from "@/lib/travel.functions";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function TravelTab() {
  const queryClient = useQueryClient();
  const packages = useQuery({ queryKey: ["staff-packages"], queryFn: () => staffListPackages() });
  const enrolments = useQuery({ queryKey: ["staff-enrolments"], queryFn: () => staffListEnrolments() });

  const [pkg, setPkg] = useState({ slug: "", title: "", summary: "", providerName: "", startsOn: "", endsOn: "", price: "", status: "draft" });
  const [planEnrolment, setPlanEnrolment] = useState<string | null>(null);
  const [instLabel, setInstLabel] = useState("Deposit");
  const [instAmount, setInstAmount] = useState("");
  const [instDate, setInstDate] = useState("");
  const [planItems, setPlanItems] = useState<{ label: string; amountKobo: number; dueDate: string }[]>([]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-packages"] });
    queryClient.invalidateQueries({ queryKey: ["staff-enrolments"] });
  };

  const upsertPackage = useMutation({
    mutationFn: () =>
      staffUpsertPackage({
        data: {
          slug: pkg.slug,
          title: pkg.title,
          summary: pkg.summary || undefined,
          providerName: pkg.providerName || undefined,
          startsOn: pkg.startsOn || "",
          endsOn: pkg.endsOn || "",
          priceKobo: Math.round(Number(pkg.price) * 100),
          status: pkg.status as any,
        },
      }),
    onSuccess: () => {
      toast.success("Package saved.");
      setPkg({ slug: "", title: "", summary: "", providerName: "", startsOn: "", endsOn: "", price: "", status: "draft" });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (v: { enrolmentId: string; status: "documents_verified" | "confirmed" | "completed" | "cancelled" }) =>
      staffSetEnrolmentStatus({ data: v }),
    onSuccess: () => { toast.success("Enrolment updated."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const createPlan = useMutation({
    mutationFn: () =>
      staffCreatePaymentPlan({ data: { enrolmentId: planEnrolment!, instalments: planItems } }),
    onSuccess: () => {
      toast.success("Payment plan created.");
      setPlanEnrolment(null);
      setPlanItems([]);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const e = enrolments.data;

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="card-surface space-y-3 p-6"
          onSubmit={(ev) => { ev.preventDefault(); upsertPackage.mutate(); }}
        >
          <h2 className="text-lg font-semibold text-foreground">New travel package</h2>
          <input className={inputCls} required placeholder="slug (e.g. umrah-2027)" pattern="[a-z0-9-]+" value={pkg.slug} onChange={(e2) => setPkg({ ...pkg, slug: e2.target.value })} />
          <input className={inputCls} required placeholder="Package title" value={pkg.title} onChange={(e2) => setPkg({ ...pkg, title: e2.target.value })} />
          <textarea className={inputCls} rows={2} placeholder="Summary" value={pkg.summary} onChange={(e2) => setPkg({ ...pkg, summary: e2.target.value })} />
          <input className={inputCls} placeholder="Provider name (attributed clearly)" value={pkg.providerName} onChange={(e2) => setPkg({ ...pkg, providerName: e2.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} type="date" value={pkg.startsOn} onChange={(e2) => setPkg({ ...pkg, startsOn: e2.target.value })} />
            <input className={inputCls} type="date" value={pkg.endsOn} onChange={(e2) => setPkg({ ...pkg, endsOn: e2.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} required type="number" min="0" step="0.01" placeholder="Price (₦)" value={pkg.price} onChange={(e2) => setPkg({ ...pkg, price: e2.target.value })} />
            <select className={inputCls} value={pkg.status} onChange={(e2) => setPkg({ ...pkg, status: e2.target.value })}>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save package</button>
        </form>

        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Packages</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(packages.data ?? []).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-foreground">{p.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatNaira(p.price_kobo, p.currency)} · <span className="capitalize">{p.status}</span>
                </span>
              </li>
            ))}
            {(packages.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No packages yet.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Enrolments & document verification</h2>
        <ul className="mt-4 space-y-3">
          {(e?.enrolments ?? []).map((en: any) => {
            const pkg2 = Array.isArray(en.package) ? en.package[0] : en.package;
            const traveller = Array.isArray(en.traveller) ? en.traveller[0] : en.traveller;
            const passenger = (e?.passengers ?? []).find((p: any) => p.enrolment_id === en.id);
            const plan = (e?.plans ?? []).find((p: any) => p.enrolment_id === en.id);
            const inst = plan ? (e?.instalments ?? []).filter((i: any) => i.plan_id === plan.id) : [];
            return (
              <li key={en.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-foreground">{traveller?.full_name ?? "Traveller"}</span>
                    <span className="ml-2 text-muted-foreground">{pkg2?.title}</span>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{en.status.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {passenger
                    ? `Passport: ${passenger.passport_number ?? "—"} · DOB: ${passenger.date_of_birth ?? "—"}`
                    : "No passenger details submitted yet."}
                </p>
                {plan && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plan: {formatNaira(plan.total_kobo, plan.currency)} ·{" "}
                    {inst.filter((i: any) => i.status === "paid").length}/{inst.length} instalments paid
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {passenger && en.status === "documents_pending" && (
                    <button onClick={() => setStatus.mutate({ enrolmentId: en.id, status: "documents_verified" })} className="text-xs font-medium text-primary hover:underline">
                      Verify documents
                    </button>
                  )}
                  {!plan && (
                    <button onClick={() => { setPlanEnrolment(en.id); setPlanItems([]); }} className="text-xs font-medium text-primary hover:underline">
                      Create payment plan
                    </button>
                  )}
                  {en.status !== "completed" && en.status !== "cancelled" && (
                    <>
                      <button onClick={() => setStatus.mutate({ enrolmentId: en.id, status: "completed" })} className="text-xs font-medium text-primary hover:underline">Mark completed</button>
                      <button onClick={() => setStatus.mutate({ enrolmentId: en.id, status: "cancelled" })} className="text-xs font-medium text-destructive hover:underline">Cancel</button>
                    </>
                  )}
                </div>

                {planEnrolment === en.id && (
                  <div className="mt-3 space-y-2 rounded-lg bg-accent/50 p-3">
                    <h4 className="text-xs font-semibold text-foreground">Payment plan instalments</h4>
                    {planItems.map((i, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {i.label} — {formatNaira(i.amountKobo)} due {i.dueDate}
                      </p>
                    ))}
                    <div className="grid grid-cols-3 gap-2">
                      <input className={inputCls} placeholder="Label" value={instLabel} onChange={(e2) => setInstLabel(e2.target.value)} />
                      <input className={inputCls} type="number" min="1" step="0.01" placeholder="Amount (₦)" value={instAmount} onChange={(e2) => setInstAmount(e2.target.value)} />
                      <input className={inputCls} type="date" value={instDate} onChange={(e2) => setInstDate(e2.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!instLabel || !instAmount || !instDate) return;
                          setPlanItems([...planItems, { label: instLabel, amountKobo: Math.round(Number(instAmount) * 100), dueDate: instDate }]);
                          setInstAmount(""); setInstDate("");
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        + Add instalment
                      </button>
                      {planItems.length > 0 && (
                        <button type="button" onClick={() => createPlan.mutate()} className="text-xs font-semibold text-primary hover:underline">
                          Save plan ({planItems.length} instalments)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {(e?.enrolments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No enrolments yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
