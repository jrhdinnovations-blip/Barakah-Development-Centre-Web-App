import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applicationFormSchema,
  applicationReviewSchema,
  audit,
  notifyUserFromTemplate,
  requireStaff,
  uuid,
} from "./staff.server";

export const listOpenProgrammes = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const pub = createClient(process.env["SUPABASE_URL"]!, key, {
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
  const { data } = await pub
    .from("programmes")
    .select("id, slug, title, summary, category")
    .eq("status", "published")
    .order("title");
  return data ?? [];
});

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applicationFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: programme } = data.programmeId
      ? await supabase
          .from("programmes")
          .select("id, title")
          .eq("id", data.programmeId)
          .eq("status", "published")
          .maybeSingle()
      : { data: null };
    if (data.programmeId && !programme) throw new Error("Programme not found or not open");

    const { data: app, error } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        programme_id: programme?.id ?? null,
        form_data: {
          motivation: data.motivation,
          background: data.background ?? "",
          commitment: data.commitment ?? "",
        },
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const name = programme?.title ?? "General application";
    await notifyUserFromTemplate(
      supabase,
      userId,
      "application_submitted",
      "Application received",
      { programme_name: name },
      "/my-barakah",
    );
    await audit({ supabase, userId }, "application.submit", "applications", app.id);
    return { id: app.id };
  });

export const myApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("applications")
      .select(
        "id, status, form_data, staff_notes, submitted_at, programme:programmes(title), application_status_history(to_status, note, created_at)",
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false });
    return data ?? [];
  });

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("id", data.applicationId)
      .eq("user_id", userId)
      .in("status", ["submitted", "under_review", "waitlisted"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ status: z.string().optional(), programmeId: uuid.optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    let q = supabase
      .from("applications")
      .select(
        "id, status, form_data, staff_notes, submitted_at, programme:programmes(title), applicant:profiles!applications_user_id_fkey(full_name, phone)",
      )
      .order("submitted_at", { ascending: false })
      .limit(200);
    if (data.status)
      q = q.eq(
        "status",
        data.status as
          | "submitted"
          | "under_review"
          | "approved"
          | "rejected"
          | "waitlisted"
          | "withdrawn",
      );
    if (data.programmeId) q = q.eq("programme_id", data.programmeId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applicationReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: app } = await supabase
      .from("applications")
      .select("id, user_id, programme:programmes(title)")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Application not found");

    const { error } = await supabase
      .from("applications")
      .update({ status: data.status, staff_notes: data.note ?? null })
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    if (data.note) {
      await supabase
        .from("application_status_history")
        .update({ note: data.note })
        .eq("application_id", data.applicationId)
        .eq("to_status", data.status)
        .order("created_at", { ascending: false })
        .limit(1);
    }
    const programmeName =
      (Array.isArray(app.programme) ? app.programme[0]?.title : (app.programme as any)?.title) ??
      "your application";
    await notifyUserFromTemplate(
      supabase,
      app.user_id,
      "application_status",
      "Application update",
      { programme_name: programmeName, status: data.status.replace("_", " ") },
      "/my-barakah",
    );
    await audit({ supabase, userId }, "application.review", "applications", data.applicationId, {
      status: data.status,
    });
    return { ok: true };
  });
