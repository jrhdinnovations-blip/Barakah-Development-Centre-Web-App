import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    Package,
    Car,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    MapPin,
    CreditCard,
    Sparkles,
    Clock,
    ShieldCheck,
    ShieldAlert,
    Navigation2,
    AlertTriangle,
    RefreshCw,
    Radio
} from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { SwiftDelivery, VehicleHireBooking } from '@/types/database.types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const googleLibraries: ("places" | "geometry")[] = ["places", "geometry"];

// --- ROUTE ERROR BOUNDARY CATCH ---
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("MySwiftMove Render Error:", error, errorInfo);
    }

    override render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-red-500/30 rounded-2xl text-center space-y-4 shadow-2xl">
                    <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
                    <h2 className="text-xl font-bold text-white">Route Exception Intercepted</h2>
                    <p className="text-xs text-slate-400 font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-left overflow-x-auto text-red-300">
                        {this.state.error?.toString() || "Unknown rendering exception"}
                    </p>
                    <Button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-semibold"
                    >
                        <RefreshCw className="h-4 w-4" /> Reload Page
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}

export const Route = createFileRoute('/_authenticated/swift-move/new')({
    component: () => (
        <RouteErrorBoundary>
            <MySwiftMovePage />
        </RouteErrorBoundary>
    ),
});

function calculateFare(distanceKm: number, weightKg: number, isVehicle: boolean): number {
    const safeDist = typeof distanceKm === 'number' && !isNaN(distanceKm) ? distanceKm : 1;
    const safeWeight = typeof weightKg === 'number' && !isNaN(weightKg) ? weightKg : 1;
    const base = 1200;
    const distFare = safeDist * 180;
    const weightFare = safeWeight * 60;
    const total = base + distFare + weightFare;
    return isVehicle ? Math.max(total * 3.5, 6000) : Math.max(total, 1500);
}

// --- SYNCHRONIZED LOCATION SEARCH INPUT ---
function LocationSearchInput({
    value,
    onChange,
    isLoaded,
    placeholder = "Search location or street..."
}: {
    value: string;
    onChange: (val: string) => void;
    isLoaded: boolean;
    placeholder?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isLoaded || !inputRef.current || typeof window === 'undefined') return;

        try {
            if (window.google?.maps?.places?.Autocomplete) {
                const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                    fields: ['formatted_address', 'geometry', 'name'],
                });

                const listener = autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    const selectedAddress = place?.formatted_address || place?.name || inputRef.current?.value || "";
                    if (selectedAddress) {
                        onChange(selectedAddress);
                    }
                });

                return () => {
                    if (window.google?.maps?.event && listener) {
                        google.maps.event.removeListener(listener);
                    }
                };
            }
        } catch (err) {
            console.warn("Autocomplete fallback active:", err);
        }
        return undefined;
    }, [isLoaded, onChange]);

    return (
        <div className="w-full relative group">
            <input
                ref={inputRef}
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onBlur={(e) => {
                    const val = e?.target?.value;
                    if (val && val !== value) {
                        onChange(val);
                    }
                }}
                placeholder={placeholder}
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 shadow-inner"
            />
            <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        </div>
    );
}

// --- LIVE ROUTE VISUALIZER CARD ---
function RouteVisualizer({ pickup, dropoff, distanceKm }: { pickup: string; dropoff: string; distanceKm: number }) {
    const safeDist = typeof distanceKm === 'number' && !isNaN(distanceKm) ? distanceKm : 0;

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                    <Navigation2 className="h-3.5 w-3.5 animate-pulse" /> Live Route Estimation
                </span>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 font-mono">
                    ~{safeDist.toFixed(1)} km
                </Badge>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-500 before:to-orange-500">
                <div className="relative">
                    <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                    <div className="text-xs text-slate-400">Pickup Origin</div>
                    <div className="text-sm font-semibold text-white truncate">{pickup || "Select pickup location"}</div>
                </div>

                <div className="relative">
                    <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-orange-500/20" />
                    <div className="text-xs text-slate-400">Destination Dropoff</div>
                    <div className="text-sm font-semibold text-white truncate">{dropoff || "Select dropoff location"}</div>
                </div>
            </div>
        </div>
    );
}

