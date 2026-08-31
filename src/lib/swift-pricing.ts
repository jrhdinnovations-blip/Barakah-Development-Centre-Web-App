/** Base fare charged on every dispatch regardless of distance or weight */
export const BASE_FARE = 500;

/** Rate applied per kg per km — the core of the pricing model */
export const RATE_PER_KG_PER_KM = 50;

/** Minimum fare floor — no dispatch can cost less than this */
export const MIN_FARE = 1_500;

/**
 * Calculates straight-line distance (in KM) between two geographic coordinates using Haversine formula
 */
export function calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Return formatted to 1 decimal place, minimum 1 km
    return Math.max(1, Math.round(distance * 10) / 10);
}

/**
 * Calculates delivery fare based on weight × distance.
 *
 * Formula:  BASE_FARE + (weightKg × distanceKm × RATE_PER_KG_PER_KM)
 *
 * The multiplicative model means heavier parcels over longer distances
 * cost proportionally more, while light nearby deliveries stay affordable.
 */
export function calculateDeliveryPrice(distanceKm: number, weightKg: number): number {
    const safeDistance = Math.max(1, distanceKm);
    const safeWeight = Math.max(0.5, weightKg);
    const fare = BASE_FARE + safeWeight * safeDistance * RATE_PER_KG_PER_KM;
    return Math.max(MIN_FARE, Math.round(fare));
}