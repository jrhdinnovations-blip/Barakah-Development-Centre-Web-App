import { useState, useEffect, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    FileText,
    Printer,
    Search,
    Package,
    Car,
    CheckCircle2,
    XCircle,
    Calendar,
    DollarSign,
    MapPin,
    Sparkles,
    Clock,
    ArrowLeft,
    X,
    ShieldCheck,
    Building2,
    Hash,
    Phone,
    User,
    Shield,
    ChevronRight,
    TrendingUp,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { SwiftDelivery, VehicleHireBooking } from '@/types/database.types';
import {
    driverGetTripHistory,
    DriverHistoryTrip,
    DriverTripHistoryResponse,
} from '@/lib/dispatcher.functions';
import { DRIVER_PAYOUT_PERCENT } from '@/lib/ride-pricing';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/history')({
    component: OrderHistoryPage,
    errorComponent: () => (
        <div className="container mx-auto py-16 text-center space-y-4 max-w-md">
            <h2 className="text-xl font-bold text-white">Order History Unavailable</h2>
            <p className="text-xs text-slate-400">Could not retrieve order history at this time.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Refresh Page
            </Button>
        </div>
    ),
});

type HistoryItem = {
    id: string;
    type: 'package' | 'vehicle';
    title: string;
    reference: string;
    date: string;
    pickup: string;
    dropoff: string;
    amount: number;
    status: string;
    raw: SwiftDelivery | VehicleHireBooking;
};

