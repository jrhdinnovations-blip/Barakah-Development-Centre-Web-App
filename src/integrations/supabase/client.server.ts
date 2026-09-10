import { createClient } from "@supabase/supabase-js";
import { sanitizeSupabaseUrl, sanitizeSupabaseKey } from "./client";

const rawUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

const rawServiceRoleKey = (process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim().replace(/^["']|["']$/g, "").trim();
const fallbackKey = sanitizeSupabaseKey(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);

export const hasServiceRoleKey = Boolean(rawServiceRoleKey && rawServiceRoleKey.length > 0);

const activeKey = hasServiceRoleKey ? rawServiceRoleKey : fallbackKey;

/**
 * Custom fetch that handles new Supabase opaque API key formats (sb_publishable_* / sb_secret_*).
 *
 * Supabase has TWO different auth mechanisms:
 *  - PostgREST / Storage APIs  → use only `apikey` header (no Bearer for opaque keys)
 *  - Auth Admin API (/auth/v1/admin/*) → REQUIRES `Authorization: Bearer <service_role_key>`
 *
 * The old wrapper stripped Bearer for ALL opaque key requests, breaking auth.admin.createUser()
 * so accounts were created without email_confirm:true taking effect → riders got "Invalid login credentials".
 */
function createServerFetch(key: string): typeof fetch {
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");

  return (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    // Auth Admin API endpoints require Bearer token — keep it for these
    const isAuthAdmin = url.includes("/auth/v1/admin");

    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((value, k) => headers.set(k, value));
    }

    if (isOpaque) {
      if (!isAuthAdmin) {
        // PostgREST / Storage: strip Bearer, only apikey is valid for opaque keys
        if (headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
      } else {
        // Auth Admin API: ensure Bearer is always present
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${key}`);
        }
      }
    }

    // Always set apikey (needed for PostgREST RLS bypass)
    headers.set("apikey", key);

    return fetch(input, { ...init, headers });
  };
}

export const supabaseAdmin = createClient(supabaseUrl, activeKey, {
  global: {
    fetch: createServerFetch(activeKey),
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});