import { useState, useEffect, useMemo } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Mail,
  Building,
  Plus,
  Search,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Shield,
  ShieldCheck,
  Users,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Server,
  Lock,
  KeyRound,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getCompanyDomains,
  saveCompanyDomains,
  getPrimaryCompanyDomain,
  addCompanyDomain,
  setPrimaryDomain,
  getDnsRecordsForDomain,
  getStaffMailboxes,
  saveStaffMailbox,
  suggestEmailUsername,
  type CompanyDomain,
  type StaffMailbox,
} from '@/lib/company-email-service';

export const Route = createFileRoute('/_authenticated/admin/emails')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = roleData?.role ?? user.user_metadata?.['role'] ?? 'registered_user';
      if (role !== 'administrator' && role !== 'swift_manager') {
        throw redirect({ to: '/my-barakah' });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  head: () => ({
    meta: [
      { title: 'Company Emails & Domains — Barakah Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminCompanyEmailsPage,
});

function AdminCompanyEmailsPage() {
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<'mailboxes' | 'domains' | 'dns'>('mailboxes');
  const [domains, setDomains] = useState<CompanyDomain[]>(() => getCompanyDomains());
  const [mailboxes, setMailboxes] = useState<StaffMailbox[]>(() => getStaffMailboxes());
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [isAddMailboxOpen, setIsAddMailboxOpen] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);

  // New Mailbox Form
  const [newMailboxName, setNewMailboxName] = useState('');
  const [newMailboxPrefix, setNewMailboxPrefix] = useState('');
  const [newMailboxDomain, setNewMailboxDomain] = useState(() => getPrimaryCompanyDomain());
  const [newMailboxDept, setNewMailboxDept] = useState('Operations');
  const [newMailboxRole, setNewMailboxRole] = useState('Staff');
  const [newMailboxPassword, setNewMailboxPassword] = useState('Barakah@' + new Date().getFullYear());
  const [newMailboxRecovery, setNewMailboxRecovery] = useState('');
  const [isSubmittingMailbox, setIsSubmittingMailbox] = useState(false);

  // New Domain Form
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainProvider, setNewDomainProvider] = useState<CompanyDomain['mailProvider']>('google_workspace');
  const [newDomainIsPrimary, setNewDomainIsPrimary] = useState(false);

  // Reload data from storage & profiles on mount
  useEffect(() => {
    const loadedDomains = getCompanyDomains();
    setDomains(loadedDomains);

    // Sync profiles from Supabase to enrich mailboxes
    supabase
      .from('profiles')
      .select('user_id, full_name, email, department, designation')
      .then(({ data }) => {
        if (!data) return;
        const currentSaved = getStaffMailboxes();
        const primaryDom = getPrimaryCompanyDomain();

        // Check for any profiles with company email that aren't recorded yet
        const existingEmails = new Set(currentSaved.map((m) => m.email.toLowerCase()));

        data.forEach((p) => {
          if (p.email && p.email.includes('@')) {
            const dom = p.email.split('@')[1]?.toLowerCase();
            const isMatch = loadedDomains.some((d) => d.domain.toLowerCase() === dom);
            if (isMatch && !existingEmails.has(p.email.toLowerCase())) {
              const username = p.email.split('@')[0] || '';
              const newEntry: StaffMailbox = {
                id: `box-${p.user_id || Date.now()}`,
                userId: p.user_id,
                fullName: p.full_name || username,
                email: p.email,
                domain: dom,
                username,
                department: p.department || 'General',
                designation: p.designation || 'Staff',
                status: 'active',
                createdAt: new Date().toISOString(),
              };
              saveStaffMailbox(newEntry);
            }
          }
        });
        setMailboxes(getStaffMailboxes());
      });
  }, []);

  const primaryDomain = useMemo(() => {
    return domains.find((d) => d.isPrimary) || domains[0];
  }, [domains]);

  // Filtered mailboxes
  const filteredMailboxes = useMemo(() => {
    return mailboxes.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q);

      const matchDept = departmentFilter === 'ALL' || m.department === departmentFilter;
      const matchDomain = domainFilter === 'ALL' || m.domain === domainFilter;

      return matchSearch && matchDept && matchDomain;
    });
  }, [mailboxes, searchQuery, departmentFilter, domainFilter]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set(mailboxes.map((m) => m.department).filter(Boolean));
    return Array.from(set);
  }, [mailboxes]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreateMailbox = async () => {
    if (!newMailboxPrefix.trim() || !newMailboxName.trim()) {
      toast.error('Please enter employee name and email prefix');
      return;
    }

    const fullEmail = `${newMailboxPrefix.trim().toLowerCase()}@${newMailboxDomain}`;
    setIsSubmittingMailbox(true);

    try {
      // 1. Create auth user in Supabase
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: fullEmail,
        password: newMailboxPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newMailboxName,
          role: 'staff',
          department: newMailboxDept,
          designation: newMailboxRole,
          recovery_email: newMailboxRecovery || null,
        },
      });

      const userId = authData?.user?.id;

      if (userId) {
        await supabase.from('profiles').upsert(
          {
            user_id: userId,
            full_name: newMailboxName,
            department: newMailboxDept,
            designation: newMailboxRole,
          } as any,
          { onConflict: 'user_id' }
        );

        await supabase.from('user_roles').upsert(
          { user_id: userId, role: 'staff', status: 'active' },
          { onConflict: 'user_id,role' }
        );
      }

      // 2. Record staff mailbox
      const newMailbox: StaffMailbox = {
        id: `box-${Date.now()}`,
        userId,
        fullName: newMailboxName,
        email: fullEmail,
        domain: newMailboxDomain,
        username: newMailboxPrefix.trim().toLowerCase(),
        department: newMailboxDept,
        designation: newMailboxRole,
        recoveryEmail: newMailboxRecovery || undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      saveStaffMailbox(newMailbox);
      setMailboxes(getStaffMailboxes());

      toast.success(`Created corporate email: ${fullEmail}`);
      setIsAddMailboxOpen(false);

      // Reset
      setNewMailboxName('');
      setNewMailboxPrefix('');
      setNewMailboxRecovery('');
    } catch (err: any) {
      toast.error('Failed to create mailbox: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingMailbox(false);
    }
  };

  const handleAddDomain = () => {
    if (!newDomainName.trim()) {
      toast.error('Please enter a valid domain name');
      return;
    }
    const clean = newDomainName.trim().toLowerCase().replace(/^@+/, '');
    const added = addCompanyDomain(clean, newDomainIsPrimary, newDomainProvider);
    setDomains(getCompanyDomains());
    toast.success(`Domain @${added.domain} added successfully!`);
    setIsAddDomainOpen(false);
    setNewDomainName('');
  };

  const handleSetPrimary = (domId: string) => {
    setPrimaryDomain(domId);
    setDomains(getCompanyDomains());
    toast.success('Primary corporate domain updated');
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-6 lg:p-10 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: '/admin' as any })}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    Company Emails &amp; Domains
                  </h1>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    Provision corporate staff mailboxes on <strong className="text-teal-400">@{primaryDomain?.domain}</strong> and configure mail DNS records.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setIsAddMailboxOpen(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold gap-2 text-xs shadow-lg shadow-teal-600/20"
            >
              <Plus className="h-4 w-4" />
              Create Staff Mailbox
            </Button>
            <Button
              onClick={() => setIsAddDomainOpen(true)}
              variant="outline"
              className="border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white font-medium gap-2 text-xs"
            >
              <Globe className="h-4 w-4 text-teal-400" />
              Add Domain
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0a0f1c] border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Staff Mailboxes</span>
              <Users className="h-4 w-4 text-teal-400" />
            </div>
            <p className="text-3xl font-black text-white">{mailboxes.length}</p>
            <p className="text-[11px] text-teal-400 font-medium">Provisioned corporate accounts</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0f1c] border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Primary Domain</span>
              <Globe className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono truncate">@{primaryDomain?.domain}</p>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active &amp; Verified
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0f1c] border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Domains</span>
              <Server className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-3xl font-black text-white">{domains.length}</p>
            <p className="text-[11px] text-blue-400 font-medium">{domains.map((d) => `@${d.domain}`).join(', ')}</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0f1c] border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Webmail Gateway</span>
              <ExternalLink className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-sm font-black text-white font-mono truncate mt-1">mail.{primaryDomain?.domain}</p>
            <a
              href={primaryDomain?.webmailUrl || `https://mail.${primaryDomain?.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-purple-400 hover:underline inline-flex items-center gap-1"
            >
              Open Webmail Portal <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('mailboxes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'mailboxes'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Staff Mailboxes ({mailboxes.length})
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'domains'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Company Domains ({domains.length})
          </button>
          <button
            onClick={() => setActiveTab('dns')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'dns'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            DNS &amp; MX Setup Guide
          </button>
        </div>

        {/* ═══ TAB 1: STAFF MAILBOXES ═══ */}
        {activeTab === 'mailboxes' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by staff name, email prefix, or department…"
                  className="pl-10 bg-[#0a0f1c] border-slate-800 h-11 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="bg-[#0a0f1c] border-slate-800 h-11 text-xs min-w-[140px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-xs">
                    <SelectItem value="ALL">All Departments</SelectItem>
                    {departmentsList.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="bg-[#0a0f1c] border-slate-800 h-11 text-xs min-w-[130px] font-mono">
                    <SelectValue placeholder="All Domains" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-xs font-mono">
                    <SelectItem value="ALL">All Domains</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.domain}>
                        @{d.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mailboxes Table */}
            <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Official Company Email</th>
                      <th className="p-4">Department &amp; Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredMailboxes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-500">
                          <Mail className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                          <p className="font-semibold text-slate-400">No corporate mailboxes found.</p>
                          <p className="text-xs mt-1">Click "Create Staff Mailbox" to provision an official company email.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredMailboxes.map((box) => (
                        <tr key={box.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center font-bold text-teal-400 text-xs">
                                {box.fullName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <div>
                                <p className="font-bold text-white">{box.fullName}</p>
                                {box.recoveryEmail && (
                                  <p className="text-[10px] text-slate-400">Recovery: {box.recoveryEmail}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="bg-teal-500/10 border-teal-500/30 text-teal-300 font-mono text-xs py-1 px-2.5 gap-1.5"
                              >
                                <ShieldCheck className="h-3 w-3 text-teal-400" />
                                {box.email}
                              </Badge>
                              <button
                                onClick={() => copyToClipboard(box.email, `mail-${box.id}`)}
                                title="Copy email address"
                                className="text-slate-500 hover:text-white p-1 rounded transition-colors"
                              >
                                {copiedKey === `mail-${box.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-slate-300">{box.department}</p>
                            <p className="text-[10px] text-slate-400">{box.designation}</p>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active Mailbox
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const creds = `=== Barakah Staff Account ===\nEmployee: ${box.fullName}\nOfficial Email: ${box.email}\nDepartment: ${box.department}\nWebmail: https://mail.${box.domain}\n============================`;
                                  copyToClipboard(creds, `cred-${box.id}`);
                                }}
                                className="h-8 text-xs text-slate-300 hover:text-white"
                              >
                                {copiedKey === `cred-${box.id}` ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Copied
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Credentials
                                  </span>
                                )}
                              </Button>
                              <a
                                href={`https://mail.${box.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                                title="Open webmail"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: COMPANY DOMAINS ═══ */}
        {activeTab === 'domains' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {domains.map((d) => (
                <div
                  key={d.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    d.isPrimary
                      ? 'bg-teal-950/20 border-teal-500/40 shadow-lg shadow-teal-500/5'
                      : 'bg-[#0a0f1c] border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-white font-mono">@{d.domain}</h3>
                          {d.isPrimary && (
                            <Badge className="bg-teal-500 text-black font-black text-[10px] uppercase">
                              Primary Domain
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Provider: <strong className="text-slate-200 capitalize">{d.mailProvider.replace('_', ' ')}</strong>
                        </p>
                      </div>
                    </div>

                    {!d.isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetPrimary(d.id)}
                        className="text-xs border-slate-700 hover:border-teal-500 hover:text-teal-400"
                      >
                        Make Primary
                      </Button>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Mailboxes on Domain</p>
                      <p className="text-white font-bold mt-0.5">
                        {mailboxes.filter((m) => m.domain === d.domain).length} active
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Webmail URL</p>
                      <a
                        href={d.webmailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 hover:underline truncate block mt-0.5 font-mono text-[11px]"
                      >
                        {d.webmailUrl}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 3: DNS & MX SETUP GUIDE ═══ */}
        {activeTab === 'dns' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-teal-500/5 border border-teal-500/20 flex items-start gap-4">
              <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-400 shrink-0">
                <Server className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">DNS Records for {primaryDomain?.domain}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  To ensure 100% email deliverability and enable staff to receive messages from external services (Gmail, Outlook, banks), publish these DNS records at your domain registrar (e.g. Cloudflare, Namecheap, GoDaddy, Whogohost).
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Type</th>
                      <th className="p-4">Host / Name</th>
                      <th className="p-4">Record Value / Target</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4 text-right">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {getDnsRecordsForDomain(primaryDomain?.domain || 'barakah.ng', primaryDomain?.mailProvider || 'google_workspace').map((rec, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="p-4">
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 font-bold">
                            {rec.type}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-300">{rec.host}</td>
                        <td className="p-4 text-teal-300 max-w-md truncate">{rec.value}</td>
                        <td className="p-4 text-slate-400">{rec.priority ?? '—'}</td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(rec.value, `dns-${i}`)}
                            className="h-7 text-xs text-slate-400 hover:text-white"
                          >
                            {copiedKey === `dns-${i}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODAL: CREATE STAFF MAILBOX ═══ */}
      <Dialog open={isAddMailboxOpen} onOpenChange={setIsAddMailboxOpen}>
        <DialogContent className="bg-[#0a0f1c] border-slate-800 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-teal-400" />
              Create Corporate Staff Mailbox
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Provision an official company email account for a team member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Staff Full Name *</label>
              <Input
                value={newMailboxName}
                onChange={(e) => {
                  setNewMailboxName(e.target.value);
                  setNewMailboxPrefix(suggestEmailUsername(e.target.value));
                }}
                placeholder="e.g. Fatima Zara Bello"
                className="mt-1 bg-slate-900 border-slate-700 h-10 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Company Email *</label>
              <div className="grid grid-cols-12 gap-2 mt-1">
                <div className="col-span-7">
                  <Input
                    value={newMailboxPrefix}
                    onChange={(e) => setNewMailboxPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="e.g. fatima.bello"
                    className="bg-slate-900 border-slate-700 h-10 font-mono text-xs"
                  />
                </div>
                <div className="col-span-5">
                  <Select value={newMailboxDomain} onValueChange={setNewMailboxDomain}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-10 font-mono text-xs text-teal-400">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 font-mono text-xs">
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.domain}>
                          @{d.domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newMailboxPrefix && (
                <p className="text-[11px] text-teal-400 font-mono mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Address: {newMailboxPrefix.toLowerCase()}@{newMailboxDomain}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-400 uppercase text-[10px]">Department</label>
                <Input
                  value={newMailboxDept}
                  onChange={(e) => setNewMailboxDept(e.target.value)}
                  placeholder="e.g. Finance"
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-400 uppercase text-[10px]">Designation</label>
                <Input
                  value={newMailboxRole}
                  onChange={(e) => setNewMailboxRole(e.target.value)}
                  placeholder="e.g. Senior Officer"
                  className="mt-1 bg-slate-900 border-slate-700 h-10 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Initial Password</label>
              <Input
                value={newMailboxPassword}
                onChange={(e) => setNewMailboxPassword(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 h-10 font-mono text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Recovery / Personal Email</label>
              <Input
                type="email"
                value={newMailboxRecovery}
                onChange={(e) => setNewMailboxRecovery(e.target.value)}
                placeholder="personal@gmail.com"
                className="mt-1 bg-slate-900 border-slate-700 h-10 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddMailboxOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMailbox}
              disabled={isSubmittingMailbox}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
            >
              {isSubmittingMailbox ? 'Creating…' : 'Provision Mailbox'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL: ADD COMPANY DOMAIN ═══ */}
      <Dialog open={isAddDomainOpen} onOpenChange={setIsAddDomainOpen}>
        <DialogContent className="bg-[#0a0f1c] border-slate-800 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-400" />
              Add Corporate Email Domain
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Attach a new email domain for Barakah staff mailboxes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Domain Name *</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-3 text-slate-500 font-mono">@</span>
                <Input
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="barakahcentre.org"
                  className="pl-7 bg-slate-900 border-slate-700 h-10 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px]">Mail Hosting Provider</label>
              <Select
                value={newDomainProvider}
                onValueChange={(val: any) => setNewDomainProvider(val)}
              >
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 h-10 text-xs">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-xs">
                  <SelectItem value="google_workspace">Google Workspace</SelectItem>
                  <SelectItem value="microsoft_365">Microsoft 365 / Outlook</SelectItem>
                  <SelectItem value="zoho">Zoho Mail</SelectItem>
                  <SelectItem value="custom_cpanel">Custom Server / cPanel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="makePrimaryCheckbox"
                checked={newDomainIsPrimary}
                onChange={(e) => setNewDomainIsPrimary(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500/20"
              />
              <label htmlFor="makePrimaryCheckbox" className="text-xs text-slate-300 font-medium cursor-pointer">
                Set as primary domain for new staff emails
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddDomainOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button onClick={handleAddDomain} className="bg-teal-600 hover:bg-teal-500 text-white font-bold">
              Add Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