// --- RESPONSIVE ACTIVE OPERATIONS VIEW ---
function ActiveOperationsView({
    deliveries = [],
    vehicleBookings = [],
    isLoading = false,
    isRealtimeConnected = false
}: {
    deliveries: SwiftDelivery[];
    vehicleBookings: VehicleHireBooking[];
    isLoading?: boolean;
    isRealtimeConnected?: boolean;
}) {
    const [activeTab, setActiveTab] = useState<'all' | 'deliveries' | 'vehicles'>('all');

    const activeDeliveries = (deliveries || []).filter(d => d && !['delivered', 'cancelled'].includes(d.status));
    const activeVehicles = (vehicleBookings || []).filter(v => v && !['completed', 'cancelled'].includes(v.status));
    const totalActive = activeDeliveries.length + activeVehicles.length;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-16">
                <Clock className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        const s = status || '';
        switch (s) {
            case 'in_transit': return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">In Transit</Badge>;
            case 'assigned': return <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30">Driver Assigned</Badge>;
            case 'pending': return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">Pending Dispatch</Badge>;
            case 'active': return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active Rental</Badge>;
            case 'booked': return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30">Reserved</Badge>;
            default: return <Badge variant="outline" className="border-slate-700 text-slate-400">{s || 'Unknown'}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Dispatches</h2>
                        {isRealtimeConnected && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-2 py-0.5 flex items-center gap-1">
                                <Radio className="h-3 w-3 animate-pulse" /> Live Telemetry
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Real-time status updates for ongoing deliveries and active vehicle rentals.</p>
                </div>

                <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        All ({totalActive})
                    </button>
                    <button
                        onClick={() => setActiveTab('deliveries')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'deliveries' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        Packages ({activeDeliveries.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('vehicles')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        Vehicles ({activeVehicles.length})
                    </button>
                </div>
            </div>

            {totalActive === 0 && (
                <Card className="bg-slate-900/40 border-slate-800/80 py-16 text-center rounded-2xl">
                    <CardContent className="space-y-4">
                        <div className="inline-flex p-4 rounded-2xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
                            <ShieldAlert className="h-7 w-7" />
                        </div>
                        <h3 className="text-xl font-bold text-white">No active orders right now</h3>
                        <p className="text-sm text-slate-400 max-w-sm mx-auto">
                            Ready to send a parcel or hire a vehicle? Use the quick actions above to initiate a booking.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                {(activeTab === 'all' || activeTab === 'deliveries') &&
                    activeDeliveries.map((delivery) => (
                        <Card key={delivery.id} className="group bg-slate-900/70 border-slate-800/80 hover:border-blue-500/40 transition-all duration-300 rounded-2xl overflow-hidden shadow-lg hover:shadow-blue-500/5">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white font-bold">{delivery.package_type || 'Package Dispatch'}</CardTitle>
                                        <CardDescription className="text-xs text-slate-500 font-mono">
                                            REF: {delivery.payment_reference?.slice(-8) || delivery.id?.slice(0, 8)}
                                        </CardDescription>
                                    </div>
                                </div>
                                {getStatusBadge(delivery.status)}
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60 text-xs space-y-2">
                                    <div className="flex items-start gap-2 text-slate-300">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                                        <span className="truncate">{delivery.pickup_address}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-slate-300">
                                        <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1" />
                                        <span className="truncate">{delivery.dropoff_address}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-medium">
                                    <span>Weight: <strong className="text-slate-200">{delivery.weight_kg || 1} kg</strong></span>
                                    <span>Dist: <strong className="text-slate-200">{delivery.distance_km || 1} km</strong></span>
                                    <span className="text-base font-bold text-blue-400">₦{(delivery.estimated_price || 0).toLocaleString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                {(activeTab === 'all' || activeTab === 'vehicles') &&
                    activeVehicles.map((booking) => (
                        <Card key={booking.id} className="group bg-slate-900/70 border-slate-800/80 hover:border-orange-500/40 transition-all duration-300 rounded-2xl overflow-hidden shadow-lg hover:shadow-orange-500/5">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                        <Car className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white font-bold capitalize">{booking.category || 'Vehicle'} Rental</CardTitle>
                                        <CardDescription className="text-xs text-slate-500 font-mono">
                                            {booking.duration_days || 1} Day(s) • {booking.sub_category || 'Standard'}
                                        </CardDescription>
                                    </div>
                                </div>
                                {getStatusBadge(booking.status)}
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60 text-xs space-y-2">
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                        <span className="truncate">{booking.pickup_location}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Start: {booking.start_date ? new Date(booking.start_date).toLocaleDateString() : 'Today'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-medium">
                                    <span>Ref: <strong className="text-slate-300">{booking.payment_reference?.slice(-8) || 'N/A'}</strong></span>
                                    <span className="text-base font-bold text-orange-400">₦{(booking.total_price || 0).toLocaleString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
            </div>
        </div>
    );
}

// --- MAIN PAGE COMPONENT ---
function MySwiftMovePage() {
    let user: any = null;
    try {
        const auth = useAuth() as any;
        user = auth?.user || auth?.session?.user;
    } catch (err) {
        console.warn("Auth hook resolution context fallback:", err);
    }

    const [viewMode, setViewMode] = useState<'overview' | 'wizard'>('overview');
    const [selectedService, setSelectedService] = useState<'package' | 'vehicle'>('package');

    // Supabase Data State
    const [deliveries, setDeliveries] = useState<SwiftDelivery[]>([]);
    const [vehicleBookings, setVehicleBookings] = useState<VehicleHireBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

    // Wizard Form State
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [weight, setWeight] = useState<number>(1);
    const [vehicleCategory, setVehicleCategory] = useState('private');
    const [distanceKm, setDistanceKm] = useState(3.5);
    const [calculatedPrice, setCalculatedPrice] = useState(0);
    const [currentReference, setCurrentReference] = useState('');

    const PAYSTACK_PUBLIC_KEY = "pk_test_your_public_key_here";

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: "AIzaSyA8pmTIR8Kk61KtXarxO-4qPwSw4X8t6cM",
        libraries: googleLibraries,
    });

    const fetchUserData = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const { data: deliveryData } = await supabase
                .from('swift_deliveries')
                .select('*')
                .order('created_at', { ascending: false });
            setDeliveries(deliveryData || []);

            const { data: vehicleData } = await (supabase as any)
                .from('vehicle_hire_bookings')
                .select('*')
                .order('created_at', { ascending: false });
            setVehicleBookings(vehicleData || []);
        } catch (err) {
            console.error("Data sync error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- SUPABASE REALTIME STATUS LISTENER ---
    useEffect(() => {
        if (!user?.id) return;

        fetchUserData();

        const deliveryChannel = supabase
            .channel(`user-deliveries-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'swift_deliveries',
                    filter: `customer_id=eq.${user.id}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as SwiftDelivery;
                        toast.info(`Package status updated to ${updated.status.replace('_', ' ')}`);
                    }
                    fetchUserData();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsRealtimeConnected(true);
            });

        const vehicleChannel = supabase
            .channel(`user-vehicles-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vehicle_hire_bookings',
                    filter: `customer_id=eq.${user.id}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        toast.info("Vehicle rental booking status updated.");
                    }
                    fetchUserData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(deliveryChannel);
            supabase.removeChannel(vehicleChannel);
        };
    }, [user?.id]);

    useEffect(() => {
        const price = calculateFare(distanceKm, weight, selectedService === 'vehicle');
        setCalculatedPrice(price);
        setCurrentReference(`SM-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    }, [distanceKm, weight, selectedService]);

    const handleStartBooking = (type: 'package' | 'vehicle') => {
        setSelectedService(type);
        setStep(1);
        setViewMode('wizard');
    };

    const calculateDistance = () => {
        if (!pickup || !dropoff || !window.google?.maps?.DistanceMatrixService) {
            setDistanceKm(4.5);
            return;
        }
        try {
            const service = new google.maps.DistanceMatrixService();
            service.getDistanceMatrix({
                origins: [pickup],
                destinations: [dropoff],
                travelMode: google.maps.TravelMode.DRIVING,
            }, (response, status) => {
                if (status === 'OK' && response?.rows?.[0]?.elements?.[0]?.status === 'OK') {
                    const element = response.rows[0].elements[0];
                    setDistanceKm(element.distance.value / 1000);
                } else {
                    setDistanceKm(4.5);
                }
            });
        } catch {
            setDistanceKm(4.5);
        }
    };

    const handleNextStep = () => {
        if (step === 2) {
            const pickupVal = pickup.trim();
            const dropoffVal = dropoff.trim();

            if (!pickupVal || !dropoffVal) {
                toast.error("Please enter both pickup and dropoff addresses.");
                return;
            }
            calculateDistance();
        }
        setStep((s) => s + 1);
    };

    const handleBackStep = () => {
        if (step === 1) {
            setViewMode('overview');
        } else {
            setStep((s) => Math.max(1, s - 1));
        }
    };

    const handleSubmitBooking = async () => {
        if (!user?.id) {
            toast.error("Please sign in to place an order.");
            return;
        }

        setIsSubmitting(true);

        try {
            if (selectedService === 'package') {
                const { error } = await supabase.from('swift_deliveries').insert({
                    customer_id: user.id,
                    pickup_address: pickup,
                    dropoff_address: dropoff,
                    package_type: 'General Parcel',
                    weight_kg: weight,
                    distance_km: distanceKm,
                    estimated_price: calculatedPrice,
                    payment_reference: currentReference,
                    status: 'awaiting_payment',
                });
                if (error) throw error;
            } else {
                const { error } = await (supabase as any).from('vehicle_hire_bookings').insert({
                    customer_id: user.id,
                    category: vehicleCategory,
                    pickup_location: pickup,
                    destination: dropoff,
                    start_date: new Date().toISOString(),
                    duration_days: 1,
                    total_price: calculatedPrice,
                    payment_reference: currentReference,
                    status: 'booked',
                });
                if (error) throw error;
            }

            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.async = true;
            script.onload = () => {
                const handler = (window as any).PaystackPop.setup({
                    key: PAYSTACK_PUBLIC_KEY,
                    email: user?.email || 'customer@swiftmove.com',
                    amount: calculatedPrice * 100,
                    ref: currentReference,
                    currency: 'NGN',
                    callback: function () {
                        toast.success("Payment confirmed! Your job is active.");
                        setIsSubmitting(false);
                        setViewMode('overview');
                        fetchUserData();
                    },
                    onClose: function () {
                        toast.info("Payment popup closed. Booking saved to active operations.");
                        setIsSubmitting(false);
                        setViewMode('overview');
                        fetchUserData();
                    }
                });
                handler.openIframe();
            };
            document.body.appendChild(script);

        } catch (error: any) {
            console.error("Booking submission error:", error);
            toast.error(error.message || "Failed to submit booking.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto py-6 sm:py-10 px-4 space-y-10 max-w-6xl min-h-dvh">
            {/* ================= VIEW MODE 1: OVERVIEW PORTAL ================= */}
            {viewMode === 'overview' && (
                <>
                    {/* HERO HEADER */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/80 pb-8">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                                <Sparkles className="h-3.5 w-3.5" /> Express Dispatch & Rentals
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                                Swift Logistics Hub
                            </h1>
                            <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
                                Seamless intra-city courier deliveries and flexible vehicle hire. Dispatch items or reserve vehicles in seconds.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                            <Button
                                onClick={() => handleStartBooking('package')}
                                className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-600/25 h-12 px-6 font-bold rounded-xl"
                            >
                                <Package className="h-5 w-5" /> Dispatch Package
                            </Button>

                            <Button
                                onClick={() => handleStartBooking('vehicle')}
                                className="bg-orange-600 hover:bg-orange-500 text-white gap-2 shadow-lg shadow-orange-600/25 h-12 px-6 font-bold rounded-xl"
                            >
                                <Car className="h-5 w-5" /> Hire Vehicle
                            </Button>
                        </div>
                    </div>

                    {/* INTERACTIVE CARDS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card
                            onClick={() => handleStartBooking('package')}
                            className="group cursor-pointer bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950 border-slate-800/80 hover:border-blue-500/60 transition-all duration-300 rounded-3xl p-2 shadow-xl hover:shadow-blue-500/10"
                        >
                            <CardHeader className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <Package className="h-7 w-7" />
                                    </div>
                                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                                        Instant Courier
                                    </Badge>
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                        Parcel & Freight Courier
                                    </CardTitle>
                                    <CardDescription className="text-sm text-slate-400 mt-2 leading-relaxed">
                                        Door-to-door courier dispatches across the city. Instant route generation, weight pricing, and verified driver assignments.
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardFooter className="pt-4">
                                <Button className="w-full h-12 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl gap-2">
                                    Dispatch Package Now <ArrowRight className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card
                            onClick={() => handleStartBooking('vehicle')}
                            className="group cursor-pointer bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950 border-slate-800/80 hover:border-orange-500/60 transition-all duration-300 rounded-3xl p-2 shadow-xl hover:shadow-orange-500/10"
                        >
                            <CardHeader className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="p-4 rounded-2xl bg-orange-500/10 text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-all">
                                        <Car className="h-7 w-7" />
                                    </div>
                                    <Badge variant="outline" className="border-orange-500/30 text-orange-400 bg-orange-500/10">
                                        Flexible Hire
                                    </Badge>
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                                        Vehicle Hire & Rentals
                                    </CardTitle>
                                    <CardDescription className="text-sm text-slate-400 mt-2 leading-relaxed">
                                        Reserve executive sedans, spacious SUVs, or heavy delivery trucks on flexible hourly or multi-day hire schedules.
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardFooter className="pt-4">
                                <Button className="w-full h-12 font-bold text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-xl gap-2">
                                    Book a Vehicle Hire <ArrowRight className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    <hr className="border-slate-800/80 my-8" />

                    {/* ACTIVE OPERATIONS OVERVIEW */}
                    <ActiveOperationsView
                        deliveries={deliveries}
                        vehicleBookings={vehicleBookings}
                        isLoading={isLoading}
                        isRealtimeConnected={isRealtimeConnected}
                    />
                </>
            )}

            {/* ================= VIEW MODE 2: MULTI-STEP BOOKING WIZARD ================= */}
            {viewMode === 'wizard' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setViewMode('overview')}
                            className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Exit Wizard
                        </Button>

                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 px-3 py-1 font-mono text-xs">
                            Step {step} of 3
                        </Badge>
                    </div>

                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>

                    <Card className="bg-slate-900/90 border-slate-800/80 shadow-2xl rounded-3xl backdrop-blur-xl">
                        {step === 1 && (
                            <>
                                <CardHeader>
                                    <CardTitle className="text-white text-2xl font-bold">Choose Logistics Service</CardTitle>
                                    <CardDescription className="text-slate-400">Select the service type for your booking.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid sm:grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setSelectedService('package')}
                                        className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedService === 'package' ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                                            }`}
                                    >
                                        <Package className={`h-8 w-8 mb-3 ${selectedService === 'package' ? 'text-blue-400' : 'text-slate-500'}`} />
                                        <h3 className="font-bold text-white text-base">Package Courier</h3>
                                        <p className="text-xs text-slate-400 mt-1">Direct parcel delivery across the city.</p>
                                    </div>

                                    <div
                                        onClick={() => setSelectedService('vehicle')}
                                        className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedService === 'vehicle' ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                                            }`}
                                    >
                                        <Car className={`h-8 w-8 mb-3 ${selectedService === 'vehicle' ? 'text-orange-400' : 'text-slate-500'}`} />
                                        <h3 className="font-bold text-white text-base">Vehicle Hire</h3>
                                        <p className="text-xs text-slate-400 mt-1">Private cars, SUVs, or haulage trucks.</p>
                                    </div>
                                </CardContent>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <CardHeader>
                                    <CardTitle className="text-white text-2xl font-bold">Route & Pickup Details</CardTitle>
                                    <CardDescription className="text-slate-400">Enter pickup address and destination point.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300 text-xs font-semibold">Pickup Address</Label>
                                        <LocationSearchInput
                                            value={pickup}
                                            onChange={setPickup}
                                            isLoaded={isLoaded}
                                            placeholder="Search or enter pickup location..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-300 text-xs font-semibold">Dropoff Address</Label>
                                        <LocationSearchInput
                                            value={dropoff}
                                            onChange={setDropoff}
                                            isLoaded={isLoaded}
                                            placeholder="Search or enter dropoff location..."
                                        />
                                    </div>

                                    {selectedService === 'package' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-slate-300 text-xs font-semibold">Estimated Weight (kg)</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                className="h-12 bg-slate-900/80 border-slate-800 text-white rounded-xl"
                                                value={weight}
                                                onChange={(e) => setWeight(Number(e.target.value))}
                                            />
                                        </div>
                                    )}

                                    {selectedService === 'vehicle' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-slate-300 text-xs font-semibold">Vehicle Category</Label>
                                            <select
                                                className="flex h-12 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={vehicleCategory}
                                                onChange={(e) => setVehicleCategory(e.target.value)}
                                            >
                                                <option value="private">Private Sedan</option>
                                                <option value="suv">Executive SUV</option>
                                                <option value="truck">Commercial Cargo Truck</option>
                                            </select>
                                        </div>
                                    )}

                                    {(pickup || dropoff) && (
                                        <RouteVisualizer pickup={pickup} dropoff={dropoff} distanceKm={distanceKm} />
                                    )}
                                </CardContent>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <CardHeader>
                                    <CardTitle className="text-white text-2xl font-bold">Fare Review & Payment</CardTitle>
                                    <CardDescription className="text-slate-400">Review trip summary before launching checkout.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800/80 space-y-4">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-800/80 text-sm">
                                            <span className="text-slate-400">Service</span>
                                            <span className="font-bold text-white capitalize">{selectedService}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-800/80 text-sm">
                                            <span className="text-slate-400">Estimated Distance</span>
                                            <span className="font-mono text-slate-200">{distanceKm.toFixed(1)} km</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-base text-slate-300 font-semibold">Total Fare</span>
                                            <span className="text-3xl font-extrabold text-blue-400">₦{calculatedPrice.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-slate-300 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                                        <CreditCard className="h-5 w-5 text-blue-400 shrink-0" />
                                        <p>Redirecting to Paystack for secure instant checkout.</p>
                                    </div>
                                </CardContent>
                            </>
                        )}

                        <CardFooter className="flex justify-between border-t border-slate-800/80 pt-6">
                            <Button
                                variant="outline"
                                onClick={handleBackStep}
                                disabled={isSubmitting}
                                className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> {step === 1 ? 'Cancel' : 'Back'}
                            </Button>

                            {step < 3 ? (
                                <Button
                                    onClick={handleNextStep}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-xl"
                                >
                                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmitBooking}
                                    disabled={isSubmitting}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 rounded-xl"
                                >
                                    {isSubmitting ? 'Processing...' : `Pay ₦${calculatedPrice.toLocaleString()}`}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}