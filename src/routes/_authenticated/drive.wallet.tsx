import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Wallet, ArrowDownRight, ArrowUpRight, History, CreditCard, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PayoutModal } from '@/components/PayoutModal';

export const Route = createFileRoute('/_authenticated/drive/wallet')({
    component: DriverWalletScreen,
});

interface Transaction {
    id: string;
    amount: number;
    description: string;
    created_at: string;
}

function DriverWalletScreen() {
    const { session, user } = useAuth() as any;
    const driverId = user?.id || session?.user?.id;

    const [balance, setBalance] = useState<number>(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);

    const fetchWalletData = async () => {
        if (!driverId) return;
        try {
            setIsLoading(true);

            // 1. Fetch Wallet Balance
            const { data: walletData, error: walletError } = await supabase
                .from('driver_wallets')
                .select('balance')
                .eq('driver_id', driverId)
                .maybeSingle();

            if (walletError) throw walletError;
            setBalance(walletData?.balance || 0);

            // 2. Fetch Transaction History
            const { data: txData, error: txError } = await supabase
                .from('driver_transactions')
                .select('*')
                .eq('driver_id', driverId)
                .order('created_at', { ascending: false });

            if (txError) throw txError;
            setTransactions(txData || []);
        } catch (err: any) {
            console.error('Error loading wallet data:', err);
            toast.error('Failed to load wallet information.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, [driverId]);

    const handlePayout = () => {
        if (balance <= 0) {
            toast.error('Insufficient wallet balance for payout.');
            return;
        }
        setIsPayoutModalOpen(true);
    };

    return (
        <div className="container mx-auto py-8 max-w-4xl space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Driver Wallet</h1>
                    <p className="text-muted-foreground">Track your delivery earnings and request direct payouts.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWalletData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Wallet Balance Hero Card */}
            <Card className="bg-gradient-to-r from-emerald-900 to-green-950 text-white shadow-lg">
                <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-200 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                        <Wallet className="h-4 w-4" /> Available Earnings
                    </CardDescription>
                    <CardTitle className="text-4xl font-extrabold text-white pt-1">
                        ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex justify-between items-center">
                    <p className="text-xs text-emerald-300">Fast payouts directly to your Nigerian bank account.</p>
                    <Button
                        onClick={handlePayout}
                        disabled={balance <= 0}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow"
                    >
                        <CreditCard className="mr-2 h-4 w-4" /> Withdraw Funds
                    </Button>
                </CardContent>
            </Card>

            {/* Transaction History Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" /> Transaction History
                    </CardTitle>
                    <CardDescription>Earnings credited from deliveries and payout debits.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center py-8 text-sm text-muted-foreground">Loading transactions...</p>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium">No transactions found</p>
                            <p className="text-xs text-muted-foreground">Completed delivery payouts will appear here.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {transactions.map((tx) => {
                                const isDebit = tx.amount < 0;
                                return (
                                    <div key={tx.id} className="py-3 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${isDebit ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {isDebit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{tx.description}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(tx.created_at).toLocaleString('en-NG', {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                            {isDebit ? '' : '+'}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payout Modal Component */}
            <PayoutModal
                driverId={driverId}
                balance={balance}
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                onSuccess={fetchWalletData}
            />
        </div>
    );
}