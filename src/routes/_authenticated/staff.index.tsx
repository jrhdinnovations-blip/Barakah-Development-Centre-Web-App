import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Bell, BookOpen, CalendarDays, Copy, ExternalLink, FileText, Inbox, Mail, ShieldCheck } from "lucide-react";
import { getStaffMailboxes, getCompanyDomains, type StaffMailbox, type CompanyDomain } from "@/lib/company-email-service";
import { supabase } from "@/integrations/supabase/client";
import { reviewApplication, staffListApplications } from "@/lib/applications.functions";
import {
  staffListBookings,
  staffListServicesSlots,
  staffSetBookingStatus,
  staffUpsertService,
  staffUpsertSlot,
} from "@/lib/bookings.functions";
import {
  staffAddEnquiryNote,
  staffAssignEnquiry,
  staffCompleteFollowUp,
  staffEnquiryNotes,
  staffListEnquiries,
  staffListFollowUps,
  staffResolveEnquiry,
  staffUpsertFollowUp,
} from "@/lib/crm.functions";
import {
  staffListCourses,
  staffListLessons,
  staffUpsertCourse,
  staffUpsertLesson,
} from "@/lib/learning.functions";
import { staffListTemplates, staffUpsertTemplate } from "@/lib/notifications.functions";
import { staffExecStats, staffOverview } from "@/lib/staff.functions";
import { formatNaira } from "@/lib/currency";
import { CasesTab } from "@/components/staff/CasesTab";
import { FinanceTab } from "@/components/staff/FinanceTab";
import { MarketTab } from "@/components/staff/MarketTab";
import { TravelTab } from "@/components/staff/TravelTab";
import { VolunteersTab } from "@/components/staff/VolunteersTab";
import { SwiftTab } from "@/components/staff/SwiftTab";

export const Route = createFileRoute("/_authenticated/staff/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: "/auth", search: { mode: "login" } });
      const { data: staff } = await supabase.rpc("is_staff", { _user_id: user.id });
      if (!staff) throw redirect({ to: "/my-barakah" });
      // Staff MFA: require aal2 — enroll or challenge first
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== "aal2") {
        throw redirect({ to: "/staff-security" });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
  },
  head: () => ({
    meta: [{ title: "Staff Dashboard — Barakah" }, { name: "robots", content: "noindex" }],
  }),
  component: StaffDashboard,
});

type Tab =
  | "overview"
  | "applications"
  | "bookings"
  | "enquiries"
  | "courses"
  | "templates"
  | "finance"
  | "cases"
  | "travel"
  | "market"
  | "volunteers"
  | "swift";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

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
    <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      {value.replace("_", " ")}
    </span>
  );
}

function StaffDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["staff-overview"], queryFn: () => staffOverview() });
  const execStats = useQuery({ queryKey: ["staff-exec-stats"], queryFn: () => staffExecStats() });
  const roles = useQuery({
    queryKey: ["my-staff-roles"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("status", "active");
      return (data ?? []).map((r) => r.role);
    },
  });
  const isAdmin = (roles.data ?? []).includes("administrator");

  const tabBtn = (key: Tab, label: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        tab === key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">Staff Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Applications, bookings, enquiries and courses — secured with MFA.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabBtn("overview", "Overview")}
        {tabBtn("swift", "SwiftMove Logistics")}
        {tabBtn("finance", "Finance")}
        {tabBtn("cases", "Cases")}
        {tabBtn("applications", "Applications")}
        {tabBtn("bookings", "Bookings")}
        {tabBtn("enquiries", "Enquiries")}
      </div>

      {tab === "overview" && <OverviewTab data={overview.data} exec={execStats.data} />}
      {tab === "applications" && <ApplicationsTab />}
      {tab === "bookings" && <BookingsTab />}
      {tab === "enquiries" && <EnquiriesTab />}
      {tab === "courses" && <CoursesTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "finance" && <FinanceTab />}
      {tab === "cases" && <CasesTab isAdmin={isAdmin} />}
      {tab === "travel" && <TravelTab />}
      {tab === "market" && <MarketTab />}
      {tab === "volunteers" && <VolunteersTab />}
      {tab === "swift" && <SwiftTab />}
    </div>
  );

  function OverviewTab({ data, exec }: { data: any; exec?: any }) {
    const stats = [
      { icon: FileText, label: "Open applications", value: data?.openApplications },
      { icon: CalendarDays, label: "Active bookings", value: data?.activeBookings },
      { icon: Inbox, label: "Open enquiries", value: data?.openEnquiries },
      { icon: BookOpen, label: "Courses", value: data?.totalCourses },
      {
        icon: Activity,
        label: "Revenue (all time)",
        value: exec ? formatNaira(exec.totalRevenueKobo) : "—",
      },
      { icon: Inbox, label: "Active cases", value: exec?.activeCases ?? "—" },
      {
        icon: CalendarDays,
        label: "Travel enrolments",
        value: exec?.activeTravelEnrolments ?? "—",
      },
      { icon: BookOpen, label: "Marketplace orders", value: exec?.totalOrders ?? "—" },
    ];
    // ── Corporate mailbox lookup ──────────────────────────────────────────────
    const [myMailbox, setMyMailbox] = useState<StaffMailbox | null>(null);
    const [myDomain, setMyDomain] = useState<CompanyDomain | null>(null);
    const [mailboxLoading, setMailboxLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          // 1. Look up profile email
          const { data: profile } = await supabase
            .from("profiles")
            .select("corporate_email")
            .eq("id", user.id)
            .maybeSingle();
          const corpEmail = profile?.corporate_email as string | null;

          const mailboxes = getStaffMailboxes();
          const found =
            mailboxes.find((m) => m.userId === user.id) ??
            (corpEmail ? mailboxes.find((m) => m.email.toLowerCase() === corpEmail.toLowerCase()) : undefined);

          if (!found && !cancelled) {
            setMyMailbox(null);
          } else if (found && !cancelled) {
            setMyMailbox(found);
            const domains = getCompanyDomains();
            const dom = domains.find((d) => d.domain.toLowerCase() === found.domain.toLowerCase()) ?? null;
            setMyDomain(dom);
          }
        } catch {
          // silently ignore
        } finally {
          if (!cancelled) setMailboxLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, []);

    return (
      <div className="mt-8 space-y-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card-surface p-6">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-3xl font-bold text-foreground">
                {s.value ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── My Company Mailbox ─────────────────────────────────────────── */}
        <div className="card-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail className="h-5 w-5 text-primary" /> My Company Mailbox
          </h2>

          {mailboxLoading ? (
            <p className="mt-4 text-sm text-muted-foreground animate-pulse">Looking up your mailbox…</p>
          ) : myMailbox ? (
            <div className="mt-4 space-y-4">
              {/* Address + status row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-semibold text-foreground">{myMailbox.email}</span>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(myMailbox.email); toast.success("Email address copied!"); }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    myMailbox.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : myMailbox.status === "provisioned"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {myMailbox.status.charAt(0).toUpperCase() + myMailbox.status.slice(1)}
                </span>
              </div>

              {/* Detail chips */}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {myMailbox.department && (
                  <span className="rounded-md bg-muted px-2.5 py-1">{myMailbox.department}</span>
                )}
                {myMailbox.designation && (
                  <span className="rounded-md bg-muted px-2.5 py-1">{myMailbox.designation}</span>
                )}
                {myMailbox.quotaMb && (
                  <span className="rounded-md bg-muted px-2.5 py-1">{myMailbox.quotaMb} MB quota</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-1">
                {myDomain?.webmailUrl ? (
                  <a
                    href={myDomain.webmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> Open Webmail
                  </a>
                ) : (
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> Open Webmail
                  </a>
                )}
                {myMailbox.recoveryEmail && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    Recovery: <span className="font-medium text-foreground">{myMailbox.recoveryEmail}</span>
                  </div>
                )}
              </div>

              {/* Setup reminder if provisioned */}
              {myMailbox.status === "provisioned" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                  <strong>Action needed:</strong> Your mailbox has been provisioned. Please contact IT or your admin to activate it and set your initial password.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center">
              <Mail className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">No company mailbox assigned yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Ask your administrator to provision a <span className="font-mono">@barakahdevcentre.com</span> email address for you.
              </p>
            </div>
          )}
        </div>

        {/* ── Recent activity ───────────────────────────────────────────── */}
        <div className="card-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Activity className="h-5 w-5 text-primary" /> Recent activity
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.recentEnquiries ?? []).map((e: any) => (
              <li key={e.id} className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground">
                  New enquiry: {e.subject} ({e.name})
                </span>
                <span className="text-muted-foreground">{fmt(e.created_at)}</span>
              </li>
            ))}
            {(data?.recentApplications ?? []).map((a: any) => (
              <li key={a.id} className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground">
                  Application {a.status}:{" "}
                  {Array.isArray(a.programme)
                    ? a.programme[0]?.title
                    : (a.programme?.title ?? "General")}
                </span>
                <span className="text-muted-foreground">{fmt(a.submitted_at)}</span>
              </li>
            ))}
            {(data?.recentBookings ?? []).map((b: any) => {
              const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
              const svc = Array.isArray(slot?.service) ? slot.service[0] : slot?.service;
              return (
                <li key={b.id} className="flex justify-between border-b border-border pb-2">
                  <span className="text-foreground">
                    Booking {b.status}: {svc?.title ?? "session"}
                  </span>
                  <span className="text-muted-foreground">{fmt(b.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  function ApplicationsTab() {
    const [status, setStatus] = useState("");
    const apps = useQuery({
      queryKey: ["staff-apps", status],
      queryFn: () => staffListApplications({ data: { status: status || undefined } }),
    });
    const review = useMutation({
      mutationFn: (input: { applicationId: string; status: any; note?: string }) =>
        reviewApplication({ data: input }),
      onSuccess: () => {
        toast.success("Application updated and applicant notified.");
        queryClient.invalidateQueries({ queryKey: ["staff-apps"] });
      },
      onError: (e) => toast.error(e.message),
    });
    const [notes, setNotes] = useState<Record<string, string>>({});

    return (
      <div className="mt-8">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`${inputCls} max-w-xs`}
        >
          <option value="">All statuses</option>
          {["submitted", "under_review", "approved", "rejected", "waitlisted", "withdrawn"].map(
            (s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ),
          )}
        </select>
        <div className="mt-4 space-y-4">
          {(apps.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No applications in this view.</p>
          )}
          {(apps.data ?? []).map((a: any) => {
            const applicant = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant;
            const programme = Array.isArray(a.programme) ? a.programme[0] : a.programme;
            return (
              <div key={a.id} className="card-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {applicant?.full_name || "Applicant"} — {programme?.title ?? "General"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(a.submitted_at)} {applicant?.phone ? `· ${applicant.phone}` : ""}
                    </p>
                  </div>
                  <StatusChip value={a.status} />
                </div>
                <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
                  {a.form_data?.motivation}
                </p>
                {a.form_data?.background && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Background:</span>{" "}
                    {a.form_data.background}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Note to applicant (optional)"
                    value={notes[a.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                    className={`${inputCls} max-w-sm`}
                  />
                  {(["under_review", "approved", "rejected", "waitlisted"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        review.mutate({
                          applicationId: a.id,
                          status: s,
                          ...(notes[a.id] ? { note: notes[a.id] } : {}),
                        })
                      }
                      disabled={review.isPending || a.status === s}
                      className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function BookingsTab() {
    const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });
    const servicesSlots = useQuery({
      queryKey: ["staff-services-slots"],
      queryFn: () => staffListServicesSlots(),
    });
    const setStatus = useMutation({
      mutationFn: (input: { bookingId: string; status: any }) =>
        staffSetBookingStatus({ data: input }),
      onSuccess: () => {
        toast.success("Booking updated.");
        queryClient.invalidateQueries({ queryKey: ["staff-bookings"] });
      },
      onError: (e) => toast.error(e.message),
    });

    const [svc, setSvc] = useState({
      title: "",
      category: "",
      durationMinutes: 60,
      cancelCutoffHours: 24,
    });
    const [slot, setSlot] = useState({
      serviceId: "",
      startsAt: "",
      endsAt: "",
      capacity: 1,
      location: "",
    });

    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Bookings queue</h2>
          {(bookings.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          )}
          {(bookings.data ?? []).map((b: any) => {
            const slotData = Array.isArray(b.slot) ? b.slot[0] : b.slot;
            const svcData = Array.isArray(slotData?.service)
              ? slotData.service[0]
              : slotData?.service;
            const booker = Array.isArray(b.booker) ? b.booker[0] : b.booker;
            return (
              <div
                key={b.id}
                className="card-surface flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {svcData?.title} — {booker?.full_name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {slotData ? fmt(slotData.starts_at) : ""}{" "}
                    {slotData?.location ? `· ${slotData.location}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip value={b.status} />
                  <select
                    value={b.status}
                    onChange={(e) => setStatus.mutate({ bookingId: b.id, status: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    {["requested", "confirmed", "completed", "cancelled", "no_show"].map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              staffUpsertService({ data: svc }).then(() => {
                toast.success("Service saved.");
                setSvc({ title: "", category: "", durationMinutes: 60, cancelCutoffHours: 24 });
                queryClient.invalidateQueries({ queryKey: ["staff-services-slots"] });
              });
            }}
            className="card-surface space-y-3 p-5"
          >
            <h3 className="font-semibold text-foreground">New bookable service</h3>
            <input
              placeholder="Title"
              value={svc.title}
              onChange={(e) => setSvc({ ...svc, title: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="Category (e.g. counselling)"
              value={svc.category}
              onChange={(e) => setSvc({ ...svc, category: e.target.value })}
              className={inputCls}
            />
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-muted-foreground">
                Duration (min)
                <input
                  type="number"
                  min={15}
                  value={svc.durationMinutes}
                  onChange={(e) => setSvc({ ...svc, durationMinutes: +e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="flex-1 text-xs text-muted-foreground">
                Cancel cutoff (h)
                <input
                  type="number"
                  min={0}
                  value={svc.cancelCutoffHours}
                  onChange={(e) => setSvc({ ...svc, cancelCutoffHours: +e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Save service
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              staffUpsertSlot({
                data: {
                  serviceId: slot.serviceId,
                  startsAt: new Date(slot.startsAt).toISOString(),
                  endsAt: new Date(slot.endsAt).toISOString(),
                  capacity: slot.capacity,
                  location: slot.location || undefined,
                },
              })
                .then(() => {
                  toast.success("Slot saved.");
                  setSlot({ serviceId: "", startsAt: "", endsAt: "", capacity: 1, location: "" });
                  queryClient.invalidateQueries({ queryKey: ["staff-services-slots"] });
                })
                .catch((err) => toast.error(err.message));
            }}
            className="card-surface space-y-3 p-5"
          >
            <h3 className="font-semibold text-foreground">New slot</h3>
            <select
              value={slot.serviceId}
              onChange={(e) => setSlot({ ...slot, serviceId: e.target.value })}
              required
              className={inputCls}
            >
              <option value="">Select service…</option>
              {(servicesSlots.data?.services ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <label className="block text-xs text-muted-foreground">
              Starts
              <input
                type="datetime-local"
                value={slot.startsAt}
                onChange={(e) => setSlot({ ...slot, startsAt: e.target.value })}
                required
                className={inputCls}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Ends
              <input
                type="datetime-local"
                value={slot.endsAt}
                onChange={(e) => setSlot({ ...slot, endsAt: e.target.value })}
                required
                className={inputCls}
              />
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                min={1}
                value={slot.capacity}
                onChange={(e) => setSlot({ ...slot, capacity: +e.target.value })}
                className={inputCls}
                aria-label="Capacity"
              />
              <input
                placeholder="Location"
                value={slot.location}
                onChange={(e) => setSlot({ ...slot, location: e.target.value })}
                className={inputCls}
              />
            </div>
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Save slot
            </button>
          </form>
        </div>
      </div>
    );
  }

  function EnquiriesTab() {
    const enquiries = useQuery({
      queryKey: ["staff-enquiries"],
      queryFn: () => staffListEnquiries({ data: {} }),
    });
    const followUps = useQuery({
      queryKey: ["staff-followups"],
      queryFn: () => staffListFollowUps(),
    });
    const [openId, setOpenId] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [fuDate, setFuDate] = useState("");

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["staff-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["staff-followups"] });
    };

    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {(enquiries.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No enquiries yet — the website contact form feeds this queue.
            </p>
          )}
          {(enquiries.data ?? []).map((en: any) => (
            <div key={en.id} className="card-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{en.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {en.name} · {en.email} {en.phone ? `· ${en.phone}` : ""} · {fmt(en.created_at)}
                  </p>
                </div>
                <StatusChip value={en.status} />
              </div>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{en.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    staffAssignEnquiry({ data: { enquiryId: en.id, assignTo: null } }).then(
                      invalidate,
                    )
                  }
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Unassign
                </button>
                <button
                  onClick={async () => {
                    const { data: u } = await supabase.auth.getUser();
                    if (u.user)
                      await staffAssignEnquiry({ data: { enquiryId: en.id, assignTo: u.user.id } });
                    invalidate();
                  }}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Assign to me
                </button>
                <button
                  onClick={() =>
                    staffResolveEnquiry({
                      data: { enquiryId: en.id, resolved: en.status !== "resolved" },
                    }).then(invalidate)
                  }
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {en.status === "resolved" ? "Reopen" : "Mark resolved"}
                </button>
                <button
                  onClick={() => setOpenId(openId === en.id ? null : en.id)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Notes
                </button>
              </div>
              {openId === en.id && (
                <EnquiryNotes
                  enquiryId={en.id}
                  note={note}
                  setNote={setNote}
                  fuDate={fuDate}
                  setFuDate={setFuDate}
                  onDone={invalidate}
                />
              )}
            </div>
          ))}
        </div>

        <div className="card-surface h-fit p-5">
          <h3 className="font-semibold text-foreground">Follow-ups due</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(followUps.data ?? []).length === 0 && (
              <li className="text-muted-foreground">No open follow-ups.</li>
            )}
            {(followUps.data ?? []).map((f: any) => {
              const enq = Array.isArray(f.enquiry) ? f.enquiry[0] : f.enquiry;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 border-b border-border pb-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{enq?.subject ?? "Follow-up"}</p>
                    <p className="text-xs text-muted-foreground">Due {f.due_date}</p>
                  </div>
                  <button
                    onClick={() => staffCompleteFollowUp({ data: { id: f.id } }).then(invalidate)}
                    className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                  >
                    Done
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  function EnquiryNotes({ enquiryId, note, setNote, fuDate, setFuDate, onDone }: any) {
    const notes = useQuery({
      queryKey: ["enquiry-notes", enquiryId],
      queryFn: () => staffEnquiryNotes({ data: { enquiryId } }),
    });
    return (
      <div className="mt-4 rounded-lg border border-border p-4">
        <ul className="space-y-2 text-sm">
          {(notes.data ?? []).map((n: any) => {
            const author = Array.isArray(n.author) ? n.author[0] : n.author;
            return (
              <li key={n.id}>
                <span className="font-medium text-foreground">{author?.full_name ?? "Staff"}:</span>{" "}
                <span className="text-muted-foreground">{n.body}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            placeholder="Add a note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
          <button
            onClick={() =>
              staffAddEnquiryNote({ data: { enquiryId, body: note } }).then(() => {
                setNote("");
                queryClient.invalidateQueries({ queryKey: ["enquiry-notes", enquiryId] });
              })
            }
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Add
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="date"
            value={fuDate}
            onChange={(e) => setFuDate(e.target.value)}
            className={inputCls}
          />
          <button
            onClick={() =>
              staffUpsertFollowUp({ data: { enquiryId, dueDate: fuDate } }).then(() => {
                setFuDate("");
                onDone();
                toast.success("Follow-up scheduled.");
              })
            }
            disabled={!fuDate}
            className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            Set follow-up
          </button>
        </div>
      </div>
    );
  }

  function CoursesTab() {
    const courses = useQuery({ queryKey: ["staff-courses"], queryFn: () => staffListCourses() });
    const [course, setCourse] = useState({
      slug: "",
      title: "",
      summary: "",
      selfEnrol: true,
      status: "draft" as any,
    });
    const [lessonCourseId, setLessonCourseId] = useState("");
    const [lesson, setLesson] = useState({
      title: "",
      contentType: "document" as "video" | "document",
      videoUrl: "",
      body: "",
      sortOrder: 0,
    });

    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              staffUpsertCourse({ data: course })
                .then(() => {
                  toast.success("Course saved.");
                  setCourse({ slug: "", title: "", summary: "", selfEnrol: true, status: "draft" });
                  queryClient.invalidateQueries({ queryKey: ["staff-courses"] });
                })
                .catch((err) => toast.error(err.message));
            }}
            className="card-surface space-y-3 p-5"
          >
            <h3 className="font-semibold text-foreground">New course</h3>
            <input
              placeholder="slug (e.g. intro-to-tailoring)"
              value={course.slug}
              onChange={(e) => setCourse({ ...course, slug: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="Title"
              value={course.title}
              onChange={(e) => setCourse({ ...course, title: e.target.value })}
              required
              className={inputCls}
            />
            <textarea
              placeholder="Summary"
              value={course.summary}
              onChange={(e) => setCourse({ ...course, summary: e.target.value })}
              rows={2}
              className={inputCls}
            />
            <div className="flex items-center gap-4">
              <select
                value={course.status}
                onChange={(e) => setCourse({ ...course, status: e.target.value })}
                className={inputCls}
              >
                {["draft", "review", "approved", "published", "archived"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={course.selfEnrol}
                  onChange={(e) => setCourse({ ...course, selfEnrol: e.target.checked })}
                />
                Self-enrol
              </label>
            </div>
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Save course
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              staffUpsertLesson({ data: { courseId: lessonCourseId, ...lesson } })
                .then(() => {
                  toast.success("Lesson saved.");
                  setLesson({
                    title: "",
                    contentType: "document",
                    videoUrl: "",
                    body: "",
                    sortOrder: 0,
                  });
                  queryClient.invalidateQueries({ queryKey: ["staff-lessons", lessonCourseId] });
                })
                .catch((err) => toast.error(err.message));
            }}
            className="card-surface space-y-3 p-5"
          >
            <h3 className="font-semibold text-foreground">New lesson</h3>
            <select
              value={lessonCourseId}
              onChange={(e) => setLessonCourseId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select course…</option>
              {(courses.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              placeholder="Lesson title"
              value={lesson.title}
              onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
              required
              className={inputCls}
            />
            <div className="flex gap-3">
              <select
                value={lesson.contentType}
                onChange={(e) => setLesson({ ...lesson, contentType: e.target.value as any })}
                className={inputCls}
              >
                <option value="document">Document</option>
                <option value="video">Video embed</option>
              </select>
              <input
                type="number"
                min={0}
                value={lesson.sortOrder}
                onChange={(e) => setLesson({ ...lesson, sortOrder: +e.target.value })}
                className={inputCls}
                aria-label="Sort order"
              />
            </div>
            {lesson.contentType === "video" && (
              <input
                placeholder="Video embed URL (https://…)"
                value={lesson.videoUrl}
                onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })}
                required
                className={inputCls}
              />
            )}
            <textarea
              placeholder="Lesson text / document content"
              value={lesson.body}
              onChange={(e) => setLesson({ ...lesson, body: e.target.value })}
              rows={3}
              className={inputCls}
            />
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Save lesson
            </button>
          </form>
        </div>

        <div className="card-surface h-fit p-6">
          <h3 className="text-lg font-semibold text-foreground">Courses</h3>
          <ul className="mt-4 space-y-3">
            {(courses.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">No courses yet.</li>
            )}
            {(courses.data ?? []).map((c: any) => (
              <li key={c.id} className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <StatusChip value={c.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  /learn/{c.slug} · {c.enrolments} enrolled
                </p>
                <select
                  value={c.status}
                  onChange={(e) =>
                    staffUpsertCourse({
                      data: {
                        id: c.id,
                        slug: c.slug,
                        title: c.title,
                        summary: c.summary ?? undefined,
                        description: c.description ?? undefined,
                        selfEnrol: c.self_enrol,
                        status: e.target.value as any,
                      },
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["staff-courses"] }))
                  }
                  className="mt-2 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                >
                  {["draft", "review", "approved", "published", "archived"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function TemplatesTab() {
    const templates = useQuery({
      queryKey: ["staff-templates"],
      queryFn: () => staffListTemplates(),
    });
    const [editing, setEditing] = useState<Record<string, string>>({});
    const save = useMutation({
      mutationFn: (t: any) =>
        staffUpsertTemplate({
          data: {
            id: t.id,
            key: t.key,
            channel: t.channel,
            subject: t.subject ?? undefined,
            body: editing[t.id] ?? t.body,
          },
        }),
      onSuccess: () => {
        toast.success("Template saved.");
        queryClient.invalidateQueries({ queryKey: ["staff-templates"] });
      },
      onError: (e) => toast.error(e.message),
    });

    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          Use placeholders like {"{{user_name}}"}, {"{{programme_name}}"}, {"{{service_name}}"},{" "}
          {"{{slot_time}}"}, {"{{course_name}}"}, {"{{status}}"}.
        </p>
        {(templates.data ?? []).map((t: any) => (
          <div key={t.id} className="card-surface p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-foreground">{t.key}</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bell className="h-3.5 w-3.5" /> {t.channel}
              </span>
            </div>
            <textarea
              value={editing[t.id] ?? t.body}
              onChange={(e) => setEditing({ ...editing, [t.id]: e.target.value })}
              rows={2}
              className={`${inputCls} mt-3`}
            />
            <button
              onClick={() => save.mutate(t)}
              disabled={editing[t.id] === undefined || editing[t.id] === t.body}
              className="mt-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    );
  }
}
