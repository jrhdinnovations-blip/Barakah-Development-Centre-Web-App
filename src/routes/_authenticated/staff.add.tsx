import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  UserPlus,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Briefcase,
  Building,
  Mail,
  Sparkles,
  ShieldCheck,
  Globe,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createStaffAdmin } from '@/lib/admin.functions';
import {
  getCompanyDomains,
  suggestEmailUsername,
  saveStaffMailbox,
  getPrimaryCompanyDomain,
  type CompanyDomain,
} from '@/lib/company-email-service';

export const Route = createFileRoute('/_authenticated/staff/add')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      const role = roleData?.role ?? user.user_metadata?.['role'] ?? 'registered_user';
      if (role !== 'administrator' && role !== 'swift_manager') throw redirect({ to: '/my-swift-move' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: AddStaffPage,
});

const DEPARTMENTS = ['Administration', 'Logistics', 'Finance', 'HR & People', 'IT & Technology', 'Operations', 'Customer Support', 'Training & Development'];
const DESIGNATIONS = ['Manager', 'Senior Officer', 'Officer', 'Coordinator', 'Analyst', 'Associate', 'Executive', 'Director', 'Intern'];
const BRANCHES = ['Abuja HQ', 'Lagos Branch', 'Kano Branch', 'Port Harcourt Branch', 'Ibadan Branch'];

function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
  );
}

function AddStaffPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Mode: 'google' | 'corporate' | 'custom'
  const [accountType, setAccountType] = useState<'google' | 'corporate' | 'custom'>('google');
  const [googleEmail, setGoogleEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  const [availableDomains] = useState<CompanyDomain[]>(() => getCompanyDomains());
  const [selectedDomain, setSelectedDomain] = useState<string>(() => getPrimaryCompanyDomain());
  const [emailPrefix, setEmailPrefix] = useState('');
  const [isManualPrefix, setIsManualPrefix] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const [form, setForm] = useState({ full_name: '', phone: '', department: '', designation: '', branch: '', employee_id: '', password: '' });

  const fullCorporateEmail = emailPrefix.trim()
    ? `${emailPrefix.trim().toLowerCase()}@${selectedDomain}`
    : '';

  const targetEmail =
    accountType === 'google'
      ? googleEmail.trim().toLowerCase()
      : accountType === 'corporate'
      ? fullCorporateEmail
      : customEmail.trim().toLowerCase();

  const handleFullNameChange = (name: string) => {
    setForm((prev) => ({ ...prev, full_name: name }));
    if (!isManualPrefix) {
      const suggested = suggestEmailUsername(name);
      setEmailPrefix(suggested);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Staff full name is required.');
      return;
    }
    if (!targetEmail) {
      toast.error(
        accountType === 'google'
          ? 'Google/Gmail email is required.'
          : accountType === 'corporate'
          ? 'Company email prefix is required.'
          : 'Email address is required.'
      );
      return;
    }
    if (accountType !== 'google') {
      if (!form.password || form.password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await createStaffAdmin({
        data: {
          email: targetEmail,
          password: accountType === 'google' ? undefined : form.password,
          login_method: accountType === 'google' ? 'google' : 'password',
          full_name: form.full_name,
          phone: form.phone || null,
          recovery_email: recoveryEmail || null,
          role: 'staff',
          department: form.department || null,
          designation: form.designation || null,
          branch: form.branch || null,
          employee_id: form.employee_id || null,
        },
      });

      if (res.userId && accountType === 'corporate') {
        saveStaffMailbox({
          id: `box-${Date.now()}`,
          userId: res.userId,
          fullName: form.full_name,
          email: targetEmail,
          domain: selectedDomain,
          username: emailPrefix.trim().toLowerCase(),
          department: form.department || 'General',
          designation: form.designation || 'Staff',
          recoveryEmail: recoveryEmail || undefined,
          status: 'active',
          createdAt: new Date().toISOString(),
          quotaMb: 5000,
        });
      }
      toast.success(
        `Staff member ${form.full_name} onboarded with ${accountType === 'google' ? 'Google Account' : targetEmail}!`
      );
      navigate({ to: '/admin/staff' as any });
    } catch (e: any) {
      toast.error('Failed: ' + (e.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/admin/staff' as any })} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl"><UserPlus className="h-6 w-6 text-emerald-400" /></div>
              Add New Staff
            </h1>
            <p className="text-slate-400 text-sm mt-1">Onboard a new employee to the platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
          {/* Sign-in Method Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Sign-In Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setAccountType('google')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  accountType === 'google'
                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <GoogleIcon className="h-4 w-4" />
                  <span className="text-xs font-bold text-white">Google Account</span>
                </div>
                <p className="text-[11px] text-slate-400">Sign in with Google. No password.</p>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('corporate')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  accountType === 'corporate'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Company Email</span>
                </div>
                <p className="text-[11px] text-slate-400">@barakahdevcentre.com</p>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('custom')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  accountType === 'custom'
                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">Custom Email</span>
                </div>
                <p className="text-[11px] text-slate-400">Any email &amp; password</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
              <Input value={form.full_name} onChange={e => handleFullNameChange(e.target.value)} placeholder="e.g. Ibrahim Musa" className="mt-1.5 bg-slate-900 border-slate-700 h-11" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
              <Input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="e.g. BDC-001" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
            </div>
          </div>

          {/* Email input based on mode */}
          {accountType === 'google' && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
                <GoogleIcon className="h-3.5 w-3.5" />
                Staff Google / Gmail Address *
              </label>
              <Input
                type="email"
                required
                value={googleEmail}
                onChange={e => setGoogleEmail(e.target.value)}
                placeholder="staff@gmail.com"
                className="bg-slate-900 border-slate-700 h-11 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400">
                The staff member can sign in directly using "Continue with Google" at login.
              </p>
            </div>
          )}

          {accountType === 'corporate' && (
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-teal-400 uppercase tracking-wider">
                  <Mail className="h-3.5 w-3.5" />
                  Official Company Email *
                </label>
                {form.full_name && (
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = suggestEmailUsername(form.full_name);
                      setEmailPrefix(suggested);
                      setIsManualPrefix(false);
                      toast.info(`Generated: ${suggested}@${selectedDomain}`);
                    }}
                    className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-format from name
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-7">
                  <Input
                    required
                    value={emailPrefix}
                    onChange={(e) => {
                      setIsManualPrefix(true);
                      setEmailPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                    }}
                    placeholder="e.g. ibrahim.musa"
                    className="bg-slate-900 border-slate-700 h-11 font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-5">
                  <Select value={selectedDomain} onValueChange={(val) => setSelectedDomain(val)}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-11 text-teal-400 font-mono text-xs">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      {availableDomains.map((d) => (
                        <SelectItem key={d.id} value={d.domain} className="font-mono text-xs">
                          @{d.domain} {d.isPrimary && '(Primary)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {fullCorporateEmail && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <Badge variant="outline" className="bg-teal-500/10 text-teal-300 border-teal-500/30 gap-1.5 py-1 px-2.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                    <span>Official Address: <strong className="font-mono text-white">{fullCorporateEmail}</strong></span>
                  </Badge>
                </div>
              )}
            </div>
          )}

          {accountType === 'custom' && (
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
                <Mail className="h-3.5 w-3.5" />
                Staff Email Address *
              </label>
              <Input
                type="email"
                required
                value={customEmail}
                onChange={e => setCustomEmail(e.target.value)}
                placeholder="staff@example.com"
                className="bg-slate-900 border-slate-700 h-11 font-mono text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recovery Email (Optional)</label>
              <Input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} placeholder="personal@gmail.com" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="080XXXXXXXX" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Building className="h-3 w-3" />Department</label>
              <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                <SelectTrigger className="mt-1.5 bg-slate-900 border-slate-700 h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Briefcase className="h-3 w-3" />Designation</label>
              <Select value={form.designation} onValueChange={v => setForm({ ...form, designation: v })}>
                <SelectTrigger className="mt-1.5 bg-slate-900 border-slate-700 h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">{DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Branch</label>
              <Select value={form.branch} onValueChange={v => setForm({ ...form, branch: v })}>
                <SelectTrigger className="mt-1.5 bg-slate-900 border-slate-700 h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {accountType !== 'google' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporary Password *</label>
                <button
                  type="button"
                  onClick={() => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
                    let r = '';
                    for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
                    const pass = `Staff@${r}`;
                    setForm(prev => ({ ...prev, password: pass }));
                    setShowPass(true);
                    toast.info('Temporary password auto-generated!');
                  }}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Auto-Generate
                </button>
              </div>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className="bg-slate-900 border-slate-700 h-11 pr-11" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2.5 text-xs text-blue-300">
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span>Google Account selected — no password needed. User signs in via Google OAuth.</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 h-12 font-bold gap-2 mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : accountType === 'google' ? <GoogleIcon className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? 'Onboarding…' : accountType === 'google' ? 'Add Staff with Google Account' : 'Add Staff Member'}
          </Button>
        </form>
      </div>
    </div>
  );
}
