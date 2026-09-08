import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { PaymentReturn } from "@/components/PaymentReturn";
import { myJourney, payInstalment, savePassengerDetails } from "@/lib/travel.functions";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/my-journey")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Journey — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyJourney,
});

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function StatusChip({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium capitalize text-accent-foreground">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function MyJourney() {
  const queryClient = useQueryClient();
  const journey = useQuery({ queryKey: ["my-journey"], queryFn: () => myJourney() });
  const [passengerFor, setPassengerFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", dateOfBirth: "", passportNumber: "", passportExpiry: "",
    nextOfKinName: "", nextOfKinPhone: "", medicalNotes: "",
  });

  const savePassenger = useMutation({
    mutationFn: () =>
      savePassengerDetails({ data: { enrolmentId: passengerFor!, ...form } }),
    onSuccess: () => {
      toast.success("Passenger details saved. Staff will verify your documents.");
      setPassengerFor(null);
      queryClient.invalidateQueries({ queryKey: ["my-journey"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const payInst = useMutation({
    mutationFn: (instalmentId: string) => payInstalment({ data: { instalmentId } }),
    onSuccess: (r) => {
      if (r.configured && r.authorizationUrl) {
        window.location.href = r.authorizationUrl;
      } else {
        toast.info("Online payment isn't live yet — our team will contact you to complete this instalment.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const d = journey.data;
  const enrolments = d?.enrolments ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
            <Plane className="h-3 w-3" />
            Barakah Travel and Tours Limited
          </div>
          <h1 className="text-3xl font-bold text-foreground">My Journey</h1>
          <p className="mt-1 text-muted-foreground">Your travel enrolments, documents and payment plans.</p>
        </div>
        <div className="p-2 bg-card rounded-xl border border-border shadow-sm hidden sm:block shrink-0">
          <img src="/barakah-logo-cropped.png" alt="Barakah Travel and Tours Limited" className="h-10 w-auto object-contain" />
        </div>
      </div>
      <div className="mt-6">
        <PaymentReturn onVerified={() => queryClient.invalidateQueries({ queryKey: ["my-journey"] })} />
      </div>

      {enrolments.length === 0 ? (
        <div className="card-surface mt-8 p-10 text-center">
          <Plane className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">No journeys yet</h2>
          <Link to="/travel" className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Browse travel packages
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {enrolments.map((en: any) => {
            const pkg = Array.isArray(en.package) ? en.package[0] : en.package;
            const passenger = (d?.passengers ?? []).find((p: any) => p.enrolment_id === en.id);
            const plan = (d?.plans ?? []).find((p: any) => p.enrolment_id === en.id);
            const instalments = plan ? (d?.instalments ?? []).filter((i: any) => i.plan_id === plan.id) : [];
            return (
              <section key={en.id} className="card-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{pkg?.title}</h2>
                  <StatusChip value={en.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pkg?.starts_on ? `${pkg.starts_on} → ${pkg.ends_on ?? "TBC"}` : "Dates to be confirmed"}
                  {pkg?.provider_name ? ` · Provided by ${pkg.provider_name}` : ""}
                </p>

                {/* Documents step */}
                <div className="mt-4 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">Passenger & documents</h3>
                  {passenger ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {passenger.full_name} · Passport: {passenger.passport_number ?? "—"}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Not submitted yet.</p>
                  )}
                  <button
                    onClick={() => {
                      setPassengerFor(en.id);
                      setForm({
                        fullName: passenger?.full_name ?? "",
                        dateOfBirth: passenger?.date_of_birth ?? "",
                        passportNumber: passenger?.passport_number ?? "",
                        passportExpiry: passenger?.passport_expiry ?? "",
                        nextOfKinName: passenger?.next_of_kin_name ?? "",
                        nextOfKinPhone: passenger?.next_of_kin_phone ?? "",
                        medicalNotes: passenger?.medical_notes ?? "",
                      });
                    }}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    {passenger ? "Edit details" : "Add passenger details"}
                  </button>

                  {passengerFor === en.id && (
                    <form
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                      onSubmit={(e) => { e.preventDefault(); savePassenger.mutate(); }}
                    >
                      <input className={inputCls} required minLength={2} placeholder="Full name (as on passport)" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                      <input className={inputCls} type="date" placeholder="Date of birth" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                      <input className={inputCls} placeholder="Passport number" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} />
                      <input className={inputCls} type="date" placeholder="Passport expiry" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} />
                      <input className={inputCls} placeholder="Next of kin name" value={form.nextOfKinName} onChange={(e) => setForm({ ...form, nextOfKinName: e.target.value })} />
                      <input className={inputCls} placeholder="Next of kin phone" value={form.nextOfKinPhone} onChange={(e) => setForm({ ...form, nextOfKinPhone: e.target.value })} />
                      <textarea className={`${inputCls} sm:col-span-2`} rows={2} placeholder="Medical notes (optional, confidential)" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
                      <div className="sm:col-span-2">
                        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save details</button>
                        <button type="button" onClick={() => setPassengerFor(null)} className="ml-3 text-sm text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Payment plan */}
                {plan && (
                  <div className="mt-4 rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Payment plan — {formatNaira(plan.total_kobo, plan.currency)}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {instalments.map((i: any) => (
                        <li key={i.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">
                            {i.label} · <span className="text-xs text-muted-foreground">due {i.due_date}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span>{formatNaira(i.amount_kobo, plan.currency)}</span>
                            {i.status === "paid" ? (
                              <span className="text-xs font-medium text-primary">Paid ✓</span>
                            ) : (
                              <button
                                onClick={() => payInst.mutate(i.id)}
                                className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                              >
                                Pay now
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
