import { supabase } from '@/integrations/supabase/client';

export interface DispatchNotificationParams {
    recipientEmail: string;
    reference: string;
    status: string;
    eventType: 'ORDER_CREATED' | 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';
    pickupAddress?: string;
    dropoffAddress?: string;
}

export async function sendOrderNotification(params: DispatchNotificationParams) {
    try {
        const { data, error } = await supabase.functions.invoke('send-notification', {
            body: {
                recipient_email: params.recipientEmail,
                reference: params.reference,
                status: params.status,
                event_type: params.eventType,
                pickup_address: params.pickupAddress,
                dropoff_address: params.dropoffAddress,
            },
        });

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.warn('Failed to send notification email:', err);
        return { success: false, error: err };
    }
}