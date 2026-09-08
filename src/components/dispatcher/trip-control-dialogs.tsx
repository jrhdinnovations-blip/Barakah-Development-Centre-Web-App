import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Phone,
  ShieldAlert,
  Navigation,
  Clock,
  MapPin,
  Car,
  Bike,
  User,
  Activity,
  Send,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---
export interface DriverCandidate {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleMake?: string;
  plateNumber?: string;
  status: string;
  rating?: number;
  currentLat?: number | null;
  currentLng?: number | null;
  distanceKm?: number;
}

export interface ManagedTrip {
  id: string;
  reference: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageType: string;
  status: string;
  fare: number;
  createdAt: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  assignedDriverPhone?: string | null;
  assignedDriverVehicle?: string | null;
  assignedDriverPlate?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  isRide?: boolean;
  safetyPin?: string | null;
}

// ─────────────────────────────────────────────────────────────
// 1. ASSIGN DRIVER MODAL
// ─────────────────────────────────────────────────────────────
interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ManagedTrip | null;
  availableDrivers: DriverCandidate[];
  onAssign: (tripId: string, driver: DriverCandidate) => Promise<void>;
}

export function AssignDriverModal({
  isOpen,
  onClose,
  trip,
  availableDrivers,
  onAssign,
}: AssignModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = availableDrivers.filter(
    d =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      (d.plateNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);

  const handleConfirm = async () => {
    if (!trip || !selectedDriver) {
      toast.error('Please select an active driver to assign.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onAssign(trip.id, selectedDriver);
      toast.success(`Assigned ${selectedDriver.name} to Trip ${trip.reference}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign driver.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#0a0f1c] border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Trip Control: Assign Driver
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Order <span className="font-mono text-orange-400">{trip?.reference}</span> • ₦
                {(trip?.fare || 0).toLocaleString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {trip && (
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
              <p className="text-slate-300">
                <strong className="text-slate-200">Pickup:</strong> {trip.pickupAddress}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 mt-1 shrink-0" />
              <p className="text-slate-300">
                <strong className="text-slate-200">Dropoff:</strong> {trip.dropoffAddress}
              </p>
            </div>
            {trip.customerPhone && (
              <p className="text-slate-400 font-mono pt-1 border-t border-slate-800">
                Customer: {trip.customerName || 'Registered User'} ({trip.customerPhone})
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Select Available Driver ({availableDrivers.length} Online)
            </label>
            <span className="text-[11px] text-slate-400">Ranked by Availability</span>
          </div>

          <Input
            placeholder="Search driver by name, phone or vehicle plate..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900 border-slate-700 text-xs h-9"
          />

          <div className="max-h-56 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {filtered.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500">
                No available drivers match your filter.
              </p>
            ) : (
              filtered.map(driver => {
                const isSelected = driver.id === selectedDriverId;
                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/60 shadow-lg shadow-orange-500/5'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700">
                        {driver.vehicleType?.toLowerCase().includes('motorcycle') ? (
                          <Bike className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Car className="h-4 w-4 text-orange-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          {driver.name}
                          {driver.rating && (
                            <span className="text-[10px] text-amber-400">★ {driver.rating}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {driver.vehicleType} • {driver.phone}
                          {driver.plateNumber ? ` • ${driver.plateNumber}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${
                          driver.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        } text-[10px] uppercase font-bold`}
                      >
                        {driver.status}
                      </Badge>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedDriverId(driver.id)}
                        className="accent-orange-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDriverId || isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            {isSubmitting ? 'Assigning…' : 'Confirm Assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. REASSIGN DRIVER MODAL
// ─────────────────────────────────────────────────────────────
interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ManagedTrip | null;
  availableDrivers: DriverCandidate[];
  onReassign: (tripId: string, newDriver: DriverCandidate, reason: string) => Promise<void>;
}

export function ReassignDriverModal({
  isOpen,
  onClose,
  trip,
  availableDrivers,
  onReassign,
}: ReassignModalProps) {
  const [newDriverId, setNewDriverId] = useState('');
  const [reason, setReason] = useState('Driver vehicle breakdown or puncture');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDriver = availableDrivers.find(d => d.id === newDriverId);

  const handleConfirm = async () => {
    if (!trip || !selectedDriver) {
      toast.error('Please select a replacement driver.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onReassign(trip.id, selectedDriver, reason);
      toast.success(`Trip ${trip.reference} reassigned to ${selectedDriver.name}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#0a0f1c] border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Trip Control: Reassign Driver
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Shift Trip <span className="font-mono text-orange-400">{trip?.reference}</span> to an
                alternative available driver
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {trip && (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <p className="text-slate-400 font-bold uppercase text-[10px]">Currently Assigned Driver</p>
            <p className="text-sm font-bold text-amber-400 mt-0.5">
              {trip.assignedDriverName || 'Driver Assigned'} ({trip.assignedDriverPhone || 'N/A'})
            </p>
            <p className="text-slate-400 text-xs mt-1">Route: {trip.pickupAddress} → {trip.dropoffAddress}</p>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reassignment Reason
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-xs h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="Driver vehicle breakdown or puncture">
                  Driver vehicle breakdown or puncture
                </SelectItem>
                <SelectItem value="Driver unresponsive / GPS offline">
                  Driver unresponsive / GPS offline
                </SelectItem>
                <SelectItem value="Optimized proximity / Closer driver found">
                  Optimized proximity / Closer driver found
                </SelectItem>
                <SelectItem value="Customer requested driver change">
                  Customer requested driver change
                </SelectItem>
                <SelectItem value="Security hazard / Route divergence">
                  Security hazard / Route divergence
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Choose Replacement Driver
            </label>
            <Select value={newDriverId} onValueChange={setNewDriverId}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-xs h-10 text-white">
                <SelectValue placeholder="Select available driver..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-56">
                {availableDrivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.vehicleType}) • {d.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800">
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!newDriverId || isSubmitting}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
          >
            {isSubmitting ? 'Reassigning…' : 'Confirm Reassignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. CANCEL TRIP MODAL
// ─────────────────────────────────────────────────────────────
interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ManagedTrip | null;
  onCancel: (tripId: string, reason: string, waiveFee: boolean) => Promise<void>;
}

export function CancelTripModal({ isOpen, onClose, trip, onCancel }: CancelModalProps) {
  const [reason, setReason] = useState('Customer requested cancellation');
  const [customNote, setCustomNote] = useState('');
  const [waiveFee, setWaiveFee] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!trip) return;
    setIsSubmitting(true);
    try {
      const fullReason = customNote ? `${reason} (${customNote})` : reason;
      await onCancel(trip.id, fullReason, waiveFee);
      toast.success(`Trip ${trip.reference} has been cancelled.`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#0a0f1c] border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Trip Control: Cancel Booking
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Cancel Trip <span className="font-mono text-orange-400">{trip?.reference}</span> and
                release assigned resources
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Cancellation Reason
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-xs h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="Customer requested cancellation">
                  Customer requested cancellation
                </SelectItem>
                <SelectItem value="No available drivers in area / Timeout">
                  No available drivers in area / Timeout
                </SelectItem>
                <SelectItem value="Unreachable customer / Invalid pickup location">
                  Unreachable customer / Invalid pickup location
                </SelectItem>
                <SelectItem value="Prohibited or hazardous package content">
                  Prohibited or hazardous package content
                </SelectItem>
                <SelectItem value="Security alert or civil restriction">
                  Security alert or civil restriction
                </SelectItem>
                <SelectItem value="Other dispatcher override">Other dispatcher override</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Additional Dispatch Notes (Optional)
            </label>
            <Textarea
              placeholder="Provide context for audit records..."
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="bg-slate-900 border-slate-700 text-xs min-h-[70px] text-white"
            />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={waiveFee}
              onChange={e => setWaiveFee(e.target.checked)}
              className="accent-orange-500 h-4 w-4"
            />
            <span className="text-xs text-slate-300">
              <strong>Waive cancellation fee</strong> (Do not charge customer penalty)
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800">
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
            Keep Booking Active
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-500 text-white font-bold"
          >
            {isSubmitting ? 'Cancelling…' : 'Confirm Cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. ESCALATE TRIP MODAL (EMERGENCY / SOS)
// ─────────────────────────────────────────────────────────────
interface EscalateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ManagedTrip | null;
  onEscalate: (tripId: string, severity: 'warning' | 'critical' | 'sos', note: string) => Promise<void>;
}

export function EscalateTripModal({ isOpen, onClose, trip, onEscalate }: EscalateModalProps) {
  const [severity, setSeverity] = useState<'warning' | 'critical' | 'sos'>('critical');
  const [incidentType, setIncidentType] = useState('Prolonged Delay & Route Deviation');
  const [incidentNote, setIncidentNote] = useState('');
  const [notifySupervisor, setNotifySupervisor] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!trip) return;
    setIsSubmitting(true);
    try {
      const fullNote = `[${incidentType.toUpperCase()}] ${incidentNote}`;
      await onEscalate(trip.id, severity, fullNote);
      toast.error(`Trip ${trip.reference} ESCALATED (${severity.toUpperCase()})!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to escalate trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#0d070b] border-red-900/60 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Emergency & Escalation Control
                <Badge className="bg-red-600 text-white text-[10px]">SOS PROTOCOL</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-red-300">
                Flag incident for Trip <span className="font-mono text-white">{trip?.reference}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Dial Contacts */}
        {trip && (
          <div className="grid grid-cols-2 gap-2 my-2">
            {trip.customerPhone && (
              <a
                href={`tel:${trip.customerPhone}`}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center gap-2 text-xs font-semibold text-white"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                <span className="truncate">Customer: {trip.customerPhone}</span>
              </a>
            )}
            {trip.assignedDriverPhone && (
              <a
                href={`tel:${trip.assignedDriverPhone}`}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center gap-2 text-xs font-semibold text-white"
              >
                <Phone className="h-3.5 w-3.5 text-blue-400" />
                <span className="truncate">Driver: {trip.assignedDriverPhone}</span>
              </a>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Severity Level</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSeverity('warning')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  severity === 'warning'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                ⚠️ Warning
              </button>
              <button
                type="button"
                onClick={() => setSeverity('critical')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  severity === 'critical'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🚨 Critical Delay
              </button>
              <button
                type="button"
                onClick={() => setSeverity('sos')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  severity === 'sos'
                    ? 'bg-red-600 border-red-400 text-white animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🆘 Safety SOS
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Incident Category</label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-xs h-9 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="Driver SOS Button Triggered">Driver SOS Button Triggered</SelectItem>
                <SelectItem value="Customer Distress / Safety Report">
                  Customer Distress / Safety Report
                </SelectItem>
                <SelectItem value="Prolonged Delay & Route Deviation">
                  Prolonged Delay & Route Deviation
                </SelectItem>
                <SelectItem value="Road Accident / Medical Emergency">
                  Road Accident / Medical Emergency
                </SelectItem>
                <SelectItem value="Security Incident / Checkpoint Stoppage">
                  Security Incident / Checkpoint Stoppage
                </SelectItem>
                <SelectItem value="Package Tampering / Discrepancy">
                  Package Tampering / Discrepancy
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Escalation Narrative & Actions Taken
            </label>
            <Textarea
              placeholder="Document specific details, driver/customer statements, exact locations..."
              value={incidentNote}
              onChange={e => setIncidentNote(e.target.value)}
              className="bg-slate-900 border-slate-700 text-xs min-h-[80px] text-white"
            />
          </div>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/30 border border-red-900/40 text-xs text-red-200 cursor-pointer">
            <input
              type="checkbox"
              checked={notifySupervisor}
              onChange={e => setNotifySupervisor(e.target.checked)}
              className="accent-red-500 h-4 w-4"
            />
            <span>Broadcast instant high-priority alert to Super Admin & Operations WhatsApp</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-800/80">
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
            Dismiss
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-500 text-white font-bold"
          >
            {isSubmitting ? 'Transmitting Alert…' : 'Trigger Escalation Protocol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. TRIP TELEMETRY MONITOR DRAWER / DIALOG
// ─────────────────────────────────────────────────────────────
interface MonitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ManagedTrip | null;
  onOpenAssignModal?: () => void;
  onOpenReassignModal?: () => void;
  onOpenCancelModal?: () => void;
  onOpenEscalateModal?: () => void;
}

export function TripTelemetryMonitorDrawer({
  isOpen,
  onClose,
  trip,
  onOpenAssignModal,
  onOpenReassignModal,
  onOpenCancelModal,
  onOpenEscalateModal,
}: MonitorDrawerProps) {
  if (!trip) return null;

  const steps = [
    { label: 'Booking Created', completed: true, time: new Date(trip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { label: 'Driver Dispatched', completed: trip.status !== 'pending' && trip.status !== 'cancelled', time: trip.assignedDriverName ? 'Matched' : 'Pending' },
    { label: 'En Route to Pickup', completed: ['accepted', 'picked_up', 'in_transit', 'delivered'].includes(trip.status), time: '' },
    { label: 'In Transit to Destination', completed: ['in_transit', 'delivered'].includes(trip.status), time: '' },
    { label: 'Completed & Delivered', completed: trip.status === 'delivered', time: '' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0a0f1c] border-slate-800 text-slate-100 p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Navigation className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Trip Telemetry Monitor
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                    {trip.reference}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Real-time telemetry stream, route milestones, and live contact control
                </DialogDescription>
              </div>
            </div>
            <Badge
              className={`capitalize text-xs font-bold ${
                trip.status === 'in_transit'
                  ? 'bg-blue-600 text-white'
                  : trip.status === 'delivered'
                  ? 'bg-emerald-600 text-white'
                  : trip.status === 'pending'
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {trip.status.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Progress Timeline */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Trip Milestone Timeline
            </p>
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="relative">
                  <span
                    className={`absolute -left-[31px] top-0.5 h-4 w-4 rounded-full border-2 ${
                      step.completed
                        ? 'bg-emerald-500 border-[#0a0f1c] text-white'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                  <p
                    className={`text-xs font-semibold ${
                      step.completed ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.time && <p className="text-[10px] text-slate-500">{step.time}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Route Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                ↑ Pickup Location
              </p>
              <p className="text-xs text-white font-medium mt-0.5">{trip.pickupAddress}</p>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                ↓ Dropoff Location
              </p>
              <p className="text-xs text-white font-medium mt-0.5">{trip.dropoffAddress}</p>
            </div>
            <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Fare Value:</span>
              <span className="font-bold text-white">₦{trip.fare.toLocaleString()}</span>
            </div>
            {trip.safetyPin && (
              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Safety Verification PIN:</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  {trip.safetyPin}
                </span>
              </div>
            )}
          </div>

          {/* Assigned Driver Telematics */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Driver Telematics & Identity
            </p>
            {trip.assignedDriverName ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{trip.assignedDriverName}</p>
                    <p className="text-xs text-slate-400">
                      {trip.assignedDriverVehicle || 'Vehicle'} • {trip.assignedDriverPlate || 'No Plate'}
                    </p>
                    {trip.driverLat && trip.driverLng && (
                      <p className="text-[10px] font-mono text-cyan-400 mt-0.5 flex items-center gap-1">
                        <Radio className="h-3 w-3 animate-pulse" /> Coordinates: {trip.driverLat.toFixed(4)},{' '}
                        {trip.driverLng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>

                {trip.assignedDriverPhone && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                    asChild
                  >
                    <a href={`tel:${trip.assignedDriverPhone}`}>
                      <Phone className="h-3.5 w-3.5 mr-1.5" /> Call Driver
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-slate-500">No driver assigned yet.</p>
                {onOpenAssignModal && (
                  <Button
                    size="sm"
                    onClick={onOpenAssignModal}
                    className="mt-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                  >
                    Assign Driver Now
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {onOpenReassignModal && trip.assignedDriverName && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenReassignModal}
                className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reassign
              </Button>
            )}
            {onOpenCancelModal && trip.status !== 'delivered' && trip.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCancelModal}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            )}
            {onOpenEscalateModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenEscalateModal}
                className="border-rose-600 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs font-bold"
              >
                <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Escalate (SOS)
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300"
          >
            Close Monitor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
