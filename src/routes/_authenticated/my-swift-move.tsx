import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useJsApiLoader,
} from '@react-google-maps/api';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { InteractiveMap } from '@/components/InteractiveMap';
import { toast } from 'sonner';
import {
  Loader2,
  MapPin,
  Navigation,
  Package,
  Weight,
  Banknote,
  Truck,
  CheckCircle2,
  ArrowRight,
  Info,
  ShieldCheck,
  PhoneCall,
  History,
  Clock,
  Search,
  X,
  RotateCcw,
  Copy,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  calculateDeliveryPrice,
  getPricingBreakdown,
} from '@/lib/swift-pricing';
import { POPULAR_DESTINATIONS } from '@/lib/ride-pricing';
import { calculateGoogleRoute, haversineKm, resolveAddressToCoordinates } from '@/lib/google-maps-client';
import { searchLocalLocations, resolveJosLocation } from '@/lib/location-suggestions';
import { encodeDispatchMetadata, parseOrderMetadata } from '@/lib/swift-order';
import { initializeSwiftPaystack } from '@/lib/payments.functions';
import {
  customerGetDispatchHistory,
  type CustomerDispatchRecord,
} from '@/lib/dispatcher.functions';

export const Route = createFileRoute('/_authenticated/my-swift-move')({
  ssr: false,
  component: CustomerBookingPage,
});

const googleLibraries: ("places")[] = ["places"];

type LocationData = { address: string; lat: number; lng: number } | null;

const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bae6fd' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};
const directionsOptions = {
  suppressMarkers: false,
  polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 0.85 },
};

