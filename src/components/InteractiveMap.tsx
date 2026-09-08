import React, { useEffect, useState, useMemo, ComponentType } from 'react';
import { Layers, MapPin, Navigation, ShieldCheck } from 'lucide-react';

interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
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
}: InteractiveMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [tileTheme, setTileTheme] = useState<'dark' | 'streets'>('dark');
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
      <div className={`relative ${className} bg-[#070b14] flex items-center justify-center`}>
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 50% 50%, #1e293b 0%, #020617 100%), linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
          <Navigation className="h-4 w-4 animate-spin text-orange-400" />
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-semibold text-emerald-400 shadow-xl">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live GPS Map
        </div>

        {showTileSwitcher && (
          <button
            type="button"
            onClick={() => setTileTheme((prev) => (prev === 'dark' ? 'streets' : 'dark'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white transition-all shadow-xl"
            title="Toggle Map Style"
          >
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline capitalize">{tileTheme} View</span>
          </button>
        )}
      </div>
    </div>
  );
}
