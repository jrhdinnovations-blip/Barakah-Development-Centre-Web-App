import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Building,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Loader2,
  Filter,
  RefreshCw,
  Wifi,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { isCorporateEmail } from '@/lib/company-email-service';
import { getStaffMembersAdmin } from '@/lib/admin.functions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/_authenticated/admin/staff/')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const roles = (rolesData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'] as string | undefined;
      if (metaRole) roles.push(metaRole);
      const isAdmin = roles.includes('administrator') || roles.includes('swift_manager');
      if (!isAdmin) throw redirect({ to: '/my-barakah' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  head: () => ({
    meta: [
      { title: 'Staff Directory — Barakah Admin' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: StaffDirectoryPage,
});

// Staff roles shown in this directory
const STAFF_ROLES = [
  'administrator',
  'programme_officer',
  'content_editor',
  'swift_dispatcher',
  'swift_manager',
  'staff',
];

const ROLE_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  administrator: {
    label: 'Administrator',
    color: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    dotColor: 'bg-purple-400',
  },
  swift_manager: {
    label: 'Swift Manager',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
  },
  swift_dispatcher: {
    label: 'Dispatcher',
    color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
  },
  programme_officer: {
    label: 'Programme Officer',
    color: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    dotColor: 'bg-blue-400',
  },
  content_editor: {
    label: 'Content Editor',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
  staff: {
    label: 'Staff',
    color: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    dotColor: 'bg-teal-400',
  },
};

interface StaffMember {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  branch: string | null;
  role: string;
  created_at: string;
  status: string;
}

function getInitials(name: string | null): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StaffDirectoryPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const navigate = useNavigate();

  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const fetchStaff = useCallback(async () => {
    try {
      const staffList = await getStaffMembersAdmin();
      setStaff(staffList as StaffMember[]);
    } catch (e: any) {
      toast.error('Failed to load staff: ' + (e.message ?? String(e)));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Store fetchStaff in ref so the channel listener always calls the latest version
  useEffect(() => {
    fetchRef.current = fetchStaff;
  }, [fetchStaff]);

  useEffect(() => {
    fetchStaff();

    const channelName = `admin-staff-directory-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchRef.current?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchRef.current?.();
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    const interval = setInterval(() => {
      fetchRef.current?.();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchStaff]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStaff();
  };

  // Derive unique departments for filter
  const departments = Array.from(
    new Set(staff.map((s) => s.department).filter(Boolean))
  ) as string[];

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.department?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || s.role === roleFilter;
    const matchDept = deptFilter === 'all' || s.department === deptFilter;
    return matchSearch && matchRole && matchDept;
  });

  const stats = [
    {
      label: 'Total Staff',
      value: staff.length,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/20',
      icon: Users,
    },
    {
      label: 'Administrators',
      value: staff.filter((s) => s.role === 'administrator').length,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      icon: Shield,
    },
    {
      label: 'Departments',
      value: departments.length,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      icon: Building,
    },
    {
      label: 'Active',
      value: staff.filter((s) => s.status === 'active').length,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: Briefcase,
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      <div className="p-6 lg:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <div className="p-2.5 bg-teal-500/10 rounded-2xl border border-teal-500/20">
                <Users className="h-7 w-7 text-teal-400" />
              </div>
              Staff Directory
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              All organisation staff members, roles, departments and branches.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isLive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              <Wifi className="h-3 w-3" />
              {isLive ? 'Live' : 'Connecting…'}
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
            </Button>
            <Button
              onClick={() => navigate({ to: '/admin/emails' as any })}
              variant="outline"
              className="bg-slate-900 border-slate-700 text-teal-400 hover:text-white hover:border-teal-500 gap-2 h-10 font-semibold"
            >
              <Mail className="h-4 w-4" />
              Company Emails
            </Button>
            <Button
              onClick={() => navigate({ to: '/admin/staff/add' as any })}
              className="bg-teal-600 hover:bg-teal-500 gap-2 h-10 font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border ${s.bg} p-5 flex items-center gap-4`}
            >
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone or department…"
              className="pl-9 bg-slate-900 border-slate-800 h-10 text-slate-200"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 h-10">
              <Filter className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="administrator">Administrator</SelectItem>
              <SelectItem value="swift_manager">Swift Manager</SelectItem>
              <SelectItem value="swift_dispatcher">Dispatcher</SelectItem>
              <SelectItem value="programme_officer">Programme Officer</SelectItem>
              <SelectItem value="content_editor">Content Editor</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 h-10">
                <Building className="h-4 w-4 mr-2 text-slate-500" />
                <SelectValue placeholder="Filter by dept" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Staff List */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-400" />
              Organisation Staff
            </h3>
            <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300">
              {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
            </Badge>
          </div>

          {loading ? (
            <div className="p-16 flex items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
              <p className="text-slate-400">Loading staff directory…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                <Users className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">
                {search || roleFilter !== 'all' || deptFilter !== 'all'
                  ? 'No staff match your filters.'
                  : 'No staff members found. Add your first staff member.'}
              </p>
              <Button
                onClick={() => navigate({ to: '/admin/staff/add' as any })}
                className="bg-teal-600 hover:bg-teal-500 gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add First Staff Member
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filtered.map((member) => {
                const rc =
                  ROLE_CONFIG[member.role] ??
                  ROLE_CONFIG['staff'] ?? {
                    label: member.role,
                    color: 'bg-slate-800 text-slate-300 border-slate-700',
                    dotColor: 'bg-slate-400',
                  };
                const initials = getInitials(member.full_name);
                return (
                  <div
                    key={member.user_id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-800/20 transition-colors"
                  >
                    {/* Avatar + info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-black border shrink-0 ${rc.color}`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">
                          {member.full_name ?? 'Unnamed Member'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {member.email && member.email !== 'N/A' && (
                            isCorporateEmail(member.email) ? (
                              <span className="flex items-center gap-1 text-xs text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/30 font-mono font-medium truncate max-w-[240px]">
                                <ShieldCheck className="h-3 w-3 text-teal-400 shrink-0" />
                                {member.email}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono truncate max-w-[200px]">
                                <Mail className="h-3 w-3 shrink-0" />
                                {member.email}
                              </span>
                            )
                          )}
                          {member.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {member.department && (
                        <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg">
                          <Building className="h-3 w-3 text-slate-400" />
                          {member.department}
                        </span>
                      )}
                      {member.designation && (
                        <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg">
                          <Briefcase className="h-3 w-3 text-slate-400" />
                          {member.designation}
                        </span>
                      )}
                      {member.branch && (
                        <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {member.branch}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${rc.color}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${rc.dotColor}`} />
                        {rc.label}
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono hidden lg:block">
                        {member.user_id?.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
