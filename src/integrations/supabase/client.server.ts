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
 * The standard Supabase client sends `Authorization: Bearer {key}` which Supabase rejects for
 * opaque keys. This wrapper strips that header and ensures only the `apikey` header is set.
 */
function createServerFetch(key: string): typeof fetch {
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((value, k) => headers.set(k, value));
    }

    // For new opaque keys, strip the auto-added Bearer token — only apikey header is valid.
    if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }

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