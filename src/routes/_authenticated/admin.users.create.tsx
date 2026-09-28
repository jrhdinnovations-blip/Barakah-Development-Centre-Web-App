import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  UserPlus, ArrowLeft, Loader2, Eye, EyeOff, User, Mail, Phone,
  Shield, Truck, Radio, Sparkles, CheckCircle2, Copy, Check, Lock,
  ChevronRight, Star, MapPin,
} from 'lucide-react';
import { createUserAdmin } from '@/lib/admin.functions';
import { requireAdminRouteAccess } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_authenticated/admin/users/create')({
  ssr: false,
  beforeLoad: async () => {
    await requireAdminRouteAccess();
  },
  head: () => ({
    meta: [
      { title: 'Create User — Barakah Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: CreateUserPage,
});

interface RoleItem {
  value: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  bg: string;
  activeBorder: string;
  activeBg: string;
  shadow: string;
}

const DEFAULT_ROLE: RoleItem = {
  value: 'registered_user',
  label: 'Customer / User',
  description: 'Standard platform account for purchasing services',
  icon: User,
  color: 'text-blue-400',
  bg: 'bg-blue-500/10',
  activeBorder: 'border-blue-500',
  activeBg: 'bg-blue-500/15',
  shadow: 'shadow-blue-500/10',
};

const ROLES: RoleItem[] = [
  DEFAULT_ROLE,
  {
    value: 'driver',
    label: 'Rider / Driver',
    description: 'Fleet personnel for dispatch & vehicle hire',
    icon: Truck,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500',
    activeBg: 'bg-orange-500/15',
    shadow: 'shadow-orange-500/10',
  },
  {
    value: 'swift_dispatcher',
    label: 'Dispatcher',
    description: 'Manages and assigns delivery orders to fleet',
    icon: Radio,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    activeBorder: 'border-cyan-500',
    activeBg: 'bg-cyan-500/15',
    shadow: 'shadow-cyan-500/10',
  },
  {
    value: 'swift_manager',
    label: 'Swift Manager',
    description: 'Oversees logistics operations and dispatchers',
    icon: Star,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    activeBorder: 'border-emerald-500',
    activeBg: 'bg-emerald-500/15',
    shadow: 'shadow-emerald-500/10',
  },
  {
    value: 'administrator',
    label: 'Administrator',
    description: 'Full system access including admin panel',
    icon: Shield,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    activeBorder: 'border-purple-500',
    activeBg: 'bg-purple-500/15',
    shadow: 'shadow-purple-500/10',
  },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let r = '';
  for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return `Bk@${r}`;
}

function CreateUserPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'google' | 'password'>('google');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    role: 'registered_user',
    password: '',
  });

  const selectedRole: RoleItem = ROLES.find(r => r.value === form.role) ?? DEFAULT_ROLE;

  const handleAutoPassword = () => {
    const pass = generatePassword();
    setForm(prev => ({ ...prev, password: pass }));
    setShowPass(true);
    toast.info('Auto-generated a secure password!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || (loginMethod === 'password' && !form.password)) {
      toast.error('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      await createUserAdmin({
        data: {
          email: form.email.trim().toLowerCase(),
          password: loginMethod === 'google' ? undefined : form.password,
          login_method: loginMethod,
          full_name: form.full_name,
          phone: form.phone || undefined,
          role: form.role as any,
        },
      });
      setDone(true);
    } catch (e: any) {
      toast.error('Failed: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://barakahdevcentre.com';
    let text = '';
    if (loginMethod === 'google') {
      text = [
        '=== Barakah Platform Account (Google Account) ===',
        `Name: ${form.full_name || '—'}`,
        `Email: ${form.email}`,
        `Role: ${selectedRole.label}`,
        `Login URL: ${origin}/auth`,
        'Instructions: Click "Continue with Google" with this email to access your account directly.',
        '================================================',
      ].join('\n');
    } else {
      text = [
        '=== Platform Account ===',
        `Name: ${form.full_name || '—'}`,
        `Email: ${form.email}`,
        `Role: ${selectedRole.label}`,
        `Password: ${form.password}`,
        `Login URL: ${origin}/auth`,
        '================================',
      ].join('\n');
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  /* ─── Success Screen ─── */
  if (done) {
    const RoleIcon = selectedRole.icon;
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-emerald-500/30 bg-[#0a0f1c] p-8 space-y-6 shadow-2xl shadow-emerald-500/10 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">User Created!</h2>
              <p className="text-slate-400 text-sm mt-2">
                <span className="text-white font-semibold">{form.full_name || form.email}</span> has been registered as a{' '}
                <span className={`font-semibold ${selectedRole.color}`}>{selectedRole.label}</span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-left text-xs">
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Login Method</span>
                <span className="font-semibold text-emerald-400">
                  {loginMethod === 'google' ? 'Google OAuth (Sign in with Google)' : 'Email & Password'}
                </span>
              </div>
              {[
                { label: 'Name', value: form.full_name || '—' },
                { label: 'Email', value: form.email },
                { label: 'Role', value: selectedRole.label },
                { label: 'Phone', value: form.phone || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800 last:border-0 last:pb-0">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                  <span className={`font-mono truncate max-w-[200px] ${label === 'Role' ? selectedRole.color : 'text-slate-200'}`}>{value}</span>
                </div>
              ))}
              {loginMethod !== 'google' && form.password && (
                <div className="flex items-center justify-between gap-4 pt-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Password</span>
                  <span className="font-mono text-slate-200">{form.password}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button onClick={handleCopyCredentials} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
                {copied ? <><Check className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />{loginMethod === 'google' ? 'Copy Sign-In Instructions' : 'Copy Login Credentials'}</>}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5"
                  onClick={() => { setForm({ full_name: '', email: '', phone: '', location: '', role: 'registered_user', password: '' }); setStep(1); setDone(false); }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add Another
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white text-xs"
                  onClick={() => navigate({ to: '/admin/users' as any })}
                >
                  View All Users
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step === 1 ? navigate({ to: '/admin/users' as any }) : setStep(1)}
            className="text-slate-400 hover:text-white h-10 w-10 rounded-xl border border-slate-800 bg-slate-900/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <UserPlus className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Create User Account</h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  {step === 1 ? 'Step 1 of 2 — Identity & Role' : 'Step 2 of 2 — Login Credentials'}
                </p>
              </div>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {([1, 2] as const).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{s}</div>
                {s < 2 && <ChevronRight className="h-3 w-3 text-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 rounded-full bg-slate-800">
          <div className={`h-1 rounded-full bg-blue-500 transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
        </div>

        {/* Step 1: Identity & Role */}
        {step === 1 && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    <User className="h-3 w-3" /> Full Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="e.g. Amina Bello"
                    className="bg-slate-900 border-slate-700 h-11"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    <Phone className="h-3 w-3" /> Phone Number
                  </label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="080XXXXXXXX"
                    className="bg-slate-900 border-slate-700 h-11"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    <MapPin className="h-3 w-3" /> City / Location
                  </label>
                  <Input
                    value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Abuja, FCT"
                    className="bg-slate-900 border-slate-700 h-11"
                  />
                </div>
              </div>
            </section>

            {/* Role Picker */}
            <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-4">
              <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Assign Platform Role
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(role => {
                  const Icon = role.icon;
                  const isActive = form.role === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, role: role.value }))}
                      className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        isActive
                          ? `${role.activeBg} ${role.activeBorder} shadow-md ${role.shadow}`
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${role.bg} shrink-0`}>
                        <Icon className={`h-4 w-4 ${role.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-300'}`}>{role.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{role.description}</p>
                      </div>
                      {isActive && (
                        <div className={`shrink-0 h-5 w-5 rounded-full ${role.bg} border ${role.activeBorder} flex items-center justify-center`}>
                          <Check className={`h-3 w-3 ${role.color}`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className={`p-3 rounded-xl ${selectedRole.bg} border ${selectedRole.activeBorder} text-xs flex items-center gap-2`}>
                <selectedRole.icon className={`h-3.5 w-3.5 ${selectedRole.color} shrink-0`} />
                <span>
                  <span className={`font-bold ${selectedRole.color}`}>{selectedRole.label}</span>
                  <span className="text-slate-400"> — {selectedRole.description}</span>
                </span>
              </div>
            </section>

            <Button
              onClick={() => {
                if (!form.full_name.trim()) { toast.error('Please enter the user\'s full name.'); return; }
                setStep(2);
              }}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 font-bold gap-2 text-base rounded-xl"
            >
              Continue to Credentials <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Credentials */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role preview */}
            <div className={`p-4 rounded-xl ${selectedRole.activeBg} border ${selectedRole.activeBorder} flex items-center gap-3`}>
              <div className={`p-2 rounded-lg ${selectedRole.bg}`}>
                <selectedRole.icon className={`h-5 w-5 ${selectedRole.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{form.full_name || 'New User'}</p>
                <p className={`text-xs ${selectedRole.color}`}>{selectedRole.label} Account</p>
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                Edit
              </button>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" /> Authentication Method
                </h2>
              </div>

              {/* Login Method Tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLoginMethod('google')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    loginMethod === 'google'
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Google Account</span>
                  </div>
                  <p className="text-[11px] text-slate-400">OAuth login. No password needed.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setLoginMethod('password')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    loginMethod === 'password'
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Password Account</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Email &amp; temporary password.</p>
                </button>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  <Mail className="h-3 w-3" /> {loginMethod === 'google' ? 'Google / Gmail Address' : 'Email Address'} <span className="text-red-400">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder={loginMethod === 'google' ? 'user@gmail.com' : 'user@example.com'}
                  className="bg-slate-900 border-slate-700 h-11"
                  autoFocus
                />
              </div>

              {loginMethod === 'google' ? (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
                  ✓ User will sign in via <strong>"Continue with Google"</strong>. No temporary password needed.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <Lock className="h-3 w-3" /> Temporary Password <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoPassword}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      className="bg-slate-900 border-slate-700 h-11 pr-11 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {[
                        ['Length ≥ 6', form.password.length >= 6],
                        ['Has uppercase', /[A-Z]/.test(form.password)],
                        ['Has number', /\d/.test(form.password)],
                      ].map(([hint, ok]) => (
                        <span key={hint as string} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                          {ok ? '✓' : '○'} {hint}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    The user must change this password after first login.
                  </p>
                </div>
              )}
            </section>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="h-12 border-slate-700 text-slate-300 hover:text-white gap-2 px-6 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                type="submit"
                disabled={loading || !form.email || (loginMethod === 'password' && form.password.length < 6)}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 font-bold gap-2 text-base rounded-xl disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {loading ? 'Creating Account…' : loginMethod === 'google' ? 'Create User with Google Account' : 'Create User Account'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
