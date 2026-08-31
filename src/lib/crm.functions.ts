import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, enquirySchema, followUpSchema, requireStaff, uuid } from "./staff.server";

export const submitEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input) => enquirySchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Link to an existing contact (matched by email) when there is one
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("enquiries").insert({
      contact_id: contact?.id ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListEnquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ status: z.string().max(30).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    let q = supabase
      .from("enquiries")
      .select("id, name, email, phone, subject, message, status, assigned_to, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const staffAssignEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ enquiryId: uuid, assignTo: uuid.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase
      .from("enquiries")
      .update({ assigned_to: data.assignTo, status: "in_progress" })
      .eq("id", data.enquiryId);
    if (error) throw new Error(error.message);
    await audit({ supabase, userId }, "enquiry.assign", "enquiries", data.enquiryId);
    return { ok: true };
  });

export const staffResolveEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ enquiryId: uuid, resolved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase
      .from("enquiries")
      .update({
        status: data.resolved ? "resolved" : "in_progress",
        resolved_at: data.resolved ? new Date().toISOString() : null,
      })
      .eq("id", data.enquiryId);
    if (error) throw new Error(error.message);
    await audit({ supabase, userId }, "enquiry.resolve", "enquiries", data.enquiryId, {
      resolved: data.resolved,
    });
    return { ok: true };
  });

export const staffEnquiryNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ enquiryId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: rows } = await supabase
      .from("enquiry_notes")
      .select("id, body, created_at, author:profiles!enquiry_notes_author_id_fkey(full_name)")
      .eq("enquiry_id", data.enquiryId)
      .order("created_at");
    return rows ?? [];
  });

export const staffAddEnquiryNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ enquiryId: uuid, body: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase
      .from("enquiry_notes")
      .insert({ enquiry_id: data.enquiryId, author_id: userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListFollowUps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: rows } = await supabase
      .from("follow_ups")
      .select("id, due_date, note, status, assigned_to, enquiry:enquiries(subject, name)")
      .eq("status", "open")
      .order("due_date")
      .limit(100);
    return rows ?? [];
  });

export const staffUpsertFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => followUpSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase.from("follow_ups").insert({
      enquiry_id: data.enquiryId ?? null,
      contact_id: data.contactId ?? null,
      assigned_to: userId,
      due_date: data.dueDate,
      note: data.note ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffCompleteFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { error } = await supabase
      .from("follow_ups")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
