import { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
    Menu,
    X,
    Package,
    Truck,
    Navigation2,
    Globe2,
    Activity,
    MapPin,
    Clock,
    CreditCard,
    Car,
    Bell,
    Users,
    BarChart3,
    FileText,
    Radio,
    Key,
    ShieldAlert,
    LogOut,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

// ─── Role-specific nav configs (shared pattern with sidebar) ─────────────────

const customerNav = {
    roleLabel: 'Customer',
    roleColor: 'text-blue-400',
    roleBg: 'bg-blue-500/10 border-blue-500/20',
    roleDot: 'bg-blue-400',
    sections: [
        {
            title: 'Logistics Services',
            items: [
                { title: 'Book a Dispatch', path: '/my-swift-move', icon: Package },
                { title: 'Request a Ride', path: '/my-vehicle-hires', icon: Car },
            ],
        },
        {
            title: 'My Account',
            items: [
                { title: 'Order History', path: '/history', icon: Clock },
                { title: 'Payments', path: '/my-payments', icon: CreditCard },
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
                { title: 'Driver Console', path: '/drive', icon: Navigation2 },
            ],
        },
        {
            title: 'Driver Hub',
            items: [
                { title: 'Trip History', path: '/history', icon: FileText },
                { title: 'Driver Wallet', path: '/drive/wallet', icon: CreditCard },
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
            title: 'Command Center',
            items: [
                { title: 'Dispatcher Console', path: '/dispatcher', icon: Navigation2 },
                { title: 'Global Operations', path: '/admin', icon: Globe2 },
                { title: 'Swift Move Logistics', path: '/admin/swift-move', icon: Package },
                { title: 'Live Driver Console', path: '/drive', icon: Activity },
            ],
        },
        {
            title: 'Platform Management',
            items: [
                { title: 'All Transactions', path: '/history', icon: BarChart3 },
                { title: 'User Management', path: '/admin/users', icon: Users },
                { title: 'Audit Logs', path: '/admin/audit', icon: ShieldAlert },
                { title: 'Payments & Ledger', path: '/my-payments', icon: CreditCard },
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
                { title: 'Dispatcher Console', path: '/dispatcher', icon: Radio },
                { title: 'Swift Move Logistics', path: '/admin/swift-move', icon: Package },
            ],
        },
        {
            title: 'Fleet & Riders',
            items: [
                { title: 'All Riders', path: '/admin/riders', icon: Truck },
                { title: 'Vehicles', path: '/admin/riders/vehicles', icon: Car },
                { title: 'Rider Performance', path: '/admin/riders/performance', icon: BarChart3 },
            ],
        },
        {
            title: 'Access Control',
            items: [
                { title: 'Permissions', path: '/admin/users/permissions', icon: Key },
            ],
        },
    ],
};

function getRoleConfig(role: string) {
    if (role === 'driver' || role === 'dispatch_rider') return driverNav;
    if (role === 'swift_dispatcher' || role === 'dispatcher') return dispatcherNav;
    if (role === 'administrator' || role === 'admin' || role === 'swift_manager') return adminNav;
    return customerNav;
}

// ─── Mobile Nav Component ─────────────────────────────────────────────────────

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const currentPath = location.pathname;
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;
    const role = auth?.role ?? 'registered_user';
    const config = getRoleConfig(role);

    const displayName = user?.user_metadata?.full_name || user?.email || 'User';
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

    useEffect(() => {
        setIsOpen(false);
    }, [currentPath]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    return (
        <div className="md:hidden sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-600/30">
                    <Truck className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-white leading-tight">SwiftMove</h2>
                    <p className={`text-[10px] font-semibold ${config.roleColor}`}>{config.roleLabel} Portal</p>
                </div>
            </Link>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-300 hover:text-white hover:bg-slate-900"
                aria-label="Toggle Navigation"
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>

            {/* ── Full-screen Drawer ── */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-xl pt-4 pb-6 px-5 animate-in fade-in slide-in-from-top-4 duration-200">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between mb-6">
                        <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                            <div className="p-2 bg-blue-600 rounded-lg text-white">
                                <Truck className="h-5 w-5" />
                            </div>
                            <span className="font-black text-white text-base">SwiftMove</span>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Role pill */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${config.roleBg} mb-5`}>
                        <span className={`h-2 w-2 rounded-full animate-pulse ${config.roleDot}`} />
                        <span className={`text-xs font-bold ${config.roleColor}`}>Logged in as {config.roleLabel}</span>
                    </div>

                    {/* Role-specific nav sections */}
                    <div className="flex-1 overflow-y-auto space-y-5">
                        {config.sections.map((section) => (
                            <nav key={section.title} className="space-y-1">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pb-1 border-b border-slate-800/60 mb-2">
                                    {section.title}
                                </div>
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = currentPath === item.path;
                                    return (
                                        <Link
                                            key={item.path + item.title}
                                            to={item.path as any}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-all ${
                                                isActive
                                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                                    : 'text-slate-300 hover:text-white hover:bg-slate-900/80 border border-transparent'
                                            }`}
                                        >
                                            <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            {item.title}
                                        </Link>
                                    );
                                })}
                            </nav>
                        ))}
                    </div>

                    {/* Footer user area */}
                    <div className="pt-5 border-t border-slate-800 space-y-3 mt-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 border ${config.roleBg}`}>
                                {initials}
                            </div>
                            <div className="truncate">
                                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active Session
                                </span>
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col gap-1">
                            <Button
                                variant="ghost"
                                asChild
                                onClick={() => setIsOpen(false)}
                                className="w-full justify-start text-sm text-slate-300 hover:text-white hover:bg-slate-800 gap-2 h-10 border border-slate-800 hover:border-slate-700"
                            >
                                <Link to="/">
                                    <Globe2 className="h-4 w-4" /> Public Website
                                </Link>
                            </Button>

                            {logout && (
                                <Button
                                    variant="ghost"
                                    onClick={() => { setIsOpen(false); logout(); }}
                                    className="w-full justify-start text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 border border-slate-800 hover:border-red-500/20"
                                >
                                    <LogOut className="h-4 w-4" /> Sign Out
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}