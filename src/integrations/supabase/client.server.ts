import { createClient } from "@supabase/supabase-js";
import { sanitizeSupabaseUrl, sanitizeSupabaseKey } from "./client";

const rawUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

const rawServiceRoleKey = (process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim().replace(/^["']|["']$/g, "").trim();
const fallbackKey = sanitizeSupabaseKey(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);

export const hasServiceRoleKey = Boolean(rawServiceRoleKey && rawServiceRoleKey.length > 0);

export const supabaseAdmin = createClient(supabaseUrl, hasServiceRoleKey ? rawServiceRoleKey : fallbackKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});