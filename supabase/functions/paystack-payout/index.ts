import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
        const { driver_id, amount, account_number, bank_code, account_name } = await req.json();

        if (!driver_id || !amount || !account_number || !bank_code) {
            return new Response(
                JSON.stringify({ error: 'Missing required parameters' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Verify Driver Wallet Balance
        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('driver_wallets')
            .select('balance')
            .eq('driver_id', driver_id)
            .single();

        if (walletError || !wallet || wallet.balance < amount) {
            return new Response(
                JSON.stringify({ error: 'Insufficient wallet balance' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Step A: Create Paystack Transfer Recipient
        const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'nuban',
                name: account_name || 'Driver Payout',
                account_number: account_number,
                bank_code: bank_code,
                currency: 'NGN',
            }),
        });

        const recipientData = await recipientRes.json();
        if (!recipientData.status) {
            throw new Error(recipientData.message || 'Failed to resolve transfer recipient');
        }

        const recipientCode = recipientData.data.recipient_code;

        // 3. Step B: Initiate Paystack Transfer
        const transferRes = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'balance',
                amount: amount * 100, // Amount in Kobo
                recipient: recipientCode,
                reason: `Swiftmove Driver Payout for ID ${driver_id.slice(0, 8)}`,
            }),
        });

        const transferData = await transferRes.json();
        if (!transferData.status) {
            throw new Error(transferData.message || 'Paystack transfer request failed');
        }

        // 4. Step C: Deduct Driver Wallet Balance & Record Transaction
        const newBalance = wallet.balance - amount;

        await supabaseAdmin
            .from('driver_wallets')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('driver_id', driver_id);

        await supabaseAdmin
            .from('driver_transactions')
            .insert({
                driver_id: driver_id,
                amount: -amount,
                description: `Withdrawal to ${account_number} (${bank_code}) - Ref: ${transferData.data.reference}`,
            });

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Payout initiated successfully!',
                reference: transferData.data.reference,
                newBalance,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Payout Error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});