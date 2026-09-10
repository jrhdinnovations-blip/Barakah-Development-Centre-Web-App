import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { adminFetchAllOrders } from '@/lib/dispatcher.functions';
import { 
  Users, ShieldCheck, Activity, Package, Car, 
  Settings, CreditCard, Building, MapPin, Truck, Shield, RefreshCw, Radio, Mail, Image, ShieldAlert
} from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const isAuthorized =
        userRoles.some((r: string) => ['administrator', 'admin', 'swift_manager'].includes(r)) ||
        ['administrator', 'admin', 'swift_manager'].includes(metaRole);
      if (!isAuthorized) {
        if (userRoles.includes('swift_dispatcher') || userRoles.includes('dispatcher') || metaRole === 'swift_dispatcher' || metaRole === 'dispatcher') {
          throw redirect({ to: '/dispatcher' });
        }
        if (userRoles.includes('driver') || userRoles.includes('dispatch_rider') || metaRole === 'driver' || metaRole === 'dispatch_rider') {
          throw redirect({ to: '/drive' });
        }
        throw redirect({ to: '/my-swift-move' });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: CentralAdminDashboard,
});

const DASHBOARD_SECTIONS = [
  {
    title: 'Logistics & Operations',
    description: 'Manage dispatch, fleet, and financial operations',
    items: [
      { title: 'Dispatcher Console', path: '/dispatcher', icon: Radio, color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { title: 'Swift Move Logistics', path: '/admin/swift-move', icon: Package, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { title: 'Fleet Riders & Drivers', path: '/admin/riders', icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { title: 'Vehicles', path: '/admin/riders/vehicles', icon: Car, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { title: 'Finance & Accounting', path: '/admin/finance', icon: CreditCard, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    ],
  },
  {
    title: 'Users & Roles',
    description: 'Platform accounts and access management',
    items: [
      { title: 'All Users', path: '/admin/users', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      { title: 'System Roles', path: '/admin/users/roles', icon: ShieldCheck, color: 'text-rose-400', bg: 'bg-rose-500/10' },
      { title: 'Permissions Matrix', path: '/admin/users/permissions', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ],
  },
  {
    title: 'Staff & Locations',
    description: 'Internal employees and branches',
    items: [
      { title: 'Staff Directory', path: '/admin/staff', icon: Building, color: 'text-teal-400', bg: 'bg-teal-500/10' },
      { title: 'Company Emails', path: '/admin/emails', icon: Mail, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { title: 'Human Resources', path: '/admin/hr', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { title: 'Branch Locations', path: '/staff/branches', icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    ],
  },
  {
    title: 'System & Compliance',
    description: 'Global configuration, audit logs and monitoring',
    items: [
      { title: 'System Audit Logs', path: '/admin/audit', icon: ShieldAlert, color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { title: 'Global Settings', path: '/settings', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-800' },
    ],
  },
  {
    title: 'Content & Media',
    description: 'Upload and manage images and videos on the Barakah website',
    items: [
      { title: 'Media Library', path: '/admin/media', icon: Image, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    ],
  },
];

function CentralAdminDashboard() {
  const [liveOrdersCount, setLiveOrdersCount] = useState<number>(0);
  const [onlineDriversCount, setOnlineDriversCount] = useState<number>(0);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const syncLiveMetrics = useCallback(async () => {
    try {
      const result = await adminFetchAllOrders();
      const activeDels = (result?.deliveries || []).filter((d: any) =>
        ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status)
      ).length;
      const activeVhs = (result?.vehicleBookings || []).filter((v: any) =>
        ['pending', 'booked', 'in_transit', 'matched'].includes(v.status)
      ).length;
      const onlineDrvs = (result?.activeDrivers || []).filter((a: any) =>
        a.status === 'available'
      ).length;
      const totalUsers = (result?.profiles || []).length;

      setLiveOrdersCount(activeDels + activeVhs);
      setOnlineDriversCount(onlineDrvs);
      setTotalUsersCount(totalUsers);
      setLastSync(new Date());
    } catch (e) {
      console.warn('Central Admin metrics sync warning:', e);
    }
  }, []);

  const syncRef = useRef(syncLiveMetrics);
  useEffect(() => { syncRef.current = syncLiveMetrics; }, [syncLiveMetrics]);

  useEffect(() => {
    syncLiveMetrics();

    const channel = supabase
      .channel(`central-admin-live-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swift_deliveries' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_hire_bookings' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_drivers' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => syncRef.current())
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    const poll = setInterval(() => {
      syncRef.current();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [syncLiveMetrics]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncLiveMetrics();
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-6 lg:p-10 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                <ShieldCheck className="h-8 w-8 text-blue-500" />
              </div>
              Supa Admin Dashboard
            </h1>
            <p className="text-slate-400 mt-2 max-w-xl">
              Welcome to the SwiftMove Logistics & Fleet Operations Admin. Monitor live orders, dispatch couriers, manage vehicles, and oversee system access in real time.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-xs font-bold text-emerald-400 tracking-wider">
                {isRealtimeActive ? 'LIVE REALTIME' : 'CONNECTING'}
              </span>
              <span className="text-[11px] text-slate-500 ml-1">
                {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Realtime Ecosystem Vitals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-6 duration-600">
          <Link
            to="/admin/swift-move"
            className="group p-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-orange-950/20 via-[#0a0f1c] to-[#0a0f1c] hover:border-orange-500/40 transition-all flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                Live Active Orders
              </p>
              <p className="text-3xl font-black text-white mt-1">{liveOrdersCount}</p>
              <p className="text-xs text-slate-400 mt-1">Dispatches & Rides undergoing delivery &rarr;</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <Package className="h-6 w-6" />
            </div>
          </Link>

          <Link
            to="/admin/riders"
            className="group p-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-950/20 via-[#0a0f1c] to-[#0a0f1c] hover:border-emerald-500/40 transition-all flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online Fleet
              </p>
              <p className="text-3xl font-black text-white mt-1">{onlineDriversCount}</p>
              <p className="text-xs text-slate-400 mt-1">Active drivers ready for dispatch &rarr;</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Truck className="h-6 w-6" />
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="group p-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-blue-950/20 via-[#0a0f1c] to-[#0a0f1c] hover:border-blue-500/40 transition-all flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Platform Users
              </p>
              <p className="text-3xl font-black text-white mt-1">{totalUsersCount}</p>
              <p className="text-xs text-slate-400 mt-1">Customers, staff & driver accounts &rarr;</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6" />
            </div>
          </Link>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {DASHBOARD_SECTIONS.map((section, idx) => (
            <div key={idx} className="animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white tracking-tight">{section.title}</h2>
                <p className="text-sm text-slate-400">{section.description}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {section.items.map((item, i) => (
                  <Link 
                    key={i} 
                    to={item.path as any}
                    className="group relative flex flex-col p-6 rounded-2xl border border-slate-800 bg-[#0a0f1c] hover:border-slate-600 hover:bg-slate-800/50 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${item.bg}`}>
                      <item.icon className={`h-7 w-7 ${item.color}`} />
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">{item.title}</h3>
                    
                    <div className="mt-4 flex items-center text-xs font-semibold text-slate-500 group-hover:text-blue-400 transition-colors">
                      Open Module &rarr;
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}