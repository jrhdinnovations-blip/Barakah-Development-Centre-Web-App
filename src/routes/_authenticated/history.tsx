import { useState, useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
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
    Hash
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { SwiftDelivery, VehicleHireBooking } from '@/types/database.types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/history')({
    component: OrderHistoryPage,
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

    const [deliveries, setDeliveries] = useState<SwiftDelivery[]>([]);
    const [vehicleBookings, setVehicleBookings] = useState<VehicleHireBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

    const receiptRef = useRef<HTMLDivElement>(null);

    const fetchHistory = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const { data: deliveryData } = await supabase
                .from('swift_deliveries')
                .select('*')
                .order('created_at', { ascending: false });

            const { data: vehicleData } = await supabase
                .from('vehicle_hire_bookings')
                .select('*')
                .order('created_at', { ascending: false });

            setDeliveries(deliveryData || []);
            setVehicleBookings(vehicleData || []);
        } catch (err) {
            console.error("History fetch error:", err);
            toast.error("Failed to load history records.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user?.id]);

    // Combine into unified historical stream
    const historyItems: HistoryItem[] = [
        ...deliveries.map((d) => ({
            id: d.id,
            type: 'package' as const,
            title: d.package_type || 'Parcel Courier',
            reference: d.payment_reference || `DEL-${d.id.slice(0, 8)}`,
            date: d.created_at,
            pickup: d.pickup_address,
            dropoff: d.dropoff_address,
            amount: d.estimated_price || 0,
            status: d.status,
            raw: d,
        })),
        ...vehicleBookings.map((v) => ({
            id: v.id,
            type: 'vehicle' as const,
            title: `${v.category || 'Vehicle'} Rental`,
            reference: v.payment_reference || `VHC-${v.id.slice(0, 8)}`,
            date: v.created_at,
            pickup: v.pickup_location,
            dropoff: v.destination,
            amount: v.total_price || 0,
            status: v.status,
            raw: v,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filteredItems = historyItems.filter((item) =>
        item.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pickup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dropoff.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
        <div className="container mx-auto py-8 sm:py-10 px-4 space-y-8 max-w-6xl min-h-dvh">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-2">
                        <FileText className="h-3.5 w-3.5" /> Activity Archive & Invoices
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Order History</h1>
                    <p className="text-sm text-slate-400 mt-1">Review past package deliveries, vehicle rentals, and print tax receipts.</p>
                </div>

                {/* SEARCH */}
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <Input
                        type="text"
                        placeholder="Search reference, address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 bg-slate-900/80 border-slate-800 text-sm text-white placeholder:text-slate-500 rounded-xl"
                    />
                </div>
            </div>

            {/* LIST CONTENT */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Clock className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : filteredItems.length === 0 ? (
                <Card className="bg-slate-900/40 border-slate-800 py-16 text-center rounded-2xl">
                    <CardContent className="space-y-4">
                        <div className="inline-flex p-4 rounded-2xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
                            <FileText className="h-7 w-7" />
                        </div>
                        <h3 className="text-xl font-bold text-white">No historical records found</h3>
                        <p className="text-sm text-slate-400 max-w-sm mx-auto">
                            {searchQuery ? "No results matched your search term." : "You haven't completed any dispatches or vehicle rentals yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredItems.map((item) => (
                        <Card
                            key={item.id}
                            className="bg-slate-900/70 border-slate-800/80 hover:border-slate-700 transition-all rounded-2xl overflow-hidden shadow-lg"
                        >
                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-2xl shrink-0 ${item.type === 'package' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                                        }`}>
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

            {/* RECEIPT MODAL DIALOG */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto">
                        {/* MODAL HEADER */}
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
                                        <Package className="h-5 w-5 text-blue-500" /> Swift Move Logistics
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

                            {/* ROUTE BREAKDOWN */}
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

                            {/* FARE COMPUTATION */}
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
                                Thank you for choosing Swift Move. For support, contact help@swiftmove.com
                            </div>
                        </div>

                        {/* MODAL ACTIONS */}
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