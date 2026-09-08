import { useEffect, useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Wallet, ArrowDownRight, ArrowUpRight, History, CreditCard, RefreshCw, Filter } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PayoutModal } from '@/components/PayoutModal';
import { calculateDriverEarnings, DRIVER_PAYOUT_PERCENT } from '@/lib/ride-pricing';

export const Route = createFileRoute('/_authenticated/drive/wallet')({
    ssr: false,
    component: DriverWalletScreen,
});

interface Transaction {
    id: string;
    amount: number;
    description: string;
    created_at: string;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time',
};

function getFilterCutoff(filter: DateFilter): Date | null {
    const now = new Date();
    if (filter === 'today') {
        const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
    }
    if (filter === 'week') {
        const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
    }
    if (filter === 'month') {
        const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    }
    return null;
}

function DriverWalletScreen() {
    const { session, user } = useAuth() as any;
    const driverId = user?.id || session?.user?.id;

    const [balance, setBalance] = useState<number>(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');

    const fetchWalletData = async () => {
        if (!driverId) return;
        try {
            setIsLoading(true);

            const { data: walletData, error: walletError } = await (supabase as any)
                .from('driver_wallets')
                .select('balance')
                .eq('driver_id', driverId)
                .maybeSingle();

            if (walletError && walletError.code !== 'PGRST116') {
                console.warn('Driver wallet fetch notice:', walletError);
            }

            const { data: txData } = await (supabase as any)
                .from('driver_transactions')
                .select('*')
                .eq('driver_id', driverId)
                .order('created_at', { ascending: false });

            const { data: completedDeliveries } = await (supabase as any)
                .from('deliveries')
                .select('id, estimated_price, created_at, dropoff_address, package_type')
                .eq('driver_id', driverId)
                .eq('status', 'delivered');

            const calculatedDeliveryShare = (completedDeliveries || []).reduce(
                (sum: number, d: any) => sum + calculateDriverEarnings(d.estimated_price || 0),
                0
            );

            const finalBalance = (walletData?.balance && walletData.balance > 0)
                ? walletData.balance
                : calculatedDeliveryShare;

            setBalance(finalBalance);

            if (txData && txData.length > 0) {
                setTransactions(txData);
            } else if (completedDeliveries && completedDeliveries.length > 0) {
                const syntheticTxs: Transaction[] = completedDeliveries
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((d: any) => ({
                        id: d.id,
                        amount: calculateDriverEarnings(d.estimated_price || 0),
                        description: `Trip Payout (${DRIVER_PAYOUT_PERCENT}%) - ${d.dropoff_address || 'Completed Ride'}`,
                        created_at: d.created_at,
                    }));
                setTransactions(syntheticTxs);
            } else {
                setTransactions([]);
            }
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

    const filteredTransactions = useMemo(() => {
        const cutoff = getFilterCutoff(dateFilter);
        if (!cutoff) return transactions;
        return transactions.filter((tx) => new Date(tx.created_at) >= cutoff);
    }, [transactions, dateFilter]);

    const periodSummary = useMemo(() => {
        const credits = filteredTransactions.filter((tx) => tx.amount > 0);
        const totalPayout = credits.reduce((sum, tx) => sum + tx.amount, 0);
        const tripCount = credits.length;
        const avgPayout = tripCount > 0 ? Math.round(totalPayout / tripCount) : 0;
        return { totalPayout, tripCount, avgPayout };
    }, [filteredTransactions]);

    return (
        <div className="container mx-auto py-8 max-w-4xl space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Driver Wallet</h1>
                    <p className="text-muted-foreground">Track your {DRIVER_PAYOUT_PERCENT}% payout share and request direct payouts.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWalletData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            <Card className="bg-gradient-to-r from-emerald-900 to-green-950 text-white shadow-lg">
                <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-200 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                        <Wallet className="h-4 w-4" /> Available Earnings ({DRIVER_PAYOUT_PERCENT}% Payout Share)
                    </CardDescription>
                    <CardTitle className="text-4xl font-extrabold text-white pt-1">
                        ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex justify-between items-center">
                    <p className="text-xs text-emerald-300">
                        Fast payouts directly to your Nigerian bank account ({DRIVER_PAYOUT_PERCENT}% earned per ride/delivery).
                    </p>
                    <Button
                        onClick={handlePayout}
                        disabled={balance <= 0}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow"
                    >
                        <CreditCard className="mr-2 h-4 w-4" /> Withdraw Funds
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <History className="h-5 w-5 text-muted-foreground" /> Transaction History
                            </CardTitle>
                            <CardDescription>Your {DRIVER_PAYOUT_PERCENT}% earnings credited from completed trips.</CardDescription>
                        </div>
                        <Filter className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex gap-1 bg-muted/40 rounded-lg p-1 mt-3">
                        {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setDateFilter(f)}
                                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
                                    dateFilter === f
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {DATE_FILTER_LABELS[f]}
                            </button>
                        ))}
                    </div>

                    {!isLoading && filteredTransactions.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-2.5 text-center">
                                <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">My Payout</p>
                                <p className="text-base font-black text-emerald-700 dark:text-emerald-300">₦{periodSummary.totalPayout.toLocaleString('en-NG')}</p>
                            </div>
                            <div className="bg-muted/40 border border-border rounded-xl p-2.5 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Trips</p>
                                <p className="text-base font-black">{periodSummary.tripCount}</p>
                            </div>
                            <div className="bg-muted/40 border border-border rounded-xl p-2.5 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Avg / Trip</p>
                                <p className="text-base font-black">₦{periodSummary.avgPayout.toLocaleString('en-NG')}</p>
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center py-8 text-sm text-muted-foreground">Loading transactions...</p>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium">No transactions found</p>
                            <p className="text-xs text-muted-foreground">
                                {dateFilter === 'all'
                                    ? 'Completed delivery payouts will appear here.'
                                    : `No payouts recorded for ${DATE_FILTER_LABELS[dateFilter].toLowerCase()}.`}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredTransactions.map((tx) => {
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

