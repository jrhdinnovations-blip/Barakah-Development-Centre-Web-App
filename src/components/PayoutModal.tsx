import { useState } from 'react';
import { CreditCard, Building2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Top Nigerian Commercial Banks
const NIGERIAN_BANKS = [
    { name: 'Access Bank', code: '044' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'GTBank (Guaranty Trust)', code: '058' },
    { name: 'Kuda Microfinance Bank', code: '50211' },
    { name: 'OPay Digital Services', code: '999992' },
    { name: 'Palmpay', code: '999991' },
    { name: 'UBA (United Bank for Africa)', code: '033' },
    { name: 'Zenith Bank', code: '057' },
];

interface PayoutModalProps {
    driverId: string;
    balance: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function PayoutModal({ driverId, balance, isOpen, onClose, onSuccess }: PayoutModalProps) {
    const [bankCode, setBankCode] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [amount, setAmount] = useState<number>(balance);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleWithdrawal = async () => {
        if (!accountNumber || accountNumber.length !== 10) {
            toast.error('Please enter a valid 10-digit NUBAN account number.');
            return;
        }
        if (!bankCode) {
            toast.error('Please select your bank.');
            return;
        }
        if (amount <= 0 || amount > balance) {
            toast.error('Invalid payout amount.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke('paystack-payout', {
                body: {
                    driver_id: driverId,
                    amount: Number(amount),
                    account_number: accountNumber,
                    bank_code: bankCode,
                    account_name: accountName || 'Driver Payout',
                },
            });

            if (error || data?.error) {
                throw new Error(data?.error || error?.message || 'Payout failed');
            }

            toast.success(`₦${amount.toLocaleString()} payout initiated!`);
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to process payout request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-700">
                        <CreditCard className="h-5 w-5" /> Bank Withdrawal
                    </DialogTitle>
                    <DialogDescription>
                        Transfer your wallet balance directly to your Nigerian bank account via Paystack.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-3">
                    <div className="space-y-2">
                        <Label>Select Bank</Label>
                        <Select value={bankCode} onValueChange={setBankCode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose Bank..." />
                            </SelectTrigger>
                            <SelectContent>
                                {NIGERIAN_BANKS.map((b) => (
                                    <SelectItem key={b.code} value={b.code}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number (10 Digits)</Label>
                        <Input
                            id="accountNumber"
                            maxLength={10}
                            placeholder="0123456789"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="accountName">Account Holder Name</Label>
                        <Input
                            id="accountName"
                            placeholder="As registered with your bank"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <Label htmlFor="amount">Amount to Withdraw (₦)</Label>
                            <span className="text-muted-foreground">Max: ₦{balance.toLocaleString()}</span>
                        </div>
                        <Input
                            id="amount"
                            type="number"
                            max={balance}
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleWithdrawal}
                        disabled={isSubmitting || balance <= 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isSubmitting ? 'Processing Transfer...' : `Withdraw ₦${amount.toLocaleString()}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}