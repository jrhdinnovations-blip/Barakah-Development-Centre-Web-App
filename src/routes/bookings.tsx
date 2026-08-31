import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";
import { bookSlot, listBookingServices, listOpenSlots } from "@/lib/bookings.functions";
import { useAuth } from "@/hooks/use-auth";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: `Book a Session — ${ORG.legalName}` },
      { name: "description", content: "Book training sessions, counselling appointments and events." },
      { property: "og:title", content: `Book a Session — ${ORG.legalName}` },
      { property: "og:description", content: "Book training sessions, counselling appointments and events." },
    ],
  }),
  component: BookingsPage,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [serviceId, setServiceId] = useState<string | undefined>();

  const services = useQuery({ queryKey: ["booking-services"], queryFn: () => listBookingServices() });
  const slots = useQuery({
    queryKey: ["booking-slots", serviceId],
    queryFn: () => listOpenSlots({ data: { serviceId } }),
  });

  const book = useMutation({
    mutationFn: (slotId: string) => bookSlot({ data: { slotId } }),
    onSuccess: () => {
      toast.success("Booking confirmed! See it in My Barakah.");
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
    },
    onError: (e) => toast.error(e.message || "Could not book slot"),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">Book a Session</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Training sessions, counselling appointments, consultancy slots and events.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          onClick={() => setServiceId(undefined)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            !serviceId ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
          }`}
        >
          All services
        </button>
        {(services.data ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setServiceId(s.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              serviceId === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {(services.data ?? []).length === 0 && !services.isLoading && (
        <div className="card-surface mt-10 p-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Booking opens soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Bookable sessions will be published here as they are scheduled.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {(slots.data ?? []).map((s: any) => {
          const service = Array.isArray(s.service) ? s.service[0] : s.service;
          return (
            <div
              key={s.id}
              className="card-surface flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <h3 className="font-semibold text-foreground">{service?.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> {fmt(s.starts_at)} –{" "}
                  {new Date(s.ends_at).toLocaleTimeString("en-NG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {s.location && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {s.location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{s.remaining} place(s) left</span>
                {user ? (
                  <button
                    onClick={() => book.mutate(s.id)}
                    disabled={book.isPending}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    Book
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    search={{ mode: "login" }}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Sign in to book
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {slots.data?.length === 0 && (services.data ?? []).length > 0 && (
          <p className="text-sm text-muted-foreground">No open slots right now — check back soon.</p>
        )}
      </div>
    </div>
  );
}