function CustomerBookingPage() {
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;

  // Location state
  const [pickup, setPickup] = useState<LocationData>(null);
  const [dropoff, setDropoff] = useState<LocationData>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [mapDirections, setMapDirections] = useState<any>(null);
  const [mapError, setMapError] = useState(false);

  // Parcel & pricing state
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [parcelDescription, setParcelDescription] = useState('');
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationText, setDurationText] = useState<string>('');
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [fare, setFare] = useState<number>(0);

  // Jos, Plateau State, Nigeria default center
  const defaultCenter = { lat: 9.8965, lng: 8.8583 };
  const mapCenter = useMemo(() => {
    return pickup ? { lat: pickup.lat, lng: pickup.lng } : defaultCenter;
  }, [pickup?.lat, pickup?.lng]);

  // Order state
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'transfer' | null>('paystack');
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  // Rider assignment notification state (shown once dispatcher assigns)
  const [showRiderAssigned, setShowRiderAssigned] = useState(false);
  const [assignedRider, setAssignedRider] = useState<{
    name: string;
    phone: string;
    vehicleMake: string;
    plateNumber: string;
    rating: number;
    vehicleType: string;
  } | null>(null);
  // We store customer phone separately for the customer to share if needed
  const [customerOwnPhone, setCustomerOwnPhone] = useState<string | null>(null);

  // Fetch the logged-in user's own phone once on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.phone) setCustomerOwnPhone(data.phone); });
  }, [user?.id]);

  // Main Tab: 'dispatch' (book parcel) | 'history' (dispatch history)
  const [mainTab, setMainTab] = useState<'dispatch' | 'history'>('dispatch');
  const [dispatchHistory, setDispatchHistory] = useState<CustomerDispatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

  const fetchDispatchHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const res = await customerGetDispatchHistory({ data: { customerId: user.id } });
      if (res?.dispatches) {
        setDispatchHistory(res.dispatches);
      } else {
        setDispatchHistory([]);
      }
    } catch (err) {
      console.warn('[fetchDispatchHistory] server fn error, falling back to direct query:', err);
      try {
        const { data: deliveries } = await supabase
          .from('swift_deliveries')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        const mapped: CustomerDispatchRecord[] = (deliveries || [])
          .filter((d) => !parseOrderMetadata(d.package_type).isRide)
          .map((d) => {
            const meta = parseOrderMetadata(d.package_type);
            return {
              id: d.id,
              reference: d.payment_reference || `TRK-${d.id.slice(0, 8)}`,
              createdAt: d.created_at,
              status: d.status || 'pending',
              pickupAddress: d.pickup_address,
              dropoffAddress: d.dropoff_address,
              fare: d.estimated_price || 0,
              distanceKm: d.distance_km ?? undefined,
              weightKg: d.weight_kg ?? undefined,
              packageType: meta.tierName || 'Standard Parcel',
              description: meta.customerNotes || undefined,
              riderName: meta.driverName || null,
              riderPhone: meta.driverPhone || null,
              paymentMethod: (d as any).payment_method || null,
            };
          });
        setDispatchHistory(mapped);
      } catch (_) {}
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDispatchHistory();
    }
  }, [fetchDispatchHistory, user?.id]);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Refs for autocomplete inputs
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  // Load Maps API — but NEVER block the page on it
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] || '',
    libraries: googleLibraries,
  });

  // ─── Pipeline Step 3 & 4: Routes -> Distance + Duration (Instant 0ms + Async Refine) ───
  useEffect(() => {
    if (!pickup || !dropoff) {
      setMapDirections(null);
      setDistanceKm(0);
      setDurationText('');
      setRoutePolyline([]);
      setIsCalculatingRoute(false);
      return;
    }

    let isMounted = true;
    setIsCalculatingRoute(true);

    calculateGoogleRoute(
      { lat: pickup.lat, lng: pickup.lng },
      { lat: dropoff.lat, lng: dropoff.lng }
    )
      .then((routeResult) => {
        if (!isMounted) return;
        setDistanceKm(routeResult.distanceKm);
        setDurationText(routeResult.durationText);
        setRoutePolyline(routeResult.polylinePoints);
      })
      .catch(() => {
        if (!isMounted) return;
        const straightKm = haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
        const fallbackKm = Math.max(0.5, Math.round(straightKm * 1.35 * 10) / 10);
        setDistanceKm(fallbackKm);
        setDurationText(`~${Math.max(3, Math.ceil(fallbackKm * 2))} mins`);
        setRoutePolyline([
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ]);
      })
      .finally(() => {
        if (isMounted) setIsCalculatingRoute(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // ─── Pipeline Step 5: Recalculate fare when distance or weight changes ───
  useEffect(() => {
    if (distanceKm > 0 && weightKg && pickup && dropoff) {
      setFare(calculateDeliveryPrice(distanceKm, Number(weightKg)));
    } else {
      setFare(0);
    }
  }, [distanceKm, weightKg, pickup, dropoff]);

  // ─── Telemetry / real-time delivery status listener ───
  useEffect(() => {
    if (!activeOrder?.id) return;

    const handleOrderSync = (updated: any) => {
      if (!updated) return;
      setActiveOrder((prevOrder: any) => {
        // Trigger rider notification only when driver_id becomes populated and status turns 'accepted'
        if (
          updated.status === 'accepted' &&
          updated.driver_id &&
          (!prevOrder?.driver_id || prevOrder.driver_id !== updated.driver_id)
        ) {
          const meta = parseOrderMetadata(updated.package_type);
          const rider = {
            name: meta.driverName || 'SwiftMove Rider',
            phone: meta.driverPhone || '',
            vehicleMake: meta.vehicleMake || meta.tierName || 'Dispatch Vehicle',
            plateNumber: meta.plateNumber || '',
            rating: meta.driverRating || 5.0,
            vehicleType: meta.tierName || 'Motorcycle',
          };
          setAssignedRider(rider);
          setShowRiderAssigned(true);
          // Chime sound
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
          } catch {}
        }

        const s = updated.status;
        if (s === 'picked_up' && prevOrder?.status !== 'picked_up') toast.success('📦 Package collected — rider en route!');
        if (s === 'in_transit' && prevOrder?.status !== 'in_transit') toast.info('🚚 Your parcel is on its way!');
        if (s === 'delivered' && prevOrder?.status !== 'delivered') {
          toast.success('✅ Delivery completed!');
          setShowDelivered(true);
        }

        return updated;
      });
    };

    // Immediate initial poll
    const pollOrder = async () => {
      const { data } = await supabase
        .from('swift_deliveries')
        .select('*')
        .eq('id', activeOrder.id)
        .maybeSingle();
      if (data) handleOrderSync(data);
    };

    const channel = supabase
      .channel(`delivery-track-${activeOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'swift_deliveries',
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload: any) => {
          handleOrderSync(payload.new);
        }
      )
      .subscribe();

    const interval = setInterval(pollOrder, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeOrder?.id]);

  // ─── Proceed from Step 1 (Locations) to Step 2 (Parcel Details) ───
  const handleProceedToParcelDetails = async () => {
    const rawPickup = pickupText.trim();
    const rawDropoff = dropoffText.trim();

    if (!rawPickup || !rawDropoff) {
      toast.error('Please enter both pickup and destination addresses');
      return;
    }

    setIsCalculatingRoute(true);
    try {
      let activePickup = pickup;
      let activeDropoff = dropoff;

      if (!activePickup) {
        const match = resolveJosLocation(rawPickup);
        if (match && match.lat && match.lng) {
          activePickup = { address: `${match.label}, ${match.sublabel}`, lat: match.lat, lng: match.lng };
        } else {
          const geo = await resolveAddressToCoordinates(rawPickup).catch(() => null);
          if (geo && geo.lat && geo.lng) {
            activePickup = { address: geo.address, lat: geo.lat, lng: geo.lng };
          }
        }
        if (activePickup) setPickup(activePickup);
      }

      if (!activeDropoff) {
        const match = resolveJosLocation(rawDropoff);
        if (match && match.lat && match.lng) {
          activeDropoff = { address: `${match.label}, ${match.sublabel}`, lat: match.lat, lng: match.lng };
        } else {
          const geo = await resolveAddressToCoordinates(rawDropoff).catch(() => null);
          if (geo && geo.lat && geo.lng) {
            activeDropoff = { address: geo.address, lat: geo.lat, lng: geo.lng };
          }
        }
        if (activeDropoff) setDropoff(activeDropoff);
      }

      if (!activePickup) {
        toast.error('Could not locate pickup address. Please select a recognized Jos location.');
        return;
      }
      if (!activeDropoff) {
        toast.error('Could not locate delivery address. Please select a recognized Jos location.');
        return;
      }

      // 3. Accurate road route calculation guarantees accurate road distance
      if (activePickup && activeDropoff) {
        try {
          const routeResult = await calculateGoogleRoute(
            { lat: activePickup.lat, lng: activePickup.lng },
            { lat: activeDropoff.lat, lng: activeDropoff.lng }
          );
          if (routeResult && routeResult.distanceKm > 0) {
            setDistanceKm(routeResult.distanceKm);
            setDurationText(routeResult.durationText);
            setRoutePolyline(routeResult.polylinePoints);
          }
        } catch (_) {
          const straightKm = haversineKm(activePickup.lat, activePickup.lng, activeDropoff.lat, activeDropoff.lng);
          const fallbackKm = Math.max(0.5, Math.round(straightKm * 1.35 * 10) / 10);
          setDistanceKm(fallbackKm);
          setDurationText(`~${Math.max(3, Math.ceil(fallbackKm * 2))} mins`);
          setRoutePolyline([
            [activePickup.lat, activePickup.lng],
            [activeDropoff.lat, activeDropoff.lng],
          ]);
        }
      }

      setStep(2);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // ─── Book dispatch ───
  const handleBookDispatch = () => {
    if (!pickup || !dropoff || !user?.id) return;
    if (distanceKm <= 0) {
      toast.error('Please wait for the route to be calculated.');
      return;
    }
    setShowPayment(true);
  };

  const handleCancelOrder = async () => {
    if (!activeOrder?.id) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('swift_deliveries')
        .update({ status: 'cancelled' })
        .eq('id', activeOrder.id)
        .eq('status', 'pending');
      if (error) throw error;
      toast.success('Order cancelled.');
      handleReset();
    } catch (e: any) {
      toast.error(e.message || 'Cannot cancel an order already in progress.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReset = useCallback(() => {
    setPickup(null);
    setDropoff(null);
    setPickupText('');
    setDropoffText('');
    setMapDirections(null);
    setDistanceKm(0);
    setDurationText('');
    setFare(0);
    setWeightKg('');
    setParcelDescription('');
    setActiveOrder(null);
    setStep(1);
    setShowDelivered(false);
    setShowPayment(false);
    setPaymentMethod(null);
    setPaymentDone(false);
    if (pickupInputRef.current) pickupInputRef.current.value = '';
    if (dropoffInputRef.current) dropoffInputRef.current.value = '';
  }, []);

  // ─── Confirm payment ───
  const handleConfirmPayment = async () => {
    if (!paymentMethod) return;
    setIsConfirmingPayment(true);
    try {
      if (activeOrder?.id) {
        // Order already exists — Paystack redirect for payment
        if (paymentMethod === 'paystack') {
          toast.loading('Connecting to Paystack...', { id: 'paystack-init' });
          try {
            const paystackInit = await initializeSwiftPaystack({
              data: {
                entityType: 'swift_delivery',
                entityId: activeOrder.id,
                amountKobo: Math.round((activeOrder.estimated_price || fare) * 100),
                description: `SwiftMove: ${pickup?.address || ''} → ${dropoff?.address || ''}`,
                callbackPath: '/my-swift-move',
              },
            });
            if (paystackInit?.authorizationUrl) {
              toast.success('Redirecting to Paystack...', { id: 'paystack-init' });
              window.location.href = paystackInit.authorizationUrl;
              return;
            }
            toast.error('Could not get Paystack payment link.', { id: 'paystack-init' });
          } catch (payErr: any) {
            toast.error(payErr.message || 'Could not connect to Paystack.', { id: 'paystack-init' });
          }
        } else {
          // Bank transfer — mark payment as confirmed; dispatcher will assign a rider
          // Do NOT mark as delivered — keep as 'pending' so it appears in dispatcher queue
          setPaymentDone(true);
          toast.success('Payment recorded! Sending your order to the dispatcher...');
        }
      } else {
        // No active order yet — create order first then redirect/confirm
        const trackingId = `TRK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        let customerPhone: string | null = null;

        const { data: profData } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (profData?.phone) {
          customerPhone = profData.phone;
        } else {
          customerPhone = user?.user_metadata?.phone || null;
        }

        const embeddedPackageType = encodeDispatchMetadata({
          cargoType: 'Dispatch Parcel',
          description: parcelDescription,
          customerPhone,
        });

        const { data, error } = await supabase
          .from('swift_deliveries')
          .insert({
            customer_id: user?.id || '',
            pickup_address: pickup?.address || '',
            dropoff_address: dropoff?.address || '',
            package_type: embeddedPackageType,
            weight_kg: Number(weightKg) || 1,
            distance_km: distanceKm,
            estimated_price: fare,
            payment_reference: trackingId,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        setActiveOrder(data);

        if (paymentMethod === 'paystack') {
          toast.loading('Connecting to Paystack...', { id: 'paystack-init' });
          try {
            const paystackInit = await initializeSwiftPaystack({
              data: {
                entityType: 'swift_delivery',
                entityId: data.id,
                amountKobo: Math.round(fare * 100),
                description: `SwiftMove: ${pickup?.address || ''} → ${dropoff?.address || ''}`,
                callbackPath: '/my-swift-move',
              },
            });
            if (paystackInit?.authorizationUrl) {
              toast.success('Redirecting to Paystack...', { id: 'paystack-init' });
              window.location.href = paystackInit.authorizationUrl;
              return;
            }
            toast.error('Could not get Paystack payment link.', { id: 'paystack-init' });
          } catch (payErr: any) {
            toast.error(payErr.message || 'Could not connect to Paystack.', { id: 'paystack-init' });
          }
        } else {
          // Bank transfer: keep order as 'pending' in dispatcher queue
          setPaymentDone(true);
          toast.success('Payment recorded! The dispatcher will assign a rider shortly.');
        }
      }
    } catch (err: any) {
      toast.error('Payment failed: ' + err.message);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const breakdown = fare > 0 ? getPricingBreakdown(distanceKm, Number(weightKg) || 1) : null;
  // Form is complete only when all 4 inputs are provided
  const isFormComplete = !!(pickup && dropoff && weightKg && parcelDescription.trim());
  // Show pricing on step 3 — distance is always >0 by the time user reaches step 3
  const showMap = mapsLoaded && !mapError;

  // ── Dispatch History Tab Render ──────────────────────────────────────────
  const renderDispatchHistory = () => {
    const q = historySearch.toLowerCase().trim();
    const filtered = dispatchHistory.filter((d) => {
      const matchesSearch =
        !q ||
        (d.pickupAddress && d.pickupAddress.toLowerCase().includes(q)) ||
        (d.dropoffAddress && d.dropoffAddress.toLowerCase().includes(q)) ||
        (d.reference && d.reference.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.riderName && d.riderName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (historyFilter === 'delivered') return d.status === 'delivered' || d.status === 'completed';
      if (historyFilter === 'active') return ['in_transit', 'accepted', 'assigned', 'pending', 'picked_up'].includes(d.status);
      if (historyFilter === 'cancelled') return d.status === 'cancelled';
      return true;
    });

    const deliveredCount = dispatchHistory.filter((d) => d.status === 'delivered' || d.status === 'completed').length;
    const activeCount = dispatchHistory.filter((d) => ['in_transit', 'accepted', 'assigned', 'pending', 'picked_up'].includes(d.status)).length;
    const cancelledCount = dispatchHistory.filter((d) => d.status === 'cancelled').length;

    return (
      <div className="space-y-4">
        {/* Search & Filter Header */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tracking ref, address, rider..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800 placeholder:text-slate-400"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
            {[
              { key: 'all', label: 'All Dispatches', count: dispatchHistory.length },
              { key: 'active', label: 'In Transit', count: activeCount },
              { key: 'delivered', label: 'Delivered', count: deliveredCount },
              { key: 'cancelled', label: 'Cancelled', count: cancelledCount },
            ].map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setHistoryFilter(pill.key as any)}
                className={`px-3 py-1 rounded-lg font-medium text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  historyFilter === pill.key
                    ? 'bg-orange-600 text-white font-bold shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`text-[10px] ${historyFilter === pill.key ? 'text-orange-100' : 'text-slate-400'}`}>
                  ({pill.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading your dispatch records...</p>
          </div>
        ) : dispatchHistory.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto text-orange-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Dispatches Yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Send packages, goods, or documents across the city with SwiftMove.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMainTab('dispatch')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              Send a Parcel Now
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-500">No dispatches match your search or filter.</p>
            <button
              type="button"
              onClick={() => {
                setHistoryFilter('all');
                setHistorySearch('');
              }}
              className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isDelivered = item.status === 'delivered' || item.status === 'completed';
              const isLive = ['in_transit', 'accepted', 'assigned', 'picked_up', 'pending'].includes(item.status);
              const isCancel = item.status === 'cancelled';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl bg-white border transition-all shadow-sm space-y-3 ${
                    isLive ? 'border-orange-300 ring-1 ring-orange-400/30' : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Top: Tracking Ref & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate block">
                          {item.packageType || 'Parcel Delivery'}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {item.reference}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.reference);
                              toast.success('Tracking reference copied!');
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            title="Copy tracking code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                        isDelivered
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isLive
                          ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                          : isCancel
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>

                  {/* Description / Weight */}
                  {(item.description || item.weightKg) && (
                    <div className="text-[11px] text-slate-600 bg-amber-50/50 px-2.5 py-1.5 rounded-lg border border-amber-100 flex items-center gap-2">
                      {item.weightKg ? (
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Weight className="w-3 h-3 text-orange-500" />
                          {item.weightKg} kg
                        </span>
                      ) : null}
                      {item.description ? (
                        <span className="truncate text-slate-600">{item.description}</span>
                      ) : null}
                    </div>
                  )}

                  {/* Route (Pickup → Delivery) */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0" />
                      <span className="truncate text-slate-800 font-medium">{item.pickupAddress}</span>
                    </div>
                    {item.dropoffAddress && (
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1 shrink-0" />
                        <span className="truncate text-slate-700">{item.dropoffAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Rider Info if assigned */}
                  {item.riderName && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Truck className="w-3.5 h-3.5 text-orange-500" />
                        <span className="font-semibold">{item.riderName}</span>
                      </div>
                      {item.riderPhone && (
                        <a
                          href={`tel:${item.riderPhone}`}
                          className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-0.5"
                        >
                          <PhoneCall className="w-3 h-3" /> Call Rider
                        </a>
                      )}
                    </div>
                  )}

                  {/* Bottom Row: Date & Fare */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900">
                        ₦{Number(item.fare).toLocaleString()}
                      </span>

                      {isLive ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { data: fullOrder } = await supabase
                                .from('swift_deliveries')
                                .select('*')
                                .eq('id', item.id)
                                .maybeSingle();
                              if (fullOrder) {
                                setActiveOrder(fullOrder);
                                setPickupText(fullOrder.pickup_address);
                                setDropoffText(fullOrder.dropoff_address);
                                const pMatch = resolveJosLocation(fullOrder.pickup_address);
                                if (pMatch?.lat && pMatch?.lng) {
                                  setPickup({ address: fullOrder.pickup_address, lat: pMatch.lat, lng: pMatch.lng });
                                }
                                const dMatch = resolveJosLocation(fullOrder.dropoff_address);
                                if (dMatch?.lat && dMatch?.lng) {
                                  setDropoff({ address: fullOrder.dropoff_address, lat: dMatch.lat, lng: dMatch.lng });
                                }
                                setMainTab('dispatch');
                              }
                            } catch (err) {
                              toast.error('Could not load live order.');
                            }
                          }}
                          className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                        >
                          Track Live →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPickupText(item.pickupAddress);
                            setDropoffText(item.dropoffAddress);
                            const pMatch = resolveJosLocation(item.pickupAddress);
                            if (pMatch?.lat && pMatch?.lng) {
                              setPickup({ address: item.pickupAddress, lat: pMatch.lat, lng: pMatch.lng });
                            }
                            const dMatch = resolveJosLocation(item.dropoffAddress);
                            if (dMatch?.lat && dMatch?.lng) {
                              setDropoff({ address: item.dropoffAddress, lat: dMatch.lat, lng: dMatch.lng });
                            }
                            if (item.weightKg) setWeightKg(item.weightKg);
                            if (item.description) setParcelDescription(item.description);
                            setMainTab('dispatch');
                            setStep(1);
                            toast.success('Addresses loaded! Click continue to proceed.');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                          title="Send another parcel with this route"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Send Similar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-dvh bg-slate-100 overflow-hidden flex flex-col md:flex-row">

      {/* ═══════════ PAYMENT MODAL OVERLAY ═══════════ */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-[28px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            
            {paymentDone ? (
              /* ——— Payment Confirmed: Awaiting Dispatcher Assignment ——— */
              <div className="p-8 flex flex-col items-center text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Payment Verified! 🎉</h2>
                  <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                    Your order is now in the dispatcher queue.
                    <br />
                    <span className="text-orange-600 font-semibold">
                      You’ll get a notification once a rider is assigned.
                    </span>
                  </p>
                </div>
                <div className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-2xl">📡</span>
                  <div className="text-left">
                    <p className="text-amber-800 font-bold text-sm">Dispatcher on standby</p>
                    <p className="text-amber-700/80 text-xs mt-0.5">A rider will be assigned and you’ll be notified instantly.</p>
                  </div>
                </div>
                <Button
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl"
                  onClick={() => setShowPayment(false)}
                >
                  Close & Track My Order
                </Button>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Due</p>
                    <p className="text-3xl font-black text-slate-900">₦{(activeOrder?.estimated_price || fare).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => { setShowPayment(false); setPaymentMethod(null); }}
                    className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Payment Method Selection */}
                <div className="p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Choose Payment Method</p>

                  {/* Paystack Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paystack')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      paymentMethod === 'paystack'
                        ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-xl">💳</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">Paystack Checkout</p>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">Instant</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Debit Card, Instant Bank Transfer, USSD</p>
                    </div>
                    {paymentMethod === 'paystack' && <CheckCircle2 className="h-5 w-5 text-emerald-600 ml-auto shrink-0" />}
                  </button>

                  {/* Bank Transfer Option */}
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-orange-50/80 border-orange-500 ring-1 ring-orange-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <span className="text-xl">🏦</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">Bank Transfer</p>
                      <p className="text-[11px] text-slate-500">Transfer to driver's account</p>
                    </div>
                    {paymentMethod === 'transfer' && <CheckCircle2 className="h-5 w-5 text-orange-600 ml-auto shrink-0" />}
                  </button>

                  {/* Transfer Details (shown when transfer is selected) */}
                  {paymentMethod === 'transfer' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      {/* Account Details Card */}
                      <div className="bg-orange-50/70 border border-orange-200/90 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">SwiftMove Account Details</p>

                        {/* Zenith Bank Account */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Zenith Bank</p>
                            <p className="text-xl font-black text-slate-900 tracking-widest">1310765201</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('1310765201');
                              toast.success('Zenith Bank account number copied!');
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 border border-orange-200 text-orange-800 text-[11px] font-bold transition-all active:scale-95"
                          >
                            Copy
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-orange-100" />

                        {/* Moniepoint Account */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Moniepoint</p>
                            <p className="text-xl font-black text-slate-900 tracking-widest">7066252731</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('7066252731');
                              toast.success('Moniepoint account number copied!');
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 border border-orange-200 text-orange-800 text-[11px] font-bold transition-all active:scale-95"
                          >
                            Copy
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-orange-100" />

                        {/* Account Name */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 text-[11px]">Account Name</span>
                          <span className="text-slate-900 font-bold">SwiftMove Logistics</span>
                        </div>

                        {/* Amount */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 text-[11px]">Amount to Transfer</span>
                          <span className="text-orange-600 font-black text-base">
                            ₦{(activeOrder?.estimated_price || fare).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp CTA */}
                      <a
                        href={`https://wa.me/2347044223076?text=${encodeURIComponent(
                          `Hello SwiftMove! I've just made a bank transfer of ₦${(activeOrder?.estimated_price || fare).toLocaleString()} to SwiftMove Logistics (Zenith: 1310765201 / Moniepoint: 7066252731). Please find my payment receipt attached. Order reference: ${activeOrder?.payment_reference || 'pending'}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#15803d] font-bold text-sm transition-all active:scale-[0.98]"
                      >
                        <span className="text-lg">💬</span>
                        Send Receipt on WhatsApp
                      </a>

                      {/* Call Us */}
                      <a
                        href="tel:+2347041626545"
                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-sm transition-all active:scale-[0.98]"
                      >
                        <span className="text-lg">📞</span>
                        Call Us: 07041626545
                      </a>

                      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                        After transferring, send your receipt via WhatsApp or call us to confirm.<br />
                        Your order will be activated once payment is verified.
                      </p>
                    </div>
                  )}

                </div>

                {/* Confirm Button */}
                <div className="px-5 pb-5">
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={!paymentMethod || isConfirmingPayment}
                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl disabled:opacity-40 transition-all"
                  >
                    {isConfirmingPayment
                      ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Connecting…</>
                      : paymentMethod === 'paystack'
                        ? `Pay ₦${(activeOrder?.estimated_price || fare).toLocaleString()} with Paystack`
                        : `Confirm ₦${(activeOrder?.estimated_price || fare).toLocaleString()} Payment`
                    }
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* ═══════════ RIDER ASSIGNED NOTIFICATION MODAL ═══════════ */}
      {showRiderAssigned && assignedRider && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white border border-emerald-300 rounded-[32px] overflow-hidden shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-300">
            {/* Celebration Header */}
            <div className="relative overflow-hidden p-6 text-center border-b border-emerald-100">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-orange-500/5 pointer-events-none" />
              <div className="relative">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-black text-slate-900">Rider Assigned!</h2>
                <p className="text-emerald-700 text-sm font-semibold mt-1">
                  {assignedRider.name} is heading to your pickup!
                </p>
              </div>
            </div>

            {/* Rider Details Card */}
            <div className="p-5 space-y-4">
              {/* Rider Profile Row */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg shadow-orange-500/20">
                  {assignedRider.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-base truncate">{assignedRider.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-amber-500 text-sm">★</span>
                    <span className="text-slate-800 text-sm font-bold">{assignedRider.rating.toFixed(1)}</span>
                    <span className="text-slate-500 text-xs">· Verified SwiftMove Rider</span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Plate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">🚗 Vehicle</p>
                  <p className="text-slate-900 font-bold text-sm">{assignedRider.vehicleMake}</p>
                  {assignedRider.vehicleType && assignedRider.vehicleType !== assignedRider.vehicleMake && (
                    <p className="text-slate-500 text-[11px] mt-0.5">{assignedRider.vehicleType}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">🪪 Plate No.</p>
                  <p className="text-orange-600 font-black text-sm font-mono">{assignedRider.plateNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Call Button */}
              {assignedRider.phone ? (
                <a
                  href={`tel:${assignedRider.phone}`}
                  className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-black text-sm rounded-2xl transition-all active:scale-[0.98]"
                >
                  <PhoneCall className="h-5 w-5" />
                  Call {assignedRider.name.split(' ')[0]} — {assignedRider.phone}
                </a>
              ) : null}

              {/* Close Button */}
              <Button
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl"
                onClick={() => setShowRiderAssigned(false)}
              >
                Got it! Track My Parcel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BACKGROUND: LIVE INTERACTIVE MAP (Zero-Watermark, Live GPS) ═══════════ */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          pickup={pickup}
          dropoff={dropoff}
          center={mapCenter}
          zoom={pickup ? 14 : 12}
          routePolyline={routePolyline}
        />
        
        {/* Soft light gradient overlay so the floating card stands out */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-slate-100/95 via-slate-100/75 to-transparent lg:w-3/5" />
      </div>

      {/* ═══════════ FOREGROUND: FLOATING BOOKING CARD ═══════════ */}
      <div className="relative z-10 w-full lg:w-[460px] flex flex-col p-4 md:p-6 lg:p-8 h-[100dvh] overflow-hidden pointer-events-none">
        <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-[32px] shadow-2xl flex flex-col flex-1 pointer-events-auto overflow-hidden">
          
          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            {/* Top Tabs: Book Dispatch vs Dispatch History */}
            {!activeOrder && (
              <div className="flex rounded-xl bg-slate-100 border border-slate-200 p-1 mb-1">
                <button
                  type="button"
                  onClick={() => setMainTab('dispatch')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mainTab === 'dispatch'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Send a Parcel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMainTab('history');
                    fetchDispatchHistory();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mainTab === 'history'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Dispatch History</span>
                  {dispatchHistory.length > 0 && (
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                        mainTab === 'history' ? 'bg-orange-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {dispatchHistory.length > 9 ? '9+' : dispatchHistory.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {!activeOrder && mainTab === 'history' ? (
              renderDispatchHistory()
            ) : (
              <>
            {/* Header */}
            {!activeOrder ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-600">
                    <Package className="h-3.5 w-3.5" /> Express Delivery
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">Send a Parcel</h1>
                  <p className="text-xs text-slate-500 font-medium mt-1">Fast, reliable dispatch across the city.</p>
                </div>

                {/* Step Progress */}
                <div className="flex items-center gap-2">
                  {[{ n: 1, label: 'Locations' }, { n: 2, label: 'Parcel' }, { n: 3, label: 'Review' }].map(({ n, label }, idx) => (
                    <div key={n} className="flex items-center gap-2 flex-1">
                      <div className={`flex items-center gap-1.5 ${step === n ? 'text-slate-900' : step > n ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                          step === n ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                          : step > n ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}>
                          {step > n ? '✓' : n}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide hidden sm:block">{label}</span>
                      </div>
                      {idx < 2 && <div className={`flex-1 h-[2px] rounded-full transition-all ${step > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-600">
                  <Truck className="h-3.5 w-3.5" /> Live Tracking
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">Order Dispatched</h1>
                <p className="text-xs text-slate-500 font-medium">Your parcel is being handled by SwiftMove.</p>
              </div>
            )}

            {!activeOrder ? (
              <div className="space-y-6">
                
                {/* ═══ STEP 1: LOCATIONS ═══ */}
                {step === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="relative space-y-4">
                      {/* Vertical connecting line */}
                      <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-slate-200 rounded-full z-0" />
                      
                      {/* Pickup Input with Live GPS & Real-time Suggestions */}
                      <div className="relative z-30">
                        <LocationSearchInput
                          label="Where from?"
                          placeholder="Enter pickup location (e.g. Terminus, Rayfield, UNIJOS)…"
                          value={pickupText}
                          onChange={(val) => {
                            setPickupText(val);
                            if (!val.trim()) setPickup(null);
                          }}
                          onSelectLocation={(loc, isExplicit) => {
                            setPickup(loc);
                            if (isExplicit) {
                              setPickupText(loc.address);
                            }
                          }}
                          iconVariant="pickup"
                          showGpsButton={true}
                          mapsLoaded={mapsLoaded}
                          inputRef={pickupInputRef}
                        />
                      </div>

                      {/* Dropoff Input with Real-time Suggestions */}
                      <div className="relative z-20">
                        <LocationSearchInput
                          label="Where to?"
                          placeholder="Enter dropoff destination (e.g. Airport, Bukuru, JUTH)…"
                          value={dropoffText}
                          onChange={(val) => {
                            setDropoffText(val);
                            if (!val.trim()) setDropoff(null);
                          }}
                          onSelectLocation={(loc, isExplicit) => {
                            setDropoff(loc);
                            if (isExplicit) {
                              setDropoffText(loc.address);
                            }
                          }}
                          iconVariant="dropoff"
                          mapsLoaded={mapsLoaded}
                          inputRef={dropoffInputRef}
                        />
                      </div>

                      {/* Popular Jos Destinations Chips */}
                      <div className="relative z-10 space-y-2 pt-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Popular Jos Destinations</p>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_DESTINATIONS.map((dest) => (
                            <button
                              key={dest.label}
                              type="button"
                              onClick={() => {
                                const full = `${dest.name}, ${dest.address}`;
                                setDropoff({ address: full, lat: dest.lat, lng: dest.lng });
                                setDropoffText(dest.name);
                                if (!pickup) {
                                  const term = { address: 'Jos Main Market / Terminus, Jos', lat: 9.9248, lng: 8.8912 };
                                  setPickup(term);
                                  setPickupText('Jos Main Market / Terminus');
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-950 transition-all text-left active:scale-95"
                            >
                              <span>{dest.iconEmoji}</span>
                              <span>{dest.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Route Details Banner */}
                    {distanceKm > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs animate-in fade-in-0 duration-200">
                        <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                          <span>🛣️</span> Road Distance: <strong className="text-slate-900">{distanceKm} km</strong>
                        </span>
                        {durationText && (
                          <span className="text-orange-600 font-semibold flex items-center gap-1">
                            <span>⏱️</span> {durationText}
                          </span>
                        )}
                      </div>
                    )}

                    {isCalculatingRoute && distanceKm <= 0 && (
                      <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-orange-600">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                        <span>Calculating road route & distance…</span>
                      </div>
                    )}

                    {(() => {
                      const isStep1Ready = (!!pickup || !!pickupText.trim()) && (!!dropoff || !!dropoffText.trim());
                      return (
                        <Button
                          onClick={handleProceedToParcelDetails}
                          disabled={!isStep1Ready}
                          className={`w-full h-14 text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                            isStep1Ready
                              ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.01] active:scale-[0.99] border border-orange-400/30 cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60 shadow-none'
                          }`}
                        >
                          {isCalculatingRoute ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                              <span>Pinpointing & Calculating Route…</span>
                            </>
                          ) : (
                            <>
                              <span>Next: Parcel Details</span>
                              <ArrowRight className="h-5 w-5" />
                            </>
                          )}
                        </Button>
                      );
                    })()}
                  </div>
                )}

                {/* ═══ STEP 2: PARCEL DETAILS ═══ */}
                {step === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      {/* Weight */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ml-2">
                          <Weight className="h-3 w-3" /> Estimated Weight (kg)
                        </label>
                        <div className="relative">
                          <input type="number" min={0.5} max={500} step={0.5} value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g., 2.5 kg"
                            className="w-full h-14 pl-10 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                          />
                          <Package className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ml-2">
                          <Info className="h-3 w-3" /> What are you sending? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={parcelDescription}
                          onChange={(e) => setParcelDescription(e.target.value)}
                          placeholder="Describe the items securely..."
                          className="w-full h-24 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)} className="h-14 px-6 border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl">
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(3)}
                        disabled={!weightKg || !parcelDescription.trim()}
                        className="flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-xl shadow-md transition-all"
                      >
                        Review Fare & Book
                      </Button>
                    </div>
                  </div>
                )}

                {/* ═══ STEP 3: REVIEW & BOOK ═══ */}
                {step === 3 && isFormComplete && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-slate-50 rounded-[24px] border border-slate-200/90 p-6 space-y-5 shadow-sm">
                      
                      {/* Price header */}
                      <div className="flex justify-between items-end border-b border-slate-200/80 pb-5">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Guaranteed Fare</p>
                          <span className="text-4xl font-black text-slate-900">₦{breakdown?.total.toLocaleString()}</span>
                        </div>
                        <div className="text-right pb-1">
                          {durationText && (
                            <p className="text-sm text-emerald-600 font-semibold mb-1">~{durationText} delivery</p>
                          )}
                          <p className="text-xs text-slate-500 font-medium">{distanceKm} km • {weightKg} kg</p>
                        </div>
                      </div>

                      {/* Transparent Fare Breakdown (Price per km & kg) */}
                      {breakdown && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2.5 text-xs shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fare Breakdown</p>
                          
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span>🏁</span> Base Dispatch Fare
                            </span>
                            <span className="font-semibold text-slate-900">₦{breakdown.baseFare.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span>🛣️</span> Distance ({breakdown.distanceKm} km @ ₦{breakdown.ratePerKm}/km)
                            </span>
                            <span className="font-semibold text-slate-900">₦{breakdown.distanceCost.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span>⚖️</span> Weight ({breakdown.weightKg} kg @ ₦{breakdown.ratePerKg}/kg)
                            </span>
                            <span className="font-semibold text-slate-900">₦{breakdown.weightCost.toLocaleString()}</span>
                          </div>

                          {breakdown.subtotal < breakdown.minFare && (
                            <div className="flex justify-between items-center text-amber-700 pt-1 border-t border-slate-100 text-[11px]">
                              <span>Minimum Fare Threshold Applied</span>
                              <span className="font-semibold">₦{breakdown.minFare.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Trust Signals */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-800">100% Safe & Verified Drivers</p>
                            <p className="text-[10px] text-emerald-700/80">Every dispatch rider is fully vetted by SwiftMove.</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200/80 p-3 rounded-xl">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <Banknote className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-amber-800">Secure Upfront Payment</p>
                            <p className="text-[10px] text-amber-700/80">Pay securely now. Drivers receive request upon verification.</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={handleBookDispatch}
                          disabled={isBooking}
                          className="w-full h-14 bg-orange-600 hover:bg-orange-500 text-white text-sm font-black rounded-xl shadow-lg shadow-orange-500/25 transition-all"
                        >
                          {isBooking ? (
                            <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Preparing Payment…</>
                          ) : (
                            <><Banknote className="mr-2 h-5 w-5" /> Pay & Request Dispatch</>
                          )}
                        </Button>
                        <Button variant="ghost" onClick={() => setStep(2)} disabled={isBooking} className="w-full mt-2 text-slate-500 hover:text-slate-900">
                          Make Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : showDelivered ? (
              /* ═══ Delivery Celebration ═══ */
              <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Delivered! 🎉</h2>
                  <p className="text-slate-500 text-sm mt-1">Your package has arrived safely.</p>
                </div>
                
                <div className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                  <p className="text-emerald-700 font-bold text-sm">Final Fare</p>
                  <p className="text-3xl font-black text-slate-900">₦{(activeOrder?.estimated_price || 0).toLocaleString()} </p>
                  <p className="text-slate-500 text-xs mt-2">Payment was verified upfront.</p>
                  <p className="text-slate-700 text-sm mt-4 font-semibold">Receipt & Driver Earnings Sent.</p>
                </div>
                
                <Button variant="ghost" className="text-slate-500 hover:text-slate-900"
                  onClick={() => { setShowDelivered(false); handleReset(); }}>
                  Book Another Dispatch
                </Button>
              </div>
            ) : (
              /* ═══════════ Active Order Tracking ═══════════ */
              <div className="space-y-6 py-2 animate-in slide-in-from-right-4 duration-500">
                {/* Status Banner */}
                <div className={`rounded-2xl p-4 flex items-center gap-4 border ${
                  activeOrder.status === 'pending'
                    ? 'bg-amber-50 border-amber-200'
                    : activeOrder.status === 'accepted'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activeOrder.status === 'pending' ? 'bg-amber-100' : 'bg-emerald-100'
                  }`}>
                    {activeOrder.status === 'pending'
                      ? <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
                      : <Truck className="h-6 w-6 text-emerald-600" />}
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-sm">
                      {activeOrder.status === 'pending'
                        ? '💳 Payment Received · Awaiting Dispatcher'
                        : activeOrder.status === 'accepted'
                        ? '🎉 Rider Assigned · En Route to Pickup!'
                        : activeOrder.status === 'in_transit'
                        ? '🚚 Parcel In Transit!'
                        : 'Rider Assigned!'}
                    </h3>
                    <p className="text-slate-600 text-xs mt-0.5">
                      {activeOrder.status === 'pending'
                        ? 'A dispatcher is reviewing your order and will assign a rider.'
                        : activeOrder.status === 'accepted'
                        ? 'Your rider is heading to the pickup location.'
                        : 'Your parcel is on its way to the destination.'}
                    </p>
                  </div>
                </div>

                {/* Progress Tracker */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5">
                  {(() => {
                    const steps = [
                      { key: 'accepted',  label: 'Rider Assigned & En Route' },
                      { key: 'picked_up', label: 'Package Collected' },
                      { key: 'in_transit',label: 'In Transit' },
                      { key: 'delivered', label: 'Delivered' },
                    ];
                    const idx = steps.findIndex(s => s.key === activeOrder.status);
                    const pending = activeOrder.status === 'pending';
                    
                    return (
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {steps.map((step, i) => {
                          const done = !pending && i <= idx;
                          const active = !pending && i === idx;
                          return (
                            <div key={step.key} className="relative flex items-center gap-4">
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center bg-white z-10 ${
                                active ? 'border-orange-500' : done ? 'border-emerald-500' : 'border-slate-300'
                              }`}>
                                {active ? <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" /> : 
                                 done ? <div className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                              </div>
                              <p className={`text-sm font-semibold ${
                                active ? 'text-slate-900 font-bold' : done ? 'text-slate-700' : 'text-slate-400'
                              }`}>{step.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Order Details Card */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 text-sm shadow-sm">
                {/* Driver phone - extracted from package_type where driver writes it on accept */}
                {(() => {
                  const driverPhoneMatch = activeOrder?.package_type?.match(/\|\|\|DPHONE:([\d\+\-\(\)\s]+)/);
                  const driverPhone = driverPhoneMatch ? driverPhoneMatch[1] : null;
                  return driverPhone ? (
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-slate-500 text-xs">Driver Phone</p>
                        <p className="font-bold text-slate-900 mt-0.5">{driverPhone}</p>
                      </div>
                      <Button variant="outline" size="sm" className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200" asChild>
                        <a href={`tel:${driverPhone}`}><PhoneCall className="h-4 w-4 mr-2" /> Call Driver</a>
                      </Button>
                    </div>
                  ) : null;
                })()}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-slate-500">Tracking ID</span>
                    <span className="font-mono text-orange-600 font-bold">{activeOrder.payment_reference}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-slate-500">Fare (Paid)</span>
                    <span className="font-black text-slate-900">₦{(activeOrder.estimated_price||0).toLocaleString()}</span>
                  </div>
                  
                  {activeOrder.status === 'pending' && (
                    <Button variant="ghost" onClick={handleCancelOrder} disabled={isCancelling}
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl mt-2">
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Cancel Order
                    </Button>
                  )}
                  
                  {activeOrder.status === 'delivered' && (
                    <div className="text-center p-3 mt-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">
                      Payment Completed
                    </div>
                  )}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}