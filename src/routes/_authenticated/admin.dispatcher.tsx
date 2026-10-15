import { createFileRoute } from '@tanstack/react-router';
import { DispatcherDashboardView } from '@/components/dispatcher/dispatcher-dashboard-view';
import { requireRoleAccess, ADMIN_ROLES, DISPATCHER_ROLES } from '@/lib/admin-auth';

export const Route = createFileRoute('/_authenticated/admin/dispatcher')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Dispatcher Operations — SwiftMove Admin' }],
  }),
  beforeLoad: async () => {
    await requireRoleAccess([...ADMIN_ROLES, ...DISPATCHER_ROLES]);
  },
  component: DispatcherDashboardView,
});

