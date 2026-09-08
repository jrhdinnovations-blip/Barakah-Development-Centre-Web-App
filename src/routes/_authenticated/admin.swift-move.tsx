import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Package, Users, Truck, TrendingUp, RefreshCw, Search,
  CheckCircle2, Clock, XCircle, Navigation, Loader2,
  BarChart3, Activity, ShieldCheck, Banknote, Eye,
  AlertTriangle, ChevronRight, ArrowUpRight, Filter,
  MapPin, LogOut, Grid, CalendarDays, ListOrdered, Car, Map, Percent, CreditCard, Wallet, Headset,
  Bike, Sparkles, Radio
} from 'lucide-react';
import { parseOrderMetadata } from '@/lib/swift-order';
import { adminForceStatus, adminFetchAllOrders } from '@/lib/dispatcher.functions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Route = createFileRoute('/_authenticated/admin/swift-move')({
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
        userRoles.some((r: string) => ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher'].includes(r)) ||
        ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher'].includes(metaRole);
      if (!isAuthorized) throw redirect({ to: '/my-swift-move' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: AdminDashboard,
});

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-500/10 text-amber-500 border-amber-500/20',
  accepted:   'bg-orange-500/10 text-orange-500 border-orange-500/20',
  picked_up:  'bg-purple-500/10 text-purple-500 border-purple-500/20',
  in_transit: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  delivered:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled:  'bg-red-500/10 text-red-500 border-red-500/20',
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock, accepted: Navigation, picked_up: Package,
  in_transit: Truck, delivered: CheckCircle2, cancelled: XCircle,
};

