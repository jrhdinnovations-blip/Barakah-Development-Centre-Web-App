import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/admin/users/permissions')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      if (metaRole && !roles.includes(metaRole)) roles.push(metaRole);
      const isAuthorized = roles.some((r: string) =>
        ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher'].includes(r)
      );
      if (!isAuthorized) throw redirect({ to: '/my-swift-move' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: PermissionsPage,
});

const PERMISSIONS_MATRIX = [
  { permission: 'View Dashboard', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Dispatcher Console', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Live Fleet Tracking', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Assign / Reassign Trips', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Trip Override & Cancellation', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Manage Users', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
  { permission: 'Create/Delete Users', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
  { permission: 'Assign Roles', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
  { permission: 'View All Orders', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Manage Riders', admin: true, manager: true, dispatcher: true, driver: false, customer: false },
  { permission: 'Approve Riders', admin: true, manager: true, dispatcher: false, driver: false, customer: false },
  { permission: 'Manage Pricing', admin: true, manager: true, dispatcher: false, driver: false, customer: false },
  { permission: 'Manage Zones', admin: true, manager: true, dispatcher: false, driver: false, customer: false },
  { permission: 'View Finance', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
  { permission: 'Accept Deliveries', admin: false, manager: false, dispatcher: false, driver: true, customer: false },
  { permission: 'Update Trip Status', admin: false, manager: false, dispatcher: true, driver: true, customer: false },
  { permission: 'Book Dispatch', admin: false, manager: false, dispatcher: false, driver: false, customer: true },
  { permission: 'Book Vehicle Hire', admin: false, manager: false, dispatcher: false, driver: false, customer: true },
  { permission: 'View Own Orders', admin: true, manager: true, dispatcher: true, driver: true, customer: true },
  { permission: 'Make Payments', admin: false, manager: false, dispatcher: false, driver: false, customer: true },
  { permission: 'Audit Logs', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
  { permission: 'System Settings', admin: true, manager: false, dispatcher: false, driver: false, customer: false },
];

const Check = ({ v }: { v: boolean }) => v
  ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto" />
  : <XCircle className="h-5 w-5 text-slate-700 mx-auto" />;

function PermissionsPage() {
  const [matrix] = useState(PERMISSIONS_MATRIX);

  return (
    <div className="min-h-screen bg-[#070b14] p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl"><Key className="h-6 w-6 text-amber-400" /></div>
          Permissions Matrix
        </h1>
        <p className="text-slate-400 text-sm mt-1">Overview of what each role can access across the platform</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-72">Permission</th>
                {[
                  { label: 'Admin', color: 'text-purple-400' },
                  { label: 'Manager', color: 'text-emerald-400' },
                  { label: 'Dispatcher', color: 'text-cyan-400' },
                  { label: 'Driver', color: 'text-orange-400' },
                  { label: 'Customer', color: 'text-blue-400' },
                ].map(h => (
                  <th key={h.label} className={`px-4 py-4 text-xs font-bold uppercase tracking-wider text-center ${h.color}`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {matrix.map((row, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-slate-200">{row.permission}</td>
                  <td className="px-4 py-3.5 text-center"><Check v={row.admin} /></td>
                  <td className="px-4 py-3.5 text-center"><Check v={row.manager} /></td>
                  <td className="px-4 py-3.5 text-center"><Check v={row.dispatcher} /></td>
                  <td className="px-4 py-3.5 text-center"><Check v={row.driver} /></td>
                  <td className="px-4 py-3.5 text-center"><Check v={row.customer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/30 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Allowed</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-slate-600" />Not Allowed</span>
          <Badge variant="outline" className="ml-auto text-slate-500 border-slate-700">{matrix.length} permissions defined</Badge>
        </div>
      </div>
    </div>
  );
}
