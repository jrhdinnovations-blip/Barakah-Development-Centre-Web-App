import React, { useEffect, useState, useMemo, ComponentType } from 'react';
import { Layers, MapPin, Navigation, ShieldCheck } from 'lucide-react';

interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapDriverPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  vehicleType?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  plateNumber?: string;
  phone?: string;
  isMatched?: boolean;
}

interface InteractiveMapProps {
  pickup?: LocationPoint | null;
  dropoff?: LocationPoint | null;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  showTileSwitcher?: boolean;
  routePolyline?: [number, number][];
  defaultTheme?: 'dark' | 'streets';
  drivers?: MapDriverPoint[];
  matchedDriver?: MapDriverPoint | null;
}

const DEFAULT_CENTER = { lat: 9.8965, lng: 8.8583 }; // Jos, Plateau State

export function InteractiveMap({
  pickup,
  dropoff,
  center,
  zoom = 13,
  className = 'w-full h-full',
  showTileSwitcher = true,
  routePolyline,
  defaultTheme = 'streets',
  drivers,
  matchedDriver,
}: InteractiveMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [tileTheme, setTileTheme] = useState<'dark' | 'streets'>(defaultTheme);
  const [LeafletKit, setLeafletKit] = useState<{
    MapContainer: ComponentType<any>;
    TileLayer: ComponentType<any>;
    Marker: ComponentType<any>;
    Popup: ComponentType<any>;
    Polyline: ComponentType<any>;
    useMap: () => any;
    L: any;
  } | null>(null);

  useEffect(() => {
    setIsClient(true);

    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
      import('leaflet/dist/images/marker-icon-2x.png'),
      import('leaflet/dist/images/marker-icon.png'),
      import('leaflet/dist/images/marker-shadow.png'),
    ]).then(([reactLeaflet, leafletModule, icon2x, icon, shadow]) => {
      const L = leafletModule.default || leafletModule;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: icon.default,
        iconRetinaUrl: icon2x.default,
        shadowUrl: shadow.default,
      });

      setLeafletKit({
        MapContainer: reactLeaflet.MapContainer,
        TileLayer: reactLeaflet.TileLayer,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        Polyline: reactLeaflet.Polyline,
        useMap: reactLeaflet.useMap,
        L,
      });
    });
  }, []);

  const activeCenter: [number, number] = useMemo(() => {
    if (pickup) return [pickup.lat, pickup.lng];
    if (center) return [center.lat, center.lng];
    return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  }, [pickup?.lat, pickup?.lng, center?.lat, center?.lng]);

  // routePoints must be computed BEFORE any early return to satisfy Rules of Hooks
  const routePoints: [number, number][] = useMemo(() => {
    if (routePolyline && routePolyline.length > 0) return routePolyline;
    if (pickup && dropoff) {
      return [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
    }
    return [];
  }, [routePolyline, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // Loading / SSR fallback
  if (!isClient || !LeafletKit) {
    return (
      <div className={`relative ${className} bg-slate-100 flex items-center justify-center`}>
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 50% 50%, #f1f5f9 0%, #e2e8f0 100%), linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 border border-slate-200 text-xs text-slate-600 shadow-sm">
          <Navigation className="h-4 w-4 animate-spin text-orange-500" />
          <span>Loading live interactive map…</span>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, L } = LeafletKit;

  // Custom styled SVG pins
  const pickupIcon = new L.DivIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #10b981;
        border: 3px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 13px;
        box-shadow: 0 4px 14px rgba(16,185,129,0.7), 0 0 0 4px rgba(16,185,129,0.25);
      ">P</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const dropoffIcon = new L.DivIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #f97316;
        border: 3px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 13px;
        box-shadow: 0 4px 14px rgba(249,115,22,0.7), 0 0 0 4px rgba(249,115,22,0.25);
      ">D</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // Custom vehicle icons for nearby & matched drivers
  const createDriverIcon = (d: MapDriverPoint) => {
    return new L.DivIcon({
      className: 'custom-leaflet-driver',
      html: `
        <div style="
          position: relative;
          width: 38px;
          height: 38px;
          background: #0f172a;
          border: 2.5px solid #38bdf8;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.6), 0 0 0 3px rgba(56, 189, 248, 0.25);
          cursor: pointer;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 11px;
            height: 11px;
            background: #10b981;
            border: 2px solid #ffffff;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  };

  const createMatchedDriverIcon = (d: MapDriverPoint) => {
    return new L.DivIcon({
      className: 'custom-leaflet-matched-driver',
      html: `
        <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(37, 99, 235, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="
            position: relative;
            width: 42px;
            height: 42px;
            background: #2563eb;
            border: 3px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.8);
            cursor: pointer;
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  };

  // Map controller to center and fit bounds dynamically
  function MapController() {
    const map = useMap();

    useEffect(() => {
      if (routePoints.length > 1) {
        const bounds = L.latLngBounds(routePoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      } else if (pickup && dropoff) {
        const bounds = L.latLngBounds([
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      } else if (pickup) {
        map.setView([pickup.lat, pickup.lng], 14, { animate: true });
      } else if (center) {
        map.setView([center.lat, center.lng], zoom, { animate: true });
      }
    }, [routePoints, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, center?.lat, center?.lng]);

    return null;
  }


  const tileUrl =
    tileTheme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution =
    tileTheme === 'dark'
      ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div className={`relative ${className} overflow-hidden`}>
      <MapContainer
        center={activeCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} attribution={tileAttribution} maxZoom={19} />

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-slate-900 font-sans p-1">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  Pickup Location
                </p>
                <p className="text-xs font-medium mt-0.5">{pickup.address || 'Pickup Point'}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  GPS: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-slate-900 font-sans p-1">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                  Dropoff Location
                </p>
                <p className="text-xs font-medium mt-0.5">{dropoff.address || 'Destination'}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  GPS: {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Available Nearby Drivers */}
        {!matchedDriver &&
          drivers &&
          drivers.map((drv) => (
            <Marker key={drv.id} position={[drv.lat, drv.lng]} icon={createDriverIcon(drv)}>
              <Popup>
                <div className="text-slate-900 font-sans p-1 min-w-[140px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900">{drv.name}</p>
                    <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      ★ {drv.rating || 4.9}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-1">
                    {drv.vehicleModel || drv.vehicleType || 'Verified Fleet Vehicle'}
                  </p>
                  {drv.plateNumber && (
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{drv.plateNumber}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Available nearby
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Matched Driver */}
        {matchedDriver && (
          <Marker position={[matchedDriver.lat, matchedDriver.lng]} icon={createMatchedDriverIcon(matchedDriver)}>
            <Popup>
              <div className="text-slate-900 font-sans p-1 min-w-[160px]">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                  Your Matched Driver
                </p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{matchedDriver.name}</p>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  {matchedDriver.vehicleModel || matchedDriver.vehicleType || 'Fleet Vehicle'}
                </p>
                {matchedDriver.plateNumber && (
                  <p className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">{matchedDriver.plateNumber}</p>
                )}
                {matchedDriver.phone && (
                  <p className="text-xs text-blue-600 font-bold mt-1.5">📞 {matchedDriver.phone}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {routePoints.length >= 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#3b82f6',
              weight: routePoints.length > 2 ? 6 : 4,
              opacity: 0.9,
              dashArray: routePoints.length > 2 ? undefined : '8, 10',
            }}
          />
        )}

        <MapController />
      </MapContainer>

      {/* Top-Right Badge: Zero Watermark & Live GPS Indicator */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 text-[11px] font-bold text-emerald-700 shadow-md">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {matchedDriver
            ? 'Driver En Route'
            : drivers && drivers.length > 0
            ? `${drivers.length} Drivers Online`
            : 'Live GPS Map'}
        </div>

        {showTileSwitcher && (
          <button
            type="button"
            onClick={() => setTileTheme((prev) => (prev === 'dark' ? 'streets' : 'dark'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white backdrop-blur-md border border-slate-200 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-md"
            title="Toggle Map Style"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden sm:inline capitalize">{tileTheme} View</span>
          </button>
        )}
      </div>
    </div>
  );
}
