import { useEffect, useState, ComponentType } from 'react';

interface DeliveryMapProps {
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    pickupAddress: string;
    dropoffAddress: string;
    height?: string;
}

const DEFAULT_PICKUP: [number, number] = [9.8965, 8.8583];
const DEFAULT_DROPOFF: [number, number] = [9.9211, 8.8921];

export function DeliveryMap(props: DeliveryMapProps) {
    const [isClient, setIsClient] = useState(false);
    const [MapComponents, setMapComponents] = useState<{
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

        // Dynamically import Leaflet modules only in the browser
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

            setMapComponents({
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

    const height = props.height || '220px';

    // Render a clean loading skeleton on the server and initial client hydration
    if (!isClient || !MapComponents) {
        return (
            <div
                style={{ height }}
                className="w-full rounded-lg bg-muted/40 animate-pulse flex items-center justify-center border text-xs text-muted-foreground"
            >
                Loading map visual...
            </div>
        );
    }

    const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, L } = MapComponents;

    const pickupCoords: [number, number] = [
        props.pickupLat || DEFAULT_PICKUP[0],
        props.pickupLng || DEFAULT_PICKUP[1],
    ];

    const dropoffCoords: [number, number] = [
        props.dropoffLat || DEFAULT_DROPOFF[0],
        props.dropoffLng || DEFAULT_DROPOFF[1],
    ];

    const routePolyline: [number, number][] = [pickupCoords, dropoffCoords];

    function MapBoundsFitter({ points }: { points: [number, number][] }) {
        const map = useMap();
        useEffect(() => {
            if (points.length >= 2) {
                const bounds = L.latLngBounds(points);
                map.fitBounds(bounds, { padding: [30, 30] });
            }
        }, [map, points]);
        return null;
    }

    return (
        <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border shadow-inner relative z-0">
            <MapContainer
                center={pickupCoords}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker position={pickupCoords}>
                    <Popup>
                        <div className="font-sans">
                            <strong className="text-blue-600">📍 Pickup Location:</strong>
                            <p className="text-xs mt-1">{props.pickupAddress}</p>
                        </div>
                    </Popup>
                </Marker>

                <Marker position={dropoffCoords}>
                    <Popup>
                        <div className="font-sans">
                            <strong className="text-green-600">🏁 Dropoff Location:</strong>
                            <p className="text-xs mt-1">{props.dropoffAddress}</p>
                        </div>
                    </Popup>
                </Marker>

                <Polyline
                    positions={routePolyline}
                    pathOptions={{ color: '#2563eb', weight: 4, dashArray: '6, 8' }}
                />

                <MapBoundsFitter points={routePolyline} />
            </MapContainer>
        </div>
    );
}