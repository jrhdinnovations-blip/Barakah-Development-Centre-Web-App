import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaff } from "./staff.server";

export const staffOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);

    const [apps, bookings, enquiries, courses, recentApps, recentBookings, recentEnquiries] =
      await Promise.all([
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "under_review"]),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("status", ["requested", "confirmed"]),
        supabase
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved"),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase
          .from("applications")
          .select("id, status, submitted_at, programme:programmes(title)")
          .order("submitted_at", { ascending: false })
          .limit(5),
        supabase
          .from("bookings")
          .select("id, status, created_at, slot:booking_slots(starts_at, service:booking_services(title))")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("enquiries")
          .select("id, name, subject, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    return {
      openApplications: apps.count ?? 0,
      activeBookings: bookings.count ?? 0,
      openEnquiries: enquiries.count ?? 0,
      totalCourses: courses.count ?? 0,
      recentApplications: recentApps.data ?? [],
      recentBookings: recentBookings.data ?? [],
      recentEnquiries: recentEnquiries.data ?? [],
    };
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active");
    return (data ?? []).map((r) => r.role);
  });

export const staffExecStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const [payments, cases, travel, orders] = await Promise.all([
      supabase.from("payments").select("amount_kobo").eq("status", "completed"),
      supabase
        .from("assistance_requests")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("closed","declined")'),
      supabase
        .from("travel_enrolments")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("completed","cancelled")'),
      supabase.from("orders").select("id", { count: "exact", head: true }),
    ]);
    return {
      totalRevenueKobo: (payments.data ?? []).reduce((s, p) => s + p.amount_kobo, 0),
      activeCases: cases.count ?? 0,
      activeTravelEnrolments: travel.count ?? 0,
      totalOrders: orders.count ?? 0,
    };
  });
