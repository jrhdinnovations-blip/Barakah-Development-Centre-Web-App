import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/auth')({
  // If already logged in, redirect to the dashboard
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      throw redirect({ to: '/my-swift-move' as any });
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
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}