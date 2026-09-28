/**
 * Server-side platform detection using HTTP request headers.
 * This file must only be imported via createServerFn — never directly in client code.
 *
 * Reads the Host / X-Forwarded-Host header to determine if the request
 * originates from swiftmove.ng (SwiftMove) or barakahdevcentre.com (Barakah).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

/**
 * Detects the current platform from the incoming HTTP request's Host header.
 * Returns:
 *   "swiftmove" — if the host contains "swiftmove" and not "barakah"
 *   "barakah"   — otherwise (including barakahdevcentre.com, localhost, etc.)
 */
export const detectPlatform = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const headers = getRequestHeaders();
    // Prefer X-Forwarded-Host (set by Cloudflare/proxies), fall back to Host
    const host = (
      headers["x-forwarded-host"] ||
      headers["host"] ||
      ""
    ).toLowerCase();

    const isSwiftmove = host.includes("swiftmove") && !host.includes("barakah");
    return { platform: isSwiftmove ? "swiftmove" as const : "barakah" as const, host };
  } catch (_) {
    return { platform: "barakah" as const, host: "" };
  }
});
