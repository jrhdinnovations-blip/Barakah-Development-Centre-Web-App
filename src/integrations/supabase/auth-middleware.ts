import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "./types";

export const requireSupabaseAuth = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const authHeader = headers.get("authorization") || headers.get("cookie") || "";

  // Extract token or validate active session
  const token = authHeader.includes("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : undefined;

  const { data: { user }, error } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized access");
  }

  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "https://bidhwdaxkbuxewfogxcx.supabase.co";
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_NuHEsBKe8pc_YiNU4TAsQA_-6zC8OFy";

  // When a token is available, create a scoped authenticated client so database queries and RPCs
  // run with the authenticated user's permissions and RLS context
  const authSupabase = token
    ? createClient<Database>(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseKey,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : supabase;

  return next({
    context: {
      supabase: authSupabase,
      userId: user.id,
      user,
      token,
    },
  });
});