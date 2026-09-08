import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Clock,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseOrderMetadata } from "@/lib/swift-order";

export const Route = createFileRoute("/_authenticated/my-barakah")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) return;

      // Check user_roles table and user_metadata
      const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'] as string | undefined;
      if (metaRole && !roles.includes(metaRole)) roles.push(metaRole);

      // Redirect admins/managers straight to their dashboard
      if (roles.includes('administrator') || roles.includes('admin') || roles.includes('swift_manager')) {
        throw redirect({ to: '/admin' });
      }
      // Redirect dispatchers straight to dispatcher console
      if (roles.includes('swift_dispatcher') || roles.includes('dispatcher')) {
        throw redirect({ to: '/dispatcher' });
      }
      // Redirect drivers directly to their console
      if (roles.includes('driver') || roles.includes('dispatch_rider')) {
        throw redirect({ to: '/drive' });
      }

      // Check if registered in active_drivers
      const { data: driverRecord } = await supabase.from('active_drivers').select('driver_id').eq('driver_id', user.id).maybeSingle();
      if (driverRecord) {
        throw redirect({ to: '/drive' });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
    }
  },
  head: () => ({
    meta: [
      { title: "SwiftMove — Customer Dashboard" },
      { name: "description", content: "Your SwiftMove ride-hailing and courier dispatch dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MySwiftMoveDashboard,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MySwiftMoveDashboard() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [userRole, setUserRole] = useState<string>("user");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const roleFromMeta = data.user.user_metadata?.['role'] || "user";
      setUserRole(roleFromMeta);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setName(profile?.full_name || data.user.user_metadata?.['full_name'] || data.user.email?.split('@')[0] || "");
    });
  }, []);

  // Fetch recent customer bookings & deliveries
  const recentOrders = useQuery({
    queryKey: ["customer-recent-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("deliveries")
        .select("id, pickup_address, dropoff_address, estimated_price, status, package_type, created_at")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const orders = recentOrders.data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      {/* Welcome Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            As-salamu alaykum{name ? `, ${name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Welcome to <span className="font-semibold text-emerald-600 dark:text-emerald-400">SwiftMove</span> — your intra-city ride-hailing and express courier delivery service.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Verified Customer
          </span>
        </div>
      </div>

      {/* Primary Action Shortcuts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/my-vehicle-hires"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-cyan-500 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Car className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Book Ride <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-base text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
              Request a Ride
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              On-demand passenger rides with real-time driver tracking.
            </p>
          </div>
        </Link>

        <Link
          to="/my-swift-move"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-emerald-500 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Package className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Send Item <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-base text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Courier Dispatch
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Fast, reliable intra-city parcel deliveries by motorcycle couriers.
            </p>
          </div>
        </Link>

        <Link
          to="/history"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-purple-500 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              History <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-base text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Trip History
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Review past passenger trips, parcel orders, and receipts.
            </p>
          </div>
        </Link>

        <Link
          to="/my-payments"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-blue-500 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <CreditCard className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Billing <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-base text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Payments & Billing
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manage payment receipts, invoices, and transaction statements.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <Card className="rounded-3xl border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-bold">Recent Orders & Rides</CardTitle>
            <CardDescription className="text-xs">Your latest delivery and ride-hailing requests</CardDescription>
          </div>
          <Link to="/history" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            See all →
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Loading recent activity...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No recent rides or deliveries yet</p>
              <p className="text-xs text-muted-foreground">Your future orders will show up here.</p>
              <div className="pt-2 flex justify-center gap-3">
                <Button asChild size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                  <Link to="/my-vehicle-hires">Book a Ride</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link to="/my-swift-move">Send Dispatch</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.map((order: any) => {
                const meta = parseOrderMetadata(order.package_type);
                const isRide = meta.isRide;
                return (
                  <div key={order.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl mt-0.5 ${isRide ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                        {isRide ? <Car className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {isRide ? "Passenger Ride" : "Courier Dispatch"}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-accent text-accent-foreground capitalize">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-semibold text-foreground">To:</span> {order.dropoff_address}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {fmt(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right sm:self-center">
                      <span className="text-base font-black text-foreground">
                        ₦{Number(order.estimated_price || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
