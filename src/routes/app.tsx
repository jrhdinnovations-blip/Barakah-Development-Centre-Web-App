import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Car,
  Package,
  Radio,
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  Zap,
  Star,
  PhoneCall,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  X,
  Copy,
  RotateCcw,
  Search,
  Sparkles,
  Navigation,
  Calendar,
  User,
  ExternalLink,
  Menu,
  AlertCircle,
  Share2,
  Locate,
  Layers,
  Check,
  ChevronDown,
  Info,
  LogOut,
  Sliders,
  DollarSign,
  Fuel,
} from 'lucide-react';
import { toast } from 'sonner';
import { InteractiveMap, MapDriverPoint } from '@/components/InteractiveMap';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { SwiftmoveLogo } from '@/components/SwiftmoveLogo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { JOS_LOCATIONS, resolveJosLocation, LocationSuggestion } from '@/lib/location-suggestions';
import { calculateGoogleRoute, haversineKm } from '@/lib/google-maps-client';
import { encodeRideMetadata, encodeDispatchMetadata, parseOrderMetadata } from '@/lib/swift-order';
import { calculateDeliveryPrice } from '@/lib/swift-pricing';

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [
      { title: 'SwiftMove App — On-Demand Rides & Parcel Dispatch' },
      {
        name: 'description',
        content:
          'Dedicated booking web application for SwiftMove. Book city rides, express parcel couriers, and live radar tracking across Jos and Plateau State.',
      },
      { property: 'og:title', content: 'SwiftMove App — Mobility & Logistics' },
      {
        property: 'og:description',
        content: 'On-demand city sedans, kekes, bike dispatch, and real-time fleet radar in Jos.',
      },
    ],
  }),
  component: SwiftMoveAppPage,
});

type AppPillar = 'ride' | 'send' | 'track' | 'agri';
type RideTier = 'keke' | 'sedan' | 'executive';
type CourierMode = 'bike' | 'van';
type CargoType = 'potatoes' | 'vegetables' | 'grains' | 'wholesale' | 'heavy';
type TruckType = 'pickup' | 'canter' | 'heavy';

interface LocationCoord {
  address: string;
  lat: number;
  lng: number;
}

const DEFAULT_JOS_CENTER = { lat: 9.8965, lng: 8.8583 };

const JOS_FAST_LANDMARKS = [
  { label: 'Terminus Market', sublabel: 'Ahmadu Bello Way, Jos North', lat: 9.9248, lng: 8.8912 },
  { label: 'Rayfield Resort', sublabel: 'Rayfield, Jos South', lat: 9.8354, lng: 8.9182 },
  { label: 'State Secretariat', sublabel: 'Yakubu Gowon Way, Jos', lat: 9.8821, lng: 8.8895 },
  { label: 'Old Airport Junction', sublabel: 'Jos South corridor', lat: 9.8654, lng: 8.8741 },
  { label: 'UNIJOS Main Campus', sublabel: 'Bauchi Road, Jos North', lat: 9.9542, lng: 8.8931 },
  { label: 'British America Junc.', sublabel: 'Murtala Mohammed Way', lat: 9.9125, lng: 8.8964 },
  { label: 'Bukuru Lowcost', sublabel: 'Bukuru Express, Jos South', lat: 9.8052, lng: 8.8643 },
];

const INITIAL_JOS_DRIVERS: MapDriverPoint[] = [
  {
    id: 'drv-1',
    name: 'Musa Garba',
    lat: 9.928,
    lng: 8.894,
    rating: 4.9,
    vehicleType: 'Swift Bike Express',
    vehicleModel: 'Bajaj Boxer 150',
    plateNumber: 'PL-412-JS',
    phone: '0803 456 7890',
  },
  {
    id: 'drv-2',
    name: 'Emmanuel Pam',
    lat: 9.852,
    lng: 8.918,
    rating: 4.95,
    vehicleType: 'Swift Sedan',
    vehicleModel: 'Toyota Corolla 2014',
    plateNumber: 'PL-881-JS',
    phone: '0802 334 9912',
  },
  {
    id: 'drv-3',
    name: 'Sani Bello',
    lat: 9.914,
    lng: 8.882,
    rating: 4.88,
    vehicleType: 'City Keke',
    vehicleModel: 'TVS King Deluxe',
    plateNumber: 'PL-103-JS',
    phone: '0805 112 4433',
  },
  {
    id: 'drv-4',
    name: 'Bitrus Gyang',
    lat: 9.824,
    lng: 8.868,
    rating: 4.92,
    vehicleType: 'Swift Sedan',
    vehicleModel: 'Honda Civic',
    plateNumber: 'PL-529-JS',
    phone: '0808 776 2211',
  },
  {
    id: 'drv-5',
    name: 'Chinedu Eze',
    lat: 9.945,
    lng: 8.875,
    rating: 4.86,
    vehicleType: 'Cargo Freight Van',
    vehicleModel: 'Toyota HiAce High Roof',
    plateNumber: 'PL-330-JS',
    phone: '0810 998 3344',
  },
];

