import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  audit,
  hoursSchema,
  notifyUserFromTemplate,
  opportunitySchema,
  requireStaff,
  uuid,
  volunteerProfileSchema,
} from "./staff.server";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { sanitizeSupabaseUrl, sanitizeSupabaseKey } = await import("@/integrations/supabase/client");
  const key = sanitizeSupabaseKey(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  const url = sanitizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listOpportunities = createServerFn({ method: "GET" }).handler(async () => {
  const pub = await publicClient();
  const { data } = await pub
    .from("volunteer_opportunities")
    .select("id, slug, title, description, commitment, location, is_remote")
    .eq("status", "published")
    .order("title");
  return data ?? [];
});

export const saveVolunteerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => volunteerProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("volunteers").upsert({
      user_id: userId,
      skills: data.skills,
      availability: data.availability ?? null,
      bio: data.bio ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const applyToVolunteer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ opportunityId: uuid, message: z.string().trim().max(1000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: opp } = await supabase
      .from("volunteer_opportunities")
      .select("id, title, status")
      .eq("id", data.opportunityId)
      .single();
    if (!opp || opp.status !== "published") throw new Error("Opportunity unavailable");
    const { error } = await supabase
      .from("volunteer_applications")
      .insert({ opportunity_id: data.opportunityId, user_id: userId, message: data.message ?? null, created_by: userId });
    if (error) {
      if (error.code === "23505") throw new Error("You already applied to this opportunity");
      throw new Error(error.message);
    }
    await audit({ supabase, userId }, "volunteer.apply", "volunteer_opportunities", data.opportunityId);
    return { ok: true };
  });

export const myImpact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, applications, assignments] = await Promise.all([
      supabase.from("volunteers").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("volunteer_applications")
        .select("id, status, message, created_at, opportunity:volunteer_opportunities(title)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("volunteer_assignments")
        .select("id, status, created_at, opportunity:volunteer_opportunities(title, location)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    const assignmentIds = (assignments.data ?? []).map((a) => a.id);
    const { data: hours } = assignmentIds.length
      ? await supabase
          .from("volunteer_hours")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("work_date", { ascending: false })
      : { data: [] };
    return {
      profile: profile.data ?? null,
      applications: applications.data ?? [],
      assignments: assignments.data ?? [],
      hours: hours ?? [],
    };
  });

export const logHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => hoursSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: assignment } = await supabase
      .from("volunteer_assignments")
      .select("id, user_id, status")
      .eq("id", data.assignmentId)
      .single();
    if (!assignment || assignment.user_id !== userId) throw new Error("Assignment not found");
    if (assignment.status !== "active") throw new Error("Assignment is not active");
    const { error } = await supabase.from("volunteer_hours").insert({
      assignment_id: data.assignmentId,
      user_id: userId,
      work_date: data.workDate,
      hours: data.hours,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Staff =====

export const staffListVolunteers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const [opportunities, applications, hours] = await Promise.all([
      supabase
        .from("volunteer_opportunities")
        .select("id, slug, title, commitment, location, is_remote, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("volunteer_applications")
        .select("id, status, message, created_at, user_id, opportunity:volunteer_opportunities(title), applicant:profiles!volunteer_applications_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("volunteer_hours")
        .select("id, work_date, hours, note, verified_at, volunteer:profiles!volunteer_hours_user_id_fkey(full_name)")
        .is("verified_at", null)
        .order("work_date", { ascending: false })
        .limit(100),
    ]);
    return {
      opportunities: opportunities.data ?? [],
      applications: applications.data ?? [],
      unverifiedHours: hours.data ?? [],
    };
  });

export const staffUpsertOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => opportunitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      commitment: data.commitment || null,
      location: data.location || null,
      is_remote: data.isRemote,
      status: data.status,
    };
    if (data.id) {
      await supabase.from("volunteer_opportunities").update(fields).eq("id", data.id);
    } else {
      await supabase.from("volunteer_opportunities").insert({ ...fields, created_by: userId });
    }
    return { ok: true };
  });

export const staffReviewVolunteerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ applicationId: uuid, status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: app } = await supabase
      .from("volunteer_applications")
      .select("user_id, opportunity_id, opportunity:volunteer_opportunities(title)")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Application not found");
    await supabase.from("volunteer_applications").update({ status: data.status }).eq("id", data.applicationId);
    if (data.status === "approved") {
      await supabase.from("volunteer_assignments").insert({
        application_id: data.applicationId,
        user_id: app.user_id,
        opportunity_id: app.opportunity_id,
        created_by: userId,
      });
    }
    const opp: any = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
    await notifyUserFromTemplate(supabase, app.user_id, "volunteer_review", `Volunteer application ${data.status}`, {
      opportunity_title: opp?.title ?? "the opportunity",
    }, "/my-impact");
    await audit({ supabase, userId }, "volunteer.review", "volunteer_applications", data.applicationId, { status: data.status });
    return { ok: true };
  });

export const staffVerifyHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ hoursId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase
      .from("volunteer_hours")
      .update({ verified_by: userId, verified_at: new Date().toISOString() })
      .eq("id", data.hoursId)
      .is("verified_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
