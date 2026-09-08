import { useState } from 'react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Settings, Shield, User, Truck, Check, Loader2, Radio } from 'lucide-react';

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
        
        {/* Floating Developer Role Switcher Widget */}
        <RoleSwitcher />
      </main>
    </div>
  );
}

function RoleSwitcher() {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  if (!auth?.user) return null;
  
  const currentRole = auth.role ?? 'registered_user';
  
  const roles = [
    { value: 'registered_user', label: 'Customer / User', path: '/my-swift-move', icon: User, color: 'text-blue-400' },
    { value: 'swift_dispatcher', label: 'Dispatcher Console', path: '/dispatcher', icon: Radio, color: 'text-cyan-400' },
    { value: 'driver', label: 'Driver Console', path: '/drive', icon: Truck, color: 'text-orange-400' },
    { value: 'administrator', label: 'Platform Admin', path: '/admin', icon: Shield, color: 'text-purple-400' },
  ];

  const handleRoleChange = async (roleValue: string, targetPath: string) => {
    if (roleValue === currentRole) {
      navigate({ to: targetPath as any });
      setIsOpen(false);
      return;
    }
    
    setSwitching(true);
    const toastId = toast.loading(`Switching role to ${roleValue}...`);
    
    try {
      // 1. Update user metadata role
      const { error: metaError } = await supabase.auth.updateUser({
        data: { role: roleValue }
      });
      
      if (metaError) throw metaError;
      
      // 2. Attempt to update database role (swallowing RLS errors if they occur)
      try {
        await supabase
          .from('user_roles')
          .upsert({ 
            user_id: auth.user.id, 
            role: roleValue as any,
            status: 'active'
          }, { onConflict: 'user_id,role' });
      } catch (dbErr) {
        console.warn("DB role sync bypassed due to RLS policies:", dbErr);
      }
      
      toast.dismiss(toastId);
      toast.success(`Role changed to ${roleValue}!`);
      
      // Navigate to correct page and reload to reset layout
      navigate({ to: targetPath as any }).then(() => {
        setTimeout(() => {
          window.location.reload();
        }, 150);
      });
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error: ${err.message || 'Could not switch role'}`);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 border border-blue-500/20 cursor-pointer"
        title="Simulate / Switch Roles"
      >
        {switching ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Settings className="h-5 w-5 animate-[spin_4s_linear_infinite]" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-60 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="mb-3 border-b border-slate-800/80 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Role Switcher (Dev Mode)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Toggle active dashboard view & access level</p>
          </div>
          
          <div className="space-y-1">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = currentRole === r.value;
              
              return (
                <button
                  key={r.value}
                  onClick={() => handleRoleChange(r.value, r.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${r.color}`} />
                    <span>{r.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
