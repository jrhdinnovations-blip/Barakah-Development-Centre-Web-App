import { useState, useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Truck, PackageSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/my-swift-move')({
  component: CustomerBookingPage,
});

type LocationData = { address: string; lat: number; lng: number } | null;

function CustomerBookingPage() {
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;

  const [pickup, setPickup] = useState<LocationData>(null);
  const [dropoff, setDropoff] = useState<LocationData>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [fare, setFare] = useState<number>(0);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] || "",
    libraries: ["places"],
  });

  useEffect(() => {
    if (!isLoaded || !window.google) return;

    let pickupAutocomplete: google.maps.places.Autocomplete;
    let dropoffAutocomplete: google.maps.places.Autocomplete;

    if (pickupInputRef.current) {
      pickupAutocomplete = new window.google.maps.places.Autocomplete(pickupInputRef.current, {
        fields: ['formatted_address', 'geometry', 'name'],
      });
      pickupAutocomplete.addListener('place_changed', () => {
        const place = pickupAutocomplete.getPlace();
        if (place.geometry?.location) {
          setPickup({
            address: place.formatted_address || place.name || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }

    if (dropoffInputRef.current) {
      dropoffAutocomplete = new window.google.maps.places.Autocomplete(dropoffInputRef.current, {
        fields: ['formatted_address', 'geometry', 'name'],
      });
      dropoffAutocomplete.addListener('place_changed', () => {
        const place = dropoffAutocomplete.getPlace();
        if (place.geometry?.location) {
          setDropoff({
            address: place.formatted_address || place.name || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!pickup || !dropoff || !window.google) return;
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      { origin: pickup.address, destination: dropoff.address, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          const distanceMeters = result.routes?.[0]?.legs?.[0]?.distance?.value || 0;
          setFare(Math.round(1000 + (distanceMeters / 1000) * 150));
        } else {
          toast.error("Could not calculate route between these locations.");
        }
      }
    );
  }, [pickup, dropoff]);

  useEffect(() => {
    if (!activeOrder?.id) return;
    const channel = supabase.channel(`order-${activeOrder.id}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'enterprise_dispatches', filter: `id=eq.${activeOrder.id}` },
      (payload: any) => {
        setActiveOrder(payload.new);
        if (payload.new.status === 'driver_assigned') toast.success("Driver Assigned!");
        if (payload.new.status === 'delivered') {
          toast.success("Delivery Completed!");
          setTimeout(() => { setActiveOrder(null); setPickup(null); setDropoff(null); setDirections(null); }, 3000);
        }
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.id]);

  const handleBookDispatch = async () => {
    if (!pickup || !dropoff || !user?.id) return;
    setIsBooking(true);
    try {
      const { data, error } = await supabase.from('enterprise_dispatches').insert({
        customer_id: user.id,
        pickup_address: pickup.address,
        dropoff_address: dropoff.address,
        pickup_point: `POINT(${pickup.lng} ${pickup.lat})`,
        dropoff_point: `POINT(${dropoff.lng} ${dropoff.lat})`,
        fare_amount: fare,
        status: 'searching_for_driver'
      }).select().single();
      if (error) throw error;
      setActiveOrder(data);
    } catch (err: any) {
      toast.error("Booking failed: " + err.message);
    } finally {
      setIsBooking(false);
    }
  };

  if (!isLoaded) return <div className="min-h-dvh flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading Maps...</div>;

  return (
    <div className="flex flex-col md:flex-row min-h-dvh bg-slate-950">
      <div className="w-full md:w-[450px] bg-slate-950/90 border-r border-slate-800 p-6 flex flex-col z-20">
        <h1 className="text-3xl font-bold text-white mb-6">Book Dispatch</h1>

        {!activeOrder ? (
          <div className="space-y-6 flex-1">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Pickup Location</label>
              <input
                ref={pickupInputRef}
                type="text"
                placeholder="Enter pickup address..."
                className="flex h-12 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Dropoff Location</label>
              <input
                ref={dropoffInputRef}
                type="text"
                placeholder="Enter dropoff destination..."
                className="flex h-12 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {fare > 0 && (
              <div className="mt-auto pt-6 border-t border-slate-800">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4">
                  <p className="text-sm text-slate-400">Estimated Fare</p>
                  <p className="text-2xl font-bold text-white">₦{fare.toLocaleString()}</p>
                </div>
                <Button onClick={handleBookDispatch} disabled={isBooking} className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12">
                  {isBooking ? <Loader2 className="animate-spin" /> : 'Confirm Booking'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Card className="bg-slate-900 border-slate-800 p-6 mt-10">
            <div className="flex items-center gap-4">
              {activeOrder.status === 'searching_for_driver' ? (
                <PackageSearch className="h-8 w-8 text-blue-400 animate-pulse" />
              ) : (
                <Truck className="h-8 w-8 text-emerald-400" />
              )}
              <div>
                <h3 className="text-lg font-bold text-white">
                  {activeOrder.status === 'searching_for_driver' ? 'Scanning for Drivers...' : 'Driver Assigned'}
                </h3>
                <p className="text-slate-400 text-sm">Order: {activeOrder.id.split('-')[0]}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="flex-1 min-h-[50vh] relative bg-slate-900">
        <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={pickup || { lat: 9.0765, lng: 7.3986 }} zoom={13} options={{ disableDefaultUI: true }}>
          {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4 } }} />}
        </GoogleMap>
      </div>
    </div>
  );
}