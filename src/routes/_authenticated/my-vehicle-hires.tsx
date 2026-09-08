import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useJsApiLoader } from '@react-google-maps/api';
import {
  LocationSuggestion,
  fetchRealtimeLocationSuggestions,
  getBrowserGpsLocation,
  geocodePlaceId,
  searchLocalLocations,
  resolveJosLocation,
} from '@/lib/location-suggestions';
import {
  calculateGoogleRoute,
  haversineKm,
  resolveAddressToCoordinates,
} from '@/lib/google-maps-client';
import { InteractiveMap } from '@/components/InteractiveMap';
import { toast } from 'sonner';
import {
  Loader2, MapPin, Navigation, Car, Star, Phone, Shield,
  AlertTriangle, ChevronRight, Check, Clock, X, History,
  Plus, Minus, Zap, User, Info, ChevronDown, Locate,
  ArrowUpDown, MessageCircle, ReceiptText, Sparkles, CreditCard,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { initializeSwiftPaystack } from '@/lib/payments.functions';
import { PaymentReturn } from '@/components/PaymentReturn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  VEHICLE_TIERS,
  POPULAR_DESTINATIONS,
  calculateTierFare,
  generateNearbyDrivers,
  type VehicleTier,
  type MockNearbyDriver,
  type QuickDestination,
} from '@/lib/ride-pricing';
import {
  encodeRideMetadata,
  appendDriverAcceptance,
  parseOrderMetadata,
} from '@/lib/swift-order';

export const Route = createFileRoute('/_authenticated/my-vehicle-hires')({
  ssr: false,
  component: RideHailingDashboard,
});

// ── Types ────────────────────────────────────────────────────────────────────
type LocationData = { address: string; lat: number; lng: number } | null;
type RidePhase =
  | 'idle'        // user selecting locations & vehicle tier
  | 'searching'   // radar searching for driver
  | 'matched'     // driver found, on the way
  | 'in_transit'  // en-route to destination
  | 'completed'   // trip done
  | 'rated';      // user rated driver

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

// ── Map Config ────────────────────────────────────────────────────────────────
const googleLibraries: ('places')[] = ['places'];
const mapContainerStyle = { width: '100%', height: '100%' };
const JOS_CENTER = { lat: 9.8965, lng: 8.8583 }; // Jos, Plateau State, Nigeria

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2234' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#556780' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#243047' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2d3d55' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1f33' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

