import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { enrolInPackage, getTravelPackage } from "@/lib/travel.functions";
import { formatNaira } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { ORG } from "@/lib/site";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/travel/$slug")({
  loader: async ({ params }) => {
    const pkg = await getTravelPackage({ data: { slug: params.slug } });
    if (!pkg) throw notFound();
    return pkg;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Travel Package"} — ${ORG.legalName}` },
      { name: "description", content: loaderData?.summary ?? "Travel package details." },
      { property: "og:title", content: `${loaderData?.title ?? "Travel Package"} — ${ORG.legalName}` },
      { property: "og:description", content: loaderData?.summary ?? "Travel package details." },
    ],
  }),
  component: TravelDetail,
});

function TravelDetail() {
  const pkg = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const mine = useQuery({
    queryKey: ["my-enrolment", pkg.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("travel_enrolments")
        .select("id, status")
        .eq("package_id", pkg.id)
        .not("status", "eq", "cancelled")
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: signedIn,
  });

  const enrol = useMutation({
    mutationFn: () => enrolInPackage({ data: { packageId: pkg.id } }),
    onSuccess: () => {
      toast.success("You're enrolled! Next: add your passenger details in My Journey.");
      queryClient.invalidateQueries({ queryKey: ["my-enrolment", pkg.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-border">
        <Link
          to="/travel"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Travel Packages
        </Link>
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
          <Plane className="h-3.5 w-3.5" /> Barakah Travel and Tours Limited
        </span>
      </div>

      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
        <Plane className="h-6 w-6 text-accent-foreground" />
      </span>
      <h1 className="mt-6 text-4xl font-bold text-foreground">{pkg.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{pkg.summary}</p>

      <dl className="card-surface mt-8 grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dates</dt>
          <dd className="mt-1 text-sm text-foreground">
            {pkg.starts_on ? `${pkg.starts_on} → ${pkg.ends_on ?? "TBC"}` : "To be confirmed"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{formatNaira(pkg.price_kobo, pkg.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provided by</dt>
          <dd className="mt-1 text-sm text-foreground">{pkg.provider_name ?? "To be confirmed"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instalments</dt>
          <dd className="mt-1 text-sm text-foreground">
            {pkg.instalments_allowed ? "Payment plans available" : "Full payment"}
          </dd>
        </div>
      </dl>

      {pkg.body && (
        <div className="prose mt-8 max-w-none whitespace-pre-line text-foreground">{pkg.body}</div>
      )}

      <div className="card-surface mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ready to enrol?</h2>
          <p className="text-sm text-muted-foreground">
            Enrol now, then upload documents and set up your payment plan in My Journey.
          </p>
        </div>
        {mine.data ? (
          <Link to="/my-journey" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            View My Journey →
          </Link>
        ) : signedIn ? (
          <button
            onClick={() => enrol.mutate()}
            disabled={enrol.isPending}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enrol.isPending ? "Enrolling…" : "Enrol in this package"}
          </button>
        ) : (
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in to enrol
          </Link>
        )}
      </div>
    </div>
  );
}
