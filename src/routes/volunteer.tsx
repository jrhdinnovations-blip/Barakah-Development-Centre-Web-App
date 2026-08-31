import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HandHeart, MapPin, Wifi } from "lucide-react";
import { listOpportunities } from "@/lib/volunteers.functions";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/volunteer")({
  head: () => ({
    meta: [
      { title: `Volunteer — ${ORG.legalName}` },
      { name: "description", content: "Give your time and skills. Browse open volunteer opportunities at Barakah Development Centre." },
      { property: "og:title", content: `Volunteer — ${ORG.legalName}` },
      { property: "og:description", content: "Give your time and skills. Browse open volunteer opportunities at Barakah Development Centre." },
    ],
  }),
  component: VolunteerPage,
});

function VolunteerPage() {
  const opportunities = useQuery({ queryKey: ["opportunities"], queryFn: () => listOpportunities() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">Volunteer with Barakah</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Your time is sadaqah. Join our volunteer network — apply with your free My Barakah account
        and track your verified hours in My Impact.
      </p>

      {opportunities.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading opportunities…</p>}
      {!opportunities.isLoading && (opportunities.data ?? []).length === 0 && (
        <div className="card-surface mt-12 p-10 text-center">
          <HandHeart className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Opportunities coming soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            New volunteer roles are being prepared. Check back shortly.
          </p>
        </div>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(opportunities.data ?? []).map((o) => (
          <div key={o.id} className="card-surface flex flex-col p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
              <HandHeart className="h-5 w-5 text-accent-foreground" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">{o.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{o.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {o.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {o.location}</span>
              )}
              {o.is_remote && (
                <span className="flex items-center gap-1"><Wifi className="h-3.5 w-3.5" /> Remote-friendly</span>
              )}
              {o.commitment && <span>· {o.commitment}</span>}
            </div>
            <Link
              to="/my-impact"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Apply via My Impact →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
