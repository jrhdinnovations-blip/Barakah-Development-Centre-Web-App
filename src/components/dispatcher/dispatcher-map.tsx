import React, { useEffect, useState, useMemo, ComponentType } from 'react';
import { Navigation, Bike, Car, Truck, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface DriverMarkerData {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleMake?: string;
  plateNumber?: string;
  status: 'available' | 'on_trip' | 'busy' | 'offline';
  lat: number;
  lng: number;
  rating?: number;
}

export interface BookingMarkerData {
  id: string;
  reference: string;
  customerName?: string;
  customerPhone?: string;
  pickupAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffAddress: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  status: string;
  isRide?: boolean;
  fare: number;
}

export interface OperationsHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  activeOrdersCount: number;
}

interface DispatcherMapProps {
  drivers: DriverMarkerData[];
  bookings: BookingMarkerData[];
  selectedBooking?: BookingMarkerData | null;
  hubs?: OperationsHub[];
  className?: string;
  onSelectDriver?: (driver: DriverMarkerData) => void;
  onSelectBooking?: (booking: BookingMarkerData) => void;
  onQuickAssign?: (bookingId: string) => void;
}

const DEFAULT_CENTER = { lat: 9.8965, lng: 8.8583 }; // Jos Central

export const DEFAULT_HUBS: OperationsHub[] = [
  { id: 'hub-1', name: 'Jos North & Terminus Market', lat: 9.9280, lng: 8.8920, radiusKm: 3.5, activeOrdersCount: 4 },
  { id: 'hub-2', name: 'Jos South & Rayfield Zone', lat: 9.8450, lng: 8.9150, radiusKm: 4.0, activeOrdersCount: 6 },
  { id: 'hub-3', name: 'Bukuru Commercial Center', lat: 9.7950, lng: 8.8650, radiusKm: 3.0, activeOrdersCount: 2 },
  { id: 'hub-4', name: 'UniJos & Bauchi Road Hub', lat: 9.9550, lng: 8.8890, radiusKm: 2.5, activeOrdersCount: 3 },
];

