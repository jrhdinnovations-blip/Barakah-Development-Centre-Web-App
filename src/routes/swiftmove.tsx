import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Truck, Package, MapPin, Clock, ShieldCheck, Zap,
  ArrowRight, Star, PhoneCall, CheckCircle2, Navigation,
  Bike, Globe2, HeartHandshake, Car, UserCheck,
  Radio, Shield, LogOut, Search, X, Loader2, Calendar,
  CalendarClock, Check, Phone, FileText, ChevronRight, AlertCircle,
  Sparkles,
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
      { title: 'SwiftMove Logistics — Fast, Reliable Deliveries & Rides in Nigeria' },
      {
        name: 'description',
        content:
          'SwiftMove Express Network. Send parcels, schedule on-demand or future dispatches, request rides (SwiftMove Regular & SwiftMove Keke), and track live across Nigeria.',
      },
      { property: 'og:title', content: 'SwiftMove Logistics — Fast, Reliable Deliveries & Rides' },
      { property: 'og:description', content: 'Express parcel dispatch, passenger rides, and scheduled logistics across Nigeria.' },
      { name: 'theme-color', content: '#080c17' },
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

const STATS = [
  { value: '2,400+', label: 'Deliveries Completed', icon: Package },
  { value: '< 45min', label: 'Average Delivery Time', icon: Clock },
  { value: '98%', label: 'On-Time Rate', icon: CheckCircle2 },
  { value: '24 / 7', label: 'Service Availability', icon: Zap },
];

