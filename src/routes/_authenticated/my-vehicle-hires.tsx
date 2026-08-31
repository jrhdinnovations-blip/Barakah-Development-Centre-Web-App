import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Car, Truck, Calendar, MapPin, Plus, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Route path updated to match file location (src/routes/my-vehicle-hires.tsx)
export const Route = createFileRoute('/_authenticated/my-vehicle-hires')({
    component: CustomerVehicleHiresDashboard,
});

interface VehicleBooking {
    id: string;
    category: string;
    sub_category: string;
    pickup_location: string;
    destination?: string;
    start_date: string;
    duration_days: number;
    total_price: number;
    status: string;
    payment_reference: string | null;
    created_at: string;
}

type FilterStatus = 'all' | 'active' | 'booked' | 'completed' | 'cancelled';

function CustomerVehicleHiresDashboard() {
    const { session, user } = useAuth() as any;
    const userId = user?.id || session?.user?.id;

    const [bookings, setBookings] = useState<VehicleBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

    const fetchBookings = async () => {
        if (!userId) return;
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('vehicle_hire_bookings')
                .select('*')
                .eq('customer_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBookings(data || []);
        } catch (err: any) {
            console.error('Error fetching vehicle bookings:', err);
            toast.error('Failed to load your vehicle hire history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [userId]);

    const handleCancelBooking = async (bookingId: string) => {
        try {
            const { error } = await supabase
                .from('vehicle_hire_bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

            if (error) throw error;

            toast.success('Vehicle booking cancelled.');
            fetchBookings();
        } catch (err: any) {
            toast.error(err.message || 'Failed to cancel booking.');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-600 hover:bg-green-700">Active Rental</Badge>;
            case 'booked':
                return <Badge className="bg-blue-600 hover:bg-blue-700">Confirmed / Scheduled</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatSubCategory = (subCat: string) => {
        return subCat
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Filter bookings client-side
    const filteredBookings = bookings.filter((booking) => {
        if (activeFilter === 'all') return true;
        return booking.status === activeFilter;
    });

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Vehicle Hire Bookings</h1>
                    <p className="text-muted-foreground">Manage private rides, VIP chauffeurs, and commercial truck rentals</p>
                </div>
                <Link to="/swift-move/new">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Book a Vehicle
                    </Button>
                </Link>
            </div>

            {/* Filter Tabs Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4 overflow-x-auto">
                <Tabs value={activeFilter} onValueChange={(val) => setActiveFilter(val as FilterStatus)}>
                    <TabsList className="grid grid-cols-5 w-full sm:w-auto">
                        <TabsTrigger value="all">
                            All ({bookings.length})
                        </TabsTrigger>
                        <TabsTrigger value="active">
                            Active ({bookings.filter(b => b.status === 'active').length})
                        </TabsTrigger>
                        <TabsTrigger value="booked">
                            Booked ({bookings.filter(b => b.status === 'booked').length})
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                            Completed ({bookings.filter(b => b.status === 'completed').length})
                        </TabsTrigger>
                        <TabsTrigger value="cancelled">
                            Cancelled ({bookings.filter(b => b.status === 'cancelled').length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {isLoading ? (
                <p className="text-center py-12 text-muted-foreground">Loading your rentals...</p>
            ) : filteredBookings.length === 0 ? (
                <Card className="text-center py-12 bg-card/60 backdrop-blur-sm border-border/40">
                    <CardContent className="space-y-4 pt-6">
                        <Car className="mx-auto h-12 w-12 text-muted-foreground/40" />
                        <h3 className="text-lg font-semibold">
                            {activeFilter === 'all' ? 'No vehicle hires found' : `No ${activeFilter} bookings`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {activeFilter === 'all'
                                ? "You haven't rented any private or commercial vehicles yet."
                                : `There are no rentals matching the "${activeFilter}" filter.`}
                        </p>
                        {activeFilter === 'all' && (
                            <Link to="/swift-move/new">
                                <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white">Explore Fleet & Rates</Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredBookings.map((booking) => {
                        const isPrivate = booking.category === 'private';
                        const IconComponent = isPrivate ? Car : Truck;

                        return (
                            <Card key={booking.id} className="shadow-md flex flex-col justify-between border-t-4 border-t-blue-600 bg-card/80 backdrop-blur-sm border-border/40">
                                <div>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                    <IconComponent className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base font-semibold">
                                                        {formatSubCategory(booking.sub_category)}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs capitalize">
                                                        {booking.category} Fleet Rental
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            {getStatusBadge(booking.status)}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4 pt-2">
                                        <div className="space-y-2.5 text-sm">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <span className="text-xs text-muted-foreground block">Dispatch / Pickup Location</span>
                                                    <span className="font-medium">{booking.pickup_location}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                                    <span>Start: {new Date(booking.start_date).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                    <span>Duration: {booking.duration_days} Day(s)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs bg-muted/40 p-3 rounded-md">
                                            <span className="text-muted-foreground">Total Paid:</span>
                                            <span className="font-bold text-base text-blue-500">₦{Number(booking.total_price || 0).toLocaleString()}</span>
                                        </div>
                                    </CardContent>
                                </div>

                                <CardFooter className="pt-3 pb-4 border-t border-border/40 bg-muted/10 flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground font-mono">
                                        Ref: {booking.payment_reference?.slice(0, 10) || booking.id.slice(0, 8)}
                                    </span>

                                    {booking.status === 'booked' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCancelBooking(booking.id)}
                                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/30"
                                        >
                                            Cancel Booking
                                        </Button>
                                    )}

                                    {booking.status === 'active' && (
                                        <span className="text-xs text-green-400 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                            <ShieldCheck className="h-3.5 w-3.5" /> Driver Assigned
                                        </span>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}