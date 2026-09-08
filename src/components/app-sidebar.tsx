import { Link, useLocation } from '@tanstack/react-router';
import {
    Package,
    Truck,
    ShieldCheck,
    FileText,
    LogOut,
    Navigation2,
    BarChart3,
    Users,
    MapPin,
    Clock,
    CreditCard,
    Car,
    Bell,
    Globe2,
    Activity,
    UserPlus,
    Key,
    Building,
    Briefcase,
    Mail,
    CheckCircle2,
    BookOpen,
    PlusCircle,
    Lock,
    Settings,
    Radio,
} from 'lucide-react';


import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface SidebarProps {
    className?: string;
}

// ─── Role-specific nav configs ───────────────────────────────────────────────

const customerNav = {
    roleLabel: 'Customer',
    roleColor: 'text-blue-400',
    roleBg: 'bg-blue-500/10 border-blue-500/20',
    roleDot: 'bg-blue-400',
    sections: [
        {
            title: 'Logistics Services',
            items: [
                { title: 'Book a Dispatch', path: '/my-swift-move', icon: Package, description: 'Send parcels & packages' },
                { title: 'Request a Ride', path: '/my-vehicle-hires', icon: Car, description: 'On-demand passenger rides' },
            ],
        },
        {
            title: 'My Account',
            items: [
                { title: 'Order History', path: '/history', icon: Clock, description: 'Past orders & receipts' },
                { title: 'Payments', path: '/my-payments', icon: CreditCard, description: 'Invoices & billing records' },
            ],
        },
    ],
};

const driverNav = {
    roleLabel: 'Driver',
    roleColor: 'text-orange-400',
    roleBg: 'bg-orange-500/10 border-orange-500/20',
    roleDot: 'bg-orange-400',
    sections: [
        {
            title: 'Dispatch Operations',
            items: [
                { title: 'Driver Console', path: '/drive', icon: Navigation2, description: 'Accept & manage jobs' },
            ],
        },
        {
            title: 'Driver Hub',
            items: [
                { title: 'Trip History', path: '/history', icon: FileText, description: 'Completed deliveries' },
                { title: 'Wallet & Payouts', path: '/drive/wallet', icon: CreditCard, description: '30% earnings & payouts' },
            ],
        },
    ],
};

const adminNav = {
    roleLabel: 'Administrator',
    roleColor: 'text-purple-400',
    roleBg: 'bg-purple-500/10 border-purple-500/20',
    roleDot: 'bg-purple-400',
    sections: [
        {
            title: 'Overview',
            items: [
                { title: 'Dashboard', path: '/admin', icon: Activity, description: 'System overview' },
            ],
        },
        {
            title: 'Users',
            items: [
                { title: 'All Users', path: '/admin/users', icon: Users, description: 'Manage accounts' },
                { title: 'Create User', path: '/admin/users/create', icon: UserPlus, description: 'New account' },
                { title: 'Roles', path: '/admin/users/roles', icon: ShieldCheck, description: 'User roles' },
                { title: 'Permissions', path: '/admin/users/permissions', icon: Key, description: 'User privileges' },
            ],
        },
        {
            title: 'Staff',
            items: [
                { title: 'Staff Directory', path: '/admin/staff', icon: Users, description: 'Employee list' },
                { title: 'Add Staff', path: '/admin/staff/add', icon: UserPlus, description: 'New employee' },
                { title: 'Departments', path: '/staff/departments', icon: Building, description: 'Org units' },
                { title: 'Designations', path: '/staff/designations', icon: Briefcase, description: 'Job titles' },
                { title: 'Branches', path: '/staff/branches', icon: MapPin, description: 'Locations' },
                { title: 'Company Emails', path: '/admin/emails', icon: Mail, description: 'Domains & mailboxes' },
            ],
        },
        {
            title: 'Riders & Drivers',
            items: [
                { title: 'All Riders', path: '/admin/riders', icon: Truck, description: 'Fleet drivers' },
                { title: 'Add Rider', path: '/admin/riders/add', icon: UserPlus, description: 'New driver' },
                { title: 'Verification', path: '/admin/riders/verify', icon: CheckCircle2, description: 'Document checks' },
                { title: 'Vehicles', path: '/admin/riders/vehicles', icon: Car, description: 'Fleet assets' },
                { title: 'Documents', path: '/admin/riders/documents', icon: FileText, description: 'Compliance' },
                { title: 'Rider Performance', path: '/admin/riders/performance', icon: BarChart3, description: 'Metrics' },
            ],
        },
        {
            title: 'Applications',
            items: [
                { title: 'Dispatcher Console', path: '/dispatcher', icon: Radio, description: 'Live Ops & Trip Control' },
                { title: 'Swift Move', path: '/admin/swift-move', icon: Package, description: 'Logistics engine' },
                { title: 'HR', path: '/admin/hr', icon: Users, description: 'Human resources' },
                { title: 'Finance', path: '/admin/finance', icon: CreditCard, description: 'Accounting' },
            ],
        },
        {
            title: 'Access Control',
            items: [
                { title: 'Roles', path: '/admin/users/roles', icon: ShieldCheck, description: 'System roles' },
                { title: 'Permissions', path: '/admin/users/permissions', icon: Key, description: 'System perms' },
            ],
        },
        {
            title: 'System',
            items: [
                { title: 'Audit Logs', path: '/admin/audit', icon: FileText, description: 'Action history' },
                { title: 'Settings', path: '/settings', icon: Settings, description: 'Configuration' },
            ],
        },
    ],
};

