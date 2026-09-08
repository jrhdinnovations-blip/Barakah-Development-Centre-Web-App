import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin } from "lucide-react";
import { getSharedRide } from "@/lib/swift.functions";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Follow this SwiftMove trip — live trip sharing" },
      { name: "description", content: "Follow a SwiftMove trip in near real time with a secure share link." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShareTrip,
});

function ShareTrip() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["shared-ride", token],
    queryFn: () => getSharedRide({ data: { token } }),
    refetchInterval: 10_000,
    retry: false,
  });

  if (q.isLoading) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted-foreground">Loading trip…</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Trip not available</h1>
        <p className="mt-2 text-muted-foreground">This share link is invalid or the trip no longer exists.</p>
      </div>
    );
  }
  const r = q.data;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-swift/15">
            <Car className="h-5 w-5 text-swift" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-foreground">SwiftMove — live trip</h1>
            <p className="text-xs capitalize text-muted-foreground">{String(r.status).replace(/_/g, " ")}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm text-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-swift" /> {r.pickup_address}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {r.destination_address}
          </p>
        </div>

        <div className="mt-5 rounded-xl bg-accent/50 p-4 text-sm">
          <p className="font-semibold text-foreground">{r.driver_name}</p>
          <p className="text-muted-foreground">
            {r.vehicle_description} {r.plate_number ? `· ${r.plate_number}` : ""}
          </p>
        </div>

        {!r.ended && r.driver_lat != null && r.driver_lng != null && (
          <a
            className="mt-4 block rounded-lg bg-swift px-4 py-3 text-center text-sm font-semibold text-swift-foreground hover:opacity-90"
            target="_blank"
            rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${r.driver_lat}&mlon=${r.driver_lng}#map=16/${r.driver_lat}/${r.driver_lng}`}
          >
            View driver's current location
          </a>
        )}
        {r.ended && (
          <p className="mt-4 rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
            This trip has ended.
          </p>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Shared securely via SwiftMove · Barakah Development Centre
        </p>
      </div>
    </div>
  );
}
