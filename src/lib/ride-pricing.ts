export interface VehicleTier {
  id: string;
  name: string;
  subTitle: string;
  category: 'private' | 'commercial';
  subCategoryDb: 'sedan' | 'luxury' | 'bus';
  capacity: number;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  etaMinutes: number;
  popular?: boolean;
  tag?: string;
  iconType: 'sedan' | 'comfort' | 'luxury' | 'van' | 'moto' | 'keke';
  description: string;
  sampleVehicles: string;
}

export const VEHICLE_TIERS: VehicleTier[] = [
  {
    id: 'swift_regular',
    name: 'SwiftMove Regular',
    subTitle: 'Everyday comfortable 4-seater car',
    category: 'private',
    subCategoryDb: 'sedan',
    capacity: 4,
    baseFare: 1200,
    perKmRate: 220,
    perMinRate: 25,
    etaMinutes: 2,
    popular: true,
    tag: 'Most Popular',
    iconType: 'sedan',
    description: 'Reliable, air-conditioned 4-seater sedans for daily city commutes.',
    sampleVehicles: 'Toyota Corolla, Honda Civic, Hyundai Accent',
  },
  {
    id: 'swift_keke',
    name: 'SwiftMove Keke',
    subTitle: 'Fast & budget-friendly tricycle',
    category: 'private',
    subCategoryDb: 'sedan',
    capacity: 3,
    baseFare: 500,
    perKmRate: 110,
    perMinRate: 15,
    etaMinutes: 1,
    tag: 'Affordable & Quick',
    iconType: 'keke',
    description: 'Quick, budget-friendly 3-wheeler tricycle rides ideal for local hops and avoiding traffic.',
    sampleVehicles: 'Bajaj RE, TVS King, Piaggio Ape',
  },
];

export function calculateTierFare(
  tier: VehicleTier,
  distanceKm: number,
  trafficMultiplier: number = 1.0
): number {
  if (!tier) return 0;
  if (distanceKm <= 0) return tier.baseFare || 0;
  // Estimated minutes based on typical city speed (approx 30km/h => 2 mins per km)
  const estimatedMins = Math.max(5, distanceKm * 2);
  const distanceCost = distanceKm * tier.perKmRate;
  const timeCost = estimatedMins * tier.perMinRate;
  const rawFare = (tier.baseFare + distanceCost + timeCost) * trafficMultiplier;

  // Round up to nearest 50 for clean Nigerian Naira pricing
  return Math.ceil(rawFare / 50) * 50;
}

/**
 * Driver / Dispatch Rider Payout Percentage.
 * Drivers and dispatch couriers take home 30% of the customer fare.
 */
export const DRIVER_PAYOUT_PERCENT = 30;
export const DRIVER_PAYOUT_RATE = 0.30;

export function calculateDriverEarnings(
  totalFare: number,
  sharePercent: number = DRIVER_PAYOUT_PERCENT
): number {
  if (!totalFare || isNaN(totalFare) || totalFare <= 0) return 0;
  const earnings = totalFare * (sharePercent / 100);
  // Round to nearest whole Naira
  return Math.round(earnings);
}

export interface QuickDestination {
  label: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  iconEmoji: string;
}

