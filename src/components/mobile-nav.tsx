import { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
    Menu,
    X,
    Package,
    LayoutDashboard,
    Truck,
    ShieldCheck,
    FileText,
    LogOut
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const currentPath = location.pathname;
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;

    useEffect(() => {
        setIsOpen(false);
    }, [currentPath]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const navigationItems = [
        {
            title: 'Logistics Portal',
            path: '/my-swift-move',
            icon: LayoutDashboard,
            badge: null,
        },
        {
            title: 'Order History',
            path: '/history',
            icon: FileText,
            badge: null,
        },
        {
            title: 'Driver Console',
            path: '/driver-dispatch',
            icon: Truck,
            badge: 'Driver',
        },
        {
            title: 'Admin Console',
            path: '/admin',
            icon: ShieldCheck,
            badge: 'Admin',
        },
    ];

    return (
        <div className="md:hidden sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-600/30">
                    <Package className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-base font-bold text-white leading-tight">Swift Move</h2>
                    <p className="text-[10px] text-slate-400">Logistics & Express</p>
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-300 hover:text-white hover:bg-slate-900"
                aria-label="Toggle Navigation Menu"
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 backdrop-blur-lg pt-16 pb-6 px-6 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="space-y-6">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                            Main Services
                        </div>

                        <nav className="space-y-2">
                            {navigationItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = currentPath === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center justify-between p-3.5 rounded-xl text-base font-medium transition-all ${isActive
                                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                                                : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                                            <span>{item.title}</span>
                                        </div>

                                        {item.badge && (
                                            <Badge className={`text-xs px-2.5 py-0.5 ${item.badge === 'Admin'
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

                    <div className="pt-6 border-t border-slate-800 space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shrink-0">
                                {user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="truncate">
                                <p className="text-sm font-medium text-white truncate">{user?.email || 'Logged User'}</p>
                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Session
                                </span>
                            </div>
                        </div>

                        {logout && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setIsOpen(false);
                                    logout();
                                }}
                                className="w-full justify-start text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 border border-slate-800"
                            >
                                <LogOut className="h-4 w-4" /> Sign Out
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}