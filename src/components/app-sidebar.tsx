import { Link, useLocation } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Truck,
    Package,
    ShieldCheck,
    FileText,
    LogOut
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
    className?: string;
}

export function AppSidebar({ className = '' }: SidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;

    const navigationItems = [
        {
            title: 'Logistics Portal',
            path: '/my-swift-move',
            icon: LayoutDashboard,
            badge: null,
            description: 'Book parcel dispatches & vehicle hires',
        },
        {
            title: 'Order History',
            path: '/history',
            icon: FileText,
            badge: null,
            description: 'Past orders & digital receipts',
        },
        {
            title: 'Driver Console',
            path: '/driver-dispatch',
            icon: Truck,
            badge: 'Driver',
            description: 'Accept pending jobs & update status',
        },
        {
            title: 'Admin Console',
            path: '/admin',
            icon: ShieldCheck,
            badge: 'Admin',
            description: 'Revenue metrics & platform controls',
        },
    ];

    return (
        <aside className={`w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 ${className}`}>
            {/* --- TOP BRAND HEADER --- */}
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30">
                        <Package className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight leading-none">Swift Move</h2>
                        <p className="text-xs text-slate-400 mt-1">Logistics & Express Hire</p>
                    </div>
                </div>

                {/* --- NAVIGATION LINKS --- */}
                <nav className="space-y-1.5 pt-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                        Main Services
                    </div>

                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                    <span>{item.title}</span>
                                </div>

                                {item.badge && (
                                    <Badge className={`text-[10px] px-2 py-0.5 ${item.badge === 'Admin'
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                        }`}>
                                        {item.badge}
                                    </Badge>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* --- BOTTOM USER PROFILE FOOTER --- */}
            <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/50">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <div className="flex items-center gap-3 truncate">
                        <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="truncate">
                            <p className="text-sm font-medium text-white truncate">{user?.email || 'Logged User'}</p>
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Session
                            </span>
                        </div>
                    </div>
                </div>

                {logout && (
                    <Button
                        variant="ghost"
                        onClick={() => logout()}
                        className="w-full justify-start text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 border border-transparent hover:border-red-500/20"
                    >
                        <LogOut className="h-4 w-4" /> Sign Out
                    </Button>
                )}
            </div>
        </aside>
    );
}