function AdminDashboard() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [vehicleBookings, setVehicleBookings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'orders' | 'customers' | 'fleet' | 'approvals' | 'pricing' | 'zones' | 'commissions' | 'payments' | 'earnings' | 'dispatchers' | 'reports' | 'complaints'>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dispatch' | 'ride'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // --- Interactive Module States ---
  const [pricing, setPricing] = useState({ base: 1500, perKm: 200, surge: 1.0 });
  const [commission, setCommission] = useState(70);
  const [zones, setZones] = useState([
    { id: 1, name: 'Jos North & Terminus Hub', active: true },
    { id: 2, name: 'Jos South & Rayfield Zone', active: true },
    { id: 3, name: 'Bukuru & Heipang Airport', active: true },
  ]);
  const [complaints, setComplaints] = useState([
    { id: 'TKT-001', user: 'John Doe', issue: 'Late delivery #SW-8892', status: 'open' },
    { id: 'TKT-002', user: 'Jane Smith', issue: 'App crashed during payment', status: 'resolved' },
  ]);
  const [approvals, setApprovals] = useState([
    { id: 'APP-01', name: 'Mike Johnson', vehicle: 'Delivery Van', status: 'pending', phone: '08012345678' },
    { id: 'APP-02', name: 'Sarah Connor', vehicle: 'Motorcycle', status: 'pending', phone: '08123456789' }
  ]);
  const [dispatchers, setDispatchers] = useState([
    { id: 'DSP-01', name: 'Alice Admin', active: true, role: 'Senior Dispatch' },
    { id: 'DSP-02', name: 'Bob Support', active: false, role: 'Support Agent' }
  ]);

  // Fast fetcher for live deliveries & vehicle hire bookings (realtime core)
  // Uses adminFetchAllOrders server function to bypass RLS — anon client only
  // returns the logged-in user's own records, not all platform orders.
  const fetchDeliveriesAndBookings = useCallback(async () => {
    try {
      const result = await adminFetchAllOrders();
      if (result?.deliveries) setDeliveries(result.deliveries);
      if (result?.vehicleBookings) setVehicleBookings(result.vehicleBookings);

      // Populate drivers and customers from privileged adminFetchAllOrders payload
      if (result?.profiles && result?.userRoles) {
        const activeDrvs = result.activeDrivers || [];
        const allUsers = (result.profiles || []).map((p: any) => {
          const r = (result.userRoles || []).find((x: any) => x.user_id === p.user_id);
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            phone: p.phone,
            location: p.location,
            email: p.email || '',
            role: r?.role || 'registered_user',
            created_at: p.created_at,
          };
        });

        const mergedDrivers = allUsers
          .filter((u: any) => u.role === 'driver' || u.role === 'dispatch_rider')
          .map((u: any) => {
            const activeRec = (activeDrvs || []).find((a: any) => a.driver_id === u.user_id);
            const locationStr = activeRec?.current_lat && activeRec?.current_lng
              ? `${Number(activeRec.current_lat).toFixed(4)}, ${Number(activeRec.current_lng).toFixed(4)}`
              : u.location || 'Jos, Plateau';
            return {
              id: u.user_id,
              user_id: u.user_id,
              full_name: u.full_name || 'Driver',
              phone: u.phone || 'N/A',
              email: u.email || '',
              location: locationStr,
              status: activeRec?.status === 'available' ? 'active' : 'offline',
              vehicle_type: u.vehicle_type || 'Unspecified',
            };
          });

        const mergedCustomers = allUsers
          .filter((u: any) => u.role === 'registered_user')
          .map((u: any) => ({
            id: u.user_id,
            user_id: u.user_id,
            full_name: u.full_name || 'Customer',
            phone: u.phone || 'N/A',
            email: u.email || '',
            location: u.location || 'N/A',
            orderCount: 0,
          }));

        setDrivers(mergedDrivers);
        setCustomers(mergedCustomers);
      }
      setLastUpdated(new Date());
    } catch (e: any) {
      console.warn('[Admin] Realtime delivery sync warning:', e.message);
    }
  }, []);

  // Fetch users, customer list, and active driver fleet fallback
  const fetchUsersAndFleet = useCallback(async () => {
    try {
      const [activeDrvsRes, allUsersRes] = await Promise.all([
        supabase.from('active_drivers').select('*'),
        (supabase.rpc as any)('admin_get_all_users')
      ]);

      const activeDrvs = (activeDrvsRes.data as any[]) || [];
      let allUsers: any[] = (allUsersRes.data && Array.isArray(allUsersRes.data)) ? (allUsersRes.data as any[]) : [];

      // Fallback query if custom RPC is unavailable
      if (allUsers.length === 0) {
        const { data: profs } = await supabase.from('profiles').select('*');
        const { data: roles } = await supabase.from('user_roles').select('*');
        if (profs) {
          allUsers = profs.map((p: any) => {
            const r = (roles || []).find((x: any) => x.user_id === p.user_id);
            return {
              user_id: p.user_id,
              full_name: p.full_name,
              phone: p.phone,
              location: p.location,
              email: p.email || '',
              role: r?.role || 'registered_user',
              created_at: p.created_at,
            };
          });
        }
      }

      if (allUsers.length > 0) {
        const mergedDrivers = allUsers
          .filter((u: any) => u.role === 'driver' || u.role === 'dispatch_rider')
          .map((u: any) => {
            const activeRec = (activeDrvs || []).find((a: any) => a.driver_id === u.user_id);
            const locationStr = activeRec?.current_lat && activeRec?.current_lng
              ? `${Number(activeRec.current_lat).toFixed(4)}, ${Number(activeRec.current_lng).toFixed(4)}`
              : u.location || 'Jos, Plateau';
            return {
              id: u.user_id,
              user_id: u.user_id,
              full_name: u.full_name || 'Driver',
              phone: u.phone || 'N/A',
              email: u.email || '',
              location: locationStr,
              status: activeRec?.status === 'available' ? 'active' : 'offline',
              vehicle_type: u.vehicle_type || 'Unspecified',
            };
          });

        const mergedCustomers = allUsers
          .filter((u: any) => u.role === 'registered_user')
          .map((u: any) => ({
            id: u.user_id,
            user_id: u.user_id,
            full_name: u.full_name || 'Customer',
            phone: u.phone || 'N/A',
            email: u.email || '',
            location: u.location || 'N/A',
            orderCount: 0,
          }));

        setDrivers(mergedDrivers);
        setCustomers(mergedCustomers);
      }
    } catch (e: any) {
      console.warn('[Admin] User/fleet roster sync warning:', e.message);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDeliveriesAndBookings(),
        fetchUsersAndFleet()
      ]);
    } catch (err) {
      console.error('[Admin] Data fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchDeliveriesAndBookings, fetchUsersAndFleet]);

  const fetchDeliveriesRef = useRef(fetchDeliveriesAndBookings);
  useEffect(() => { fetchDeliveriesRef.current = fetchDeliveriesAndBookings; }, [fetchDeliveriesAndBookings]);

  const fetchUsersRef = useRef(fetchUsersAndFleet);
  useEffect(() => { fetchUsersRef.current = fetchUsersAndFleet; }, [fetchUsersAndFleet]);

  // Realtime Subscriptions & Aggressive Sync Engine
  useEffect(() => {
    fetchAllData();

    const channelId = `admin-realtime-hub-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      // Instant in-memory mutation for swift_deliveries changes (0ms delay)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swift_deliveries' },
        (payload: any) => {
          console.log('[Admin Realtime] swift_deliveries event:', payload.eventType, payload.new?.id);
          if (payload.eventType === 'INSERT' && payload.new) {
            setDeliveries((prev) => (prev.some((d) => d.id === payload.new.id) ? prev : [payload.new, ...prev]));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setDeliveries((prev) => prev.map((d) => (d.id === payload.new.id ? { ...d, ...payload.new } : d)));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setDeliveries((prev) => prev.filter((d) => d.id !== payload.old.id));
          }
          setLastUpdated(new Date());
          fetchDeliveriesRef.current();
        }
      )
      // Instant in-memory mutation for vehicle_hire_bookings changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_hire_bookings' },
        (payload: any) => {
          console.log('[Admin Realtime] vehicle_hire_bookings event:', payload.eventType, payload.new?.id);
          if (payload.eventType === 'INSERT' && payload.new) {
            setVehicleBookings((prev) => (prev.some((v) => v.id === payload.new.id) ? prev : [payload.new, ...prev]));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setVehicleBookings((prev) => prev.map((v) => (v.id === payload.new.id ? { ...v, ...payload.new } : v)));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setVehicleBookings((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
          setLastUpdated(new Date());
          fetchDeliveriesRef.current();
        }
      )
      // Active drivers changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_drivers' },
        () => {
          fetchUsersRef.current();
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    // 3-second polling fallback so metrics, completed counts and revenues always stay fresh
    const pollInterval = setInterval(() => {
      fetchDeliveriesRef.current();
    }, 3000);

    // 15-second roster poll
    const userInterval = setInterval(() => {
      fetchUsersRef.current();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearInterval(userInterval);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // Helper functions to identify order service kind
  const isOrderRide = (o: any): boolean => {
    if (o.isVehicleBooking) return true;
    const pkg = (o.package_type || '').toLowerCase();
    const meta = parseOrderMetadata(o.package_type || '');
    return meta.isRide || pkg.startsWith('ride:') || pkg.includes('pin:') || pkg.includes('tier_id:');
  };

  const isOrderDispatch = (o: any): boolean => !isOrderRide(o);

  // Normalized and deduplicated unified orders stream
  const combinedOrders = useMemo(() => {
    const existingDeliveryRefs = new Set(deliveries.map((d: any) => d.payment_reference).filter(Boolean));

    const normalizedVehicleBookings = (vehicleBookings || [])
      .filter((v: any) => !v.payment_reference || !existingDeliveryRefs.has(v.payment_reference))
      .map((v: any) => ({
        id: v.id,
        payment_reference: v.payment_reference || `VHC-${String(v.id || '').slice(0, 8)}`,
        pickup_address: v.pickup_location,
        dropoff_address: v.destination,
        package_type: `RIDE:${v.category || 'Vehicle'} Hire`,
        estimated_price: Number(v.total_price) || 0,
        status: v.status === 'completed' ? 'delivered' : v.status === 'cancelled' ? 'cancelled' : v.status === 'booked' ? 'pending' : 'in_transit',
        created_at: v.created_at,
        customer_id: v.customer_id,
        driver_id: v.driver_id || null,
        isVehicleBooking: true,
      }));

    return [...deliveries, ...normalizedVehicleBookings].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [deliveries, vehicleBookings]);

  const handleForceStatus = async (id: string, newStatus: string) => {
    try {
      const targetOrder = combinedOrders.find((o) => o.id === id);

      // Use server-side adminForceStatus to bypass RLS restrictions
      await adminForceStatus({
        data: {
          orderId: id,
          newStatus,
          isVehicleBooking: !!targetOrder?.isVehicleBooking,
          paymentReference: isOrderRide(targetOrder) ? targetOrder?.payment_reference : null,
        },
      });

      toast.success(`Order status updated → ${newStatus.replace('_', ' ')}`);
      await fetchDeliveriesAndBookings();
    } catch (e: any) {
      console.error('[Admin] Force status error:', e);
      toast.error(`Update failed: ${e.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  // ── REALTIME METRICS COMPUTATION ──────────────────────────────────────────
  const totalOrders = combinedOrders.length;

  // Completed Breakdown
  const completedDispatches = combinedOrders.filter(o => isOrderDispatch(o) && o.status === 'delivered');
  const completedRides = combinedOrders.filter(o => isOrderRide(o) && (o.status === 'delivered' || o.status === 'completed'));
  const totalCompleted = completedDispatches.length + completedRides.length;

  // Active Live Orders Breakdown
  const liveDispatches = combinedOrders.filter(o => isOrderDispatch(o) && ['pending', 'accepted', 'picked_up', 'in_transit'].includes(o.status));
  const liveRides = combinedOrders.filter(o => isOrderRide(o) && ['pending', 'accepted', 'picked_up', 'in_transit', 'booked', 'matched'].includes(o.status));
  const totalActive = liveDispatches.length + liveRides.length;

  // Pending assignment
  const pendingDispatches = liveDispatches.filter(o => o.status === 'pending');
  const pendingRides = liveRides.filter(o => o.status === 'pending' || o.status === 'booked');
  const totalPending = pendingDispatches.length + pendingRides.length;

  // Unified pending list for Action Required section
  const pending = useMemo(() => combinedOrders.filter(o => o.status === 'pending' || (isOrderRide(o) && o.status === 'booked')), [combinedOrders]);

  // Unified active live list for Live Radar
  const live = useMemo(() => combinedOrders.filter(o => ['pending', 'accepted', 'picked_up', 'in_transit', 'booked', 'matched'].includes(o.status)), [combinedOrders]);

  // Revenue Breakdown
  const dispatchRevenue = completedDispatches.reduce((sum, o) => sum + (Number(o.estimated_price) || 0), 0);
  const rideRevenue = completedRides.reduce((sum, o) => sum + (Number(o.estimated_price) || 0), 0);
  const grossRevenue = dispatchRevenue + rideRevenue;
  const avgFare = totalCompleted > 0 ? Math.round(grossRevenue / totalCompleted) : 0;

  // Real 7-day revenue trend based on actual completed dispatches and passenger rides
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const name = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayOrders = [...completedDispatches, ...completedRides].filter((o) => {
        try {
          if (!o?.created_at) return false;
          const parsed = new Date(o.created_at);
          if (isNaN(parsed.getTime())) return false;
          return parsed.toISOString().split('T')[0] === dateStr;
        } catch {
          return false;
        }
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.estimated_price) || 0), 0);

      return {
        name,
        revenue: dayRevenue,
        orders: dayOrders.length,
      };
    });
  }, [completedDispatches, completedRides]);

  // Filtered orders for table
  const filteredOrders = useMemo(() => {
    return combinedOrders.filter(d => {
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'ride'
          ? isOrderRide(d)
          : isOrderDispatch(d);

      const q = search.toLowerCase();
      const matchSearch = !q ||
        d.pickup_address?.toLowerCase().includes(q) ||
        d.dropoff_address?.toLowerCase().includes(q) ||
        d.payment_reference?.toLowerCase().includes(q) ||
        d.package_type?.toLowerCase().includes(q);

      return matchStatus && matchType && matchSearch;
    });
  }, [combinedOrders, statusFilter, typeFilter, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 animate-spin" />
            <Truck className="absolute inset-0 m-auto h-7 w-7 text-orange-400" />
          </div>
          <p className="text-slate-400 font-semibold animate-pulse">Initializing SwiftMove Radar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#070b14] text-slate-200 font-sans selection:bg-orange-500/30">
      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-[#0a0f1c]/90 backdrop-blur-xl border-b border-slate-800/60 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle could go here */}
            <h2 className="text-lg font-bold text-white capitalize flex items-center gap-2">
              <span className="text-orange-500 lg:hidden">☰</span>
              {activeTab !== 'dashboard' && (
                <button onClick={() => setActiveTab('dashboard')} className="p-1 -ml-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white flex items-center">
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </button>
              )}
              {activeTab.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-xs font-bold"
              asChild
            >
              <Link to="/dispatcher">
                <Radio className="h-3.5 w-3.5 mr-1.5 animate-pulse text-orange-400" />
                Dispatcher Console (Live Ops) →
              </Link>
            </Button>

            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
              <span className={`h-2 w-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[11px] font-bold text-emerald-400 tracking-wider">
                {isRealtimeActive ? 'LIVE REALTIME FEED' : 'CONNECTING...'}
              </span>
              <span className="text-[10px] text-slate-500 ml-1">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={handleRefresh}
              className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Active Live Orders',
                    value: totalActive,
                    sub: `${liveDispatches.length} dispatches • ${liveRides.length} rides (${totalPending} pending)`,
                    icon: Activity,
                    color: 'blue',
                    action: () => { setActiveTab('orders'); setStatusFilter('all'); setTypeFilter('all'); }
                  },
                  {
                    label: 'Total Completed',
                    value: totalCompleted,
                    sub: `🏍️ ${completedDispatches.length} dispatches • 🚗 ${completedRides.length} rides`,
                    icon: CheckCircle2,
                    color: 'emerald',
                    action: () => { setActiveTab('orders'); setStatusFilter('delivered'); setTypeFilter('all'); }
                  },
                  {
                    label: 'Gross Revenue',
                    value: `₦${grossRevenue.toLocaleString()}`,
                    sub: `₦${dispatchRevenue.toLocaleString()} courier • ₦${rideRevenue.toLocaleString()} rides`,
                    icon: Banknote,
                    color: 'amber',
                    action: () => setActiveTab('earnings')
                  },
                  {
                    label: 'Active Fleet',
                    value: drivers.filter(d => d.status === 'active').length,
                    sub: `Out of ${drivers.length} registered personnel`,
                    icon: Car,
                    color: 'purple',
                    action: () => setActiveTab('fleet')
                  },
                ].map((kpi, idx) => (
                  <button 
                    key={idx} 
                    onClick={kpi.action}
                    className={`relative overflow-hidden text-left rounded-2xl border border-slate-800 bg-[#0a0f1c] p-5 group hover:border-${kpi.color}-500/50 hover:bg-slate-900/50 transition-all cursor-pointer`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 group-hover:scale-110 transition-all duration-300">
                      <kpi.icon className={`h-16 w-16 text-${kpi.color}-500`} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{kpi.label}</p>
                    <p className="text-3xl font-black text-white">{kpi.value}</p>
                    <p className={`text-xs mt-2 font-medium text-${kpi.color}-400/80`}>{kpi.sub}</p>
                  </button>
                ))}
              </div>

              {/* Realtime Operational Performance Split Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dispatches Card */}
                <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-emerald-950/20 via-[#0a0f1c] to-[#0a0f1c] p-5 shadow-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Bike className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          SwiftMove Dispatch Deliveries
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          Couriers
                        </span>
                      </div>
                      <p className="text-2xl font-black text-white mt-1">
                        {completedDispatches.length} <span className="text-sm font-medium text-slate-400">completed</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-emerald-400 font-bold">₦{dispatchRevenue.toLocaleString()}</span> gross courier revenue • {liveDispatches.length} currently active
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setActiveTab('orders'); setTypeFilter('dispatch'); }}
                    className="hidden sm:flex bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                  >
                    View Dispatches
                  </Button>
                </div>

                {/* Passenger Rides Card */}
                <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-cyan-950/20 via-[#0a0f1c] to-[#0a0f1c] p-5 shadow-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Car className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                          SwiftMove Passenger Rides & Hires
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                          Drivers
                        </span>
                      </div>
                      <p className="text-2xl font-black text-white mt-1">
                        {completedRides.length} <span className="text-sm font-medium text-slate-400">completed</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-cyan-400 font-bold">₦{rideRevenue.toLocaleString()}</span> gross ride revenue • {liveRides.length} currently active
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setActiveTab('orders'); setTypeFilter('ride'); }}
                    className="hidden sm:flex bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs"
                  >
                    View Rides
                  </Button>
                </div>
              </div>

              {/* Charts & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white">Revenue Overview</h3>
                      <p className="text-sm text-slate-400">Past 7 days performance</p>
                    </div>
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">Weekly</Badge>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#334155" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#334155" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₦${val/1000}k`} />
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                          itemStyle={{ color: '#60a5fa' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Action Required</h3>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">{pending.length}</Badge>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {pending.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-400">No pending orders.<br/>All caught up!</p>
                      </div>
                    ) : (
                      pending.slice(0, 5).map(order => (
                        <div key={order.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono font-bold text-orange-400">{order.payment_reference}</span>
                            <span className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-xs text-slate-300 truncate mb-3"><span className="text-emerald-500 font-bold">↑</span> {order.pickup_address}</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleForceStatus(order.id, 'accepted')} className="w-full h-8 text-[11px] bg-orange-600 hover:bg-orange-500">
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleForceStatus(order.id, 'cancelled')} className="w-full h-8 text-[11px] bg-slate-800 border-slate-700 hover:bg-slate-700">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {pending.length > 5 && (
                    <Button variant="ghost" onClick={() => setActiveTab('orders')} className="w-full mt-4 text-xs text-orange-400 hover:text-blue-300">
                      View all {pending.length} pending
                    </Button>
                  )}
                </div>
              </div>

              {/* Command Center Modules Grid */}
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Command Center Modules</h3>
                    <p className="text-sm text-slate-400">Access all interactive features and settings</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[
                    { id: 'map', name: 'Live Radar', icon: MapPin, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { id: 'customers', name: 'Customer DB', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { id: 'approvals', name: 'Rider Approvals', icon: ShieldCheck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { id: 'pricing', name: 'Pricing Engine', icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { id: 'zones', name: 'Operating Zones', icon: Map, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { id: 'commissions', name: 'Commissions', icon: Percent, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { id: 'dispatchers', name: 'Dispatch Staff', icon: Headset, color: 'text-pink-400', bg: 'bg-pink-500/10' },
                    { id: 'complaints', name: 'Support Tickets', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { id: 'payments', name: 'Payment Gateway', icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { id: 'reports', name: 'Analytics Data', icon: BarChart3, color: 'text-teal-400', bg: 'bg-teal-500/10' },
                  ].map((mod) => (
                    <button 
                      key={mod.id} 
                      onClick={() => setActiveTab(mod.id as any)}
                      className="group flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-800 bg-[#0a0f1c] hover:border-slate-600 hover:bg-slate-800/50 transition-all gap-3 cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:-translate-y-1 ${mod.bg}`}>
                        <mod.icon className={`h-7 w-7 ${mod.color}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white">{mod.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIVE MAP RADAR (Stylized Mock) */}
          {activeTab === 'map' && (
            <div className="h-full min-h-[600px] w-full rounded-2xl border border-slate-800 bg-[#0a0f1c] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              {/* Map grid background pattern */}
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233b82f6' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}} />
              
              <div className="absolute top-6 left-6 z-10 space-y-3 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl max-w-xs shadow-2xl pointer-events-auto">
                  <h3 className="font-bold text-white mb-1 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-500"/> Live Radar</h3>
                  <p className="text-xs text-slate-400">Tracking active dispatches and online fleet across the metropolitan area.</p>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/> In Transit</span>
                      <span className="font-bold text-white">{live.filter(d=>d.status==='in_transit').length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-orange-400"><span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"/> Driver Dispatch</span>
                      <span className="font-bold text-white">{live.filter(d=>d.status==='accepted' || d.status==='picked_up').length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-2 mt-2">
                      <span className="text-slate-400">Active Drivers</span>
                      <span className="font-bold text-white">{drivers.filter(d=>d.status==='active').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pulsing Dots (simulated vehicles) */}
              <div className="absolute inset-0 flex items-center justify-center">
                {live.length === 0 && drivers.filter(d=>d.status==='active').length === 0 ? (
                  <div className="text-center">
                    <Radio className="h-16 w-16 text-slate-700 mx-auto mb-4 animate-pulse" />
                    <p className="text-slate-500 font-mono text-sm">NO SIGNAL DETECTED</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full max-w-4xl max-h-[600px] mx-auto">
                    {/* Simulated random dots for active items */}
                    {live.map((order, i) => (
                      <div key={order.id} className="absolute" style={{ top: `${20 + (i * 15) % 60}%`, left: `${10 + (i * 25) % 80}%` }}>
                        <div className="relative flex h-6 w-6 items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[9px] px-2 py-1 rounded whitespace-nowrap text-emerald-400 font-mono">
                          {order.payment_reference.slice(-6)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ORDERS TABLE */}
          {activeTab === 'orders' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#0a0f1c] p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by ID, Address..."
                      className="pl-9 bg-slate-900 border-slate-800 focus-visible:ring-orange-500 h-10"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
                    <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 h-10">
                      <SelectValue placeholder="Service Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="dispatch">Dispatches Only</SelectItem>
                      <SelectItem value="ride">Rides Only</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 h-10">
                      <SelectValue placeholder="Filter Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="picked_up">Picked Up</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered / Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-900/50">
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="w-[120px] text-slate-400">Order ID</TableHead>
                        <TableHead className="text-slate-400">Route</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Details</TableHead>
                        <TableHead className="text-right text-slate-400">Value</TableHead>
                        <TableHead className="w-[140px] text-right text-slate-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="h-48 text-center text-slate-500">
                            No orders found matching your criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map(order => {
                          const StatusIcon = STATUS_ICONS[order.status] || Package;
                          return (
                            <TableRow key={order.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                              <TableCell className="font-mono text-xs font-bold text-slate-300">
                                {order.payment_reference || order.id.slice(0,8)}
                                <div className="text-[10px] text-slate-500 font-sans font-normal mt-1">
                                  {new Date(order.created_at).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-xs">
                                  <div className="flex items-center gap-2 max-w-[200px] sm:max-w-xs truncate">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="text-slate-300 truncate" title={order.pickup_address}>{order.pickup_address}</span>
                                  </div>
                                  <div className="flex items-center gap-2 max-w-[200px] sm:max-w-xs truncate">
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                                    <span className="text-slate-400 truncate" title={order.dropoff_address}>{order.dropoff_address}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${STATUS_COLORS[order.status]} capitalize gap-1.5 pl-1.5 py-1 text-[10px]`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {order.status?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
                                  {isOrderRide(order) ? (
                                    <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                                      <Car className="h-3 w-3" /> PASSENGER RIDE
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                                      <Bike className="h-3 w-3" /> DISPATCH
                                    </span>
                                  )}
                                  {order.weight_kg && <span className="bg-slate-800 px-1.5 py-0.5 rounded">{order.weight_kg}kg</span>}
                                  {order.distance_km && <span className="bg-slate-800 px-1.5 py-0.5 rounded">{order.distance_km}km</span>}
                                  {order.driver_id && <span className="bg-blue-900/40 text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-1"><Car className="h-3 w-3"/> Driver Assigned</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold text-white">
                                ₦{(order.estimated_price || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {order.status === 'pending' ? (
                                  <div className="flex justify-end gap-2">
                                    <Button size="icon" variant="outline" onClick={() => handleForceStatus(order.id, 'accepted')} className="h-8 w-8 bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" title="Force Accept">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="outline" onClick={() => handleForceStatus(order.id, 'cancelled')} className="h-8 w-8 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" title="Cancel Order">
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : order.status === 'in_transit' ? (
                                  <Button size="sm" variant="outline" onClick={() => handleForceStatus(order.id, 'delivered')} className="h-8 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20">
                                    Mark Delivered
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-slate-600">No actions</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Total Registered Customers', value: customers.length, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'Active Ordering Customers', value: customers.filter(c=>c.orderCount > 0).length, icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((stat, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white">{stat.value}</p>
                      <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white">Customer Database</h3>
                  <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300">{customers.length} total</Badge>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {customers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No customers registered yet.</div>
                  ) : (
                    customers.map(customer => (
                      <div key={customer.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-white">{customer.full_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{customer.email}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {customer.location || 'Location Unknown'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                📱 {customer.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 mt-4 sm:mt-0">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" onClick={() => window.location.href = `tel:${customer.phone}`}>
                              Contact
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" onClick={() => toast.info('Suspend functionality pending DB migration')}>
                              Suspend
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">ID: {String(customer.user_id || '').slice(0, 8)}</span>
                            <Badge variant="outline" className={`${customer.orderCount > 0 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'} capitalize`}>
                              {customer.orderCount} Lifetime Orders
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: FLEET & DRIVERS */}
          {activeTab === 'fleet' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Registered Drivers', value: drivers.length, icon: Users, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'Active on Duty', value: drivers.filter(d=>d.status==='active').length, icon: Navigation, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Offline / Inactive', value: drivers.filter(d=>d.status!=='active').length, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-800' },
                ].map((stat, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white">{stat.value}</p>
                      <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white">Driver Roster</h3>
                  <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300">{drivers.length} personnel</Badge>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {drivers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No drivers registered yet.</div>
                  ) : (
                    drivers.map(driver => (
                      <div key={driver.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                              <Users className="h-5 w-5 text-slate-400" />
                            </div>
                            <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0a0f1c] ${driver.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                          </div>
                          <div>
                            <p className="text-base font-bold text-white">{driver.full_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{driver.email}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {driver.location || 'Location Unknown'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                📱 {driver.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 mt-4 sm:mt-0">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" onClick={() => window.location.href = `tel:${driver.phone}`}>
                              Dispatch
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" onClick={() => toast.info('Revoke functionality pending DB migration')}>
                              Revoke
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">Vehicle: {driver.vehicle_type}</span>
                            <Badge variant="outline" className={`${driver.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'} capitalize`}>
                              {driver.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">Pending Rider Applications</h3>
                  <Badge className="bg-orange-500">{approvals.length} Pending</Badge>
                </div>
                <div className="divide-y divide-slate-800/60 p-6">
                  {approvals.map(app => (
                    <div key={app.id} className="flex flex-col sm:flex-row justify-between sm:items-center py-4 gap-4">
                      <div>
                        <p className="font-bold text-white text-lg">{app.name}</p>
                        <p className="text-sm text-slate-400 mt-1">Vehicle: <span className="text-white">{app.vehicle}</span> | Phone: {app.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setApprovals(prev => prev.filter(a => a.id !== app.id)); toast.success(`${app.name} Approved & Onboarded!`)}}>Approve</Button>
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { setApprovals(prev => prev.filter(a => a.id !== app.id)); toast.error(`${app.name} Rejected`)}}>Reject</Button>
                      </div>
                    </div>
                  ))}
                  {approvals.length === 0 && <p className="text-center text-slate-500 py-10">No pending approvals.</p>}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 max-w-2xl mx-auto">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2"><Banknote className="h-5 w-5 text-orange-500"/> Global Pricing Strategy</h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase">Base Fare (₦)</label>
                    <Input type="number" value={pricing.base} onChange={e => setPricing({...pricing, base: Number(e.target.value)})} className="bg-slate-900 border-slate-700 text-white mt-1 h-12 text-lg" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase">Per KM Rate (₦)</label>
                    <Input type="number" value={pricing.perKm} onChange={e => setPricing({...pricing, perKm: Number(e.target.value)})} className="bg-slate-900 border-slate-700 text-white mt-1 h-12 text-lg" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase">Surge Multiplier</label>
                    <Select value={pricing.surge.toString()} onValueChange={v => setPricing({...pricing, surge: Number(v)})}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white mt-1 h-12 text-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.0">1.0x (Normal)</SelectItem>
                        <SelectItem value="1.5">1.5x (High Demand)</SelectItem>
                        <SelectItem value="2.0">2.0x (Peak / Rain)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full mt-4 h-12 text-lg bg-orange-600 hover:bg-orange-700" onClick={() => toast.success('Pricing strategy updated globally!')}>Save Pricing Config</Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMMISSIONS */}
          {activeTab === 'commissions' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 max-w-2xl mx-auto text-center">
                <Percent className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                <h3 className="font-bold text-white mb-2 text-xl">Platform Take Rate & Driver Share</h3>
                <p className="text-slate-400 mb-6 text-sm">
                  SwiftMove retains {commission}% commission, distributing <strong className="text-emerald-400">{100 - commission}%</strong> directly to the driver/courier.
                </p>
                
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400 font-semibold">Platform Commission</p>
                    <p className="text-2xl font-black text-orange-400">{commission}%</p>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-center">
                    <p className="text-[11px] uppercase text-emerald-400 font-semibold">Driver/Rider Payout</p>
                    <p className="text-2xl font-black text-emerald-300">{100 - commission}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 mb-8">
                  <Button variant="outline" className="h-16 w-16 text-2xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setCommission(Math.max(0, commission - 1))}>-</Button>
                  <div className="h-24 w-32 bg-slate-900 border-2 border-orange-500/50 rounded-xl flex items-center justify-center text-4xl font-black text-white">{commission}%</div>
                  <Button variant="outline" className="h-16 w-16 text-2xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setCommission(Math.min(100, commission + 1))}>+</Button>
                </div>
                
                <Button className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700" onClick={() => toast.success(`Commission rate updated to ${commission}% (Driver payout: ${100 - commission}%)`)}>Apply Rate</Button>
              </div>
            </div>
          )}

          {/* TAB: ZONES */}
          {activeTab === 'zones' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">Operational Zones</h3>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => toast.info('Map editor opening...')}>+ Add Zone</Button>
                </div>
                <div className="divide-y divide-slate-800/60 p-6">
                  {zones.map(zone => (
                    <div key={zone.id} className="flex justify-between items-center py-4">
                      <div className="flex items-center gap-3">
                        <Map className="h-5 w-5 text-slate-500" />
                        <span className="font-bold text-white">{zone.name}</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant={zone.active ? 'default' : 'outline'}
                        className={zone.active ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-700 text-slate-400 hover:text-white'}
                        onClick={() => {
                          setZones(zones.map(z => z.id === zone.id ? {...z, active: !z.active} : z));
                          toast.success(`${zone.name} is now ${!zone.active ? 'Active' : 'Inactive'}`);
                        }}
                      >
                        {zone.active ? 'Active' : 'Inactive'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMPLAINTS */}
          {activeTab === 'complaints' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800">
                  <h3 className="font-bold text-white">Support Tickets & Complaints</h3>
                </div>
                <div className="divide-y divide-slate-800/60 p-6">
                  {complaints.map(tkt => (
                    <div key={tkt.id} className="flex flex-col sm:flex-row justify-between sm:items-center py-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={tkt.status === 'open' ? 'border-red-500/50 text-red-400 bg-red-500/10' : 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 uppercase'}>{tkt.status}</Badge>
                          <span className="text-xs font-mono text-slate-500">{tkt.id}</span>
                        </div>
                        <p className="font-bold text-white">{tkt.issue}</p>
                        <p className="text-sm text-slate-400">Reported by: {tkt.user}</p>
                      </div>
                      {tkt.status === 'open' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                          setComplaints(complaints.map(c => c.id === tkt.id ? {...c, status: 'resolved'} : c));
                          toast.success(`Ticket ${tkt.id} marked as resolved`);
                        }}>Mark Resolved</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: DISPATCHERS */}
          {activeTab === 'dispatchers' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">Internal Dispatch Staff</h3>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => toast.info('Invite modal opening...')}>+ Invite Staff</Button>
                </div>
                <div className="divide-y divide-slate-800/60 p-6">
                  {dispatchers.map(dsp => (
                    <div key={dsp.id} className="flex justify-between items-center py-4">
                      <div>
                        <p className="font-bold text-white">{dsp.name}</p>
                        <p className="text-sm text-slate-400">{dsp.role}</p>
                      </div>
                      <Badge variant="outline" className={dsp.active ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-500'}>
                        {dsp.active ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="h-6 w-6 text-amber-500" /> Payment Gateway
                  </h3>
                  <p className="text-sm text-slate-400">Manage incoming customer payments and transaction logs.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="bg-slate-900 border-slate-700 text-slate-300" onClick={() => toast.success('Syncing with Paystack/Stripe...')}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync Gateway
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-900/50">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Reference</TableHead>
                      <TableHead className="text-slate-400">Customer</TableHead>
                      <TableHead className="text-slate-400">Amount</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-right text-slate-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...completedDispatches, ...completedRides].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                          No completed payment transactions recorded yet. Live payments will appear here automatically.
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...completedDispatches, ...completedRides].slice(0, 15).map((order) => {
                        const isRideItem = isOrderRide(order);
                        return (
                          <TableRow key={order.id} className="border-slate-800/60 hover:bg-slate-800/30">
                            <TableCell className="font-mono text-xs text-slate-300">
                              {order.payment_reference || String(order.id || '').slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                isRideItem ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' : 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                              }`}>
                                {isRideItem ? <Car className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
                                {isRideItem ? 'Passenger Ride' : 'Dispatch Parcel'}
                              </span>
                            </TableCell>
                            <TableCell className="font-bold text-white">
                              ₦{Number(order.estimated_price || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-slate-400 text-xs">
                              {(() => {
                                try {
                                  if (!order.created_at) return 'Recent';
                                  const d = new Date(order.created_at);
                                  return isNaN(d.getTime()) ? 'Recent' : d.toLocaleString();
                                } catch {
                                  return 'Recent';
                                }
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                Completed & Paid
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs"
                                onClick={() => toast.info(`Ref: ${order.payment_reference || order.id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB: EARNINGS */}
          {activeTab === 'earnings' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-emerald-500" /> Platform Earnings
                  </h3>
                  <p className="text-sm text-slate-400">View gross revenue, courier & driver payouts, and commission earnings.</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => toast.success('Initiating bulk withdrawal to bank account...')}>
                  Withdraw Funds
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-emerald-900/20 to-[#0a0f1c] p-6">
                  <p className="text-sm text-slate-400 mb-2">Total Gross Revenue</p>
                  <p className="text-4xl font-black text-white">₦{grossRevenue.toLocaleString()}</p>
                  <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> {totalCompleted} completed trips (₦{avgFare.toLocaleString()} avg)
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-orange-900/20 to-[#0a0f1c] p-6">
                  <p className="text-sm text-slate-400 mb-2">Driver & Courier Payouts</p>
                  <p className="text-4xl font-black text-white">
                    ₦{Math.round(grossRevenue * ((100 - commission) / 100)).toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-400 mt-2">
                    Across {drivers.length} registered personnel ({100 - commission}% share)
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-purple-900/20 to-[#0a0f1c] p-6">
                  <p className="text-sm text-slate-400 mb-2">Platform Commission (Net)</p>
                  <p className="text-4xl font-black text-white">
                    ₦{Math.round(grossRevenue * (commission / 100)).toLocaleString()}
                  </p>
                  <p className="text-xs text-purple-400 mt-2">
                    At {commission}% configured take rate
                  </p>
                </div>
              </div>

              {/* Breakdown split bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Courier Deliveries Gross</p>
                    <p className="text-lg font-bold text-white">₦{dispatchRevenue.toLocaleString()}</p>
                    <p className="text-[11px] text-emerald-400">{completedDispatches.length} completed dispatches</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Passenger Rides & Hires Gross</p>
                    <p className="text-lg font-bold text-white">₦{rideRevenue.toLocaleString()}</p>
                    <p className="text-[11px] text-cyan-400">{completedRides.length} completed rides</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-teal-500" /> Analytics & Reports
                  </h3>
                  <p className="text-sm text-slate-400">Generate CSV or PDF reports for platform activity.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 max-w-2xl">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Report Type</label>
                      <Select defaultValue="deliveries">
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deliveries">All Deliveries</SelectItem>
                          <SelectItem value="drivers">Driver Performance</SelectItem>
                          <SelectItem value="revenue">Financial Revenue</SelectItem>
                          <SelectItem value="customers">Customer Signups</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Date Range</label>
                      <Select defaultValue="7d">
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="7d">Last 7 Days</SelectItem>
                          <SelectItem value="30d">Last 30 Days</SelectItem>
                          <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => toast.success('Report generation started. You will receive an email shortly.')}>
                      Generate CSV
                    </Button>
                    <Button variant="outline" className="flex-1 border-slate-700 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => toast.success('Preview loaded.')}>
                      View Preview
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}