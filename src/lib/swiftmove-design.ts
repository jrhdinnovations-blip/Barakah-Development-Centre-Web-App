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
  supportPhone: '07041626545',
  supportPhoneDisplay: '0704 162 6545',
  whatsappNumber: '07044223076',
  whatsappDisplay: '0704 422 3076',
  whatsappUrl: 'https://wa.me/2347044223076',
  bankAccounts: [
    {
      bank: 'Zenith Bank',
      accountNumber: '1310765201',
      accountName: 'SwiftMove Logistics',
    },
    {
      bank: 'Moniepoint',
      accountNumber: '7066252731',
      accountName: 'SwiftMove Logistics',
    },
  ],
  supportEmail: 'support@swiftmove.ng',
  currency: 'NGN',
  currencySymbol: '₦',
  operatingHours: '24 Hours / 7 Days a Week',
  averagePickupMins: 12,
  completedOrdersCount: '15,000+',
  satisfactionRating: 4.9,
};

/**
 * Builds a formatted WhatsApp link pre-filled with the customer's parcel order receipt
 * for submission to 07044223076 for instant payment confirmation.
 */
export function buildParcelWhatsAppReceipt(order: {
  trackingId: string;
  amount: number;
  paymentMethod: 'paystack' | 'transfer' | string;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  reference?: string | null;
  date?: string;
}): string {
  const methodLabel = order.paymentMethod === 'paystack' ? 'Paystack Gateway' : 'Direct Bank Transfer';
  const now = order.date || new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  const lines = [
    `*SWIFTMOVE DISPATCH - PAYMENT RECEIPT*`,
    `--------------------------------------`,
    `📦 *Tracking ID:* ${order.trackingId}`,
    `💰 *Amount:* ₦${order.amount.toLocaleString()}`,
    `💳 *Payment Method:* ${methodLabel}`,
    order.reference ? `🧾 *Reference:* ${order.reference}` : null,
    `📅 *Date:* ${now}`,
    `📍 *Pickup:* ${order.pickupAddress}`,
    `🎯 *Delivery:* ${order.dropoffAddress}`,
    `👤 *Recipient:* ${order.recipientName}${order.recipientPhone ? ` (${order.recipientPhone})` : ''}`,
    `--------------------------------------`,
    `Hello SwiftMove Support, I have completed payment for this parcel dispatch order. Please find my payment receipt / proof attached for verification & rider assignment. Thank you!`,
  ].filter(Boolean) as string[];

  return `https://wa.me/2347044223076?text=${encodeURIComponent(lines.join('\n'))}`;
}

export interface SwiftBusTier {
  id: 'hiace' | 'coaster' | 'coach';
  name: string;
  tagline: string;
  capacity: number;
  seatsText: string;
  baseFare: number;
  perKmRate: number;
  sampleVehicles: string;
  description: string;
  features: string[];
  luggage: string;
  icon: string;
}

export const SWIFTBUS_TIERS: SwiftBusTier[] = [
  {
    id: 'hiace',
    name: 'SwiftBus Mini (14-Seater)',
    tagline: 'Ideal for small groups, airport transfers & delegations',
    capacity: 14,
    seatsText: '14 Passengers',
    baseFare: 35000,
    perKmRate: 650,
    sampleVehicles: 'Toyota HiAce High-Roof, Nissan Urvan',
    description: 'Fully air-conditioned 14-seater commuter bus with professional chauffeur, ample legroom, and rear luggage compartment.',
    features: ['14 Passenger Seats', 'Full Air Conditioning', 'Luggage Space', 'Vetted Commercial Captain'],
    luggage: 'Up to 10 Medium Bags',
    icon: '🚐',
  },
  {
    id: 'coaster',
    name: 'SwiftBus Medium (18-30 Seater)',
    tagline: 'Perfect for weddings, church/mosque trips & excursions',
    capacity: 25,
    seatsText: '18 - 30 Passengers',
    baseFare: 65000,
    perKmRate: 950,
    sampleVehicles: 'Toyota Coaster, Mitsubishi Rosa',
    description: 'Spacious medium bus designed for large party conveyance, student excursions, church/mosque events, and inter-city delegations.',
    features: ['25-30 Seats', 'PA Audio System', 'Dual AC Cooling', 'Overhead Parcel Racks'],
    luggage: 'Large Luggage Compartment',
    icon: '🚌',
  },
  {
    id: 'coach',
    name: 'SwiftBus Executive Coach (32-50 Seater)',
    tagline: 'Premium interstate travel, mega events & conferences',
    capacity: 45,
    seatsText: '32 - 50 Passengers',
    baseFare: 120000,
    perKmRate: 1400,
    sampleVehicles: 'Marcopolo Coach, Yutong Luxury Liner',
    description: 'Luxury executive coach with reclining seats, high-speed climate control, entertainment screens, and premium ride stability for group long-distance conveyance.',
    features: ['Luxury Reclining Seats', 'Under-Coach Cargo Hold', 'Entertainment Display', 'Chilled Climate Control'],
    luggage: 'Heavy Cargo & Baggage Hold',
    icon: '🚍',
  },
];

