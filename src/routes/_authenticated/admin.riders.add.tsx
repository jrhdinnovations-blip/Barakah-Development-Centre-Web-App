import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Truck, ArrowLeft, Loader2, Eye, EyeOff, UserPlus, Bike, Car, CheckCircle2, Copy, Check, Sparkles, Phone, Mail, Lock } from 'lucide-react';
import { createUserAdmin } from '@/lib/admin.functions';
import { requireAdminRouteAccess } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_authenticated/admin/riders/add')({
  ssr: false,
  beforeLoad: async () => {
    await requireAdminRouteAccess(['administrator', 'admin', 'swift_manager', 'swift_dispatcher', 'dispatcher']);
  },
  head: () => ({
    meta: [
      { title: 'Onboard Fleet Personnel — Barakah Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AddRiderPage,
});

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let r = '';
  for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return `Fleet@${r}`;
}

function AddRiderPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    category: 'driver' as 'dispatch_rider' | 'driver',
    vehicle_type: 'Sedan',
    vehicle_make: '',
    plate_number: '',
    vehicle_color: 'Silver',
  });

  const handleCategorySelect = (category: 'dispatch_rider' | 'driver') => {
    setForm(prev => ({
      ...prev,
      category,
      vehicle_type: category === 'dispatch_rider' ? 'Motorcycle' : 'Sedan',
      vehicle_make: category === 'dispatch_rider' ? 'Bajaj Boxer' : 'Toyota Corolla',
      vehicle_color: prev.vehicle_color || 'Silver',
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      try {
        await createUserAdmin({
          data: {
            email: form.email.trim().toLowerCase(),
            password: form.password,
            full_name: form.full_name,
            phone: form.phone,
            rider_category: form.category,
            vehicle_type: form.vehicle_type,
            vehicle_make: form.vehicle_make,
            plate_number: form.plate_number.toUpperCase().trim(),
            vehicle_color: form.vehicle_color,
            role: 'driver',
          }
        });
      } catch (serverErr: any) {
        console.warn('Server function returned error, using direct registration:', serverErr);
        const { createClient } = await import('@supabase/supabase-js');
        const { sanitizeSupabaseUrl, sanitizeSupabaseKey } = await import('@/integrations/supabase/client');
        const supabaseUrl = sanitizeSupabaseUrl(import.meta.env['VITE_SUPABASE_URL']);
        const supabaseKey = sanitizeSupabaseKey(import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
        const isolatedClient = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        const formattedPlate = form.plate_number.toUpperCase().trim();

        const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              phone: form.phone,
              role: 'driver',
              rider_category: form.category,
              vehicle_type: form.vehicle_type,
              vehicle_make: form.vehicle_make,
              plate_number: formattedPlate,
              vehicle_color: form.vehicle_color,
              consent_given: true,
            },
          },
        });

        if (signUpError) throw signUpError;
        if (!signUpData.user) throw new Error('Could not create personnel account.');

        const newId = signUpData.user.id;
        try {
          await supabase.from('profiles').upsert({
            user_id: newId,
            full_name: form.full_name,
            phone: form.phone,
          } as any, { onConflict: 'user_id' });
        } catch {}

        try {
          const vehicleSummary = `${form.vehicle_color ? form.vehicle_color + ' ' : ''}${form.vehicle_make || form.vehicle_type}${formattedPlate ? ' (' + formattedPlate + ')' : ''}`;
          await supabase.from('active_drivers').upsert({
            driver_id: newId,
            vehicle_type: vehicleSummary,
            status: 'available',
          } as any, { onConflict: 'driver_id' });
        } catch {}
      }
      
      toast.success(
        `${form.category === 'dispatch_rider' ? 'Dispatch Rider' : 'Driver'} ${form.full_name} (${form.vehicle_make || form.vehicle_type}) onboarded successfully!`
      );
      setDone(true);
    } catch (e: any) {
      toast.error('Failed to add personnel: ' + (e.message || e.toString()));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = [
      '=== Barakah Fleet Personnel Account ===',
      `Name: ${form.full_name}`,
      `Category: ${form.category === 'dispatch_rider' ? 'Dispatch Rider' : 'Vehicle Driver'}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Password: ${form.password}`,
      `Vehicle: ${form.vehicle_color} ${form.vehicle_make} (${form.vehicle_type})`,
      `Plate: ${form.plate_number || 'N/A'}`,
      `Login: https://barakahdevcentre.com/auth`,
      '======================================',
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Personnel credentials copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  /* ─── Success Screen ─── */
  if (done) {
    const isRider = form.category === 'dispatch_rider';
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className={`rounded-2xl border ${isRider ? 'border-amber-500/30 shadow-amber-500/10' : 'border-blue-500/30 shadow-blue-500/10'} bg-[#0a0f1c] p-8 space-y-6 shadow-2xl text-center`}>
            <div className={`h-20 w-20 rounded-full ${isRider ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'} border-2 flex items-center justify-center mx-auto`}>
              <CheckCircle2 className={`h-10 w-10 ${isRider ? 'text-amber-400' : 'text-blue-400'}`} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Personnel Onboarded!</h2>
              <p className="text-slate-400 text-sm mt-2">
                <span className="text-white font-semibold">{form.full_name}</span> is now active as a{' '}
                <span className={`font-semibold ${isRider ? 'text-amber-400' : 'text-blue-400'}`}>
                  {isRider ? 'Dispatch Rider' : 'Vehicle Driver'}
                </span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-left text-xs">
              {[
                { label: 'Name', value: form.full_name },
                { label: 'Email', value: form.email },
                { label: 'Phone', value: form.phone },
                { label: 'Vehicle', value: `${form.vehicle_color} ${form.vehicle_make || form.vehicle_type}` },
                { label: 'Plate No.', value: form.plate_number || 'Not provided' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 pb-1.5 border-b border-slate-800 last:border-0 last:pb-0">
                  <span className="font-bold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
                  <span className="font-mono text-slate-200 text-right truncate">{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button onClick={handleCopyCredentials} className={`w-full font-bold gap-2 ${isRider ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {copied ? <><Check className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />Copy Credentials</>}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5"
                  onClick={() => {
                    setForm({ full_name: '', email: '', phone: '', password: '', category: 'driver', vehicle_type: 'Sedan', vehicle_make: '', plate_number: '', vehicle_color: 'Silver' });
                    setDone(false);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add Another
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white text-xs"
                  onClick={() => navigate({ to: '/admin/riders' as any })}
                >
                  Fleet Directory
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-xl">
                <Truck className="h-6 w-6 text-orange-400" />
              </div>
              Onboard Fleet Personnel
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Add a new Dispatch Rider or Vehicle Driver with complete vehicle credentials
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-6">
          {/* Section 1: Role Category */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Fleet Category <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleCategorySelect('driver')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all ${
                  form.category === 'driver'
                    ? 'bg-blue-500/15 border-blue-500 text-white shadow-md shadow-blue-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-blue-500/20 w-fit text-blue-400">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Vehicle Driver</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Passenger rides & fleet vehicle hires
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategorySelect('dispatch_rider')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all ${
                  form.category === 'dispatch_rider'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-amber-500/20 w-fit text-amber-400">
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Dispatch Rider</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Express parcel & package courier
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Personal Details */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Personnel Contact & Account
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Full Name <span className="text-red-400">*</span></label>
                <Input
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Ibrahim Aliyu"
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Email Address <span className="text-red-400">*</span></label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="driver@swiftmove.com"
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Phone Number <span className="text-red-400">*</span></label>
                <Input
                  required
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="080XXXXXXXX"
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Temporary Password <span className="text-red-400">*</span></label>
                  <button
                    type="button"
                    onClick={() => {
                      const p = generatePassword();
                      setForm(prev => ({ ...prev, password: p }));
                      setShowPass(true);
                      toast.info('Password auto-generated!');
                    }}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Auto-Generate
                  </button>
                </div>
                <div className="relative mt-1">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="bg-slate-900 border-slate-700 h-10 pr-11 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Vehicle Credentials (shown to customer) */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-400" />
                2. Vehicle Credentials (Shown to Customer on Order)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                These vehicle specs will be displayed directly to passengers and parcel senders when assigned.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vehicle Type */}
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Car / Vehicle Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.vehicle_type}
                  onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                  className="mt-1 w-full h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {form.category === 'driver' ? (
                    <>
                      <option value="Sedan">Sedan (Standard 4 Seats)</option>
                      <option value="SUV">SUV (High Clearance / 4WD)</option>
                      <option value="Luxury Sedan">Luxury Sedan (Chauffeur / VIP)</option>
                      <option value="Minivan / XL">Minivan / XL (7 Seats)</option>
                      <option value="Executive Van">Executive Van / Bus</option>
                    </>
                  ) : (
                    <>
                      <option value="Motorcycle">Motorcycle (Express Dispatch)</option>
                      <option value="Delivery Bike">Delivery Bike (Rear Box)</option>
                      <option value="Tricycle / Keke">Tricycle / Keke Cargo</option>
                    </>
                  )}
                </select>
              </div>

              {/* Car Make & Model */}
              <div>
                <label className="text-xs font-medium text-slate-300">
                  {form.category === 'driver' ? 'Car Make & Model' : 'Bike Make & Model'} <span className="text-red-400">*</span>
                </label>
                <Input
                  required
                  value={form.vehicle_make}
                  onChange={e => setForm({ ...form, vehicle_make: e.target.value })}
                  placeholder={form.category === 'driver' ? 'e.g. Toyota Corolla (2020)' : 'e.g. Bajaj Boxer 150'}
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-sm"
                />
              </div>

              {/* License Plate Number */}
              <div>
                <label className="text-xs font-medium text-slate-300">
                  License Plate Number <span className="text-red-400">*</span>
                </label>
                <div className="relative mt-1">
                  <Input
                    required
                    value={form.plate_number}
                    onChange={e => setForm({ ...form, plate_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. JOS-824-PL"
                    className="bg-slate-900 border-slate-700 h-10 text-sm font-mono uppercase tracking-wider pl-8"
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs">🇳🇬</span>
                </div>
              </div>

              {/* Car Colour */}
              <div>
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Vehicle Colour <span className="text-red-400">*</span></span>
                  <span className="text-[10px] text-slate-400">{form.vehicle_color}</span>
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    required
                    value={form.vehicle_color}
                    onChange={e => setForm({ ...form, vehicle_color: e.target.value })}
                    placeholder="e.g. Silver, Black, White"
                    className="bg-slate-900 border-slate-700 h-10 text-sm flex-1"
                  />
                </div>
                {/* Colour Quick Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {['Silver', 'Midnight Black', 'Pearl White', 'Navy Blue', 'Wine Red', 'Space Grey'].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm({ ...form, vehicle_color: col })}
                      className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                        form.vehicle_color === col
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview of Customer Card */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Customer View Preview:
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-white font-semibold">
                    {form.vehicle_color || 'Colour'} {form.vehicle_make || form.vehicle_type}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    {form.vehicle_type}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-black/50 border border-white/20 font-mono font-bold text-white text-[11px] tracking-wider">
                  {form.plate_number || 'PLATE-NO'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 h-12 font-bold gap-2 text-sm shadow-lg shadow-orange-600/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading
                ? 'Registering Personnel…'
                : `Complete Onboarding (${form.category === 'dispatch_rider' ? 'Dispatch Rider' : 'Vehicle Driver'})`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
