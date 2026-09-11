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
  MapPin,
  User,
  Mail,
  Phone,
  Lock,
  IdCard,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createStaffAdmin } from '@/lib/admin.functions';
import {
  getCompanyDomains,
  suggestEmailUsername,
  saveStaffMailbox,
  getPrimaryCompanyDomain,
  type CompanyDomain,
} from '@/lib/company-email-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { requireAdminRouteAccess } from '@/lib/admin-auth';

export const Route = createFileRoute('/_authenticated/admin/staff/add')({
  ssr: false,
  beforeLoad: async () => {
    await requireAdminRouteAccess();
  },
  head: () => ({
    meta: [
      { title: 'Add Staff Member — Barakah Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AddStaffAdminPage,
});

const DEPARTMENTS = [
  'Administration',
  'Logistics',
  'Finance',
  'HR & People',
  'IT & Technology',
  'Operations',
  'Customer Support',
  'Training & Development',
  'Communications',
  'Legal & Compliance',
];

const DESIGNATIONS = [
  'Director',
  'Manager',
  'Senior Officer',
  'Officer',
  'Coordinator',
  'Analyst',
  'Associate',
  'Executive',
  'Intern',
  'Volunteer Lead',
];

const BRANCHES = [
  'Abuja HQ',
  'Lagos Branch',
  'Kano Branch',
  'Port Harcourt Branch',
  'Ibadan Branch',
  'Kaduna Branch',
  'Enugu Branch',
];

const STAFF_ROLES = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'swift_manager', label: 'Swift Manager' },
  { value: 'swift_dispatcher', label: 'Swift Dispatcher' },
  { value: 'programme_officer', label: 'Programme Officer' },
  { value: 'content_editor', label: 'Content Editor' },
  { value: 'staff', label: 'General Staff' },
];

function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function AddStaffAdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [showPass, setShowPass] = useState(false);
  
  // Corporate Domains & Email Generator
  const [availableDomains] = useState<CompanyDomain[]>(() => getCompanyDomains());
  const [selectedDomain, setSelectedDomain] = useState<string>(() => getPrimaryCompanyDomain());
  const [emailPrefix, setEmailPrefix] = useState('');
  const [isManualPrefix, setIsManualPrefix] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    department: '',
    designation: '',
    branch: '',
    employee_id: '',
    role: 'staff',
    password: '',
  });

  const fullCorporateEmail = emailPrefix.trim()
    ? `${emailPrefix.trim().toLowerCase()}@${selectedDomain}`
    : '';

  const handleFullNameChange = (name: string) => {
    setForm((prev) => ({ ...prev, full_name: name }));
    if (!isManualPrefix) {
      const suggested = suggestEmailUsername(name);
      setEmailPrefix(suggested);
    }
  };

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrefix.trim() || !form.password) {
      toast.error('Company email prefix and password are required.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await createStaffAdmin({
        data: {
          email: fullCorporateEmail,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone || null,
          recovery_email: recoveryEmail || null,
          role: form.role,
          department: form.department || null,
          designation: form.designation || null,
          branch: form.branch || null,
          employee_id: form.employee_id || null,
        },
      });

      const newUserId = res.userId;

      if (newUserId) {
        // Record staff mailbox in company email service
        saveStaffMailbox({
          id: `box-${Date.now()}`,
          userId: newUserId,
          fullName: form.full_name,
          email: fullCorporateEmail,
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
        `${form.full_name || fullCorporateEmail} has been onboarded with official email ${fullCorporateEmail}!`
      );
      setDone(true);
    } catch (e: any) {
      toast.error('Failed: ' + (e.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    const creds = `=== Barakah Staff Corporate Account ===\nEmployee: ${form.full_name}\nOfficial Email: ${fullCorporateEmail}\nInitial Password: ${form.password}\nDepartment: ${form.department || 'General'}\nWebmail Access: https://mail.google.com\n======================================`;
    navigator.clipboard.writeText(creds);
    setCopiedCredentials(true);
    toast.success('Corporate account credentials copied to clipboard!');
    setTimeout(() => setCopiedCredentials(false), 3000);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6">
        <div className="bg-[#0a0f1c] border border-emerald-500/30 rounded-2xl p-8 space-y-6 max-w-md w-full shadow-2xl shadow-emerald-500/10">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-white">Corporate Mailbox Provisioned!</h2>
            <p className="text-slate-400 text-sm">
              Official company account for <span className="text-white font-semibold">{form.full_name}</span> is active.
            </p>
          </div>

          {/* Credentials Sheet */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Company Email</span>
              <span className="font-mono text-emerald-400 font-semibold">{fullCorporateEmail}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Temporary Password</span>
              <span className="font-mono text-slate-200">{form.password}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Webmail Portal</span>
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:underline flex items-center gap-1"
              >
                <span>mail.google.com</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {recoveryEmail && (
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase tracking-wider">Recovery Email</span>
                <span className="text-slate-300">{recoveryEmail}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleCopyCredentials}
              className="w-full bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold"
            >
              {copiedCredentials ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Onboarding Credentials
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                setForm({
                  full_name: '',
                  phone: '',
                  department: '',
                  designation: '',
                  branch: '',
                  employee_id: '',
                  role: 'staff',
                  password: '',
                });
                setEmailPrefix('');
                setIsManualPrefix(false);
                setRecoveryEmail('');
                setDone(false);
              }}
              className="w-full bg-teal-600 hover:bg-teal-500 gap-2 font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Add Another Staff
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate({ to: '/admin/emails' as any })}
                className="flex-1 border-slate-700 text-slate-300 hover:text-white text-xs"
              >
                Company Emails
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: '/admin/staff' as any })}
                className="flex-1 border-slate-700 text-slate-300 hover:text-white text-xs"
              >
                Staff Directory
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] p-6">
      <div className="max-w-2xl mx-auto space-y-7">
        {/* Back + header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: '/admin/staff' as any })}
            className="text-slate-400 hover:text-white shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20">
                <UserPlus className="h-6 w-6 text-teal-400" />
              </div>
              Add Staff Member
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Onboard a new employee to Barakah Development Centre.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon={User} required>
                <Input
                  value={form.full_name}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  placeholder="e.g. Ibrahim Musa"
                  className="bg-slate-900 border-slate-700 h-11"
                  required
                />
              </Field>
              <Field label="Employee ID" icon={IdCard}>
                <Input
                  value={form.employee_id}
                  onChange={(e) => set('employee_id')(e.target.value)}
                  placeholder="e.g. BDC-001"
                  className="bg-slate-900 border-slate-700 h-11"
                />
              </Field>
            </div>

            {/* Corporate Email Generator */}
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-teal-400 uppercase tracking-wider">
                  <Mail className="h-3.5 w-3.5" />
                  Official Company Email <span className="text-red-400">*</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Recovery / Personal Email (Optional)" icon={Mail}>
                <Input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="personal@gmail.com"
                  className="bg-slate-900 border-slate-700 h-11"
                />
              </Field>
              <Field label="Phone Number" icon={Phone}>
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  placeholder="080XXXXXXXX"
                  className="bg-slate-900 border-slate-700 h-11"
                />
              </Field>
            </div>
          </section>

          {/* Role & Organisation */}
          <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
            <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Role &amp; Organisation
            </h2>
            <Field label="Staff Role" icon={Briefcase} required>
              <Select value={form.role} onValueChange={set('role')}>
                <SelectTrigger className="bg-slate-900 border-slate-700 h-11">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Department" icon={Building}>
                <Select value={form.department} onValueChange={set('department')}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 h-11">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Designation" icon={Briefcase}>
                <Select value={form.designation} onValueChange={set('designation')}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 h-11">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {DESIGNATIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Branch" icon={MapPin}>
                <Select value={form.branch} onValueChange={set('branch')}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 h-11">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {BRANCHES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          {/* Login Credentials */}
          <section className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Login Credentials
              </h2>
              <button
                type="button"
                onClick={() => {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
                  let r = '';
                  for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
                  const pass = `Staff@${r}`;
                  set('password')(pass);
                  setShowPass(true);
                  toast.info('Temporary password auto-generated!');
                }}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="h-3 w-3" /> Auto-Generate
              </button>
            </div>
            <Field label="Temporary Password" icon={Lock} required>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => set('password')(e.target.value)}
                  placeholder="Min 8 characters"
                  className="bg-slate-900 border-slate-700 h-11 pr-11 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[
                    ['Length ≥ 8', form.password.length >= 8],
                    ['Has uppercase', /[A-Z]/.test(form.password)],
                    ['Has number', /\d/.test(form.password)],
                  ].map(([hint, ok]) => (
                    <span
                      key={hint as string}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        ok
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {ok ? '✓' : '○'} {hint}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                The staff member should change this password after their first login.
              </p>
            </Field>
          </section>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-500 h-12 font-bold gap-2 text-base rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {loading ? 'Onboarding Staff Member…' : 'Add Staff Member'}
          </Button>
        </form>
      </div>
    </div>
  );
}
