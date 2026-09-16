import { useEffect, useState, useMemo, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  History,
  CreditCard,
  RefreshCw,
  Filter,
  Car,
  Package,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PayoutModal } from '@/components/PayoutModal';
import { calculateDriverEarnings, DRIVER_PAYOUT_PERCENT } from '@/lib/ride-pricing';
import { parseOrderMetadata } from '@/lib/swift-order';
import { driverGetWalletData, DriverWalletJob } from '@/lib/dispatcher.functions';

export const Route = createFileRoute('/_authenticated/drive/wallet')({
  ssr: false,
  component: DriverWalletScreen,
  errorComponent: DriverWalletErrorFallback,
});

function DriverWalletErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container mx-auto py-12 px-4 max-w-lg text-center space-y-4">
      <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-100">Wallet View Unavailable</h2>
      <p className="text-xs text-slate-400">
        {error?.message || 'Could not load your wallet details right now.'}
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={() => reset()}>
          Try Again
        </Button>
        <Link
          to="/drive"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Back to Cockpit
        </Link>
      </div>
    </div>
  );
}

type DateFilter = 'all' | 'today' | 'week' | 'month';

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
};

function getFilterCutoff(filter: DateFilter): Date | null {
  const now = new Date();
  if (filter === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === 'month') {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function formatSafeDate(val: string | null | undefined): string {
  if (!val) return 'Recently';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

function DriverWalletScreen() {
  const { user, loading: authLoading } = useAuth();
  const driverId = user?.id;

  const [balance, setBalance] = useState<number>(0);
  const [grossCustomerFare, setGrossCustomerFare] = useState<number>(0);
  const [transactions, setTransactions] = useState<DriverWalletJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const fetchWalletData = useCallback(async () => {
    if (!driverId) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Primary: Call the server function with elevated admin privileges to guarantee retrieval
      let loaded = false;
      try {
        const res = await driverGetWalletData({ data: { driverId } });
        if (res && typeof res.balance === 'number') {
          setBalance(res.balance);
          setGrossCustomerFare(res.grossCustomerFare || 0);
          setTransactions(res.transactions || []);
          loaded = true;
        }
      } catch (srvErr) {
        console.warn('[fetchWalletData] server fn notice, trying direct client query:', srvErr);
      }

      // Secondary fallback: Direct Supabase client query against swift_deliveries
      if (!loaded) {
        // Resolve driver IDs (auth user_id vs public.drivers.id)
        const driverIds = new Set<string>([driverId]);
        try {
          const { data: drv } = await supabase
            .from('drivers')
            .select('id, user_id')
            .or(`id.eq.${driverId},user_id.eq.${driverId}`)
            .maybeSingle();
          if (drv?.id) driverIds.add(drv.id);
          if (drv?.user_id) driverIds.add(drv.user_id);
        } catch (_) {}

        const { data: jobs, error } = await supabase
          .from('swift_deliveries')
          .select('id, driver_id, status, estimated_price, created_at, pickup_address, dropoff_address, package_type')
          .in('driver_id', Array.from(driverIds))
          .eq('status', 'delivered')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[fetchWalletData] Fallback query error:', error);
          toast.error('Failed to load wallet data.');
        } else {
          const completedJobs = jobs || [];
          const totalGross = completedJobs.reduce((sum, j) => sum + (Number(j.estimated_price) || 0), 0);
          const totalDriverEarnings = completedJobs.reduce(
            (sum, j) => sum + calculateDriverEarnings(Number(j.estimated_price) || 0),
            0
          );

          const txs: DriverWalletJob[] = completedJobs.map((j) => {
            const meta = parseOrderMetadata(j.package_type);
            const gross = Number(j.estimated_price) || 0;
            const dest = j.dropoff_address || 'Completed Trip';
            const desc = meta.isRide
              ? `Passenger Ride (${meta.tierName || 'Swift Ride'}) — ${dest}`
              : `Express Parcel Courier — ${dest}`;

            return {
              id: j.id,
              amount: calculateDriverEarnings(gross),
              grossFare: gross,
              description: desc,
              pickupAddress: j.pickup_address || 'Pickup',
              dropoffAddress: dest,
              packageType: j.package_type || 'Trip',
              isRide: meta.isRide,
              createdAt: j.created_at,
            };
          });

          setBalance(totalDriverEarnings);
          setGrossCustomerFare(totalGross);
          setTransactions(txs);
        }
      }
    } catch (err: any) {
      console.error('Error loading wallet data:', err);
      toast.error('Failed to load wallet information.');
    } finally {
      setIsLoading(false);
    }
  }, [driverId, authLoading]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

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
    return transactions.filter((tx) => {
      if (!tx.createdAt) return false;
      const t = new Date(tx.createdAt).getTime();
      return !isNaN(t) && t >= cutoff.getTime();
    });
  }, [transactions, dateFilter]);

  const periodSummary = useMemo(() => {
    const totalPayout = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalGross = filteredTransactions.reduce((sum, tx) => sum + (tx.grossFare || 0), 0);
    const tripCount = filteredTransactions.length;
    const avgPayout = tripCount > 0 ? Math.round(totalPayout / tripCount) : 0;
    return { totalPayout, totalGross, tripCount, avgPayout };
  }, [filteredTransactions]);

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-2">
            <Wallet className="h-3.5 w-3.5" /> Driver Earnings & Payout Ledger
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Driver Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your verified {DRIVER_PAYOUT_PERCENT}% earnings from all completed rides and deliveries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWalletData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Link
            to="/drive"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Cockpit
          </Link>
        </div>
      </div>

      {/* Main Balance Banner */}
      <Card className="bg-gradient-to-br from-emerald-950 via-slate-900 to-green-950 border-emerald-800/40 text-white shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <CardHeader className="pb-2">
          <CardDescription className="text-emerald-300 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Wallet className="h-4 w-4" /> Available Balance ({DRIVER_PAYOUT_PERCENT}% Payout Share)
          </CardDescription>
          <CardTitle className="text-4xl sm:text-5xl font-black text-white pt-2">
            ₦{(balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-800/40">
            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-800/30">
              <p className="text-[11px] text-emerald-300 font-medium uppercase tracking-wider">
                Total Customer Fares Completed
              </p>
              <p className="text-xl font-bold text-white mt-0.5">
                ₦{(grossCustomerFare || 0).toLocaleString('en-NG')}
              </p>
              <p className="text-[10px] text-emerald-400/80 mt-0.5">
                Total amount paid by passengers for your completed trips
              </p>
            </div>

            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-800/30 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-300 font-medium uppercase tracking-wider">
                  Total Completed Jobs
                </p>
                <p className="text-xl font-bold text-white mt-0.5">{transactions.length}</p>
                <p className="text-[10px] text-emerald-400/80 mt-0.5">
                  Verified delivered orders credited
                </p>
              </div>
              <Button
                onClick={handlePayout}
                disabled={balance <= 0}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shrink-0"
              >
                <CreditCard className="mr-2 h-4 w-4" /> Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" /> Payout Ledger & History
              </CardTitle>
              <CardDescription>
                Detailed breakdown of passenger fares and your credited {DRIVER_PAYOUT_PERCENT}% driver cut.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter by period</span>
            </div>
          </div>

          {/* Date Filter Pills */}
          <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1 overflow-x-auto">
            {(['all', 'today', 'week', 'month'] as DateFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`flex-1 min-w-[80px] py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === f
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {DATE_FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Summary Stat Pills */}
          {!isLoading && filteredTransactions.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                  Your Payout ({DRIVER_PAYOUT_PERCENT}%)
                </p>
                <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  ₦{periodSummary.totalPayout.toLocaleString('en-NG')}
                </p>
              </div>
              <div className="bg-muted/40 border border-border rounded-xl p-2.5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Trips Completed</p>
                <p className="text-base sm:text-lg font-black mt-0.5">{periodSummary.tripCount}</p>
              </div>
              <div className="bg-muted/40 border border-border rounded-xl p-2.5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Avg / Trip</p>
                <p className="text-base sm:text-lg font-black mt-0.5">
                  ₦{periodSummary.avgPayout.toLocaleString('en-NG')}
                </p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-16 space-y-2">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
              <p className="text-xs text-muted-foreground">Loading your completed earnings...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">No earnings recorded for this period</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {dateFilter === 'all'
                    ? 'Completed rides and parcel deliveries will appear here automatically.'
                    : `No completed trips recorded for ${DATE_FILTER_LABELS[dateFilter].toLowerCase()}. Switch to "All Time" to view all history.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        tx.isRide
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}
                    >
                      {tx.isRide ? <Car className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate max-w-md">
                          {tx.dropoffAddress}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            tx.isRide
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {tx.isRide ? 'Ride' : 'Parcel'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span>Pickup: {tx.pickupAddress}</span>
                        <span>•</span>
                        <span>{formatSafeDate(tx.createdAt)}</span>
                      </div>

                      <div className="text-[11px] text-muted-foreground/90 font-mono">
                        Passenger Paid:{' '}
                        <span className="font-semibold text-foreground">
                          ₦{tx.grossFare.toLocaleString('en-NG')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 pl-11 sm:pl-0">
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      +₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {DRIVER_PAYOUT_PERCENT}% driver payout
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Modal */}
      {driverId && (
        <PayoutModal
          driverId={driverId}
          balance={balance}
          isOpen={isPayoutModalOpen}
          onClose={() => setIsPayoutModalOpen(false)}
          onSuccess={fetchWalletData}
        />
      )}
    </div>
  );
}
