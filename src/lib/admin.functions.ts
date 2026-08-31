import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "administrator",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const [users, pages] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
    ]);
    return {
      userCount: users.count ?? 0,
      publishedPages: pages.count ?? 0,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const [profiles, roles] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, phone, location, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    return (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.user_id) ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["registered_user", "administrator", "programme_officer", "content_editor"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: data.grant ? "role.grant" : "role.revoke",
      entity_type: "user_roles",
      metadata: { target_user: data.userId, role: data.role },
    });
    return { ok: true };
  });

const pageSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().max(50000).optional(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const listPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { data } = await supabase
      .from("pages")
      .select("id, slug, title, status, updated_at")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const upsertPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    pageSchema.extend({ id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { id, ...rest } = data;
    const fields = {
      slug: rest.slug,
      title: rest.title,
      status: rest.status,
      excerpt: rest.excerpt ?? null,
      body: rest.body ?? null,
    };
    if (id) {
      await supabase.from("pages").update(fields).eq("id", id);
    } else {
      await supabase.from("pages").insert({ ...fields, created_by: userId });
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: id ? "page.update" : "page.create",
      entity_type: "pages",
      metadata: { slug: fields.slug, status: fields.status },
    });
    return { ok: true };
  });