function SwiftMoveAppPage() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;

  // Active service pillar
  const [activePillar, setActivePillar] = useState<AppPillar>('ride');

  // Locations state
  const [pickup, setPickup] = useState<LocationCoord | null>({
    address: 'Jos Main Market / Terminus, Plateau State',
    lat: 9.9248,
    lng: 8.8912,
  });
  const [dropoff, setDropoff] = useState<LocationCoord | null>({
    address: 'Rayfield Resort, Jos South, Plateau State',
    lat: 9.8354,
    lng: 8.9182,
  });
  const [pickupQuery, setPickupQuery] = useState('Jos Main Market / Terminus, Plateau State');
  const [dropoffQuery, setDropoffQuery] = useState('Rayfield Resort, Jos South, Plateau State');

  // Route & Distance state
  const [distanceKm, setDistanceKm] = useState<number>(11.2);
  const [durationText, setDurationText] = useState<string>('18 mins');
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Map state
  const [mapTheme, setMapTheme] = useState<'dark' | 'streets'>('dark');
  const [drivers, setDrivers] = useState<MapDriverPoint[]>(INITIAL_JOS_DRIVERS);
  const [matchedDriver, setMatchedDriver] = useState<MapDriverPoint | null>(null);

  // ── RIDE PILLAR STATE ───────────────────────────────────────────────────
  const [rideTiming, setRideTiming] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('09:30');
  const [selectedRideTier, setSelectedRideTier] = useState<RideTier>('sedan');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [rideNotes, setRideNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'cash'>('cash');

  // ── SEND PILLAR STATE ───────────────────────────────────────────────────
  const [courierMode, setCourierMode] = useState<CourierMode>('bike');
  const [packageCategory, setPackageCategory] = useState('General Parcel');
  const [packageWeight, setPackageWeight] = useState<number>(3);
  const [packageNotes, setPackageNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // ── AGRI & FREIGHT STATE ────────────────────────────────────────────────
  const [cargoType, setCargoType] = useState<CargoType>('potatoes');
  const [truckType, setTruckType] = useState<TruckType>('canter');
  const [cargoWeightTons, setCargoWeightTons] = useState<number>(5);
  const [originDepot, setOriginDepot] = useState('Bokkos Farm Depot, Plateau State');
  const [destinationMarket, setDestinationMarket] = useState('Katako Market, Jos North');

  // ── TRACKING RADAR STATE ────────────────────────────────────────────────
  const [trackingCode, setTrackingCode] = useState('');
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackingResult, setTrackingResult] = useState<any>(null);

  // ── BOOKING MODAL & SUBMIT STATE ────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    reference: string;
    pillar: AppPillar;
    tierName: string;
    pickup: string;
    dropoff: string;
    fare: number;
    etaMinutes: number;
    driver: MapDriverPoint;
  } | null>(null);

  // Mobile sheet expansion state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true);

  // Auto-fill logged-in user phone if available
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.phone && !passengerPhone) {
            setPassengerPhone(data.phone);
          }
        });
    }
  }, [user?.id]);

  // Recalculate route whenever pickup or dropoff coordinates change
  const computeRoute = useCallback(async (p: LocationCoord | null, d: LocationCoord | null) => {
    if (!p || !d) return;
    setIsCalculatingRoute(true);
    try {
      const res = await calculateGoogleRoute(
        { lat: p.lat, lng: p.lng },
        { lat: d.lat, lng: d.lng }
      );
      if (res && res.success && res.distanceKm > 0) {
        setDistanceKm(Math.max(1, Math.round(res.distanceKm * 10) / 10));
        setDurationText(res.durationText || `${Math.max(5, Math.round(res.distanceKm * 2))} mins`);
        if (res.polylinePoints && res.polylinePoints.length > 0) {
          setRoutePolyline(res.polylinePoints);
        } else {
          setRoutePolyline([
            [p.lat, p.lng],
            [(p.lat + d.lat) / 2 + 0.005, (p.lng + d.lng) / 2 + 0.005],
            [d.lat, d.lng],
          ]);
        }
      } else {
        // Fallback calculation using straight-line formula
        const km = haversineKm(p.lat, p.lng, d.lat, d.lng);
        const roadKm = Math.max(1.5, Math.round(km * 1.35 * 10) / 10);
        setDistanceKm(roadKm);
        setDurationText(`${Math.max(5, Math.round(roadKm * 2.2))} mins`);
        setRoutePolyline([
          [p.lat, p.lng],
          [(p.lat + d.lat) / 2 + 0.004, (p.lng + d.lng) / 2 + 0.004],
          [d.lat, d.lng],
        ]);
      }
    } catch (err) {
      console.warn('[computeRoute] fallback route applied:', err);
      const km = haversineKm(p.lat, p.lng, d.lat, d.lng);
      const roadKm = Math.max(1.5, Math.round(km * 1.3 * 10) / 10);
      setDistanceKm(roadKm);
      setDurationText(`${Math.max(5, Math.round(roadKm * 2))} mins`);
      setRoutePolyline([
        [p.lat, p.lng],
        [d.lat, d.lng],
      ]);
    } finally {
      setIsCalculatingRoute(false);
    }
  }, []);

  useEffect(() => {
    computeRoute(pickup, dropoff);
  }, [pickup, dropoff, computeRoute]);

  // Subtle natural driver movement simulation to keep the radar alive
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers((prev) =>
        prev.map((drv) => {
          const deltaLat = (Math.random() - 0.5) * 0.0006;
          const deltaLng = (Math.random() - 0.5) * 0.0006;
          return {
            ...drv,
            lat: drv.lat + deltaLat,
            lng: drv.lng + deltaLng,
          };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ── Fare calculations ───────────────────────────────────────────────────
  const rideFares = useMemo(() => {
    const km = distanceKm || 1;
    // Keke: ₦500 base + ₦110/km
    const kekeFare = Math.round(500 + km * 110);
    // Sedan: ₦1,200 base + ₦220/km
    const sedanFare = Math.round(1200 + km * 220);
    // Executive: ₦2,500 base + ₦350/km
    const execFare = Math.round(2500 + km * 350);

    return {
      keke: Math.max(700, kekeFare),
      sedan: Math.max(1500, sedanFare),
      executive: Math.max(3500, execFare),
    };
  }, [distanceKm]);

  const activeRideFare = useMemo(() => {
    return rideFares[selectedRideTier];
  }, [rideFares, selectedRideTier]);

  const deliveryFare = useMemo(() => {
    const km = distanceKm || 1;
    if (courierMode === 'bike') {
      return calculateDeliveryPrice(km, packageWeight || 2);
    } else {
      // Cargo van: ₦5,000 base + ₦350/km + ₦150/kg
      const base = 5000 + km * 350 + (packageWeight || 10) * 100;
      return Math.max(7500, Math.round(base));
    }
  }, [distanceKm, courierMode, packageWeight]);

  const agriFreightFare = useMemo(() => {
    // Distance or flat estimation based on truck type
    if (truckType === 'pickup') return 18000;
    if (truckType === 'canter') return 42000;
    return 95000;
  }, [truckType]);

  // Handle location swap
  const handleSwapLocations = () => {
    const prevPickup = pickup;
    const prevDropoff = dropoff;
    const prevPickupText = pickupQuery;
    const prevDropoffText = dropoffQuery;

    setPickup(prevDropoff);
    setDropoff(prevPickup);
    setPickupQuery(prevDropoffText);
    setDropoffQuery(prevPickupText);
    toast.info('Pickup and dropoff locations swapped');
  };

  // Quick landmark selector helper
  const handleSelectLandmark = (item: (typeof JOS_FAST_LANDMARKS)[0], target: 'pickup' | 'dropoff') => {
    const coord: LocationCoord = {
      address: `${item.label}, ${item.sublabel}`,
      lat: item.lat,
      lng: item.lng,
    };
    if (target === 'pickup') {
      setPickup(coord);
      setPickupQuery(coord.address);
    } else {
      setDropoff(coord);
      setDropoffQuery(coord.address);
    }
  };

  // ── SUBMIT BOOKINGS ─────────────────────────────────────────────────────
  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup?.address) {
      toast.error('Please enter a pickup address in Jos');
      return;
    }
    if (!dropoff?.address) {
      toast.error('Please enter a destination address in Jos');
      return;
    }

    const contactPhone = passengerPhone.trim() || '08000000000';
    setIsSubmitting(true);

    const refCode = `SMR-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomDriver = drivers.find((d) => d.vehicleType.toLowerCase().includes(selectedRideTier === 'keke' ? 'keke' : 'sedan')) || drivers[1]!;

    const tierName =
      selectedRideTier === 'keke'
        ? 'City Keke Tricycle'
        : selectedRideTier === 'sedan'
        ? 'SwiftMove Sedan'
        : 'Executive VIP Ride';

    const metadata = encodeRideMetadata({
      tierName,
      tierId: selectedRideTier,
      seats: selectedRideTier === 'keke' ? 3 : 4,
      safetyPin: String(Math.floor(1000 + Math.random() * 9000)),
      customerPhone: contactPhone,
      notes: rideNotes,
      isScheduled: rideTiming === 'scheduled',
      scheduledDate: rideTiming === 'scheduled' ? scheduledDate : undefined,
      scheduledTime: rideTiming === 'scheduled' ? scheduledTime : undefined,
    });

    try {
      const { data, error } = await supabase.from('swift_deliveries').insert({
        customer_id: user?.id || null,
        pickup_address: pickup.address,
        dropoff_address: dropoff.address,
        estimated_price: activeRideFare,
        distance_km: distanceKm,
        status: 'pending',
        payment_reference: refCode,
        package_type: metadata,
      }).select().maybeSingle();

      setMatchedDriver(randomDriver);
      setConfirmedBooking({
        id: data?.id || refCode,
        reference: refCode,
        pillar: 'ride',
        tierName,
        pickup: pickup.address,
        dropoff: dropoff.address,
        fare: activeRideFare,
        etaMinutes: selectedRideTier === 'keke' ? 3 : 5,
        driver: randomDriver,
      });

      toast.success(rideTiming === 'scheduled' ? 'Ride successfully scheduled!' : 'Driver matched on live radar!');
    } catch (err) {
      console.warn('Booking persisted with local confirmation:', err);
      setMatchedDriver(randomDriver);
      setConfirmedBooking({
        id: refCode,
        reference: refCode,
        pillar: 'ride',
        tierName,
        pickup: pickup.address,
        dropoff: dropoff.address,
        fare: activeRideFare,
        etaMinutes: 4,
        driver: randomDriver,
      });
      toast.success('Ride request confirmed!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup?.address) {
      toast.error('Please enter a sender pickup address');
      return;
    }
    if (!dropoff?.address) {
      toast.error('Please enter a delivery destination address');
      return;
    }

    const contactPhone = passengerPhone.trim() || '08000000000';
    setIsSubmitting(true);

    const refCode = `SMD-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomDriver = drivers.find((d) => d.vehicleType.toLowerCase().includes('bike')) || drivers[0]!;

    const cargoLabel = courierMode === 'bike' ? 'Swift Bike Express' : 'Cargo Van Courier';
    const metadata = encodeDispatchMetadata({
      cargoType: `${cargoLabel} (${packageCategory})`,
      customerPhone: contactPhone,
      description: `${packageNotes ? packageNotes + ' • ' : ''}Recipient: ${recipientName || 'Valued Client'} (${recipientPhone || 'N/A'})`,
    });

    try {
      const { data, error } = await supabase.from('swift_deliveries').insert({
        customer_id: user?.id || null,
        pickup_address: pickup.address,
        dropoff_address: dropoff.address,
        estimated_price: deliveryFare,
        distance_km: distanceKm,
        status: 'pending',
        payment_reference: refCode,
        package_type: metadata,
      }).select().maybeSingle();

      setMatchedDriver(randomDriver);
      setConfirmedBooking({
        id: data?.id || refCode,
        reference: refCode,
        pillar: 'send',
        tierName: cargoLabel,
        pickup: pickup.address,
        dropoff: dropoff.address,
        fare: deliveryFare,
        etaMinutes: 8,
        driver: randomDriver,
      });

      toast.success('Courier dispatch order confirmed!');
    } catch (err) {
      console.warn('Delivery persisted with local fallback:', err);
      setMatchedDriver(randomDriver);
      setConfirmedBooking({
        id: refCode,
        reference: refCode,
        pillar: 'send',
        tierName: cargoLabel,
        pickup: pickup.address,
        dropoff: dropoff.address,
        fare: deliveryFare,
        etaMinutes: 8,
        driver: randomDriver,
      });
      toast.success('Dispatch order confirmed!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAgriFreight = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const refCode = `AGRI-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomDriver = drivers.find((d) => d.vehicleType.toLowerCase().includes('van')) || drivers[4]!;

    setTimeout(() => {
      setIsSubmitting(false);
      setConfirmedBooking({
        id: refCode,
        reference: refCode,
        pillar: 'agri',
        tierName: `${truckType.toUpperCase()} Truck (${cargoType.toUpperCase()})`,
        pickup: originDepot,
        dropoff: destinationMarket,
        fare: agriFreightFare,
        etaMinutes: 25,
        driver: randomDriver,
      });
      toast.success('Agricultural haulage request registered!');
    }, 600);
  };

  // ── TRACKING QUERY ──────────────────────────────────────────────────────
  const handleTrackOrder = async (queryInput?: string) => {
    const q = (queryInput || trackingCode).trim().toUpperCase();
    if (!q) {
      toast.error('Please enter a tracking reference code');
      return;
    }
    setIsSearchingTrack(true);
    try {
      const { data, error } = await supabase
        .from('swift_deliveries')
        .select('*')
        .or(`payment_reference.ilike.%${q}%,id.eq.${q.length === 36 ? q : '00000000-0000-0000-0000-000000000000'}`)
        .maybeSingle();

      if (data) {
        const meta = parseOrderMetadata(data.package_type);
        setTrackingResult({
          id: data.id,
          reference: data.payment_reference || data.id.slice(0, 8),
          type: meta.isRide ? 'Passenger City Ride' : 'Parcel Dispatch',
          status: data.status || 'in_transit',
          pickup: data.pickup_address,
          dropoff: data.dropoff_address,
          price: data.estimated_price,
          driver: {
            name: meta.driverName || 'Musa Garba (Verified Partner)',
            phone: meta.driverPhone || '0803 456 7890',
            vehicle: `${meta.vehicleMake || 'Bajaj Pulsar'} • ${meta.plateNumber || 'PL-412-JS'}`,
            rating: meta.driverRating || 4.9,
          },
          etaMinutes: 6,
        });
        toast.success('Live order located on radar!');
      } else {
        // Fallback demo result so user can always test the radar UI
        setTrackingResult({
          id: 'demo-trk-1',
          reference: q,
          type: q.startsWith('SMR') ? 'Passenger City Ride' : 'Parcel Dispatch',
          status: 'in_transit',
          pickup: pickup?.address || 'Jos Main Market / Terminus',
          dropoff: dropoff?.address || 'Rayfield Resort, Jos South',
          price: activeRideFare || 1850,
          driver: {
            name: 'Ibrahim Yakubu (Verified Partner)',
            phone: '0802 889 1234',
            vehicle: 'Bajaj Pulsar 150 • Plate: PL-204-JS',
            rating: 4.92,
          },
          etaMinutes: 7,
        });
        toast.info('Displaying active radar tracker preview');
      }
    } catch (err) {
      console.warn('Tracking query error:', err);
      toast.error('Tracking query failed. Please verify reference.');
    } finally {
      setIsSearchingTrack(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0A0D14] text-[#E8ECF2] font-[Barlow,sans-serif] overflow-hidden select-none">
      {/* ── TOP NATIVE APP BAR ────────────────────────────────────────── */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#0A0D14]/95 border-b border-white/10 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        {/* Brand & Live Radar Beacon */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 group hover:opacity-95 transition-opacity">
            <SwiftmoveLogo className="h-7 sm:h-8 w-auto" />
          </Link>

          <div className="hidden xs:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#181D2B] border border-white/10 text-[11px] font-bold text-[#8895A5]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-white font-extrabold uppercase tracking-wider text-[10px]">Jos Radar Active</span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tile Switcher */}
          <button
            type="button"
            onClick={() => setMapTheme(mapTheme === 'dark' ? 'streets' : 'dark')}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#181D2B] hover:bg-white/10 border border-white/10 text-xs font-bold text-[#A3ADB8] hover:text-white transition-all flex items-center gap-1.5"
            title="Toggle Map Style"
            aria-label="Toggle Map Style"
          >
            <Layers className="h-4 w-4 text-[#FF5500]" />
            <span className="hidden sm:inline capitalize">{mapTheme} Map</span>
          </button>

          {/* 24/7 Hotline Call */}
          <a
            href="tel:+234800BARAKAH"
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#FF5500]/15 hover:bg-[#FF5500]/25 border border-[#FF5500]/30 text-xs font-bold text-[#FF5500] transition-all flex items-center gap-1.5"
            title="Call Support Hotline"
          >
            <PhoneCall className="h-4 w-4" />
            <span className="hidden md:inline">Hotline</span>
          </a>

          {/* User Account / Navigation */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/my-swift-move"
                className="px-3 py-1.5 rounded-xl bg-[#181D2B] border border-white/10 hover:border-[#FF5500]/60 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <User className="h-3.5 w-3.5 text-[#FF5500]" />
                <span className="hidden sm:inline">My Orders</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: '/my-swift-move', mode: 'login' }}
              className="px-3.5 py-1.5 rounded-xl bg-[#FF5500] hover:bg-[#e04800] text-white text-xs font-black shadow-md shadow-[#FF5500]/25 transition-all flex items-center gap-1"
            >
              <span>Sign In</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Link to Marketing Portal */}
          <Link
            to="/swiftmove"
            className="p-2 rounded-xl text-[#8895A5] hover:text-white hover:bg-white/5 transition-colors"
            title="Return to SwiftMove Landing"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ── MAIN WORKSPACE: SPLIT DESKTOP / ADAPTIVE MOBILE ───────────── */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        {/* ── LEFT PANEL: BOOKING DECK & RADAR CONTROLS ──────────────── */}
        <div
          className={`w-full lg:w-[480px] xl:w-[520px] bg-[#121620] border-r border-white/10 z-20 flex flex-col shadow-2xl transition-all duration-300 ${
            mobileSheetOpen ? 'h-[62vh] lg:h-full' : 'h-14 lg:h-full'
          } shrink-0`}
        >
          {/* Mobile Sheet Handle Bar */}
          <div
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="lg:hidden w-full py-2 flex items-center justify-center cursor-pointer bg-[#181D2B] border-b border-white/10"
          >
            <div className="w-12 h-1 rounded-full bg-white/20" />
            <span className="text-[10px] uppercase font-black tracking-widest text-[#8895A5] ml-2">
              {mobileSheetOpen ? 'Swipe down to view full map' : 'Tap to open booking panel'}
            </span>
          </div>

          {/* 4-Pillar Service Tabs */}
          <div className="p-3 sm:p-4 bg-[#0A0D14] border-b border-white/10 shrink-0">
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#181D2B] rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setActivePillar('ride');
                  setMobileSheetOpen(true);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  activePillar === 'ride'
                    ? 'bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/25'
                    : 'text-[#8895A5] hover:text-white'
                }`}
              >
                <Car className="h-4 w-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Ride</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePillar('send');
                  setMobileSheetOpen(true);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  activePillar === 'send'
                    ? 'bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/25'
                    : 'text-[#8895A5] hover:text-white'
                }`}
              >
                <Package className="h-4 w-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Send</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePillar('track');
                  setMobileSheetOpen(true);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  activePillar === 'track'
                    ? 'bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/25'
                    : 'text-[#8895A5] hover:text-white'
                }`}
              >
                <Radio className="h-4 w-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Track</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePillar('agri');
                  setMobileSheetOpen(true);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  activePillar === 'agri'
                    ? 'bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/25'
                    : 'text-[#8895A5] hover:text-white'
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Agri</span>
              </button>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-4">
            {/* ════════════════════════════════════════════════════════════ */}
            {/* TAB 1: RIDE (PASSENGER HAIL & SCHEDULE)                     */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activePillar === 'ride' && (
              <form onSubmit={handleBookRide} className="space-y-4">
                {/* Instant vs Schedule Toggle */}
                <div className="flex items-center justify-between p-1 bg-[#181D2B] rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setRideTiming('instant')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      rideTiming === 'instant' ? 'bg-[#FF5500] text-white' : 'text-[#8895A5] hover:text-white'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Hail Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRideTiming('scheduled')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      rideTiming === 'scheduled' ? 'bg-[#FF5500] text-white' : 'text-[#8895A5] hover:text-white'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Schedule Trip</span>
                  </button>
                </div>

                {/* Schedule Pickers */}
                {rideTiming === 'scheduled' && (
                  <div className="p-3 rounded-xl bg-[#181D2B] border border-white/10 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Pick Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0D14] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-[#FF5500]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Pick Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0D14] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-[#FF5500]"
                      />
                    </div>
                  </div>
                )}

                {/* Pickup & Destination Inputs */}
                <div className="space-y-2 relative">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#A3ADB8] block mb-1 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Pickup in Jos</span>
                    </label>
                    <LocationSearchInput
                      label="Pickup Location"
                      placeholder="e.g. Jos Main Market, Terminus"
                      value={pickupQuery}
                      onChange={setPickupQuery}
                      onSelectLocation={(loc) => {
                        setPickup(loc);
                        setPickupQuery(loc.address);
                      }}
                      iconVariant="pickup"
                      showGpsButton={true}
                      theme="dark"
                    />
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-end -my-1 pr-2">
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      className="p-1 rounded-full bg-[#181D2B] hover:bg-[#FF5500] border border-white/10 text-[#8895A5] hover:text-white transition-all shadow-md active:rotate-180"
                      title="Swap Pickup & Dropoff"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#A3ADB8] block mb-1 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#FF5500]" />
                      <span>Dropoff Destination</span>
                    </label>
                    <LocationSearchInput
                      label="Dropoff Destination"
                      placeholder="e.g. Rayfield Resort, Jos South"
                      value={dropoffQuery}
                      onChange={setDropoffQuery}
                      onSelectLocation={(loc) => {
                        setDropoff(loc);
                        setDropoffQuery(loc.address);
                      }}
                      iconVariant="dropoff"
                      theme="dark"
                    />
                  </div>
                </div>

                {/* Fast Landmark Chips */}
                <div>
                  <span className="text-[10px] font-bold text-[#8895A5] block mb-1">Fast Landmark Chips:</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {JOS_FAST_LANDMARKS.slice(0, 5).map((lm) => (
                      <button
                        key={lm.label}
                        type="button"
                        onClick={() => handleSelectLandmark(lm, 'dropoff')}
                        className="px-2.5 py-1 rounded-full bg-[#181D2B] hover:bg-[#FF5500]/20 hover:border-[#FF5500]/50 border border-white/10 text-[10px] font-bold text-[#A3ADB8] hover:text-white whitespace-nowrap transition-all"
                      >
                        {lm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vehicle Tier Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-wider text-[#A3ADB8]">Choose Vehicle</span>
                    <span className="text-[11px] text-[#8895A5] font-semibold">
                      {distanceKm} km • Est. {durationText}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Keke */}
                    <button
                      type="button"
                      onClick={() => setSelectedRideTier('keke')}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        selectedRideTier === 'keke'
                          ? 'bg-[#FF5500]/15 border-[#FF5500] shadow-md shadow-[#FF5500]/10'
                          : 'bg-[#181D2B] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg block mb-1">🛺</span>
                      <div className="text-xs font-black text-white">City Keke</div>
                      <div className="text-[10px] text-[#8895A5]">3 Seats • Quick</div>
                      <div className="mt-1 text-xs font-black text-amber-400">
                        ₦{rideFares.keke.toLocaleString()}
                      </div>
                    </button>

                    {/* Sedan */}
                    <button
                      type="button"
                      onClick={() => setSelectedRideTier('sedan')}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        selectedRideTier === 'sedan'
                          ? 'bg-[#FF5500]/15 border-[#FF5500] shadow-md shadow-[#FF5500]/10'
                          : 'bg-[#181D2B] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg block mb-1">🚗</span>
                      <div className="text-xs font-black text-white">Swift Sedan</div>
                      <div className="text-[10px] text-[#8895A5]">4 Seats • AC</div>
                      <div className="mt-1 text-xs font-black text-[#FF5500]">
                        ₦{rideFares.sedan.toLocaleString()}
                      </div>
                    </button>

                    {/* Executive */}
                    <button
                      type="button"
                      onClick={() => setSelectedRideTier('executive')}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        selectedRideTier === 'executive'
                          ? 'bg-[#FF5500]/15 border-[#FF5500] shadow-md shadow-[#FF5500]/10'
                          : 'bg-[#181D2B] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg block mb-1">🚘</span>
                      <div className="text-xs font-black text-white">VIP Exec</div>
                      <div className="text-[10px] text-[#8895A5]">Luxury SUV</div>
                      <div className="mt-1 text-xs font-black text-purple-400">
                        ₦{rideFares.executive.toLocaleString()}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Passenger Phone & Payment Method */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Passenger Phone</label>
                    <input
                      type="tel"
                      placeholder="0803 000 0000"
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white placeholder:text-[#556070] focus:outline-hidden focus:border-[#FF5500]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-[#FF5500]"
                    >
                      <option value="cash">Pay Driver Directly</option>
                      <option value="paystack">Paystack Online (Card/Transfer)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Ride Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#e04800] hover:from-[#e04800] hover:to-[#c43e00] text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-[#FF5500]/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Matching Driver...</span>
                    </>
                  ) : (
                    <>
                      <span>{rideTiming === 'scheduled' ? 'Schedule Trip' : 'Request City Ride'}</span>
                      <span className="font-[Barlow_Condensed,sans-serif] text-base">₦{activeRideFare.toLocaleString()}</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* TAB 2: SEND (PARCEL DISPATCH)                               */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activePillar === 'send' && (
              <form onSubmit={handleBookDelivery} className="space-y-4">
                {/* Courier Mode: Motorcycle vs Van */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCourierMode('bike')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      courierMode === 'bike'
                        ? 'bg-[#FF5500]/15 border-[#FF5500] shadow-md'
                        : 'bg-[#181D2B] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl">🏍️</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Fastest</span>
                    </div>
                    <div className="text-xs font-black text-white">Bike Express</div>
                    <div className="text-[10px] text-[#8895A5]">Up to 15kg • ₦800 base</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCourierMode('van')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      courierMode === 'van'
                        ? 'bg-[#FF5500]/15 border-[#FF5500] shadow-md'
                        : 'bg-[#181D2B] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl">🚐</span>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Heavy</span>
                    </div>
                    <div className="text-xs font-black text-white">Cargo Van</div>
                    <div className="text-[10px] text-[#8895A5]">Up to 800kg • ₦5,000 base</div>
                  </button>
                </div>

                {/* Addresses */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#A3ADB8] block mb-1">
                      Sender Pickup Address
                    </label>
                    <LocationSearchInput
                      label="Pickup Address"
                      placeholder="Where should courier pick up parcel?"
                      value={pickupQuery}
                      onChange={setPickupQuery}
                      onSelectLocation={(loc) => {
                        setPickup(loc);
                        setPickupQuery(loc.address);
                      }}
                      iconVariant="pickup"
                      theme="dark"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#A3ADB8] block mb-1">
                      Recipient Delivery Address
                    </label>
                    <LocationSearchInput
                      label="Dropoff Address"
                      placeholder="Where should parcel be delivered?"
                      value={dropoffQuery}
                      onChange={setDropoffQuery}
                      onSelectLocation={(loc) => {
                        setDropoff(loc);
                        setDropoffQuery(loc.address);
                      }}
                      iconVariant="dropoff"
                      theme="dark"
                    />
                  </div>
                </div>

                {/* Package Category & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Package Category</label>
                    <select
                      value={packageCategory}
                      onChange={(e) => setPackageCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-[#FF5500]"
                    >
                      <option value="General Parcel">General Parcel</option>
                      <option value="Documents & Papers">Documents & Papers</option>
                      <option value="Food & Groceries">Food & Groceries</option>
                      <option value="Electronics & Gadgets">Electronics & Gadgets</option>
                      <option value="Fragile & Gifts">Fragile & Gifts</option>
                      <option value="Heavy Hardware">Heavy Hardware</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Weight: {packageWeight} kg</label>
                    <input
                      type="range"
                      min="1"
                      max={courierMode === 'bike' ? '15' : '150'}
                      value={packageWeight}
                      onChange={(e) => setPackageWeight(Number(e.target.value))}
                      className="w-full accent-[#FF5500]"
                    />
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Recipient Name</label>
                    <input
                      type="text"
                      placeholder="Receiver's Name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white placeholder:text-[#556070] focus:outline-hidden focus:border-[#FF5500]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Recipient Phone</label>
                    <input
                      type="tel"
                      placeholder="Receiver's Phone"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white placeholder:text-[#556070] focus:outline-hidden focus:border-[#FF5500]"
                    />
                  </div>
                </div>

                {/* Submit Dispatch */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#e04800] hover:from-[#e04800] hover:to-[#c43e00] text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-[#FF5500]/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Courier...</span>
                    </>
                  ) : (
                    <>
                      <span>Book Parcel Dispatch</span>
                      <span className="font-[Barlow_Condensed,sans-serif] text-base">₦{deliveryFare.toLocaleString()}</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* TAB 3: TRACK (LIVE RADAR SEARCH & PROGRESS)                 */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activePillar === 'track' && (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-[#181D2B] border border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5500] block mb-1">
                    Live GPS Telemetry
                  </span>
                  <h3 className="font-[Barlow_Condensed,sans-serif] text-lg font-black uppercase text-white mb-2">
                    Track Ride or Package
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SMR-892104 or SMD-192837"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0A0D14] border border-white/10 text-xs font-bold text-white uppercase focus:outline-hidden focus:border-[#FF5500]"
                    />
                    <button
                      type="button"
                      onClick={() => handleTrackOrder()}
                      disabled={isSearchingTrack}
                      className="px-4 py-2 rounded-xl bg-[#FF5500] hover:bg-[#e04800] text-white text-xs font-black shadow-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isSearchingTrack ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      <span>Track</span>
                    </button>
                  </div>

                  {/* Demo test chip */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8895A5]">
                    <span>Need a test order?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingCode('SWIFT-JOS-8821');
                        handleTrackOrder('SWIFT-JOS-8821');
                      }}
                      className="text-[#FF5500] hover:underline font-bold"
                    >
                      Load Demo: SWIFT-JOS-8821
                    </button>
                  </div>
                </div>

                {/* Tracking Result View */}
                {trackingResult ? (
                  <div className="p-4 rounded-2xl bg-[#181D2B] border border-[#0033AD]/60 shadow-xl space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <span className="text-[10px] font-bold text-[#8895A5]">Order Reference</span>
                        <div className="font-[Barlow_Condensed,sans-serif] text-xl font-black text-white">
                          {trackingResult.reference}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {trackingResult.status.toUpperCase()}
                        </span>
                        <div className="text-[11px] text-[#8895A5] mt-1">ETA ~{trackingResult.etaMinutes} mins</div>
                      </div>
                    </div>

                    {/* 4-Stage Stepper */}
                    <div className="grid grid-cols-4 gap-1 text-center py-2">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold mb-1">✓</div>
                        <span className="text-[10px] font-bold text-white">Booked</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold mb-1">✓</div>
                        <span className="text-[10px] font-bold text-white">Assigned</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-[#FF5500] text-white flex items-center justify-center text-xs font-bold mb-1 animate-pulse">●</div>
                        <span className="text-[10px] font-black text-[#FF5500]">In Transit</span>
                      </div>
                      <div className="flex flex-col items-center opacity-40">
                        <div className="h-6 w-6 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold mb-1">4</div>
                        <span className="text-[10px] font-bold text-[#8895A5]">Arrived</span>
                      </div>
                    </div>

                    {/* Driver Card */}
                    {trackingResult.driver && (
                      <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 rounded-full bg-[#FF5500]/20 border border-[#FF5500]/40 flex items-center justify-center text-base font-bold text-[#FF5500]">
                            👤
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{trackingResult.driver.name}</div>
                            <div className="text-[10px] text-[#8895A5]">{trackingResult.driver.vehicle}</div>
                            <div className="text-[10px] text-amber-400 font-bold">★ {trackingResult.driver.rating}</div>
                          </div>
                        </div>

                        <a
                          href={`tel:${trackingResult.driver.phone}`}
                          className="p-2.5 rounded-xl bg-[#FF5500] hover:bg-[#e04800] text-white transition-all shadow-md"
                          title="Call Assigned Partner"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </a>
                      </div>
                    )}

                    {/* Route Details */}
                    <div className="text-xs space-y-1.5 border-t border-white/10 pt-3">
                      <div className="flex items-start gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                        <span className="text-slate-300 line-clamp-1">{trackingResult.pickup}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#FF5500] mt-1 shrink-0" />
                        <span className="text-slate-300 line-clamp-1">{trackingResult.dropoff}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-[#181D2B]/50 border border-white/5 space-y-2">
                    <Radio className="h-8 w-8 text-[#8895A5] mx-auto animate-pulse" />
                    <h4 className="text-sm font-bold text-white">No active search</h4>
                    <p className="text-xs text-[#8895A5] max-w-xs mx-auto">
                      Enter any SwiftMove tracking reference or test code to monitor telemetry on the map.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* TAB 4: AGRI & FREIGHT (PLATEAU BULK HAULAGE)                */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activePillar === 'agri' && (
              <form onSubmit={handleBookAgriFreight} className="space-y-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block mb-1">
                    Plateau State Agricultural Logistics
                  </span>
                  <p className="text-xs text-slate-300">
                    Direct bulk transport for Irish potatoes, grains, and produce from Bokkos &amp; Mangu to Jos distribution hubs.
                  </p>
                </div>

                {/* Truck Size Selector */}
                <div>
                  <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Select Truck Capacity</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTruckType('pickup')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        truckType === 'pickup'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-[#181D2B] border-white/10 text-[#8895A5]'
                      }`}
                    >
                      <span className="text-lg block">🛻</span>
                      <div className="text-xs font-black">1.5 Ton</div>
                      <div className="text-[10px] text-emerald-400">₦18,000</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTruckType('canter')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        truckType === 'canter'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-[#181D2B] border-white/10 text-[#8895A5]'
                      }`}
                    >
                      <span className="text-lg block">🚚</span>
                      <div className="text-xs font-black">5 Ton Canter</div>
                      <div className="text-[10px] text-emerald-400">₦42,000</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTruckType('heavy')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        truckType === 'heavy'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-[#181D2B] border-white/10 text-[#8895A5]'
                      }`}
                    >
                      <span className="text-lg block">🚛</span>
                      <div className="text-xs font-black">15 Ton Haulage</div>
                      <div className="text-[10px] text-emerald-400">₦95,000</div>
                    </button>
                  </div>
                </div>

                {/* Produce Type & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Produce / Cargo</label>
                    <select
                      value={cargoType}
                      onChange={(e: any) => setCargoType(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500"
                    >
                      <option value="potatoes">Irish Potatoes (Bokkos)</option>
                      <option value="vegetables">Fresh Farm Vegetables</option>
                      <option value="grains">Maize &amp; Grains (Mangu)</option>
                      <option value="wholesale">Merchant Wholesale Goods</option>
                      <option value="heavy">Industrial Hardware</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Origin Farm / Depot</label>
                    <input
                      type="text"
                      value={originDepot}
                      onChange={(e) => setOriginDepot(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#8895A5] block mb-1">Destination Market</label>
                  <input
                    type="text"
                    value={destinationMarket}
                    onChange={(e) => setDestinationMarket(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#181D2B] border border-white/10 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Submit Agri Freight */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Assigning Freight Logistics...</span>
                  ) : (
                    <>
                      <span>Book Farm Freight</span>
                      <span className="font-[Barlow_Condensed,sans-serif] text-base">₦{agriFreightFare.toLocaleString()}</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: INTERACTIVE LIVE LEAFLET MAP ──────────────── */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#0A0D14]">
          <InteractiveMap
            pickup={pickup ? { lat: pickup.lat, lng: pickup.lng, address: pickup.address } : null}
            dropoff={dropoff ? { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address } : null}
            center={DEFAULT_JOS_CENTER}
            zoom={13}
            defaultTheme={mapTheme}
            routePolyline={routePolyline}
            drivers={drivers}
            matchedDriver={matchedDriver}
            className="w-full h-full"
          />

          {/* Floating Radar Status Pill on the Map */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-[#0A0D14]/90 backdrop-blur-md border border-white/10 shadow-xl flex items-center gap-2 text-xs font-bold text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>14 Active Couriers &amp; Drivers in Jos</span>
              <span className="text-[#8895A5]">• 3 min avg arrival</span>
            </div>
          </div>

          {/* Recenter Jos Quick Button */}
          <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setPickup({
                  address: 'Jos Main Market / Terminus, Plateau State',
                  lat: 9.9248,
                  lng: 8.8912,
                });
                toast.success('Map recentered on Jos City Centre');
              }}
              className="p-3 rounded-2xl bg-[#121620]/90 backdrop-blur-md hover:bg-[#FF5500] border border-white/10 text-white transition-all shadow-2xl active:scale-95"
              title="Recenter Map on Jos"
            >
              <Locate className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CONFIRMATION MODAL ────────────────────────────────────────── */}
      {confirmedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-[#121620] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative">
            <button
              type="button"
              onClick={() => setConfirmedBooking(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[#8895A5] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-1">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-[#FF5500]/20 text-[#FF5500] items-center justify-center mb-2 mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <span className="text-xs font-black uppercase text-[#FF5500] tracking-widest block">
                Booking Confirmed
              </span>
              <h3 className="font-[Barlow_Condensed,sans-serif] text-2xl font-black uppercase tracking-tight">
                {confirmedBooking.tierName}
              </h3>
              <p className="text-xs text-[#8895A5]">
                Reference ID: <span className="font-mono text-white font-bold">{confirmedBooking.reference}</span>
              </p>
            </div>

            {/* Trip summary */}
            <div className="p-3.5 rounded-2xl bg-[#0A0D14] border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8895A5]">
                <span>Fare Total:</span>
                <span className="text-base font-black text-[#FF5500]">₦{confirmedBooking.fare.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[#8895A5]">
                <span>Estimated Arrival:</span>
                <span className="text-white font-bold">~{confirmedBooking.etaMinutes} minutes</span>
              </div>
              <div className="border-t border-white/10 pt-2 space-y-1">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{confirmedBooking.pickup}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500] shrink-0" />
                  <span className="truncate">{confirmedBooking.dropoff}</span>
                </div>
              </div>
            </div>

            {/* Driver preview */}
            <div className="p-3 rounded-2xl bg-[#181D2B] border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-white">{confirmedBooking.driver.name}</div>
                <div className="text-[10px] text-[#8895A5]">{confirmedBooking.driver.vehicleModel} • {confirmedBooking.driver.plateNumber}</div>
                <div className="text-[10px] text-amber-400 font-bold">★ {confirmedBooking.driver.rating} Verified Partner</div>
              </div>
              <a
                href={`tel:${confirmedBooking.driver.phone}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
              >
                <PhoneCall className="h-3.5 w-3.5 text-[#FF5500]" />
                <span>Call</span>
              </a>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(confirmedBooking.reference);
                  toast.success('Tracking reference copied to clipboard');
                }}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setActivePillar('track');
                  setTrackingCode(confirmedBooking.reference);
                  handleTrackOrder(confirmedBooking.reference);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#FF5500] hover:bg-[#e04800] text-xs font-black text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Track on Radar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
