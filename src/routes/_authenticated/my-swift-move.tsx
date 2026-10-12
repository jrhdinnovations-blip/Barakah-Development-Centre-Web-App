import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Car,
  Package,
  Navigation,
  MapPin,
  Clock,
  Search,
  History,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Check,
  X,
  Plus,
  Minus,
  Sparkles,
  CreditCard,
  RotateCcw,
  Calendar,
  Phone,
  PhoneCall,
  Star,
  Loader2,
  Weight,
  Banknote,
  Truck,
  Info,
  Copy,
  CheckCircle2,
  User,
  Locate,
  ArrowUpDown,
  DollarSign,
  MessageCircle,
} from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { InteractiveMap } from '@/components/InteractiveMap';
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
import {
  VEHICLE_TIERS,
  POPULAR_DESTINATIONS,
  calculateTierFare,
  type VehicleTier,
  type MockNearbyDriver,
  type QuickDestination,
} from '@/lib/ride-pricing';
import {
  calculateDeliveryPrice,
  getPricingBreakdown,
} from '@/lib/swift-pricing';
import {
  encodeRideMetadata,
  encodeDispatchMetadata,
  parseOrderMetadata,
} from '@/lib/swift-order';
import {
  customerCreateRideRequest,
  customerCancelRideRequest,
  driverAcceptRideRequest,
  fetchAvailableDrivers,
  customerGetActiveRide,
  customerFindActiveRide,
  customerRateRide,
  customerGetTripHistory,
  customerCreateDispatchOrder,
  customerGetDispatchHistory,
  type CustomerTripRecord,
  type CustomerDispatchRecord,
} from '@/lib/dispatcher.functions';
import { initializeSwiftPaystack } from '@/lib/payments.functions';

// ── Search Schema ────────────────────────────────────────────────────────────
const searchSchema = z
  .object({
    service: z.enum(['ride', 'parcel', 'dispatch', 'track', 'history']).optional(),
    tab: z.string().optional(),
    paid: z.string().optional(),
    orderId: z.string().optional(),
  })
  .catch({});

export const Route = createFileRoute('/_authenticated/my-swift-move')({
  validateSearch: searchSchema,
  ssr: false,
  component: UnifiedCustomerPortal,
});

// ── Types ────────────────────────────────────────────────────────────────────
type ServicePillar = 'ride' | 'parcel' | 'track' | 'history';
type LocationData = { address: string; lat: number; lng: number } | null;
type RidePhase =
  | 'idle'        // Location & tier selection
  | 'searching'   // Radar broadcasting to nearby captains
  | 'matched'     // Captain accepted, on the way to pickup
  | 'in_transit'  // Passenger in vehicle, en route to destination
  | 'completed'   // Arrived safely at destination, payment due
  | 'rated';      // Feedback submitted

const googleLibraries: ('places')[] = ['places'];
const JOS_CENTER = { lat: 9.8965, lng: 8.8583 }; // Jos, Plateau State

