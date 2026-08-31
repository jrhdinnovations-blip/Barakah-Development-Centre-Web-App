import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  staffListVolunteers,
  staffReviewVolunteerApplication,
  staffUpsertOpportunity,
  staffVerifyHours,
} from "@/lib/volunteers.functions";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function VolunteersTab() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["staff-volunteers"], queryFn: () => staffListVolunteers() });
  const [opp, setOpp] = useState({ slug: "", title: "", description: "", commitment: "", location: "", isRemote: false, status: "draft" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff-volunteers"] });

  const upsertOpp = useMutation({
    mutationFn: () =>
      staffUpsertOpportunity({
        data: {
          slug: opp.slug,
          title: opp.title,
          description: opp.description || undefined,
          commitment: opp.commitment || undefined,
          location: opp.location || undefined,
          isRemote: opp.isRemote,
          status: opp.status as any,
        },
      }),
    onSuccess: () => {
      toast.success("Opportunity saved.");
      setOpp({ slug: "", title: "", description: "", commitment: "", location: "", isRemote: false, status: "draft" });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: (v: { applicationId: string; status: "approved" | "rejected" }) =>
      staffReviewVolunteerApplication({ data: v }),
    onSuccess: () => { toast.success("Application reviewed."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: (hoursId: string) => staffVerifyHours({ data: { hoursId } }),
    onSuccess: () => { toast.success("Hours verified."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const d = data.data;

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card-surface space-y-3 p-6" onSubmit={(e) => { e.preventDefault(); upsertOpp.mutate(); }}>
          <h2 className="text-lg font-semibold text-foreground">New volunteer opportunity</h2>
          <input className={inputCls} required placeholder="slug (e.g. weekend-tutor)" pattern="[a-z0-9-]+" value={opp.slug} onChange={(e) => setOpp({ ...opp, slug: e.target.value })} />
          <input className={inputCls} required placeholder="Role title" value={opp.title} onChange={(e) => setOpp({ ...opp, title: e.target.value })} />
          <textarea className={inputCls} rows={2} placeholder="Description" value={opp.description} onChange={(e) => setOpp({ ...opp, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Commitment (e.g. 4 hrs/week)" value={opp.commitment} onChange={(e) => setOpp({ ...opp, commitment: e.target.value })} />
            <input className={inputCls} placeholder="Location" value={opp.location} onChange={(e) => setOpp({ ...opp, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={inputCls} value={opp.status} onChange={(e) => setOpp({ ...opp, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={opp.isRemote} onChange={(e) => setOpp({ ...opp, isRemote: e.target.checked })} />
              Remote-friendly
            </label>
          </div>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save opportunity</button>
        </form>

        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Opportunities</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(d?.opportunities ?? []).map((o: any) => (
              <li key={o.id} className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-foreground">{o.title}</span>
                <span className="text-xs capitalize text-muted-foreground">{o.status}{o.is_remote ? " · remote" : ""}</span>
              </li>
            ))}
            {(d?.opportunities ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No opportunities yet.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Volunteer applications</h2>
          <ul className="mt-4 space-y-3">
            {(d?.applications ?? []).map((a: any) => {
              const applicant = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant;
              const opportunity = Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity;
              return (
                <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{applicant?.full_name ?? "Applicant"}</span>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{a.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{opportunity?.title}</p>
                  {a.message && <p className="mt-1 text-xs text-muted-foreground">“{a.message}”</p>}
                  {a.status === "submitted" && (
                    <div className="mt-2 flex gap-3">
                      <button onClick={() => review.mutate({ applicationId: a.id, status: "approved" })} className="text-xs font-medium text-primary hover:underline">Approve & assign</button>
                      <button onClick={() => review.mutate({ applicationId: a.id, status: "rejected" })} className="text-xs font-medium text-destructive hover:underline">Reject</button>
                    </div>
                  )}
                </li>
              );
            })}
            {(d?.applications ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            )}
          </ul>
        </div>

        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Hours awaiting verification</h2>
          <ul className="mt-4 space-y-3">
            {(d?.unverifiedHours ?? []).map((h: any) => {
              const volunteer = Array.isArray(h.volunteer) ? h.volunteer[0] : h.volunteer;
              return (
                <li key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{volunteer?.full_name ?? "Volunteer"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {h.hours}h on {h.work_date}{h.note ? ` · ${h.note}` : ""}
                    </span>
                  </div>
                  <button onClick={() => verify.mutate(h.id)} className="text-xs font-medium text-primary hover:underline">Verify</button>
                </li>
              );
            })}
            {(d?.unverifiedHours ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No hours awaiting verification.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
