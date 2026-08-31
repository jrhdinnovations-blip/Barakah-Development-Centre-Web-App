import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaff, templateSchema, uuid } from "./staff.server";

export const myNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return count ?? 0;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("user_id", userId)
      .is("read_at", null);
    return { ok: true };
  });

export const staffListTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data } = await supabase
      .from("notification_templates")
      .select("*")
      .order("key");
    return data ?? [];
  });

export const staffUpsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      key: data.key,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
    };
    if (data.id) {
      await supabase.from("notification_templates").update(fields).eq("id", data.id);
    } else {
      await supabase.from("notification_templates").insert({ ...fields, created_by: userId });
    }
    return { ok: true };
  });