const dispatcherNav = {
    roleLabel: 'Dispatcher',
    roleColor: 'text-cyan-400',
    roleBg: 'bg-cyan-500/10 border-cyan-500/20',
    roleDot: 'bg-cyan-400',
    sections: [
        {
            title: 'Live Operations',
            items: [
                { title: 'Dispatcher Console', path: '/dispatcher', icon: Radio, description: 'Live Ops & Trip Control' },
                { title: 'Swift Move', path: '/admin/swift-move', icon: Package, description: 'Logistics engine' },
            ],
        },
        {
            title: 'Fleet & Riders',
            items: [
                { title: 'All Riders', path: '/admin/riders', icon: Truck, description: 'Fleet drivers' },
                { title: 'Vehicles', path: '/admin/riders/vehicles', icon: Car, description: 'Fleet assets' },
                { title: 'Rider Performance', path: '/admin/riders/performance', icon: BarChart3, description: 'Metrics' },
            ],
        },
        {
            title: 'Access Control',
            items: [
                { title: 'Permissions', path: '/admin/users/permissions', icon: Key, description: 'Privilege overview' },
            ],
        },
    ],
};

function getRoleConfig(role: string) {
    if (role === 'driver') return driverNav;
    if (role === 'swift_dispatcher' || role === 'dispatcher') return dispatcherNav;
    if (role === 'administrator' || role === 'swift_manager') return adminNav;
    return customerNav;
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

export function AppSidebar({ className = '' }: SidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;
    const role = auth?.role ?? 'registered_user';
    const config = getRoleConfig(role);

    const displayName = user?.user_metadata?.full_name || user?.email || 'User';
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <aside className={`w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 ${className}`}>

            {/* ── TOP BRAND ── */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group" title="Return to Home Page">
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/30 group-hover:scale-105 transition-transform bg-white">
                        <img src="/barakah-centre-logo.png" alt="Barakah Development Centre Logo" className="h-full w-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white tracking-tight leading-none">BARAKAH</h2>
                        <p className="text-[9px] font-semibold text-emerald-400 mt-1 tracking-wider uppercase">Development Centre</p>
                    </div>
                </Link>

                {/* ── ROLE BADGE ── */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${config.roleBg}`}>
                    <span className={`h-2 w-2 rounded-full animate-pulse ${config.roleDot}`} />
                    <span className={`text-xs font-bold tracking-wide ${config.roleColor}`}>{config.roleLabel}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">Online</span>
                </div>

                {/* ── ROLE-SPECIFIC NAV SECTIONS (NESTED TREE) ── */}
                <Accordion type="multiple" defaultValue={config.sections.map((_, i) => `section-${i}`)} className="w-full space-y-1">
                    {config.sections.map((section, idx) => (
                        <AccordionItem value={`section-${idx}`} key={section.title} className="border-none">
                            <AccordionTrigger className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-1.5 hover:bg-slate-900/50 hover:text-slate-300 hover:no-underline rounded-lg transition-colors">
                                {section.title}
                            </AccordionTrigger>
                            <AccordionContent className="pb-0 pt-1 space-y-1 px-1">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = currentPath === item.path;
                                    return (
                                        <Link
                                            key={item.path + item.title}
                                            to={item.path as any}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                                isActive
                                                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                                            }`}
                                        >
                                            <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800/60 text-slate-400 group-hover:text-slate-200'}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold leading-none truncate">{item.title}</p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>

            {/* ── BOTTOM USER FOOTER ── */}
            <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/50 shrink-0">
                <div className="flex items-center gap-3 px-1">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 border ${config.roleBg}`}>
                        {initials}
                    </div>
                    <div className="truncate flex-1">
                        <p className="text-sm font-semibold text-white truncate leading-tight">{displayName}</p>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Session
                        </span>
                    </div>
                </div>

                <div className="pt-2 flex flex-col gap-1">
                    <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-2 h-9"
                    >
                        <Link to="/">
                            <Globe2 className="h-3.5 w-3.5" /> Public Website
                        </Link>
                    </Button>

                    {logout && (
                        <Button
                            variant="ghost"
                            onClick={() => logout()}
                            className="w-full justify-start text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 border border-transparent hover:border-red-500/20 h-9"
                        >
                            <LogOut className="h-3.5 w-3.5" /> Sign Out
                        </Button>
                    )}
                </div>
            </div>
        </aside>
    );
}