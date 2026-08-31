import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Plane } from "lucide-react";
import { listTravelPackages } from "@/lib/travel.functions";
import { formatNaira } from "@/lib/payments.server";
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
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">Travel &amp; Pilgrimage</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Umrah, Hajj and educational journeys organised with licensed partners. Enrol with your
        My Barakah account, upload your documents securely, and pay in instalments.
      </p>

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
