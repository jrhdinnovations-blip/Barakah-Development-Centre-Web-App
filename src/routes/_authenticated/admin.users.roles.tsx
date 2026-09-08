import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, Plus, Trash2, Shield, Truck, User, Settings, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_authenticated/admin/users/roles')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      const role = roleData?.role ?? user.user_metadata?.['role'] ?? 'registered_user';
      if (role !== 'administrator') throw redirect({ to: '/my-swift-move' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: RolesPage,
});

const SYSTEM_ROLES = [
  {
    id: 'administrator',
    name: 'Administrator',
    description: 'Full platform access — manages all users, apps, billing, and settings.',
    icon: Shield,
    color: 'purple',
    users: 0,
    permissions: ['All Permissions'],
    system: true,
  },
  {
    id: 'swift_manager',
    name: 'Swift Manager',
    description: 'Manages the SwiftMove logistics engine — dispatches, riders, and zones.',
    icon: Settings,
    color: 'emerald',
    users: 0,
    permissions: ['Swift Move', 'Riders', 'Dispatch'],
    system: true,
  },
  {
    id: 'swift_dispatcher',
    name: 'Dispatcher',
    description: 'Controls real-time dispatches, assigns rides & deliveries, and monitors live fleet operations.',
    icon: Radio,
    color: 'cyan',
    users: 0,
    permissions: ['Dispatcher Console', 'Live Fleet Map', 'Assign Trips', 'Trip Control'],
    system: true,
  },
  {
    id: 'driver',
    name: 'Driver / Rider',
    description: 'Field agent who accepts deliveries and performs vehicle hires.',
    icon: Truck,
    color: 'orange',
    users: 0,
    permissions: ['Driver Console', 'Trip History', 'Earnings'],
    system: true,
  },
  {
    id: 'registered_user',
    name: 'Customer',
    description: 'Standard user who can book dispatch, vehicle hire, and manage orders.',
    icon: User,
    color: 'blue',
    users: 0,
    permissions: ['Book Dispatch', 'Vehicle Hire', 'Order History'],
    system: true,
  },
];

const colorMap: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function RolesPage() {
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; description: string }[]>([]);

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    setCustomRoles(prev => [...prev, { id: `custom-${Date.now()}`, name: newRoleName, description: newRoleDesc }]);
    setNewRoleName('');
    setNewRoleDesc('');
    toast.success(`Role "${newRoleName}" added.`);
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl"><ShieldCheck className="h-6 w-6 text-purple-400" /></div>
          Roles
        </h1>
        <p className="text-slate-400 text-sm mt-1">View and manage platform access roles</p>
      </div>

      {/* System Roles */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">System Roles (Built-in)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_ROLES.map(role => {
            const Icon = role.icon;
            const cc = colorMap[role.color] || colorMap['slate'];
            return (
              <div key={role.id} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${cc}`}><Icon className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold text-white">{role.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1 bg-slate-900 border-slate-700 text-slate-400">System Role</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{role.description}</p>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map(p => (
                    <span key={p} className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Roles */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Custom Roles</h2>
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Role name (e.g. Finance Officer)" className="bg-slate-900 border-slate-700 h-11 flex-1" />
            <Input value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Short description" className="bg-slate-900 border-slate-700 h-11 flex-1" />
            <Button onClick={handleAddRole} className="bg-blue-600 hover:bg-blue-500 gap-2 h-11 shrink-0">
              <Plus className="h-4 w-4" /> Add Role
            </Button>
          </div>
          {customRoles.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-4">No custom roles created yet.</p>
          ) : (
            <div className="space-y-2">
              {customRoles.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-white text-sm">{r.name}</p>
                    {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { setCustomRoles(p => p.filter(x => x.id !== r.id)); toast.success('Role removed.'); }} className="h-8 w-8 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
