import { useEffect, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Compass, Navigation2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const containerStyle = {
    width: '100%',
    height: '320px',
    borderRadius: '1rem',
};

const defaultCenter = {
    lat: 9.8965, // Jos, Plateau State default
    lng: 8.8583,
};

const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#1e293b" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#334155" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0284c7" }],
    },
];

interface LiveMapTrackerProps {
    pickupAddress: string;
    dropoffAddress: string;
    driverLocation?: { lat: number; lng: number };
    isLoaded: boolean;
}

export function LiveMapTracker({
    pickupAddress,
    dropoffAddress,
    driverLocation,
    isLoaded,
}: LiveMapTrackerProps) {
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    useEffect(() => {
        if (!isLoaded || !pickupAddress || !dropoffAddress || !window.google) return;

        const directionsService = new google.maps.DirectionsService();

        directionsService.route(
            {
                origin: pickupAddress,
                destination: dropoffAddress,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                    setDirections(result);
                }
            }
        );
    }, [isLoaded, pickupAddress, dropoffAddress]);

    if (!isLoaded) {
        return (
            <div className="w-full h-[320px] bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 font-mono text-xs">
                <Compass className="h-5 w-5 animate-spin mr-2 text-blue-500" /> Map Telemetry Initializing...
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
            <div className="absolute top-3 left-3 z-10 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                <Navigation2 className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                <span className="text-xs font-mono text-slate-200">GPS Live Telemetry</span>
            </div>

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={driverLocation || defaultCenter}
                zoom={13}
                options={{
                    styles: darkMapStyle,
                    disableDefaultUI: true,
                    zoomControl: true,
                }}
            >
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            polylineOptions: {
                                strokeColor: '#3b82f6',
                                strokeWeight: 5,
                            },
                            suppressMarkers: false,
                        }}
                    />
                )}

                {driverLocation && (
                    <Marker
                        position={driverLocation}
                        icon={{
                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                            scale: 6,
                            fillColor: '#f97316',
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: '#ffffff',
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
}