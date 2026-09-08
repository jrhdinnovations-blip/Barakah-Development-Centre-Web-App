import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Package,
  Users,
  Truck,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Navigation,
  Loader2,
  BarChart3,
  Activity,
  ShieldCheck,
  Banknote,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Car,
  Bike,
  Radio,
  Sliders,
  Phone,
  ShieldAlert,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  ArrowUpRight,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { parseOrderMetadata, appendDriverAcceptance } from '@/lib/swift-order';
import {
  dispatchAssignTrip,
  dispatchReassignTrip,
  dispatchCancelTrip,
  dispatcherFetchAllDeliveries,
} from '@/lib/dispatcher.functions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DispatcherMap,
  DriverMarkerData,
  BookingMarkerData,
  OperationsHub,
  DEFAULT_HUBS,
} from '@/components/dispatcher/dispatcher-map';
import {
  AssignDriverModal,
  ReassignDriverModal,
  CancelTripModal,
  EscalateTripModal,
  TripTelemetryMonitorDrawer,
  DriverCandidate,
  ManagedTrip,
} from '@/components/dispatcher/trip-control-dialogs';

// Coordinates for Jos / Plateau districts
const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  terminus: { lat: 9.9320, lng: 8.8920 },
  rayfield: { lat: 9.8550, lng: 8.9100 },
  bukuru: { lat: 9.7950, lng: 8.8650 },
  unijos: { lat: 9.9550, lng: 8.8890 },
  heipang: { lat: 9.6450, lng: 8.8750 },
  tudunwada: { lat: 9.9120, lng: 8.8750 },
};

function getAddressCoords(address: string, fallbackOffset = 0): { lat: number; lng: number } {
  const lower = (address || '').toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (lower.includes(key)) {
      return {
        lat: coords.lat + (fallbackOffset * 0.003),
        lng: coords.lng + (fallbackOffset * 0.003),
      };
    }
  }
  // Default centered in Jos with slight scatter
  return {
    lat: 9.8965 + (fallbackOffset * 0.004),
    lng: 8.8583 + (fallbackOffset * 0.004),
  };
}

