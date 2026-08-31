import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import { Power, Package, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useDriverTelemetry } from '@/hooks/use-driver-telemetry';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/driver-dispatch')({
  component: DriverConsolePage,
});

function DriverConsolePage() {
  const auth = useAuth() as any;
  const user = auth?.user || auth?.session?.user;
  const [isOnline, setIsOnline] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);

  const { location, gpsError } = useDriverTelemetry(user?.id, isOnline);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "" });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`driver-${user.id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'enterprise_dispatches', filter: `assigned_driver_id=eq.${user.id}` },
      (payload: any) => {
        const job = payload.new;
        if (['driver_assigned', 'in_transit'].includes(job.status)) {
          if (!activeJob) toast.success("New Dispatch Assigned!");
          setActiveJob(job);
        } else if (['delivered', 'cancelled'].includes(job.status)) {
          setActiveJob(null);
        }
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeJob]);

  const updateJobStatus = async (newStatus: string) => {
    if (!activeJob) return;
    await supabase.from('enterprise_dispatches').update({ status: newStatus }).eq('id', activeJob.id);
    if (newStatus === 'delivered') {
      await supabase.from('active_drivers').update({ status: 'available' }).eq('driver_id', user.id);
      setActiveJob(null);
    }
  };

  if (!isLoaded) return <div className="min-h-dvh flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading Engine...</div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl flex flex-col gap-6 min-h-dvh">
      <div className="flex justify-between items-center border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white">Driver Console</h1>
        <Button onClick={() => setIsOnline(!isOnline)} disabled={!!activeJob} className={`h-12 px-6 ${isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}>
          <Power className="mr-2" /> {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
        </Button>
      </div>

      <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-800 min-h-[500px]">
        {activeJob && (
          <div className="absolute bottom-6 left-6 right-6 z-20">
            <Card className="bg-slate-900 border border-blue-500/50 shadow-2xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Current Dispatch</h3>
                <p className="text-slate-300 text-sm mb-2">Pickup: {activeJob.pickup_address}</p>
                <p className="text-slate-300 text-sm mb-6">Dropoff: {activeJob.dropoff_address}</p>
                
                {activeJob.status === 'driver_assigned' && (
                  <Button onClick={() => updateJobStatus('in_transit')} className="w-full bg-blue-600 text-white">
                    Package Picked Up <ArrowRight className="ml-2" />
                  </Button>
                )}
                {activeJob.status === 'in_transit' && (
                  <Button onClick={() => updateJobStatus('delivered')} className="w-full bg-emerald-600 text-white">
                    <CheckCircle2 className="mr-2" /> Confirm Delivery
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={location || { lat: 9.0765, lng: 7.3986 }} zoom={16} options={{ disableDefaultUI: true }}>
          {isOnline && location && <Marker position={location} icon={{ path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />}
        </GoogleMap>
      </div>
    </div>
  );
}