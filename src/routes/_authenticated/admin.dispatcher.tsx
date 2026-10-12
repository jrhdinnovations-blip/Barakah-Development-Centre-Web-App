import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { DispatcherDashboardView } from '@/components/dispatcher/dispatcher-dashboard-view';

export const Route = createFileRoute('/_authenticated/admin/dispatcher')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });

      // Super admins always have access
      const SUPER_ADMIN_EMAILS = ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com'];
      const email = user.email?.toLowerCase() || '';
      if (SUPER_ADMIN_EMAILS.includes(email)) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const isAuthorized =
        userRoles.some((r: string) => ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher', 'driver', 'dispatch_rider'].includes(r)) ||
        ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher', 'driver', 'dispatch_rider'].includes(metaRole);
      if (!isAuthorized) {
        throw redirect({ to: '/my-swift-move' });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: DispatcherDashboardView,
});