/**
 * Builds a formatted WhatsApp link pre-filled with the customer's SwiftBus booking
 * for submission to 07044223076 for immediate charter confirmation.
 */
export function buildSwiftBusWhatsAppBooking(booking: {
  bookingId: string;
  busType: string;
  passengers?: number;
  tripType: string;
  purpose?: string;
  pickupLocation: string;
  destination: string;
  departureDate: string;
  departureTime?: string;
  contactName: string;
  contactPhone: string;
  estimatedFare: number;
  paymentMethod?: string;
  reference?: string | null;
  notes?: string;
}): string {
  const methodLabel = booking.paymentMethod === 'paystack' ? 'Paystack Gateway' : 'Direct Bank Transfer / Pay on Charter';
  const lines = [
    `*SWIFTBUS CHARTER - BOOKING REQUEST*`,
    `--------------------------------------`,
    `🚌 *Booking ID:* ${booking.bookingId}`,
    `🚐 *Bus Model:* ${booking.busType}`,
    booking.passengers ? `👥 *Passengers:* ${booking.passengers} Seats` : null,
    `🔄 *Trip Mode:* ${booking.tripType}`,
    booking.purpose ? `🎯 *Purpose:* ${booking.purpose}` : null,
    `📅 *Departure Date:* ${booking.departureDate}${booking.departureTime ? ` at ${booking.departureTime}` : ''}`,
    `📍 *Pickup Station:* ${booking.pickupLocation}`,
    `🏁 *Destination:* ${booking.destination}`,
    `👤 *Contact Person:* ${booking.contactName} (${booking.contactPhone})`,
    `💰 *Estimated Fare:* ₦${booking.estimatedFare.toLocaleString()}`,
    `💳 *Payment Option:* ${methodLabel}`,
    booking.reference ? `🧾 *Reference / Receipt:* ${booking.reference}` : null,
    booking.notes ? `📝 *Special Requests:* ${booking.notes}` : null,
    `--------------------------------------`,
    `Hello SwiftMove Dispatcher, I would like to confirm our SwiftBus booking to convey our passengers to the destination above. Please provide driver details and payment confirmation. Thank you!`,
  ].filter(Boolean) as string[];

  return `https://wa.me/2347044223076?text=${encodeURIComponent(lines.join('\n'))}`;
}

export type ServicePillar = 'ride' | 'send' | 'bus' | 'move' | 'track';

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
  bus: {
    id: 'bus',
    title: 'SwiftBus',
    badge: 'Group Conveyance',
    headline: 'Group Travel & Charter Buses',
    tagline: 'Order 14 to 50-Seater Buses to Convey People Anywhere',
    description: 'Safe, comfortable, and affordable bus charter services for wedding parties, religious delegations, school excursions, corporate retreats, and inter-city group travel across Plateau State and Nigeria.',
    icon: 'Bus',
    accentColor: '#059669',
    bgGradient: 'from-emerald-600 to-teal-700',
  },
  move: {
    id: 'move',
    title: 'SwiftBus Charter',
    badge: 'Group Conveyance',
    headline: 'Destination & Group Bus Services',
    tagline: 'Charter Buses on Demand to Convey People to Any Destination',
    description: 'Order 14, 18, and 32-seater executive buses to transport delegations, families, event guests, and groups safely.',
    icon: 'Bus',
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
