import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDriverTelemetry(driverId: string | undefined, isOnline: boolean) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!driverId || !isOnline) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your device.');
      return;
    }

    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });

        try {
          await supabase.rpc('update_driver_location', {
            p_driver_id: driverId,
            p_lat: latitude,
            p_lng: longitude,
            p_status: 'available'
          });
        } catch (err) {
          console.error('Telemetry error:', err);
        }
      },
      (error) => {
        setGpsError(error.message);
        if (error.code === 1) toast.error('Location permission denied.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [driverId, isOnline]);

  return { location, gpsError };
}