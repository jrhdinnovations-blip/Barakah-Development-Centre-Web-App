import { geocodePlaceId as canonicalGeocodePlaceId } from './google-maps-client';

export interface LocationSuggestion {
  id: string;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  category: 'market' | 'university' | 'hospital' | 'airport' | 'landmark' | 'residential' | 'google';
  iconEmoji: string;
  /** Search synonyms / keyword aliases for instant matching */
  aliases?: string[];
  /** Google Places place_id — present only for Google-sourced suggestions */
  placeId?: string;
  /** True when lat/lng are verified coordinates; false for unresolved Google place predictions */
  hasResolvedCoords?: boolean;
}

export const JOS_LOCATIONS: LocationSuggestion[] = [
  {
    id: 'loc-terminus',
    label: 'Jos Main Market / Terminus',
    sublabel: 'Ahmadu Bello Way, Jos North, Plateau State',
    lat: 9.9248,
    lng: 8.8912,
    category: 'market',
    iconEmoji: '🛍️',
    aliases: ['terminus', 'main market', 'jos market', 'central market', 'ahmadu bello way', 'abw', 'city centre'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-unijos-main',
    label: 'UNIJOS Main Campus (Bauchi Road)',
    sublabel: 'Bauchi Road, Jos North, Plateau State',
    lat: 9.9542,
    lng: 8.8931,
    category: 'university',
    iconEmoji: '🎓',
    aliases: ['unijos', 'unijos main', 'bauchi road campus', 'university of jos', 'uj main', 'uj'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-unijos-naraguta',
    label: 'UNIJOS Naraguta Campus',
    sublabel: 'Naraguta, University of Jos, Plateau State',
    lat: 9.9723,
    lng: 8.8872,
    category: 'university',
    iconEmoji: '🏫',
    aliases: ['naraguta', 'unijos naraguta', 'village hostel', 'naraguta campus', 'uj naraguta'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-rayfield-gov',
    label: 'Rayfield Government House',
    sublabel: 'Rayfield, Jos South, Plateau State',
    lat: 9.8402,
    lng: 8.9135,
    category: 'landmark',
    iconEmoji: '🏛️',
    aliases: ['rayfield', 'government house', 'gov house', 'rayfield gov house', 'new gov house'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-rayfield-resort',
    label: 'Rayfield Resort & Golf Club',
    sublabel: 'Lohwol Road, Rayfield, Jos South',
    lat: 9.8412,
    lng: 8.9135,
    category: 'landmark',
    iconEmoji: '⛳',
    aliases: ['rayfield resort', 'resort', 'golf club', 'rayfield lake'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-airport',
    label: 'Yakubu Gowon Airport (Jos Airport)',
    sublabel: 'Heipang, Jos South, Plateau State',
    lat: 9.6397,
    lng: 8.8689,
    category: 'airport',
    iconEmoji: '✈️',
    aliases: ['airport', 'jos airport', 'heipang', 'yakubu gowon airport', 'heipang airport'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-juth',
    label: 'Jos University Teaching Hospital (JUTH)',
    sublabel: 'Lamingo, Jos North, Plateau State',
    lat: 9.9075,
    lng: 8.9485,
    category: 'hospital',
    iconEmoji: '🏥',
    aliases: ['juth', 'lamingo hospital', 'teaching hospital', 'juth permanent site'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-plateau-hospital',
    label: 'Plateau State Specialist Hospital',
    sublabel: 'Old Bukuru Road, Jos, Plateau State',
    lat: 9.9168,
    lng: 8.8892,
    category: 'hospital',
    iconEmoji: '🏥',
    aliases: ['plateau hospital', 'specialist hospital', 'plateau specialist', 'general hospital'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-bukuru-hub',
    label: 'Bukuru Central Commercial Hub',
    sublabel: 'Bukuru Expressway, Jos South, Plateau State',
    lat: 9.7944,
    lng: 8.8642,
    category: 'market',
    iconEmoji: '🏙️',
    aliases: ['bukuru', 'bukuru central', 'gyel', 'bukuru town', 'bukuru junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-bukuru-market',
    label: 'Bukuru Main Market',
    sublabel: 'Market Road, Bukuru, Jos South',
    lat: 9.7915,
    lng: 8.8612,
    category: 'market',
    iconEmoji: '🛍️',
    aliases: ['bukuru market', 'market bukuru'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-old-airport',
    label: 'Old Airport Junction',
    sublabel: 'Yakubu Gowon Way / Old Airport Rd, Jos South',
    lat: 9.8652,
    lng: 8.8821,
    category: 'landmark',
    iconEmoji: '🚦',
    aliases: ['old airport', 'old airport junction', 'old airport rd'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-secretariat',
    label: 'Plateau State Secretariat Complex',
    sublabel: 'Secretariat Roundabout, Jos North',
    lat: 9.9015,
    lng: 8.8814,
    category: 'landmark',
    iconEmoji: '🏢',
    aliases: ['secretariat', 'state secretariat', 'secretariat roundabout', 'jd gomwalk'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-british-america',
    label: 'British America Junction',
    sublabel: 'Murtala Mohammed Way, Jos',
    lat: 9.9189,
    lng: 8.9056,
    category: 'landmark',
    iconEmoji: '📍',
    aliases: ['british america', 'british america junction', 'ba junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-tudun-wada',
    label: 'Tudun Wada / Federal Low Cost',
    sublabel: 'Ring Road, Tudun Wada, Jos North',
    lat: 9.9211,
    lng: 8.8654,
    category: 'residential',
    iconEmoji: '🏘️',
    aliases: ['tudun wada', 'tudunwada', 'federal low cost', 'low cost tudun wada'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-anglo-jos',
    label: 'Anglo Jos Industrial Area',
    sublabel: 'Yakubu Gowon Way, Anglo Jos, Plateau State',
    lat: 9.8492,
    lng: 8.8789,
    category: 'landmark',
    iconEmoji: '🏭',
    aliases: ['anglo jos', 'anglo-jos', 'anglo'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-dadin-kowa',
    label: 'Dadin Kowa Community',
    sublabel: 'Dadin Kowa, Jos South, Plateau State',
    lat: 9.8321,
    lng: 8.8723,
    category: 'residential',
    iconEmoji: '🏡',
    aliases: ['dadin kowa', 'dadinkowa', 'dadin-kowa'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-west-of-mines',
    label: 'West of Mines Commercial District',
    sublabel: 'West of Mines, Jos City Centre',
    lat: 9.9267,
    lng: 8.8856,
    category: 'landmark',
    iconEmoji: '🏦',
    aliases: ['west of mines', 'wom'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-farin-gada',
    label: 'Farin Gada Market',
    sublabel: 'Zaria Road, Farin Gada, Jos North',
    lat: 9.9512,
    lng: 8.8794,
    category: 'market',
    iconEmoji: '🥬',
    aliases: ['farin gada', 'faringada', 'farin-gada', 'zaria road market'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-katako',
    label: 'Katako Market & Transport Park',
    sublabel: 'Rikkos / Katako, Jos North',
    lat: 9.9389,
    lng: 8.8778,
    category: 'market',
    iconEmoji: '🪵',
    aliases: ['katako', 'katako market', 'rikkos'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-gada-biyu',
    label: 'Gada Biyu (Two Bridges)',
    sublabel: 'Zaria Road, Jos North, Plateau State',
    lat: 9.9405,
    lng: 8.8621,
    category: 'landmark',
    iconEmoji: '🌉',
    aliases: ['gada biyu', 'gadabiyu', 'two bridges'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-rantya',
    label: 'Rantya State Low Cost',
    sublabel: 'Rantya, Jos South, Plateau State',
    lat: 9.8789,
    lng: 8.8412,
    category: 'residential',
    iconEmoji: '🏘️',
    aliases: ['rantya', 'state low cost', 'rantya low cost'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-museum',
    label: 'National Museum & Zoo Jos',
    sublabel: 'Museum Ground, Jos North, Plateau State',
    lat: 9.9192,
    lng: 8.8941,
    category: 'landmark',
    iconEmoji: '🦁',
    aliases: ['museum', 'jos museum', 'zoo', 'jos zoo'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-hill-station',
    label: 'Hill Station Hotel / Tudun Wada Rd',
    sublabel: 'Tudun Wada Road, Jos North',
    lat: 9.9234,
    lng: 8.8802,
    category: 'landmark',
    iconEmoji: '🏨',
    aliases: ['hill station', 'hill station hotel'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-millionaires',
    label: 'Millionaires Quarters, Rayfield',
    sublabel: 'Rayfield, Jos South, Plateau State',
    lat: 9.8452,
    lng: 8.9089,
    category: 'residential',
    iconEmoji: '✨',
    aliases: ['millionaires quarters', 'millionaires rayfield'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-lamingo-dam',
    label: 'Lamingo Dam Resort Area',
    sublabel: 'Lamingo, Jos East / North border',
    lat: 9.9123,
    lng: 8.9612,
    category: 'landmark',
    iconEmoji: '🌊',
    aliases: ['lamingo', 'lamingo dam'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-nvri-vom',
    label: 'NVRI Vom (National Veterinary Research Inst.)',
    sublabel: 'Vom, Jos South, Plateau State',
    lat: 9.7289,
    lng: 8.7954,
    category: 'landmark',
    iconEmoji: '🔬',
    aliases: ['vom', 'nvri', 'nvri vom', 'national veterinary'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-kufang',
    label: 'Kufang / Miango Junction',
    sublabel: 'Miango Road, Kufang, Jos South',
    lat: 9.8872,
    lng: 8.8542,
    category: 'residential',
    iconEmoji: '📍',
    aliases: ['kufang', 'miango road', 'miango junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-hwolshe',
    label: 'Hwolshe Residential Area',
    sublabel: 'Yakubu Gowon Way, Hwolshe, Jos South',
    lat: 9.8512,
    lng: 8.8891,
    category: 'residential',
    iconEmoji: '🏘️',
    aliases: ['hwolshe', 'hwolshe junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-bauchi-motor-park',
    label: 'Bauchi Road Motor Park',
    sublabel: 'Bauchi Road, Jos North, Plateau State',
    lat: 9.9465,
    lng: 8.9012,
    category: 'landmark',
    iconEmoji: '🚌',
    aliases: ['bauchi park', 'bauchi motor park', 'bauchi road park'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-abw',
    label: 'Ahmadu Bello Way (Commercial Hub)',
    sublabel: 'City Centre, Jos North, Plateau State',
    lat: 9.9275,
    lng: 8.8895,
    category: 'landmark',
    iconEmoji: '🏢',
    aliases: ['ahmadu bello way', 'abw', 'bello way'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-mm-way',
    label: 'Murtala Mohammed Way',
    sublabel: 'Murtala Mohammed Way, Jos North',
    lat: 9.9231,
    lng: 8.8994,
    category: 'landmark',
    iconEmoji: '🛣️',
    aliases: ['murtala mohammed way', 'mm way', 'murtala way'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-zarmaganda',
    label: 'Zarmaganda Junction',
    sublabel: 'Rayfield Road / Zarmaganda, Jos South',
    lat: 9.8692,
    lng: 8.8942,
    category: 'landmark',
    iconEmoji: '🚦',
    aliases: ['zarmaganda', 'zarmaganda junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-tina-junction',
    label: 'Tina Junction / Angwan Rukuba',
    sublabel: 'Angwan Rukuba Road, Jos North',
    lat: 9.9412,
    lng: 8.9152,
    category: 'residential',
    iconEmoji: '📍',
    aliases: ['tina junction', 'angwan rukuba', 'rukuba junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-nasarawa-gwong',
    label: 'Nasarawa Gwong',
    sublabel: 'Nasarawa Gwong, Jos North, Plateau State',
    lat: 9.9362,
    lng: 8.9105,
    category: 'residential',
    iconEmoji: '🏘️',
    aliases: ['nasarawa gwong', 'nasarawa'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-polo-field',
    label: 'Jos Polo Ground & Roundabout',
    sublabel: 'Polo Field, Jos North, Plateau State',
    lat: 9.9056,
    lng: 8.8741,
    category: 'landmark',
    iconEmoji: '🏇',
    aliases: ['polo field', 'polo ground', 'polo roundabout'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-house-of-assembly',
    label: 'Plateau State House of Assembly',
    sublabel: 'Old Bukuru Road, Jos, Plateau State',
    lat: 9.9082,
    lng: 8.8834,
    category: 'landmark',
    iconEmoji: '🏛️',
    aliases: ['house of assembly', 'plateau assembly', 'assembly'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-rukuba-barracks',
    label: 'Rukuba Barracks (3 Armoured Division)',
    sublabel: 'Rukuba Road, Bassa / Jos North',
    lat: 9.9654,
    lng: 8.8231,
    category: 'landmark',
    iconEmoji: '🛡️',
    aliases: ['rukuba barracks', '3 division', 'maxwell khobe barracks'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-maraban-rido',
    label: 'Maraban Jam’a / Keffi Road Junction',
    sublabel: 'Keffi-Jos Expressway, Jos South',
    lat: 9.7612,
    lng: 8.8415,
    category: 'landmark',
    iconEmoji: '🛣️',
    aliases: ['maraban jama', 'maraba jama', 'keffi road junction'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-ecwa-hq',
    label: 'ECWA Headquarters & Challenge Compound',
    sublabel: 'Muritala Mohammed Way, Jos',
    lat: 9.9142,
    lng: 8.8965,
    category: 'landmark',
    iconEmoji: '⛪',
    aliases: ['ecwa hq', 'challenge compound', 'ecwa challenge'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-central-mosque',
    label: 'Jos Central Mosque',
    sublabel: 'Masallacin Juma\'a Street, Jos North',
    lat: 9.9288,
    lng: 8.8864,
    category: 'landmark',
    iconEmoji: '🕌',
    aliases: ['central mosque', 'jos central mosque', 'masallacin jumaa'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-barkin-ladi',
    label: 'Barkin Ladi (Barikin Ladi)',
    sublabel: 'Barkin Ladi LGA, Plateau State',
    lat: 9.5350,
    lng: 8.8960,
    category: 'landmark',
    iconEmoji: '🌾',
    aliases: ['barkin ladi', 'barikin ladi', 'ladi'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-mangu',
    label: 'Mangu Town',
    sublabel: 'Mangu LGA, Plateau State',
    lat: 9.5210,
    lng: 9.1020,
    category: 'landmark',
    iconEmoji: '🌾',
    aliases: ['mangu', 'mangu town'],
    hasResolvedCoords: true,
  },
  {
    id: 'loc-pankshin',
    label: 'Pankshin Town',
    sublabel: 'Pankshin LGA, Plateau State',
    lat: 9.3333,
    lng: 9.4500,
    category: 'landmark',
    iconEmoji: '⛰️',
    aliases: ['pankshin', 'pankshin town', 'fce pankshin'],
    hasResolvedCoords: true,
  },
];

/**
 * Intelligent instant resolver that maps user query string to verified Jos location
 */
export function resolveJosLocation(query: string): LocationSuggestion | null {
  if (!query) return null;
  const raw = query.trim().toLowerCase();
  const clean = raw.replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return null;

  // 1. Exact match against label or any alias
  for (const loc of JOS_LOCATIONS) {
    if (loc.label.toLowerCase() === raw) return loc;
    if (loc.aliases?.some((a) => a.toLowerCase() === raw)) return loc;
  }

  // 2. Contains match on alias
  for (const loc of JOS_LOCATIONS) {
    if (loc.aliases?.some((a) => raw.includes(a.toLowerCase()) || a.toLowerCase().includes(raw))) {
      return loc;
    }
  }

  // 3. Token-based scoring
  let bestMatch: LocationSuggestion | null = null;
  let bestScore = 0;

  for (const loc of JOS_LOCATIONS) {
    let score = 0;
    const labelLower = loc.label.toLowerCase();
    const subLower = loc.sublabel.toLowerCase();
    const aliases = loc.aliases?.map((a) => a.toLowerCase()) || [];

    for (const token of tokens) {
      if (aliases.some((a) => a === token)) score += 6;
      else if (aliases.some((a) => a.includes(token))) score += 4;
      if (labelLower.includes(token)) score += 3;
      if (subLower.includes(token)) score += 1;
    }

    if (score > bestScore && score >= 3) {
      bestScore = score;
      bestMatch = loc;
    }
  }

  return bestMatch;
}

/**
 * Instant client-side fuzzy search across Jos/Plateau landmarks
 */
export function searchLocalLocations(query: string): LocationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return JOS_LOCATIONS.slice(0, 8);

  const tokens = q.split(/\s+/).filter(Boolean);

  return JOS_LOCATIONS.filter((loc) => {
    const haystack = `${loc.label} ${loc.sublabel} ${loc.category} ${(loc.aliases || []).join(' ')}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }).slice(0, 8);
}

/**
 * Searches real-time suggestions: blends instant local dataset with server-side geocoding
 */
export async function fetchRealtimeLocationSuggestions(
  query: string,
  mapsLoaded: boolean = false
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return JOS_LOCATIONS.slice(0, 8);

  // 1. Get instant local matches
  const localMatches = searchLocalLocations(trimmed);

  // 2. If we need more matches and query has substance, query server-side geocoder
  if (localMatches.length < 5 && trimmed.length >= 3) {
    try {
      const { searchAddressServerFn } = await import('@/lib/maps.functions');
      const serverResults = await searchAddressServerFn({
        data: { query: trimmed },
      });

      if (Array.isArray(serverResults) && serverResults.length > 0) {
        const geoMatches: LocationSuggestion[] = serverResults.map((r, idx) => ({
          id: `osm-place-${idx}-${Date.now()}`,
          label: r.label.split(',')[0] || r.label,
          sublabel: r.label.split(',').slice(1, 4).join(',').trim() || 'Plateau State, Nigeria',
          lat: r.lat,
          lng: r.lng,
          category: 'landmark' as const,
          iconEmoji: '📍',
          hasResolvedCoords: true,
        }));

        const existingLabels = new Set(localMatches.map((m) => m.label.toLowerCase()));
        const unique = geoMatches.filter((gm) => !existingLabels.has(gm.label.toLowerCase()));
        return [...localMatches, ...unique].slice(0, 8);
      }
    } catch {
      // Fallback silently to local matches
    }
  }

  return localMatches;
}

/**
 * Get device GPS Live Location with high accuracy
 */
export function getBrowserGpsLocation(): Promise<{
  lat: number;
  lng: number;
  address: string;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = 'Current Location (GPS)';

        // Attempt reverse geocoding if Google Maps is loaded
        if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
          try {
            const geocoder = new (window as any).google.maps.Geocoder();
            const res: any = await new Promise((resGeo) => {
              geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
                if (status === 'OK' && results?.[0]?.formatted_address) {
                  resGeo(results[0].formatted_address);
                } else {
                  resGeo(null);
                }
              });
            });
            if (res) address = res;
          } catch {
            // Keep default
          }
        }

        resolve({ lat, lng, address });
      },
      (err) => {
        let msg = 'Unable to retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location access was denied. Please allow location permissions in your browser.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Resolves a Google Places place_id to real lat/lng coordinates.
 * Delegated to canonical google-maps-client utility.
 */
export async function geocodePlaceId(
  placeId: string,
  fallbackLat: number = 9.8965,
  fallbackLng: number = 8.8583
): Promise<{ lat: number; lng: number; address: string }> {
  if (!placeId) {
    return { lat: fallbackLat, lng: fallbackLng, address: '' };
  }
  const res = await canonicalGeocodePlaceId(placeId, fallbackLat, fallbackLng);
  if (res && res.lat && res.lng) {
    return { lat: res.lat, lng: res.lng, address: res.address };
  }
  return { lat: fallbackLat, lng: fallbackLng, address: '' };
}
