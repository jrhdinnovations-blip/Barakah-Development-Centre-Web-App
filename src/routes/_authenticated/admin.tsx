import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DollarSign,
  Package,
  Car,
  Users,
  TrendingUp,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  MapPin
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { SwiftDelivery, VehicleHireBooking } from '@/types/database.types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const [deliveries, setDeliveries] = useState<SwiftDelivery[]>([]);
  const [vehicleBookings, setVehicleBookings] = useState<VehicleHireBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deliveries' | 'vehicles'>('deliveries');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGlobalData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all system-wide deliveries
      const { data: deliveryData, error: deliveryErr } = await supabase
        .from('swift_deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (deliveryErr) throw deliveryErr;
      setDeliveries(deliveryData || []);

      // 2. Fetch all system-wide vehicle rentals
      const { data: vehicleData, error: vehicleErr } = await supabase
        .from('vehicle_hire_bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (vehicleErr) throw vehicleErr;
      setVehicleBookings(vehicleData || []);

    } catch (err: any) {
      console.error("Admin fetch error:", err);
      toast.error(err.message || "Failed to load admin metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  // Financial & Operational Metrics Calculations
  const deliveryRevenue = deliveries
    .filter(d => d.status !== 'cancelled')
    .reduce((sum, d) => sum + (d.estimated_price || 0), 0);

  const vehicleRevenue = vehicleBookings
    .filter(v => v.status !== 'cancelled')
    .reduce((sum, v) => sum + (v.total_price || 0), 0);

  const totalPlatformRevenue = deliveryRevenue + vehicleRevenue;

  const activeDriversCount = new Set(
    deliveries.filter(d => d.driver_id && d.status !== 'delivered').map(d => d.driver_id)
  ).size;

  const activeDeliveriesCount = deliveries.filter(d => ['pending', 'assigned', 'in_transit'].includes(d.status)).length;
  const activeRentalsCount = vehicleBookings.filter(v => ['booked', 'active'].includes(v.status)).length;

  // Search Filters
  const filteredDeliveries = deliveries.filter(d =>
    d.pickup_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.dropoff_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.payment_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.package_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVehicles = vehicleBookings.filter(v =>
    v.pickup_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.payment_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 sm:py-10 px-4 space-y-8 max-w-7xl">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-0.5">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Platform Administration
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">System Admin Console</h1>
          <p className="text-sm text-slate-400 mt-1">
            Global metrics, financial overview, driver dispatches, and master booking management.
          </p>
        </div>

        <Button
          onClick={fetchGlobalData}
          disabled={isLoading}
          variant="outline"
          className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Metrics
        </Button>
      </div>

      {/* --- METRICS CARDS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Platform Revenue */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total Gross Revenue</CardTitle>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
              ₦{totalPlatformRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Deliveries & Vehicle Rentals combined
            </p>
          </CardContent>
        </Card>

        {/* Active Drivers */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Active On-Duty Drivers</CardTitle>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-400">
              {activeDriversCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Assigned to active dispatches</p>
          </CardContent>
        </Card>

        {/* Package Deliveries Metrics */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-xl relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Package Deliveries</CardTitle>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
              <Package className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {deliveries.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong className="text-purple-400">{activeDeliveriesCount} active</strong> currently in progress
            </p>
          </CardContent>
        </Card>

        {/* Vehicle Hire Metrics */}
        <Card className="bg-slate-900/80 border-slate-800 shadow-xl relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Vehicle Rentals</CardTitle>
            <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl">
              <Car className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {vehicleBookings.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong className="text-orange-400">{activeRentalsCount} active</strong> vehicle reservations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* --- MASTER BOOKING MANAGEMENT SECTION --- */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-2xl">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">All Platform Transactions</CardTitle>
              <CardDescription className="text-slate-400">
                Search, inspect, and monitor all customer bookings across Swift Move.
              </CardDescription>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                onClick={() => setActiveTab('deliveries')}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === 'deliveries' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Deliveries ({deliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === 'vehicles' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Vehicle Rentals ({vehicleBookings.length})
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by address, reference code, package type, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950/80 border-slate-800 pl-10 text-white text-sm placeholder:text-slate-500"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Clock className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* --- DELIVERIES TABLE --- */}
              {activeTab === 'deliveries' && (
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Reference / Date</th>
                      <th className="px-4 py-3.5">Package Type</th>
                      <th className="px-4 py-3.5">Route</th>
                      <th className="px-4 py-3.5">Distance / Weight</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Fare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDeliveries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500">
                          No delivery orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredDeliveries.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4 font-mono text-xs">
                            <div className="text-white font-semibold">{item.payment_reference || item.id.slice(0, 8)}</div>
                            <div className="text-slate-500 text-[11px]">{new Date(item.created_at).toLocaleDateString()}</div>
                          </td>
                          <td className="px-4 py-4 font-medium text-white">
                            {item.package_type}
                          </td>
                          <td className="px-4 py-4 text-xs max-w-xs truncate">
                            <div className="flex items-center gap-1 text-slate-200">
                              <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> {item.pickup_address}
                            </div>
                            <div className="flex items-center gap-1 text-slate-400 mt-1">
                              <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" /> {item.dropoff_address}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-400">
                            {item.distance_km} km • {item.weight_kg} kg
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={`capitalize text-[11px] ${item.status === 'delivered' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                                item.status === 'in_transit' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                                  item.status === 'pending' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                                    'border-slate-700 text-slate-400'
                              }`}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-blue-400">
                            ₦{item.estimated_price?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* --- VEHICLES TABLE --- */}
              {activeTab === 'vehicles' && (
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Reference / Date</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Pickup / Destination</th>
                      <th className="px-4 py-3.5">Duration</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500">
                          No vehicle hire bookings found.
                        </td>
                      </tr>
                    ) : (
                      filteredVehicles.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4 font-mono text-xs">
                            <div className="text-white font-semibold">{item.payment_reference || item.id.slice(0, 8)}</div>
                            <div className="text-slate-500 text-[11px]">{new Date(item.created_at).toLocaleDateString()}</div>
                          </td>
                          <td className="px-4 py-4 font-medium text-white capitalize">
                            {item.category} ({item.sub_category})
                          </td>
                          <td className="px-4 py-4 text-xs max-w-xs truncate">
                            <div className="text-slate-200">{item.pickup_location}</div>
                            <div className="text-slate-400 text-[11px]">to {item.destination}</div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-400">
                            {item.duration_days} Day(s)
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={`capitalize text-[11px] ${item.status === 'booked' || item.status === 'active'
                                ? 'border-orange-500/30 text-orange-400 bg-orange-500/10'
                                : 'border-slate-700 text-slate-400'
                              }`}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-orange-400">
                            ₦{item.total_price?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}