export function DispatcherDashboardView() {
  // --- Master Data States ---
  const [deliveries, setDeliveries] = useState<any[]>([]);
  // vehicle_hire_bookings intentionally excluded — direct passenger rides are handled by driver (not dispatcher)
  const [activeDriverRecords, setActiveDriverRecords] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // --- Wing & Tab Navigation ---
  // Structure: LIVE OPERATIONS (drivers, customers, bookings, vehicles, locations)
  //            TRIP CONTROL (assign, reassign, cancel, escalate, monitor)
  const { user: currentUser } = useAuth() as any;
  const [activeWing, setActiveWing] = useState<'live_operations' | 'trip_control'>('live_operations');
  const [liveOpsTab, setLiveOpsTab] = useState<'bookings' | 'drivers' | 'customers' | 'vehicles' | 'locations'>('bookings');
  const [tripControlFilter, setTripControlFilter] = useState<'all' | 'unassigned' | 'in_transit' | 'escalated'>('all');

  // --- Search & Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleClassFilter, setVehicleClassFilter] = useState('all');

  // --- Trip Control Dialog States ---
  const [activeTargetTrip, setActiveTargetTrip] = useState<ManagedTrip | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);

  // Audio Chime Ref for realtime alert
  const playAlertChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {}
  }, [soundEnabled]);

  // ─────────────────────────────────────────────────────────────
  // 1. DATA SYNC & SUPABASE REALTIME
  // ─────────────────────────────────────────────────────────────
  // Uses dispatcherFetchAllDeliveries server function to bypass RLS — the anon client
  // would only return deliveries where the dispatcher is the customer_id (none).
  const syncMasterData = useCallback(async () => {
    try {
      const result = await dispatcherFetchAllDeliveries();

      if (result.deliveries) setDeliveries(result.deliveries);
      if (result.activeDrivers) setActiveDriverRecords(result.activeDrivers);

      if (result.profiles) {
        const roles = result.userRoles || [];
        const activeDriverIds = new Set((result.activeDrivers || []).map((a: any) => a.driver_id));
        const enriched = result.profiles.map((p: any) => {
          const userRoles = roles.filter((x: any) => x.user_id === p.user_id).map((x: any) => x.role);
          const hasDriverRole = userRoles.includes('driver') || userRoles.includes('dispatch_rider') || activeDriverIds.has(p.user_id);
          const hasAdminRole = userRoles.includes('administrator') || userRoles.includes('swift_manager');

          let role = 'registered_user';
          if (hasDriverRole) {
            role = userRoles.includes('dispatch_rider') ? 'dispatch_rider' : 'driver';
          } else if (hasAdminRole) {
            role = 'administrator';
          } else if (userRoles.length > 0) {
            role = userRoles[0];
          }

          return { ...p, role };
        });
        setAllUsers(enriched);
      }
      setLastSync(new Date());
    } catch (err: any) {
      console.warn('[Dispatcher] Sync warning:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncRef = useRef(syncMasterData);
  useEffect(() => {
    syncRef.current = syncMasterData;
  }, [syncMasterData]);

  // Setup Supabase Realtime Channels
  useEffect(() => {
    syncMasterData();

    const channel = supabase
      .channel(`dispatcher-mission-control-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swift_deliveries' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            const meta = parseOrderMetadata(newOrder.package_type);
            // Ignore passenger rides (passenger rides are directly with driver)
            if (meta.isRide || newOrder.package_type?.toLowerCase().includes('ride')) return;

            const isPaid = newOrder.status === 'pending';
            toast.info(
              isPaid
                ? `💳 New Paid Dispatch Order — Needs Rider: ${newOrder.pickup_address || 'Express Dispatch'}`
                : `📦 New Incoming Dispatch: ${newOrder.pickup_address || 'Express'}`
            );
            playAlertChime();
          }
          syncRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_drivers' },
        () => syncRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => syncRef.current()
      )
      .subscribe(status => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    const pollInterval = setInterval(() => {
      syncRef.current();
    }, 4500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [syncMasterData, playAlertChime]);

  // ─────────────────────────────────────────────────────────────
  // 2. DERIVED DATA MODELS
  // ─────────────────────────────────────────────────────────────

  // All dispatch orders (ONLY Book-a-Dispatch parcel deliveries; passenger rides are direct with drivers)
  const unifiedOrders: ManagedTrip[] = useMemo(() => {
    const list: ManagedTrip[] = [];

    // ONLY swift_deliveries where isRide is false
    deliveries.forEach(del => {
      const meta = parseOrderMetadata(del.package_type);
      const isRide = meta.isRide || del.package_type?.toLowerCase().includes('ride');
      // EXCLUDE all passenger ride requests (directly matched with driver)
      if (isRide) return;

      const customer = allUsers.find(u => u.user_id === del.customer_id);
      const driver = allUsers.find(u => u.user_id === del.driver_id);

      list.push({
        id: del.id,
        reference: del.payment_reference || `SW-${del.id.slice(0, 7)}`,
        customerId: del.customer_id,
        customerName: customer?.full_name || 'Customer',
        customerPhone: meta.customerPhone || customer?.phone || 'N/A',
        pickupAddress: del.pickup_address,
        dropoffAddress: del.dropoff_address,
        packageType: del.package_type || 'Standard Parcel',
        status: del.status || 'pending',
        fare: del.estimated_price || 0,
        createdAt: del.created_at,
        assignedDriverId: del.driver_id ?? null,
        assignedDriverName: meta.driverName || driver?.full_name || (del.driver_id ? 'Rider Assigned' : null),
        assignedDriverPhone: meta.driverPhone || driver?.phone || null,
        assignedDriverVehicle: meta.vehicleMake || meta.tierName || 'Dispatch Motorcycle',
        assignedDriverPlate: meta.plateNumber ?? null,
        driverLat: del.driver_lat ?? null,
        driverLng: del.driver_lng ?? null,
        isRide: false,
        safetyPin: meta.safetyPin ?? meta.pin ?? null,
      } as ManagedTrip);
    });

    // NOTE: vehicle_hire_bookings are passenger rides (directly matched with driver), so excluded from dispatcher console!

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [deliveries, allUsers]);

  // All unified drivers
  const driversList: DriverCandidate[] = useMemo(() => {
    return allUsers
      .filter(u => u.role === 'driver' || u.role === 'dispatch_rider')
      .map((u, idx) => {
        const activeRec = activeDriverRecords.find(a => a.driver_id === u.user_id);
        const status = activeRec?.status === 'available' ? 'available' : activeRec ? 'busy' : 'offline';
        const coords = getAddressCoords(u.location || 'Jos', idx);

        return {
          id: u.user_id,
          name: u.full_name || 'Driver',
          phone: u.phone || 'N/A',
          vehicleType: (u.user_metadata?.vehicle_type as string) || (u.role === 'driver' ? 'Sedan Car' : 'Motorcycle'),
          vehicleMake: (u.user_metadata?.vehicle_make as string) || 'Fleet',
          plateNumber: (u.user_metadata?.plate_number as string) || `PL-${100 + idx}JS`,
          status,
          rating: 4.8,
          currentLat: activeRec?.current_lat ? Number(activeRec.current_lat) : coords.lat,
          currentLng: activeRec?.current_lng ? Number(activeRec.current_lng) : coords.lng,
          distanceKm: 2.4 + (idx * 0.8),
        };
      });
  }, [allUsers, activeDriverRecords]);

  // Available drivers candidate pool for assign/reassign
  const availableCandidates: DriverCandidate[] = useMemo(() => {
    const list = driversList.filter(d => d.status === 'available' || d.status === 'offline');
    // If current logged-in user isn't in availableCandidates, include them so dispatcher/admin can self-test on /drive
    if (currentUser?.id && !list.some(d => d.id === currentUser.id)) {
      const myProfile = allUsers.find(u => u.user_id === currentUser.id);
      list.unshift({
        id: currentUser.id,
        name: `${myProfile?.full_name || currentUser.user_metadata?.full_name || 'Myself'} (You - Console Test)`,
        phone: myProfile?.phone || currentUser.phone || '08000000000',
        vehicleType: 'Motorcycle / Car',
        vehicleMake: 'Swift Fleet',
        plateNumber: 'PL-SELF-01',
        status: 'available',
        rating: 5.0,
        distanceKm: 0.8,
      });
    }
    return list;
  }, [driversList, currentUser, allUsers]);

  // Customers roster
  const customersList = useMemo(() => {
    const custMap = new Map<string, any>();
    allUsers.forEach(u => {
      if (u.role === 'registered_user' || !custMap.has(u.user_id)) {
        const orders = unifiedOrders.filter(o => o.customerId === u.user_id);
        custMap.set(u.user_id, {
          id: u.user_id,
          name: u.full_name || 'Customer',
          email: u.email || 'N/A',
          phone: u.phone || 'N/A',
          location: u.location || 'Jos, Plateau',
          ordersCount: orders.length,
          activeTrip: orders.find(o => ['pending', 'accepted', 'in_transit'].includes(o.status)),
        });
      }
    });
    return Array.from(custMap.values()).sort((a, b) => b.ordersCount - a.ordersCount);
  }, [allUsers, unifiedOrders]);

  // Vehicles registry (Fleet)
  const vehiclesList = useMemo(() => {
    return driversList.map((d, i) => ({
      id: `VEH-${d.id.slice(0, 5).toUpperCase()}`,
      plate: d.plateNumber || `PL-${200 + i}JS`,
      type: d.vehicleType,
      make: d.vehicleMake || 'Toyota Corolla',
      driverName: d.name,
      driverPhone: d.phone,
      status: d.status === 'available' ? 'operational' : d.status === 'busy' ? 'on_route' : 'standby',
      health: '98% Good',
      fuelLevel: `${85 - (i * 7)}%`,
    }));
  }, [driversList]);

  // Map marker data
  const mapDrivers: DriverMarkerData[] = useMemo(() => {
    return driversList
      .filter(d => d.currentLat && d.currentLng)
      .map(d => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicleType: d.vehicleType,
        ...(d.vehicleMake !== undefined ? { vehicleMake: d.vehicleMake } : {}),
        ...(d.plateNumber !== undefined ? { plateNumber: d.plateNumber } : {}),
        status: (d.status === 'available' ? 'available' : d.status === 'busy' ? 'busy' : 'offline') as DriverMarkerData['status'],
        lat: d.currentLat!,
        lng: d.currentLng!,
        ...(d.rating !== undefined ? { rating: d.rating } : {}),
      }));
  }, [driversList]);

  const mapBookings: BookingMarkerData[] = useMemo(() => {
    return unifiedOrders
      .filter(o => ['pending', 'accepted', 'in_transit'].includes(o.status))
      .map((o, i) => {
        const pCoords = getAddressCoords(o.pickupAddress, i);
        const dCoords = getAddressCoords(o.dropoffAddress, i + 10);
        return {
          id: o.id,
          reference: o.reference,
          ...(o.customerName !== undefined ? { customerName: o.customerName } : {}),
          ...(o.customerPhone !== undefined ? { customerPhone: o.customerPhone } : {}),
          pickupAddress: o.pickupAddress,
          pickupLat: pCoords.lat,
          pickupLng: pCoords.lng,
          dropoffAddress: o.dropoffAddress,
          dropoffLat: dCoords.lat,
          dropoffLng: dCoords.lng,
          status: o.status,
          ...(o.isRide !== undefined ? { isRide: o.isRide } : {}),
          fare: o.fare,
        } as BookingMarkerData;
      });
  }, [unifiedOrders]);

  // Filtered orders according to search and status — paid pending orders float to the top
  const filteredBookings = useMemo(() => {
    const filtered = unifiedOrders.filter(o => {
      const matchesSearch =
        o.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
        (o.assignedDriverName && o.assignedDriverName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

      const matchesClass =
        vehicleClassFilter === 'all' ||
        (vehicleClassFilter === 'express' && (o.packageType?.toLowerCase().includes('express') || o.packageType?.toLowerCase().includes('bike') || o.packageType?.toLowerCase().includes('motorcycle'))) ||
        (vehicleClassFilter === 'cargo' && (o.packageType?.toLowerCase().includes('cargo') || o.packageType?.toLowerCase().includes('box') || o.packageType?.toLowerCase().includes('heavy')));

      return matchesSearch && matchesStatus && matchesClass;
    });

    // Sort: paid-pending (no driver assigned) always first, then by created_at desc
    return filtered.sort((a, b) => {
      const aPaidPending = a.status === 'pending' && !a.assignedDriverId ? 1 : 0;
      const bPaidPending = b.status === 'pending' && !b.assignedDriverId ? 1 : 0;
      if (bPaidPending !== aPaidPending) return bPaidPending - aPaidPending;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [unifiedOrders, searchQuery, statusFilter, vehicleClassFilter]);

  // Filtered orders for TRIP CONTROL wing
  const tripControlBookings = useMemo(() => {
    return unifiedOrders.filter(o => {
      if (tripControlFilter === 'unassigned') return o.status === 'pending';
      if (tripControlFilter === 'in_transit') return o.status === 'in_transit';
      if (tripControlFilter === 'escalated') return o.packageType?.includes('[ESCALATED]') || o.status === 'escalated';
      return ['pending', 'accepted', 'in_transit'].includes(o.status);
    });
  }, [unifiedOrders, tripControlFilter]);

  // Operational KPI counters
  const kpis = useMemo(() => {
    const pending = unifiedOrders.filter(o => o.status === 'pending').length;
    const inTransit = unifiedOrders.filter(o => o.status === 'in_transit').length;
    const availableDrivers = driversList.filter(d => d.status === 'available').length;
    const activeDriversCount = driversList.filter(d => d.status !== 'offline').length;
    const completedToday = unifiedOrders.filter(o => o.status === 'delivered').length;
    const revenueToday = unifiedOrders
      .filter(o => o.status === 'delivered')
      .reduce((acc, curr) => acc + curr.fare, 0);

    return {
      pending,
      inTransit,
      availableDrivers,
      activeDriversCount,
      totalDrivers: driversList.length,
      completedToday,
      revenueToday,
    };
  }, [unifiedOrders, driversList]);

  // ─────────────────────────────────────────────────────────────
  // 3. TRIP CONTROL ACTIONS (ASSIGN, REASSIGN, CANCEL, ESCALATE)
  // ─────────────────────────────────────────────────────────────

  // TRIP CONTROL: ASSIGN
  const handleExecuteAssign = async (tripId: string, driver: DriverCandidate) => {
    const targetOrder = unifiedOrders.find(o => o.id === tripId);
    if (!targetOrder) throw new Error('Target order not found.');

    // Execute through server function to bypass RLS and ensure real-time broadcast
    await dispatchAssignTrip({
      data: {
        tripId,
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        ...(driver.vehicleMake !== undefined ? { vehicleMake: driver.vehicleMake } : {}),
        vehicleType: driver.vehicleType,
        ...(driver.plateNumber !== undefined ? { plateNumber: driver.plateNumber } : {}),
        ...(driver.rating !== undefined ? { rating: driver.rating } : {}),
      },
    });

    await syncMasterData();
  };

  // TRIP CONTROL: REASSIGN
  const handleExecuteReassign = async (tripId: string, newDriver: DriverCandidate, reason: string) => {
    const targetOrder = unifiedOrders.find(o => o.id === tripId);
    if (!targetOrder) throw new Error('Target order not found.');

    await dispatchReassignTrip({
      data: {
        tripId,
        oldDriverId: targetOrder.assignedDriverId ?? null,
        newDriverId: newDriver.id,
        newDriverName: newDriver.name,
        newDriverPhone: newDriver.phone,
        ...(newDriver.vehicleMake !== undefined ? { newVehicleMake: newDriver.vehicleMake } : {}),
        newVehicleType: newDriver.vehicleType,
        ...(newDriver.plateNumber !== undefined ? { newPlateNumber: newDriver.plateNumber } : {}),
        ...(newDriver.rating !== undefined ? { newRating: newDriver.rating } : {}),
        reason,
      },
    });

    await syncMasterData();
  };


  // TRIP CONTROL: CANCEL
  const handleExecuteCancel = async (tripId: string, reason: string, waiveFee: boolean) => {
    const targetOrder = unifiedOrders.find(o => o.id === tripId);

    await dispatchCancelTrip({
      data: {
        tripId,
        assignedDriverId: targetOrder?.assignedDriverId ?? null,
        reason: `${reason} (Fee Waived: ${waiveFee})`,
      },
    });

    await syncMasterData();
  };

  // TRIP CONTROL: ESCALATE (SOS)
  const handleExecuteEscalate = async (
    tripId: string,
    severity: 'warning' | 'critical' | 'sos',
    note: string
  ) => {
    const targetOrder = unifiedOrders.find(o => o.id === tripId);
    const escalatedTag = `[ESCALATED:${severity.toUpperCase()}] ${note}`;

    await supabase
      .from('swift_deliveries')
      .update({
        package_type: `${targetOrder?.packageType || ''} |||${escalatedTag}`,
        rating_note: escalatedTag,
      })
      .eq('id', tripId);

    await syncMasterData();
  };

  // Quick Action helpers to open specific modal with trip context
  const openAssignModal = (trip: ManagedTrip) => {
    setActiveTargetTrip(trip);
    setIsAssignOpen(true);
  };
  const openReassignModal = (trip: ManagedTrip) => {
    setActiveTargetTrip(trip);
    setIsReassignOpen(true);
  };
  const openCancelModal = (trip: ManagedTrip) => {
    setActiveTargetTrip(trip);
    setIsCancelOpen(true);
  };
  const openEscalateModal = (trip: ManagedTrip) => {
    setActiveTargetTrip(trip);
    setIsEscalateOpen(true);
  };
  const openMonitorDrawer = (trip: ManagedTrip) => {
    setActiveTargetTrip(trip);
    setIsMonitorOpen(true);
  };

  // Manual fast refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncMasterData();
    setIsRefreshing(false);
    toast.success('Realtime telemetry synchronized.');
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-orange-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. ECOSYSTEM ARCHITECTURE HEADER & CONTROLS
          Hierarchy: BARAKAH ECOSYSTEM > SUPA ADMIN > SWIFT MOVE > DISPATCHER
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0f1c]/95 backdrop-blur-xl border-b border-slate-800/90 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Ecosystem Breadcrumb Navigation */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <Link to="/" className="hover:text-white transition-colors">
                Barakah Ecosystem
              </Link>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <Link to="/admin" className="hover:text-white transition-colors">
                Supa Admin
              </Link>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <Link to="/admin/swift-move" className="text-orange-400 hover:underline">
                Swift Move
              </Link>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-white font-bold bg-orange-500/20 px-2 py-0.5 rounded border border-orange-500/30">
                Dispatcher
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 font-black text-sm">
                🛰️
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Swift Move Dispatcher Console
                  <span className="hidden sm:inline-block text-[10px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Live Operations & Trip Control
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-between md:justify-end">
            {/* Realtime Status Indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium ${
                isRealtimeConnected
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                  : 'bg-amber-950/30 border-amber-800/40 text-amber-400'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="hidden sm:inline">Supabase Realtime:</span>{' '}
              {isRealtimeConnected ? 'Active (0ms)' : 'Polling'}
            </div>

            {/* Sound Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-9 px-2.5 border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white"
              title={soundEnabled ? 'Disable Audio Chime' : 'Enable Audio Chime'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-orange-400" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-500" />
              )}
            </Button>

            {/* Manual Refresh Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-9 border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
              <span className="text-xs">Sync</span>
            </Button>

            {/* Switch to Admin Dashboard (Configuration) */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 bg-slate-900 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-xs font-bold"
              asChild
            >
              <Link to="/admin/swift-move">
                <Sliders className="h-3.5 w-3.5 mr-1.5" />
                Admin Dashboard (Config) →
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. OPERATIONAL KPI COMMAND BAR
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 lg:px-8 py-5 border-b border-slate-800/60 bg-[#080d19]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
          {/* KPI 1: Unassigned Pending Queue */}
          <div
            onClick={() => {
              setActiveWing('trip_control');
              setTripControlFilter('unassigned');
            }}
            className="p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[#0a0f1c] to-[#0a0f1c] cursor-pointer hover:border-amber-500/60 transition-all shadow-lg shadow-amber-500/5"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-400">
              <span>Pending Dispatch</span>
              <Clock className="h-4 w-4" />
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white mt-1.5">
              {kpis.pending}{' '}
              <span className="text-xs font-normal text-slate-400">unassigned</span>
            </p>
            <p className="text-[11px] text-amber-300/80 mt-1 font-mono">
              Requires 1-click driver assign
            </p>
          </div>

          {/* KPI 2: In-Transit Trips */}
          <div
            onClick={() => {
              setActiveWing('trip_control');
              setTripControlFilter('in_transit');
            }}
            className="p-4 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-[#0a0f1c] to-[#0a0f1c] cursor-pointer hover:border-blue-500/60 transition-all shadow-lg shadow-blue-500/5"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-400">
              <span>In Transit</span>
              <Navigation className="h-4 w-4" />
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white mt-1.5">
              {kpis.inTransit}{' '}
              <span className="text-xs font-normal text-slate-400">active trips</span>
            </p>
            <p className="text-[11px] text-blue-300/80 mt-1 font-mono">Live telemetry streaming</p>
          </div>

          {/* KPI 3: Active Fleet Drivers */}
          <div
            onClick={() => {
              setActiveWing('live_operations');
              setLiveOpsTab('drivers');
            }}
            className="p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[#0a0f1c] to-[#0a0f1c] cursor-pointer hover:border-emerald-500/60 transition-all shadow-lg shadow-emerald-500/5"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400">
              <span>Driver Fleet</span>
              <Car className="h-4 w-4" />
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white mt-1.5">
              {kpis.availableDrivers}{' '}
              <span className="text-xs font-normal text-slate-400">avail / {kpis.totalDrivers} total</span>
            </p>
            <p className="text-[11px] text-emerald-300/80 mt-1 font-mono">
              {kpis.activeDriversCount} on duty
            </p>
          </div>

          {/* KPI 4: Operations Map Shortcut */}
          <div
            onClick={() => {
              setActiveWing('live_operations');
              setLiveOpsTab('locations');
            }}
            className="p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-[#0a0f1c] to-[#0a0f1c] cursor-pointer hover:border-purple-500/60 transition-all shadow-lg shadow-purple-500/5"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-400">
              <span>Hub Coverage</span>
              <MapPin className="h-4 w-4" />
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white mt-1.5">
              {DEFAULT_HUBS.length}{' '}
              <span className="text-xs font-normal text-slate-400">Plateau Hubs</span>
            </p>
            <p className="text-[11px] text-purple-300/80 mt-1 font-mono">Real-time sector map</p>
          </div>

          {/* KPI 5: Completed & Daily Revenue */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-[#0a0f1c] col-span-2 sm:col-span-1 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Delivered Today</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl lg:text-3xl font-black text-white mt-1.5">
              {kpis.completedToday}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Revenue: <strong className="text-emerald-400">₦{kpis.revenueToday.toLocaleString()}</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. PRIMARY WING NAVIGATION
          Wing A: LIVE OPERATIONS (Drivers, Customers, Bookings, Vehicles, Locations)
          Wing B: TRIP CONTROL (Assign, Reassign, Cancel, Escalate, Monitor)
      ───────────────────────────────────────────────────────────── */}
      <nav className="border-b border-slate-800 bg-[#0a0f1c] px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2.5">
          {/* Main Wing Toggle */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveWing('live_operations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeWing === 'live_operations'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>LIVE OPERATIONS</span>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono">
                {unifiedOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWing('trip_control')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeWing === 'trip_control'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Navigation className="h-4 w-4" />
              <span>TRIP CONTROL</span>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono">
                {kpis.pending + kpis.inTransit} Active
              </span>
            </button>
          </div>

          {/* Sub-Tabs for Live Operations */}
          {activeWing === 'live_operations' && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
              {[
                { id: 'bookings', label: 'Bookings Queue', icon: Package, count: unifiedOrders.length },
                { id: 'drivers', label: 'Drivers', icon: Car, count: driversList.length },
                { id: 'customers', label: 'Customers', icon: Users, count: customersList.length },
                { id: 'vehicles', label: 'Vehicles', icon: Truck, count: vehiclesList.length },
                { id: 'locations', label: 'Locations (Map)', icon: MapPin, count: DEFAULT_HUBS.length },
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = liveOpsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLiveOpsTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-Filters for Trip Control */}
          {activeWing === 'trip_control' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] text-slate-500 font-mono uppercase mr-1">Filter Trips:</span>
              {[
                { id: 'all', label: 'All Active', count: kpis.pending + kpis.inTransit },
                { id: 'unassigned', label: 'Unassigned (Needs Driver)', count: kpis.pending },
                { id: 'in_transit', label: 'In Transit', count: kpis.inTransit },
                { id: 'escalated', label: 'Escalations / SOS', count: 0 },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTripControlFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    tripControlFilter === f.id
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          4. MAIN CONTENT WORKSPACE
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* =========================================================
            WING 1: LIVE OPERATIONS
        ========================================================= */}
        {activeWing === 'live_operations' && (
          <div className="space-y-6">
            {/* SUB-VIEW 1.1: BOOKINGS QUEUE */}
            {liveOpsTab === 'bookings' && (
              <div className="space-y-4">
                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0f1c] p-4 rounded-2xl border border-slate-800">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search bookings by Reference, Address, Customer Phone or Driver..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-900 border-slate-700 text-xs h-9 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-xs h-9 text-white">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white text-xs">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="accepted">Accepted / Assigned</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={vehicleClassFilter} onValueChange={setVehicleClassFilter}>
                      <SelectTrigger className="w-[150px] bg-slate-900 border-slate-700 text-xs h-9 text-white">
                        <SelectValue placeholder="Dispatch Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white text-xs">
                        <SelectItem value="all">All Dispatches</SelectItem>
                        <SelectItem value="express">Express / Bike</SelectItem>
                        <SelectItem value="cargo">Box / Cargo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Bookings Table with Inline Trip Control Actions */}
                <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-900/70 border-b border-slate-800">
                        <TableRow className="border-slate-800">
                          <TableHead className="text-slate-400 font-mono text-xs">Trip ID & Time</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs">Route (Pickup → Dropoff)</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs">Customer</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs">Assigned Driver</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs">Status</TableHead>
                          <TableHead className="text-right text-slate-400 font-mono text-xs">Fare</TableHead>
                          <TableHead className="text-right text-slate-400 font-mono text-xs">Trip Control</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-40 text-center text-slate-500 text-sm">
                              <div className="flex flex-col items-center gap-2">
                                <Package className="h-8 w-8 text-slate-700" />
                                <p className="font-semibold text-slate-400">No dispatch bookings found</p>
                                <p className="text-xs text-slate-600">Only "Book a Dispatch" (parcel delivery) orders appear here.<br />Passenger ride requests are handled directly with the driver.</p>
                              </div>
                            </TableCell>
                          </TableRow>

                        ) : (
                          filteredBookings.map(order => (
                            <TableRow key={order.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                              {/* Reference & Time */}
                              <TableCell className="font-mono text-xs">
                                <span className="font-bold text-orange-400">{order.reference}</span>
                                {order.status === 'pending' && !order.assignedDriverId && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                                      PAID · DISPATCH NEEDED
                                    </span>
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </div>
                                {order.safetyPin && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded mt-1 inline-block">
                                    PIN: {order.safetyPin}
                                  </span>
                                )}
                              </TableCell>

                              {/* Route */}
                              <TableCell>
                                <div className="space-y-1 text-xs max-w-xs">
                                  <div className="flex items-start gap-1.5 truncate">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                                    <span className="text-slate-200 truncate" title={order.pickupAddress}>
                                      {order.pickupAddress}
                                    </span>
                                  </div>
                                  <div className="flex items-start gap-1.5 truncate">
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0 mt-1" />
                                    <span className="text-slate-400 truncate" title={order.dropoffAddress}>
                                      {order.dropoffAddress}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Customer */}
                              <TableCell className="text-xs">
                                <p className="font-bold text-white">{order.customerName}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{order.customerPhone}</p>
                              </TableCell>

                              {/* Assigned Driver */}
                              <TableCell className="text-xs">
                                {order.assignedDriverName ? (
                                  <div>
                                    <p className="font-bold text-emerald-400 flex items-center gap-1">
                                      <Car className="h-3 w-3" /> {order.assignedDriverName}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-mono">{order.assignedDriverPhone}</p>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                                    Awaiting Driver
                                  </Badge>
                                )}
                              </TableCell>

                              {/* Status */}
                              <TableCell>
                                <Badge
                                  className={`capitalize text-[10px] font-bold ${
                                    order.status === 'pending'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                      : order.status === 'in_transit'
                                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                      : order.status === 'delivered'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : order.status === 'cancelled'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {order.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>

                              {/* Fare */}
                              <TableCell className="text-right font-bold text-white text-xs">
                                ₦{order.fare.toLocaleString()}
                              </TableCell>

                              {/* Inline Trip Control Actions */}
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {order.status === 'pending' ? (
                                    <Button
                                      size="sm"
                                      onClick={() => openAssignModal(order)}
                                      className="h-7 px-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-lg shadow-orange-500/30 animate-pulse hover:animate-none"
                                    >
                                      ⚡ Assign Rider
                                    </Button>
                                  ) : order.status === 'accepted' || order.status === 'in_transit' ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openReassignModal(order)}
                                        className="h-7 px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs"
                                        title="Reassign Driver"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openMonitorDrawer(order)}
                                        className="h-7 px-2 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 text-xs"
                                        title="Live Monitor"
                                      >
                                        <Compass className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openMonitorDrawer(order)}
                                      className="h-7 px-2 text-slate-400 text-xs"
                                    >
                                      Inspect
                                    </Button>
                                  )}

                                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openCancelModal(order)}
                                      className="h-7 px-1.5 text-slate-500 hover:text-red-400"
                                      title="Cancel Booking"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 1.2: DRIVERS ROSTER */}
            {liveOpsTab === 'drivers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Live Driver Fleet ({driversList.length} Registered)</h3>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    {driversList.filter(d => d.status === 'available').length} Available for Dispatch
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {driversList.map(driver => (
                    <div
                      key={driver.id}
                      className="p-5 rounded-2xl bg-[#0a0f1c] border border-slate-800 hover:border-slate-700 transition-all shadow-xl space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                              {driver.vehicleType?.toLowerCase().includes('motorcycle') ? (
                                <Bike className="h-6 w-6 text-emerald-400" />
                              ) : (
                                <Car className="h-6 w-6 text-orange-400" />
                              )}
                            </div>
                            <span
                              className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0a0f1c] ${
                                driver.status === 'available'
                                  ? 'bg-emerald-500'
                                  : driver.status === 'busy'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-500'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{driver.name}</p>
                            <p className="text-xs text-slate-400">{driver.vehicleType}</p>
                            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                              {driver.plateNumber || 'No Plate Registered'}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={`uppercase text-[10px] font-bold ${
                            driver.status === 'available'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : driver.status === 'busy'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {driver.status}
                        </Badge>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">📱 {driver.phone}</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            asChild
                          >
                            <a href={`tel:${driver.phone}`}>
                              <Phone className="h-3 w-3 mr-1" /> Call
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 1.3: CUSTOMERS DIRECTORY */}
            {liveOpsTab === 'customers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Active Customers & Requester Base</h3>
                  <span className="text-xs text-slate-400 font-mono">{customersList.length} Total Users</span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-900/60">
                      <TableRow className="border-slate-800">
                        <TableHead className="text-slate-400">Customer Name</TableHead>
                        <TableHead className="text-slate-400">Contact</TableHead>
                        <TableHead className="text-slate-400">Location</TableHead>
                        <TableHead className="text-slate-400">Lifetime Bookings</TableHead>
                        <TableHead className="text-slate-400">Active Status</TableHead>
                        <TableHead className="text-right text-slate-400">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersList.map(cust => (
                        <TableRow key={cust.id} className="border-slate-800/60 hover:bg-slate-800/30">
                          <TableCell className="font-bold text-white text-xs">{cust.name}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-300">{cust.phone}</TableCell>
                          <TableCell className="text-xs text-slate-400">{cust.location}</TableCell>
                          <TableCell className="text-xs font-mono text-orange-400">{cust.ordersCount} Orders</TableCell>
                          <TableCell>
                            {cust.activeTrip ? (
                              <Badge className="bg-blue-600 text-white text-[10px]">
                                Active: {cust.activeTrip.reference}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-500">Idle</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-slate-700 text-slate-300"
                              asChild
                            >
                              <a href={`tel:${cust.phone}`}>
                                <Phone className="h-3 w-3 mr-1" /> Call
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 1.4: VEHICLES FLEET */}
            {liveOpsTab === 'vehicles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Fleet Asset Tracking</h3>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                    {vehiclesList.length} Registered Fleet Assets
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehiclesList.map(veh => (
                    <div key={veh.id} className="p-4 rounded-2xl bg-[#0a0f1c] border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-orange-400">{veh.id}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold ${
                            veh.status === 'operational'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {veh.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{veh.make}</p>
                        <p className="text-xs text-slate-400">{veh.type} • Plate: {veh.plate}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>Driver: {veh.driverName}</span>
                        <span className="text-emerald-400">Fuel: {veh.fuelLevel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 1.5: LOCATIONS & LIVE TELEMETRY MAP */}
            {liveOpsTab === 'locations' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-400" />
                      Live Plateau / Jos Sector Map
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time telemetry showing driver positions, incoming booking requests, and coverage hubs
                    </p>
                  </div>
                </div>

                <DispatcherMap
                  drivers={mapDrivers}
                  bookings={mapBookings}
                  selectedBooking={null}
                  onQuickAssign={bookingId => {
                    const match = unifiedOrders.find(o => o.id === bookingId);
                    if (match) openAssignModal(match);
                  }}
                  onSelectDriver={driver => {
                    toast.info(`Selected driver ${driver.name} (${driver.phone})`);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            WING 2: TRIP CONTROL
            (Assign, Reassign, Cancel, Escalate, Monitor)
        ========================================================= */}
        {activeWing === 'trip_control' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0f1c] p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-blue-400" />
                  Trip Control Command Center
                </h2>
                <p className="text-xs text-slate-400">
                  Full supervisory control over active bookings: 1-Click Assign, Reassign, Override Cancel, Escalate SOS, and Monitor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTripControlFilter('unassigned')}
                  className={`text-xs ${
                    tripControlFilter === 'unassigned' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'text-slate-400'
                  }`}
                >
                  Pending Assign ({kpis.pending})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTripControlFilter('in_transit')}
                  className={`text-xs ${
                    tripControlFilter === 'in_transit' ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'text-slate-400'
                  }`}
                >
                  In Transit ({kpis.inTransit})
                </Button>
              </div>
            </div>

            {/* Trip Cards for Active Control */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tripControlBookings.length === 0 ? (
                <div className="col-span-2 p-12 text-center rounded-2xl border border-slate-800 bg-[#0a0f1c] text-slate-500">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-base font-bold text-white">Trip Queue All Clear!</p>
                  <p className="text-xs text-slate-400 mt-1">No active trips requiring intervention right now.</p>
                </div>
              ) : (
                tripControlBookings.map(trip => (
                  <div
                    key={trip.id}
                    className={`p-5 rounded-2xl border transition-all space-y-4 shadow-xl ${
                      trip.status === 'pending'
                        ? 'bg-gradient-to-br from-amber-500/5 via-[#0a0f1c] to-[#0a0f1c] border-amber-500/40'
                        : 'bg-gradient-to-br from-blue-500/5 via-[#0a0f1c] to-[#0a0f1c] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-orange-400">{trip.reference}</span>
                          <Badge
                            className={`capitalize text-[10px] font-bold ${
                              trip.status === 'pending'
                                ? 'bg-amber-500 text-black'
                                : trip.status === 'in_transit'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {trip.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] font-bold text-orange-300 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full">
                            📦 Parcel Dispatch
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Created {new Date(trip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-white">₦{trip.fare.toLocaleString()}</p>
                        {trip.safetyPin && (
                          <p className="text-[10px] font-mono text-amber-400">PIN: {trip.safetyPin}</p>
                        )}
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                        <p className="text-slate-300">
                          <strong className="text-slate-400 text-[10px] block uppercase tracking-wider">Pickup:</strong>
                          {trip.pickupAddress}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500 mt-1 shrink-0" />
                        <p className="text-slate-300">
                          <strong className="text-slate-400 text-[10px] block uppercase tracking-wider">Dropoff:</strong>
                          {trip.dropoffAddress}
                        </p>
                      </div>
                    </div>

                    {/* Customer & Assigned Driver Bar */}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Customer</p>
                        <p className="font-semibold text-white">{trip.customerName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{trip.customerPhone}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Assigned Driver</p>
                        {trip.assignedDriverName ? (
                          <>
                            <p className="font-semibold text-emerald-400">{trip.assignedDriverName}</p>
                            <p className="font-mono text-[11px] text-slate-400">{trip.assignedDriverPhone}</p>
                          </>
                        ) : (
                          <span className="text-amber-400 font-bold text-xs">Unassigned</span>
                        )}
                      </div>
                    </div>

                    {/* Trip Control 5 Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. ASSIGN */}
                        {trip.status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => openAssignModal(trip)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Assign Driver
                          </Button>
                        ) : (
                          /* 2. REASSIGN */
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReassignModal(trip)}
                            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs h-8"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reassign
                          </Button>
                        )}

                        {/* 3. MONITOR */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMonitorDrawer(trip)}
                          className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 text-xs h-8"
                        >
                          <Compass className="h-3.5 w-3.5 mr-1" />
                          Monitor
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* 4. ESCALATE */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEscalateModal(trip)}
                          className="border-rose-600/50 bg-rose-950/20 text-rose-300 hover:bg-rose-900/30 text-xs h-8 font-bold"
                          title="Trigger Emergency / SOS Escalation"
                        >
                          <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                          Escalate
                        </Button>

                        {/* 5. CANCEL */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCancelModal(trip)}
                          className="text-slate-400 hover:text-red-400 text-xs h-8"
                          title="Cancel Trip"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          5. TRIP CONTROL MODALS & TELEMETRY MONITOR DRAWER
      ───────────────────────────────────────────────────────────── */}
      <AssignDriverModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        trip={activeTargetTrip}
        availableDrivers={availableCandidates}
        onAssign={handleExecuteAssign}
      />

      <ReassignDriverModal
        isOpen={isReassignOpen}
        onClose={() => setIsReassignOpen(false)}
        trip={activeTargetTrip}
        availableDrivers={availableCandidates}
        onReassign={handleExecuteReassign}
      />

      <CancelTripModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        trip={activeTargetTrip}
        onCancel={handleExecuteCancel}
      />

      <EscalateTripModal
        isOpen={isEscalateOpen}
        onClose={() => setIsEscalateOpen(false)}
        trip={activeTargetTrip}
        onEscalate={handleExecuteEscalate}
      />

      <TripTelemetryMonitorDrawer
        isOpen={isMonitorOpen}
        onClose={() => setIsMonitorOpen(false)}
        trip={activeTargetTrip}
        onOpenAssignModal={() => {
          setIsMonitorOpen(false);
          setIsAssignOpen(true);
        }}
        onOpenReassignModal={() => {
          setIsMonitorOpen(false);
          setIsReassignOpen(true);
        }}
        onOpenCancelModal={() => {
          setIsMonitorOpen(false);
          setIsCancelOpen(true);
        }}
        onOpenEscalateModal={() => {
          setIsMonitorOpen(false);
          setIsEscalateOpen(true);
        }}
      />
    </div>
  );
}
