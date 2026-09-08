import { useEffect, useState, useCallback, useMemo } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Loader2,
  Truck,
  Power,
  AlertTriangle,
  ArrowRight,
  Waypoints,
  Phone,
  Package,
  X,
  Clock,
  Star,
  ChevronRight,
  RefreshCw,
  Calendar,
  Filter,
  Banknote,
  Settings,
  Sliders,
  History,
  TrendingUp,
  Car,
  Bike,
  Sparkles,
  User,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseOrderMetadata, appendDriverAcceptance } from "@/lib/swift-order";
import { calculateDriverEarnings, DRIVER_PAYOUT_PERCENT } from "@/lib/ride-pricing";

export const Route = createFileRoute("/_authenticated/drive/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: "/auth", search: { mode: "login" } });
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const isAuthorized =
        userRoles.some((r: string) => ["driver", "dispatch_rider", "administrator", "swift_manager"].includes(r)) ||
        ["driver", "dispatch_rider", "administrator", "swift_manager"].includes(metaRole);
      if (!isAuthorized) {
        throw redirect({ to: "/my-swift-move" });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
  },
  component: DriverDashboard,
});

type Delivery = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  package_type: string;
  weight_kg: number;
  notes?: string | null;
  status: string;
  estimated_price: number;
  distance_km?: number;
  created_at: string;
  driver_id?: string | null;
};

// ── Status config for parcel deliveries ──
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; next: string; nextLabel: string; icon: any }
> = {
  accepted: {
    label: "Heading to Pickup",
    color: "text-amber-400",
    bg: "bg-amber-600",
    next: "picked_up",
    nextLabel: "CONFIRM PICKUP",
    icon: Waypoints,
  },
  picked_up: {
    label: "Package Collected",
    color: "text-orange-400",
    bg: "bg-orange-600",
    next: "in_transit",
    nextLabel: "START DELIVERY",
    icon: Package,
  },
  in_transit: {
    label: "En Route to Dropoff",
    color: "text-purple-400",
    bg: "bg-purple-600",
    next: "delivered",
    nextLabel: "COMPLETE DROPOFF ✓",
    icon: Navigation,
  },
};

// ── Status config for passenger rides ──
const RIDE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; next: string; nextLabel: string; icon: any }
> = {
  accepted: {
    label: "Heading to Passenger Pickup",
    color: "text-amber-400",
    bg: "bg-amber-600",
    next: "picked_up",
    nextLabel: "CONFIRM ARRIVAL / PICKUP",
    icon: Waypoints,
  },
  picked_up: {
    label: "Passenger Onboard",
    color: "text-cyan-400",
    bg: "bg-blue-600",
    next: "in_transit",
    nextLabel: "START RIDE",
    icon: Car,
  },
  in_transit: {
    label: "En Route to Destination",
    color: "text-purple-400",
    bg: "bg-purple-600",
    next: "delivered",
    nextLabel: "COMPLETE TRIP ✓",
    icon: Navigation,
  },
};

function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function openNavigation(address: string) {
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
}

// ─────────────────────────────────────────────────────────────────────────────

