import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  BookOpen,
  CalendarDays,
  Car,
  FileText,
  Heart,
  LifeBuoy,
  Package,
  Plane,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { myApplications, withdrawApplication } from "@/lib/applications.functions";
import { cancelMyBooking, myBookings } from "@/lib/bookings.functions";
import { myEnrolments } from "@/lib/learning.functions";
import { markAllNotificationsRead, myNotifications } from "@/lib/notifications.functions";
import { myRoles } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/my-barakah")({
  head: () => ({
    meta: [
      { title: "My Barakah — Dashboard" },
      { name: "description", content: "Your personal Barakah dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyBarakah,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusChip({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground capitalize">
      {value.replace("_", " ")}
    </span>
  );
}

function MyBarakah() {
  const [name, setName] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const queryClient = useQueryClient();

  const roles = useQuery({ queryKey: ["my-roles"], queryFn: () => myRoles() });
  const applications = useQuery({ queryKey: ["my-applications"], queryFn: () => myApplications() });
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => myBookings() });
  const enrolments = useQuery({ queryKey: ["my-enrolments"], queryFn: () => myEnrolments() });
  const notifications = useQuery({ queryKey: ["my-notifications"], queryFn: () => myNotifications() });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      // Grab role from auth metadata
      const roleFromMeta = data.user.user_metadata?.['role'] || "user";
      setUserRole(roleFromMeta);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setName(profile?.full_name || data.user.user_metadata?.['full_name'] || data.user.email || "");
    });
  }, []);

  const withdraw = useMutation({
    mutationFn: (applicationId: string) => withdrawApplication({ data: { applicationId } }),
    onSuccess: () => {
      toast.success("Application withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => cancelMyBooking({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Booking cancelled.");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const isStaff = (roles.data ?? []).some((r) =>
    ["administrator", "programme_officer", "content_editor"].includes(r),
  );

  const apps = applications.data ?? [];
  const bks = bookings.data ?? [];
  const enrols = enrolments.data ?? [];
  const notifs = notifications.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

      {/* Welcome Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            As-salamu alaykum{name ? `, ${name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Welcome to My Barakah — your hub for Travel, Logistics, and Community.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <Link
              to="/staff"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90"
            >
              Staff Dashboard →
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <UserRound className="h-3.5 w-3.5" />
            {userRole === "driver" ? "SwiftMove Driver Partner" : "Customer Account"}
          </span>
        </div>
      </div>

      {/* Primary Action Shortcuts */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          to="/"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-emerald-500 hover:shadow-md"
        >
          <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-emerald-600">Travel & Tours</h3>
            <p className="text-xs text-muted-foreground">Hajj, Umrah & Flights</p>
          </div>
        </Link>

        <Link
          to="/swift-move/new"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-blue-500 hover:shadow-md"
        >
          <div className="rounded-lg bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-blue-600">Send Package</h3>
            <p className="text-xs text-muted-foreground">Instant SwiftMove delivery</p>
          </div>
        </Link>

        <Link
          to="/swift-move/new"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-orange-500 hover:shadow-md"
        >
          <div className="rounded-lg bg-orange-500/10 p-3 text-orange-600 dark:text-orange-400">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-orange-600">Vehicle Hire</h3>
            <p className="text-xs text-muted-foreground">Rent sedan, SUV or truck</p>
          </div>
        </Link>
      </div>

      {/* Notifications */}
      <div className="card-surface mt-8 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          {notifs.some((n) => !n.read_at) && (
            <button
              onClick={() =>
                markAllNotificationsRead().then(() =>
                  queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
                )
              }
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {notifs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You're all caught up. Updates about applications, bookings and courses appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {notifs.slice(0, 8).map((n) => (
              <li
                key={n.id}
                className={`flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3 ${n.read_at ? "opacity-60" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{fmt(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* My Learning */}
        <section className="card-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <BookOpen className="h-5 w-5 text-primary" /> My Learning
            </h2>
            <Link to="/learn" className="text-xs font-medium text-primary hover:underline">
              Browse courses
            </Link>
          </div>
          {enrols.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              You haven't enrolled in a course yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {enrols.map((e: any) => (
                <li key={e.id}>
                  <Link
                    to="/learn/$slug"
                    params={{ slug: e.course?.slug }}
                    className="block rounded-lg border border-border p-3 hover:bg-accent/50"
                  >
                    <p className="text-sm font-medium text-foreground">{e.course?.title}</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${e.percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.completedLessons}/{e.totalLessons} lessons · {e.percent}%
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* My Applications */}
        <section className="card-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="h-5 w-5 text-primary" /> My Applications
            </h2>
            <Link to="/apply" className="text-xs font-medium text-primary hover:underline">
              New application
            </Link>
          </div>
          {apps.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {apps.map((a: any) => {
                const programme = Array.isArray(a.programme) ? a.programme[0] : a.programme;
                return (
                  <li key={a.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {programme?.title ?? "General application"}
                      </p>
                      <StatusChip value={a.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {fmt(a.submitted_at)}
                    </p>
                    {a.staff_notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Staff note:</span> {a.staff_notes}
                      </p>
                    )}
                    {["submitted", "under_review", "waitlisted"].includes(a.status) && (
                      <button
                        onClick={() => withdraw.mutate(a.id)}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        Withdraw
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* My Bookings */}
        <section className="card-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CalendarDays className="h-5 w-5 text-primary" /> My Bookings
            </h2>
            <Link to="/bookings" className="text-xs font-medium text-primary hover:underline">
              Find a session
            </Link>
          </div>
          {bks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">You have no bookings yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {bks.map((b: any) => {
                const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
                const service = Array.isArray(slot?.service) ? slot.service[0] : slot?.service;
                return (
                  <li key={b.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{service?.title}</p>
                      <StatusChip value={b.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {slot ? fmt(slot.starts_at) : ""} {slot?.location ? `· ${slot.location}` : ""}
                    </p>
                    {["requested", "confirmed"].includes(b.status) && (
                      <button
                        onClick={() => cancelBooking.mutate(b.id)}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        Cancel booking
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Ecosystem Modules Grid */}
      <h2 className="mt-12 text-2xl font-bold text-foreground">More of your ecosystem</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <EmptyState
          icon={Plane}
          title="My Journey"
          description="Travel enrolments, documents and instalment plans"
          ctaLabel="Open My Journey"
          ctaTo="/my-journey"
        />
        <EmptyState
          icon={LifeBuoy}
          title="My Support"
          description="Confidential assistance requests"
          ctaLabel="Open My Support"
          ctaTo="/my-support"
        />
        <EmptyState
          icon={Heart}
          title="My Impact"
          description="Volunteer profile, assignments and verified hours"
          ctaLabel="Open My Impact"
          ctaTo="/my-impact"
        />
        <EmptyState
          icon={Wallet}
          title="My Payments"
          description="Payments, receipts, refunds and orders"
          ctaLabel="Open My Payments"
          ctaTo="/my-payments"
        />
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <EmptyState
          icon={TrendingUp}
          title="My Enterprise"
          description="You're not part of an enterprise programme yet"
          ctaLabel="Discover enterprise support"
          ctaTo="/enterprise-and-ventures"
        />
        <EmptyState
          icon={Bike}
          title="My Swift Move"
          description="Track package deliveries and vehicle rentals"
          ctaLabel="Open Swift Move"
          ctaTo="/my-swift-move"
        />
      </div>
    </div>
  );
}