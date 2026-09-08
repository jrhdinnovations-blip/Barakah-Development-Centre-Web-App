import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, ArrowLeft, Loader2, Eye, EyeOff, Briefcase, Building, Mail, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from '@tanstack/react-router';
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

function AddStaffPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [availableDomains] = useState<CompanyDomain[]>(() => getCompanyDomains());
  const [selectedDomain, setSelectedDomain] = useState<string>(() => getPrimaryCompanyDomain());
  const [emailPrefix, setEmailPrefix] = useState('');
  const [isManualPrefix, setIsManualPrefix] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const [form, setForm] = useState({ full_name: '', phone: '', department: '', designation: '', branch: '', employee_id: '', password: '' });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrefix.trim() || !form.password) { toast.error('Email and password are required.'); return; }
    setLoading(true);
    try {
      const res = await createStaffAdmin({
        data: {
          email: fullCorporateEmail,
          password: form.password,
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

      if (res.userId) {
        saveStaffMailbox({
          id: `box-${Date.now()}`,
          userId: res.userId,
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
      toast.success(`Staff member ${form.full_name} onboarded with official email ${fullCorporateEmail}!`);
      navigate({ to: '/admin/emails' as any });
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
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/staff' as any })} className="text-slate-400 hover:text-white">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <Input value={form.full_name} onChange={e => handleFullNameChange(e.target.value)} placeholder="e.g. Ibrahim Musa" className="mt-1.5 bg-slate-900 border-slate-700 h-11" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
              <Input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="e.g. BDC-001" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
            </div>
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
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recovery / Personal Email (Optional)</label>
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
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporary Password <span className="text-red-400">*</span></label>
            <div className="relative mt-1.5">
              <Input type={showPass ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" className="bg-slate-900 border-slate-700 h-11 pr-11" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 h-12 font-bold gap-2 mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {loading ? 'Onboarding…' : 'Add Staff Member'}
          </Button>
        </form>
      </div>
    </div>
  );
}
