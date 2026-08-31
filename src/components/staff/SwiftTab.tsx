import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function SwiftTab() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllDeliveries = async () => {
    try {
      // Staff policy allows fetching everything
      const { data, error } = await supabase
        .from('swift_deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error: any) {
      toast.error('Failed to load dispatch board');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDeliveries();

    const subscription = supabase
      .channel('staff_deliveries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swift_deliveries' }, () => {
        fetchAllDeliveries();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const handleAdminCancel = async (id: string) => {
    if (!confirm('Are you sure you want to forcibly cancel this order?')) return;

    try {
      const { error } = await supabase
        .from('swift_deliveries')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Order forcibly cancelled.');
    } catch (error: any) {
      toast.error('Failed to cancel order.');
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

  return (
    <Card className="border-t-4 border-t-slate-800">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-slate-800" />
          Dispatch Control Center
        </CardTitle>
        <CardDescription>Monitor all ecosystem logistics, track drivers, and resolve stranded orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Driver ID</TableHead>
                <TableHead className="text-right">Admin Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No active deliveries in the ecosystem.
                  </TableCell>
                </TableRow>
              )}
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-xs">{delivery.id.split('-')[0]}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{delivery.pickup_address}</div>
                    <div className="text-xs text-muted-foreground">to {delivery.dropoff_address}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={delivery.status === 'delivered' ? 'default' : 'secondary'}>
                      {delivery.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {delivery.driver_id ? delivery.driver_id.split('-')[0] : 'Unassigned'}
                  </TableCell>
                  <TableCell className="text-right">
                    {['pending', 'accepted', 'in_transit'].includes(delivery.status) && (
                      <Button variant="destructive" size="sm" onClick={() => handleAdminCancel(delivery.id)}>
                        <AlertCircle className="h-4 w-4 mr-1" /> Force Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}