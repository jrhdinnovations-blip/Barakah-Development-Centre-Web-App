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
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { SwiftmoveHeader } from "@/components/SwiftmoveHeader";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { registerServiceWorker } from "@/pwa-register";
import { ORG } from "@/lib/site";

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
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: `${ORG.legalName} — ${ORG.tagline}` },
      {
        name: "description",
        content:
          "Barakah Development Centre empowers people, strengthens institutions and transforms communities through knowledge, leadership, innovation and service.",
      },
      { property: "og:title", content: `${ORG.legalName}` },
      { property: "og:description", content: ORG.tagline },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },

      // --- PWA MOBILE CAPABILITIES ---
      { name: "theme-color", content: "#020617" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Swift Move" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&display=swap",
      },

      // --- PWA MANIFEST & APPLE TOUCH ICON ---
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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

  // Broadened to catch all variations: /my-swift-move, /swiftmove-move/new, and /my-vehicle-hires
  const isSwiftmove =
    pathname.includes("swift") ||
    pathname.includes("vehicle") ||
    (typeof window !== "undefined" && window.location.hostname.includes("swiftmove"));

  // Register PWA Service Worker on startup
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Apply dark background to body tag
  useEffect(() => {
    if (isSwiftmove) {
      document.documentElement.classList.add("swiftmove-theme");
      document.body.style.backgroundColor = "#070b14";
      document.body.style.color = "#e2e8f0";
    } else {
      document.documentElement.classList.remove("swiftmove-theme");
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    }
  }, [isSwiftmove]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col relative overflow-x-hidden transition-colors duration-300">

        {/* Swiftmove Header or Barakah Header */}
        {isSwiftmove ? <SwiftmoveHeader /> : <SiteHeader />}

        <main className="flex-1 relative z-10">
          {/* Swiftmove Background Elements */}
          {isSwiftmove && (
            <>
              <div
                className="absolute inset-0 -z-20 w-full h-full opacity-25 pointer-events-none"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2074&auto=format&fit=crop')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-[#070b14]/95 to-[#070b14] pointer-events-none" />
              <div className="absolute inset-0 -z-10 opacity-10 mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='%233b82f6' stroke-width='1' fill='none' stroke-opacity='0.15'/%3E%3C/svg%3E")`, backgroundSize: '40px 40px' }} />
              <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-700/15 blur-[120px] pointer-events-none -z-10" />
              <div className="absolute top-[50%] -left-[10%] w-[400px] h-[400px] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none -z-10" />
            </>
          )}

          {/* Render active page */}
          <Outlet />
        </main>

        {!isSwiftmove && <SiteFooter />}
      </div>

      {/* Dynamic Native PWA Installation Banner */}
      <PwaInstallBanner />

      <Toaster richColors position="top-center" theme={isSwiftmove ? "dark" : "light"} />
    </QueryClientProvider>
  );
}