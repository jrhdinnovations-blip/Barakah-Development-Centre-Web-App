import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Truck, Package, MapPin, Clock, ShieldCheck, Zap,
  ArrowRight, Star, PhoneCall, CheckCircle2, Navigation,
  Bike, Globe2, HeartHandshake, Car, UserCheck,
  Radio, Shield, LogOut, Search, X, Loader2, Calendar,
  CalendarClock, Check, Phone, FileText, ChevronRight, AlertCircle,
  Sparkles, ArrowUpDown, ChevronDown, CheckCircle, ShieldAlert,
  Send, Compass, Award, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { isSwiftmoveDomain } from '@/lib/domain-detection';
import { SwiftmoveLogo } from '@/components/SwiftmoveLogo';
import { encodeDispatchMetadata, encodeRideMetadata } from '@/lib/swift-order';
import { customerCreateDispatchOrder, customerCreateRideRequest } from '@/lib/dispatcher.functions';
import { calculateDeliveryPrice } from '@/lib/swift-pricing';
import { VEHICLE_TIERS, calculateTierFare, POPULAR_DESTINATIONS } from '@/lib/ride-pricing';
import { searchLocalLocations, resolveJosLocation, JOS_LOCATIONS } from '@/lib/location-suggestions';
import { haversineKm } from '@/lib/google-maps-client';

export const Route = createFileRoute('/swiftmove')({
  head: () => ({
    meta: [
      { title: 'SwiftMove Logistics & Rides — Fast, Reliable & On-Demand in Jos' },
      {
        name: 'description',
        content:
          'SwiftMove Express Network. Send parcels in minutes, request passenger rides (Comfort Sedan & Nimble Keke), and track live across Jos & Plateau State.',
      },
      { property: 'og:title', content: 'SwiftMove Logistics & Rides — Fast Deliveries & City Rides' },
      { property: 'og:description', content: 'On-demand parcel dispatch, passenger rides, and live GPS tracking across Jos.' },
      { name: 'theme-color', content: '#FF6B00' },
      { name: 'apple-mobile-web-app-title', content: 'SwiftMove' },
    ],
    links: [
      { rel: 'icon', href: '/swiftmove-logo.jpg', type: 'image/jpeg' },
      { rel: 'shortcut icon', href: '/swiftmove-logo.jpg' },
      { rel: 'apple-touch-icon', href: '/swiftmove-logo.jpg' },
      { rel: 'manifest', href: '/manifest-swiftmove.json?v=1' },
    ],
  }),
  component: SwiftMoveLanding,
});

// ── Quick Landmarks in Jos ──────────────────────────────────────────
const QUICK_HUBS = [
  'Jos Main Market',
  'Rayfield Resort',
  'UNIJOS Main Campus',
  'Bukuru Lowcost',
  'Old Airport Road',
  'British America',
];

// ── Popular Jos Simulated Routes ────────────────────────────────────
const POPULAR_JOS_ROUTES = [
  {
    from: 'Jos Main Market (Terminus)',
    to: 'Bukuru Express Junction',
    distance: 14.5,
    dispatchPrice: 1850,
    ridePrice: 2600,
    eta: '25 min',
    popularBadge: 'Top Route',
  },
  {
    from: 'Rayfield Resort',
    to: 'UNIJOS Main Campus, Bauchi Rd',
    distance: 11.2,
    dispatchPrice: 1550,
    ridePrice: 2200,
    eta: '20 min',
    popularBadge: 'High Demand',
  },
  {
    from: 'Old Airport Road',
    to: 'British America Junction',
    distance: 5.6,
    dispatchPrice: 1150,
    ridePrice: 1400,
    eta: '12 min',
    popularBadge: 'Fast Hop',
  },
  {
    from: 'Yakubu Gowon Airport, Heipang',
    to: 'State Secretariat, Tudun Wada',
    distance: 31.8,
    dispatchPrice: 3800,
    ridePrice: 6200,
    eta: '40 min',
    popularBadge: 'Airport Run',
  },
];

const STATS = [
  { value: '2,400+', label: 'Successful Trips & Deliveries', icon: Package },
  { value: '< 15 mins', label: 'Average Pickup Time', icon: Clock },
  { value: '99.2%', label: 'On-Time Completion Rate', icon: CheckCircle2 },
  { value: '100% Vetted', label: 'Verified Riders & Drivers', icon: ShieldCheck },
];

const REVIEWS = [
  {
    name: 'Amina Usman',
    role: 'Fashion Boutique Owner, Jos',
    text: 'SwiftMove cut my delivery times in half. Clients get their dresses delivered in 30 minutes. Absolute game-changer for my business!',
    rating: 5,
    tag: 'Frequent Dispatcher',
  },
  {
    name: 'Dr. Emmanuel Bello',
    role: 'Faculty of Natural Sciences, UNIJOS',
    text: 'Clean cars, polite drivers, and no haggling over prices. SwiftMove Regular is my go-to ride whenever I need to cross town.',
    rating: 5,
    tag: 'Daily Rider',
  },
  {
    name: 'Fatima Al-Hassan',
    role: 'Event Caterer, Rayfield',
    text: 'Sent fragile food trays and wedding gifts with SwiftMove courier bikes. Zero spills, tracked live all the way to Bukuru. Super impressed!',
    rating: 5,
    tag: 'Catering Logistics',
  },
];