const SERVICES = [
  {
    icon: Bike,
    title: 'Express Dispatch',
    desc: 'Motorbike couriers for small packages, documents, and same-day deliveries across the city.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200/80 hover:border-orange-400',
  },
  {
    icon: Truck,
    title: 'Vehicle Hire',
    desc: 'Hire a van or truck for large cargo, furniture, equipment, or bulk business deliveries.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200/80 hover:border-blue-400',
  },
  {
    icon: Package,
    title: 'Package Delivery',
    desc: 'Safe, tracked delivery for fragile items, electronics, food, and anything in between.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80 hover:border-emerald-400',
  },
  {
    icon: Globe2,
    title: 'Inter-City Runs',
    desc: 'Long-distance deliveries between cities. Reliable, insured, with real-time tracking.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200/80 hover:border-purple-400',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Schedule or Book', desc: 'Enter pickup and destination. Pick instant or a scheduled future date & time.' },
  { step: '02', title: 'We Dispatch', desc: 'A verified courier or driver is assigned on schedule.' },
  { step: '03', title: 'Track Live', desc: 'Watch your delivery or ride on the live map in real time.' },
  { step: '04', title: 'Delivered', desc: 'Your package arrives or you reach your destination safely.' },
];

const REVIEWS = [
  { name: 'Amina Usman', role: 'Business Owner, Jos', stars: 5, text: 'SwiftMove has transformed how I send goods to clients. Super fast and the rider was professional. Will use again!' },
  { name: 'Emmanuel Bello', role: 'Student, Abuja', stars: 5, text: 'Ordered a delivery at 9am and it arrived before lunch. Honestly impressive. The app tracking is smooth too.' },
  { name: 'Fatima Al-Hassan', role: 'HR Manager', stars: 5, text: 'We use SwiftMove for all our office dispatch runs. Reliable, affordable, and great customer support.' },
];

export function SwiftMoveLanding() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const isDriver = role === 'driver' || role === 'dispatch_rider';
  const isDispatcher = role === 'swift_dispatcher' || role === 'dispatcher';
  const isAdmin = role === 'administrator' || role === 'admin' || role === 'swift_manager';
  const isSwiftDomain = isSwiftmoveDomain();
  const homePath = isSwiftDomain ? '/' : '/swiftmove';

  const userDisplayName = (user?.user_metadata as Record<string, any> | undefined)?.['full_name'] || user?.email?.split('@')[0] || 'Customer';

  // ── Scheduling Console State ──────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState<'dispatch' | 'ride'>('dispatch');
  const [scheduleTiming, setScheduleTiming] = useState<'scheduled' | 'now'>('scheduled');

  // Dates & Times
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().split('T')[0], []);
  const nextDayStr = useMemo(() => new Date(Date.now() + 172800000).toISOString().split('T')[0], []);

  const [schedDate, setSchedDate] = useState<string>(todayStr);
  const [schedTime, setSchedTime] = useState<string>('09:30');

  // Locations
  const [schedPickup, setSchedPickup] = useState('');
  const [schedDropoff, setSchedDropoff] = useState('');
  const [schedPickupSuggestions, setSchedPickupSuggestions] = useState<any[]>([]);
  const [schedDropoffSuggestions, setSchedDropoffSuggestions] = useState<any[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'pickup' | 'dropoff' | null>(null);

  // Dispatch fields
  const [dispatchCategory, setDispatchCategory] = useState('Standard Parcel');
  const [dispatchWeight, setDispatchWeight] = useState<number>(2);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchPhone, setDispatchPhone] = useState('');

  // Ride fields
  const [rideTierId, setRideTierId] = useState('regular');
  const [rideSeats, setRideSeats] = useState(1);
  const [ridePhone, setRidePhone] = useState('');
  const [rideNotes, setRideNotes] = useState('');

  // Submission state
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

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

  // Handle Schedule submission
  async function handleConfirmSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!schedPickup.trim()) {
      toast.error('Please enter a pickup address.');
      return;
    }
    if (!schedDropoff.trim()) {
      toast.error('Please enter a destination address.');
      return;
    }
    if (scheduleTiming === 'scheduled' && !schedDate) {
      toast.error('Please select a scheduled date.');
      return;
    }

    setIsSubmittingSchedule(true);
    try {
      const trackingId = `SMV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      if (scheduleMode === 'dispatch') {
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
              : '📦 Dispatch order placed successfully!'
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
          toast.info('Please sign in or register to complete your scheduled dispatch.');
          navigate({ to: '/auth', search: { mode: 'login', redirect: '/my-swift-move' } });
        }
      } else {
        // Ride mode
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const metadata = encodeRideMetadata({
          tierName: selectedTier.name,
          tierId: selectedTier.id,
          seats: rideSeats,
          safetyPin: pin,
          customerPhone: ridePhone || null,
          notes: rideNotes || null,
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
              : '🚗 Ride requested! Looking for nearby drivers...'
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
              notes: rideNotes,
            })
          );
          toast.info('Please sign in or register to complete your scheduled ride.');
          navigate({ to: '/auth', search: { mode: 'login', redirect: '/my-vehicle-hires' } });
        }
      }
    } catch (err: any) {
      toast.error('Booking failed: ' + (err.message || 'Please try again.'));
    } finally {
      setIsSubmittingSchedule(false);
    }
  }

  // ── Track Your Order state ──────────────────────────────────────────
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
        setTrackingError('No order found with that tracking code. Please check and try again.');
      } else {
        setTrackingResult({
          status: data.status,
          description: data.description || data.package_type || 'Package',
          pickup: data.pickup_address,
          dropoff: data.dropoff_address,
        });
      }
    } catch {
      setTrackingError('Something went wrong. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    accepted: 'bg-blue-100 text-blue-800 border-blue-300',
    picked_up: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    in_transit: 'bg-orange-100 text-orange-800 border-orange-300',
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
  };

  async function handleSignOut() {
    await logout();
    navigate({ to: homePath as any });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <SwiftmoveLogo />

          {/* Quick service navigation */}
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            {user ? (
              <Link to="/my-swift-move" className="hover:text-orange-600 font-medium transition-colors">
                Send a Parcel
              </Link>
            ) : (
              <Link to="/auth" search={{ redirect: "/my-swift-move", mode: "login" }} className="hover:text-orange-600 font-medium transition-colors">
                Send a Parcel
              </Link>
            )}
            {user ? (
              <Link to="/my-vehicle-hires" className="hover:text-blue-600 font-medium transition-colors">
                Request a Ride
              </Link>
            ) : (
              <Link to="/auth" search={{ redirect: "/my-vehicle-hires", mode: "login" }} className="hover:text-blue-600 font-medium transition-colors">
                Request a Ride
              </Link>
            )}
            <a href="#track-order" className="hover:text-emerald-600 font-medium transition-colors">Track Order</a>
            <a href="#services" className="text-slate-500 hover:text-slate-900 transition-colors">Services</a>
            <a href="#how-it-works" className="text-slate-500 hover:text-slate-900 transition-colors">How It Works</a>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {userDisplayName}
                </span>

                {isDispatcher && (
                  <Link
                    to="/dispatcher"
                    className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
                  >
                    <Radio className="h-3.5 w-3.5 text-cyan-600" /> Dispatcher
                  </Link>
                )}

                {isDriver && (
                  <Link
                    to="/drive"
                    className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5 text-emerald-600" /> Driver Console
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin"
                    className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5 text-purple-600" /> Admin
                  </Link>
                )}

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                  title="Sign out"
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
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: 'register', redirect: '/swiftmove' }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 transition-all hover:scale-105"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero & Primary 3-Action Customer Hub ────────────────────── */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 pt-12 pb-20"
        style={{
          backgroundImage: 'url(/swiftmove-hero-banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark gradient overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-50/95 pointer-events-none" />
        {/* Subtle animated grid on top */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(249,115,22,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative max-w-6xl mx-auto text-center w-full pt-16">

          {/* 4 Interactive Service Highlights matching Hero Banner */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10 px-2">
            <button
              type="button"
              onClick={() => {
                setScheduleMode('ride');
                setRideTierId('regular');
                document.getElementById('schedule-console')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Car &amp; Keke</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Quick &amp; Comfortable</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setScheduleMode('dispatch');
                document.getElementById('schedule-console')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-400 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors">Book Delivery</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Parcels • Documents • Goods</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                document.getElementById('track-order')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Track Your Order</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Live GPS &amp; Status Updates</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setScheduleMode('dispatch');
                setScheduleTiming('scheduled');
                document.getElementById('schedule-console')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-purple-400 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Bike className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">Dispatch</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Track • Coordinate • Support</p>
              </div>
            </button>
          </div>

          {/* Status / Welcome Badge */}
          {user ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 mb-6 backdrop-blur shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Welcome back, {userDisplayName}! Schedule an order or select a service:
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-800 mb-6 backdrop-blur shadow-sm">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              Couriers &amp; Verified Drivers Active Across Jos — Instant &amp; Advance Scheduling
            </div>
          )}

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight mb-4 leading-tight drop-shadow-lg">
            <span className="text-white">Need It Moved? </span>
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              We Move It Swift.
            </span>
          </h1>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black tracking-widest uppercase shadow-md mb-6">
            <span>Schedule</span>
            <span className="text-orange-400">•</span>
            <span>Dispatch</span>
            <span className="text-orange-400">•</span>
            <span>Ride</span>
          </div>

          <p className="text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow">
            Same-day package dispatch, on-demand passenger rides (<strong className="text-white">SwiftMove Regular</strong> &amp; <strong className="text-white">SwiftMove Keke</strong>), and live GPS tracking across Jos and Nigeria.
            Book for right now or pick an exact date and time below:
          </p>

          {/* ── INTERACTIVE SCHEDULE CONSOLE ──────────────────────────── */}
          <div id="schedule-console" className="mb-14 scroll-mt-24 text-left max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-orange-500/30 bg-white/95 backdrop-blur-xl p-6 sm:p-10 shadow-2xl shadow-orange-500/10">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700 mb-2">
                    <CalendarClock className="h-3.5 w-3.5 text-orange-600" />
                    <span>Instant &amp; Advance Scheduling</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Schedule a Dispatch or Ride
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Book for right now or pick an exact date and time in advance. Verified couriers &amp; drivers ready.
                  </p>
                </div>

                {/* Mode Selector: Dispatch vs Ride */}
                <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('dispatch')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      scheduleMode === 'dispatch'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="h-4 w-4" />
                    <span>Parcel Dispatch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode('ride')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      scheduleMode === 'ride'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Car className="h-4 w-4" />
                    <span>Passenger Ride</span>
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmSchedule} className="pt-6 space-y-6">
                
                {/* Timing Selector: Instant vs Scheduled */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-orange-500" />
                      When should we pick up?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleTiming('scheduled')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          scheduleTiming === 'scheduled'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Schedule for Later</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleTiming('now')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          scheduleTiming === 'now'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>Pick Up Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Date & Time Fields */}
                  {scheduleTiming === 'scheduled' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 animate-in fade-in duration-200">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                          Pickup Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          min={todayStr}
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
                          required
                        />
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => setSchedDate(todayStr)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                              schedDate === todayStr ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedDate(tomorrowStr)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                              schedDate === tomorrowStr ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Tomorrow
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedDate(nextDayStr)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                              schedDate === nextDayStr ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            In 2 Days
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                          Pickup Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={schedTime}
                          onChange={(e) => setSchedTime(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
                          required
                        />
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {['08:30', '11:00', '14:00', '17:30'].map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSchedTime(slot)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                schedTime === slot ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Locations Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Pickup Address */}
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Pickup Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                      <input
                        type="text"
                        value={schedPickup}
                        onChange={(e) => {
                          setSchedPickup(e.target.value);
                          setActiveSuggestionField('pickup');
                        }}
                        onFocus={() => setActiveSuggestionField('pickup')}
                        placeholder="e.g. Jos Main Market, Rayfield, UNIJOS..."
                        className="w-full pl-10 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        required
                      />
                      {schedPickup && (
                        <button
                          type="button"
                          onClick={() => { setSchedPickup(''); setSchedPickupSuggestions([]); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {/* Autocomplete Dropdown */}
                    {activeSuggestionField === 'pickup' && schedPickupSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                        {schedPickupSuggestions.map((sug) => (
                          <button
                            key={sug.id || sug.label}
                            type="button"
                            onClick={() => {
                              setSchedPickup(`${sug.label}, ${sug.sublabel}`);
                              setActiveSuggestionField(null);
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-orange-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span className="font-bold text-slate-800">{sug.label}</span>
                            <span className="text-slate-400 text-[10px] truncate max-w-[180px]">{sug.sublabel}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Destination Address */}
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Navigation className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-600" />
                      <input
                        type="text"
                        value={schedDropoff}
                        onChange={(e) => {
                          setSchedDropoff(e.target.value);
                          setActiveSuggestionField('dropoff');
                        }}
                        onFocus={() => setActiveSuggestionField('dropoff')}
                        placeholder="e.g. Yakubu Gowon Airport, Bukuru, Old Airport..."
                        className="w-full pl-10 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        required
                      />
                      {schedDropoff && (
                        <button
                          type="button"
                          onClick={() => { setSchedDropoff(''); setSchedDropoffSuggestions([]); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {/* Autocomplete Dropdown */}
                    {activeSuggestionField === 'dropoff' && schedDropoffSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                        {schedDropoffSuggestions.map((sug) => (
                          <button
                            key={sug.id || sug.label}
                            type="button"
                            onClick={() => {
                              setSchedDropoff(`${sug.label}, ${sug.sublabel}`);
                              setActiveSuggestionField(null);
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-orange-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span className="font-bold text-slate-800">{sug.label}</span>
                            <span className="text-slate-400 text-[10px] truncate max-w-[180px]">{sug.sublabel}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mode Specific Customizations */}
                {scheduleMode === 'dispatch' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Package Type
                      </label>
                      <select
                        value={dispatchCategory}
                        onChange={(e) => setDispatchCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="Documents & Letters">Documents &amp; Envelopes</option>
                        <option value="Standard Parcel">Standard Parcel</option>
                        <option value="Electronics & Fragile">Electronics &amp; Fragile</option>
                        <option value="Food & Catering">Food &amp; Catering</option>
                        <option value="Heavy Cargo & Boxes">Heavy Cargo &amp; Boxes</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Estimated Weight (kg)
                      </label>
                      <select
                        value={dispatchWeight}
                        onChange={(e) => setDispatchWeight(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value={1}>Up to 1 kg (Light)</option>
                        <option value={2}>Up to 2 kg (Standard)</option>
                        <option value={5}>Up to 5 kg (Box)</option>
                        <option value={10}>Up to 10 kg (Medium)</option>
                        <option value={25}>25+ kg (Bulk / Heavy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Recipient Phone (optional)
                      </label>
                      <input
                        type="tel"
                        value={dispatchPhone}
                        onChange={(e) => setDispatchPhone(e.target.value)}
                        placeholder="e.g. 0803 000 0000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Vehicle Type
                      </label>
                      <select
                        value={rideTierId}
                        onChange={(e) => setRideTierId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="regular">SwiftMove Regular (Comfort Sedan)</option>
                        <option value="keke">SwiftMove Keke (Nimble Tricycle)</option>
                        <option value="van">SwiftMove Van (Group &amp; Luggage)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Passenger Seats
                      </label>
                      <select
                        value={rideSeats}
                        onChange={(e) => setRideSeats(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value={1}>1 Passenger</option>
                        <option value={2}>2 Passengers</option>
                        <option value={3}>3 Passengers</option>
                        <option value={4}>4 Passengers (Full Car)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                        Passenger Phone
                      </label>
                      <input
                        type="tel"
                        value={ridePhone}
                        onChange={(e) => setRidePhone(e.target.value)}
                        placeholder="e.g. 0803 000 0000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                {/* Fare & Confirmation Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white shadow-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Estimated Fare</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Guaranteed
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        ₦{scheduleMode === 'dispatch' ? calculatedDispatchFare.toLocaleString() : calculatedRideFare.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400">
                        {calculatedDistanceKm > 0 ? `(~${calculatedDistanceKm} km)` : '(Base fare)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {scheduleTiming === 'scheduled' ? (
                        <span className="text-orange-300 font-semibold">
                          📅 Scheduled for {schedDate} at {schedTime}
                        </span>
                      ) : (
                        <span className="text-emerald-300 font-semibold">
                          ⚡ Instant request — dispatching immediately
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingSchedule || !schedPickup.trim() || !schedDropoff.trim()}
                    className={`px-8 py-4 rounded-2xl text-sm sm:text-base font-black shadow-xl transition-all duration-300 flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
                      scheduleMode === 'dispatch'
                        ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-blue-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                    }`}
                  >
                    {isSubmittingSchedule ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Processing Schedule…</span>
                      </>
                    ) : (
                      <>
                        <CalendarClock className="h-5 w-5" />
                        <span>
                          {scheduleTiming === 'scheduled'
                            ? scheduleMode === 'dispatch' ? 'Confirm & Schedule Dispatch' : 'Confirm & Schedule Ride'
                            : scheduleMode === 'dispatch' ? 'Book Dispatch Now' : 'Request Ride Now'
                          }
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* ── 4 PRIMARY ACTION BUTTONS / CARDS ──────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left max-w-6xl mx-auto">
            
            {/* Action 1: Send a Parcel */}
            {user ? (
              <Link
                to="/my-swift-move"
                className="group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl border border-orange-200/90 bg-white hover:border-orange-400 shadow-xl shadow-orange-500/5 hover:shadow-orange-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8 group-hover:bg-orange-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 group-hover:scale-110 transition-transform">
                      <Package className="h-7 w-7" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-orange-50 border border-orange-200 text-orange-700">
                      Dispatch
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-orange-600 transition-colors flex items-center gap-2">
                    Send a Parcel
                    <ArrowRight className="h-5 w-5 text-orange-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Express motorbike courier for documents, food, packages, and cargo vans with instant fare calculation.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-orange-600 group-hover:text-orange-700">
                  <span>Book Parcel Delivery</span>
                  <span className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: "/my-swift-move", mode: "login" }}
                className="group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl border border-orange-200/90 bg-white hover:border-orange-400 shadow-xl shadow-orange-500/5 hover:shadow-orange-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8 group-hover:bg-orange-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 group-hover:scale-110 transition-transform">
                      <Package className="h-7 w-7" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-orange-50 border border-orange-200 text-orange-700">
                      Dispatch
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-orange-600 transition-colors flex items-center gap-2">
                    Send a Parcel
                    <ArrowRight className="h-5 w-5 text-orange-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Express motorbike courier for documents, food, packages, and cargo vans with instant fare calculation.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-orange-600 group-hover:text-orange-700">
                  <span>Book Parcel Delivery</span>
                  <span className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            )}

            {/* Action 2: SwiftMove Regular */}
            {user ? (
              <Link
                to="/my-vehicle-hires"
                className="group relative flex flex-col justify-between p-6 rounded-3xl border border-blue-200/90 bg-white hover:border-blue-400 shadow-xl shadow-blue-500/5 hover:shadow-blue-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6 group-hover:bg-blue-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
                      <Car className="h-6 w-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-50 border border-blue-200 text-blue-700">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                    SwiftMove Regular
                    <ArrowRight className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Comfortable 4-seater sedan for daily city commutes. Air-conditioned, verified drivers.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-blue-600 group-hover:text-blue-700">
                  <span>Book Car Ride</span>
                  <span className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: "/my-vehicle-hires", mode: "login" }}
                className="group relative flex flex-col justify-between p-6 rounded-3xl border border-blue-200/90 bg-white hover:border-blue-400 shadow-xl shadow-blue-500/5 hover:shadow-blue-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6 group-hover:bg-blue-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
                      <Car className="h-6 w-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-50 border border-blue-200 text-blue-700">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                    SwiftMove Regular
                    <ArrowRight className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Comfortable 4-seater sedan for daily city commutes. Air-conditioned, verified drivers.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-blue-600 group-hover:text-blue-700">
                  <span>Book Car Ride</span>
                  <span className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )}

            {/* Action 3: SwiftMove Keke */}
            {user ? (
              <Link
                to="/my-vehicle-hires"
                className="group relative flex flex-col justify-between p-6 rounded-3xl border border-amber-200/90 bg-white hover:border-amber-400 shadow-xl shadow-amber-500/5 hover:shadow-amber-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-amber-50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6 group-hover:bg-amber-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform">
                      <Bike className="h-6 w-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-50 border border-amber-200 text-amber-700">
                      Affordable
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 group-hover:text-amber-600 transition-colors flex items-center gap-2">
                    SwiftMove Keke
                    <ArrowRight className="h-4 w-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Budget-friendly tricycle ride for short local hops. Quick, nimble, and beats traffic.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-amber-600 group-hover:text-amber-700">
                  <span>Book Keke Ride</span>
                  <span className="h-7 w-7 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: "/my-vehicle-hires", mode: "login" }}
                className="group relative flex flex-col justify-between p-6 rounded-3xl border border-amber-200/90 bg-white hover:border-amber-400 shadow-xl shadow-amber-500/5 hover:shadow-amber-500/15 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-amber-50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6 group-hover:bg-amber-100 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform">
                      <Bike className="h-6 w-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-50 border border-amber-200 text-amber-700">
                      Affordable
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 group-hover:text-amber-600 transition-colors flex items-center gap-2">
                    SwiftMove Keke
                    <ArrowRight className="h-4 w-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Budget-friendly tricycle ride for short local hops. Quick, nimble, and beats traffic.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-amber-600 group-hover:text-amber-700">
                  <span>Book Keke Ride</span>
                  <span className="h-7 w-7 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )}

            {/* Action 4: Track Your Order (no login required) */}
            <div
              id="track-order"
              className="group relative flex flex-col justify-between p-6 rounded-3xl border border-emerald-200/90 bg-white shadow-xl shadow-emerald-500/5 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-50 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                    <Navigation className="h-6 w-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 border border-emerald-200 text-emerald-700">
                    No Login Needed
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1.5">
                  Track Your Order
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Enter your tracking code to see live status, pickup, and delivery info — no account required.
                </p>

                {/* Tracking input */}
                <form onSubmit={handleTrackOrder} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                    placeholder="e.g. SMV-20240917-ABCD"
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-400 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={trackingLoading || !trackingCode.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {trackingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Track
                  </button>
                </form>

                {/* Error state */}
                {trackingError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                    {trackingError}
                  </div>
                )}

                {/* Result state */}
                {trackingResult && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${statusColors[trackingResult.status] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                        {trackingResult.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">Item:</span> {trackingResult.description}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">From:</span> {trackingResult.pickup}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">To:</span> {trackingResult.dropoff}
                    </div>
                    {trackingResult.rider_name && (
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">Rider:</span> {trackingResult.rider_name}
                      </div>
                    )}
                    <button
                      onClick={() => { setTrackingResult(null); setTrackingCode(''); }}
                      className="mt-1 text-xs text-emerald-700 hover:underline font-medium"
                    >
                      Track another order
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Trust badges */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
            {[
              { icon: ShieldCheck, text: 'Insured deliveries' },
              { icon: MapPin, text: 'Live GPS map tracking' },
              { icon: Clock, text: 'Average pickup < 15 mins' },
              { icon: CheckCircle2, text: 'Direct driver/rider contact' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
                <Icon className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-slate-700 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mb-1">{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────────────── */}
      <section id="services" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-sm font-bold uppercase tracking-widest mb-3">What We Offer</p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Logistics for every need</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              From a single envelope to a full truck — SwiftMove handles it all with speed and care.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div
                key={title}
                className={`group p-6 rounded-2xl border ${border} ${bg} shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-default`}
              >
                <div className={`h-12 w-12 rounded-xl ${bg} border ${border} flex items-center justify-center mb-5`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <h3 className={`text-lg font-bold ${color} mb-2`}>{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-slate-100/60 border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-sm font-bold uppercase tracking-widest mb-3">Simple Process</p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">How SwiftMove works</h2>
            <p className="text-slate-600 max-w-xl mx-auto">Four easy steps from booking to delivered.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="relative group">
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-400 hover:shadow-md transition-all h-full">
                  <span className="text-5xl font-black text-orange-500/20 group-hover:text-orange-500/35 transition-colors block mb-4 font-mono">
                    {step}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/auth"
              search={{ mode: 'signup' }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl text-base font-bold text-white shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:scale-105"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Reviews ────────────────────────────────────────────────── */}
      <section id="reviews" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-sm font-bold uppercase tracking-widest mb-3">Customer Stories</p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Loved by our customers</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {REVIEWS.map(({ name, role, stars, text }) => (
              <div key={name} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5">"{text}"</p>
                <div>
                  <p className="text-slate-900 font-bold text-sm">{name}</p>
                  <p className="text-slate-500 text-xs">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-amber-500 to-orange-600 p-12 text-center shadow-2xl shadow-orange-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),transparent_60%)]" />
            <div className="relative">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-6 mx-auto">
                <Navigation className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Ready to send something?
              </h2>
              <p className="text-orange-100 mb-8 max-w-xl mx-auto">
                Create a free account and book your first delivery in under 60 seconds. No subscription, no hidden fees.
              </p>
              <Link
                to="/auth"
                search={{ mode: 'signup' }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white rounded-2xl text-orange-600 font-black text-base hover:bg-orange-50 transition-colors shadow-lg"
              >
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer id="contact" className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="mb-4">
                <SwiftmoveLogo variant="footer" />
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                Nigeria's fast, reliable logistics service. Part of the Barakah Development Centre family.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><Link to="/auth" search={{ mode: 'signup' }} className="hover:text-orange-600 transition-colors">Book a Delivery</Link></li>
                <li><Link to="/auth" search={{ mode: 'login' }} className="hover:text-orange-600 transition-colors">Sign In</Link></li>
                <li><a href="https://barakahdevcentre.com" className="hover:text-orange-600 transition-colors">Main Barakah Site</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-orange-600 shrink-0" />
                  <span>+234 (0) 800 BARAKAH</span>
                </li>
                <li className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-orange-600 shrink-0" />
                  <a href="https://swiftmovelogistics.com" className="hover:text-orange-600 transition-colors">swiftmovelogistics.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SwiftMove Logistics · A Barakah Development Centre Service</p>
            <a href="https://barakahdevcentre.com" className="hover:text-slate-700 transition-colors">barakahdevcentre.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
