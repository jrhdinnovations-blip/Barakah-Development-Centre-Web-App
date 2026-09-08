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
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c4a6e' }] },
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

  return (
    <div className="relative min-h-dvh bg-[#0f172a] overflow-hidden flex flex-col md:flex-row">

      {/* ═══════════ PAYMENT MODAL OVERLAY ═══════════ */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/70 rounded-[28px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            
            {paymentDone ? (
              /* ——— Payment Confirmed: Awaiting Dispatcher Assignment ——— */
              <div className="p-8 flex flex-col items-center text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Payment Verified! 🎉</h2>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Your order is now in the dispatcher queue.
                    <br />
                    <span className="text-orange-400 font-semibold">
                      You’ll get a notification once a rider is assigned.
                    </span>
                  </p>
                </div>
                <div className="w-full flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                  <span className="text-2xl">📡</span>
                  <div className="text-left">
                    <p className="text-amber-400 font-bold text-sm">Dispatcher on standby</p>
                    <p className="text-amber-300/70 text-xs mt-0.5">A rider will be assigned and you’ll be notified instantly.</p>
                  </div>
                </div>
                <Button
                  className="w-full h-12 bg-white hover:bg-slate-200 text-slate-950 font-black rounded-xl"
                  onClick={() => setShowPayment(false)}
                >
                  Close & Track My Order
                </Button>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Due</p>
                    <p className="text-3xl font-black text-white">₦{(activeOrder?.estimated_price || fare).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => { setShowPayment(false); setPaymentMethod(null); }}
                    className="h-9 w-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Payment Method Selection */}
                <div className="p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Choose Payment Method</p>

                  {/* Paystack Option */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paystack')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      paymentMethod === 'paystack'
                        ? 'bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xl">💳</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">Paystack Checkout</p>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">Instant</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Debit Card, Instant Bank Transfer, USSD</p>
                    </div>
                    {paymentMethod === 'paystack' && <CheckCircle2 className="h-5 w-5 text-emerald-400 ml-auto shrink-0" />}
                  </button>

                  {/* Bank Transfer Option */}
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xl">🏦</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">Bank Transfer</p>
                      <p className="text-[11px] text-slate-400">Transfer to driver's account</p>
                    </div>
                    {paymentMethod === 'transfer' && <CheckCircle2 className="h-5 w-5 text-orange-400 ml-auto shrink-0" />}
                  </button>

                  {/* Transfer Details (shown when transfer is selected) */}
                  {paymentMethod === 'transfer' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      {/* Account Details Card */}
                      <div className="bg-orange-500/8 border border-orange-500/25 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">SwiftMove Account Details</p>

                        {/* Account Number */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Account Number</p>
                            <p className="text-xl font-black text-white tracking-widest">0334876453</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('0334876453');
                              toast.success('Account number copied!');
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-[11px] font-bold transition-all active:scale-95"
                          >
                            Copy
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-slate-800" />

                        {/* Bank Name */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 text-[11px]">Bank / Business</span>
                          <span className="text-white font-bold">SwiftMove Logistics</span>
                        </div>

                        {/* Amount */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 text-[11px]">Amount to Transfer</span>
                          <span className="text-orange-300 font-black text-base">
                            ₦{(activeOrder?.estimated_price || fare).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp CTA */}
                      <a
                        href={`https://wa.me/2348060480745?text=${encodeURIComponent(
                          `Hello SwiftMove! I've just made a bank transfer of ₦${(activeOrder?.estimated_price || fare).toLocaleString()} to account 0334876453 (SwiftMove Logistics). Please find my payment receipt attached. Order reference: ${activeOrder?.payment_reference || 'pending'}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] font-bold text-sm transition-all active:scale-[0.98]"
                      >
                        <span className="text-lg">💬</span>
                        Send Receipt on WhatsApp
                      </a>

                      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                        After transferring, tap the button above to send your payment receipt to our WhatsApp.<br />
                        Your order will be confirmed once payment is verified.
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Button */}
                <div className="px-5 pb-5">
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={!paymentMethod || isConfirmingPayment}
                    className="w-full h-14 bg-white hover:bg-slate-200 text-slate-950 font-black rounded-xl disabled:opacity-40 transition-all"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-[#0a0f1c] border border-emerald-500/40 rounded-[32px] overflow-hidden shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-300">
            {/* Celebration Header */}
            <div className="relative overflow-hidden p-6 text-center border-b border-emerald-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-orange-500/5 pointer-events-none" />
              <div className="relative">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-black text-white">Rider Assigned!</h2>
                <p className="text-emerald-400 text-sm font-semibold mt-1">
                  {assignedRider.name} is heading to your pickup!
                </p>
              </div>
            </div>

            {/* Rider Details Card */}
            <div className="p-5 space-y-4">
              {/* Rider Profile Row */}
              <div className="flex items-center gap-4 p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg shadow-orange-500/20">
                  {assignedRider.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-base truncate">{assignedRider.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-amber-400 text-sm">★</span>
                    <span className="text-amber-300 text-sm font-bold">{assignedRider.rating.toFixed(1)}</span>
                    <span className="text-slate-500 text-xs">· Verified SwiftMove Rider</span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Plate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🚗 Vehicle</p>
                  <p className="text-white font-bold text-sm">{assignedRider.vehicleMake}</p>
                  {assignedRider.vehicleType && assignedRider.vehicleType !== assignedRider.vehicleMake && (
                    <p className="text-slate-400 text-[11px] mt-0.5">{assignedRider.vehicleType}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🪪 Plate No.</p>
                  <p className="text-orange-400 font-black text-sm font-mono">{assignedRider.plateNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Call Button */}
              {assignedRider.phone ? (
                <a
                  href={`tel:${assignedRider.phone}`}
                  className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-black text-sm rounded-2xl transition-all active:scale-[0.98]"
                >
                  <PhoneCall className="h-5 w-5" />
                  Call {assignedRider.name.split(' ')[0]} — {assignedRider.phone}
                </a>
              ) : null}

              {/* Close Button */}
              <Button
                className="w-full h-12 bg-white hover:bg-slate-100 text-slate-950 font-black rounded-xl"
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
        
        {/* Dark gradient overlay so the floating card stands out */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-slate-900 via-slate-900/70 to-transparent lg:w-3/5" />
      </div>

      {/* ═══════════ FOREGROUND: FLOATING BOOKING CARD ═══════════ */}
      <div className="relative z-10 w-full lg:w-[460px] flex flex-col p-4 md:p-6 lg:p-8 h-[100dvh] overflow-hidden pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/70 rounded-[32px] shadow-2xl flex flex-col flex-1 pointer-events-auto overflow-hidden">
          
          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            {/* Header */}
            {!activeOrder ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
                    <Package className="h-3.5 w-3.5" /> Express Delivery
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight mt-3">Send a Parcel</h1>
                  <p className="text-xs text-slate-400 font-medium mt-1">Fast, reliable dispatch across the city.</p>
                </div>

                {/* Step Progress */}
                <div className="flex items-center gap-2">
                  {[{ n: 1, label: 'Locations' }, { n: 2, label: 'Parcel' }, { n: 3, label: 'Review' }].map(({ n, label }, idx) => (
                    <div key={n} className="flex items-center gap-2 flex-1">
                      <div className={`flex items-center gap-1.5 ${step === n ? 'text-white' : step > n ? 'text-emerald-400' : 'text-slate-600'}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                          step === n ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                          : step > n ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-700 text-slate-600'
                        }`}>
                          {step > n ? '✓' : n}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide hidden sm:block">{label}</span>
                      </div>
                      {idx < 2 && <div className={`flex-1 h-[2px] rounded-full transition-all ${step > n ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400">
                  <Truck className="h-3.5 w-3.5" /> Live Tracking
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight mt-3">Order Dispatched</h1>
                <p className="text-xs text-slate-400 font-medium">Your parcel is being handled by SwiftMove.</p>
              </div>
            )}

            {!activeOrder ? (
              <div className="space-y-6">
                
                {/* ═══ STEP 1: LOCATIONS ═══ */}
                {step === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="relative space-y-4">
                      {/* Vertical connecting line */}
                      <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-slate-800 rounded-full z-0" />
                      
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
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Popular Jos Destinations</p>
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
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-white transition-all text-left active:scale-95"
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
                      <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs animate-in fade-in-0 duration-200">
                        <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                          <span>🛣️</span> Road Distance: <strong className="text-white">{distanceKm} km</strong>
                        </span>
                        {durationText && (
                          <span className="text-orange-400 font-semibold flex items-center gap-1">
                            <span>⏱️</span> {durationText}
                          </span>
                        )}
                      </div>
                    )}

                    {isCalculatingRoute && distanceKm <= 0 && (
                      <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-orange-400">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
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
                              ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.45)] hover:shadow-[0_0_35px_rgba(249,115,22,0.65)] hover:scale-[1.01] active:scale-[0.99] border border-orange-400/30 ring-2 ring-orange-500/20 cursor-pointer'
                              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50 shadow-none'
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ml-2">
                          <Weight className="h-3 w-3" /> Estimated Weight (kg)
                        </label>
                        <div className="relative">
                          <input type="number" min={0.5} max={500} step={0.5} value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g., 2.5 kg"
                            className="w-full h-14 pl-10 pr-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                          />
                          <Package className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ml-2">
                          <Info className="h-3 w-3" /> What are you sending? <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={parcelDescription}
                          onChange={(e) => setParcelDescription(e.target.value)}
                          placeholder="Describe the items securely..."
                          className="w-full h-24 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)} className="h-14 px-6 border-slate-700 text-slate-300 rounded-xl">
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(3)}
                        disabled={!weightKg || !parcelDescription.trim()}
                        className="flex-1 h-14 bg-white hover:bg-slate-200 text-slate-950 text-sm font-black rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
                      >
                        Review Fare & Book
                      </Button>
                    </div>
                  </div>
                )}

                {/* ═══ STEP 3: REVIEW & BOOK ═══ */}
                {step === 3 && isFormComplete && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-slate-900 rounded-[24px] border border-slate-800 p-6 space-y-5 shadow-lg">
                      
                      {/* Price header */}
                      <div className="flex justify-between items-end border-b border-slate-800 pb-5">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Guaranteed Fare</p>
                          <span className="text-4xl font-black text-white">₦{breakdown?.total.toLocaleString()}</span>
                        </div>
                        <div className="text-right pb-1">
                          {durationText && (
                            <p className="text-sm text-emerald-400 font-semibold mb-1">~{durationText} delivery</p>
                          )}
                          <p className="text-xs text-slate-500 font-medium">{distanceKm} km • {weightKg} kg</p>
                        </div>
                      </div>

                      {/* Transparent Fare Breakdown (Price per km & kg) */}
                      {breakdown && (
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-2.5 text-xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fare Breakdown</p>
                          
                          <div className="flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span>🏁</span> Base Dispatch Fare
                            </span>
                            <span className="font-semibold text-white">₦{breakdown.baseFare.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span>🛣️</span> Distance ({breakdown.distanceKm} km @ ₦{breakdown.ratePerKm}/km)
                            </span>
                            <span className="font-semibold text-white">₦{breakdown.distanceCost.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span>⚖️</span> Weight ({breakdown.weightKg} kg @ ₦{breakdown.ratePerKg}/kg)
                            </span>
                            <span className="font-semibold text-white">₦{breakdown.weightCost.toLocaleString()}</span>
                          </div>

                          {breakdown.subtotal < breakdown.minFare && (
                            <div className="flex justify-between items-center text-amber-400/90 pt-1 border-t border-slate-800/60 text-[11px]">
                              <span>Minimum Fare Threshold Applied</span>
                              <span className="font-semibold">₦{breakdown.minFare.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Trust Signals */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-400">100% Safe & Verified Drivers</p>
                            <p className="text-[10px] text-emerald-500/80">Every dispatch rider is fully vetted by SwiftMove.</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                          <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Banknote className="h-4 w-4 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-amber-400">Secure Upfront Payment</p>
                            <p className="text-[10px] text-amber-500/80">Pay securely now. Drivers receive request upon verification.</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={handleBookDispatch}
                          disabled={isBooking}
                          className="w-full h-14 bg-orange-600 hover:bg-orange-500 text-white text-sm font-black rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
                        >
                          {isBooking ? (
                            <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Preparing Payment…</>
                          ) : (
                            <><Banknote className="mr-2 h-5 w-5" /> Pay & Request Dispatch</>
                          )}
                        </Button>
                        <Button variant="ghost" onClick={() => setStep(2)} disabled={isBooking} className="w-full mt-2 text-slate-400 hover:text-white">
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
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Delivered! 🎉</h2>
                  <p className="text-slate-400 text-sm mt-1">Your package has arrived safely.</p>
                </div>
                
                <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                  <p className="text-emerald-400 font-bold text-sm">Final Fare</p>
                  <p className="text-3xl font-black text-white">₦{(activeOrder?.estimated_price || 0).toLocaleString()}</p>
                  <p className="text-slate-400 text-xs mt-2">Payment was verified upfront.</p>
                  <p className="text-slate-300 text-sm mt-4 font-semibold">Receipt & Driver Earnings Sent.</p>
                </div>
                
                <Button variant="ghost" className="text-slate-400 hover:text-white"
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
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : activeOrder.status === 'accepted'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-orange-600/10 border-orange-500/30'
                }`}>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activeOrder.status === 'pending' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                  }`}>
                    {activeOrder.status === 'pending'
                      ? <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                      : <Truck className="h-6 w-6 text-emerald-400" />}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">
                      {activeOrder.status === 'pending'
                        ? '💳 Payment Received · Awaiting Dispatcher'
                        : activeOrder.status === 'accepted'
                        ? '🎉 Rider Assigned · En Route to Pickup!'
                        : activeOrder.status === 'in_transit'
                        ? '🚚 Parcel In Transit!'
                        : 'Rider Assigned!'}
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {activeOrder.status === 'pending'
                        ? 'A dispatcher is reviewing your order and will assign a rider.'
                        : activeOrder.status === 'accepted'
                        ? 'Your rider is heading to the pickup location.'
                        : 'Your parcel is on its way to the destination.'}
                    </p>
                  </div>
                </div>

                {/* Progress Tracker */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                        {steps.map((step, i) => {
                          const done = !pending && i <= idx;
                          const active = !pending && i === idx;
                          return (
                            <div key={step.key} className="relative flex items-center gap-4">
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center bg-slate-900 z-10 ${
                                active ? 'border-orange-500' : done ? 'border-emerald-500' : 'border-slate-800'
                              }`}>
                                {active ? <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" /> : 
                                 done ? <div className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                              </div>
                              <p className={`text-sm font-semibold ${
                                active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-600'
                              }`}>{step.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Order Details Card */}
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 space-y-3 text-sm">
                {/* Driver phone - extracted from package_type where driver writes it on accept */}
                {(() => {
                  const driverPhoneMatch = activeOrder?.package_type?.match(/\|\|\|DPHONE:([\d\+\-\(\)\s]+)/);
                  const driverPhone = driverPhoneMatch ? driverPhoneMatch[1] : null;
                  return driverPhone ? (
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div>
                        <p className="text-slate-400 text-xs">Driver Phone</p>
                        <p className="font-bold text-white mt-0.5">{driverPhone}</p>
                      </div>
                      <Button variant="outline" size="sm" className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30" asChild>
                        <a href={`tel:${driverPhone}`}><PhoneCall className="h-4 w-4 mr-2" /> Call Driver</a>
                      </Button>
                    </div>
                  ) : null;
                })()}
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Tracking ID</span>
                    <span className="font-mono text-orange-400 font-bold">{activeOrder.payment_reference}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Fare (Paid)</span>
                    <span className="font-black text-white">₦{(activeOrder.estimated_price||0).toLocaleString()}</span>
                  </div>
                  
                  {activeOrder.status === 'pending' && (
                    <Button variant="ghost" onClick={handleCancelOrder} disabled={isCancelling}
                      className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl mt-2">
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Cancel Order
                    </Button>
                  )}
                  
                  {activeOrder.status === 'delivered' && (
                    <div className="text-center p-3 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold">
                      Payment Completed
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}