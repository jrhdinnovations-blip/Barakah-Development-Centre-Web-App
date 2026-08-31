import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HandHeart } from "lucide-react";
import { toast } from "sonner";
import {
  applyToVolunteer,
  listOpportunities,
  logHours,
  myImpact,
  saveVolunteerProfile,
} from "@/lib/volunteers.functions";

export const Route = createFileRoute("/_authenticated/my-impact")({
  head: () => ({
    meta: [
      { title: "My Impact — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyImpact,
});

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function MyImpact() {
  const queryClient = useQueryClient();
  const impact = useQuery({ queryKey: ["my-impact"], queryFn: () => myImpact() });
  const opportunities = useQuery({ queryKey: ["opportunities"], queryFn: () => listOpportunities() });

  const [skills, setSkills] = useState("");
  const [availability, setAvailability] = useState("");
  const [bio, setBio] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [applyFor, setApplyFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [hoursFor, setHoursFor] = useState<string | null>(null);
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  if (impact.data?.profile && !profileLoaded) {
    setSkills(impact.data.profile.skills?.join(", ") ?? "");
    setAvailability(impact.data.profile.availability ?? "");
    setBio(impact.data.profile.bio ?? "");
    setProfileLoaded(true);
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-impact"] });

  const saveProfile = useMutation({
    mutationFn: () =>
      saveVolunteerProfile({
        data: {
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          ...(availability ? { availability } : {}),
          ...(bio ? { bio } : {}),
        },
      }),
    onSuccess: () => { toast.success("Volunteer profile saved."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: () =>
      applyToVolunteer({ data: { opportunityId: applyFor!, ...(message ? { message } : {}) } }),
    onSuccess: () => { toast.success("Application submitted."); setApplyFor(null); setMessage(""); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const log = useMutation({
    mutationFn: () =>
      logHours({ data: { assignmentId: hoursFor!, workDate, hours: Number(hours), ...(note ? { note } : {}) } }),
    onSuccess: () => { toast.success("Hours logged — pending verification."); setHoursFor(null); setHours(""); setNote(""); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const d = impact.data;
  const verifiedHours = (d?.hours ?? []).filter((h: any) => h.verified_at).reduce((s: number, h: any) => s + Number(h.hours), 0);
  const appliedIds = new Set((d?.applications ?? []).map((a: any) => a.opportunity_id ?? a.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">My Impact</h1>
      <p className="mt-1 text-muted-foreground">Your volunteer profile, assignments and verified hours.</p>

      <div className="card-surface mt-8 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <HandHeart className="h-5 w-5 text-accent-foreground" />
          </span>
          <div>
            <p className="font-display text-2xl font-bold text-foreground">{verifiedHours}</p>
            <p className="text-xs text-muted-foreground">Verified volunteer hours</p>
          </div>
        </div>
      </div>

      {/* Volunteer profile */}
      <form className="card-surface mt-6 space-y-3 p-6" onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}>
        <h2 className="text-lg font-semibold text-foreground">Volunteer profile</h2>
        <input className={inputCls} placeholder="Skills (comma-separated, e.g. Teaching, First aid, Design)" value={skills} onChange={(e) => setSkills(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Availability (e.g. Weekends, evenings)" value={availability} onChange={(e) => setAvailability(e.target.value)} />
          <input className={inputCls} placeholder="Short bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save profile</button>
      </form>

      {/* Applications & assignments */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">My applications</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(d?.applications ?? []).map((a: any) => {
              const opp = Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity;
              return (
                <li key={a.id} className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-foreground">{opp?.title}</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{a.status.replace(/_/g, " ")}</span>
                </li>
              );
            })}
            {(d?.applications ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            )}
          </ul>
        </section>

        <section className="card-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">My assignments</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(d?.assignments ?? []).map((a: any) => {
              const opp = Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity;
              return (
                <li key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{opp?.title}</span>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{a.status}</span>
                  </div>
                  {a.status === "active" && (
                    <button onClick={() => setHoursFor(a.id)} className="mt-2 text-xs font-medium text-primary hover:underline">
                      Log hours
                    </button>
                  )}
                  {hoursFor === a.id && (
                    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); log.mutate(); }}>
                      <div className="grid grid-cols-2 gap-2">
                        <input className={inputCls} type="date" required value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
                        <input className={inputCls} type="number" min="0.25" max="24" step="0.25" required placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
                      </div>
                      <input className={inputCls} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                      <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Submit hours</button>
                    </form>
                  )}
                </li>
              );
            })}
            {(d?.assignments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No assignments yet — apply below.</p>
            )}
          </ul>
        </section>
      </div>

      {/* Open opportunities */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Open opportunities</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(opportunities.data ?? []).map((o) => {
            const applied = (d?.applications ?? []).some(
              (a: any) => (Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity)?.title === o.title,
            ) || appliedIds.has(o.id);
            return (
              <div key={o.id} className="card-surface p-5">
                <h3 className="font-semibold text-foreground">{o.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {[o.location, o.is_remote ? "Remote-friendly" : null, o.commitment].filter(Boolean).join(" · ")}
                </p>
                {applied ? (
                  <span className="mt-3 inline-block text-xs font-medium text-primary">Applied ✓</span>
                ) : applyFor === o.id ? (
                  <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); apply.mutate(); }}>
                    <textarea className={inputCls} rows={2} placeholder="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
                    <div className="flex gap-3">
                      <button className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Submit application</button>
                      <button type="button" onClick={() => setApplyFor(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setApplyFor(o.id)} className="mt-3 text-xs font-medium text-primary hover:underline">
                    Apply →
                  </button>
                )}
              </div>
            );
          })}
          {(opportunities.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No open opportunities right now — check the <Link to="/volunteer" className="text-primary hover:underline">volunteer page</Link>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
