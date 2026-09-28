/**
 * Domain & App-Mode Detection Helper for SwiftMove Isolation.
 * 
 * Determines whether the current environment should run in standalone SwiftMove mode.
 * Triggers:
 * 1. Hostname contains "swiftmove" (e.g. swiftmove.ng, swiftmove.com, app.swiftmove.ng, swiftmove.local)
 * 2. Environment variable VITE_APP_MODE === "swiftmove" or VITE_SWIFTMOVE_ONLY === "true"
 * 3. URL query override: ?mode=swiftmove (persisted to sessionStorage)
 */

import { isNativeApp } from './native-mobile';

export function isSwiftmoveDomain(): boolean {
  // 0. Native Mobile App Shell (Android & iOS)
  if (typeof window !== "undefined" && isNativeApp()) {
    return true;
  }

  // 1. Client-side hostname & query detection (highest priority for multi-domain routing)
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    // If explicit barakah domain, always return false
    if (host.includes("barakah")) {
      return false;
    }

    // Explicit custom domains list
    const customDomains = (
      import.meta.env.VITE_SWIFTMOVE_CUSTOM_DOMAINS ||
      import.meta.env.VITE_SWIFTMOVE_DOMAIN ||
      "swiftmove.ng"
    )
      .toLowerCase()
      .split(",")
      .map((d: string) => d.trim())
      .filter(Boolean);

    // Check custom domains list (e.g. swiftmove.ng)
    if (customDomains.some((d: string) => host === d || host.endsWith(`.${d}`))) {
      return true;
    }

    // Default match: any hostname containing "swiftmove"
    if (host.includes("swiftmove")) {
      return true;
    }

    // URL override for testing/preview: ?mode=swiftmove or ?mode=barakah
    try {
      const search = window.location.search;
      if (search) {
        const params = new URLSearchParams(search);
        const mode = params.get("mode") || params.get("app");
        if (mode === "swiftmove") {
          sessionStorage.setItem("barakah_swiftmove_mode", "true");
          return true;
        }
        if (mode === "barakah") {
          sessionStorage.removeItem("barakah_swiftmove_mode");
          return false;
        }
      }

      if (sessionStorage.getItem("barakah_swiftmove_mode") === "true") {
        return true;
      }
    } catch {
      // Ignore storage errors in restrictive browser environments
    }
  }

  // 2. Environment variable override (only active if set and not on a barakah domain)
  const envMode = (
    import.meta.env.VITE_APP_MODE ||
    import.meta.env.VITE_SWIFTMOVE_ONLY ||
    ""
  ).toLowerCase();
  if (envMode === "swiftmove" || envMode === "true" || envMode === "standalone") {
    return true;
  }

  return false;
}

export function isSwiftmovePath(pathname: string): boolean {
  const p = (pathname || "").toLowerCase();
  return (
    p.startsWith("/swift") ||
    p.startsWith("/drive") ||
    p.startsWith("/vehicle") ||
    p.startsWith("/dispatcher") ||
    p.startsWith("/my-swift") ||
    p.startsWith("/my-vehicle")
  );
}

export function isSwiftmoveContext(pathname?: string): boolean {
  if (isSwiftmoveDomain()) return true;
  if (pathname) return isSwiftmovePath(pathname);
  return false;
}