function DriverDashboard() {
  const { session, user } = useAuth() as any;
  const userId = user?.id || session?.user?.id;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swift_driver_online");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [completedJob, setCompletedJob] = useState<Delivery | null>(null);

  // ── Personnel Service Category & Filter ────────────────────────────────────
  // Dispatch Riders only see dispatches; Car Drivers only see passenger rides!
  const authRole = user?.user_metadata?.['role'] || session?.user?.user_metadata?.['role'];
  const isManagerOrAdmin = authRole === "administrator" || authRole === "swift_manager";

  const metaCategory = (user?.user_metadata?.['rider_category'] || user?.user_metadata?.['category']) as
    | "dispatch_rider"
    | "driver"
    | undefined;

  const vehicleTypeMeta = (user?.user_metadata?.['vehicle_type'] || "") as string;
  const inferredCategory: "dispatch_rider" | "driver" =
    /motorcycle|bike|scooter|bajaj/i.test(vehicleTypeMeta)
      ? "dispatch_rider"
      : /car|sedan|suv|van|bus|toyota|honda/i.test(vehicleTypeMeta)
      ? "driver"
      : "dispatch_rider";

  const defaultCategory = metaCategory || inferredCategory;

  // Category is LOCKED — vehicle drivers only see passenger rides, dispatch riders only see parcel orders.
  // Admins/managers see all requests.
  const serviceMode: "dispatch_rider" | "driver" | "all" = isManagerOrAdmin ? "all" : defaultCategory;

  const handleToggleOnline = async (nextOnline: boolean) => {
    setIsOnline(nextOnline);
    if (typeof window !== "undefined") {
      localStorage.setItem("swift_driver_online", String(nextOnline));
    }
    if (userId) {
      try {
        await (supabase as any)
          .from("active_drivers")
          .upsert(
            {
              driver_id: userId,
              is_available: nextOnline,
              status: nextOnline ? "available" : "offline",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "driver_id" },
          );
      } catch {
        // active_drivers table update optional
      }
    }
  };

  const playDispatchAlertChime = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {}
  }, []);

  const fetchDeliveries = useCallback(async () => {
    if (!userId) return;
    try {
      // Query deliveries: pending jobs available to pick up, OR jobs assigned to this driver
      // For administrators/managers, also fetch all active assigned deliveries
      let query = supabase.from("swift_deliveries").select("*");
      if (isManagerOrAdmin) {
        query = query.or(`status.eq.pending,driver_id.not.is.null,driver_id.eq.${userId}`);
      } else {
        query = query.or(`status.eq.pending,driver_id.eq.${userId}`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setDeliveries(data || []);
    } catch {
      toast.error("Failed to load jobs.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, isManagerOrAdmin]);

  useEffect(() => {
    fetchDeliveries();
    if (!userId) return;

    const sub = supabase
      .channel("driver_jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swift_deliveries" },
        (payload: any) => {
          fetchDeliveries();
          // Detect when dispatcher assigns a trip to this rider (or any trip if manager/admin)
          if (payload.eventType === "UPDATE") {
            const updated = payload.new;
            const isAssignedToMe = updated?.driver_id === userId;
            if (updated?.status === "accepted" && (isAssignedToMe || isManagerOrAdmin)) {
              playDispatchAlertChime();
              toast.success("🚨 Trip Assigned by Dispatcher!", {
                description: `Order ${updated.id.slice(0, 8)}: Navigate to pickup at ${updated.pickup_address}`,
                duration: 9000,
              });
            }
          }
        },
      )
      .subscribe();

    // Polling fallback to ensure requests update quickly
    const interval = setInterval(fetchDeliveries, 4000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(interval);
    };
  }, [userId, fetchDeliveries, isManagerOrAdmin, playDispatchAlertChime]);

  const handleAcceptJob = async (job: Delivery) => {
    setProcessingId(job.id);
    try {
      const meta = parseOrderMetadata(job.package_type);

      // Fetch driver's profile name and phone number
      let driverPhone: string | null = null;
      let driverName = user?.user_metadata?.full_name || "Swift Captain";

      const { data: profData } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", userId)
        .maybeSingle();

      if (profData?.full_name) driverName = profData.full_name;
      if (profData?.phone) {
        driverPhone = profData.phone;
      } else {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        driverPhone = authUser?.user_metadata?.['phone'] || null;
      }

      // Fetch driver's assigned vehicle if exists in the database
      let vehiclePlate = "SWIFT-24";
      let vehicleModel = "Toyota Corolla (Silver)";
      try {
        const { data: vehicleData } = await (supabase as any)
          .from("vehicles")
          .select("make, model, plate_number, color")
          .eq("driver_id", userId)
          .maybeSingle();
        if (vehicleData) {
          vehiclePlate = vehicleData.plate_number || vehiclePlate;
          vehicleModel = `${vehicleData.make || ""} ${vehicleData.model || ""} (${vehicleData.color || "Active"})`.trim();
        }
      } catch {
        // Use default vehicle model if vehicles table is unavailable
      }

      const updatedPackageType = appendDriverAcceptance(job.package_type, {
        name: driverName,
        phone: driverPhone,
        plate: vehiclePlate,
        carModel: vehicleModel,
        rating: 4.9,
      });

      const { error } = await supabase
        .from("swift_deliveries")
        .update({
          status: "accepted",
          driver_id: userId,
          package_type: updatedPackageType,
        })
        .eq("id", job.id)
        .eq("status", "pending");

      if (error) throw error;

      // Synchronize vehicle_hire_bookings table if this is a passenger ride
      if (meta.isRide) {
        try {
          await (supabase
            .from("vehicle_hire_bookings") as any)
            .update({
              status: "matched",
              driver_name: driverName,
              driver_phone: driverPhone,
              vehicle_details: `${vehicleModel} • ${vehiclePlate}`,
            })
            .eq("pickup_location", job.pickup_address)
            .eq("status", "pending");
        } catch (err) {
          console.warn("Syncing vehicle_hire_bookings on accept:", err);
        }
      }

      toast.success(
        meta.isRide
          ? "Ride accepted! Head to passenger pickup location."
          : "Job accepted! Navigate to pickup.",
      );
      fetchDeliveries();
    } catch (e: any) {
      toast.error(e.message || "Job may have been taken.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectJob = async (id: string) => {
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
    toast.info("Request dismissed.");
  };

  const handleUpdateStatus = async (job: Delivery, newStatus: string) => {
    setProcessingId(job.id);
    try {
      const meta = parseOrderMetadata(job.package_type);
      const { error } = await supabase
        .from("swift_deliveries")
        .update({ status: newStatus })
        .eq("id", job.id)
        .eq("driver_id", userId);
      if (error) throw error;

      // Synchronize vehicle_hire_bookings if passenger ride
      if (meta.isRide) {
        const hireStatus = newStatus === "delivered" ? "completed" : "in_progress";
        try {
          await supabase
            .from("vehicle_hire_bookings")
            .update({ status: hireStatus })
            .eq("pickup_location", job.pickup_address)
            .in("status", ["matched", "in_progress"]);
        } catch (err) {
          console.warn("Syncing vehicle_hire_bookings status:", err);
        }
      }

      if (newStatus === "delivered") {
        setCompletedJob(job);
        toast.success(
          meta.isRide ? "Ride completed! Passenger dropped off." : "Delivery completed!",
        );
      } else {
        if (meta.isRide) {
          const rideLabels: Record<string, string> = {
            picked_up: "Passenger onboard! Ready to start ride.",
            in_transit: "Ride underway — heading to destination!",
          };
          toast.success(rideLabels[newStatus] || "Status updated.");
        } else {
          const labels: Record<string, string> = {
            picked_up: "Package picked up!",
            in_transit: "Delivery started — en route!",
          };
          toast.success(labels[newStatus] || "Status updated.");
        }
      }
      fetchDeliveries();
    } catch (e: any) {
      toast.error(e.message || "Status update failed.");
    } finally {
      setProcessingId(null);
    }
  };

  const availableJobs = deliveries.filter((d) => {
    if (d.status !== "pending") return false;
    const meta = parseOrderMetadata(d.package_type);

    if (serviceMode === "dispatch_rider") {
      // Dispatched riders ONLY see dispatch requests (never passenger rides)
      return !meta.isRide;
    }
    if (serviceMode === "driver") {
      // Drivers ONLY see passenger ride requests (never dispatch parcels)
      return meta.isRide;
    }
    return true; // 'all' mode for managers / fleet dispatchers
  });

  const pendingDispatchCount = deliveries.filter(
    (d) => d.status === "pending" && !parseOrderMetadata(d.package_type).isRide,
  ).length;

  const pendingRideCount = deliveries.filter(
    (d) => d.status === "pending" && parseOrderMetadata(d.package_type).isRide,
  ).length;

  const currentActiveJob = deliveries.find(
    (d) =>
      (d.driver_id === userId || (isManagerOrAdmin && !!d.driver_id)) &&
      ["accepted", "picked_up", "in_transit"].includes(d.status),
  );
  // ── Earnings filter state ────────────────────────────────────────────────
  const [earningsFilter, setEarningsFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const completedDeliveries = useMemo(
    () => deliveries.filter((d) => d.driver_id === userId && d.status === "delivered"),
    [deliveries, userId],
  );

  const filteredEarnings = useMemo(() => {
    const now = new Date();
    const startOf = (unit: 'day' | 'week' | 'month') => {
      const d = new Date(now);
      if (unit === 'day') { d.setHours(0, 0, 0, 0); }
      else if (unit === 'week') { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); }
      else { d.setDate(1); d.setHours(0, 0, 0, 0); }
      return d;
    };
    const cutoff: Date | null =
      earningsFilter === 'today' ? startOf('day') :
      earningsFilter === 'week'  ? startOf('week') :
      earningsFilter === 'month' ? startOf('month') : null;

    const filtered = cutoff
      ? completedDeliveries.filter((d) => new Date(d.created_at) >= cutoff!)
      : completedDeliveries;

    const share  = filtered.reduce((sum, d) => sum + calculateDriverEarnings(d.estimated_price || 0), 0);
    const total  = filtered.reduce((sum, d) => sum + (d.estimated_price || 0), 0);
    const trips  = filtered.length;
    return { share, total, trips };
  }, [completedDeliveries, earningsFilter]);

  // Keep today's earnings for active-trip banner backward compat
  const todaysEarnings = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return completedDeliveries
      .filter((d) => new Date(d.created_at) >= start)
      .reduce((sum, d) => sum + calculateDriverEarnings(d.estimated_price || 0), 0);
  }, [completedDeliveries]);

  const totalCompleted = completedDeliveries.length;

  const timerActive = !!currentActiveJob;
  const elapsed = useTimer(timerActive);

  // Customer phone is embedded in package_type at booking time
  // This avoids cross-user RLS restrictions on profile reads
  const derivedCustomerPhone = (() => {
    const pkg = currentActiveJob?.package_type || "";
    const match = pkg.match(/\|\|\|CPHONE:([\d\+\-\(\)\s]+)/);
    return match ? match[1] : null;
  })();
  const cleanNotes = (() => {
    const pkg = currentActiveJob?.package_type || "";
    const match = pkg.match(/\|\|\|NOTES:(.+?)(?:\|\|\||$)/);
    return match ? match[1] : "";
  })();

  // ── Delivery / Ride Completed Celebration ──────────────────────────────────
  if (completedJob) {
    const meta = parseOrderMetadata(completedJob.package_type);
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center px-6 text-center space-y-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <div className="w-24 h-24 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
            </div>
          </div>
          <div className="absolute -top-2 -right-2 text-3xl animate-bounce">🎉</div>
        </div>
        <div>
          <h2 className="text-3xl font-black text-white">
            {meta.isRide ? "Ride Complete!" : "Delivery Complete!"}
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            {meta.isRide
              ? "Passenger safely arrived at destination. Fare recorded!"
              : "Great job. The customer has been notified."}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-left">
              <span className="text-slate-400 text-sm block">Your Payout ({DRIVER_PAYOUT_PERCENT}%)</span>
              <span className="text-[11px] text-slate-500">
                Customer Fare: ₦{completedJob.estimated_price?.toLocaleString()}
              </span>
            </div>
            <span className="text-2xl font-black text-emerald-400">
              ₦{calculateDriverEarnings(completedJob.estimated_price || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">
              {meta.isRide ? "Dropoff Point" : "Route"}
            </span>
            <span className="text-white text-xs text-right max-w-[200px] truncate">
              {completedJob.dropoff_address}
            </span>
          </div>
          <div className="flex gap-1 justify-center pt-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="h-6 w-6 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {meta.isRide ? "Passenger rating submitted" : "Customer rating shown after review"}
          </p>
        </div>
        <Button
          className="w-full max-w-sm h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-base"
          onClick={() => setCompletedJob(null)}
        >
          {meta.isRide ? "FIND NEXT RIDE" : "FIND NEXT JOB"}
        </Button>
      </div>
    );
  }

  // ── Active Job / Ride View ──────────────────────────────────────────────────
  if (currentActiveJob) {
    const meta = parseOrderMetadata(currentActiveJob.package_type);
    const fallbackCfg = meta.isRide ? RIDE_STATUS_CONFIG['accepted']! : STATUS_CONFIG['accepted']!;
    const cfg = (meta.isRide
      ? (RIDE_STATUS_CONFIG[currentActiveJob.status] || RIDE_STATUS_CONFIG['accepted'])
      : (STATUS_CONFIG[currentActiveJob.status] || STATUS_CONFIG['accepted'])) || fallbackCfg;
    const StatusIcon = cfg.icon;
    const nextAddress =
      currentActiveJob.status === "accepted"
        ? currentActiveJob.pickup_address
        : currentActiveJob.dropoff_address;
    const phoneToCall = meta.customerPhone || derivedCustomerPhone;

    return (
      <div className="min-h-screen bg-[#070B14] text-slate-200 flex flex-col">
        {/* Central Dispatch Notice */}
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="font-bold tracking-wide uppercase">📡 Central Dispatch Assignment</span>
            <span className="text-slate-400 hidden sm:inline">• Order #{currentActiveJob.id.slice(0, 8)}</span>
          </div>
          <span className="text-[11px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
            {meta.driverName ? `Assigned to: ${meta.driverName}` : 'Rider Dispatched'}
          </span>
        </div>

        {/* Top Status Banner */}
        <div className={`${cfg.bg} px-5 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <StatusIcon className="h-6 w-6 text-white animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-white text-lg leading-none">{cfg.label}</p>
                {meta.isRide && (
                  <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase">
                    {meta.tier || "Ride"}
                  </span>
                )}
              </div>
              <p className="text-white/70 text-xs mt-1">Timer: {elapsed}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider">
              Your Share ({DRIVER_PAYOUT_PERCENT}%)
            </p>
            <p className="font-black text-white text-xl">
              ₦{calculateDriverEarnings(currentActiveJob.estimated_price || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-white/60">
              Fare: ₦{currentActiveJob.estimated_price?.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto pb-32">
          {/* Passenger Safety PIN Verification (Crucial for passenger security) */}
          {meta.isRide && meta.pin && (
            <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    Passenger Safety PIN
                  </p>
                  <p className="text-xs text-slate-300">Verify 4-digit PIN with passenger before boarding</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-black tracking-widest text-cyan-300 bg-cyan-950 px-3.5 py-1.5 rounded-xl border border-cyan-500/40">
                  {meta.pin}
                </span>
              </div>
            </div>
          )}

          {/* Service / Cargo info strip */}
          <div className="flex gap-3">
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
              {meta.isRide ? (
                <Car className="h-4 w-4 text-cyan-400 shrink-0" />
              ) : (
                <Package className="h-4 w-4 text-slate-400 shrink-0" />
              )}
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">
                  {meta.isRide ? "Service" : "Cargo"}
                </p>
                <p className="text-sm font-bold text-white capitalize">
                  {meta.isRide
                    ? `${meta.tier || "Standard"} (${meta.seats || 4} seats)`
                    : `${currentActiveJob.package_type?.split("|||")[0] || "Parcel"} — ${currentActiveJob.weight_kg}kg`}
                </p>
              </div>
            </div>
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Distance</p>
                <p className="text-sm font-bold text-white">
                  {currentActiveJob.distance_km ? `${currentActiveJob.distance_km} km` : "Est. Route"}
                </p>
              </div>
            </div>
          </div>

          {/* Route Card */}
          <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="relative">
                <div className="absolute left-[11px] top-5 bottom-5 w-0.5 bg-gradient-to-b from-emerald-500 to-orange-500" />
                <div className="space-y-6">
                  {/* Pickup */}
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-slate-900 flex items-center justify-center shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                        {meta.isRide ? "Passenger Pickup Location" : "Pickup"}
                      </p>
                      <p className="text-sm font-semibold text-white mt-0.5 leading-snug">
                        {currentActiveJob.pickup_address}
                      </p>
                    </div>
                  </div>
                  {/* Dropoff */}
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded border-2 border-orange-500 bg-slate-900 flex items-center justify-center shrink-0 z-10">
                      <div className="w-2 h-2 bg-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-orange-500 tracking-wider">
                        {meta.isRide ? "Passenger Destination" : "Dropoff"}
                      </p>
                      <p className="text-sm font-semibold text-white mt-0.5 leading-snug">
                        {currentActiveJob.dropoff_address}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigate Button */}
          <button
            onClick={() => openNavigation(nextAddress)}
            className="w-full flex items-center justify-between bg-orange-600/10 border border-orange-500/30 text-orange-400 font-semibold px-5 py-4 rounded-xl hover:bg-orange-600/20 transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Navigation className="h-5 w-5" />
              <span className="text-sm">
                {currentActiveJob.status === "accepted"
                  ? "Navigate to Pickup in Google Maps"
                  : "Navigate to Destination in Google Maps"}
              </span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Customer Notes */}
          {(cleanNotes || meta.customerNotes) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-400 uppercase mb-0.5">
                  {meta.isRide ? "Passenger Instructions" : "Customer Note"}
                </p>
                <p className="text-sm text-slate-200 italic">{cleanNotes || meta.customerNotes}</p>
              </div>
            </div>
          )}

          {/* Customer / Passenger Phone */}
          {phoneToCall && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {meta.isRide ? "Passenger Phone" : "Customer Phone"}
                </p>
                <p className="text-sm font-semibold text-white">{phoneToCall}</p>
              </div>
              <Button
                variant="outline"
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                asChild
              >
                <a href={`tel:${phoneToCall}`}>
                  <Phone className="h-4 w-4 mr-2" /> Call Passenger
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent space-y-2">
          <Button
            className={`w-full h-16 rounded-2xl font-black text-lg shadow-2xl active:scale-[0.98] transition-all ${
              currentActiveJob.status === "in_transit"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_40px_rgba(5,150,105,0.4)]"
                : meta.isRide
                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_40px_rgba(6,182,212,0.4)]"
                : "bg-white text-black hover:bg-slate-100"
            }`}
            onClick={() => handleUpdateStatus(currentActiveJob, cfg.next)}
            disabled={processingId === currentActiveJob.id}
          >
            {processingId === currentActiveJob.id ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              cfg.nextLabel
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main Dashboard View ──────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const driverName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Driver";

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-200 font-sans relative overflow-hidden flex flex-col">
      {/* ── Welcome Header ── */}
      <div className="relative z-10 px-5 pt-6 pb-4 border-b border-slate-800/60">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">{greeting},</p>
            <h1 className="text-2xl font-black text-white mt-0.5 leading-tight">{driverName} 👋</h1>
            <p className="text-slate-500 text-xs mt-1">
              Welcome to{" "}
              <span className="text-orange-400 font-semibold">
                SwiftMove Logistics & Express Hire
              </span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                  serviceMode === "dispatch_rider"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : serviceMode === "driver"
                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                    : "bg-purple-500/15 border-purple-500/30 text-purple-300"
                }`}
              >
                {serviceMode === "dispatch_rider" ? (
                  <>
                    <Bike className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Dispatch Courier Mode</span>
                  </>
                ) : serviceMode === "driver" ? (
                  <>
                    <Car className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Passenger Driver Mode</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span>Fleet Operations (All)</span>
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-right min-w-[130px]">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-end gap-1">
                <span>My Share ({DRIVER_PAYOUT_PERCENT}%)</span>
              </p>
              <p className="font-black text-white text-xl leading-tight">₦{filteredEarnings.share.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500">{filteredEarnings.trips} trip{filteredEarnings.trips !== 1 ? 's' : ''}</p>
              {/* Quick filter pills */}
              <div className="flex gap-1 mt-1.5 justify-end">
                {(['today','week','month','all'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEarningsFilter(f)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all ${
                      earningsFilter === f
                        ? 'bg-emerald-500 text-black'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {f === 'today' ? 'Today' : f === 'week' ? 'Week' : f === 'month' ? 'Month' : 'All'}
                  </button>
                ))}
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                isOnline
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}
            >
              {isOnline ? "● ONLINE" : "○ OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Category Lock Status Bar ── */}
      <div className="relative z-10 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 backdrop-blur-md">
        <div
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
            serviceMode === "dispatch_rider"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : serviceMode === "driver"
              ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"
              : "bg-purple-500/10 border-purple-500/25 text-purple-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {serviceMode === "dispatch_rider" ? (
              <Bike className="h-4 w-4 shrink-0" />
            ) : serviceMode === "driver" ? (
              <Car className="h-4 w-4 shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold leading-tight">
                {serviceMode === "dispatch_rider"
                  ? "Dispatch Courier — Parcel Deliveries Only"
                  : serviceMode === "driver"
                  ? "Vehicle Driver — Passenger Rides Only"
                  : "Fleet Operations — All Requests"}
              </p>
              <p className="text-[10px] opacity-60 mt-0.5">
                {serviceMode === "dispatch_rider"
                  ? "You receive parcel & courier dispatch orders"
                  : serviceMode === "driver"
                  ? "You receive passenger ride & hire requests"
                  : "Viewing all fleet requests (manager view)"}
              </p>
            </div>
          </div>
          <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
            serviceMode === "dispatch_rider"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
              : serviceMode === "driver"
              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
              : "bg-purple-500/15 border-purple-500/40 text-purple-400"
          }`}>
            {serviceMode === "dispatch_rider" ? pendingDispatchCount : serviceMode === "driver" ? pendingRideCount : availableJobs.length} pending
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative z-10 flex flex-col px-4 pt-4 pb-32 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            <p className="text-slate-400 font-medium animate-pulse">
              Connecting to dispatch network...
            </p>
          </div>
        ) : availableJobs.length > 0 && isOnline ? (
          <div className="space-y-4">
            {/* Status pill */}
            <div className="flex justify-center mb-4">
              <div className="bg-slate-900/60 backdrop-blur-md px-5 py-2 rounded-full border border-slate-800 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-ping ${
                  serviceMode === "driver" ? "bg-cyan-400" : "bg-orange-500"
                }`} />
                <span className={`text-sm font-semibold ${
                  serviceMode === "driver" ? "text-cyan-300" : "text-orange-400"
                }`}>
                  {availableJobs.length}{" "}
                  {serviceMode === "dispatch_rider"
                    ? `dispatch delivery request${availableJobs.length > 1 ? "s" : ""}`
                    : serviceMode === "driver"
                    ? `passenger ride request${availableJobs.length > 1 ? "s" : ""}`
                    : `request${availableJobs.length > 1 ? "s" : ""}`}{" "}
                  nearby
                </span>
              </div>
            </div>

            {/* Job cards */}
            {availableJobs.map((job) => {
              const meta = parseOrderMetadata(job.package_type);
              const isRide = meta.isRide;
              return (
                <div key={job.id} className="relative group">
                  <div
                    className={`absolute -inset-0.5 bg-gradient-to-r ${
                      isRide
                        ? "from-cyan-500 to-blue-600"
                        : "from-emerald-500 to-orange-600"
                    } rounded-3xl blur opacity-20 group-hover:opacity-50 transition duration-500`}
                  />
                  <Card className="relative bg-slate-900/95 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <div className="space-y-1">
                        <span
                          className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 border ${
                            isRide
                              ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/30"
                              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          }`}
                        >
                          {isRide ? <Car className="h-3 w-3" /> : null}
                          {isRide
                            ? `PASSENGER RIDE • ${(meta.tier || "Standard").toUpperCase()}`
                            : "New Delivery Request"}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {new Date(job.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                          You Earn ({DRIVER_PAYOUT_PERCENT}%)
                        </span>
                        <p className="text-2xl font-black text-white">
                          ₦{calculateDriverEarnings(Number(job.estimated_price)).toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                          <span>Fare: ₦{Number(job.estimated_price).toLocaleString()}</span>
                          {job.distance_km && (
                            <>
                              <span>•</span>
                              <span>{job.distance_km} km</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                            {isRide ? "Passenger Pickup" : "Pickup"}
                          </p>
                          <p className="text-sm font-semibold text-slate-200 truncate">
                            {job.pickup_address}
                          </p>
                        </div>
                      </div>
                      <div className="ml-3.5 w-0.5 h-4 bg-gradient-to-b from-emerald-500 to-orange-500" />
                      <div className="flex gap-3 items-start">
                        <div className="w-7 h-7 rounded bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0 mt-0.5">
                          <ArrowRight className="h-3 w-3 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                            {isRide ? "Passenger Destination" : "Dropoff"}
                          </p>
                          <p className="text-sm font-semibold text-slate-200 truncate">
                            {job.dropoff_address}
                          </p>
                        </div>
                      </div>

                      {/* Ride / Package Specs */}
                      <div className="flex gap-2 pt-1">
                        {isRide ? (
                          <>
                            <span className="text-[10px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                              <User className="h-3 w-3" /> {meta.seats || 4} Passenger Seats
                            </span>
                            {meta.pin && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                                <Shield className="h-3 w-3" /> PIN Required
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-semibold">
                              {job.package_type?.split("|||")[0] || "Parcel"}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-semibold">
                              {job.weight_kg} kg
                            </span>
                          </>
                        )}
                      </div>

                      {/* Special Notes */}
                      {(meta.customerNotes || job.notes) && (
                        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 italic">
                          "{meta.customerNotes || job.notes}"
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="p-3 bg-slate-950/50 grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        className="h-12 rounded-xl border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 font-bold flex items-center gap-2"
                        onClick={() => handleRejectJob(job.id)}
                        disabled={processingId === job.id}
                      >
                        <X className="h-4 w-4" /> DECLINE
                      </Button>
                      <Button
                        className={`h-12 rounded-xl font-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                          isRide
                            ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20"
                            : "bg-white text-black hover:bg-slate-100"
                        }`}
                        onClick={() => handleAcceptJob(job)}
                        disabled={processingId === job.id}
                      >
                        {processingId === job.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isRide ? (
                          <>
                            <Car className="h-4 w-4" /> ACCEPT RIDE
                          </>
                        ) : (
                          "ACCEPT"
                        )}
                      </Button>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          /* Default Dashboard Grid */
          <div className="space-y-6 pt-2">
            {!isOnline ? (
              <div className="flex flex-col items-center justify-center py-6 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
                <Power className="h-10 w-10 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-400">You're Offline</h3>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-3 p-4 rounded-2xl border ${
                    serviceMode === "dispatch_rider"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : serviceMode === "driver"
                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                      : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full animate-ping shrink-0 ${
                      serviceMode === "dispatch_rider"
                        ? "bg-emerald-400"
                        : serviceMode === "driver"
                        ? "bg-cyan-400"
                        : "bg-orange-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {serviceMode === "dispatch_rider" ? (
                        "Online. Scanning for courier parcel & dispatch requests..."
                      ) : serviceMode === "driver" ? (
                        "Online. Scanning for passenger ride & hire requests..."
                      ) : (
                        "Online. Scanning for all dispatch deliveries & passenger rides..."
                      )}
                    </p>
                    <p className="text-[11px] opacity-75 mt-0.5">
                      {serviceMode === "dispatch_rider"
                        ? "Passenger rides are hidden to keep your courier workflow focused."
                        : serviceMode === "driver"
                        ? "Dispatch deliveries are hidden to keep your passenger ride workflow focused."
                        : "Showing unified fleet requests."}
                    </p>
                  </div>
                </div>

                {/* Category-locked notice — no counterpart cross-over */}
              </div>
            )}

            {/* ── Earnings Summary Panel ─────────────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Earnings</span>
                  <span className="text-[10px] text-emerald-400 font-bold">({DRIVER_PAYOUT_PERCENT}% share)</span>
                </div>
                <Filter className="h-3.5 w-3.5 text-slate-500" />
              </div>

              {/* Filter tabs */}
              <div className="flex bg-slate-950/60 rounded-xl p-1 gap-1">
                {(['today','week','month','all'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEarningsFilter(f)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      earningsFilter === f
                        ? 'bg-emerald-500 text-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>

              {/* Earnings figures */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950/60 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">My Payout</p>
                  <p className="text-lg font-black text-emerald-400">₦{filteredEarnings.share.toLocaleString()}</p>
                </div>
                <div className="bg-slate-950/60 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Total Fare</p>
                  <p className="text-lg font-black text-white">₦{filteredEarnings.total.toLocaleString()}</p>
                </div>
                <div className="bg-slate-950/60 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Trips</p>
                  <p className="text-lg font-black text-white">{filteredEarnings.trips}</p>
                </div>
              </div>

              {/* Avg per trip */}
              {filteredEarnings.trips > 0 && (
                <p className="text-center text-[11px] text-slate-500">
                  Avg payout per trip: <span className="text-slate-300 font-semibold">₦{Math.round(filteredEarnings.share / filteredEarnings.trips).toLocaleString()}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900/80 border-slate-800 rounded-3xl p-5 shadow-xl">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
                  Driver Score
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">4.9</span>
                  <Star className="h-6 w-6 text-amber-400 fill-amber-400 mb-1" />
                </div>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 rounded-3xl p-5 shadow-xl">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
                  Acceptance
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">94%</span>
                  <TrendingUp className="h-6 w-6 text-emerald-400 mb-1" />
                </div>
              </Card>
            </div>

            <div className="space-y-3">
              <button className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-orange-500/10 rounded-xl">
                    <History className="h-5 w-5 text-orange-400" />
                  </div>
                  <span className="font-bold text-white">Trip History</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
              <button className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-purple-500/10 rounded-xl">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="font-bold text-white">Scheduled Rides</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
              <button className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-amber-500/10 rounded-xl">
                    <Sliders className="h-5 w-5 text-amber-400" />
                  </div>
                  <span className="font-bold text-white">Driver Preferences</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
              <button className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-500/10 rounded-xl">
                    <Settings className="h-5 w-5 text-slate-400" />
                  </div>
                  <span className="font-bold text-white">Settings</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Go Online / Offline Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#070B14] via-[#070B14]/90 to-transparent z-50 flex justify-center pb-8 pt-12 pointer-events-none">
        <Button
          onClick={() => handleToggleOnline(!isOnline)}
          className={`w-full max-w-[300px] h-16 rounded-2xl font-black text-lg shadow-2xl transition-all duration-300 pointer-events-auto ${
            isOnline
              ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              : "bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_40px_rgba(234,88,12,0.4)]"
          }`}
        >
          {isOnline ? "GO OFFLINE" : "GO ONLINE"}
        </Button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `.custom-scrollbar::-webkit-scrollbar{display:none}.custom-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`,
        }}
      />
    </div>
  );
}