// ── Vehicle Tier Icons ────────────────────────────────────────────────────────
function TierIcon({ type, className = '' }: { type: string; className?: string }) {
  const base = `w-9 h-9 ${className}`;
  if (type === 'keke') {
    return (
      <svg className={base} viewBox="0 0 48 48" fill="none">
        <path d="M14 27 L18 15 L32 15 L37 23 L37 31 L14 31 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        <path d="M18 15 L10 27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M23 15 L23 27" stroke="currentColor" strokeWidth="1.5" />
        <path d="M30 20 L36 24" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="33" r="5" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="34" cy="33" r="5" stroke="currentColor" strokeWidth="2.5" />
        <path d="M7 23 L11 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
        <circle cx="13" cy="35" r="4" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="35" cy="35" r="4" stroke="currentColor" strokeWidth="2.5" />
        <path d="M12 23 L36 23" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={base} viewBox="0 0 48 48" fill="none">
      <path d="M4 30 L10 22 L18 19 L30 19 L38 22 L44 30 L44 34 L4 34 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="36" r="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="34" cy="36" r="4" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13 24 L35 24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Pulse Radar for Searching ────────────────────────────────────────────────
function RadarPulse() {
  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto my-3">
      <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-ping" style={{ animationDuration: '1.8s' }} />
      <div className="absolute inset-3 rounded-full border-2 border-orange-400/40 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }} />
      <div className="absolute inset-6 rounded-full border-2 border-orange-300/50 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '1.2s' }} />
      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center z-10 shadow-lg shadow-orange-500/40">
        <Car className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── MASTER HARMONIZED CUSTOMER PORTAL
// ═════════════════════════════════════════════════════════════════════════════
function UnifiedCustomerPortal() {
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;
  const userId = user?.id;
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  // ── 1. ACTIVE SERVICE PILLAR ──────────────────────────────────────────────
  const [activeService, setActiveService] = useState<ServicePillar>(() => {
    const s = searchParams.service;
    if (s === 'parcel' || s === 'dispatch') return 'parcel';
    if (s === 'track') return 'track';
    if (s === 'history') return 'history';
    return 'ride'; // Default to ride
  });

  // Sync state if URL query changes
  useEffect(() => {
    const s = searchParams.service;
    if (s === 'parcel' || s === 'dispatch') {
      setActiveService('parcel');
    } else if (s === 'ride') {
      setActiveService('ride');
    } else if (s === 'track') {
      setActiveService('track');
    } else if (s === 'history') {
      setActiveService('history');
    }
  }, [searchParams.service]);

  // Auto-redirect drivers, dispatchers, and admins to their respective consoles
  // if they land on /my-swift-move without an explicit service tab selected
  const metaRole = user?.user_metadata?.['role'];
  const riderCat = user?.user_metadata?.['rider_category'];
  const userEmail = user?.email?.toLowerCase() || '';

  const isDriverOrRider =
    auth?.role === 'driver' ||
    auth?.role === 'dispatch_rider' ||
    metaRole === 'driver' ||
    metaRole === 'dispatch_rider' ||
    riderCat === 'dispatch_rider';

  const isDispatcher =
    auth?.role === 'swift_dispatcher' ||
    auth?.role === 'dispatcher' ||
    metaRole === 'swift_dispatcher' ||
    metaRole === 'dispatcher';

  const isAdminUser =
    auth?.role === 'administrator' ||
    auth?.role === 'admin' ||
    auth?.role === 'swift_manager' ||
    metaRole === 'administrator' ||
    ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com', 'raymondlongdiem22@gmail.com'].includes(userEmail);

  useEffect(() => {
    if (!user) return;
    if (!searchParams.service && !searchParams.orderId) {
      if (isDriverOrRider) {
        navigate({ to: '/drive' as any });
      } else if (isDispatcher) {
        navigate({ to: '/dispatcher' as any });
      }
    }
  }, [user, isDriverOrRider, isDispatcher, searchParams.service, searchParams.orderId, navigate]);

  const switchService = (newService: ServicePillar) => {
    setActiveService(newService);
    navigate({
      search: { service: newService } as any,
    });
  };

  // ── 2. SHARED LOCATION & ROUTE STATE ──────────────────────────────────────
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] || '',
    libraries: googleLibraries,
  });

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickup, setPickup] = useState<LocationData>(null);
  const [dropoff, setDropoff] = useState<LocationData>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationText, setDurationText] = useState('');
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Suggestions & Autocomplete
  const [activeSuggestionField, setActiveSuggestionField] = useState<'pickup' | 'dropoff' | null>(null);
  const [liveSuggestions, setLiveSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Map Center
  const mapCenter = useMemo(() => {
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    return JOS_CENTER;
  }, [pickup?.lat, pickup?.lng]);

  // Real-time suggestions debouncer
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

  // Geocode / Fallback resolver
  const resolveLocationFromText = async (text: string): Promise<LocationData> => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return null;
    if (trimmed.toLowerCase().includes('current location') || trimmed.toLowerCase().includes('live gps')) return null;

    const match = resolveJosLocation(trimmed);
    if (match && match.lat && match.lng) {
      return {
        address: `${match.label}, ${match.sublabel}`,
        lat: match.lat,
        lng: match.lng,
      };
    }

    const geo = await resolveAddressToCoordinates(trimmed).catch(() => null);
    if (geo && geo.lat && geo.lng) {
      return {
        address: geo.address,
        lat: geo.lat,
        lng: geo.lng,
      };
    }
    return null;
  };

  // Debounced auto-resolution
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

  // Route calculation
  useEffect(() => {
    if (!pickup || !dropoff) {
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
      const fallback = { address: 'Jos Main Market / Terminus, Jos', lat: 9.9248, lng: 8.8912 };
      setPickup(fallback);
      setPickupText(fallback.address);
      if (pickupInputRef.current) pickupInputRef.current.value = fallback.address;
    } finally {
      setIsLocatingGps(false);
    }
  };

  const handleSwapLocations = () => {
    const oldP = pickup;
    const oldD = dropoff;
    const oldPT = pickupText;
    const oldDT = dropoffText;
    setPickup(oldD);
    setDropoff(oldP);
    setPickupText(oldDT);
    setDropoffText(oldPT);
    if (pickupInputRef.current) pickupInputRef.current.value = oldDT;
    if (dropoffInputRef.current) dropoffInputRef.current.value = oldPT;
  };

  const handleQuickDestination = (dest: QuickDestination) => {
    const fullAddress = `${dest.name}, ${dest.address}`;
    setDropoff({ address: fullAddress, lat: dest.lat, lng: dest.lng });
    setDropoffText(dest.name);
    if (dropoffInputRef.current) dropoffInputRef.current.value = dest.name;
    if (!pickup && !pickupText.trim()) {
      handleLocateMe();
    }
  };

  // ── 3. RIDE HAILING STATE & FUNCTIONS ──────────────────────────────────────
  const [ridePhase, setRidePhase] = useState<RidePhase>('idle');
  const [selectedTier, setSelectedTier] = useState<VehicleTier>(VEHICLE_TIERS[0]!);
  const [useInDriveMode, setUseInDriveMode] = useState(false);
  const [customFare, setCustomFare] = useState(0);
  const [ridePaymentMethod, setRidePaymentMethod] = useState<'cash' | 'paystack' | 'wallet'>('cash');
  const [isTripPaid, setIsTripPaid] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [matchedDriver, setMatchedDriver] = useState<MockNearbyDriver | null>(null);
  const [safetyPin, setSafetyPin] = useState('');
  const [activeRideOrderId, setActiveRideOrderId] = useState<string | null>(null);
  const [activeRideOrder, setActiveRideOrder] = useState<any>(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [ratingGiven, setRatingGiven] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  // Ride Scheduling
  const [rideTiming, setRideTiming] = useState<'now' | 'scheduled'>('now');
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0]!, []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]!, []);
  const [rideSchedDate, setRideSchedDate] = useState<string>(todayStr);
  const [rideSchedTime, setRideSchedTime] = useState<string>('09:30');

  // Available Drivers
  const [availableDrivers, setAvailableDrivers] = useState<MockNearbyDriver[]>([]);
  const [onlineDriversCount, setOnlineDriversCount] = useState<number>(0);

  const loadDrivers = useCallback(async () => {
    try {
      const cLat = pickup?.lat || JOS_CENTER.lat;
      const cLng = pickup?.lng || JOS_CENTER.lng;
      const res = await fetchAvailableDrivers({
        data: { centerLat: cLat, centerLng: cLng },
      });
      if (res?.drivers) {
        setAvailableDrivers(res.drivers as MockNearbyDriver[]);
        setOnlineDriversCount(res.totalCount || res.drivers.length);
      }
    } catch (e) {
      console.warn('Failed to load available drivers:', e);
    }
  }, [pickup?.lat, pickup?.lng]);

  useEffect(() => {
    loadDrivers();
    const channel = supabase
      .channel('swift-active-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        loadDrivers();
      })
      .subscribe();
    const interval = setInterval(loadDrivers, 12000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadDrivers]);

  // Dynamic Tier Fares
  const tierFares = useMemo(() => {
    return VEHICLE_TIERS.map((tier) => ({
      ...tier,
      fare: distanceKm > 0 ? calculateTierFare(tier, distanceKm) : tier.baseFare,
      hasRealFare: distanceKm > 0,
    }));
  }, [distanceKm]);

  const activeRideFare = useMemo(() => {
    if (distanceKm > 0) {
      return calculateTierFare(selectedTier, distanceKm);
    }
    return selectedTier.baseFare;
  }, [selectedTier, distanceKm]);

  useEffect(() => {
    if (activeRideFare > 0 && ridePhase === 'idle' && !useInDriveMode) {
      setCustomFare(activeRideFare);
    }
  }, [activeRideFare, ridePhase, useInDriveMode]);

  const currentFareToDisplay = useInDriveMode ? customFare : activeRideFare;

  // Process Ride Order Update
  const processRideOrderUpdate = useCallback(
    (order: any) => {
      if (!order) return;
      setActiveRideOrder(order);
      const meta = parseOrderMetadata(order.package_type);

      if (order.status === 'accepted') {
        const driverName = meta.driverName || (order as any).driver_name || 'Swift Driver';
        const driverPhone = meta.driverPhone || (order as any).driver_phone || '08000000000';
        const driverRating = meta.driverRating || (order as any).driver_rating || 4.9;
        const driverLat = order.driver_lat ?? (pickup?.lat ?? JOS_CENTER.lat);
        const driverLng = order.driver_lng ?? (pickup?.lng ?? JOS_CENTER.lng);

        const driver: MockNearbyDriver = {
          id: order.driver_id || 'driver-1',
          name: driverName,
          phone: driverPhone,
          rating: driverRating,
          trips: 240,
          vehicleType: meta.tierName || selectedTier.name,
          vehicleMake: meta.vehicleMake || 'Toyota Corolla',
          vehicleModel: meta.vehicleMake || 'Toyota Corolla',
          plateNumber: meta.plateNumber || 'JOS-829-AA',
          vehicleColor: meta.vehicleColor || 'Silver',
          tierId: selectedTier.id,
          lat: driverLat,
          lng: driverLng,
        };
        setMatchedDriver(driver);
        if (meta.safetyPin) setSafetyPin(meta.safetyPin);
        setRidePhase((prev) => {
          if (prev !== 'in_transit' && prev !== 'completed' && prev !== 'rated') {
            if (prev === 'searching' || prev === 'idle') {
              toast.success(`🚗 Driver found! ${driver.name} is on the way.`);
            }
            return 'matched';
          }
          return prev;
        });
      } else if (order.status === 'picked_up') {
        setRidePhase('matched');
        toast.info('Driver has arrived at pickup!');
      } else if (order.status === 'in_transit') {
        setRidePhase('in_transit');
        toast.info('Trip in progress — en route to destination!');
      } else if (order.status === 'delivered') {
        setRidePhase('completed');
        toast.success('🎉 You have arrived safely at your destination!');
      } else if (order.status === 'cancelled') {
        toast.error('Ride request was cancelled.');
        handleResetRide();
      }
    },
    [selectedTier, pickup]
  );

  const handleResetRide = useCallback(() => {
    setRidePhase('idle');
    setMatchedDriver(null);
    setSafetyPin('');
    setActiveRideOrderId(null);
    setActiveRideOrder(null);
    setIsTripPaid(false);
    setRatingGiven(0);
    setRideTiming('now');
  }, []);

  // Subscribe to active ride order changes
  useEffect(() => {
    if (!activeRideOrderId) return;
    const poll = async () => {
      try {
        const res = await customerGetActiveRide({
          data: { orderId: activeRideOrderId, customerId: userId || '' },
        });
        if (res?.order) processRideOrderUpdate(res.order);
      } catch (e) {
        console.warn('[customerGetActiveRide poll] error:', e);
      }
    };
    poll();

    const channel = supabase
      .channel(`customer-ride-order-${activeRideOrderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'swift_deliveries', filter: `id=eq.${activeRideOrderId}` },
        (payload: any) => {
          processRideOrderUpdate(payload.new);
        }
      )
      .subscribe();

    const interval = setInterval(poll, 2500);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeRideOrderId, processRideOrderUpdate, userId]);

  // Active Ride session recovery on mount
  useEffect(() => {
    if (!userId) return;
    let active = true;
    customerFindActiveRide({ data: { customerId: userId } })
      .then((res) => {
        if (!active || !res?.order) return;
        const data = res.order;
        const meta = parseOrderMetadata(data.package_type);
        if (!meta.isRide && !data.package_type?.toLowerCase().includes('ride')) return;

        setActiveRideOrderId(data.id);
        setActiveRideOrder(data);
        if (data.pickup_address) {
          setPickupText(data.pickup_address);
          const pMatch = resolveJosLocation(data.pickup_address);
          if (pMatch?.lat && pMatch?.lng) setPickup({ address: data.pickup_address, lat: pMatch.lat, lng: pMatch.lng });
        }
        if (data.dropoff_address) {
          setDropoffText(data.dropoff_address);
          const dMatch = resolveJosLocation(data.dropoff_address);
          if (dMatch?.lat && dMatch?.lng) setDropoff({ address: data.dropoff_address, lat: dMatch.lat, lng: dMatch.lng });
        }
        processRideOrderUpdate(data);
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, [userId, processRideOrderUpdate]);

  // Submit Ride Request
  const handleConfirmRideRequest = async () => {
    const rawP = pickupText.trim();
    const rawD = dropoffText.trim();
    if (!rawP || !rawD) {
      toast.error('Please enter both pickup and destination in Jos');
      return;
    }

    let activeP = pickup;
    let activeD = dropoff;
    if (!activeP) {
      activeP = await resolveLocationFromText(rawP);
      if (activeP) setPickup(activeP);
    }
    if (!activeD) {
      activeD = await resolveLocationFromText(rawD);
      if (activeD) setDropoff(activeD);
    }
    if (!activeP || !activeD) {
      toast.error('Could not locate pickup or destination. Please select a recognized Jos location.');
      return;
    }

    const calculatedDist = distanceKm > 0 ? distanceKm : Math.max(1.8, Math.round(haversineKm(activeP.lat, activeP.lng, activeD.lat, activeD.lng) * 1.35 * 10) / 10);
    const calculatedFare = useInDriveMode && customFare > 0 ? customFare : calculateTierFare(selectedTier, calculatedDist);

    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
    setSafetyPin(generatedPin);
    const trackingId = `SMR-${Math.floor(100000 + Math.random() * 900000)}`;

    const metadata = encodeRideMetadata({
      tierName: selectedTier.name,
      tierId: selectedTier.id,
      seats: selectedTier.capacity,
      safetyPin: generatedPin,
      customerPhone: user?.phone || user?.user_metadata?.phone || '',
      notes: useInDriveMode ? `Customer offered fare: ₦${calculatedFare.toLocaleString()}` : `Standard Ride`,
      isScheduled: rideTiming === 'scheduled',
      scheduledDate: rideTiming === 'scheduled' ? (rideSchedDate || null) : null,
      scheduledTime: rideTiming === 'scheduled' ? (rideSchedTime || null) : null,
    });

    setRidePhase('searching');
    toast.loading('Broadcasting ride request to nearby drivers...', { id: 'ride-req' });

    try {
      const res = await customerCreateRideRequest({
        data: {
          customerId: userId || 'anon-customer',
          pickupAddress: activeP.address,
          dropoffAddress: activeD.address,
          packageType: metadata,
          capacity: selectedTier.capacity,
          distanceKm: calculatedDist,
          fare: calculatedFare,
          trackingId,
          category: selectedTier.category,
          subCategoryDb: selectedTier.subCategoryDb,
        },
      });

      if (res?.delivery?.id) {
        setActiveRideOrderId(res.delivery.id);
        setActiveRideOrder(res.delivery);
        toast.success('Captains notified! Searching for nearest driver...', { id: 'ride-req' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not dispatch ride request', { id: 'ride-req' });
      setRidePhase('idle');
    }
  };

  const handleCancelRideRequest = async () => {
    if (!activeRideOrderId) {
      handleResetRide();
      return;
    }
    toast.loading('Cancelling ride request...', { id: 'cancel-ride' });
    try {
      await customerCancelRideRequest({
        data: {
          orderId: activeRideOrderId,
          customerId: userId || '',
        },
      });
      toast.success('Ride request cancelled.', { id: 'cancel-ride' });
      handleResetRide();
    } catch (e: any) {
      toast.error(e?.message || 'Could not cancel ride', { id: 'cancel-ride' });
    }
  };

  const handlePayRidePaystack = async () => {
    if (!activeRideOrderId) return;
    setIsProcessingPayment(true);
    toast.loading('Opening Paystack checkout...', { id: 'pay-ride' });
    try {
      const res = await initializeSwiftPaystack({
        data: {
          entityType: 'swift_ride',
          entityId: activeRideOrderId,
          amountKobo: Math.round(currentFareToDisplay * 100),
          description: `SwiftMove Ride Fare (${activeRideOrderId})`,
          callbackPath: `/my-swift-move?service=ride&paid=true&orderId=${activeRideOrderId}`,
        },
      });
      if (res?.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        toast.error('Could not initialize Paystack', { id: 'pay-ride' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment initialization failed', { id: 'pay-ride' });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmRideCash = () => {
    setIsTripPaid(true);
    toast.success('Cash payment recorded! Please rate your driver.');
  };

  const handleRateDriver = async (rating: number) => {
    setRatingGiven(rating);
    if (activeRideOrderId) {
      try {
        await customerRateRide({
          data: {
            orderId: activeRideOrderId,
            customerId: userId || '',
            rating,
          },
        });
      } catch (_) {}
    }
    toast.success(`Thank you for rating ${rating} stars!`);
    setTimeout(() => {
      handleResetRide();
    }, 1800);
  };

  // ── 4. PARCEL DISPATCH STATE & FUNCTIONS ──────────────────────────────────
  const [parcelStep, setParcelStep] = useState<1 | 2 | 3>(1);
  const [parcelCategory, setParcelCategory] = useState<'document' | 'parcel' | 'fragile' | 'bulk'>('parcel');
  const [weightKg, setWeightKg] = useState<number | ''>(2);
  const [parcelDescription, setParcelDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [parcelTiming, setParcelTiming] = useState<'now' | 'scheduled'>('now');
  const [parcelSchedDate, setParcelSchedDate] = useState<string>(todayStr);
  const [parcelSchedTime, setParcelSchedTime] = useState<string>('09:30');

  // Parcel Order State
  const [activeParcelOrder, setActiveParcelOrder] = useState<any>(null);
  const [isBookingParcel, setIsBookingParcel] = useState(false);
  const [parcelPaymentMethod, setParcelPaymentMethod] = useState<'paystack' | 'transfer' | null>('paystack');
  const [showParcelPaymentModal, setShowParcelPaymentModal] = useState(false);
  const [isConfirmingParcelPayment, setIsConfirmingParcelPayment] = useState(false);
  const [parcelPaymentDone, setParcelPaymentDone] = useState(false);

  // Parcel Fare Calculation
  const parcelFare = useMemo(() => {
    const safeW = typeof weightKg === 'number' && weightKg > 0 ? weightKg : 2;
    return calculateDeliveryPrice(distanceKm || 3.5, safeW);
  }, [distanceKm, weightKg]);

  const pricingBreakdown = useMemo(() => {
    const safeW = typeof weightKg === 'number' && weightKg > 0 ? weightKg : 2;
    return getPricingBreakdown(distanceKm || 3.5, safeW);
  }, [distanceKm, weightKg]);

  const handleProceedToParcelStep2 = async () => {
    const rawP = pickupText.trim();
    const rawD = dropoffText.trim();
    if (!rawP || !rawD) {
      toast.error('Please enter both pickup and destination addresses');
      return;
    }
    let activeP = pickup;
    let activeD = dropoff;
    if (!activeP) {
      activeP = await resolveLocationFromText(rawP);
      if (activeP) setPickup(activeP);
    }
    if (!activeD) {
      activeD = await resolveLocationFromText(rawD);
      if (activeD) setDropoff(activeD);
    }
    if (!activeP || !activeD) {
      toast.error('Could not locate pickup or delivery address. Please pick a recognized Jos landmark.');
      return;
    }
    setParcelStep(2);
  };

  const handleProceedToParcelStep3 = () => {
    if (!recipientName.trim()) {
      toast.error('Please enter the recipient name');
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.length < 8) {
      toast.error('Please enter a valid recipient phone number');
      return;
    }
    setParcelStep(3);
  };

  const handleConfirmParcelOrder = async () => {
    if (!pickup || !dropoff) return;
    setIsBookingParcel(true);
    toast.loading('Creating express dispatch order...', { id: 'create-dispatch' });

    const trackingId = `SMD-${Math.floor(100000 + Math.random() * 900000)}`;
    const metadata = encodeDispatchMetadata({
      cargoType: `Express ${parcelCategory.toUpperCase()}`,
      customerPhone: user?.phone || user?.user_metadata?.phone || '',
      description: `Recipient: ${recipientName.trim()} (${recipientPhone.trim()}). ${parcelDescription.trim()}`,
      isScheduled: parcelTiming === 'scheduled',
      scheduledDate: parcelTiming === 'scheduled' ? (parcelSchedDate || null) : null,
      scheduledTime: parcelTiming === 'scheduled' ? (parcelSchedTime || null) : null,
    });

    try {
      const res = await customerCreateDispatchOrder({
        data: {
          customerId: userId || 'anon-customer',
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
          packageType: metadata,
          weightKg: typeof weightKg === 'number' ? weightKg : 2,
          distanceKm: distanceKm || 3.5,
          fare: parcelFare,
          trackingId,
        },
      });

      if (res?.delivery) {
        setActiveParcelOrder(res.delivery);
        setShowParcelPaymentModal(true);
        toast.success('Dispatch order initialized! Please complete payment.', { id: 'create-dispatch' });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not create parcel order', { id: 'create-dispatch' });
    } finally {
      setIsBookingParcel(false);
    }
  };

  const handlePayParcelPaystack = async () => {
    if (!activeParcelOrder?.id) return;
    setIsConfirmingParcelPayment(true);
    toast.loading('Connecting to Paystack...', { id: 'paystack-init' });
    try {
      const res = await initializeSwiftPaystack({
        data: {
          entityType: 'swift_delivery',
          entityId: activeParcelOrder.id,
          amountKobo: Math.round(parcelFare * 100),
          description: `SwiftMove Parcel Dispatch (${activeParcelOrder.id})`,
          callbackPath: `/my-swift-move?service=parcel&paid=true&orderId=${activeParcelOrder.id}`,
        },
      });
      if (res?.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        toast.error('Paystack initialization failed', { id: 'paystack-init' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed', { id: 'paystack-init' });
    } finally {
      setIsConfirmingParcelPayment(false);
    }
  };

  const handleConfirmParcelTransfer = async () => {
    if (!activeParcelOrder?.id) return;
    setIsConfirmingParcelPayment(true);
    try {
      await (supabase.from('swift_deliveries') as any)
        .update({ status: 'pending', payment_method: 'bank_transfer' })
        .eq('id', activeParcelOrder.id);
      setParcelPaymentDone(true);
      toast.success('Bank transfer recorded! Awaiting dispatcher confirmation.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order');
    } finally {
      setIsConfirmingParcelPayment(false);
    }
  };

  // ── 5. TRACKING TAB STATE & FUNCTIONS ─────────────────────────────────────
  const [trackingQueryInput, setTrackingQueryInput] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [trackingError, setTrackingError] = useState('');

  const handleTrackQuery = async (queryToSearch?: string) => {
    const q = (queryToSearch ?? trackingQueryInput).trim();
    if (!q) {
      setTrackingError('Please enter a tracking ID or reference code.');
      return;
    }
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingResult(null);

    try {
      const { data, error } = await supabase
        .from('swift_deliveries')
        .select('*')
        .or(`payment_reference.eq.${q},id.eq.${q}`)
        .maybeSingle();

      if (data) {
        setTrackingResult(data);
        return;
      }

      // Partial fallback
      const { data: partial } = await supabase
        .from('swift_deliveries')
        .select('*')
        .ilike('payment_reference', `%${q}%`)
        .limit(1)
        .maybeSingle();

      if (partial) {
        setTrackingResult(partial);
        return;
      }
      setTrackingError('No ride or parcel found with that reference. Please check and try again.');
    } catch (e: any) {
      setTrackingError('Tracking lookup failed. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  // ── 6. UNIFIED HISTORY STATE & FUNCTIONS ──────────────────────────────────
  const [unifiedHistory, setUnifiedHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'rides' | 'parcels' | 'active' | 'completed'>('all');

  const fetchUnifiedHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const { data: rows } = await supabase
        .from('swift_deliveries')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      const mapped = (rows || []).map((row) => {
        const meta = parseOrderMetadata(row.package_type);
        const isRide = meta.isRide || row.package_type?.toLowerCase().includes('ride');
        return {
          id: row.id,
          reference: row.payment_reference || `REF-${row.id.slice(0, 8)}`,
          type: isRide ? 'ride' : 'parcel',
          title: isRide ? meta.tierName || 'Passenger Ride' : meta.tierName || 'Parcel Dispatch',
          status: row.status || 'pending',
          createdAt: row.created_at,
          pickupAddress: row.pickup_address,
          dropoffAddress: row.dropoff_address,
          fare: row.estimated_price || 0,
          distanceKm: row.distance_km,
          weightKg: row.weight_kg,
          driverName: meta.driverName,
          driverPhone: meta.driverPhone,
          plateNumber: meta.plateNumber,
          notes: meta.customerNotes,
        };
      });
      setUnifiedHistory(mapped);
    } catch (e) {
      console.warn('History fetch error:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeService === 'history') {
      fetchUnifiedHistory();
    }
  }, [activeService, fetchUnifiedHistory]);

  const filteredHistory = useMemo(() => {
    return unifiedHistory.filter((item) => {
      const q = historySearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.reference?.toLowerCase().includes(q) ||
        item.pickupAddress?.toLowerCase().includes(q) ||
        item.dropoffAddress?.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (historyFilter === 'rides') return item.type === 'ride';
      if (historyFilter === 'parcels') return item.type === 'parcel';
      if (historyFilter === 'active') return ['pending', 'searching', 'accepted', 'in_transit', 'assigned'].includes(item.status);
      if (historyFilter === 'completed') return ['delivered', 'completed'].includes(item.status);
      return true;
    });
  }, [unifiedHistory, historySearch, historyFilter]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RENDER SUB-PANELS
  // ═══════════════════════════════════════════════════════════════════════════

  // Shared Location Input Card
  const renderSharedLocationInputs = () => (
    <div className="relative">
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 space-y-2.5 shadow-sm">
        {/* Pickup Input */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
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
            placeholder="Pickup location (e.g. Terminus, Rayfield, UNIJOS)..."
            className="w-full min-w-0 flex-1 py-1.5 bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {pickupText ? (
            <button
              type="button"
              onClick={() => {
                setPickupText('');
                setPickup(null);
                if (pickupInputRef.current) pickupInputRef.current.value = '';
              }}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocatingGps}
              className="text-blue-600 hover:text-blue-800 p-1 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
              title="Detect live GPS location"
            >
              {isLocatingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Locate className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">GPS</span>
            </button>
          )}
        </div>

        {/* Divider with Swap Button */}
        <div className="relative flex items-center justify-between pl-6 pr-2">
          <div className="h-px bg-slate-100 flex-1" />
          <button
            type="button"
            onClick={handleSwapLocations}
            className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors mx-2 cursor-pointer shadow-xs"
            title="Swap locations"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        {/* Destination / Dropoff Input */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
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
            placeholder="Destination in Jos (e.g. Airport, Bukuru, JUTH)..."
            className="w-full min-w-0 flex-1 py-1.5 bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {dropoffText && (
            <button
              type="button"
              onClick={() => {
                setDropoffText('');
                setDropoff(null);
                if (dropoffInputRef.current) dropoffInputRef.current.value = '';
              }}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Suggestions Overlay */}
      {activeSuggestionField && liveSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in-0 duration-150">
          <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-orange-500" />
              Suggested Locations in Jos
            </span>
            {isLoadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {liveSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={async (e) => {
                  e.preventDefault();
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
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 active:bg-orange-50 transition-colors group cursor-pointer"
              >
                <span className="text-sm shrink-0 mt-0.5">{item.iconEmoji || '📍'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Render Ride Pillar ─────────────────────────────────────────────────────
  const renderRidePanel = () => {
    // If radar searching
    if (ridePhase === 'searching') {
      return (
        <div className="space-y-4 py-2 text-center animate-in fade-in duration-300">
          <RadarPulse />
          <div>
            <h3 className="text-base font-bold text-slate-900">Broadcasting to Nearby Captains</h3>
            <p className="text-xs text-slate-500 mt-1">
              Matching you with the closest verified driver in Jos...
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Vehicle:</span>
              <span className="font-bold text-slate-900">{selectedTier.name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Fare:</span>
              <span className="font-bold text-blue-700">₦{currentFareToDisplay.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Safety PIN:</span>
              <span className="font-mono font-black text-orange-600 text-sm tracking-wider">{safetyPin}</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleCancelRideRequest}
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
          >
            Cancel Request
          </Button>
        </div>
      );
    }

    // If driver matched
    if (ridePhase === 'matched') {
      return (
        <div className="space-y-4 py-1 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Driver En Route
              </span>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                PIN: {safetyPin}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                {matchedDriver?.name.charAt(0) || 'D'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{matchedDriver?.name || 'Swift Driver'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {matchedDriver?.vehicleModel} · {matchedDriver?.plateNumber}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold mt-0.5">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>{matchedDriver?.rating || 4.9}</span>
                  <span className="text-slate-400 font-normal">· Verified Captain</span>
                </div>
              </div>
            </div>

            {matchedDriver?.phone && (
              <a
                href={`tel:${matchedDriver.phone}`}
                className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Driver ({matchedDriver.phone})
              </a>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Destination</p>
            <p className="text-slate-800 font-medium truncate">{dropoff?.address || dropoffText}</p>
            <div className="pt-2 border-t border-slate-200 flex justify-between">
              <span className="text-slate-500">Trip Fare</span>
              <span className="font-bold text-slate-900">₦{currentFareToDisplay.toLocaleString()}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={handleCancelRideRequest}
            className="w-full text-xs text-red-600 hover:bg-red-50 font-semibold"
          >
            Cancel Trip
          </Button>
        </div>
      );
    }

    // In transit
    if (ridePhase === 'in_transit') {
      return (
        <div className="space-y-4 py-2 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full animate-pulse">
              <Car className="w-3.5 h-3.5" />
              Trip In Progress
            </span>
            <p className="text-sm font-bold text-slate-900">On the way to destination</p>
            <p className="text-xs text-slate-600 truncate">{dropoff?.address || dropoffText}</p>
          </div>

          <Button
            onClick={() => setShowSosModal(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <Shield className="w-3.5 h-3.5" />
            Emergency SOS
          </Button>
        </div>
      );
    }

    // Completed / Payment
    if (ridePhase === 'completed') {
      return (
        <div className="space-y-4 py-2 text-center animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">You Have Arrived!</h3>
            <p className="text-xs text-slate-500">Total fare due: ₦{currentFareToDisplay.toLocaleString()}</p>
          </div>

          {!isTripPaid ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left">
              <p className="text-xs font-bold text-slate-700">Choose Payment Method:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRidePaymentMethod('cash')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer ${
                    ridePaymentMethod === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  💵 Cash to Driver
                </button>
                <button
                  type="button"
                  onClick={() => setRidePaymentMethod('paystack')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer ${
                    ridePaymentMethod === 'paystack' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  💳 Card / Paystack
                </button>
              </div>

              {ridePaymentMethod === 'cash' ? (
                <Button onClick={handleConfirmRideCash} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  I Paid Cash to Driver
                </Button>
              ) : (
                <Button
                  onClick={handlePayRidePaystack}
                  disabled={isProcessingPayment}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  {isProcessingPayment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Pay via Paystack
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">Rate your Captain:</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => handleRateDriver(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= (hoveredStar || ratingGiven)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default Idle View
    return (
      <div className="space-y-3.5">
        {/* Shared Locations */}
        {renderSharedLocationInputs()}

        {/* Quick Destinations */}
        {!dropoffText && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Popular in Jos</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_DESTINATIONS.slice(0, 5).map((dest) => (
                <button
                  key={dest.label}
                  type="button"
                  onClick={() => handleQuickDestination(dest)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 transition-all cursor-pointer shadow-2xs"
                >
                  <span>{dest.iconEmoji}</span>
                  <span>{dest.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Info Badge */}
        {pickup && dropoff && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
            <div className="flex items-center gap-2 text-slate-800">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              {distanceKm > 0 ? (
                <>
                  <span className="font-bold text-slate-900">{distanceKm} km</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{durationText}</span>
                </>
              ) : isCalculatingRoute ? (
                <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Calculating road distance…
                </span>
              ) : null}
            </div>
            <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">
              Live Route
            </span>
          </div>
        )}

        {/* Vehicle Tier Picker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Choose Ride Type</p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {onlineDriversCount > 0 ? `${onlineDriversCount} online` : 'Drivers ready'}
            </span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
            {tierFares.map((tier) => {
              const isSelected = selectedTier.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setSelectedTier(tier);
                    if (!useInDriveMode) setCustomFare(tier.fare);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                    <TierIcon type={tier.iconType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{tier.name}</span>
                      {tier.popular && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{tier.subTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span>{tier.capacity} seats</span>
                      <span>·</span>
                      <span>~{tier.etaMinutes}m away</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-sm sm:text-base text-slate-900">₦{tier.fare.toLocaleString()}</p>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 ml-auto mt-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* InDrive Negotiable Fare */}
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span className="font-bold text-slate-800">Offer Your Own Fare</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !useInDriveMode;
                setUseInDriveMode(next);
                if (next && customFare <= 0) setCustomFare(activeRideFare);
              }}
              className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${
                useInDriveMode ? 'bg-orange-600' : 'bg-slate-200'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${
                  useInDriveMode ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {useInDriveMode && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCustomFare((prev) => Math.max(500, prev - 100))}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
              >
                -
              </button>
              <span className="font-black text-sm text-slate-900">₦{customFare.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => setCustomFare((prev) => prev + 100)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Instant Ride CTA */}
        <Button
          onClick={handleConfirmRideRequest}
          disabled={!pickupText.trim() || !dropoffText.trim()}
          className="w-full h-11 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm rounded-xl shadow-md cursor-pointer transition-all"
        >
          <Car className="w-4 h-4 mr-2" />
          Order Ride · ₦{currentFareToDisplay.toLocaleString()}
        </Button>
      </div>
    );
  };

  // ── Render Parcel Pillar ───────────────────────────────────────────────────
  const renderParcelPanel = () => {
    // Step 1: Locations
    if (parcelStep === 1) {
      return (
        <div className="space-y-3.5">
          {renderSharedLocationInputs()}

          {/* Route Distance */}
          {pickup && dropoff && distanceKm > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-orange-50 border border-orange-200 text-xs">
              <div className="flex items-center gap-2 text-slate-800">
                <Truck className="w-3.5 h-3.5 text-orange-600" />
                <span className="font-bold text-slate-900">{distanceKm} km</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{durationText}</span>
              </div>
              <span className="text-[10px] text-orange-800 font-bold uppercase tracking-wider bg-orange-100 px-2 py-0.5 rounded-full">
                Delivery Route
              </span>
            </div>
          )}

          <Button
            onClick={handleProceedToParcelStep2}
            disabled={!pickupText.trim() || !dropoffText.trim()}
            className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm rounded-xl shadow-md cursor-pointer"
          >
            Continue to Parcel Details <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      );
    }

    // Step 2: Parcel Details
    if (parcelStep === 2) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Step 2: Parcel Info</span>
            <button
              type="button"
              onClick={() => setParcelStep(1)}
              className="text-xs text-orange-600 hover:underline font-semibold cursor-pointer"
            >
              ← Back to Route
            </button>
          </div>

          {/* Package Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Package Category</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'document', label: '📄 Document', desc: 'Letters, paperwork' },
                { id: 'parcel', label: '📦 Parcel', desc: 'Standard goods' },
                { id: 'fragile', label: '🍷 Fragile', desc: 'Glass, electronics' },
                { id: 'bulk', label: '🏋️ Bulk Freight', desc: 'Heavy boxes' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setParcelCategory(cat.id as any)}
                  className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    parcelCategory === cat.id
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold ring-1 ring-orange-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold">{cat.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight (kg)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || '')}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500"
                placeholder="2 kg"
              />
              <span className="text-xs text-slate-500 font-bold">KG</span>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recipient Contact</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient Full Name"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500"
            />
            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Recipient Phone Number (e.g. 080...)"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Notes */}
          <input
            type="text"
            value={parcelDescription}
            onChange={(e) => setParcelDescription(e.target.value)}
            placeholder="Package notes (e.g. 'Handle gently', 'Leave with gate')"
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500"
          />

          <Button
            onClick={handleProceedToParcelStep3}
            className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm rounded-xl cursor-pointer"
          >
            Review Fare & Payment <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      );
    }

    // Step 3: Review & Checkout
    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Step 3: Review & Book</span>
          <button
            type="button"
            onClick={() => setParcelStep(2)}
            className="text-xs text-orange-600 hover:underline font-semibold cursor-pointer"
          >
            ← Edit Details
          </button>
        </div>

        {/* Pricing Summary */}
        <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Base Dispatch Fare</span>
            <span className="font-semibold text-slate-800">₦{pricingBreakdown.baseFare.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Distance Cost ({pricingBreakdown.distanceKm} km)</span>
            <span className="font-semibold text-slate-800">₦{pricingBreakdown.distanceCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Weight Cost ({pricingBreakdown.weightKg} kg)</span>
            <span className="font-semibold text-slate-800">₦{pricingBreakdown.weightCost.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t border-orange-200 flex justify-between text-sm">
            <span className="font-bold text-slate-900">Total Delivery Price</span>
            <span className="font-black text-orange-600 text-base">₦{parcelFare.toLocaleString()}</span>
          </div>
        </div>

        {/* Recipient Snapshot */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Recipient</p>
          <p className="font-bold text-slate-900">{recipientName} · {recipientPhone}</p>
          <p className="text-slate-500 truncate text-[11px]">{dropoff?.address}</p>
        </div>

        <Button
          onClick={handleConfirmParcelOrder}
          disabled={isBookingParcel}
          className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm rounded-xl cursor-pointer"
        >
          {isBookingParcel ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
          Proceed to Payment · ₦{parcelFare.toLocaleString()}
        </Button>
      </div>
    );
  };

  // ── Render Track Pillar ────────────────────────────────────────────────────
  const renderTrackPanel = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Enter Tracking ID or Reference
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={trackingQueryInput}
            onChange={(e) => setTrackingQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrackQuery()}
            placeholder="e.g. SMR-104928, SMD-892110..."
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500 uppercase font-mono"
          />
          <Button
            onClick={() => handleTrackQuery()}
            disabled={trackingLoading}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl"
          >
            {trackingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {trackingError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
          {trackingError}
        </div>
      )}

      {trackingResult && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 animate-in fade-in duration-200 shadow-sm text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <span className="font-mono font-black text-sm text-slate-900 block">{trackingResult.payment_reference}</span>
              <span className="text-[10px] text-slate-400">
                Created: {new Date(trackingResult.created_at).toLocaleDateString()}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 capitalize">
              {trackingResult.status?.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Pickup</p>
                <p className="font-semibold text-slate-800 truncate">{trackingResult.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Destination</p>
                <p className="font-semibold text-slate-800 truncate">{trackingResult.dropoff_address}</p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-slate-500">Order Fare:</span>
            <span className="font-black text-slate-900 text-sm">₦{Number(trackingResult.estimated_price).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render History Pillar ──────────────────────────────────────────────────
  const renderHistoryPanel = () => (
    <div className="space-y-3">
      {/* Search Bar & Filters */}
      <div className="space-y-2">
        <input
          type="text"
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder="Search by reference, destination..."
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-orange-500"
        />

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'rides', label: '🚖 Rides' },
            { key: 'parcels', label: '📦 Parcels' },
            { key: 'active', label: 'In Transit' },
            { key: 'completed', label: 'Completed' },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setHistoryFilter(pill.key as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                historyFilter === pill.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {loadingHistory ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <p className="text-xs">Loading history...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-10 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <History className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-semibold">No trip or parcel orders found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5 custom-scrollbar">
          {filteredHistory.map((item) => (
            <div key={item.id} className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  {item.type === 'ride' ? <Car className="w-3.5 h-3.5 text-blue-600" /> : <Package className="w-3.5 h-3.5 text-orange-600" />}
                  <span>{item.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                  {item.status?.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-1 text-slate-600 text-[11px]">
                <p className="truncate"><span className="text-slate-400">From:</span> {item.pickupAddress}</p>
                <p className="truncate"><span className="text-slate-400">To:</span> {item.dropoffAddress}</p>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span className="font-mono text-[10px] text-slate-400">{item.reference}</span>
                <span className="font-bold text-slate-900">₦{Number(item.fare).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── MAIN RETURN LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-[calc(100dvh-4rem)] bg-slate-100 overflow-hidden flex flex-col md:flex-row">
      {/* ── Background: Real-Time Interactive Map ── */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          pickup={pickup}
          dropoff={dropoff}
          center={mapCenter}
          zoom={pickup ? 14 : 12}
          routePolyline={routePolyline}
          drivers={activeService === 'ride' ? (availableDrivers || []) : []}
          matchedDriver={
            matchedDriver
              ? {
                  id: matchedDriver.id,
                  name: matchedDriver.name,
                  lat: matchedDriver.lat,
                  lng: matchedDriver.lng,
                  rating: matchedDriver.rating,
                  vehicleModel: matchedDriver.vehicleModel,
                  plateNumber: matchedDriver.plateNumber,
                  phone: matchedDriver.phone,
                  isMatched: true,
                }
              : null
          }
        />
        <div className="absolute inset-y-0 left-0 w-full lg:w-[480px] bg-gradient-to-r from-slate-100/95 via-slate-100/80 to-transparent pointer-events-none" />
      </div>

      {/* ── Foreground: Floating Customer Card ── */}
      <div className="relative z-10 w-full lg:w-[480px] flex flex-col p-3 sm:p-4 lg:p-6 h-[100dvh] overflow-hidden pointer-events-none">
        <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-[28px] shadow-2xl flex flex-col flex-1 pointer-events-auto overflow-hidden">
          
          {/* Driver/Rider Switcher Banner */}
          {isDriverOrRider && (
            <div className="px-4 py-2.5 bg-emerald-600 text-white flex items-center justify-between text-xs shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span className="font-bold">Logged in as Rider / Driver</span>
              </div>
              <Link
                to="/drive"
                className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 font-extrabold text-[11px] shadow-xs hover:bg-emerald-50 transition-colors"
              >
                Go to Cockpit →
              </Link>
            </div>
          )}

          {/* Dispatcher Switcher Banner */}
          {isDispatcher && !isDriverOrRider && (
            <div className="px-4 py-2.5 bg-cyan-600 text-white flex items-center justify-between text-xs shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                <span className="font-bold">Logged in as Dispatcher</span>
              </div>
              <Link
                to="/dispatcher"
                className="px-2.5 py-1 rounded-lg bg-white text-cyan-800 font-extrabold text-[11px] shadow-xs hover:bg-cyan-50 transition-colors"
              >
                Go to Console →
              </Link>
            </div>
          )}

          {/* Admin Switcher Banner */}
          {isAdminUser && !isDriverOrRider && !isDispatcher && (
            <div className="px-4 py-2 bg-purple-600 text-white flex items-center justify-between text-xs shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="font-bold">Administrator</span>
              </div>
              <Link
                to="/admin"
                className="px-2.5 py-0.5 rounded-lg bg-white text-purple-800 font-extrabold text-[11px] shadow-xs hover:bg-purple-50 transition-colors"
              >
                Admin Portal →
              </Link>
            </div>
          )}

          {/* Header Segmented Tabs */}
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-orange-600 animate-pulse" />
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">SwiftMove Customer Portal</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Jos City</span>
            </div>

            {/* Pillar Switcher */}
            <div className="grid grid-cols-4 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => switchService('ride')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeService === 'ride'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Ride</span>
              </button>

              <button
                type="button"
                onClick={() => switchService('parcel')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeService === 'parcel'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Parcel</span>
              </button>

              <button
                type="button"
                onClick={() => switchService('track')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeService === 'track'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Track</span>
              </button>

              <button
                type="button"
                onClick={() => switchService('history')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeService === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar">
            {activeService === 'ride' && renderRidePanel()}
            {activeService === 'parcel' && renderParcelPanel()}
            {activeService === 'track' && renderTrackPanel()}
            {activeService === 'history' && renderHistoryPanel()}
          </div>
        </div>
      </div>

      {/* ── Emergency SOS Modal ── */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">SwiftMove Emergency Assistance</h3>
              <p className="text-xs text-slate-500 mt-1">
                If you feel unsafe or require instant intervention, connect to our response line or national police.
              </p>
            </div>
            <div className="space-y-2">
              <a
                href="tel:08000000000"
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" /> Call SwiftMove Safety Desk
              </a>
              <a
                href="tel:112"
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Call Emergency Police (112)
              </a>
            </div>
            <Button variant="ghost" onClick={() => setShowSosModal(false)} className="w-full text-xs text-slate-500">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* ── Parcel Payment Modal ── */}
      {showParcelPaymentModal && activeParcelOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Complete Parcel Payment</h3>
              <p className="text-xs text-slate-500">Amount due: ₦{parcelFare.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setParcelPaymentMethod('paystack')}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  parcelPaymentMethod === 'paystack' ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500/20' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="font-bold text-slate-900">💳 Instant Paystack</p>
                <p className="text-[11px] text-slate-500">Debit card, instant bank transfer, USSD</p>
              </button>

              <button
                type="button"
                onClick={() => setParcelPaymentMethod('transfer')}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  parcelPaymentMethod === 'transfer' ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500/20' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="font-bold text-slate-900">🏦 Direct Bank Transfer</p>
                <p className="text-[11px] text-slate-500">Zenith Bank / Moniepoint corporate accounts</p>
              </button>
            </div>

            {parcelPaymentMethod === 'transfer' && (
              <div className="p-3 rounded-xl bg-orange-50/80 border border-orange-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Zenith Bank</p>
                    <p className="font-mono font-black text-slate-900">1310765201</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('1310765201');
                      toast.success('Account number copied!');
                    }}
                    className="p-1 text-orange-600 hover:text-orange-800 text-[11px] font-bold"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Account Name: SwiftMove Logistics</p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {parcelPaymentMethod === 'paystack' ? (
                <Button
                  onClick={handlePayParcelPaystack}
                  disabled={isConfirmingParcelPayment}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl"
                >
                  {isConfirmingParcelPayment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Pay ₦{parcelFare.toLocaleString()} via Paystack
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmParcelTransfer}
                  disabled={isConfirmingParcelPayment}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                >
                  I Have Completed Transfer
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={() => setShowParcelPaymentModal(false)}
                className="w-full text-xs text-slate-500"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}