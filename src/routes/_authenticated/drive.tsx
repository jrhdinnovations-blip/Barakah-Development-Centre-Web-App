import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MapPin, Navigation, CheckCircle, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/drive')({
  component: DriverDashboard,
});

type Delivery = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  package_type: string;
  weight_kg: number;
  notes: string;
  status: string;
  estimated_price: number;
  created_at: string;
  driver_id?: string | null;
};

function DriverDashboard() {
  const { session, user } = useAuth() as any;
  const userId = user?.id || session?.user?.id;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. Fetch available and assigned jobs
  const fetchDeliveries = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('swift_deliveries')
        .select('*')
        .or(`status.eq.pending,driver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load available jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();

    if (!userId) return;

    // 2. Realtime listener: Instantly show new bookings from customers
    const subscription = supabase
      .channel('driver_deliveries_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swift_deliveries' },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  // 3. Driver Actions: Accept Job
  const handleAcceptJob = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('swift_deliveries')
        .update({ status: 'accepted', driver_id: userId })
        .eq('id', id)
        .eq('status', 'pending');

      if (error) throw error;
      toast.success("Job accepted! Drive safely.");
      fetchDeliveries();
    } catch (error: any) {
      toast.error(error.message || "Failed to accept job. It may have been taken.");
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Driver Actions: Update Status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('swift_deliveries')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('driver_id', userId);

      if (error) throw error;
      toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
      fetchDeliveries();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status.");
    } finally {
      setProcessingId(null);
    }
  };

  // Filter lists for the UI tabs
  const availableJobs = deliveries.filter(d => d.status === 'pending');
  const myActiveJobs = deliveries.filter(d =>
    d.driver_id === userId && ['accepted', 'in_transit'].includes(d.status)
  );

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Driver Console</h1>
          <p className="text-muted-foreground">Find available jobs and manage your active deliveries.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium text-sm border border-green-200">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Online & Ready
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="available">
              Available Jobs {availableJobs.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{availableJobs.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active">
              My Active Deliveries {myActiveJobs.length > 0 && `(${myActiveJobs.length})`}
            </TabsTrigger>
          </TabsList>

          {/* AVAILABLE JOBS TAB */}
          <TabsContent value="available" className="space-y-4">
            {availableJobs.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                <Truck className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <CardTitle>No Jobs Available</CardTitle>
                <CardDescription>Waiting for customers to book new deliveries...</CardDescription>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableJobs.map((job) => (
                  <Card key={job.id} className="flex flex-col justify-between shadow-sm">
                    <div>
                      <CardHeader className="pb-3 border-b">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">New Request</Badge>
                          <span className="font-bold text-lg text-blue-600">₦{Number(job.estimated_price).toLocaleString()}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Pickup</p>
                              <p className="text-sm font-medium">{job.pickup_address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Dropoff</p>
                              <p className="text-sm font-medium">{job.dropoff_address}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                          <p><strong>Item:</strong> {job.package_type} ({job.weight_kg} kg)</p>
                          {job.notes && <p className="mt-1 text-muted-foreground"><strong>Notes:</strong> {job.notes}</p>}
                        </div>
                      </CardContent>
                    </div>
                    <div className="p-4 pt-0 mt-auto">
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleAcceptJob(job.id)}
                        disabled={processingId === job.id}
                      >
                        {processingId === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Accept Delivery
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* MY ACTIVE DELIVERIES TAB */}
          <TabsContent value="active" className="space-y-4">
            {myActiveJobs.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                <Navigation className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <CardTitle>No Active Deliveries</CardTitle>
                <CardDescription>Accept a job from the Available Jobs tab to get started.</CardDescription>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myActiveJobs.map((job) => (
                  <Card key={job.id} className={`overflow-hidden border-l-4 ${job.status === 'in_transit' ? 'border-l-blue-600' : 'border-l-yellow-500'}`}>
                    <CardHeader className="pb-3 bg-muted/30">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                          ID: {job.id.slice(0, 8)}...
                        </CardTitle>
                        <Badge className={job.status === 'in_transit' ? "bg-blue-600" : "bg-yellow-600"}>
                          {job.status === 'in_transit' ? "In Transit" : "Heading to Pickup"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="flex flex-col gap-3 md:col-span-2">
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Pickup Location</p>
                            <p className="text-sm font-medium">{job.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Dropoff Location</p>
                            <p className="text-sm font-medium">{job.dropoff_address}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-end items-end gap-3 md:border-l md:pl-4 pt-4 md:pt-0">
                        {job.status === 'accepted' ? (
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleUpdateStatus(job.id, 'in_transit')}
                            disabled={processingId === job.id}
                          >
                            {processingId === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                            Mark In Transit
                          </Button>
                        ) : (
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateStatus(job.id, 'delivered')}
                            disabled={processingId === job.id}
                          >
                            {processingId === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Mark Delivered
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}