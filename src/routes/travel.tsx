import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Plane } from "lucide-react";
import { listTravelPackages } from "@/lib/travel.functions";
import { formatNaira } from "@/lib/currency";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/travel")({
  head: () => ({
    meta: [
      { title: `Travel & Pilgrimage — ${ORG.legalName}` },
      { name: "description", content: "Umrah, Hajj and educational travel packages through licensed partners, with instalment payment plans." },
      { property: "og:title", content: `Travel & Pilgrimage — ${ORG.legalName}` },
      { property: "og:description", content: "Umrah, Hajj and educational travel packages through licensed partners, with instalment payment plans." },
    ],
  }),
  component: TravelPage,
});

function TravelPage() {
  const packages = useQuery({ queryKey: ["travel-packages"], queryFn: () => listTravelPackages() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Brand Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3">
            <Plane className="h-3.5 w-3.5" />
            Barakah Travel and Tours Limited
          </div>
          <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">Travel &amp; Pilgrimage Packages</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Sacred Umrah, Hajj and educational journeys organised with licensed partners. Enrol with your
            My Barakah account, upload your documents securely, and pay in convenient instalments.
          </p>
        </div>

        <div className="shrink-0 p-3 bg-card rounded-2xl border border-border shadow-sm hidden sm:block">
          <img
            src="/barakah-logo-cropped.png"
            alt="Barakah Travel and Tours Limited"
            className="h-14 w-auto object-contain"
          />
        </div>
      </div>

      {packages.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading packages…</p>}
      {!packages.isLoading && (packages.data ?? []).length === 0 && (
        <div className="card-surface mt-12 p-10 text-center">
          <Plane className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Packages coming soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Our first travel packages are being finalised with licensed providers.
          </p>
        </div>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(packages.data ?? []).map((p) => (
          <Link
            key={p.id}
            to="/travel/$slug"
            params={{ slug: p.slug }}
            className="card-surface group flex flex-col p-6 transition-shadow hover:shadow-lg"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
              <Plane className="h-5 w-5 text-accent-foreground" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground group-hover:text-primary">{p.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.summary}</p>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              {p.starts_on ? `${p.starts_on} → ${p.ends_on ?? "TBC"}` : "Dates to be confirmed"}
            </p>
            <span className="mt-2 text-sm font-medium text-primary">
              {formatNaira(p.price_kobo, p.currency)} · View &amp; enrol →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