export function DispatcherMap({
  drivers,
  bookings,
  selectedBooking,
  hubs = DEFAULT_HUBS,
  className = 'w-full h-full min-h-[500px]',
  onSelectDriver,
  onSelectBooking,
  onQuickAssign,
}: DispatcherMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'all' | 'drivers' | 'bookings' | 'hubs'>('all');
  const [LeafletKit, setLeafletKit] = useState<{
    MapContainer: ComponentType<any>;
    TileLayer: ComponentType<any>;
    Marker: ComponentType<any>;
    Popup: ComponentType<any>;
    Polyline: ComponentType<any>;
    Circle: ComponentType<any>;
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
        Circle: reactLeaflet.Circle,
        useMap: reactLeaflet.useMap,
        L,
      });
    });
  }, []);

  const centerCoordinates: [number, number] = useMemo(() => {
    if (selectedBooking && selectedBooking.pickupLat && selectedBooking.pickupLng) {
      return [selectedBooking.pickupLat, selectedBooking.pickupLng];
    }
    const firstActiveDriver = drivers.find(d => d.lat && d.lng);
    if (firstActiveDriver) {
      return [firstActiveDriver.lat, firstActiveDriver.lng];
    }
    return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  }, [selectedBooking, drivers]);

  // If a booking is selected and has both coords, build route polyline
  const routePoints: [number, number][] = useMemo(() => {
    if (
      selectedBooking &&
      selectedBooking.pickupLat &&
      selectedBooking.pickupLng &&
      selectedBooking.dropoffLat &&
      selectedBooking.dropoffLng
    ) {
      return [
        [selectedBooking.pickupLat, selectedBooking.pickupLng],
        [selectedBooking.dropoffLat, selectedBooking.dropoffLng],
      ];
    }
    return [];
  }, [selectedBooking]);

  if (!isClient || !LeafletKit) {
    return (
      <div className={`relative ${className} bg-[#060912] rounded-2xl border border-slate-800/80 flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <Navigation className="h-6 w-6 text-orange-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Initializing Realtime Operations Map Engine…</p>
          <span className="text-[10px] text-slate-600">Jos / Plateau Grid • CartoDB Dark Matter</span>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, L } = LeafletKit;

  // Custom Div Icons generator for drivers
  const getDriverIcon = (driver: DriverMarkerData) => {
    const isAvailable = driver.status === 'available';
    const isOnTrip = driver.status === 'on_trip' || driver.status === 'busy';
    const bg = isAvailable ? '#10b981' : isOnTrip ? '#3b82f6' : '#64748b';
    const pulse = isAvailable ? 'animate-pulse' : '';
    const iconLabel = (driver.vehicleType || '').toLowerCase().includes('motorcycle') || (driver.vehicleType || '').toLowerCase().includes('bike')
      ? '🛵'
      : (driver.vehicleType || '').toLowerCase().includes('truck') || (driver.vehicleType || '').toLowerCase().includes('van')
      ? '🚚'
      : '🚗';

    return new L.DivIcon({
      className: 'custom-dispatcher-driver-pin',
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${bg};
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6), 0 0 0 4px ${bg}44;
          font-size: 16px;
          cursor: pointer;
        " class="${pulse}">
          <span>${iconLabel}</span>
          <span style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${isAvailable ? '#22c55e' : isOnTrip ? '#38bdf8' : '#94a3b8'};
            border: 1.5px solid #0f172a;
          "></span>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  };

  // Pickup marker icon
  const pickupIcon = new L.DivIcon({
    className: 'custom-booking-pickup-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #10b981;
        border: 2.5px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 900;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(16,185,129,0.7);
      ">
        P
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // Dropoff marker icon
  const dropoffIcon = new L.DivIcon({
    className: 'custom-booking-dropoff-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f97316;
        border: 2.5px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 900;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(249,115,22,0.7);
      ">
        D
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <div className={`relative ${className} rounded-2xl overflow-hidden border border-slate-800 bg-[#060912] shadow-2xl`}>
      {/* Top Map Layer Switcher & Stats Overlay */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-1.5 bg-[#0a0f1c]/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800/90 shadow-xl">
        <button
          type="button"
          onClick={() => setActiveLayer('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            activeLayer === 'all'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          All Layers ({drivers.length + bookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer('drivers')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
            activeLayer === 'drivers'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Car className="h-3 w-3" /> Drivers ({drivers.filter(d => d.lat && d.lng).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer('bookings')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
            activeLayer === 'bookings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="h-3 w-3" /> Bookings ({bookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer('hubs')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            activeLayer === 'hubs'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Hubs ({hubs.length})
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 bg-[#0a0f1c]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/90 text-[11px] text-slate-300 font-mono shadow-lg">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> On Trip
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500 inline-block" /> Offline
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" /> Demand Zone
        </span>
      </div>

      <MapContainer
        center={centerCoordinates}
        zoom={12}
        style={{ width: '100%', height: '100%', minHeight: '500px' }}
        zoomControl={false}
      >
        {/* CartoDB Dark Matter Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* 1. Hubs / Operational Zones */}
        {(activeLayer === 'all' || activeLayer === 'hubs') &&
          hubs.map(hub => (
            <Circle
              key={hub.id}
              center={[hub.lat, hub.lng]}
              radius={hub.radiusKm * 1000}
              pathOptions={{
                color: '#a855f7',
                fillColor: '#a855f7',
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: '4, 6',
              }}
            >
              <Popup>
                <div className="p-2 text-slate-900">
                  <p className="font-bold text-sm text-purple-900">{hub.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">Coverage Radius: {hub.radiusKm} km</p>
                  <p className="text-xs text-purple-700 font-semibold mt-1">
                    {hub.activeOrdersCount} active orders in sector
                  </p>
                </div>
              </Popup>
            </Circle>
          ))}

        {/* 2. Route Polyline for Selected Booking */}
        {routePoints.length === 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#f97316',
              weight: 4,
              opacity: 0.85,
              dashArray: '6, 8',
            }}
          />
        )}

        {/* 3. Driver Markers */}
        {(activeLayer === 'all' || activeLayer === 'drivers') &&
          drivers
            .filter(d => d.lat && d.lng)
            .map(driver => (
              <Marker
                key={driver.id}
                position={[driver.lat, driver.lng]}
                icon={getDriverIcon(driver)}
                eventHandlers={{
                  click: () => onSelectDriver?.(driver),
                }}
              >
                <Popup>
                  <div className="p-2 text-slate-900 min-w-[200px]">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                      <p className="font-bold text-sm text-slate-900">{driver.name}</p>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          driver.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : driver.status === 'on_trip'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {driver.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      🚗 {driver.vehicleType} {driver.vehicleMake ? `• ${driver.vehicleMake}` : ''}
                    </p>
                    {driver.plateNumber && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        Plate: {driver.plateNumber}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">📱 {driver.phone}</p>
                    <div className="mt-3 flex gap-1.5">
                      <a
                        href={`tel:${driver.phone}`}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold py-1 rounded text-center flex items-center justify-center gap-1"
                      >
                        <Phone className="h-3 w-3" /> Call
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

        {/* 4. Active Booking Markers */}
        {(activeLayer === 'all' || activeLayer === 'bookings') &&
          bookings.map(booking => {
            const hasPickup = booking.pickupLat && booking.pickupLng;
            const hasDropoff = booking.dropoffLat && booking.dropoffLng;

            return (
              <React.Fragment key={booking.id}>
                {hasPickup && (
                  <Marker
                    position={[booking.pickupLat!, booking.pickupLng!]}
                    icon={pickupIcon}
                    eventHandlers={{ click: () => onSelectBooking?.(booking) }}
                  >
                    <Popup>
                      <div className="p-2 text-slate-900 min-w-[210px]">
                        <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                          <span className="font-mono text-xs font-bold text-orange-600">
                            {booking.reference}
                          </span>
                          <span className="text-[10px] uppercase font-bold bg-slate-100 px-1 py-0.5 rounded">
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-emerald-800">↑ Pickup:</p>
                        <p className="text-xs text-slate-700 truncate">{booking.pickupAddress}</p>
                        <p className="text-xs font-semibold text-orange-800 mt-1">↓ Dropoff:</p>
                        <p className="text-xs text-slate-700 truncate">{booking.dropoffAddress}</p>
                        <p className="text-xs font-bold text-slate-900 mt-2">Fare: ₦{booking.fare.toLocaleString()}</p>
                        {booking.status === 'pending' && onQuickAssign && (
                          <button
                            type="button"
                            onClick={() => onQuickAssign(booking.id)}
                            className="mt-2 w-full py-1 bg-orange-600 text-white text-xs font-bold rounded hover:bg-orange-700 transition-colors"
                          >
                            Assign Driver Now
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {hasDropoff && (
                  <Marker
                    position={[booking.dropoffLat!, booking.dropoffLng!]}
                    icon={dropoffIcon}
                    eventHandlers={{ click: () => onSelectBooking?.(booking) }}
                  >
                    <Popup>
                      <div className="p-2 text-slate-900">
                        <p className="text-xs font-bold text-orange-600">Dropoff Point</p>
                        <p className="text-xs text-slate-700">{booking.dropoffAddress}</p>
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">Trip: {booking.reference}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </React.Fragment>
            );
          })}
      </MapContainer>
    </div>
  );
}
