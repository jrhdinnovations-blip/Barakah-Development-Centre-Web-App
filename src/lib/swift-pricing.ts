/** ================================================================
 *  SwiftMove Delivery Pricing Engine
 *  ================================================================
 *  Formula:  BASE_FARE + (distanceKm × RATE_PER_KM) + (weightKg × RATE_PER_KG)
 *
 *  The additive model keeps distance and weight as independent cost
 *  factors. Light parcels going far stay reasonable, and heavy parcels
 *  going short distances aren't excessively penalised.
 *  ================================================================ */

/** Fixed base fare applied to every dispatch regardless of distance or weight */
export const BASE_FARE = 800;

/** Cost per kilometre of road distance */
export const RATE_PER_KM = 150;

/** Cost per kilogram of parcel weight */
export const RATE_PER_KG = 100;

/** Absolute minimum fare — no dispatch can cost less than this */
export const MIN_FARE = 1_500;

/**
 * Calculates delivery fare based on distance (km) and parcel weight (kg).
 *
 * @param distanceKm  - Road distance in kilometres (from Google Directions API)
 * @param weightKg    - Parcel weight in kilograms (entered by customer)
 * @returns The calculated fare in Naira (₦), minimum MIN_FARE
 */
export function calculateDeliveryPrice(distanceKm: number, weightKg: number): number {
  const safeDistance = Math.max(1, Number(distanceKm) || 1);
  const safeWeight = Math.max(0.5, Number(weightKg) || 0.5);

  const distanceCost = safeDistance * RATE_PER_KM;
  const weightCost = safeWeight * RATE_PER_KG;
  const total = BASE_FARE + distanceCost + weightCost;

  return Math.max(MIN_FARE, Math.round(total));
}

/**
 * Returns a human-readable pricing breakdown for display in the UI.
 */
export function getPricingBreakdown(distanceKm: number, weightKg: number) {
  const safeDistance = Math.max(1, Number(distanceKm) || 1);
  const safeWeight = Math.max(0.5, Number(weightKg) || 0.5);

  const distanceCost = Math.round(safeDistance * RATE_PER_KM);
  const weightCost = Math.round(safeWeight * RATE_PER_KG);
  const subtotal = BASE_FARE + distanceCost + weightCost;
  const total = Math.max(MIN_FARE, subtotal);

  return {
    baseFare: BASE_FARE,
    distanceKm: safeDistance,
    ratePerKm: RATE_PER_KM,
    distanceCost,
    weightKg: safeWeight,
    ratePerKg: RATE_PER_KG,
    weightCost,
    subtotal,
    minFare: MIN_FARE,
    total,
  };
}