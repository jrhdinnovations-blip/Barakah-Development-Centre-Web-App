import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "https://bidhwdaxkbuxewfogxcx.supabase.co";
const rawServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const fallbackKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_NuHEsBKe8pc_YiNU4TAsQA_-6zC8OFy";

export const hasServiceRoleKey = Boolean(rawServiceRoleKey && rawServiceRoleKey.trim().length > 0);

if (!supabaseUrl || !hasServiceRoleKey) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

export const supabaseAdmin = createClient(supabaseUrl, hasServiceRoleKey ? rawServiceRoleKey : fallbackKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});