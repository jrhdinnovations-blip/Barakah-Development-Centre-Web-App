import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AlertTriangle, RefreshCw, LogIn, Home, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { SwiftmoveHeader } from "@/components/SwiftmoveHeader";
import { TravelHeader } from "@/components/TravelHeader";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { registerServiceWorker } from "@/pwa-register";
import { ORG } from "@/lib/site";
import { isSwiftmoveDomain } from "@/lib/domain-detection";
import { isChunkLoadError, autoRecoverChunkError } from "@/lib/chunk-error-handler";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[TanStack Root ErrorComponent]", error);
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    if (isChunkError) {
      autoRecoverChunkError();
    }
  }, [error, isChunkError]);

  const handleManualAppUpdate = async () => {
    try {
      if (typeof window !== "undefined") {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        sessionStorage.clear();
      }
    } catch (_) {}
    window.location.href = window.location.pathname + "?_v=" + Date.now();
  };

  const handleClearAndReset = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = "/auth";
  };

  const errorMessage = error?.message || (typeof error === 'string' ? error : "An unexpected error occurred while loading this view.");

  // If this is a stale build chunk error, present a graceful update UI
  if (isChunkError) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center p-8 rounded-3xl border border-emerald-500/30 bg-[#0a0f1c]/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 shadow-lg shadow-emerald-500/5">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Updating Application
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            A new version of Barakah & SwiftMove is ready. Tap below to refresh and load the latest updates.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleManualAppUpdate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 active:scale-[0.99]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh & Update Now
            </button>
            <a
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Return to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full text-center p-8 rounded-3xl border border-slate-800 bg-[#0a0f1c]/95 shadow-2xl backdrop-blur-xl">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4 shadow-lg shadow-amber-500/5">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Something interrupted loading this view. You can retry, navigate back home, or reset your current session.
        </p>

        {/* Diagnostic Error Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-red-950/30 border border-red-900/40 text-left">
          <div className="flex items-start gap-2.5">
            <span className="text-red-400 font-bold text-xs shrink-0 mt-0.5">Cause:</span>
            <p className="text-xs font-mono text-red-300 break-words flex-1 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          {error?.stack && (
            <div className="mt-2.5 pt-2 border-t border-red-900/30">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-red-400/80 hover:text-red-300 underline font-medium transition-colors"
              >
                {showDetails ? "Hide technical stack trace ▲" : "Show technical stack trace ▼"}
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-44 overflow-auto text-[10px] text-slate-400 font-mono whitespace-pre-wrap bg-slate-950/90 p-3 rounded-xl border border-slate-800/80 custom-scrollbar">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Recovery Action Buttons */}
        <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Home className="h-4 w-4" />
            Go home
          </a>
          <button
            onClick={handleClearAndReset}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/20 hover:text-orange-300"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Session & Login
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const isSwift = typeof window !== "undefined" && isSwiftmoveDomain();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
        {
          title: isSwift
            ? "SwiftMove Logistics — Fast, Reliable Deliveries & Ride Hailing"
            : `${ORG.legalName} — ${ORG.tagline}`,
        },
        {
          name: "description",
          content: isSwift
            ? "SwiftMove by Barakah Development Centre. On-demand package delivery, dispatch courier, and vehicle hire across Nigeria."
            : "Barakah Development Centre empowers people, strengthens institutions and transforms communities through knowledge, leadership, innovation and service.",
        },
        { property: "og:title", content: isSwift ? "SwiftMove Logistics — On-Demand Deliveries & Rides" : `${ORG.legalName}` },
        { property: "og:description", content: isSwift ? "Fast, reliable deliveries and ride hailing across Nigeria." : ORG.tagline },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },

        // --- PWA MOBILE CAPABILITIES ---
        { name: "theme-color", content: isSwift ? "#080c17" : "#020617" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: isSwift ? "SwiftMove" : "Barakah" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // --- FAVICONS & BRAND ICONS ---
        { rel: "icon", href: isSwift ? "/swiftmove-logo.jpg" : "/favicon.ico?v=3", sizes: "any" },
        { rel: "icon", href: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
        { rel: "icon", href: "/favicon-16x16.png?v=3", type: "image/png", sizes: "16x16" },
        { rel: "icon", href: isSwift ? "/swiftmove-logo.jpg" : "/barakah-centre-logo.png?v=3", type: "image/png" },
        { rel: "shortcut icon", href: isSwift ? "/swiftmove-logo.jpg" : "/favicon.ico?v=3" },
        { rel: "apple-touch-icon", href: isSwift ? "/swiftmove-logo.jpg" : "/apple-touch-icon.png?v=3" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&display=swap",
        },

        // --- PWA MANIFEST ---
        { rel: "manifest", href: "/manifest.json?v=3" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  function handleChunkError() {
    try {
      var key = 'barakah_chunk_reload_ts';
      var last = sessionStorage.getItem(key);
      var now = Date.now();
      if (!last || now - parseInt(last, 10) > 20000) {
        sessionStorage.setItem(key, String(now));
        if ('caches' in window) {
          caches.keys().then(function(names) {
            return Promise.all(names.map(function(n) { return caches.delete(n); }));
          }).finally(function() {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }
    } catch(e) {
      window.location.reload();
    }
  }

  window.addEventListener('vite:preloadError', function(e) {
    e.preventDefault();
    console.warn('[Vite] Preload chunk error intercepted, recovering...');
    handleChunkError();
  });

  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e && e.reason && e.reason.message) || String(e && e.reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk/i.test(msg)) {
      console.warn('[Vite] Dynamic import failure intercepted, recovering...');
      handleChunkError();
    }
  });
})();
`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Track URL dynamically
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isSwiftDomain = isSwiftmoveDomain();

  // Broadened to catch all variations: /my-swift-move, /swiftmove-move/new, and /my-vehicle-hires
  const isSwiftmove =
    isSwiftDomain ||
    pathname.includes("swift") ||
    pathname.includes("vehicle") ||
    pathname.includes("drive") ||
    pathname.includes("dispatcher");

  const isLanding = pathname === "/swiftmove" || (pathname === "/" && isSwiftDomain);

  // Individualized platform check for Barakah Travel & Tours
  const isTravel =
    !isSwiftDomain &&
    (pathname.startsWith("/travel") ||
      pathname === "/my-journey" ||
      (typeof window !== "undefined" && window.location.hostname.includes("travel")));

  // Driver console, Dispatcher, and Admin dashboard get a completely standalone layout — no ecosystem chrome at all
  const isStandaloneApp = pathname.startsWith("/drive") || pathname.startsWith("/admin") || pathname.startsWith("/staff") || pathname.startsWith("/dispatcher");

  // Register PWA Service Worker on startup and suppress Google Maps auth alerts
  useEffect(() => {
    registerServiceWorker();
    
    // Suppress the blocking window.alert() that freezes the page when Maps API Auth fails
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = function() {
        console.error("Google Maps API authentication failed. Please check your API key and billing status.");
      };
    }
  }, []);

  // Apply light Swiftmove theme when active
  useEffect(() => {
    if (isSwiftmove) {
      document.documentElement.classList.add("swiftmove-theme");
      document.body.style.backgroundColor = "#f8fafc";
      document.body.style.color = "#0f172a";
    } else {
      document.documentElement.classList.remove("swiftmove-theme");
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    }
  }, [isSwiftmove]);

  return (
    <QueryClientProvider client={queryClient}>
      {isStandaloneApp ? (
        /* ── Standalone Layout (Driver / Admin): pure full-screen shell, zero ecosystem chrome ── */
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
          <Outlet />
        </div>
      ) : (
      <div className="flex min-h-screen flex-col relative overflow-x-hidden transition-colors duration-300">

        {/* Swiftmove Header, Travel Header, or Barakah Centre Header */}
        {isLanding ? null : isSwiftmove ? (
          <SwiftmoveHeader />
        ) : isTravel ? (
          <TravelHeader />
        ) : (
          <SiteHeader />
        )}

        <main className="flex-1 relative z-10">
          {/* Swiftmove Background Elements */}
          {isSwiftmove && !isLanding && (
            <>
              <div
                className="absolute inset-0 -z-20 w-full h-full opacity-10 pointer-events-none"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2074&auto=format&fit=crop')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-50/90 via-white/80 to-slate-100/90 pointer-events-none" />
              <div className="absolute inset-0 -z-10 opacity-5 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='%23ea580c' stroke-width='1' fill='none' stroke-opacity='0.2'/%3E%3C/svg%3E")`, backgroundSize: '40px 40px' }} />
              <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-100/50 blur-[120px] pointer-events-none -z-10" />
              <div className="absolute top-[50%] -left-[10%] w-[400px] h-[400px] rounded-full bg-orange-100/50 blur-[120px] pointer-events-none -z-10" />
            </>
          )}

          {/* Render active page */}
          <Outlet />
        </main>

        {!isSwiftmove && !isLanding && <SiteFooter />}
      </div>
      )}

      {/* Dynamic Native PWA Installation Banner */}
      <PwaInstallBanner />

      <Toaster richColors position="top-center" theme={isSwiftmove ? "dark" : "light"} />
    </QueryClientProvider>
  );
}