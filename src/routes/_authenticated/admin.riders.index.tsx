import { useState, useEffect, useCallback } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  resetUserPassword,
  getAllRidersAdmin,
  updateRiderRoleCategoryAdmin,
  confirmAllDriverAccounts,
  confirmUserAccount,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import {
  Users,
  Navigation,
  Clock,
  MapPin,
  Truck,
  Search,
  RefreshCw,
  Loader2,
  UserPlus,
  FileText,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  Bike,
  Car,
  ArrowRightLeft,
  Settings2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/riders/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: "/auth", search: { mode: "login" } });
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      if (metaRole && !roles.includes(metaRole)) roles.push(metaRole);
      const isAuthorized = roles.some((r: string) =>
        ['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher'].includes(r)
      );
      if (!isAuthorized) throw redirect({ to: "/my-swift-move" });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
  },
  component: RidersDirectoryPage,
});

interface DriverPersonnel {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  email_confirmed?: boolean;
  category: "dispatch_rider" | "driver";
  vehicle_type: string;
  vehicle_make?: string;
  plate_number?: string;
  vehicle_color?: string;
  location: string;
  status: "active" | "offline";
  created_at: string;
}

function RidersDirectoryPage() {
  const [drivers, setDrivers] = useState<DriverPersonnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "dispatch_rider" | "driver">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Reset Password State
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Role Assignment Modal State
  const [roleModalTarget, setRoleModalTarget] = useState<DriverPersonnel | null>(null);
  const [newRole, setNewRole] = useState<"dispatch_rider" | "driver">("dispatch_rider");
  const [newVehicleType, setNewVehicleType] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newPlateNumber, setNewPlateNumber] = useState("");
  const [newVehicleColor, setNewVehicleColor] = useState("");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const generateRandomPass = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let rand = "";
    for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    const pass = `Rider@${rand}`;
    setResetPass(pass);
    setShowResetPass(true);
  };

  const handleBulkConfirm = async () => {
    setIsBulkConfirming(true);
    try {
      const res = await confirmAllDriverAccounts();
      toast.success(
        `Verification complete! Confirmed ${res.confirmed} rider account(s). All riders can now log in immediately!`
      );
      fetchDrivers();
    } catch (e: any) {
      toast.error("Failed to verify riders: " + (e.message || e.toString()));
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const handleConfirmSingle = async (driver: DriverPersonnel) => {
    setConfirmingId(driver.user_id);
    try {
      await confirmUserAccount({ data: { targetUserId: driver.user_id } });
      toast.success(`Account for ${driver.full_name} (${driver.email}) verified! Rider can now log in.`);
      setDrivers((prev) =>
        prev.map((d) => (d.user_id === driver.user_id ? { ...d, email_confirmed: true } : d))
      );
    } catch (e: any) {
      toast.error("Confirmation failed: " + (e.message || e.toString()));
    } finally {
      setConfirmingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || resetPass.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    const chosenPass = resetPass;
    const targetName = resetTarget.name;
    const targetId = resetTarget.id;
    try {
      await resetUserPassword({ data: { targetUserId: targetId, newPassword: chosenPass } });
      toast.success(`Password for ${targetName} set to: ${chosenPass}. Account also verified!`, {
        duration: 12000,
        action: {
          label: "Copy",
          onClick: () => {
            navigator.clipboard.writeText(chosenPass);
            toast.success("Password copied to clipboard!");
          },
        },
      });
      setDrivers((prev) =>
        prev.map((d) => (d.user_id === targetId ? { ...d, email_confirmed: true } : d))
      );
      setResetTarget(null);
      setResetPass("");
    } catch (e: any) {
      toast.error("Reset failed: " + (e.message || e.toString()));
    } finally {
      setResetting(false);
    }
  };

  const openRoleModal = (person: DriverPersonnel) => {
    setRoleModalTarget(person);
    setNewRole(person.category);
    setNewVehicleType(person.vehicle_type || (person.category === "driver" ? "Sedan" : "Motorcycle"));
    setNewVehicleMake(person.vehicle_make || "");
    setNewPlateNumber(person.plate_number || "");
    setNewVehicleColor(person.vehicle_color || "Silver");
  };

  const handleSaveRoleAssignment = async () => {
    if (!roleModalTarget) return;
    setIsUpdatingRole(true);
    try {
      const vType = newVehicleType.trim() || (newRole === "driver" ? "Sedan" : "Motorcycle");
      const vMake = newVehicleMake.trim();
      const vPlate = newPlateNumber.toUpperCase().trim();
      const vColor = newVehicleColor.trim();

      await updateRiderRoleCategoryAdmin({
        data: {
          targetUserId: roleModalTarget.user_id,
          category: newRole,
          vehicleType: vType,
          vehicleMake: vMake,
          plateNumber: vPlate,
          vehicleColor: vColor,
        },
      });

      toast.success(
        `Credentials for ${roleModalTarget.full_name} updated (${newRole === "dispatch_rider" ? "Dispatch Rider 🛵" : "Vehicle Driver 🚗"} · ${vMake || vType})`
      );

      // Update locally
      setDrivers((prev) =>
        prev.map((d) =>
          d.user_id === roleModalTarget.user_id
            ? {
                ...d,
                category: newRole,
                vehicle_type: vType,
                vehicle_make: vMake,
                plate_number: vPlate,
                vehicle_color: vColor,
              }
            : d
        )
      );

      setRoleModalTarget(null);
    } catch (e: any) {
      toast.error("Failed to update role: " + (e.message || e.toString()));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const fetchDrivers = useCallback(async () => {
    try {
      try {
        const riders = await getAllRidersAdmin();
        if (Array.isArray(riders) && riders.length > 0) {
          setDrivers(riders as DriverPersonnel[]);
          return;
        }
      } catch (err) {
        console.warn("getAllRidersAdmin server error, using client query fallback:", err);
      }

      // Fallback query
      const { data: driverRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");

      const driverIds = (driverRoles || []).map((r: any) => r.user_id);
      if (driverIds.length === 0) {
        setDrivers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, location, status, created_at")
        .in("user_id", driverIds)
        .order("created_at", { ascending: false });

      let activeDrvs: any[] = [];
      try {
        const { data } = await supabase.from("active_drivers").select("*");
        activeDrvs = data || [];
      } catch {}

      const merged: DriverPersonnel[] = (profiles || []).map((p: any) => {
        const active = activeDrvs.find((a: any) => a.driver_id === p.user_id);
        const isActive = active?.status === "available" || p.status === "active";
        const vType = active?.vehicle_type || "Motorcycle";
        const isCar = /car|sedan|suv|van|bus|truck/i.test(vType);
        return {
          id: p.user_id,
          user_id: p.user_id,
          full_name: p.full_name || "Unnamed Personnel",
          phone: p.phone || "N/A",
          email: "N/A",
          category: isCar ? "driver" : "dispatch_rider",
          vehicle_type: vType,
          location: active?.current_location || p.location || "Location Unknown",
          status: isActive ? "active" : "offline",
          created_at: p.created_at,
        };
      });

      setDrivers(merged);
    } catch (e: any) {
      console.error("Riders fetch error:", e);
      toast.error("Failed to load riders: " + e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();

    const channel = supabase
      .channel(`admin-riders-sync-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_drivers" },
        () => fetchDrivers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => fetchDrivers()
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchDrivers();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchDrivers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDrivers();
  };

  // Filter by category and search
  const filtered = drivers.filter((d) => {
    const matchesCategory = categoryFilter === "all" || d.category === categoryFilter;
    if (!matchesCategory) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      d.full_name?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.vehicle_type?.toLowerCase().includes(q)
    );
  });

  const dispatchRidersCount = drivers.filter((d) => d.category === "dispatch_rider").length;
  const driversCount = drivers.filter((d) => d.category === "driver").length;
  const activeCount = drivers.filter((d) => d.status === "active").length;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 relative">
      {/* Main Content */}
      <div className="p-6 lg:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                <Truck className="h-7 w-7 text-orange-500" />
              </div>
              Fleet Personnel & Drivers
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Manage Dispatch Riders (parcels/deliveries) and Vehicle Drivers (passenger rides/fleet hires).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
              title="Refresh list"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-orange-400" : ""}`}
              />
            </Button>
            <Button
              onClick={handleBulkConfirm}
              variant="outline"
              disabled={isBulkConfirming}
              className="h-10 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 gap-2 font-semibold text-xs sm:text-sm"
              title="Ensure all rider accounts are active and email verified so they can log in without errors"
            >
              {isBulkConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
              Fix / Verify Rider Logins
            </Button>
            <Button
              onClick={() => navigate({ to: "/admin/riders/add" as any })}
              className="bg-orange-600 hover:bg-orange-500 gap-2 h-10 shadow-lg shadow-orange-600/20 text-white font-bold"
            >
              <UserPlus className="h-4 w-4" /> Onboard Personnel
            </Button>
          </div>
        </div>

        {/* Categorized Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Fleet Personnel",
              value: drivers.length,
              sub: "All registered active/offline",
              icon: Users,
              color: "text-orange-400",
              bg: "bg-orange-500/10",
              border: "border-orange-500/20",
            },
            {
              label: "Dispatch Riders",
              value: dispatchRidersCount,
              sub: "Package & parcel couriers",
              icon: Bike,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              border: "border-amber-500/20",
            },
            {
              label: "Vehicle Drivers",
              value: driversCount,
              sub: "Passenger rides & fleet hires",
              icon: Car,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
              border: "border-blue-500/20",
            },
            {
              label: "Active on Duty",
              value: activeCount,
              sub: "Currently available on map",
              icon: Navigation,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/20",
            },
          ].map((s, i) => (
            <div
              key={i}
              className={`rounded-2xl border ${s.border} bg-[#0a0f1c] p-5 flex items-center gap-4 transition-all hover:border-slate-700`}
            >
              <div
                className={`h-13 w-13 rounded-2xl flex items-center justify-center ${s.bg} ${s.color} shrink-0 p-3`}
              >
                <s.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-xs text-white/90 font-semibold truncate">{s.label}</p>
                <p className="text-[11px] text-slate-500 truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Directory Card with Category Filter Tabs */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-slate-800 space-y-4">
            {/* Role Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === "all"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>All Fleet</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {drivers.length}
                  </span>
                </button>
                <button
                  onClick={() => setCategoryFilter("dispatch_rider")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === "dispatch_rider"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Dispatch Riders</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {dispatchRidersCount}
                  </span>
                </button>
                <button
                  onClick={() => setCategoryFilter("driver")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === "driver"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Vehicle Drivers</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {driversCount}
                  </span>
                </button>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, email or vehicle…"
                  className="pl-9 bg-slate-900 border-slate-800 h-9 text-xs text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Personnel List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading fleet personnel…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                <Truck className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">
                No personnel found matching the selected filter.
              </p>
              <Button
                onClick={() => navigate({ to: "/admin/riders/add" as any })}
                className="bg-orange-600 hover:bg-orange-500 gap-2"
              >
                <UserPlus className="h-4 w-4" /> Onboard Personnel
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filtered.map((driver) => {
                const isDispatch = driver.category === "dispatch_rider";
                return (
                  <div
                    key={driver.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Avatar with Role Badge */}
                      <div className="relative shrink-0">
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center border text-sm font-bold text-white shadow-md ${
                            isDispatch
                              ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                              : "bg-blue-950/40 border-blue-500/40 text-blue-300"
                          }`}
                        >
                          {isDispatch ? (
                            <Bike className="h-6 w-6 text-amber-400" />
                          ) : (
                            <Car className="h-6 w-6 text-blue-400" />
                          )}
                        </div>
                        <span
                          className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0a0f1c] ${
                            driver.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                          }`}
                        />
                      </div>

                      {/* Info & Category Tag */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white text-base">{driver.full_name}</p>

                          {/* Role Category Badge */}
                          {isDispatch ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Bike className="h-3 w-3" />
                              Dispatch Rider · {driver.vehicle_type || "Motorcycle"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <Car className="h-3 w-3" />
                              Vehicle Driver · {driver.vehicle_type || "Sedan"}
                            </span>
                          )}
                        </div>

                        {/* Vehicle Credentials Row */}
                        {(driver.vehicle_make || driver.plate_number || driver.vehicle_color) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {driver.vehicle_make && (
                              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                {driver.vehicle_color ? driver.vehicle_color + " " : ""}{driver.vehicle_make}
                              </span>
                            )}
                            {driver.vehicle_type && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {driver.vehicle_type}
                              </span>
                            )}
                            {driver.plate_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 border border-white/20 font-mono text-[11px] font-bold text-white tracking-wider">
                                <span>🇳🇬</span> {driver.plate_number}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                          {driver.email && driver.email !== "N/A" && (
                            <span className="flex items-center gap-1.5 text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                              <Mail className="h-3.5 w-3.5 text-blue-400" />
                              {driver.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {driver.phone || "N/A"}
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <MapPin className="h-3.5 w-3.5 text-slate-500" /> {driver.location}
                          </span>
                          {driver.email_confirmed === false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300">
                              ⚠️ Login Unverified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Role Switch */}
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                      {/* If unverified, show verify button */}
                      {driver.email_confirmed === false && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirmingId === driver.user_id}
                          className="h-8 px-3 text-xs bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 gap-1.5 font-bold"
                          onClick={() => handleConfirmSingle(driver)}
                        >
                          {confirmingId === driver.user_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          Verify Account
                        </Button>
                      )}

                      {/* Assign / Change Role Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 gap-1.5 font-medium"
                        onClick={() => openRoleModal(driver)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Assign Role & Vehicle
                      </Button>

                      {/* Reset Password Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 gap-1"
                        onClick={() =>
                          setResetTarget({ id: driver.user_id, name: driver.full_name, email: driver.email })
                        }
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Pass
                      </Button>

                      {/* Contact Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                        onClick={() => (window.location.href = `tel:${driver.phone}`)}
                      >
                        Call
                      </Button>

                      {/* Status Badge */}
                      <Badge
                        variant="outline"
                        className={`${
                          driver.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        } capitalize text-[10px]`}
                      >
                        {driver.status === "active" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {driver.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Role Assignment & Vehicle Details Modal */}
      {roleModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0a0f1c] border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-indigo-400" /> Assign Fleet Category & Vehicle
              </h3>
              <button
                onClick={() => setRoleModalTarget(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{roleModalTarget.full_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Set personnel role and specify vehicle credentials shown to customers on order.
              </p>
            </div>

            {/* Role Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Select Fleet Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewRole("driver");
                    if (!newVehicleType || newVehicleType.includes("Motorcycle") || newVehicleType.includes("Bike")) {
                      setNewVehicleType("Sedan");
                    }
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                    newRole === "driver"
                      ? "bg-blue-500/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-blue-500/20 w-fit text-blue-400">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">Vehicle Driver</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Passenger rides & fleet vehicle hires
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewRole("dispatch_rider");
                    if (!newVehicleType || newVehicleType.includes("Sedan") || newVehicleType.includes("Car")) {
                      setNewVehicleType("Motorcycle");
                    }
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                    newRole === "dispatch_rider"
                      ? "bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-amber-500/20 w-fit text-amber-400">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">Dispatch Rider</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Packages & parcel express couriers
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Vehicle Credentials Inputs */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Vehicle Specifications (Shown to Customer)
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Vehicle Type */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Car / Vehicle Type</label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {newRole === "driver" ? (
                      <>
                        <option value="Sedan">Sedan (Standard 4 Seats)</option>
                        <option value="SUV">SUV (High Clearance / 4WD)</option>
                        <option value="Luxury Sedan">Luxury Sedan (VIP)</option>
                        <option value="Minivan / XL">Minivan / XL (7 Seats)</option>
                        <option value="Executive Van">Executive Van / Bus</option>
                      </>
                    ) : (
                      <>
                        <option value="Motorcycle">Motorcycle (Express Dispatch)</option>
                        <option value="Delivery Bike">Delivery Bike (Rear Box)</option>
                        <option value="Tricycle / Keke">Tricycle / Keke Cargo</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Car Make & Model */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    {newRole === "driver" ? "Car Make & Model" : "Bike Make & Model"}
                  </label>
                  <Input
                    value={newVehicleMake}
                    onChange={(e) => setNewVehicleMake(e.target.value)}
                    placeholder={newRole === "driver" ? "e.g. Toyota Corolla (2020)" : "e.g. Bajaj Boxer 150"}
                    className="bg-slate-900 border-slate-700 h-9 text-xs"
                  />
                </div>

                {/* License Plate Number */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">License Plate Number</label>
                  <div className="relative">
                    <Input
                      value={newPlateNumber}
                      onChange={(e) => setNewPlateNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. JOS-824-PL"
                      className="bg-slate-900 border-slate-700 h-9 text-xs font-mono uppercase tracking-wider pl-7"
                    />
                    <span className="absolute left-2 top-2 text-[10px]">🇳🇬</span>
                  </div>
                </div>

                {/* Car Colour */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Vehicle Colour</label>
                  <Input
                    value={newVehicleColor}
                    onChange={(e) => setNewVehicleColor(e.target.value)}
                    placeholder="e.g. Silver, Black, White"
                    className="bg-slate-900 border-slate-700 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Quick Presets for Make */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(newRole === "dispatch_rider"
                  ? ["Bajaj Boxer", "TVS HLX 125", "Honda Ace 125", "Cargo Keke"]
                  : ["Toyota Corolla", "Toyota Camry (A/C)", "Lexus ES350", "Toyota Sienna XL", "Toyota Prado"]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewVehicleMake(preset)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => setRoleModalTarget(null)}
                disabled={isUpdatingRole}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                onClick={handleSaveRoleAssignment}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Save Vehicle Specs
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0a0f1c] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" /> Set Rider Password
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetPass("Rider@2026");
                    setShowResetPass(true);
                  }}
                  className="h-7 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2"
                >
                  Rider@2026
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateRandomPass}
                  className="h-7 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1 px-2"
                >
                  <Sparkles className="h-3 w-3" /> Random
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-300">
                Set a login password for{" "}
                <span className="text-white font-bold">{resetTarget.name}</span>
              </p>
              {resetTarget.email && resetTarget.email !== "N/A" && (
                <p className="text-[11px] text-blue-400 font-mono mt-0.5">
                  Login Email: {resetTarget.email}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Setting a password also automatically marks this rider’s email as verified so they can log in immediately.
              </p>
            </div>
            <div className="relative">
              <Input
                type={showResetPass ? "text" : "password"}
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                placeholder="Enter password (min 6 chars)"
                className="bg-slate-900 border-slate-700 h-11 pr-10 font-mono text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowResetPass(!showResetPass)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => {
                  setResetTarget(null);
                  setResetPass("");
                }}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold"
                onClick={handleResetPassword}
                disabled={resetting || resetPass.length < 6}
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Password"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
