import { useEffect } from 'react';
import { createFileRoute, Outlet, redirect, isRedirect, Link } from '@tanstack/react-router';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { isChunkLoadError, autoRecoverChunkError } from '@/lib/chunk-error-handler';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) {
        throw redirect({
          to: '/auth',
          search: { mode: 'login', redirect: location.pathname },
        });
      }
      return { user };
    } catch (err: any) {
      if (isRedirect(err) || err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({
        to: '/auth',
        search: { mode: 'login', redirect: location.pathname },
      });
    }
  },
  component: AuthenticatedLayout,
  errorComponent: AuthenticatedErrorFallback,
});

function AuthenticatedErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      autoRecoverChunkError();
    }
  }, [error]);

  const isChunk = isChunkLoadError(error);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <MobileNav />
      <AppSidebar className="hidden md:flex shrink-0" />
      <main className="flex-1 min-w-0 p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {isChunk ? 'Application Update Available' : 'Something interrupted this view'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isChunk
              ? 'A newer version of the application is available. Tap below to reload and get the latest updates.'
              : error?.message || 'An unexpected error occurred while loading this section.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isChunk) {
                  window.location.reload();
                } else {
                  reset();
                }
              }}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {isChunk ? 'Refresh App' : 'Retry View'}
            </Button>
            <Link
              to="/my-swift-move"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Mobile Top Navbar & Drawer (< md) */}
      <MobileNav />

      {/* Sticky Desktop Sidebar (>= md) */}
      <AppSidebar className="hidden md:flex shrink-0" />

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 overflow-y-auto relative">
        <Outlet />
      </main>
    </div>
  );
}