// ── Vehicle Tier Icons ────────────────────────────────────────────────────────
function TierIcon({ type, className = '' }: { type: string; className?: string }) {
  const base = `w-10 h-10 ${className}`;
  if (type === 'moto') {
    return (
      <svg className={base} viewBox="0 0 48 48" fill="none">
        <ellipse cx="13" cy="33" rx="8" ry="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <ellipse cx="35" cy="33" rx="8" ry="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M21 33 L24 20 L32 22 L35 33" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M13 25 L20 20 L24 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="28" cy="18" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'van') {
    return (
      <svg className={base} viewBox="0 0 48 48" fill="none">
        <rect x="3" y="18" width="42" height="18" rx="3" stroke="currentColor" strokeWidth="2.5" />
        <rect x="8" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="11" cy="38" r="4" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="37" cy="38" r="4" stroke="currentColor" strokeWidth="2.5" />
        <line x1="28" y1="14" x2="28" y2="22" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'luxury') {
    return (
      <svg className={base} viewBox="0 0 48 48" fill="none">
        <path d="M4 28 L10 20 L20 17 L28 17 L38 20 L44 28 L44 33 L4 33 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        <path d="M10 20 L12 28" stroke="currentColor" strokeWidth="1.5" />
        <path d="M38 20 L36 28" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="35" r="4" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="35" cy="35" r="4" stroke="currentColor" strokeWidth="2.5" />
        <path d="M12 23 L36 23" stroke="currentColor" strokeWidth="1.5" />
        <rect x="22" y="19" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={base} viewBox="0 0 48 48" fill="none">
      <path d="M4 30 L10 22 L18 19 L30 19 L38 22 L44 30 L44 34 L4 34 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <path d="M10 22 L13 30" stroke="currentColor" strokeWidth="1.5" />
      <path d="M38 22 L35 30" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="36" r="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="34" cy="36" r="4" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13 24 L35 24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Pulse Radar for Searching ────────────────────────────────────────────────
function RadarPulse() {
  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
      <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" style={{ animationDuration: '1.8s' }} />
      <div className="absolute inset-3 rounded-full border-2 border-blue-400/40 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }} />
      <div className="absolute inset-6 rounded-full border-2 border-blue-300/50 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '1.2s' }} />
      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center z-10 shadow-lg shadow-blue-500/50">
        <Car className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function RideHailingDashboard() {
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;
  const userId = user?.id;

  // ── Map & Location ────────────────────────────────────────────────────────
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] || '',
    libraries: googleLibraries,
  });

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  // Controlled text inputs + structured location states
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickup, setPickup] = useState<LocationData>(null);
  const [dropoff, setDropoff] = useState<LocationData>(null);
  const [mapDirections, setMapDirections] = useState<any>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationText, setDurationText] = useState('');
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'pickup' | 'dropoff' | null>(null);
  const [liveSuggestions, setLiveSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // ── Ride State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<RidePhase>('idle');
  // Default to Swift Go (first tier) so a tier is always selected
  const [selectedTier, setSelectedTier] = useState<VehicleTier>(VEHICLE_TIERS[0]!);
  const [useInDriveMode, setUseInDriveMode] = useState(false);
  const [customFare, setCustomFare] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'wallet'>('paystack');
  const [matchedDriver, setMatchedDriver] = useState<MockNearbyDriver | null>(null);
  const [safetyPin, setSafetyPin] = useState('');
  const [searchProgress, setSearchProgress] = useState(0);
  const [tripProgress, setTripProgress] = useState(0);
  const [ratingGiven, setRatingGiven] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isSearchingTimer, setIsSearchingTimer] = useState(0);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'ride' | 'history'>('ride');
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Map Center ────────────────────────────────────────────────────────────
  const mapCenter = useMemo(() => {
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    return JOS_CENTER;
  }, [pickup?.lat, pickup?.lng]);

  // ── Computed Tier Fares (Deterministic from real route distance) ───────────
  const tierFares = useMemo(() => {
    return VEHICLE_TIERS.map((tier) => ({
      ...tier,
      fare: distanceKm > 0 ? calculateTierFare(tier, distanceKm) : tier.baseFare,
      hasRealFare: distanceKm > 0,
    }));
  }, [distanceKm]);

  const activeFare = useMemo(() => {
    if (distanceKm > 0) {
      return calculateTierFare(selectedTier, distanceKm);
    }
    return selectedTier.baseFare;
  }, [selectedTier, distanceKm]);

  // Sync custom fare when tier or activeFare changes
  useEffect(() => {
    if (activeFare > 0 && phase === 'idle' && !useInDriveMode) {
      setCustomFare(activeFare);
    }
  }, [activeFare, phase, useInDriveMode]);

  // ── Real-time location suggestions query ─────────────────────────────────
  useEffect(() => {
    if (!activeSuggestionField) return;
    const query = activeSuggestionField === 'pickup' ? pickupText : dropoffText;
    let active = true;
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await fetchRealtimeLocationSuggestions(query, mapsLoaded);
        if (active) setLiveSuggestions(results);
      } finally {
        if (active) setIsLoadingSuggestions(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeSuggestionField, pickupText, dropoffText, mapsLoaded]);

  // ── Helper to Geocode / Fallback Location ─────────────────────────────────
  const resolveLocationFromText = async (text: string): Promise<LocationData> => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return null;
    if (trimmed.toLowerCase().includes('current location') || trimmed.toLowerCase().includes('live gps')) return null;

    // 1. Check verified Jos landmark database first (exact, aliases & fuzzy)
    const match = resolveJosLocation(trimmed);
    if (match && match.lat && match.lng) {
      return {
        address: `${match.label}, ${match.sublabel}`,
        lat: match.lat,
        lng: match.lng,
      };
    }

    // 2. Geocoder lookup via server-side OSM (Plateau bounded) / Google
    const geo = await resolveAddressToCoordinates(trimmed);
    if (geo && geo.lat && geo.lng) {
      return {
        address: geo.address,
        lat: geo.lat,
        lng: geo.lng,
      };
    }

    return null;
  };

  // ── Debounced auto-resolution for typed pickup & dropoff ───────────────────
  useEffect(() => {
    const trimmed = pickupText.trim();
    if (trimmed.length < 3) return;
    if (pickup && (pickup.address.toLowerCase().includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(pickup.address.toLowerCase()))) return;

    const timer = setTimeout(async () => {
      const loc = await resolveLocationFromText(trimmed);
      if (loc) setPickup(loc);
    }, 500);

    return () => clearTimeout(timer);
  }, [pickupText]);

  useEffect(() => {
    const trimmed = dropoffText.trim();
    if (trimmed.length < 3) return;
    if (dropoff && (dropoff.address.toLowerCase().includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(dropoff.address.toLowerCase()))) return;

    const timer = setTimeout(async () => {
      const loc = await resolveLocationFromText(trimmed);
      if (loc) setDropoff(loc);
    }, 500);

    return () => clearTimeout(timer);
  }, [dropoffText]);

  // ── Direction & Route Calculation (Accurate Road Routing) ────────────────
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
        // Calibrated fallback in case of total network disconnect
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


  // ── Quick Destination Chip ────────────────────────────────────────────────
  const handleQuickDestination = (dest: QuickDestination) => {
    const fullAddress = `${dest.name}, ${dest.address}`;
    setDropoff({ address: fullAddress, lat: dest.lat, lng: dest.lng });
    setDropoffText(dest.name);
    if (dropoffInputRef.current) dropoffInputRef.current.value = dest.name;

    // If pickup isn't set, auto-locate or default to current area
    if (!pickup && !pickupText.trim()) {
      handleLocateMe();
    }
  };

  // ── Locate Me ─────────────────────────────────────────────────────────────
  const handleLocateMe = async () => {
    setIsLocatingGps(true);
    toast.loading('Detecting your GPS location...', { id: 'live-gps' });
    try {
      const gps = await getBrowserGpsLocation();
      const loc = { address: gps.address, lat: gps.lat, lng: gps.lng };
      setPickup(loc);
      setPickupText(gps.address);
      if (pickupInputRef.current) pickupInputRef.current.value = gps.address;
      toast.success('Live GPS location detected!', { id: 'live-gps' });
    } catch (err: any) {
      toast.error(err.message || 'Could not retrieve GPS location', { id: 'live-gps' });
      // Use fallback center
      const fallback = { address: 'Jos Main Market / Terminus, Jos', lat: 9.9248, lng: 8.8912 };
      setPickup(fallback);
      setPickupText(fallback.address);
      if (pickupInputRef.current) pickupInputRef.current.value = fallback.address;
    } finally {
      setIsLocatingGps(false);
    }
  };

  // ── Swap Pickup and Dropoff ───────────────────────────────────────────────
  const handleSwapLocations = () => {
    const oldP = pickup;
    const oldPT = pickupText;
    setPickup(dropoff);
    setPickupText(dropoffText);
    setDropoff(oldP);
    setDropoffText(oldPT);
    if (pickupInputRef.current) pickupInputRef.current.value = dropoffText;
    if (dropoffInputRef.current) dropoffInputRef.current.value = oldPT;
  };

  // ── Searching duration timer ─────────────────────────────────────────────
  useEffect(() => {
    let timer: any;
    if (phase === 'searching') {
      setIsSearchingTimer(0);
      timer = setInterval(() => {
        setIsSearchingTimer((s) => s + 1);
      }, 1000);
    } else {
      setIsSearchingTimer(0);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // ── Reset All States ──────────────────────────────────────────────────────
  const handleResetAll = useCallback(() => {
    setPhase('idle');
    setPickup(null);
    setDropoff(null);
    setPickupText('');
    setDropoffText('');
    setMapDirections(null);
    setDistanceKm(0);
    setDurationText('');
    setSelectedTier(VEHICLE_TIERS[0]!);
    setUseInDriveMode(false);
    setCustomFare(0);
    setMatchedDriver(null);
    setSafetyPin('');
    setSearchProgress(0);
    setTripProgress(0);
    setRatingGiven(0);
    setBookingId(null);
    setActiveOrderId(null);
    setActiveOrder(null);
    setIsSearchingTimer(0);
    if (pickupInputRef.current) pickupInputRef.current.value = '';
    if (dropoffInputRef.current) dropoffInputRef.current.value = '';
    fetchHistory();
  }, []);

  // ── Process Order Status Changes ──────────────────────────────────────────
  const processOrderUpdate = useCallback(
    (order: any) => {
      if (!order) return;
      setActiveOrder(order);
      const meta = parseOrderMetadata(order.package_type);

      if (order.status === 'accepted') {
        const driver: MockNearbyDriver = {
          id: order.driver_id || 'driver-1',
          name: meta.driverName || 'Swift Driver',
          phone: meta.driverPhone || '08000000000',
          rating: meta.driverRating || 4.9,
          trips: 240,
          vehicleType: meta.tierName || selectedTier.name,
          vehicleMake: meta.vehicleMake || 'Toyota Corolla',
          vehicleModel: meta.vehicleMake || 'Toyota Corolla',
          plateNumber: meta.plateNumber || 'JOS-829-AA',
          vehicleColor: meta.vehicleColor || 'Silver',
          tierId: selectedTier.id,
          lat: order.driver_lat ?? (pickup?.lat ?? JOS_CENTER.lat),
          lng: order.driver_lng ?? (pickup?.lng ?? JOS_CENTER.lng),
        };
        setMatchedDriver(driver);
        if (meta.safetyPin) setSafetyPin(meta.safetyPin);
        setPhase((prev) => {
          if (prev === 'searching' || prev === 'idle') {
            toast.success(`🚗 Driver found! ${driver.name} is on the way.`);
            return 'matched';
          }
          return prev;
        });
      } else if (order.status === 'picked_up') {
        setPhase((prev) => {
          if (prev === 'matched') {
            toast.info('Driver has arrived at pickup!');
          }
          return 'matched';
        });
      } else if (order.status === 'in_transit') {
        setPhase((prev) => {
          if (prev !== 'in_transit') {
            toast.info('Trip in progress — en route to destination!');
          }
          return 'in_transit';
        });
      } else if (order.status === 'delivered') {
        setPhase('completed');
        toast.success('🎉 You have arrived safely at your destination!');
      } else if (order.status === 'cancelled') {
        toast.error('Ride request was cancelled.');
        handleResetAll();
      }
    },
    [selectedTier, pickup, handleResetAll]
  );

  // ── Realtime subscription to the active order in swift_deliveries ─────────
  useEffect(() => {
    if (!activeOrderId) return;

    const poll = async () => {
      const { data } = await supabase
        .from('swift_deliveries')
        .select('*')
        .eq('id', activeOrderId)
        .maybeSingle();
      if (data) processOrderUpdate(data);
    };

    poll();

    const channel = supabase
      .channel(`customer-ride-${activeOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'swift_deliveries',
          filter: `id=eq.${activeOrderId}`,
        },
        (payload: any) => {
          processOrderUpdate(payload.new);
        }
      )
      .subscribe();

    const interval = setInterval(poll, 3500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeOrderId, processOrderUpdate]);

  // ── Session recovery on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let active = true;

    supabase
      .from('swift_deliveries')
      .select('*')
      .eq('customer_id', userId)
      .in('status', ['pending', 'accepted', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const meta = parseOrderMetadata(data.package_type);
        if (!meta.isRide && !data.package_type?.toLowerCase().includes('ride')) return;

        setActiveOrderId(data.id);
        setActiveOrder(data);
        if (data.pickup_address) {
          setPickupText(data.pickup_address);
          setPickup({ address: data.pickup_address, lat: JOS_CENTER.lat, lng: JOS_CENTER.lng });
        }
        if (data.dropoff_address) {
          setDropoffText(data.dropoff_address);
          setDropoff({ address: data.dropoff_address, lat: 9.8402, lng: 8.9135 });
        }
        if (data.distance_km) setDistanceKm(data.distance_km);
        if (data.estimated_price) setCustomFare(data.estimated_price);
        if (meta.safetyPin) setSafetyPin(meta.safetyPin);

        if (data.status === 'pending') {
          setPhase('searching');
        } else {
          processOrderUpdate(data);
        }
      });

    return () => {
      active = false;
    };
  }, [userId, processOrderUpdate]);

  // ── Request Ride (Confirm & Real-time Dispatch) ───────────────────────────
  const handleRequestRide = async () => {
    if (!userId) {
      toast.error('Please sign in to request a ride.');
      return;
    }

    // Ensure pickup is resolved
    let activePickup = pickup;
    let activeDropoff = dropoff;

    if (!activePickup && pickupText.trim().length > 0) {
      setIsResolvingLocation(true);
      activePickup = await resolveLocationFromText(pickupText);
      setPickup(activePickup);
      setIsResolvingLocation(false);
    }

    if (!activeDropoff && dropoffText.trim().length > 0) {
      setIsResolvingLocation(true);
      activeDropoff = await resolveLocationFromText(dropoffText);
      setDropoff(activeDropoff);
      setIsResolvingLocation(false);
    }

    if (!activePickup) {
      pickupInputRef.current?.focus();
      toast.error('Please enter or select a pickup location.');
      return;
    }

    if (!activeDropoff) {
      dropoffInputRef.current?.focus();
      toast.error('Please enter where you want to go.');
      return;
    }

    // Ensure route and distance are calculated immediately in 0ms
    // Ensure route and distance are calculated accurately
    let currentDistanceKm = distanceKm;
    if (currentDistanceKm <= 0 && activePickup && activeDropoff) {
      try {
        const routeResult = await calculateGoogleRoute(
          { lat: activePickup.lat, lng: activePickup.lng },
          { lat: activeDropoff.lat, lng: activeDropoff.lng }
        );
        if (routeResult && routeResult.distanceKm > 0) {
          currentDistanceKm = routeResult.distanceKm;
          setDistanceKm(routeResult.distanceKm);
          setDurationText(routeResult.durationText);
          setRoutePolyline(routeResult.polylinePoints);
        }
      } catch (_) {
        const fallbackKm = haversineKm(activePickup.lat, activePickup.lng, activeDropoff.lat, activeDropoff.lng) * 1.35;
        const safeKm = Math.max(1, Math.round(fallbackKm * 10) / 10);
        currentDistanceKm = safeKm;
        setDistanceKm(safeKm);
        setDurationText(`~${Math.ceil(safeKm * 2.5)} mins`);
        setRoutePolyline([
          [activePickup.lat, activePickup.lng],
          [activeDropoff.lat, activeDropoff.lng],
        ]);
      }
    }

    const calculatedFare = currentDistanceKm > 0 ? calculateTierFare(selectedTier, currentDistanceKm) : selectedTier.baseFare;
    const fare = useInDriveMode && customFare > 0 ? customFare : calculatedFare;
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setSafetyPin(pin);

    // Fetch customer phone
    let customerPhone: string | null = null;
    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', userId)
        .maybeSingle();
      customerPhone = profData?.phone || user?.user_metadata?.phone || null;
    } catch (_) {}

    const trackingId = `SWR-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;

    const encodedPackage = encodeRideMetadata({
      tierName: selectedTier.name,
      tierId: selectedTier.id,
      seats: selectedTier.capacity,
      safetyPin: pin,
      customerPhone,
      notes: useInDriveMode ? `Custom fare offer: ₦${customFare}` : null,
    });

    setPhase('searching');
    setSearchProgress(0);

    try {
      // 1. Dispatch real ride to swift_deliveries (listened to in real-time by driver console)
      const { data: delivData, error: delivErr } = await supabase
        .from('swift_deliveries')
        .insert({
          customer_id: userId,
          pickup_address: activePickup.address,
          dropoff_address: activeDropoff.address,
          package_type: encodedPackage,
          weight_kg: selectedTier.capacity,
          distance_km: currentDistanceKm,
          estimated_price: fare,
          payment_reference: trackingId,
          status: 'pending',
        })
        .select()
        .single();

      if (delivErr) throw delivErr;

      setActiveOrderId(delivData.id);
      setActiveOrder(delivData);

      // 2. Also save to vehicle_hire_bookings for legacy bookings history
      const { data: vhData } = await supabase
        .from('vehicle_hire_bookings')
        .insert({
          customer_id: userId,
          category: selectedTier.category,
          sub_category: selectedTier.subCategoryDb,
          pickup_location: activePickup.address,
          destination: activeDropoff.address,
          start_date: new Date().toISOString().split('T')[0]!,
          duration_days: 1,
          total_price: fare,
          status: 'booked',
          payment_reference: trackingId,
        })
        .select()
        .single();

      if (vhData) setBookingId(vhData.id);

      // If customer chose Paystack, redirect to Paystack checkout
      if (paymentMethod === 'paystack') {
        toast.loading('Connecting to Paystack payment gateway...', { id: 'paystack-init' });
        try {
          const paystackInit = await initializeSwiftPaystack({
            data: {
              entityType: 'swift_ride',
              entityId: delivData.id,
              amountKobo: Math.round(fare * 100),
              description: `SwiftRide: ${selectedTier.name} (${activePickup.address} → ${activeDropoff.address})`,
              callbackPath: `/my-vehicle-hires`,
            },
          });
          if (paystackInit?.authorizationUrl) {
            toast.success('Redirecting to Paystack checkout...', { id: 'paystack-init' });
            window.location.href = paystackInit.authorizationUrl;
            return;
          }
        } catch (payErr: any) {
          toast.error(payErr.message || 'Could not connect to Paystack.', { id: 'paystack-init' });
        }
      }

      toast.success('Ride requested! Waiting for driver to accept...');
    } catch (err: any) {
      toast.error('Failed to request ride: ' + (err.message || 'Please try again.'));
      setPhase('idle');
    }
  };

  // ── Cancel Ride Search ────────────────────────────────────────────────────
  const handleCancelSearch = async () => {
    if (activeOrderId) {
      try {
        await supabase
          .from('swift_deliveries')
          .update({ status: 'cancelled' })
          .eq('id', activeOrderId)
          .eq('status', 'pending');
        if (bookingId) {
          await supabase
            .from('vehicle_hire_bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId);
        }
      } catch (_) {}
    }
    toast.info('Ride request cancelled.');
    handleResetAll();
  };

  // ── Testing Mode: Manually Simulate Driver Acceptance (Never auto-triggers) ─
  const handleSimulateDriverAcceptForTesting = async () => {
    if (!activeOrderId) return;
    toast.info('Simulating driver response for testing...');
    try {
      let testPhone = '08034567890';
      let testName = 'Ibrahim Danladi';
      let testVehicle = 'Toyota Corolla (2020)';
      let testPlate = 'JOS-829-AA';
      let testColor = 'Silver';

      const { data: activeDrvs } = await supabase
        .from('active_drivers')
        .select('*')
        .eq('status', 'available')
        .limit(1);

      if (activeDrvs && activeDrvs.length > 0) {
        const dId = activeDrvs[0]!.driver_id;
        const { data: pData } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', dId)
          .maybeSingle();
        if (pData?.full_name) testName = pData.full_name;
        if (pData?.phone) testPhone = pData.phone;
      }

      const updatedPackage = appendDriverAcceptance({
        basePackageType: activeOrder?.package_type || `Ride: ${selectedTier.name}|||KIND:ride`,
        driverPhone: testPhone,
        driverName: testName,
        vehicleMake: testVehicle,
        plateNumber: testPlate,
        vehicleColor: testColor,
        driverRating: 4.9,
      });

      await supabase
        .from('swift_deliveries')
        .update({
          status: 'accepted',
          driver_id: userId,
          package_type: updatedPackage,
        })
        .eq('id', activeOrderId)
        .eq('status', 'pending');
    } catch (e: any) {
      toast.error('Test simulation failed: ' + e.message);
    }
  };

  // ── Start Trip ────────────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    setPhase('in_transit');
    setTripProgress(0);
    if (activeOrderId) {
      try {
        await supabase
          .from('swift_deliveries')
          .update({ status: 'in_transit' })
          .eq('id', activeOrderId);
        if (bookingId) {
          await supabase
            .from('vehicle_hire_bookings')
            .update({ status: 'active' })
            .eq('id', bookingId);
        }
      } catch (_) {}
    }
  };

  // ── Rate & Reset ──────────────────────────────────────────────────────────
  const handleSubmitRating = async () => {
    toast.success(`Ride rated ${ratingGiven} ⭐ – Thank you!`);
    setPhase('rated');
    if (activeOrderId) {
      try {
        await supabase
          .from('swift_deliveries')
          .update({ rating: ratingGiven })
          .eq('id', activeOrderId);
        if (bookingId) {
          await supabase
            .from('vehicle_hire_bookings')
            .update({ status: 'completed' })
            .eq('id', bookingId);
        }
      } catch (_) {}
    }
    setTimeout(() => handleResetAll(), 1400);
  };

  // ── Trip History ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('vehicle_hire_bookings')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });
      setBookings(data || []);
    } catch (_) {}
    finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Determine button state and label
  const hasBothLocations = pickupText.trim().length > 0 && dropoffText.trim().length > 0;
  const currentFareToDisplay = useInDriveMode ? customFare : activeFare;

  // ── Panel: Idle (Locations & Vehicle Selection) ───────────────────────────
  const renderIdlePanel = () => (
    <div className="space-y-4">
      {/* Location Input Box */}
      <div className="relative">
        <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 space-y-3 shadow-sm">
          {/* Pickup Input */}
          <div className="relative flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-400 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <input
              ref={pickupInputRef}
              type="text"
              value={pickupText}
              onFocus={() => setActiveSuggestionField('pickup')}
              onChange={(e) => {
                setPickupText(e.target.value);
                setActiveSuggestionField('pickup');
                if (!e.target.value.trim()) setPickup(null);
              }}
              onBlur={() => {
                const val = pickupText.trim();
                setTimeout(async () => {
                  if (activeSuggestionField === 'pickup') setActiveSuggestionField(null);
                  if (val.length >= 3 && !pickup) {
                    const loc = await resolveLocationFromText(val);
                    if (loc) setPickup(loc);
                  }
                }, 200);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (liveSuggestions.length > 0 && liveSuggestions[0]) {
                    const item = liveSuggestions[0];
                    let lat = item.lat;
                    let lng = item.lng;
                    let fullAddress = `${item.label}, ${item.sublabel}`;
                    if (item.placeId && (!item.hasResolvedCoords || !lat || lat === 0)) {
                      try {
                        const resolved = await geocodePlaceId(item.placeId, item.lat, item.lng);
                        if (resolved && (resolved.lat !== 0 || resolved.lng !== 0)) {
                          lat = resolved.lat;
                          lng = resolved.lng;
                          if (resolved.address) fullAddress = resolved.address;
                        }
                      } catch {}
                    }
                    setPickup({ address: fullAddress, lat, lng });
                    setPickupText(item.label);
                    setActiveSuggestionField(null);
                  } else if (pickupText.trim()) {
                    const loc = await resolveLocationFromText(pickupText);
                    if (loc) setPickup(loc);
                    setActiveSuggestionField(null);
                  }
                }
              }}
              placeholder="Pickup location (e.g. Terminus, Rayfield, UNIJOS)..."
              className="w-full py-2 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
            />
            {pickupText ? (
              <button
                type="button"
                onClick={() => {
                  setPickupText('');
                  setPickup(null);
                  if (pickupInputRef.current) pickupInputRef.current.value = '';
                }}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocatingGps}
                className="text-blue-400 hover:text-blue-300 p-1 transition-colors flex items-center gap-1"
                title="Use Live GPS Location"
              >
                {isLocatingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <Locate className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Divider with Swap Action */}
          <div className="flex items-center gap-2 pl-1.5 pr-1">
            <div className="w-px h-3 bg-white/20 ml-[5px]" />
            <div className="flex-1 h-px bg-white/8" />
            <button
              type="button"
              onClick={handleSwapLocations}
              className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs flex items-center gap-1 px-2"
              title="Swap locations"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span className="text-[10px]">Swap</span>
            </button>
          </div>

          {/* Dropoff Input */}
          <div className="relative flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-400 shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            <input
              ref={dropoffInputRef}
              type="text"
              value={dropoffText}
              onFocus={() => setActiveSuggestionField('dropoff')}
              onChange={(e) => {
                setDropoffText(e.target.value);
                setActiveSuggestionField('dropoff');
                if (!e.target.value.trim()) setDropoff(null);
              }}
              onBlur={() => {
                const val = dropoffText.trim();
                setTimeout(async () => {
                  if (activeSuggestionField === 'dropoff') setActiveSuggestionField(null);
                  if (val.length >= 3 && !dropoff) {
                    const loc = await resolveLocationFromText(val);
                    if (loc) setDropoff(loc);
                  }
                }, 200);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (liveSuggestions.length > 0 && liveSuggestions[0]) {
                    const item = liveSuggestions[0];
                    let lat = item.lat;
                    let lng = item.lng;
                    let fullAddress = `${item.label}, ${item.sublabel}`;
                    if (item.placeId && (!item.hasResolvedCoords || !lat || lat === 0)) {
                      try {
                        const resolved = await geocodePlaceId(item.placeId, item.lat, item.lng);
                        if (resolved && (resolved.lat !== 0 || resolved.lng !== 0)) {
                          lat = resolved.lat;
                          lng = resolved.lng;
                          if (resolved.address) fullAddress = resolved.address;
                        }
                      } catch {}
                    }
                    setDropoff({ address: fullAddress, lat, lng });
                    setDropoffText(item.label);
                    setActiveSuggestionField(null);
                  } else if (dropoffText.trim()) {
                    const loc = await resolveLocationFromText(dropoffText);
                    if (loc) setDropoff(loc);
                    setActiveSuggestionField(null);
                  }
                }
              }}
              placeholder="Where to? (e.g. Airport, Bukuru, JUTH)..."
              className="w-full py-2 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
            />
            {dropoffText && (
              <button
                type="button"
                onClick={() => {
                  setDropoffText('');
                  setDropoff(null);
                  if (dropoffInputRef.current) dropoffInputRef.current.value = '';
                }}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Real-time Suggestions Overlay */}
        {activeSuggestionField && liveSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="px-3.5 py-2 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/40">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-orange-400" />
                Suggested Locations
              </span>
              {isLoadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar">
              {liveSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={async (e) => {
                    e.preventDefault(); // Prevent blur before click
                    const field = activeSuggestionField;
                    setActiveSuggestionField(null);

                    let lat = item.lat;
                    let lng = item.lng;
                    let fullAddress = `${item.label}, ${item.sublabel}`;

                    if (field === 'pickup') {
                      setPickupText(item.label);
                    } else {
                      setDropoffText(item.label);
                    }

                    if (item.placeId && (!item.hasResolvedCoords || !lat || lat === 0)) {
                      try {
                        const resolved = await geocodePlaceId(item.placeId, item.lat, item.lng);
                        if (resolved && (resolved.lat !== 0 || resolved.lng !== 0)) {
                          lat = resolved.lat;
                          lng = resolved.lng;
                          if (resolved.address) fullAddress = resolved.address;
                        }
                      } catch {}
                    }

                    if (field === 'pickup') {
                      setPickup({ address: fullAddress, lat, lng });
                    } else {
                      setDropoff({ address: fullAddress, lat, lng });
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-white/[0.06] active:bg-orange-500/10 transition-colors group"
                >
                  <span className="text-sm shrink-0 mt-0.5">{item.iconEmoji || '📍'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white group-hover:text-orange-300 transition-colors truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Destination Chips */}
      {!dropoffText && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Popular Destinations</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest.label}
                onClick={() => handleQuickDestination(dest)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-white transition-all active:scale-95"
              >
                <span>{dest.iconEmoji}</span>
                <span>{dest.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Route Info Badge (Distance & Duration) */}
      {hasBothLocations && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-xs">
          <div className="flex items-center gap-2 text-white">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            {distanceKm > 0 ? (
              <>
                <span className="font-semibold">{distanceKm} km</span>
                {durationText && <span className="text-white/40">·</span>}
                <span className="text-white/70">{durationText}</span>
              </>
            ) : isCalculatingRoute ? (
              <span className="flex items-center gap-1.5 text-blue-300 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Calculating road route…
              </span>
            ) : (
              <span className="text-white/50">Resolving route…</span>
            )}
          </div>
          <span className="text-[10px] text-blue-300 font-medium uppercase tracking-wide bg-blue-500/20 px-2 py-0.5 rounded-full">
            Live Route
          </span>
        </div>
      )}

      {/* Vehicle Tier Picker (Always visible or when locations are entered) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Available Ride Tiers</p>
          <span className="text-[11px] text-white/40">5 nearby</span>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {tierFares.map((tier) => {
            const isSelected = selectedTier.id === tier.id;
            return (
              <button
                key={tier.id}
                onClick={() => {
                  setSelectedTier(tier);
                  if (!useInDriveMode) setCustomFare(tier.fare);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500/70 shadow-md shadow-blue-500/10 scale-[1.01]'
                    : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15'
                }`}
              >
                <div className={`shrink-0 ${isSelected ? 'text-blue-400' : 'text-white/50'}`}>
                  <TierIcon type={tier.iconType} className="w-9 h-9" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-white/90'}`}>
                      {tier.name}
                    </span>
                    {tier.popular && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        POPULAR
                      </span>
                    )}
                    {tier.tag && !tier.popular && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
                        {tier.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 truncate">{tier.subTitle}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-white/50 flex items-center gap-1">
                      <User className="w-3 h-3" /> {tier.capacity} seats
                    </span>
                    <span className="text-[11px] text-white/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {tier.etaMinutes} min away
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {isCalculatingRoute ? (
                    <div className="flex items-center justify-end py-1 text-blue-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <p className={`font-bold text-base ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                        ₦{tier.fare.toLocaleString()}
                      </p>
                      {distanceKm <= 0 && (
                        <p className="text-[9px] text-white/40">base fare</p>
                      )}
                    </>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-blue-400 ml-auto mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* InDrive Negotiable Fare Toggle */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-xs font-semibold text-white/90">Offer Your Fare (InDrive style)</p>
              <p className="text-[10px] text-white/40">Negotiate your own price with nearby drivers</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !useInDriveMode;
              setUseInDriveMode(next);
              if (next && customFare <= 0) setCustomFare(activeFare);
            }}
            className={`relative w-10 h-5 rounded-full transition-all ${
              useInDriveMode ? 'bg-orange-500' : 'bg-white/15'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                useInDriveMode ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {useInDriveMode && (
          <div className="pt-2 border-t border-white/8 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCustomFare((prev) => Math.max(500, prev - 200))}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white active:scale-95 transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-xl font-bold text-orange-400">₦{customFare.toLocaleString()}</p>
                <p className="text-[10px] text-white/40">Rec: ₦{activeFare.toLocaleString()}</p>
              </div>
              <button
                onClick={() => setCustomFare((prev) => prev + 200)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1.5">
              {[-300, 0, 300, 500].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setCustomFare(Math.max(500, activeFare + diff))}
                  className={`flex-1 text-[11px] py-1 rounded-lg transition-all ${
                    activeFare + diff === customFare
                      ? 'bg-orange-500 text-white font-bold'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {diff === 0 ? 'Standard' : diff > 0 ? `+₦${diff}` : `-₦${Math.abs(diff)}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Selector Pill */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-white/80">
        <span className="text-white/50">Payment:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('paystack')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              paymentMethod === 'paystack'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>💳</span> Paystack (Card / Transfer)
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('wallet')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              paymentMethod === 'wallet'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>⚡</span> Swift Wallet
          </button>
        </div>
      </div>

      {/* PRIMARY ACTION BUTTON (ALWAYS VISIBLE) */}
      <div className="pt-1">
        <button
          onClick={handleRequestRide}
          disabled={isResolvingLocation || isCalculatingRoute || !hasBothLocations}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
            hasBothLocations && !isCalculatingRoute && !isResolvingLocation
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:shadow-[0_0_35px_rgba(59,130,246,0.7)] hover:scale-[1.01] border border-blue-400/30 cursor-pointer'
              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50 shadow-none'
          }`}
        >
          {isResolvingLocation ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Confirming Location...</span>
            </>
          ) : isCalculatingRoute ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Calculating Route & Fare…</span>
            </>
          ) : hasBothLocations ? (
            <>
              <Zap className="w-5 h-5 fill-current text-yellow-300" />
              <span>
                {paymentMethod === 'paystack'
                  ? `Pay ₦${currentFareToDisplay.toLocaleString()} with Paystack`
                  : `Request ${selectedTier.name} · ₦${currentFareToDisplay.toLocaleString()}`}
              </span>
              <ChevronRight className="w-4 h-4 ml-1 opacity-70" />
            </>
          ) : !pickupText.trim() ? (
            <>
              <MapPin className="w-4 h-4" />
              <span>Enter Pickup Location</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Enter Destination ("Where to?")</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ── Panel: Searching (Radar) ─────────────────────────────────────────────
  const renderSearchingPanel = () => (
    <div className="flex flex-col items-center justify-center py-6 space-y-6">
      <RadarPulse />
      <div className="text-center space-y-1">
        <p className="font-bold text-lg text-white">Broadcasting request to nearby drivers...</p>
        <p className="text-sm text-white/50">
          Waiting for a <span className="text-blue-400 font-semibold">{selectedTier.name}</span> driver to accept ({isSearchingTimer}s)
        </p>
      </div>

      {/* Indeterminate Scanning Pulse Bar */}
      <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden relative">
        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 rounded-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
      </div>

      <div className="w-full space-y-2 text-sm">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-white/40 uppercase font-semibold">Pickup</p>
            <p className="text-white/80 truncate text-xs">{pickup?.address || pickupText}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
          <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-white/40 uppercase font-semibold">Destination</p>
            <p className="text-white/80 truncate text-xs">{dropoff?.address || dropoffText}</p>
          </div>
        </div>
      </div>

      <div className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-between text-xs">
        <span className="text-white/50">Offered Fare:</span>
        <span className="font-bold text-blue-300 text-sm">₦{currentFareToDisplay.toLocaleString()}</span>
      </div>

      <div className="w-full flex flex-col items-center gap-2 pt-2">
        <button
          onClick={handleCancelSearch}
          className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors py-2 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 w-full cursor-pointer"
        >
          Cancel Ride Request
        </button>

        {/* Developer testing simulation button (manual click only) */}
        <button
          type="button"
          onClick={handleSimulateDriverAcceptForTesting}
          className="text-[11px] text-slate-400 hover:text-blue-300 transition-colors border border-dashed border-slate-700 hover:border-blue-500/40 rounded-lg px-3 py-1.5 mt-1 cursor-pointer"
        >
          🧪 Demo Test: Simulate Driver Acceptance
        </button>
      </div>
    </div>
  );

  // ── Panel: Driver Matched ────────────────────────────────────────────────
  const renderMatchedPanel = () =>
    matchedDriver && (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <span className="text-2xl font-bold text-white">{matchedDriver.name[0]}</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-lg leading-tight">{matchedDriver.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(matchedDriver.rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-white/20'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/60">
                  {matchedDriver.rating} · {matchedDriver.trips.toLocaleString()} trips
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/40 uppercase font-semibold">Arriving in</p>
              <p className="font-bold text-blue-400 text-base">{selectedTier.etaMinutes} mins</p>
            </div>
          </div>

          {/* Vehicle Credentials Card (Type, Make, Plate, Color) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-white/10 space-y-2.5 shadow-inner">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {matchedDriver.vehicleType || selectedTier.name}
                  </span>
                  {matchedDriver.vehicleColor && (
                    <span className="text-[11px] font-medium text-white/70 flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                        style={{
                          backgroundColor:
                            matchedDriver.vehicleColor.toLowerCase().includes('black')
                              ? '#111827'
                              : matchedDriver.vehicleColor.toLowerCase().includes('white')
                              ? '#f9fafb'
                              : matchedDriver.vehicleColor.toLowerCase().includes('red')
                              ? '#ef4444'
                              : matchedDriver.vehicleColor.toLowerCase().includes('blue')
                              ? '#3b82f6'
                              : matchedDriver.vehicleColor.toLowerCase().includes('grey') || matchedDriver.vehicleColor.toLowerCase().includes('gray')
                              ? '#6b7280'
                              : '#94a3b8',
                        }}
                      />
                      {matchedDriver.vehicleColor}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white leading-tight">
                  {matchedDriver.vehicleMake || matchedDriver.vehicleModel}
                </p>
                <p className="text-[11px] text-white/40">
                  Assigned {matchedDriver.vehicleType || 'Vehicle'} for this trip
                </p>
              </div>

              {/* Nigerian License Plate Badge */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="rounded-lg bg-white px-2 py-1 shadow-md border-2 border-slate-700 min-w-[105px] text-center">
                  <div className="flex items-center justify-between text-[7px] font-bold text-emerald-700 border-b border-slate-200 pb-0.5">
                    <span>🇳🇬</span>
                    <span className="tracking-tighter uppercase font-mono">PLATEAU</span>
                    <span>🇳🇬</span>
                  </div>
                  <p className="text-xs font-black font-mono tracking-widest text-slate-900 py-0.5">
                    {matchedDriver.plateNumber}
                  </p>
                  <p className="text-[6px] text-slate-500 font-semibold uppercase tracking-tight">
                    PEACE & TOURISM
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Quick Specs Grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/8 text-center text-xs">
              <div className="p-1 rounded-lg bg-white/5">
                <p className="text-[9px] text-white/40 uppercase">Make</p>
                <p className="font-semibold text-white truncate text-[11px]">
                  {matchedDriver.vehicleMake?.split(' ')[0] || 'Toyota'}
                </p>
              </div>
              <div className="p-1 rounded-lg bg-white/5">
                <p className="text-[9px] text-white/40 uppercase">Colour</p>
                <p className="font-semibold text-white truncate text-[11px]">
                  {matchedDriver.vehicleColor || 'Silver'}
                </p>
              </div>
              <div className="p-1 rounded-lg bg-white/5">
                <p className="text-[9px] text-white/40 uppercase">Type</p>
                <p className="font-semibold text-white truncate text-[11px]">
                  {matchedDriver.vehicleType || 'Sedan'}
                </p>
              </div>
            </div>
          </div>

          {/* Safety PIN */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-emerald-400 font-semibold">Safety PIN: {safetyPin}</p>
                <p className="text-[10px] text-white/40">Share with driver before departure</p>
              </div>
            </div>
            <p className="text-2xl font-mono font-bold text-emerald-300 tracking-widest">{safetyPin}</p>
          </div>

          {/* Fare Summary */}
          <div className="flex items-center justify-between pt-1 border-t border-white/8 text-sm">
            <div>
              <p className="text-xs text-white/40">Trip Fare</p>
              <p className="text-lg font-bold text-white">₦{currentFareToDisplay.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Distance</p>
              <p className="text-sm font-semibold text-white/80">
                {distanceKm > 0 ? `${distanceKm} km` : 'Direct Route'}
              </p>
            </div>
          </div>
        </div>

        {/* Contact Actions */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${matchedDriver.phone}`}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/8 border border-white/10 hover:bg-white/12 transition-all text-white font-medium text-sm"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            Call Driver
          </a>
          <button
            onClick={() => toast.info(`Driver ${matchedDriver.name} has been notified and is en-route.`)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/8 border border-white/10 hover:bg-white/12 transition-all text-white font-medium text-sm"
          >
            <MessageCircle className="w-4 h-4 text-blue-400" />
            Message
          </button>
        </div>

        {/* Start Trip Action */}
        <button
          onClick={handleStartTrip}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 transition-all font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
        >
          <Check className="w-4 h-4" />
          Driver Has Arrived – Start Trip
        </button>

        {/* Cancel Action */}
        <button
          onClick={handleCancelSearch}
          className="w-full py-2.5 text-xs text-white/40 hover:text-red-400 transition-colors cursor-pointer"
        >
          Cancel Ride
        </button>
      </div>
    );

  // ── Panel: In Transit ────────────────────────────────────────────────────
  const renderInTransitPanel = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-bold text-lg text-white">Trip in progress...</p>
        <p className="text-sm text-white/50 mt-1">Heading to {dropoffText || dropoff?.address?.split(',')[0]}</p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-[11px] text-white/40">
          <span className="truncate max-w-[140px]">{pickupText || 'Pickup'}</span>
          <span className="truncate max-w-[140px] text-right">{dropoffText || 'Destination'}</span>
        </div>
        <div className="relative h-3 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${tripProgress}%` }}
          />
        </div>
        <div className="text-center">
          <span className="text-xs text-white/60 font-mono font-medium">{Math.round(tripProgress)}% completed</span>
        </div>
      </div>

      {/* Driver & Vehicle Mini Card */}
      {matchedDriver && (
        <div className="p-3.5 rounded-xl bg-white/4 border border-white/8 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-white">{matchedDriver.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{matchedDriver.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                  {matchedDriver.vehicleType || 'Sedan'}
                </span>
              </div>
              <p className="text-xs text-white/70 truncate mt-0.5">
                {matchedDriver.vehicleColor ? matchedDriver.vehicleColor + ' ' : ''}{matchedDriver.vehicleMake || matchedDriver.vehicleModel}
              </p>
            </div>
            <a
              href={`tel:${matchedDriver.phone}`}
              className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors shrink-0"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
          {/* Plate strip */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/40 border border-white/8 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-semibold">Plate:</span>
              <span className="font-mono font-bold text-white tracking-wider">🇳🇬 {matchedDriver.plateNumber}</span>
            </div>
            <span className="text-[11px] text-white/60">Colour: {matchedDriver.vehicleColor || 'Silver'}</span>
          </div>
        </div>
      )}

      {/* Emergency SOS Button */}
      <button
        onClick={() => toast.error('🆘 Emergency SOS signal sent to security dispatch!')}
        className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-500/25 transition-all text-xs"
      >
        <AlertTriangle className="w-4 h-4" />
        Emergency Safety SOS
      </button>
    </div>
  );

  // ── Panel: Completed (Receipt & Rating) ───────────────────────────────────
  const renderCompletedPanel = () => (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="font-bold text-xl text-white">Ride Completed!</p>
        <p className="text-xs text-white/50">You have safely arrived at your destination</p>
      </div>

      {/* Trip Receipt */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <ReceiptText className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-semibold text-white/80">Trip Receipt</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/50">Vehicle</span>
            <span className="text-white/80 font-medium">{selectedTier.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Distance</span>
            <span className="text-white/80">{distanceKm > 0 ? `${distanceKm} km` : 'City Route'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Payment Method</span>
            <span className="text-white/80 capitalize">{paymentMethod}</span>
          </div>
          <div className="border-t border-white/8 pt-2 flex justify-between text-sm">
            <span className="font-semibold text-white">Total Paid</span>
            <span className="font-bold text-blue-300 text-base">₦{currentFareToDisplay.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Driver Rating */}
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-white/70">Rate your driver</p>
        {matchedDriver && (
          <p className="text-xs text-white/40">
            {matchedDriver.name} · {matchedDriver.vehicleModel}
          </p>
        )}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRatingGiven(star)}
              className="transition-transform hover:scale-125"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= (hoveredStar || ratingGiven)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-white/20'
                }`}
              />
            </button>
          ))}
        </div>
        {ratingGiven > 0 ? (
          <button
            onClick={handleSubmitRating}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all font-bold text-white text-sm"
          >
            Submit Rating & Done
          </button>
        ) : (
          <button
            onClick={handleResetAll}
            className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-white/80 text-sm font-medium"
          >
            Skip & Book Another Ride
          </button>
        )}
      </div>
    </div>
  );

  // ── Trip History Tab ─────────────────────────────────────────────────────
  const renderHistory = () => (
    <div className="space-y-3">
      {loadingHistory ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <History className="w-12 h-12 text-white/15 mx-auto" />
          <p className="text-white/40 text-sm">No trips yet. Book your first ride!</p>
          <button
            onClick={() => setMainTab('ride')}
            className="text-blue-400 text-sm font-semibold hover:text-blue-300"
          >
            Order a Ride →
          </button>
        </div>
      ) : (
        bookings.map((b) => (
          <div key={b.id} className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white capitalize">
                  {b.sub_category} {b.category !== 'private' ? `(${b.category})` : ''}
                </span>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  b.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : b.status === 'active'
                    ? 'bg-blue-500/15 text-blue-400'
                    : b.status === 'cancelled'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-yellow-500/15 text-yellow-400'
                }`}
              >
                {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-white/60">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span className="truncate">{b.pickup_location}</span>
              </div>
              {b.destination && (
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                  <span className="truncate">{b.destination}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/6 text-xs">
              <span className="text-white/40">
                {new Date(b.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-sm font-bold text-blue-300">
                ₦{Number(b.total_price).toLocaleString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ── Panel Content by Phase ────────────────────────────────────────────────
  const renderPanel = () => {
    if (mainTab === 'history') return renderHistory();
    switch (phase) {
      case 'idle':
        return renderIdlePanel();
      case 'searching':
        return renderSearchingPanel();
      case 'matched':
        return renderMatchedPanel();
      case 'in_transit':
        return renderInTransitPanel();
      case 'completed':
        return renderCompletedPanel();
      case 'rated':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">Thanks for riding with us!</p>
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        );
    }
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0f172a]">
      {/* ── Map Background ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          pickup={pickup}
          dropoff={dropoff}
          center={mapCenter}
          zoom={13}
          routePolyline={routePolyline}
        />

        {/* Map gradient overlay for panel readability */}
        <div className="absolute inset-y-0 left-0 w-full lg:w-[460px] bg-gradient-to-r from-[#0f172a] via-[#0f172acc] to-transparent pointer-events-none" />
      </div>

      {/* ── Floating Panel ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full lg:w-[420px] lg:max-w-md flex flex-col h-full bg-[#0f172a]/95 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-r border-slate-700/60">
        {/* Panel Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          {/* Branding */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Zap className="w-4 h-4 text-white fill-current" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">SwiftRide</p>
                <p className="text-white/40 text-[10px] leading-tight">by Barakah</p>
              </div>
            </div>
            {phase === 'idle' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400">Drivers Active</span>
              </div>
            )}
            {phase !== 'idle' && phase !== 'rated' && (
              <button
                onClick={handleResetAll}
                className="p-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/50 hover:text-white/80 transition-all"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Paystack Return Banner */}
          <PaymentReturn />

          {/* Main Tabs */}
          <div className="flex rounded-xl bg-white/5 border border-white/8 p-1">
            <button
              onClick={() => setMainTab('ride')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                mainTab === 'ride'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <Car className="w-4 h-4" />
              Request a Ride
            </button>
            <button
              onClick={() => {
                setMainTab('history');
                fetchHistory();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                mainTab === 'history'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <History className="w-4 h-4" />
              My Trips
              {bookings.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                  {bookings.length > 9 ? '9+' : bookings.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Panel Content */}
        <div
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-0"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="pt-2">{renderPanel()}</div>
        </div>
      </div>
    </div>
  );
}