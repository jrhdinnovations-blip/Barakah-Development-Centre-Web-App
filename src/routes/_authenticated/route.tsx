import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) {
        throw redirect({
          to: '/auth',
          search: { mode: 'login', redirect: location.href },
        });
      }
      return { user };
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({
        to: '/auth',
        search: { mode: 'login', redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

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
