/**
 * Helpers for encoding, parsing, and managing SwiftMove orders
 * (supporting both Passenger Rides and Parcel Deliveries across customer and driver dashboards)
 */

export interface ParsedOrderMetadata {
  isRide: boolean;
  isDispatch: boolean;
  tierId?: string | undefined;
  tierName?: string | undefined;
  tier?: string | undefined;
  seats?: number | undefined;
  safetyPin?: string | undefined;
  pin?: string | undefined;
  customerPhone?: string | undefined;
  customerNotes?: string | undefined;
  driverPhone?: string | undefined;
  driverName?: string | undefined;
  vehicleMake?: string | undefined;
  plateNumber?: string | undefined;
  vehicleColor?: string | undefined;
  driverRating?: number | undefined;
  rawPackageType: string;
}

/**
 * Encodes ride parameters into the package_type carrier string.
 */
export function encodeRideMetadata(opts: {
  tierName: string;
  tierId: string;
  seats: number;
  safetyPin: string;
  customerPhone?: string | null;
  notes?: string | null;
}): string {
  let pkg = `Ride: ${opts.tierName}|||KIND:ride|||TIER:${opts.tierId}|||SEATS:${opts.seats}|||PIN:${opts.safetyPin}`;
  if (opts.customerPhone) pkg += `|||CPHONE:${opts.customerPhone}`;
  if (opts.notes) pkg += `|||NOTES:${opts.notes.trim()}`;
  return pkg;
}

/**
 * Encodes parcel dispatch parameters into the package_type carrier string.
 */
export function encodeDispatchMetadata(opts: {
  cargoType?: string | null;
  customerPhone?: string | null;
  description?: string | null;
}): string {
  let pkg = `${opts.cargoType || 'Parcel Delivery'}|||KIND:dispatch`;
  if (opts.customerPhone) pkg += `|||CPHONE:${opts.customerPhone}`;
  if (opts.description) pkg += `|||NOTES:${opts.description.trim()}`;
  return pkg;
}

/**
 * Appends driver acceptance details into the package_type carrier string.
 * Supports both function signatures:
 * 1. appendDriverAcceptance(basePackageType, { name, phone, plate, carModel, rating })
 * 2. appendDriverAcceptance({ basePackageType, driverName, driverPhone, ... })
 */
export function appendDriverAcceptance(
  baseOrOpts:
    | string
    | {
        basePackageType: string;
        driverPhone?: string | null;
        driverName?: string | null;
        vehicleMake?: string | null;
        plateNumber?: string | null;
        vehicleColor?: string | null;
        driverRating?: number | null;
      },
  details?: {
    name?: string | null;
    phone?: string | null;
    plate?: string | null;
    carModel?: string | null;
    color?: string | null;
    rating?: number | null;
  }
): string {
  if (typeof baseOrOpts === 'string') {
    let pkg = baseOrOpts || '';
    if (details?.phone) pkg += `|||DPHONE:${details.phone}`;
    if (details?.name) pkg += `|||DNAME:${details.name}`;
    if (details?.carModel) pkg += `|||DMAKE:${details.carModel}`;
    if (details?.plate) pkg += `|||DPLATE:${details.plate}`;
    if (details?.color) pkg += `|||DCOLOR:${details.color}`;
    if (details?.rating) pkg += `|||DRATING:${details.rating}`;
    return pkg;
  } else {
    let pkg = baseOrOpts.basePackageType || '';
    if (baseOrOpts.driverPhone) pkg += `|||DPHONE:${baseOrOpts.driverPhone}`;
    if (baseOrOpts.driverName) pkg += `|||DNAME:${baseOrOpts.driverName}`;
    if (baseOrOpts.vehicleMake) pkg += `|||DMAKE:${baseOrOpts.vehicleMake}`;
    if (baseOrOpts.plateNumber) pkg += `|||DPLATE:${baseOrOpts.plateNumber}`;
    if (baseOrOpts.vehicleColor) pkg += `|||DCOLOR:${baseOrOpts.vehicleColor}`;
    if (baseOrOpts.driverRating) pkg += `|||DRATING:${baseOrOpts.driverRating}`;
    return pkg;
  }
}

/**
 * Parses embedded order metadata from package_type.
 */
export function parseOrderMetadata(packageType?: string | null): ParsedOrderMetadata {
  const raw = packageType || '';
  const isRide = raw.toLowerCase().startsWith('ride') || raw.includes('|||KIND:ride');
  const isDispatch = !isRide || raw.includes('|||KIND:dispatch');

  const matchKey = (key: string): string | undefined => {
    const regex = new RegExp(`\\|\\|\\|${key}:([^|]+)`);
    const match = raw.match(regex);
    return match && match[1] ? match[1].trim() : undefined;
  };

  const cleanTitle = raw.split('|||')[0]!.trim();
  const tierName = cleanTitle.startsWith('Ride:') ? cleanTitle.replace(/^Ride:\s*/i, '') : cleanTitle;

  const seatsStr = matchKey('SEATS');
  const ratingStr = matchKey('DRATING');
  const tierVal = matchKey('TIER');
  const pinVal = matchKey('PIN');

  return {
    isRide,
    isDispatch,
    tierId: tierVal,
    tier: tierVal,
    tierName: tierName || (isRide ? 'Swift Go' : 'Parcel Delivery'),
    seats: seatsStr ? parseInt(seatsStr, 10) : (isRide ? 4 : undefined),
    safetyPin: pinVal,
    pin: pinVal,
    customerPhone: matchKey('CPHONE'),
    customerNotes: matchKey('NOTES'),
    driverPhone: matchKey('DPHONE'),
    driverName: matchKey('DNAME'),
    vehicleMake: matchKey('DMAKE'),
    plateNumber: matchKey('DPLATE'),
    vehicleColor: matchKey('DCOLOR'),
    driverRating: ratingStr ? parseFloat(ratingStr) : undefined,
    rawPackageType: raw,
  };
}