function OrderHistoryPage() {
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;

    const [activeTab, setActiveTab] = useState<'driver' | 'customer'>('customer');
    const [deliveries, setDeliveries] = useState<SwiftDelivery[]>([]);
    const [vehicleBookings, setVehicleBookings] = useState<VehicleHireBooking[]>([]);
    const [driverTrips, setDriverTrips] = useState<DriverHistoryTrip[]>([]);
    const [driverStats, setDriverStats] = useState({
        totalTrips: 0,
        completedCount: 0,
        declinedCount: 0,
        activeCount: 0,
        totalEarnings: 0,
        grossFares: 0,
    });

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [driverFilter, setDriverFilter] = useState<'all' | 'completed' | 'declined'>('all');
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [selectedDriverTrip, setSelectedDriverTrip] = useState<DriverHistoryTrip | null>(null);

    const receiptRef = useRef<HTMLDivElement>(null);

    const isDriverUser =
        user?.user_metadata?.role === 'driver' ||
        user?.user_metadata?.role === 'dispatch_rider';

    const fetchHistory = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            // 1. Fetch customer deliveries
            const { data: deliveryData, error: delErr } = await supabase
                .from('swift_deliveries')
                .select('*')
                .eq('customer_id', user.id)
                .order('created_at', { ascending: false });

            if (delErr) console.warn('History deliveries notice:', delErr);
            setDeliveries(deliveryData || []);
            setVehicleBookings([]);

            // 2. Fetch driver trips (elevated server query that bypasses client RLS)
            try {
                const driverRes = await driverGetTripHistory({ data: { driverId: user.id } });
                if (driverRes && driverRes.trips) {
                    setDriverTrips(driverRes.trips);
                    if (driverRes.stats) {
                        setDriverStats(driverRes.stats);
                    }
                    if (driverRes.trips.length > 0 || isDriverUser) {
                        setActiveTab('driver');
                    }
                }
            } catch (dErr) {
                console.warn('Driver trip history notice:', dErr);
            }
        } catch (err) {
            console.error('History fetch error:', err);
            toast.error('Failed to load history records.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user?.id]);

    // Customer history items
    const historyItems: HistoryItem[] = [
        ...deliveries.map((d) => ({
            id: d.id,
            type: 'package' as const,
            title: d.package_type || 'Parcel Courier',
            reference: d.payment_reference || `DEL-${d.id.slice(0, 8)}`,
            date: d.created_at || '',
            pickup: d.pickup_address || 'Pickup Point',
            dropoff: d.dropoff_address || 'Destination',
            amount: d.estimated_price || 0,
            status: d.status || 'pending',
            raw: d,
        })),
        ...vehicleBookings.map((v) => ({
            id: v.id,
            type: 'vehicle' as const,
            title: `${v.category || 'Vehicle'} Rental`,
            reference: v.payment_reference || `VHC-${v.id.slice(0, 8)}`,
            date: v.created_at || '',
            pickup: v.pickup_location || 'Pickup',
            dropoff: v.destination || 'Destination',
            amount: v.total_price || 0,
            status: v.status || 'pending',
            raw: v,
        })),
    ].sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        return tb - ta;
    });

    const filteredCustomerItems = historyItems.filter((item) => {
        const q = (searchQuery || '').toLowerCase().trim();
        if (!q) return true;
        return (
            (item.reference || '').toLowerCase().includes(q) ||
            (item.title || '').toLowerCase().includes(q) ||
            (item.pickup || '').toLowerCase().includes(q) ||
            (item.dropoff || '').toLowerCase().includes(q)
        );
    });

    // Filtered driver trips
    const filteredDriverTrips = driverTrips.filter((trip) => {
        if (driverFilter === 'completed' && (trip.status !== 'delivered' && trip.status !== 'completed')) return false;
        if (driverFilter === 'declined' && !trip.isDeclined) return false;

        const q = (searchQuery || '').toLowerCase().trim();
        if (!q) return true;
        return (
            (trip.reference || '').toLowerCase().includes(q) ||
            (trip.pickupAddress || '').toLowerCase().includes(q) ||
            (trip.dropoffAddress || '').toLowerCase().includes(q) ||
            (trip.customerName || '').toLowerCase().includes(q) ||
            (trip.customerPhone || '').toLowerCase().includes(q) ||
            (trip.tier || '').toLowerCase().includes(q)
        );
    });

    const handlePrintReceipt = () => {
        window.print();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'delivered':
            case 'completed':
                return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Completed</Badge>;
            case 'cancelled':
                return <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Cancelled</Badge>;
            case 'in_transit':
            case 'active':
                return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">Active</Badge>;
            default:
                return <Badge variant="outline" className="border-slate-700 text-slate-400 capitalize">{status.replace('_', ' ')}</Badge>;
        }
    };

    return (
        <div className="container mx-auto py-8 sm:py-10 px-4 space-y-6 max-w-6xl min-h-dvh">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400">
                            <FileText className="h-3.5 w-3.5" /> Activity Archive & Receipts
                        </div>
                        {isDriverUser && (
                            <Link
                                to="/drive"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors"
                            >
                                <ArrowLeft className="h-3 w-3" />
                                <span>Driver Cockpit</span>
                            </Link>
                        )}
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Trip & Order History</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Review completed trips, declined requests, payouts ({DRIVER_PAYOUT_PERCENT}%), and print receipts.
                    </p>
                </div>

                {/* SEARCH */}
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <Input
                        type="text"
                        placeholder="Search reference, address, client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 bg-slate-900/80 border-slate-800 text-sm text-white placeholder:text-slate-500 rounded-xl"
                    />
                </div>
            </div>

            {/* TAB SELECTOR: Driver Trips vs Customer Orders */}
            {(driverTrips.length > 0 || isDriverUser) && (
                <div className="flex bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('driver')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'driver'
                                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-black'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Car className="h-4 w-4" />
                        <span>Driver Trips & Declines ({driverTrips.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('customer')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'customer'
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 font-black'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Package className="h-4 w-4" />
                        <span>Customer Orders ({historyItems.length})</span>
                    </button>
                </div>
            )}

            {/* CONTENT */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Clock className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
            ) : activeTab === 'driver' ? (
                /* DRIVER TRIPS VIEW */
                <div className="space-y-5">
                    {/* STATS STRIP */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                                Completed Trips
                            </span>
                            <span className="text-2xl font-black text-white">{driverStats.completedCount}</span>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                                My Cut ({DRIVER_PAYOUT_PERCENT}%)
                            </span>
                            <span className="text-2xl font-black text-emerald-400">
                                ₦{driverStats.totalEarnings.toLocaleString()}
                            </span>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                                Declined Rides
                            </span>
                            <span className="text-2xl font-black text-rose-400">{driverStats.declinedCount}</span>
                        </div>
                    </div>

                    {/* FILTER PILLS */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setDriverFilter('all')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                                driverFilter === 'all'
                                    ? 'bg-cyan-500 text-black shadow'
                                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                            }`}
                        >
                            All ({driverTrips.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDriverFilter('completed')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                                driverFilter === 'completed'
                                    ? 'bg-emerald-500 text-black shadow'
                                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                            }`}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed ({driverStats.completedCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDriverFilter('declined')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                                driverFilter === 'declined'
                                    ? 'bg-rose-500 text-white shadow'
                                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                            }`}
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Declined ({driverStats.declinedCount})
                        </button>
                    </div>

                    {/* DRIVER TRIP CARDS */}
                    {filteredDriverTrips.length === 0 ? (
                        <Card className="bg-slate-900/40 border-slate-800 py-16 text-center rounded-2xl">
                            <CardContent className="space-y-4">
                                <div className="inline-flex p-4 rounded-2xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
                                    <Car className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-white">No driver trips found</h3>
                                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                                    {searchQuery ? 'No trips matched your search term.' : 'Completed and declined rides will be logged here.'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {filteredDriverTrips.map((trip) => {
                                const isCompleted = trip.status === 'delivered' || trip.status === 'completed';
                                const isDeclined = trip.isDeclined;

                                return (
                                    <Card
                                        key={trip.id}
                                        className={`bg-slate-900/70 border transition-all rounded-2xl overflow-hidden shadow-lg ${
                                            isDeclined
                                                ? 'border-rose-900/30 hover:border-rose-700/50'
                                                : isCompleted
                                                ? 'border-emerald-900/30 hover:border-emerald-700/50'
                                                : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-3 flex-1 min-w-0">
                                                {/* Header Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {isDeclined ? (
                                                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1">
                                                            <XCircle className="h-3 w-3" /> Declined by Driver
                                                        </Badge>
                                                    ) : isCompleted ? (
                                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Completed
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                                                            {trip.status.replace('_', ' ').toUpperCase()}
                                                        </Badge>
                                                    )}

                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                                                        {trip.tier.toUpperCase()}
                                                    </span>

                                                    <span className="text-xs font-mono text-slate-500">
                                                        REF: {trip.reference || trip.id.slice(0, 8).toUpperCase()}
                                                    </span>

                                                    <span className="text-xs text-slate-400 ml-auto md:ml-0 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(trip.createdAt).toLocaleString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>

                                                {/* Route */}
                                                <div className="text-xs text-slate-300 space-y-1.5">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                        <span className="text-slate-400 font-medium">Pickup:</span>
                                                        <span className="truncate text-white font-semibold">
                                                            {trip.pickupAddress || 'Unspecified location'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                                                        <span className="text-slate-400 font-medium">Dropoff:</span>
                                                        <span className="truncate text-white font-semibold">
                                                            {trip.dropoffAddress || 'Unspecified location'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Passenger Info */}
                                                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <User className="h-3.5 w-3.5 text-cyan-400" />
                                                        <strong className="text-slate-200">{trip.customerName || 'Passenger'}</strong>
                                                    </span>
                                                    {trip.customerPhone && (
                                                        <a
                                                            href={`tel:${trip.customerPhone}`}
                                                            className="flex items-center gap-1 text-cyan-400 hover:underline"
                                                        >
                                                            <Phone className="h-3 w-3" />
                                                            <span>{trip.customerPhone}</span>
                                                        </a>
                                                    )}
                                                    {trip.pickupPin && (
                                                        <span className="flex items-center gap-1 text-cyan-300 font-mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                                                            <Shield className="h-3 w-3" /> PIN: {trip.pickupPin}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Financials & Receipt Button */}
                                            <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-slate-800/80 pt-3 md:pt-0 shrink-0 gap-3">
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                                        Fare: ₦{trip.grossFare.toLocaleString()}
                                                    </span>
                                                    {isCompleted ? (
                                                        <div className="text-lg font-black text-emerald-400">
                                                            +₦{trip.driverPayout.toLocaleString()}{' '}
                                                            <span className="text-xs text-emerald-500/80 font-normal">
                                                                ({DRIVER_PAYOUT_PERCENT}%)
                                                            </span>
                                                        </div>
                                                    ) : isDeclined ? (
                                                        <div className="text-xs font-bold text-rose-400">Declined</div>
                                                    ) : (
                                                        <div className="text-base font-bold text-cyan-400">
                                                            ₦{trip.driverPayout.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>

                                                <Button
                                                    onClick={() => setSelectedDriverTrip(trip)}
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl text-xs gap-1.5"
                                                >
                                                    <FileText className="h-3.5 w-3.5" /> View Details
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* CUSTOMER ORDERS VIEW */
                <div className="space-y-4">
                    {filteredCustomerItems.length === 0 ? (
                        <Card className="bg-slate-900/40 border-slate-800 py-16 text-center rounded-2xl">
                            <CardContent className="space-y-4">
                                <div className="inline-flex p-4 rounded-2xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
                                    <FileText className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-white">No historical records found</h3>
                                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                                    {searchQuery ? 'No results matched your search term.' : "You haven't completed any customer bookings yet."}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {filteredCustomerItems.map((item) => (
                                <Card
                                    key={item.id}
                                    className="bg-slate-900/70 border-slate-800/80 hover:border-slate-700 transition-all rounded-2xl overflow-hidden shadow-lg"
                                >
                                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`p-3 rounded-2xl shrink-0 ${
                                                    item.type === 'package' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                                                }`}
                                            >
                                                {item.type === 'package' ? <Package className="h-6 w-6" /> : <Car className="h-6 w-6" />}
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white text-base">{item.title}</h3>
                                                    {getStatusBadge(item.status)}
                                                </div>
                                                <p className="text-xs font-mono text-slate-400">REF: {item.reference}</p>

                                                <div className="text-xs text-slate-400 pt-1 space-y-1">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                        <span className="truncate">{item.pickup}</span>
                                                        <span className="text-slate-600">→</span>
                                                        <span className="truncate">{item.dropoff}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-slate-800/80 pt-3 md:pt-0 shrink-0 gap-2">
                                            <div className="text-right">
                                                <div className="text-lg font-extrabold text-white">₦{item.amount.toLocaleString()}</div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> {new Date(item.date).toLocaleDateString()}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => setSelectedItem(item)}
                                                size="sm"
                                                variant="outline"
                                                className="bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl text-xs gap-1.5"
                                            >
                                                <FileText className="h-3.5 w-3.5" /> View Receipt
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* DRIVER TRIP DETAILS MODAL */}
            {selectedDriverTrip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto text-white">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`p-2.5 rounded-2xl ${
                                        selectedDriverTrip.isDeclined
                                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            : selectedDriverTrip.status === 'delivered'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    }`}
                                >
                                    {selectedDriverTrip.isDeclined ? <XCircle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        {selectedDriverTrip.isDeclined ? 'Declined Ride Record' : 'Driver Trip Details'}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-mono">
                                        REF: {selectedDriverTrip.reference || selectedDriverTrip.id.slice(0, 10).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDriverTrip(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Status & Tier */}
                        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Status:</span>
                                {selectedDriverTrip.isDeclined ? (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1.5">
                                        <XCircle className="h-3.5 w-3.5" /> Declined by Driver
                                    </span>
                                ) : selectedDriverTrip.status === 'delivered' ? (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed & Delivered
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                                        {selectedDriverTrip.status.replace('_', ' ')}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                                {selectedDriverTrip.tier.toUpperCase()}
                            </span>
                        </div>

                        {/* Route */}
                        <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] text-emerald-400/90 uppercase font-bold tracking-wider block">Pickup</span>
                                    <p className="text-sm font-semibold text-white leading-snug">
                                        {selectedDriverTrip.pickupAddress || 'Pickup not specified'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] text-rose-400/90 uppercase font-bold tracking-wider block">Dropoff</span>
                                    <p className="text-sm font-semibold text-white leading-snug">
                                        {selectedDriverTrip.dropoffAddress || 'Dropoff not specified'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Passenger */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold mb-1">
                                    <User className="h-3 w-3 text-cyan-400" /> Passenger
                                </div>
                                <p className="text-sm font-bold text-white truncate">{selectedDriverTrip.customerName || 'Customer'}</p>
                                {selectedDriverTrip.customerPhone && (
                                    <a
                                        href={`tel:${selectedDriverTrip.customerPhone}`}
                                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-semibold"
                                    >
                                        <Phone className="h-3 w-3" /> {selectedDriverTrip.customerPhone}
                                    </a>
                                )}
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold mb-1">
                                    <Clock className="h-3 w-3 text-amber-400" /> Time
                                </div>
                                <p className="text-xs font-semibold text-white">
                                    {new Date(selectedDriverTrip.createdAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {new Date(selectedDriverTrip.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Financials */}
                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Passenger Total Fare</span>
                                <span className="font-semibold text-white">₦{selectedDriverTrip.grossFare.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Platform Share ({100 - DRIVER_PAYOUT_PERCENT}%)</span>
                                <span className="font-semibold text-slate-400">
                                    ₦{(selectedDriverTrip.grossFare - selectedDriverTrip.driverPayout).toLocaleString()}
                                </span>
                            </div>
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-emerald-400 block">
                                        Driver Net Share ({DRIVER_PAYOUT_PERCENT}%)
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {selectedDriverTrip.isDeclined ? 'N/A (Trip was declined)' : 'Credited to Driver Wallet'}
                                    </span>
                                </div>
                                <span
                                    className={`text-xl font-black ${
                                        selectedDriverTrip.isDeclined ? 'text-slate-500 line-through' : 'text-emerald-400'
                                    }`}
                                >
                                    ₦{selectedDriverTrip.driverPayout.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => window.print()}
                                className="flex-1 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 h-11"
                            >
                                <Printer className="h-4 w-4" /> Print Receipt
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setSelectedDriverTrip(null)}
                                className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-11 shadow-lg shadow-orange-600/30"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER RECEIPT MODAL DIALOG */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-blue-400" />
                                <h2 className="text-lg font-bold text-white">Official Tax Invoice</h2>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* PRINTABLE RECEIPT CONTAINER */}
                        <div ref={receiptRef} className="bg-slate-950 p-6 rounded-2xl border border-slate-800/80 space-y-6 text-slate-300 font-sans">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                        <Package className="h-5 w-5 text-blue-500" /> SwiftMove Logistics & Express Hire
                                    </h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Express Courier & Vehicle Rental Platform</p>
                                </div>
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                                    PAID
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Transaction Ref</span>
                                    <strong className="text-white font-mono">{selectedItem.reference}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Issue Date</span>
                                    <strong className="text-slate-200">{new Date(selectedItem.date).toLocaleString()}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Customer Account</span>
                                    <strong className="text-slate-200 truncate block">{user?.email || 'Registered User'}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Service Category</span>
                                    <strong className="text-slate-200 capitalize">{selectedItem.title}</strong>
                                </div>
                            </div>

                            <div className="space-y-3 text-xs border-y border-slate-800/80 py-4">
                                <div className="space-y-1">
                                    <span className="text-slate-500 text-[10px] uppercase font-semibold">Pickup Location</span>
                                    <p className="text-slate-200 font-medium">{selectedItem.pickup}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-500 text-[10px] uppercase font-semibold">Destination Dropoff</span>
                                    <p className="text-slate-200 font-medium">{selectedItem.dropoff}</p>
                                </div>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Base Service Fare</span>
                                    <span>₦{(selectedItem.amount * 0.9).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>VAT & Processing Fee (10%)</span>
                                    <span>₦{(selectedItem.amount * 0.1).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                                    <span>Total Amount Paid</span>
                                    <span className="text-emerald-400">₦{selectedItem.amount.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="text-[10px] text-center text-slate-500 pt-2">
                                Thank you for choosing SwiftMove. For support, contact help@swiftmove.com
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={handlePrintReceipt}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl gap-2"
                            >
                                <Printer className="h-4 w-4" /> Print Receipt
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}