export function SwiftMoveLanding() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const isDriver = role === 'driver' || role === 'dispatch_rider';
  const isDispatcher = role === 'swift_dispatcher' || role === 'dispatcher';
  const isAdmin = role === 'administrator' || role === 'admin' || role === 'swift_manager';
  const isSwiftDomain = isSwiftmoveDomain();
  const homePath = isSwiftDomain ? '/' : '/swiftmove';

  const userDisplayName =
    (user?.user_metadata as Record<string, any> | undefined)?.['full_name'] ||
    user?.email?.split('@')[0] ||
    'Customer';

  // ── Primary Interactive Tab: 'dispatch' | 'ride' | 'track' ──────────
  const [activeTab, setActiveTab] = useState<'dispatch' | 'ride' | 'track'>('dispatch');
  const [scheduleTiming, setScheduleTiming] = useState<'now' | 'scheduled'>('now');
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  // Dates & Times
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().split('T')[0], []);
  const [schedDate, setSchedDate] = useState<string>(todayStr);
  const [schedTime, setSchedTime] = useState<string>('10:00');

  // Locations
  const [schedPickup, setSchedPickup] = useState('');
  const [schedDropoff, setSchedDropoff] = useState('');
  const [schedPickupSuggestions, setSchedPickupSuggestions] = useState<any[]>([]);
  const [schedDropoffSuggestions, setSchedDropoffSuggestions] = useState<any[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'pickup' | 'dropoff' | null>(null);

  // Dispatch fields
  const [dispatchCategory, setDispatchCategory] = useState('Standard Parcel');
  const [dispatchWeight, setDispatchWeight] = useState<number>(2);
  const [dispatchPhone, setDispatchPhone] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Ride fields
  const [rideTierId, setRideTierId] = useState('regular');
  const [rideSeats, setRideSeats] = useState(1);
  const [ridePhone, setRidePhone] = useState('');

  // Tracking state
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingResult, setTrackingResult] = useState<{
    status: string;
    description: string;
    pickup: string;
    dropoff: string;
    rider_name?: string;
  } | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autocomplete suggestion queries
  useEffect(() => {
    if (activeSuggestionField === 'pickup' && schedPickup.trim().length >= 2) {
      setSchedPickupSuggestions(searchLocalLocations(schedPickup).slice(0, 5));
    } else {
      setSchedPickupSuggestions([]);
    }
  }, [schedPickup, activeSuggestionField]);

  useEffect(() => {
    if (activeSuggestionField === 'dropoff' && schedDropoff.trim().length >= 2) {
      setSchedDropoffSuggestions(searchLocalLocations(schedDropoff).slice(0, 5));
    } else {
      setSchedDropoffSuggestions([]);
    }
  }, [schedDropoff, activeSuggestionField]);

  // Distance estimation based on Plateau/Jos database
  const calculatedDistanceKm = useMemo(() => {
    if (!schedPickup.trim() || !schedDropoff.trim()) return 0;
    const pLoc = resolveJosLocation(schedPickup);
    const dLoc = resolveJosLocation(schedDropoff);
    if (pLoc && dLoc) {
      const straight = haversineKm(pLoc.lat, pLoc.lng, dLoc.lat, dLoc.lng);
      return Math.max(1.5, Math.round(straight * 1.35 * 10) / 10);
    }
    return 4.5;
  }, [schedPickup, schedDropoff]);

  // Estimated Fares
  const calculatedDispatchFare = useMemo(() => {
    const dist = calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5;
    return calculateDeliveryPrice(dist, dispatchWeight);
  }, [calculatedDistanceKm, dispatchWeight]);

  const selectedTier = useMemo(() => {
    return VEHICLE_TIERS.find((t) => t.id === rideTierId) || VEHICLE_TIERS[0];
  }, [rideTierId]);

  const calculatedRideFare = useMemo(() => {
    const dist = calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5;
    return calculateTierFare(selectedTier, dist);
  }, [selectedTier, calculatedDistanceKm]);

  // Swap pickup & dropoff
  const handleSwapLocations = () => {
    const temp = schedPickup;
    setSchedPickup(schedDropoff);
    setSchedDropoff(temp);
  };

  // Populate from a preset route
  const handleSelectRoutePreset = (from: string, to: string, mode: 'dispatch' | 'ride') => {
    setSchedPickup(from);
    setSchedDropoff(to);
    setActiveTab(mode);
    const widget = document.getElementById('figma-booking-widget');
    if (widget) {
      widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle Dispatch / Ride Submission
  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!schedPickup.trim()) {
      toast.error('Please enter a pickup address in Jos.');
      return;
    }
    if (!schedDropoff.trim()) {
      toast.error('Please enter a destination address in Jos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trackingId = `SMV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      if (activeTab === 'dispatch') {
        const metadata = encodeDispatchMetadata({
          cargoType: dispatchCategory,
          description: dispatchNotes || dispatchCategory,
          customerPhone: dispatchPhone || null,
          isScheduled: scheduleTiming === 'scheduled',
          scheduledDate: scheduleTiming === 'scheduled' ? schedDate : undefined,
          scheduledTime: scheduleTiming === 'scheduled' ? schedTime : undefined,
        });

        if (user?.id) {
          await customerCreateDispatchOrder({
            data: {
              customerId: user.id,
              pickupAddress: schedPickup.trim(),
              dropoffAddress: schedDropoff.trim(),
              packageType: metadata,
              weightKg: dispatchWeight,
              distanceKm: calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5,
              fare: calculatedDispatchFare,
              trackingId,
            },
          });
          toast.success(
            scheduleTiming === 'scheduled'
              ? `📅 Dispatch scheduled for ${schedDate} at ${schedTime}!`
              : '📦 Dispatch order placed! Assigned rider is on the way.'
          );
          navigate({ to: '/my-swift-move' });
        } else {
          localStorage.setItem(
            'pending_dispatch_schedule',
            JSON.stringify({
              pickupText: schedPickup.trim(),
              dropoffText: schedDropoff.trim(),
              weightKg: dispatchWeight,
              description: dispatchNotes || dispatchCategory,
              timingType: scheduleTiming,
              scheduleDate: schedDate,
              scheduleTime: schedTime,
              phone: dispatchPhone,
            })
          );
          toast.info('Sign in or register to confirm your instant dispatch.');
          navigate({ to: '/auth', search: { mode: 'login', redirect: '/my-swift-move' } });
        }
      } else if (activeTab === 'ride') {
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const metadata = encodeRideMetadata({
          tierName: selectedTier.name,
          tierId: selectedTier.id,
          seats: rideSeats,
          safetyPin: pin,
          customerPhone: ridePhone || null,
          isScheduled: scheduleTiming === 'scheduled',
          scheduledDate: scheduleTiming === 'scheduled' ? schedDate : undefined,
          scheduledTime: scheduleTiming === 'scheduled' ? schedTime : undefined,
        });

        if (user?.id) {
          await customerCreateRideRequest({
            data: {
              customerId: user.id,
              pickupAddress: schedPickup.trim(),
              dropoffAddress: schedDropoff.trim(),
              packageType: metadata,
              capacity: selectedTier.capacity,
              distanceKm: calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5,
              fare: calculatedRideFare,
              trackingId,
              category: selectedTier.category,
              subCategoryDb: selectedTier.subCategoryDb,
            },
          });
          toast.success(
            scheduleTiming === 'scheduled'
              ? `📅 Ride scheduled for ${schedDate} at ${schedTime}!`
              : '🚗 Ride requested! Finding nearest driver in Jos...'
          );
          navigate({ to: '/my-vehicle-hires' });
        } else {
          localStorage.setItem(
            'pending_ride_schedule',
            JSON.stringify({
              pickupText: schedPickup.trim(),
              dropoffText: schedDropoff.trim(),
              tierId: selectedTier.id,
              seats: rideSeats,
              timingType: scheduleTiming,
              scheduleDate: schedDate,
              scheduleTime: schedTime,
              phone: ridePhone,
            })
          );
          toast.info('Sign in or register to complete your ride booking.');
          navigate({ to: '/auth', search: { mode: 'login', redirect: '/my-vehicle-hires' } });
        }
      }
    } catch (err: any) {
      toast.error('Booking failed: ' + (err.message || 'Please check details and retry.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Tracking Lookup
  async function handleTrackOrder(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = trackingCode.trim().toUpperCase();
    if (!cleanCode) return;
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingResult(null);
    try {
      const { data, error } = await supabase
        .from('swift_deliveries')
        .select('*')
        .or(`payment_reference.eq.${cleanCode},id.eq.${cleanCode}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Provide friendly preview if simulated demo code
        if (cleanCode.startsWith('SMV-')) {
          setTrackingResult({
            status: 'in_transit',
            description: 'Express Parcel (Live Demonstration)',
            pickup: 'Jos Main Market, Terminus',
            dropoff: 'Rayfield Resort, Jos',
            rider_name: 'Musa Ibrahim (Honda CB 125)',
          });
        } else {
          setTrackingError('No order found with that tracking code. Please verify your reference.');
        }
      } else {
        setTrackingResult({
          status: data.status,
          description: data.description || data.package_type || 'Package',
          pickup: data.pickup_address,
          dropoff: data.dropoff_address,
        });
      }
    } catch {
      setTrackingError('Unable to fetch tracking status. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  }

  const statusBadgeColor: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-blue-50 text-blue-700 border-blue-200',
    picked_up: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    in_transit: 'bg-orange-50 text-orange-700 border-orange-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  async function handleSignOut() {
    await logout();
    navigate({ to: homePath as any });
  }

  return (
    <div className="swiftmove-theme min-h-screen bg-[#FAFAFC] text-slate-900 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      
      {/* ── 1. FIGMA HEADER / NAVIGATION ─────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-slate-200/70 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          
          {/* Logo & Operational Status */}
          <div className="flex items-center gap-4">
            <SwiftmoveLogo />
            <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-slate-200/80 text-xs text-slate-500">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700">Jos Fleet Active</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">24/7 On-Demand</span>
            </div>
          </div>

          {/* Quick Nav Pills */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 text-xs font-semibold text-slate-600">
            <button
              onClick={() => {
                setActiveTab('dispatch');
                document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'dispatch' ? 'bg-white text-orange-600 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Send Parcel
            </button>
            <button
              onClick={() => {
                setActiveTab('ride');
                document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'ride' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              City Rides &amp; Keke
            </button>
            <button
              onClick={() => {
                setActiveTab('track');
                document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'track' ? 'bg-white text-emerald-600 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Track Order
            </button>
            <a
              href="#services"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 transition-colors"
            >
              Fleet &amp; Services
            </a>
            <a
              href="#popular-routes"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 transition-colors"
            >
              Routes &amp; Fares
            </a>
          </nav>

          {/* Right Action / Auth */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {userDisplayName}
                </span>

                {isDispatcher && (
                  <Link
                    to="/dispatcher"
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition-colors"
                  >
                    <Radio className="h-3.5 w-3.5 text-cyan-600" /> Dispatcher
                  </Link>
                )}

                {isDriver && (
                  <Link
                    to="/drive"
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5 text-emerald-600" /> Driver Console
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5 text-purple-600" /> Admin
                  </Link>
                )}

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:text-red-600 hover:border-red-200 transition-colors shadow-xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth"
                  search={{ mode: 'login', redirect: '/swiftmove' }}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: 'register', redirect: '/swiftmove' }}
                  className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 hover:scale-[1.02] transition-all"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION — CLEAN, AIRY, FIGMA 2-COLUMN LAYOUT ────── */}
      <section className="relative pt-6 sm:pt-10 pb-16 sm:pb-24 overflow-hidden">
        {/* Modern Ambient Backdrop Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-orange-100/40 via-amber-50/20 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="absolute -top-24 right-10 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Top Trust Capsule */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              <span>Express Dispatch &amp; Passenger Mobility across Jos, Plateau State</span>
              <span className="hidden sm:inline text-slate-400">•</span>
              <span className="hidden sm:inline text-orange-600 font-bold">Guaranteed Fixed Rates</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* ── LEFT COLUMN: Headline & Figma Interactive Console (7 cols) ── */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-4">
                Fast Deliveries. <br />
                Smooth City Rides. <br />
                <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
                  Zero Stress.
                </span>
              </h1>

              <p className="text-slate-600 text-sm sm:text-base lg:text-lg max-w-xl mb-6 leading-relaxed">
                Jos's smartest on-demand mobility platform. Dispatch parcels across town in under 45 minutes, book comfortable sedan &amp; keke rides, and track live in real time.
              </p>

              {/* ── FIGMA INTERACTIVE BOOKING CONSOLE ─────────────────── */}
              <div
                id="figma-booking-widget"
                className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 overflow-hidden transition-all duration-300"
              >
                {/* Clean Segmented Tabs */}
                <div className="flex items-center p-1.5 bg-slate-100/90 border-b border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dispatch')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'dispatch'
                        ? 'bg-white text-orange-600 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="h-4 w-4 text-orange-500" />
                    <span>Send Parcel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('ride')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'ride'
                        ? 'bg-white text-blue-600 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Car className="h-4 w-4 text-blue-600" />
                    <span>Request Ride</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('track')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'track'
                        ? 'bg-white text-emerald-600 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Search className="h-4 w-4 text-emerald-600" />
                    <span>Track Order</span>
                  </button>
                </div>

                {/* ── TAB 1 & 2: DISPATCH & RIDE BOOKING FORM ──────────── */}
                {activeTab !== 'track' ? (
                  <form onSubmit={handleConfirmBooking} className="p-4 sm:p-6 space-y-4">
                    
                    {/* Integrated Route Inputs (Pickup + Swap + Dropoff) */}
                    <div className="relative bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80 space-y-2">
                      
                      {/* Pickup Input */}
                      <div className="relative flex items-center gap-3 bg-white rounded-xl px-3.5 py-2.5 border border-slate-200/90 shadow-2xs focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                        <div className="flex flex-col items-center justify-center shrink-0">
                          <span className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                            Pickup Address (Jos)
                          </label>
                          <input
                            type="text"
                            value={schedPickup}
                            onChange={(e) => {
                              setSchedPickup(e.target.value);
                              setActiveSuggestionField('pickup');
                            }}
                            onFocus={() => setActiveSuggestionField('pickup')}
                            placeholder="e.g. Jos Main Market, Rayfield, Bukuru..."
                            className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                            required
                          />
                        </div>
                        {schedPickup && (
                          <button
                            type="button"
                            onClick={() => { setSchedPickup(''); setSchedPickupSuggestions([]); }}
                            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Swap Button Divider */}
                      <div className="flex items-center justify-between px-3">
                        <div className="h-px bg-slate-200/80 flex-1" />
                        <button
                          type="button"
                          onClick={handleSwapLocations}
                          title="Swap Pickup & Destination"
                          className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-500 hover:text-orange-600 hover:border-orange-300 flex items-center justify-center mx-2 cursor-pointer transition-transform hover:rotate-180"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                        <div className="h-px bg-slate-200/80 flex-1" />
                      </div>

                      {/* Destination Input */}
                      <div className="relative flex items-center gap-3 bg-white rounded-xl px-3.5 py-2.5 border border-slate-200/90 shadow-2xs focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                        <div className="flex flex-col items-center justify-center shrink-0">
                          <span className="h-3 w-3 rounded-full bg-orange-500 ring-4 ring-orange-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                            Destination Address (Jos)
                          </label>
                          <input
                            type="text"
                            value={schedDropoff}
                            onChange={(e) => {
                              setSchedDropoff(e.target.value);
                              setActiveSuggestionField('dropoff');
                            }}
                            onFocus={() => setActiveSuggestionField('dropoff')}
                            placeholder="e.g. UNIJOS Bauchi Rd, Old Airport, Heipang..."
                            className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                            required
                          />
                        </div>
                        {schedDropoff && (
                          <button
                            type="button"
                            onClick={() => { setSchedDropoff(''); setSchedDropoffSuggestions([]); }}
                            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Autocomplete Dropdown */}
                      {((activeSuggestionField === 'pickup' && schedPickupSuggestions.length > 0) ||
                        (activeSuggestionField === 'dropoff' && schedDropoffSuggestions.length > 0)) && (
                        <div className="absolute z-50 left-2 right-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                          {(activeSuggestionField === 'pickup' ? schedPickupSuggestions : schedDropoffSuggestions).map((sug) => (
                            <button
                              key={sug.id || sug.label}
                              type="button"
                              onClick={() => {
                                if (activeSuggestionField === 'pickup') {
                                  setSchedPickup(`${sug.label}, ${sug.sublabel}`);
                                } else {
                                  setSchedDropoff(`${sug.label}, ${sug.sublabel}`);
                                }
                                setActiveSuggestionField(null);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-orange-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between text-xs cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                <span className="font-bold text-slate-800 truncate">{sug.label}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 pl-2">{sug.sublabel}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Jos Landmarks Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick:</span>
                      {QUICK_HUBS.map((hub) => (
                        <button
                          key={hub}
                          type="button"
                          onClick={() => {
                            if (!schedPickup) setSchedPickup(hub);
                            else if (!schedDropoff) setSchedDropoff(hub);
                            else setSchedDropoff(hub);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 text-[11px] font-semibold border border-slate-200/70 transition-colors cursor-pointer"
                        >
                          {hub}
                        </button>
                      ))}
                    </div>

                    {/* ── MODE CUSTOMIZATIONS ───────────────────────── */}
                    {activeTab === 'dispatch' ? (
                      /* Parcel Package & Weight Options */
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Package Type
                          </label>
                          <select
                            value={dispatchCategory}
                            onChange={(e) => setDispatchCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value="Documents & Envelopes">Documents / Letters</option>
                            <option value="Standard Parcel">Standard Parcel</option>
                            <option value="Food & Catering">Food &amp; Pastries</option>
                            <option value="Electronics & Fragile">Electronics / Fragile</option>
                            <option value="Heavy Cargo & Boxes">Heavy Cargo (Van)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Est. Weight
                          </label>
                          <select
                            value={dispatchWeight}
                            onChange={(e) => setDispatchWeight(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value={1}>Under 1 kg</option>
                            <option value={2}>1 - 2 kg</option>
                            <option value={5}>3 - 5 kg</option>
                            <option value={10}>6 - 10 kg</option>
                            <option value={25}>20+ kg (Cargo)</option>
                          </select>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Recipient Phone (Optional)
                          </label>
                          <input
                            type="tel"
                            value={dispatchPhone}
                            onChange={(e) => setDispatchPhone(e.target.value)}
                            placeholder="0803 000 0000"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Ride Vehicle Selector (Figma 3-Card Selector) */
                      <div className="pt-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                          Select Vehicle Class
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {/* SwiftMove Regular */}
                          <button
                            type="button"
                            onClick={() => setRideTierId('regular')}
                            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              rideTierId === 'regular'
                                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Car className={`h-4 w-4 ${rideTierId === 'regular' ? 'text-blue-600' : 'text-slate-500'}`} />
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded-md">Sedan</span>
                            </div>
                            <p className="text-xs font-black text-slate-900 leading-tight">Regular</p>
                            <p className="text-[10px] text-slate-500">4 Seats • A/C</p>
                            <p className="text-xs font-black text-blue-700 mt-1">₦{calculateTierFare(VEHICLE_TIERS[0], calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5).toLocaleString()}</p>
                          </button>

                          {/* SwiftMove Keke */}
                          <button
                            type="button"
                            onClick={() => setRideTierId('keke')}
                            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              rideTierId === 'keke'
                                ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Bike className={`h-4 w-4 ${rideTierId === 'keke' ? 'text-amber-600' : 'text-slate-500'}`} />
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded-md">Quick</span>
                            </div>
                            <p className="text-xs font-black text-slate-900 leading-tight">Keke</p>
                            <p className="text-[10px] text-slate-500">3 Seats • Traffic-beater</p>
                            <p className="text-xs font-black text-amber-700 mt-1">₦{calculateTierFare(VEHICLE_TIERS[1], calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5).toLocaleString()}</p>
                          </button>

                          {/* SwiftMove Van / Cargo */}
                          <button
                            type="button"
                            onClick={() => setRideTierId('van')}
                            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              rideTierId === 'van'
                                ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Truck className={`h-4 w-4 ${rideTierId === 'van' ? 'text-purple-600' : 'text-slate-500'}`} />
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100/60 px-1.5 py-0.5 rounded-md">Luggage</span>
                            </div>
                            <p className="text-xs font-black text-slate-900 leading-tight">Van / Cargo</p>
                            <p className="text-[10px] text-slate-500">Groups / Loads</p>
                            <p className="text-xs font-black text-purple-700 mt-1">₦{calculateTierFare(VEHICLE_TIERS[2], calculatedDistanceKm > 0 ? calculatedDistanceKm : 4.5).toLocaleString()}</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Schedule for later collapsible toggle */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowScheduleDetails(!showScheduleDetails);
                          setScheduleTiming(showScheduleDetails ? 'now' : 'scheduled');
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-orange-600 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-orange-500" />
                        <span>{showScheduleDetails ? 'Book for right now instead' : 'Schedule pickup for a future date & time?'}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showScheduleDetails ? 'rotate-180' : ''}`} />
                      </button>

                      {showScheduleDetails && (
                        <div className="grid grid-cols-2 gap-3 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in duration-200">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Pickup Date</label>
                            <input
                              type="date"
                              min={todayStr}
                              value={schedDate}
                              onChange={(e) => setSchedDate(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Pickup Time</label>
                            <input
                              type="time"
                              value={schedTime}
                              onChange={(e) => setSchedTime(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── LIVE PRICE SUMMARY & PRIMARY ACTION BAR ─────── */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 rounded-2xl p-4 text-white shadow-md">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guaranteed Fare</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[11px] text-emerald-400 font-semibold">
                            {calculatedDistanceKm > 0 ? `~${calculatedDistanceKm} km` : 'Base Fare'}
                          </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
                          ₦{activeTab === 'dispatch' ? calculatedDispatchFare.toLocaleString() : calculatedRideFare.toLocaleString()}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {scheduleTiming === 'scheduled'
                            ? `Scheduled for ${schedDate} at ${schedTime}`
                            : 'Instant dispatch • Pay online or Cash/Transfer'}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !schedPickup.trim() || !schedDropoff.trim()}
                        className={`w-full sm:w-auto px-6 py-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          activeTab === 'dispatch'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/30'
                            : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-md shadow-blue-500/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Dispatching...</span>
                          </>
                        ) : (
                          <>
                            <span>{activeTab === 'dispatch' ? 'Confirm Dispatch' : 'Request Ride'}</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>

                  </form>
                ) : (
                  /* ── TAB 3: TRACK ORDER FORM ────────────────────────── */
                  <div className="p-5 sm:p-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">Track Live Delivery or Ride</h3>
                      <p className="text-xs text-slate-500">
                        Enter your tracking reference to see live GPS location and status. No login needed.
                      </p>
                    </div>

                    <form onSubmit={handleTrackOrder} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={trackingCode}
                          onChange={(e) => setTrackingCode(e.target.value)}
                          placeholder="e.g. SMV-202409-1234 or try SMV-DEMO-001"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={trackingLoading || !trackingCode.trim()}
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {trackingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span>Track</span>
                      </button>
                    </form>

                    {/* Quick Demo Pill */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Try quick demo:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackingCode('SMV-DEMO-001');
                        }}
                        className="text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        SMV-DEMO-001
                      </button>
                    </div>

                    {/* Tracking Error */}
                    {trackingError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{trackingError}</span>
                      </div>
                    )}

                    {/* Tracking Result Card */}
                    {trackingResult && (
                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-900">Order Found</span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${statusBadgeColor[trackingResult.status] || 'bg-slate-100 text-slate-700'}`}>
                            {trackingResult.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Status Timeline */}
                        <div className="grid grid-cols-4 gap-1 text-center py-2 border-y border-emerald-200/60">
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
                            <span className="text-[10px] font-semibold text-slate-700 mt-1">Booked</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
                            <span className="text-[10px] font-semibold text-slate-700 mt-1">Assigned</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
                            <span className="text-[10px] font-bold text-orange-700 mt-1">In Transit</span>
                          </div>
                          <div className="flex flex-col items-center opacity-40">
                            <div className="h-6 w-6 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[10px]">○</div>
                            <span className="text-[10px] font-semibold text-slate-500 mt-1">Delivered</span>
                          </div>
                        </div>

                        <div className="text-xs space-y-1 text-slate-700">
                          <p><strong className="text-slate-900">Item:</strong> {trackingResult.description}</p>
                          <p><strong className="text-slate-900">From:</strong> {trackingResult.pickup}</p>
                          <p><strong className="text-slate-900">To:</strong> {trackingResult.dropoff}</p>
                          {trackingResult.rider_name && (
                            <p><strong className="text-slate-900">Assigned Driver:</strong> {trackingResult.rider_name}</p>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>

            {/* ── RIGHT COLUMN: High-Fidelity 3D Figma Visual Showcase (5 cols) ── */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0">
              
              {/* Main Visual Frame */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 group">
                <img
                  src="/swiftmove-figma-hero.jpg"
                  alt="SwiftMove Express Network — Modern City Deliveries & Rides"
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                  width={600}
                  height={600}
                />

                {/* Floating Glass Pill 1 (Top Left) */}
                <div className="absolute top-4 left-4 p-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg flex items-center gap-3 animate-in fade-in duration-500">
                  <div className="h-9 w-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">Express Motorcycle</p>
                    <p className="text-[10px] text-slate-500">Across Jos in &lt; 45 mins</p>
                  </div>
                </div>

                {/* Floating Glass Pill 2 (Bottom Right) */}
                <div className="absolute bottom-4 right-4 p-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg flex items-center gap-3 animate-in fade-in duration-700">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">SwiftMove City Ride</p>
                    <p className="text-[10px] text-emerald-600 font-bold">● Driver Nearby (3 mins)</p>
                  </div>
                </div>
              </div>

              {/* Bottom Fast Stats strip */}
              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200/70 shadow-2xs">
                  <p className="text-base sm:text-lg font-black text-slate-900">2,400+</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Orders Fulfilled</p>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200/70 shadow-2xs">
                  <p className="text-base sm:text-lg font-black text-orange-600">&lt; 15m</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Avg. Pickup Time</p>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200/70 shadow-2xs">
                  <p className="text-base sm:text-lg font-black text-blue-600">4.9 ★</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Customer Rating</p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── 3. POPULAR JOS ROUTES & LIVE FARE SIMULATOR ─────────────── */}
      <section id="popular-routes" className="py-14 sm:py-20 bg-white border-y border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700 mb-2">
                <Compass className="h-3.5 w-3.5 text-orange-600" />
                <span>Transparent Plateau Pricing</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Top Jos Routes &amp; Estimates
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Click any route to instantly preview fares and book.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 text-xs text-slate-500 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Real-time GPS calculation enabled</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {POPULAR_JOS_ROUTES.map((route) => (
              <div
                key={route.from + route.to}
                className="group relative flex flex-col justify-between p-5 rounded-3xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:border-orange-400 hover:shadow-lg transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                      {route.eta}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                      {route.popularBadge}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 leading-tight">{route.from}</p>
                    </div>
                    <div className="h-4 border-l-2 border-dashed border-slate-300 ml-1" />
                    <div className="flex items-start gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500 mt-1 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 leading-tight">{route.to}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Parcel Courier</span>
                      <span className="font-black text-orange-600">₦{route.dispatchPrice.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">City Ride</span>
                      <span className="font-black text-blue-600">₦{route.ridePrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRoutePreset(route.from, route.to, 'dispatch')}
                      className="w-full py-1.5 rounded-xl bg-orange-50 hover:bg-orange-500 text-orange-700 hover:text-white text-[11px] font-bold transition-all text-center cursor-pointer"
                    >
                      Send Parcel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRoutePreset(route.from, route.to, 'ride')}
                      className="w-full py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-[11px] font-bold transition-all text-center cursor-pointer"
                    >
                      Book Ride
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 4. 3 CORE SERVICE PILLARS (LESS CROWDED, STRAIGHT TO POINT) ── */}
      <section id="services" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 mb-3">
              <Award className="h-3.5 w-3.5 text-orange-500" />
              <span>Full Mobility Ecosystem</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
              Three Services. One App.
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Clean, straight to the point logistics and transportation tailored for Jos, Plateau State and inter-state corridors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Service 1: Express Courier */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="h-14 w-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mb-6 shadow-2xs">
                  <Package className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wider">
                    Courier Dispatch
                  </span>
                  <span className="text-xs text-slate-400 font-bold">From ₦1,000</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">Express Motorbike Delivery</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Nimble motorbike couriers for documents, e-commerce products, groceries, hot restaurant meals, and small cartons. Fast same-hour delivery across Jos.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dispatch');
                    document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-3 rounded-xl bg-orange-50 hover:bg-orange-500 text-orange-700 hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Book Express Courier</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Service 2: Passenger Rides */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-6 shadow-2xs">
                  <Car className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                    City Ride Hailing
                  </span>
                  <span className="text-xs text-slate-400 font-bold">From ₦700</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">SwiftMove Regular &amp; Keke</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Air-conditioned comfort sedans for work and meetings, or speedy tricycle (keke) hops to beat market traffic. Verified drivers, zero surge pricing.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ride');
                    document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-3 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Request City Ride</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Service 3: Vehicle Hire & Cargo */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-purple-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="h-14 w-14 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-6 shadow-2xs">
                  <Truck className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
                    Heavy Cargo &amp; Van
                  </span>
                  <span className="text-xs text-slate-400 font-bold">By Distance</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">Vehicle Hire &amp; Cargo Freight</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Hire vans, pickups, and trucks for home relocations, event logistics, wholesale farm produce, and commercial deliveries across Plateau State and beyond.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/my-vehicle-hires"
                  className="w-full py-3 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>Explore Cargo Hire</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 5. BENTO GRID: WHY SWIFTMOVE (USER FRIENDLY & RELIABLE) ─── */}
      <section className="py-16 sm:py-24 bg-white border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">The SwiftMove Standard</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Engineered for Peace of Mind
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                <Navigation className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Live Map Telemetry</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Watch your parcel or ride on an interactive map with minute-by-minute ETA updates.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">100% Vetted Personnel</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every driver and courier undergoes identity checks, vehicle inspection, and background vetting.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Transparent Fares</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Know your exact fare upfront. No peak surge shocks or uncomfortable fare negotiations.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Barakah Backed</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Built and managed by Barakah Development Centre — institutional excellence you can trust.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 6. 3-STEP PROCESS: HOW IT WORKS ─────────────────────────── */}
      <section className="py-16 sm:py-24 bg-[#FAFAFC] border-t border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">Simple as 1-2-3</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              How SwiftMove Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-2xs relative">
              <span className="text-4xl font-black text-orange-500/20 font-mono block mb-3">01</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Enter Locations &amp; Fare</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Type pickup and destination in Jos. Choose instant dispatch or set a scheduled time.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-2xs relative">
              <span className="text-4xl font-black text-orange-500/20 font-mono block mb-3">02</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Courier / Driver Assigned</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Nearest verified rider is deployed. You get rider details, bike/car plates, and phone contact.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-2xs relative">
              <span className="text-4xl font-black text-orange-500/20 font-mono block mb-3">03</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Track &amp; Deliver Safely</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Follow progress live on the map. Verify delivery with security PIN and pay seamlessly.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 7. REVIEWS & CUSTOMER STORIES ────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
              Loved by Businesses &amp; Commuters
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Real reviews from real people across Jos, Plateau State.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {REVIEWS.map((rev) => (
              <div
                key={rev.name}
                className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                      {rev.tag}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-6 italic">
                    "{rev.text}"
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{rev.name}</p>
                  <p className="text-[11px] text-slate-500">{rev.role}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 8. HIGH IMPACT CTA BANNER ────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 p-8 sm:p-14 text-center text-white shadow-2xl relative overflow-hidden">
          
          {/* Subtle glow accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto space-y-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 border border-orange-500/30 text-orange-400 inline-block">
              SwiftMove Express Network
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Ready to send something or get moving?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Book your first delivery or ride in under 60 seconds. Guaranteed pricing, verified couriers, and zero hassle.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dispatch');
                  document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/30 transition-all cursor-pointer"
              >
                Send a Parcel Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ride');
                  document.getElementById('figma-booking-widget')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Request a Ride
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── 9. MINIMAL FIGMA FOOTER ──────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <SwiftmoveLogo variant="footer" />
            <div className="text-xs text-slate-500 border-l-0 sm:border-l border-slate-200 sm:pl-4">
              <p className="font-semibold text-slate-700">SwiftMove Logistics &amp; Ride Hailing</p>
              <p>A flagship ecosystem service by Barakah Development Centre</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <a href="https://barakahdevcentre.com" target="_blank" rel="noreferrer" className="hover:text-orange-600 transition-colors flex items-center gap-1">
              <span>Main Barakah Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a href="tel:+234800BARAKAH" className="hover:text-orange-600 transition-colors flex items-center gap-1">
              <PhoneCall className="h-3 w-3 text-orange-500" />
              <span>Support Hotline</span>
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} SwiftMove.ng. All rights reserved.</p>
          <p>Plateau State • Nigeria • On-Demand Mobility</p>
        </div>
      </footer>

    </div>
  );
}
