import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const publicRegisterUserServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().email("Please enter a valid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        fullName: z.string().min(1, "Full name is required"),
        phone: z.string().optional(),
        location: z.string().optional(),
        platform: z.enum(["swiftmove", "barakah"]).default("swiftmove"),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    // Check if user already exists in auth
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      throw new Error(`Auth service error: ${listErr.message}`);
    }

    const existingUser = listData?.users?.find((u) => u.email && u.email.toLowerCase() === email);

    if (existingUser) {
      // If user exists but is unconfirmed, auto-confirm and update password
      if (!existingUser.email_confirmed_at) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: data.password,
          email_confirm: true,
          user_metadata: {
            ...existingUser.user_metadata,
            full_name: data.fullName || existingUser.user_metadata?.full_name,
            phone: data.phone || existingUser.user_metadata?.phone,
            role: "registered_user",
            platform: data.platform,
          },
        });
        if (updErr) throw new Error(updErr.message);
        return { ok: true, autoConfirmedExisting: true };
      }

      return { ok: false, error: "already_registered" };
    }

    // Create user with email_confirm: true so they can sign in immediately
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone || null,
        location: data.location || null,
        role: "registered_user",
        consent_given: true,
        platform: data.platform,
      },
    });

    if (createErr) {
      throw new Error(createErr.message);
    }

    return { ok: true, userId: created.user.id };
  });

export const publicAutoConfirmUserServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const user = listData?.users?.find((u) => u.email && u.email.toLowerCase() === email);

    if (!user) return { ok: false, message: "User not found" };

    if (!user.email_confirmed_at) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      return { ok: true, confirmed: true };
    }

    return { ok: true, alreadyConfirmed: true };
  });
