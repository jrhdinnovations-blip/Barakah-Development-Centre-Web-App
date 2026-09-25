/**
 * SwiftMove Design System & Service Constants
 * Standardized across Customer, Driver, Dispatcher, Admin & Business interfaces.
 */

export const SWIFTMOVE_BRAND = {
  name: 'SwiftMove',
  legalName: 'SwiftMove Logistics & Mobility Technologies Ltd',
  tagline: 'One platform. Move people. Move packages. Move business.',
  shortTagline: 'Move people. Move packages. Move business.',
  city: 'Jos, Plateau State',
  country: 'Nigeria',
  supportPhone: '+234 800 SWIFT MOVE',
  supportEmail: 'support@swiftmove.ng',
  currency: 'NGN',
  currencySymbol: '₦',
  operatingHours: '24 Hours / 7 Days a Week',
  averagePickupMins: 12,
  completedOrdersCount: '15,000+',
  satisfactionRating: 4.9,
};

export type ServicePillar = 'ride' | 'send' | 'move' | 'track';

export interface ServiceDefinition {
  id: ServicePillar;
  title: string;
  badge: string;
  headline: string;
  tagline: string;
  description: string;
  icon: string;
  accentColor: string;
  bgGradient: string;
}

export const SERVICE_PILLARS: Record<ServicePillar, ServiceDefinition> = {
  ride: {
    id: 'ride',
    title: 'Ride',
    badge: 'Move People',
    headline: 'Instant & Affordable City Rides',
    tagline: 'Comfort Sedan & Agile Keke at Transparent Rates',
    description: 'Hail vetted, reliable drivers for your daily commutes, campus rides, and business meetings across Jos.',
    icon: 'Car',
    accentColor: '#2563EB',
    bgGradient: 'from-blue-600 to-indigo-700',
  },
  send: {
    id: 'send',
    title: 'Send',
    badge: 'Move Packages',
    headline: 'Express Door-to-Door Dispatch',
    tagline: 'Under 45 Minutes Across Town with OTP Proof',
    description: 'Same-day motorbike and van couriers. Send food, legal documents, inventory, and parcels safely with live GPS tracking.',
    icon: 'Package',
    accentColor: '#EA580C',
    bgGradient: 'from-orange-500 to-amber-600',
  },
  move: {
    id: 'move',
    title: 'Move Business',
    badge: 'Move Business',
    headline: 'Freight & Corporate Logistics',
    tagline: 'Consolidated Billing, Team Travel & Fleet on Demand',
    description: 'Empower your company with multi-user logistics accounts, automated invoicing, dedicated vans, and prioritized support.',
    icon: 'Building2',
    accentColor: '#059669',
    bgGradient: 'from-emerald-600 to-teal-700',
  },
  track: {
    id: 'track',
    title: 'Track',
    badge: 'Live Radar',
    headline: 'Real-Time Order & Trip Radar',
    tagline: 'Live Map, Driver Telemetry & Digital Delivery Proof',
    description: 'Enter your tracking code to follow your package or driver in real-time, view verified driver info, or contact support.',
    icon: 'Radio',
    accentColor: '#7C3AED',
    bgGradient: 'from-purple-600 to-indigo-800',
  },
};

export const POPULAR_JOS_LOCATIONS = [
  { name: 'Jos Main Market (Terminus)', area: 'City Centre', lat: 9.9325, lng: 8.8912 },
  { name: 'Rayfield Resort & Golf Club', area: 'Rayfield', lat: 9.8512, lng: 8.9142 },
  { name: 'University of Jos (Main Campus)', area: 'Bauchi Road', lat: 9.9521, lng: 8.8876 },
  { name: 'Bukuru Lowcost / Expressway', area: 'Bukuru South', lat: 9.7942, lng: 8.8654 },
  { name: 'Old Airport Road', area: 'Jos South', lat: 9.8732, lng: 8.8791 },
  { name: 'British America Junction', area: 'Jos North', lat: 9.9184, lng: 8.9056 },
  { name: 'Lamingo / Plateau Hospital', area: 'Lamingo', lat: 9.9078, lng: 8.9482 },
  { name: 'Yakubu Gowon Airport', area: 'Heipang', lat: 9.6394, lng: 8.8691 },
];
