import { useState, useEffect, useCallback } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resetUserPassword, getAllUsersAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Truck,
  User,
  Mail,
  Phone,
  Loader2,
  Filter,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: "/auth", search: { mode: "login" } });
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const role = roleData?.role ?? user.user_metadata?.['role'] ?? "registered_user";
      if (role !== "administrator" && role !== "swift_manager")
        throw redirect({ to: "/my-swift-move" });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
  },
  component: AllUsersPage,
});

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  administrator: {
    label: "Admin",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Shield,
  },
  driver: {
    label: "Rider",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    icon: Truck,
  },
  registered_user: {
    label: "Customer",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: User,
  },
  swift_manager: {
    label: "Manager",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: Shield,
  },
  swift_dispatcher: {
    label: "Dispatcher",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    icon: Radio,
  },
};

function AllUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetting, setResetting] = useState(false);

  const generateRandomPass = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let rand = "";
    for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    const pass = `User@${rand}`;
    setResetPass(pass);
    setShowResetPass(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || resetPass.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    const chosenPass = resetPass;
    const targetName = resetTarget.name;
    try {
      await resetUserPassword({ data: { targetUserId: resetTarget.id, newPassword: chosenPass } });
      toast.success(`Password for ${targetName} reset to: ${chosenPass}`, {
        duration: 10000,
        action: {
          label: "Copy",
          onClick: () => {
            navigator.clipboard.writeText(chosenPass);
            toast.success("Password copied to clipboard!");
          },
        },
      });
      setResetTarget(null);
      setResetPass("");
    } catch (e: any) {
      toast.error("Reset failed: " + (e.message || e.toString()));
    } finally {
      setResetting(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      try {
        const adminUsers = await getAllUsersAdmin();
        if (Array.isArray(adminUsers) && adminUsers.length > 0) {
          setUsers(adminUsers);
          return;
        }
      } catch (err) {
        console.warn("getAllUsersAdmin server function error, using client fallback:", err);
      }

      // Fallback: Fetch profiles and user_roles directly
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, phone, location, status, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];

      // Build a role lookup
      const roleMap = new Map<string, string>();
      for (const r of roles) {
        roleMap.set(r.user_id, r.role);
      }

      // Merge profiles with their roles
      const merged = profiles.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Unnamed User",
        phone: p.phone || null,
        email: "N/A",
        location: p.location || null,
        role: roleMap.get(p.user_id) || "registered_user",
        created_at: p.created_at,
      }));

      setUsers(merged);
    } catch (e: any) {
      console.error("Users fetch error:", e);
      toast.error("Failed to load users: " + e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel(`admin-users-sync-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchUsers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => fetchUsers()
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchUsers();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchUsers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  const updateRole = async (userId: string, newRole: string) => {
    const toastId = toast.loading("Updating role…");
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: newRole as any, status: "active" },
          { onConflict: "user_id,role" },
        );
      if (error) throw error;
      toast.success("Role updated!", { id: toastId });
      fetchUsers();
    } catch (e: any) {
      toast.error("Failed: " + e.message, { id: toastId });
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = [
    { label: "Total Users", value: users.length, color: "text-blue-400", bg: "bg-blue-500/10" },
    {
      label: "Admins",
      value: users.filter((u) => u.role === "administrator" || u.role === "swift_manager").length,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Dispatchers",
      value: users.filter((u) => u.role === "swift_dispatcher").length,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Riders",
      value: users.filter((u) => u.role === "driver").length,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      label: "Customers",
      value: users.filter((u) => u.role === "registered_user").length,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 relative">
      {/* Main Content */}
      <div className="p-6 lg:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Users className="h-7 w-7 text-blue-400" />
              </div>
              All Users
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Manage all platform accounts. Create users, assign roles, and control access.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
              />
            </Button>
            <Button
              onClick={() => navigate({ to: "/admin/users/create" as any })}
              className="bg-blue-600 hover:bg-blue-500 gap-2 h-10"
            >
              <UserPlus className="h-4 w-4" /> Create User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-5 flex items-center gap-4"
            >
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-black ${s.bg} ${s.color}`}
              >
                {s.value}
              </div>
              <p className="text-sm text-slate-400 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="pl-9 bg-slate-900 border-slate-800 h-10 text-slate-200"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 h-10">
              <Filter className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Filter Role" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="administrator">Admin</SelectItem>
              <SelectItem value="swift_manager">Manager</SelectItem>
              <SelectItem value="swift_dispatcher">Dispatcher</SelectItem>
              <SelectItem value="driver">Rider</SelectItem>
              <SelectItem value="registered_user">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User List */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white">User Directory</h3>
            <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300">
              {filtered.length} results
            </Badge>
          </div>

          {loading ? (
            <div className="p-16 flex items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-slate-400">Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                <Users className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-500">No users found.</p>
              <Button
                onClick={() => navigate({ to: "/admin/users/create" as any })}
                className="bg-blue-600 hover:bg-blue-500 gap-2"
              >
                <UserPlus className="h-4 w-4" /> Create First User
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filtered.map((u) => {
                const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG["registered_user"] || {
                  label: "User",
                  color: "bg-slate-800 text-slate-400 border-slate-700",
                  icon: User,
                };
                const RoleIcon = rc.icon;
                const initials = (u.full_name || "U")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={u.user_id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold border shrink-0 ${rc.color}`}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">
                          {u.full_name || "Unnamed User"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs">
                          {u.email && u.email !== "N/A" && (
                            <span className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                              <Mail className="h-3 w-3 text-blue-400" />
                              {u.email}
                            </span>
                          )}
                          {u.phone && (
                            <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {u.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        onClick={() => setResetTarget({ id: u.user_id, name: u.full_name || u.email || 'User' })}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset Password
                      </Button>
                      <Select value={u.role} onValueChange={(v) => updateRole(u.user_id, v)}>
                        <SelectTrigger
                          className={`w-[130px] h-8 text-[11px] bg-slate-900 border-slate-700 ${rc.color}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <RoleIcon className="h-3 w-3" /> {rc.label}
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          <SelectItem value="administrator">Admin</SelectItem>
                          <SelectItem value="swift_manager">Manager</SelectItem>
                          <SelectItem value="swift_dispatcher">Dispatcher</SelectItem>
                          <SelectItem value="driver">Rider</SelectItem>
                          <SelectItem value="registered_user">Customer</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] text-slate-500 font-mono hidden sm:block">
                        {u.user_id?.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0a0f1c] border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" /> Reset Password
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateRandomPass}
                className="h-8 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Auto-Generate
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Set a new login password for <span className="text-white font-semibold">{resetTarget.name}</span>
            </p>
            <div className="relative">
              <Input
                type={showResetPass ? "text" : "password"}
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                placeholder="New password (min 6 chars)"
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
                onClick={() => { setResetTarget(null); setResetPass(""); }}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold"
                onClick={handleResetPassword}
                disabled={resetting || resetPass.length < 6}
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Password"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
