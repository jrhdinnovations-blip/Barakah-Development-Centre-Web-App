import { useState, useEffect, useMemo, useCallback } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { getAuditLogsAdmin, AuditLogItem } from '@/lib/admin.functions';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Users,
  Layers,
  FileCode,
  Copy,
  Check,
  Eye,
  Lock,
  Truck,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/_authenticated/admin/audit')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const isAuthorized =
        userRoles.some((r: string) => ['administrator', 'admin', 'swift_manager'].includes(r)) ||
        ['administrator', 'admin', 'swift_manager'].includes(metaRole);
      if (!isAuthorized) {
        throw redirect({ to: '/my-swift-move' });
      }
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: AdminAuditPage,
});

// Helper for formatting relative time
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Action badge config
function getActionBadgeConfig(action: string) {
  const act = action.toLowerCase();
  if (act.includes('delete') || act.includes('revoke') || act.includes('fail') || act.includes('block')) {
    return {
      label: action,
      color: 'bg-red-500/10 text-red-400 border-red-500/30',
      dot: 'bg-red-400',
    };
  }
  if (act.includes('grant') || act.includes('create') || act.includes('add') || act.includes('success')) {
    return {
      label: action,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400',
    };
  }
  if (act.includes('role') || act.includes('perm') || act.includes('auth') || act.includes('password')) {
    return {
      label: action,
      color: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      dot: 'bg-purple-400',
    };
  }
  if (act.includes('assign') || act.includes('dispatch') || act.includes('trip') || act.includes('order')) {
    return {
      label: action,
      color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      dot: 'bg-cyan-400',
    };
  }
  return {
    label: action,
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    dot: 'bg-slate-400',
  };
}

