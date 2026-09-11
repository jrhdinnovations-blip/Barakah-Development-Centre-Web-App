/**
 * Domain & App-Mode Detection Helper for SwiftMove Isolation.
 * 
 * Determines whether the current environment should run in standalone SwiftMove mode.
 * Triggers:
 * 1. Hostname contains "swiftmove" (e.g. swiftmove.ng, swiftmove.com, app.swiftmove.ng, swiftmove.local)
 * 2. Environment variable VITE_APP_MODE === "swiftmove" or VITE_SWIFTMOVE_ONLY === "true"
 * 3. URL query override: ?mode=swiftmove (persisted to sessionStorage)
 */

export function isSwiftmoveDomain(): boolean {
  // 1. Environment variable override (build-time & runtime)
  const envMode = (import.meta.env.VITE_APP_MODE || import.meta.env.VITE_SWIFTMOVE_ONLY || "").toLowerCase();
  if (envMode === "swiftmove" || envMode === "true") {
    return true;
  }

  // 2. Client-side hostname & query detection
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("swiftmove")) {
      return true;
    }

    // URL override for testing: ?mode=swiftmove or ?mode=barakah
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

  return false;
}
