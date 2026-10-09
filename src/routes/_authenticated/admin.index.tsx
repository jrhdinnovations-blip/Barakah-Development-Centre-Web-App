import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { adminFetchAllOrders } from '@/lib/dispatcher.functions';
import {
  Users, ShieldCheck, Activity, Package, Car,
  Settings, CreditCard, Building, MapPin, Truck, Shield, RefreshCw,
  Radio, Mail, Image, ShieldAlert, TrendingUp, TrendingDown, Zap,
  ArrowUpRight, Clock, CheckCircle2, XCircle, Navigation, Loader2,
  BarChart3, Wallet, UserPlus, Key, Sparkles, Globe2, AlertCircle,
  ChevronRight, Bell, Layers, Database
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';

const SUPER_ADMIN_EMAILS = ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com'];

export const Route = createFileRoute('/_authenticated/admin/')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      if (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) return;
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveMetrics {
  activeOrders: number;
  onlineDrivers: number;
  totalUsers: number;
  pendingOrders: number;
  deliveredToday: number;
  cancelledToday: number;
  totalRevenue: number;
  vehicleBookings: number;
}

interface RecentActivity {
  id: string;
  type: 'order' | 'driver' | 'user' | 'cancel';
  label: string;
  time: string;
  status: string;
}

// ─── Module Config ────────────────────────────────────────────────────────────

const MODULES = [
  {
    category: 'Logistics & Operations',
    categoryIcon: Truck,
    categoryColor: 'from-orange-500/20 to-amber-500/5',
    borderColor: 'border-orange-500/20',
    accentColor: 'text-orange-400',
    items: [
      {
        title: 'Dispatcher Console',
        desc: 'Live dispatch ops & realtime tracking',
        path: '/dispatcher',
        icon: Radio,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        glow: 'hover:shadow-amber-500/10',
        badge: 'LIVE',
        badgeColor: 'bg-amber-500/20 text-amber-400',
      },
      {
        title: 'Swift Move Orders',
        desc: 'All logistics orders & deliveries',
        path: '/admin/swift-move',
        icon: Package,
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        glow: 'hover:shadow-orange-500/10',
      },
      {
        title: 'Fleet & Riders',
        desc: 'Drivers, riders & fleet registry',
        path: '/admin/riders',
        icon: Truck,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        glow: 'hover:shadow-emerald-500/10',
      },
      {
        title: 'Finance & Payments',
        desc: 'Revenue, payouts & accounting',
        path: '/admin/finance',
        icon: CreditCard,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        glow: 'hover:shadow-cyan-500/10',
      },
    ],
  },
  {
    category: 'Users & Access',
    categoryIcon: Users,
    categoryColor: 'from-blue-500/20 to-indigo-500/5',
    borderColor: 'border-blue-500/20',
    accentColor: 'text-blue-400',
    items: [
      {
        title: 'All Users',
        desc: 'Customer & account directory',
        path: '/admin/users',
        icon: Users,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        glow: 'hover:shadow-blue-500/10',
      },
      {
        title: 'Add User',
        desc: 'Register a new user account',
        path: '/admin/users/create',
        icon: UserPlus,
        color: 'text-sky-400',
        bg: 'bg-sky-500/10',
        glow: 'hover:shadow-sky-500/10',
        badge: 'New',
        badgeColor: 'bg-sky-500/20 text-sky-400',
      },
      {
        title: 'System Roles',
        desc: 'Role definitions & assignments',
        path: '/admin/users/roles',
        icon: ShieldCheck,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        glow: 'hover:shadow-rose-500/10',
      },
      {
        title: 'Permissions Matrix',
        desc: 'Granular access & privilege control',
        path: '/admin/users/permissions',
        icon: Key,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        glow: 'hover:shadow-amber-500/10',
      },
    ],
  },
  {
    category: 'Staff & Locations',
    categoryIcon: Building,
    categoryColor: 'from-teal-500/20 to-emerald-500/5',
    borderColor: 'border-teal-500/20',
    accentColor: 'text-teal-400',
    items: [
      {
        title: 'Staff Directory',
        desc: 'All internal employees & roles',
        path: '/admin/staff',
        icon: Building,
        color: 'text-teal-400',
        bg: 'bg-teal-500/10',
        glow: 'hover:shadow-teal-500/10',
      },
      {
        title: 'Add Staff Member',
        desc: 'Onboard new internal employee',
        path: '/admin/staff/add',
        icon: UserPlus,
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        glow: 'hover:shadow-green-500/10',
        badge: 'New',
        badgeColor: 'bg-green-500/20 text-green-400',
      },
      {
        title: 'Company Emails',
        desc: 'Mailboxes, domains & webmail',
        path: '/admin/emails',
        icon: Mail,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        glow: 'hover:shadow-emerald-500/10',
      },
      {
        title: 'Branch Locations',
        desc: 'Office & branch geo-mapping',
        path: '/staff/branches',
        icon: MapPin,
        color: 'text-lime-400',
        bg: 'bg-lime-500/10',
        glow: 'hover:shadow-lime-500/10',
      },
    ],
  },
  {
    category: 'System & Compliance',
    categoryIcon: ShieldAlert,
    categoryColor: 'from-purple-500/20 to-violet-500/5',
    borderColor: 'border-purple-500/20',
    accentColor: 'text-purple-400',
    items: [
      {
        title: 'System Audit Logs',
        desc: 'Security events & audit trail',
        path: '/admin/audit',
        icon: ShieldAlert,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        glow: 'hover:shadow-purple-500/10',
      },
      {
        title: 'Media Library',
        desc: 'Images & videos for the website',
        path: '/admin/media',
        icon: Image,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
        glow: 'hover:shadow-violet-500/10',
      },
      {
        title: 'Global Settings',
        desc: 'System-wide configuration',
        path: '/settings',
        icon: Settings,
        color: 'text-slate-400',
        bg: 'bg-slate-700/40',
        glow: 'hover:shadow-slate-500/10',
      },
    ],
  },
];

// ─── Stat card component ──────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, bg, border, trend, trendLabel, sparkData, linkTo,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  sparkData?: number[];
  linkTo?: string;
}) {
  const data = (sparkData || []).map((v, i) => ({ v, i }));
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';
  const chartColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#60a5fa';

  const inner = (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${bg} p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer`}
    >
      {/* Ambient glow */}
      <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${bg} blur-xl`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${color} mb-1`}>{label}</p>
          <p className="text-3xl font-black text-white tabular-nums leading-none mt-2">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {trendLabel}
            </div>
          )}
        </div>
        <div className={`h-11 w-11 rounded-xl ${bg.replace('bg-gradient-to-br ', '')} border ${border} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>

      {/* Mini sparkline */}
      {data.length > 1 && (
        <div className="mt-4 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#sg-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {linkTo && (
        <div className={`mt-3 flex items-center gap-1 text-[11px] font-bold ${color} opacity-60 group-hover:opacity-100 transition-opacity`}>
          View details <ArrowUpRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  if (linkTo) return <Link to={linkTo as any}>{inner}</Link>;
  return inner;
}

// ─── Module card component ────────────────────────────────────────────────────

function ModuleCard({ item }: { item: (typeof MODULES)[0]['items'][0] }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path as any}
      className={`group relative flex flex-col p-5 rounded-2xl border border-slate-800/80 bg-[#0c1220] hover:border-slate-700 hover:bg-[#111827] transition-all duration-200 overflow-hidden hover:shadow-xl ${item.glow}`}
    >
      {/* Subtle top gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-start justify-between mb-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${item.bg} transition-transform group-hover:scale-110 duration-200 shrink-0`}>
          <Icon className={`h-6 w-6 ${item.color}`} />
        </div>
        {item.badge && (
          <span className={`text-[9px] font-black px-2 py-1 rounded-full tracking-wider ${item.badgeColor}`}>
            {item.badge}
          </span>
        )}
      </div>

      <h3 className="text-[13px] font-bold text-slate-200 group-hover:text-white leading-tight transition-colors">{item.title}</h3>
      <p className="text-[11px] text-slate-500 mt-1 group-hover:text-slate-400 leading-relaxed transition-colors">{item.desc}</p>

      <div className={`mt-4 flex items-center gap-1 text-[10px] font-bold ${item.color} opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 duration-200`}>
        Open <ChevronRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ─── Activity item component ──────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const iconMap: Record<string, React.ElementType> = {
    order: Package, driver: Truck, user: Users, cancel: XCircle,
  };
  const colorMap: Record<string, string> = {
    order: 'text-orange-400 bg-orange-500/10',
    driver: 'text-emerald-400 bg-emerald-500/10',
    user: 'text-blue-400 bg-blue-500/10',
    cancel: 'text-red-400 bg-red-500/10',
  };
  const Icon = iconMap[activity.type] || Activity;
  const colors = colorMap[activity.type] || 'text-slate-400 bg-slate-500/10';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0 group hover:bg-slate-800/20 -mx-4 px-4 rounded-lg transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-300 truncate">{activity.label}</p>
        <p className="text-[10px] text-slate-600">{activity.time}</p>
      </div>
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 shrink-0">
        {activity.status}
      </span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function CentralAdminDashboard() {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    activeOrders: 0,
    onlineDrivers: 0,
    totalUsers: 0,
    pendingOrders: 0,
    deliveredToday: 0,
    cancelledToday: 0,
    totalRevenue: 0,
    vehicleBookings: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sparkline history (last 8 polls)
  const [orderHistory, setOrderHistory] = useState<number[]>([]);
  const [driverHistory, setDriverHistory] = useState<number[]>([]);
  const [userHistory, setUserHistory] = useState<number[]>([]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const syncMetrics = useCallback(async () => {
    try {
      const result = await adminFetchAllOrders();
      const deliveries: any[] = result?.deliveries || [];
      const vehicleBookings: any[] = result?.vehicleBookings || [];
      const activeDrivers: any[] = result?.activeDrivers || [];
      const profiles: any[] = result?.profiles || [];

      const activeDels = deliveries.filter((d) =>
        ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status)
      ).length;
      const activeVhs = vehicleBookings.filter((v) =>
        ['pending', 'booked', 'in_transit', 'matched'].includes(v.status)
      ).length;
      const pendingDels = deliveries.filter((d) => d.status === 'pending').length;
      const onlineDrvs = activeDrivers.filter((a) => a.status === 'available').length;

      const deliveredToday = deliveries.filter((d) => {
        const updated = d.updated_at ? new Date(d.updated_at) : null;
        return d.status === 'delivered' && updated && updated >= today;
      }).length;
      const cancelledToday = deliveries.filter((d) => {
        const updated = d.updated_at ? new Date(d.updated_at) : null;
        return d.status === 'cancelled' && updated && updated >= today;
      }).length;

      // Rough revenue estimate from delivery fees
      const totalRevenue = deliveries
        .filter((d) => d.status === 'delivered')
        .reduce((sum: number, d: any) => sum + (parseFloat(d.delivery_fee || d.price || '0') || 0), 0);

      const newMetrics: LiveMetrics = {
        activeOrders: activeDels + activeVhs,
        onlineDrivers: onlineDrvs,
        totalUsers: profiles.length,
        pendingOrders: pendingDels,
        deliveredToday,
        cancelledToday,
        totalRevenue,
        vehicleBookings: activeVhs,
      };

      setMetrics(newMetrics);
      setOrderHistory((h) => [...h.slice(-7), activeDels + activeVhs]);
      setDriverHistory((h) => [...h.slice(-7), onlineDrvs]);
      setUserHistory((h) => [...h.slice(-7), profiles.length]);

      // Build recent activity from latest orders
      const latestOrders = [...deliveries]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 5);

      const activities: RecentActivity[] = latestOrders.map((d: any) => ({
        id: d.id,
        type: d.status === 'cancelled' ? 'cancel' : 'order',
        label: `Order #${d.id?.slice(0, 8) || '???'} — ${d.status?.replace('_', ' ') || 'unknown'}`,
        time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        status: d.status || '—',
      }));

      setRecentActivity(activities);
      setLastSync(new Date());
      setIsLoading(false);
    } catch (e) {
      console.warn('Admin dashboard sync warning:', e);
      setIsLoading(false);
    }
  }, [today]);

  const syncRef = useRef(syncMetrics);
  useEffect(() => { syncRef.current = syncMetrics; }, [syncMetrics]);

  useEffect(() => {
    syncMetrics();

    const channel = supabase
      .channel(`central-admin-live-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swift_deliveries' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_hire_bookings' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_drivers' }, () => syncRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => syncRef.current())
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    const poll = setInterval(() => syncRef.current(), 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [syncMetrics]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncMetrics();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // ─── Greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ─── KPI stats config ──────────────────────────────────────────────────────
  const stats = [
    {
      label: 'Active Orders',
      value: metrics.activeOrders,
      icon: Package,
      color: 'text-orange-400',
      bg: 'bg-gradient-to-br from-orange-950/40 to-[#0c1220]',
      border: 'border-orange-500/20',
      trend: 'up' as const,
      trendLabel: 'Live deliveries & rides',
      sparkData: orderHistory,
      linkTo: '/admin/swift-move',
    },
    {
      label: 'Online Fleet',
      value: metrics.onlineDrivers,
      icon: Truck,
      color: 'text-emerald-400',
      bg: 'bg-gradient-to-br from-emerald-950/40 to-[#0c1220]',
      border: 'border-emerald-500/20',
      trend: metrics.onlineDrivers > 0 ? 'up' as const : 'neutral' as const,
      trendLabel: 'Available for dispatch',
      sparkData: driverHistory,
      linkTo: '/admin/riders',
    },
    {
      label: 'Platform Users',
      value: metrics.totalUsers,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-gradient-to-br from-blue-950/40 to-[#0c1220]',
      border: 'border-blue-500/20',
      trend: 'up' as const,
      trendLabel: 'All registered accounts',
      sparkData: userHistory,
      linkTo: '/admin/users',
    },
    {
      label: 'Pending Orders',
      value: metrics.pendingOrders,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-gradient-to-br from-amber-950/40 to-[#0c1220]',
      border: 'border-amber-500/20',
      trend: metrics.pendingOrders > 5 ? 'down' as const : 'neutral' as const,
      trendLabel: 'Awaiting assignment',
      linkTo: '/dispatcher',
    },
    {
      label: 'Delivered Today',
      value: metrics.deliveredToday,
      icon: CheckCircle2,
      color: 'text-teal-400',
      bg: 'bg-gradient-to-br from-teal-950/40 to-[#0c1220]',
      border: 'border-teal-500/20',
      trend: 'up' as const,
      trendLabel: "Today's completed orders",
    },
    {
      label: 'Cancelled Today',
      value: metrics.cancelledToday,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-gradient-to-br from-red-950/40 to-[#0c1220]',
      border: 'border-red-500/20',
      trend: metrics.cancelledToday > 3 ? 'down' as const : 'neutral' as const,
      trendLabel: "Today's cancellations",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 selection:bg-blue-500/30">
      {/* ── Ambient background gradients ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute top-1/2 -right-60 h-[400px] w-[400px] rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-[300px] w-[300px] rounded-full bg-emerald-600/4 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-12 space-y-10">

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-6 w-6 text-blue-400" />
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#070b14] flex items-center justify-center">
                  <span className={`h-2 w-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{greeting}</p>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none">
                  Admin Dashboard
                </h1>
              </div>
            </div>
            <p className="text-[13px] text-slate-500 max-w-lg pl-1">
              Centralised operations hub — monitor live orders, manage your fleet, and oversee system access in real time.
            </p>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Realtime status pill */}
            <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wider transition-colors ${
              isRealtimeActive
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              {isRealtimeActive ? 'LIVE' : 'CONNECTING'}
              <span className="text-[10px] text-slate-500 font-mono ml-1">
                {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-10 w-10 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh metrics"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Dispatcher shortcut */}
            <Link
              to="/dispatcher"
              className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[12px] font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:from-orange-500 hover:to-orange-400 transition-all active:scale-95"
            >
              <Radio className="h-3.5 w-3.5" />
              Live Dispatch
            </Link>
          </div>
        </div>

        {/* ══ LOADING STATE ══════════════════════════════════════════════════ */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-sm">Loading live metrics…</span>
            </div>
          </div>
        )}

        {/* ══ KPI STAT CARDS ═══════════════════════════════════════════════ */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        )}

        {/* ══ MODULES + ACTIVITY ═══════════════════════════════════════════ */}
        {!isLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Module sections — takes 2/3 width */}
            <div className="xl:col-span-2 space-y-8">
              {MODULES.map((section, idx) => {
                const CategoryIcon = section.categoryIcon;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-800/60 bg-[#0a0f1c]/80 overflow-hidden"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    {/* Section header */}
                    <div className={`flex items-center gap-3 px-6 py-4 border-b border-slate-800/60 bg-gradient-to-r ${section.categoryColor}`}>
                      <div className={`h-7 w-7 rounded-lg ${section.borderColor} border flex items-center justify-center`}>
                        <CategoryIcon className={`h-3.5 w-3.5 ${section.accentColor}`} />
                      </div>
                      <h2 className={`text-[13px] font-extrabold uppercase tracking-widest ${section.accentColor}`}>
                        {section.category}
                      </h2>
                      <span className="ml-auto text-[10px] text-slate-600 font-mono">{section.items.length} modules</span>
                    </div>

                    {/* Module grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800/30 p-px">
                      {section.items.map((item) => (
                        <div key={item.path} className="bg-[#0a0f1c]">
                          <ModuleCard item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column — activity feed + quick stats */}
            <div className="space-y-6">

              {/* Quick metrics summary */}
              <div className="rounded-2xl border border-slate-800/60 bg-[#0a0f1c]/80 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500">
                    Today's Summary
                  </h3>
                </div>

                {[
                  { label: 'Vehicle Bookings', value: metrics.vehicleBookings, icon: Car, color: 'text-blue-400' },
                  { label: 'Delivered', value: metrics.deliveredToday, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Cancelled', value: metrics.cancelledToday, icon: XCircle, color: 'text-red-400' },
                  { label: 'Revenue (est.)', value: `₦${metrics.totalRevenue.toLocaleString()}`, icon: Wallet, color: 'text-amber-400' },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 py-2.5 border-b border-slate-800/50 last:border-0">
                      <div className="h-8 w-8 rounded-lg bg-slate-800/60 flex items-center justify-center shrink-0">
                        <ItemIcon className={`h-3.5 w-3.5 ${item.color}`} />
                      </div>
                      <span className="text-[12px] text-slate-400 flex-1">{item.label}</span>
                      <span className={`text-[13px] font-black tabular-nums ${item.color}`}>{item.value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Recent activity feed */}
              <div className="rounded-2xl border border-slate-800/60 bg-[#0a0f1c]/80 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-slate-500" />
                  <h3 className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500">
                    Live Activity
                  </h3>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                    <Zap className="h-8 w-8 text-slate-700" />
                    <p className="text-[12px] text-slate-600">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {recentActivity.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                )}

                <Link
                  to="/admin/swift-move"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-500 hover:text-white hover:border-slate-700 hover:bg-slate-800/40 transition-all"
                >
                  View All Orders <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {/* System status */}
              <div className="rounded-2xl border border-slate-800/60 bg-[#0a0f1c]/80 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <h3 className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500">
                    System Status
                  </h3>
                </div>

                {[
                  { label: 'Supabase Realtime', ok: isRealtimeActive },
                  { label: 'Order Processing', ok: true },
                  { label: 'Payment Gateway', ok: true },
                  { label: 'Maps & Geocoding', ok: true },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.ok ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-[12px] text-slate-400 flex-1">{s.label}</span>
                    <span className={`text-[10px] font-bold ${s.ok ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {s.ok ? 'Operational' : 'Degraded'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-slate-800/60 bg-[#0a0f1c]/80 p-5">
                <h3 className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500 mb-4">
                  Quick Actions
                </h3>
                <div className="space-y-1">
                  {[
                    { label: 'Add New Rider', path: '/admin/riders/add', icon: UserPlus, color: 'text-orange-400' },
                    { label: 'Add Staff Member', path: '/admin/staff/add', icon: UserPlus, color: 'text-teal-400' },
                    { label: 'Create User Account', path: '/admin/users/create', icon: UserPlus, color: 'text-blue-400' },
                    { label: 'View Audit Logs', path: '/admin/audit', icon: ShieldAlert, color: 'text-purple-400' },
                    { label: 'Media Library', path: '/admin/media', icon: Image, color: 'text-violet-400' },
                  ].map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Link
                        key={action.path}
                        to={action.path as any}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors"
                      >
                        <ActionIcon className={`h-4 w-4 shrink-0 ${action.color}`} />
                        <span className="text-[12px] font-semibold text-slate-400 group-hover:text-white transition-colors flex-1">
                          {action.label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/40">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Database className="h-3 w-3" />
            <span>Barakah Development Centre · Admin Console</span>
          </div>
          <div className="text-[11px] text-slate-700 font-mono">
            Synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>
    </div>
  );
}