export const POPULAR_DESTINATIONS: QuickDestination[] = [
  {
    label: 'Yakubu Gowon Airport',
    name: 'Yakubu Gowon Airport (Jos Airport)',
    address: 'Heipang, Jos South, Plateau State',
    lat: 9.6397,
    lng: 8.8689,
    iconEmoji: '✈️',
  },
  {
    label: 'Jos Main Market / Terminus',
    name: 'Jos Main Market / Terminus',
    address: 'Ahmadu Bello Way, Jos, Plateau State',
    lat: 9.9248,
    lng: 8.8912,
    iconEmoji: '🛍️',
  },
  {
    label: 'Rayfield Govt House',
    name: 'Rayfield Government House',
    address: 'Rayfield, Jos South, Plateau State',
    lat: 9.8402,
    lng: 8.9135,
    iconEmoji: '🏛️',
  },
  {
    label: 'UNIJOS Main Campus',
    name: 'University of Jos (UNIJOS)',
    address: 'Bauchi Road, Jos, Plateau State',
    lat: 9.9542,
    lng: 8.8931,
    iconEmoji: '🎓',
  },
  {
    label: 'Bukuru Market Area',
    name: 'Bukuru Central Commercial Hub',
    address: 'Bukuru Expressway, Jos South, Plateau State',
    lat: 9.7944,
    lng: 8.8642,
    iconEmoji: '🏙️',
  },
  {
    label: 'JUTH Lamingo',
    name: 'Jos University Teaching Hospital (JUTH)',
    address: 'Lamingo, Jos North, Plateau State',
    lat: 9.9075,
    lng: 8.9485,
    iconEmoji: '🏥',
  },
];

export interface MockNearbyDriver {
  id: string;
  name: string;
  rating: number;
  trips: number;
  vehicleType: string;
  vehicleMake: string;
  plateNumber: string;
  vehicleColor: string;
  vehicleModel: string;
  phone: string;
  lat: number;
  lng: number;
  tierId: string;
}

export function generateNearbyDrivers(centerLat: number, centerLng: number): MockNearbyDriver[] {
  const drivers: MockNearbyDriver[] = [
    {
      id: 'drv-1',
      name: 'Chris Moses',
      rating: 4.9,
      trips: 1240,
      vehicleType: 'Sedan',
      vehicleMake: 'Toyota Corolla',
      plateNumber: 'JOS-824-PL',
      vehicleColor: 'Silver Metallic',
      vehicleModel: 'Silver Toyota Corolla (2019)',
      phone: '08060480745',
      lat: centerLat + 0.0035,
      lng: centerLng + 0.0042,
      tierId: 'swift_regular',
    },
    {
      id: 'drv-2',
      name: 'Ibrahim Aliyu',
      rating: 4.8,
      trips: 870,
      vehicleType: 'Sedan',
      vehicleMake: 'Toyota Camry (A/C)',
      plateNumber: 'BUK-391-AA',
      vehicleColor: 'Midnight Black',
      vehicleModel: 'Midnight Black Toyota Camry (2021)',
      phone: '08034567890',
      lat: centerLat - 0.0041,
      lng: centerLng + 0.0025,
      tierId: 'swift_regular',
    },
    {
      id: 'drv-3',
      name: 'Sani Abdullahi',
      rating: 4.9,
      trips: 2100,
      vehicleType: 'Tricycle / Keke',
      vehicleMake: 'Bajaj RE Keke',
      plateNumber: 'JOS-892-KT',
      vehicleColor: 'Yellow / Black',
      vehicleModel: 'Yellow Bajaj RE Tricycle',
      phone: '08055667788',
      lat: centerLat + 0.0015,
      lng: centerLng - 0.0018,
      tierId: 'swift_keke',
    },
    {
      id: 'drv-4',
      name: 'Emeka Okafor',
      rating: 4.8,
      trips: 640,
      vehicleType: 'Tricycle / Keke',
      vehicleMake: 'TVS King Deluxe',
      plateNumber: 'JOS-512-XY',
      vehicleColor: 'Green / Yellow',
      vehicleModel: 'Green TVS King Tricycle',
      phone: '08123456789',
      lat: centerLat - 0.0025,
      lng: centerLng - 0.0045,
      tierId: 'swift_keke',
    },
    {
      id: 'drv-5',
      name: 'Drex Longdiem',
      rating: 5.0,
      trips: 1530,
      vehicleType: 'Sedan',
      vehicleMake: 'Toyota Yaris',
      plateNumber: 'PLA-001-PR',
      vehicleColor: 'Pearl White',
      vehicleModel: 'Pearl White Toyota Yaris',
      phone: '08099887766',
      lat: centerLat + 0.0028,
      lng: centerLng - 0.0038,
      tierId: 'swift_regular',
    },
  ];

  return drivers;
}
