import { useState } from 'react';
import { Package, Car, MapPin, Calendar, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { SwiftDelivery, VehicleHireBooking, DeliveryStatus, BookingStatus } from '@/types/database.types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ActiveBookingsProps {
    deliveries: SwiftDelivery[];
    vehicleBookings: VehicleHireBooking[];
    isLoading?: boolean;
}

// Helper to style delivery statuses
const getDeliveryBadge = (status: DeliveryStatus) => {
    switch (status) {
        case 'in_transit':
            return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">In Transit</Badge>;
        case 'assigned':
            return <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">Driver Assigned</Badge>;
        case 'pending':
            return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Pending</Badge>;
        case 'awaiting_payment':
            return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Awaiting Payment</Badge>;
        case 'delivered':
            return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Delivered</Badge>;
        case 'cancelled':
            return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Cancelled</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// Helper to style vehicle hire statuses
const getBookingBadge = (status: BookingStatus) => {
    switch (status) {
        case 'active':
            return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active Rental</Badge>;
        case 'booked':
            return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Reserved</Badge>;
        case 'awaiting_payment':
            return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Awaiting Payment</Badge>;
        case 'completed':
            return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Completed</Badge>;
        case 'cancelled':
            return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Cancelled</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

export function ActiveBookingsDashboard({ deliveries, vehicleBookings, isLoading }: ActiveBookingsProps) {
    const [activeTab, setActiveTab] = useState<'all' | 'deliveries' | 'vehicles'>('all');

    // Filter for active items only (excluding completed/cancelled)
    const activeDeliveries = deliveries.filter(d => !['delivered', 'cancelled'].includes(d.status));
    const activeVehicles = vehicleBookings.filter(v => !['completed', 'cancelled'].includes(v.status));

    const totalActive = activeDeliveries.length + activeVehicles.length;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Clock className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Active Operations</h2>
                    <p className="text-sm text-slate-400">Track your ongoing package deliveries and rides in real-time.</p>
                </div>

                <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        All ({totalActive})
                    </button>
                    <button
                        onClick={() => setActiveTab('deliveries')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'deliveries' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Deliveries ({activeDeliveries.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('vehicles')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'vehicles' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Rides ({activeVehicles.length})
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {totalActive === 0 && (
                <Card className="bg-slate-900/40 border-slate-800 py-12 text-center">
                    <CardContent className="space-y-3">
                        <div className="inline-flex p-3 rounded-full bg-slate-800/80 text-slate-400">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white">No active bookings found</h3>
                        <p className="text-sm text-slate-400 max-w-sm mx-auto">
                            You don't have any deliveries or rides in progress right now.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {/* Render Package Deliveries */}
                {(activeTab === 'all' || activeTab === 'deliveries') &&
                    activeDeliveries.map((delivery) => (
                        <Card key={delivery.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white">{delivery.package_type}</CardTitle>
                                        <CardDescription className="text-xs text-slate-500">
                                            Ref: {delivery.payment_reference || delivery.id.slice(0, 8)}
                                        </CardDescription>
                                    </div>
                                </div>
                                {getDeliveryBadge(delivery.status)}
                            </CardHeader>

                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2 text-sm bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                                    <div className="flex items-start gap-2 text-slate-300">
                                        <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <span className="truncate">{delivery.pickup_address}</span>
                                    </div>
                                    <div className="pl-6 text-xs text-slate-500">to</div>
                                    <div className="flex items-start gap-2 text-slate-300">
                                        <MapPin className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                                        <span className="truncate">{delivery.dropoff_address}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                                    <span>Weight: <strong className="text-slate-200">{delivery.weight_kg} kg</strong></span>
                                    <span>Distance: <strong className="text-slate-200">{delivery.distance_km} km</strong></span>
                                    <span className="text-base font-semibold text-blue-400">₦{delivery.estimated_price.toLocaleString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                {/* Render Vehicle Hire Bookings */}
                {(activeTab === 'all' || activeTab === 'vehicles') &&
                    activeVehicles.map((booking) => (
                        <Card key={booking.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg">
                                        <Car className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white capitalize">{booking.category} Hire</CardTitle>
                                        <CardDescription className="text-xs text-slate-500">
                                            {booking.duration_days} Day(s) • {booking.sub_category}
                                        </CardDescription>
                                    </div>
                                </div>
                                {getBookingBadge(booking.status)}
                            </CardHeader>

                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2 text-sm bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <MapPin className="h-4 w-4 text-orange-400 shrink-0" />
                                        <span className="truncate">{booking.pickup_location}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Starts: {new Date(booking.start_date).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                                    <span>Ref: <strong className="text-slate-300">{booking.payment_reference?.slice(-8) || 'N/A'}</strong></span>
                                    <span className="text-base font-semibold text-orange-400">₦{booking.total_price.toLocaleString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
            </div>
        </div>
    );
}