function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    securityCount: 0,
    operationalCount: 0,
    todayCount: 0,
    uniqueActors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogsAdmin({
        data: {
          days: daysFilter,
          action: actionFilter !== 'all' ? actionFilter : undefined,
          entityType: entityFilter !== 'all' ? entityFilter : undefined,
          search: searchTerm.trim() ? searchTerm.trim() : undefined,
          limit: 200,
        },
      });
      setLogs(res.logs || []);
      setStats(res.stats || { total: 0, securityCount: 0, operationalCount: 0, todayCount: 0, uniqueActors: 0 });
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      toast.error(err.message || 'Could not fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [daysFilter, actionFilter, entityFilter, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime subscription to audit_logs
  useEffect(() => {
    const channel = supabase
      .channel('admin-audit-logs-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;

          toast.info(`🔔 New audit event: ${newRow.action || 'System action'}`);
          fetchLogs();
        },
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.info('No audit records to export.');
      return;
    }

    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'Metadata'];
    const rows = logs.map((log) => [
      log.id,
      log.created_at,
      `"${log.actor_name.replace(/"/g, '""')}"`,
      `"${log.actor_email.replace(/"/g, '""')}"`,
      log.actor_role,
      `"${log.action.replace(/"/g, '""')}"`,
      log.entity_type,
      log.entity_id || '',
      `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `barakah-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit log CSV exported');
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (logs.length === 0) {
      toast.info('No audit records to export.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `barakah-audit-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit log JSON exported');
  };

  // Unique entity types present in logs
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.entity_type) set.add(l.entity_type);
    });
    // Add common entities
    ['auth.users', 'user_roles', 'swift_deliveries', 'active_drivers', 'profiles', 'staff', 'company_emails'].forEach((e) => set.add(e));
    return Array.from(set).sort();
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 p-4 md:p-8 space-y-8 font-sans">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-lg shadow-purple-500/10">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">System Audit Logs</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Centralized tamper-evident audit trail of administrative, security, and operational actions
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Live indicator badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className={`h-2 w-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="font-semibold">{isLiveConnected ? 'Realtime Monitoring' : 'Live Syncing'}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 h-9"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" />
            CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 h-9"
          >
            <FileCode className="h-4 w-4 mr-2 text-cyan-400" />
            JSON
          </Button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Records */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Events Loaded</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{stats.total}</span>
            <span className="text-xs text-purple-400 font-semibold">in view</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Filtered event count</p>
        </div>

        {/* Card 2: Security & Permissions */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security & Roles</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400">{stats.securityCount}</span>
            <span className="text-xs text-rose-400/80 font-semibold">actions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Role changes & credential modifications</p>
        </div>

        {/* Card 3: Operational Actions */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operations</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-400">{stats.operationalCount}</span>
            <span className="text-xs text-cyan-400/80 font-semibold">actions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Dispatch, fleet & trip mutations</p>
        </div>

        {/* Card 4: Unique Actors */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Actors</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{stats.uniqueActors}</span>
            <span className="text-xs text-emerald-400/80 font-semibold">personnel</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Responsible administrators and managers</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 space-y-4 backdrop-blur-md shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search action, actor, entity..."
              className="pl-9 bg-slate-950/70 border-slate-800 text-slate-200 placeholder:text-slate-500 h-10 rounded-xl focus:border-purple-500/50"
            />
          </div>

          {/* Entity Filter */}
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="bg-slate-950/70 border-slate-800 text-slate-300 h-10 rounded-xl">
              <div className="flex items-center gap-2 truncate">
                <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                <span className="truncate">
                  {entityFilter === 'all' ? 'All Entity Types' : entityFilter}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Entity Types</SelectItem>
              {entityOptions.map((ent) => (
                <SelectItem key={ent} value={ent}>
                  {ent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action Category Filter */}
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="bg-slate-950/70 border-slate-800 text-slate-300 h-10 rounded-xl">
              <div className="flex items-center gap-2 truncate">
                <Filter className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {actionFilter === 'all' ? 'All Action Types' : actionFilter}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Action Types</SelectItem>
              <SelectItem value="role">Roles & Permissions</SelectItem>
              <SelectItem value="user">User & Account</SelectItem>
              <SelectItem value="create">Creation (create / add)</SelectItem>
              <SelectItem value="update">Updates & Edits</SelectItem>
              <SelectItem value="delete">Deletions & Revocations</SelectItem>
              <SelectItem value="dispatch">Dispatch & Trips</SelectItem>
            </SelectContent>
          </Select>

          {/* Timeframe Filter */}
          <Select value={String(daysFilter)} onValueChange={(val) => setDaysFilter(Number(val))}>
            <SelectTrigger className="bg-slate-950/70 border-slate-800 text-slate-300 h-10 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  {daysFilter === 1 ? 'Today (24h)' : daysFilter === 7 ? 'Past 7 Days' : daysFilter === 30 ? 'Past 30 Days' : 'All History (90d)'}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="1">Today (24 hours)</SelectItem>
              <SelectItem value="7">Past 7 Days</SelectItem>
              <SelectItem value="30">Past 30 Days</SelectItem>
              <SelectItem value="90">Past 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filter summary */}
        {(searchTerm || actionFilter !== 'all' || entityFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Filtering by:</span>
              {searchTerm && <Badge variant="secondary" className="bg-slate-800 text-slate-300">Query: "{searchTerm}"</Badge>}
              {entityFilter !== 'all' && <Badge variant="secondary" className="bg-purple-900/40 text-purple-300 border border-purple-500/30">Entity: {entityFilter}</Badge>}
              {actionFilter !== 'all' && <Badge variant="secondary" className="bg-cyan-900/40 text-cyan-300 border border-cyan-500/30">Action: {actionFilter}</Badge>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setEntityFilter('all');
                setActionFilter('all');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 h-7 px-2"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* ── AUDIT LOGS TABLE / FEED ── */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Audit Trail Records</h2>
            <span className="text-xs text-slate-500 font-mono">({logs.length} entries)</span>
          </div>
          <div className="text-xs text-slate-500">
            Sorted by most recent
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-slate-400 font-medium text-sm">Querying audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-full bg-slate-800/60 text-slate-500 mb-3">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-300">No Audit Events Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              No matching activity records found for the selected filter parameters. Adjust your search or date range above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Entity Type</th>
                  <th className="py-3.5 px-4">Entity Reference</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => {
                  const badge = getActionBadgeConfig(log.action);
                  const relTime = formatRelativeTime(log.created_at);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white text-xs">{relTime}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleString([], {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-purple-400 shrink-0">
                            {log.actor_name ? log.actor_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-200 text-xs truncate max-w-[150px]">
                              {log.actor_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                              {log.actor_email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${badge.color}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {log.action}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[11px]">
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Entity Reference */}
                      <td className="py-3.5 px-4">
                        {log.entity_id ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
                            <span className="truncate max-w-[120px]">{log.entity_id}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(log.entity_id!, log.id);
                              }}
                              className="text-slate-500 hover:text-white transition-colors"
                              title="Copy entity ID"
                            >
                              {copiedId === log.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : log.metadata?.target_user ? (
                          <span className="font-mono text-xs text-slate-400 truncate max-w-[120px]">
                            user: {String(log.metadata.target_user).slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Details Inspector Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="h-8 px-2.5 text-xs text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 rounded-lg"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── METADATA INSPECTOR DIALOG ── */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-[#0B101D] border-slate-800 text-slate-200 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-purple-400" />
                    <DialogTitle className="text-lg font-bold text-white">Event Inspector</DialogTitle>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      getActionBadgeConfig(selectedLog.action).color
                    }`}
                  >
                    {selectedLog.action}
                  </span>
                </div>
                <DialogDescription className="text-xs text-slate-400">
                  Full cryptographic timestamp & payload details recorded for audit compliance
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                {/* Event Summary Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">Actor</span>
                    <span className="font-bold text-white text-sm block mt-0.5">{selectedLog.actor_name}</span>
                    <span className="text-slate-400 text-[11px]">{selectedLog.actor_email}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">Actor Role</span>
                    <Badge variant="outline" className="mt-1 border-purple-500/30 bg-purple-500/10 text-purple-300">
                      {selectedLog.actor_role}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">Target Entity</span>
                    <span className="font-mono text-slate-200 mt-0.5 block">{selectedLog.entity_type}</span>
                    {selectedLog.entity_id && (
                      <span className="font-mono text-[10px] text-slate-400 block truncate">{selectedLog.entity_id}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">Timestamp (UTC)</span>
                    <span className="font-mono text-slate-300 text-xs block mt-0.5">
                      {new Date(selectedLog.created_at).toISOString()}
                    </span>
                  </div>
                </div>

                {/* Metadata JSON Block */}
                <div>
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-purple-400" />
                      Payload Metadata
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), 'modal-meta')}
                      className="h-7 text-[11px] text-slate-400 hover:text-white px-2"
                    >
                      {copiedId === 'modal-meta' ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" /> Copy JSON
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60 custom-scrollbar">
                    {Object.keys(selectedLog.metadata || {}).length > 0 ? (
                      <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-600 italic">No custom metadata parameters attached to this action.</span>
                    )}
                  </div>
                </div>

                {/* Raw Event ID footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                  <span>Log Reference ID:</span>
                  <span className="font-mono text-slate-400">{selectedLog.id}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
