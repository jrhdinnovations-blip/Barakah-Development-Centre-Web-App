import { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
    Menu,
    X,
    Globe2,
    LogOut,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
    getRoleConfig,
    isNavItemActive,
} from '@/components/app-sidebar';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const currentPath = location.pathname;
    const currentSearch = (location.search as Record<string, any>) || {};
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;
    const role = auth?.role ?? 'registered_user';
    const roles = auth?.roles ?? [];
    const config = getRoleConfig(role, user, currentPath, roles);

    const rawDisplayName = user?.user_metadata?.full_name || user?.email || 'User';
    const displayName = rawDisplayName.toLowerCase().includes('barakah')
        ? 'SwiftMove Admin'
        : rawDisplayName;
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

    const allItemPaths = config.sections.flatMap((s) => s.items.map((i) => i.path));

    useEffect(() => {
        setIsOpen(false);
    }, [currentPath]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    return (
        <>
            {/* ── Sticky Top Bar (< md) ── */}
            <div className="md:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-sm">
                {/* Brand: SwiftMove */}
                <Link to="/swiftmove" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden shadow-md bg-white ring-2 ring-orange-500/50 shadow-orange-950/30">
                        <img
                            src="/swiftmove-logo.jpg"
                            alt="SwiftMove Logo"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div>
                        <h2 className="text-sm font-black leading-tight text-orange-400">
                            SwiftMove
                        </h2>
                        <p className={`text-[10px] font-semibold ${config.roleColor}`}>{config.roleLabel} Portal</p>
                    </div>
                </Link>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg"
                    aria-label="Toggle Navigation"
                >
                    {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
            </div>

            {/* ── Full-screen Drawer Modal ── */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 pt-4 pb-6 px-5 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-200">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800/60">
                        <Link to="/swiftmove" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                            <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden shadow-md bg-white ring-2 ring-orange-500/50">
                                <img
                                    src="/swiftmove-logo.jpg"
                                    alt="SwiftMove Logo"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <span className="font-black text-base text-orange-400">
                                SwiftMove
                            </span>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Role pill */}
                    <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${config.roleBg} mb-5`}>
                        <span className={`h-2 w-2 rounded-full animate-pulse shrink-0 ${config.roleDot}`} />
                        <span className={`text-xs font-bold ${config.roleColor}`}>Logged in as {config.roleLabel}</span>
                        <span className="text-[10px] text-slate-500 ml-auto font-mono">Online</span>
                    </div>

                    {/* Role-specific nav sections */}
                    <div className="flex-1 space-y-6">
                        {config.sections.map((section) => (
                            <nav key={section.title} className="space-y-1">
                                <div className={`text-[10px] font-extrabold uppercase tracking-widest px-2 pb-1 border-b border-slate-800/60 mb-2 ${
                                    section.accentColor ?? 'text-slate-500'
                                }`}>
                                    {section.title}
                                </div>
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = isNavItemActive(
                                        item.path,
                                        currentPath,
                                        currentSearch,
                                        allItemPaths
                                    );
                                    const [pathOnly, searchStr] = item.path.split('?');
                                    const searchObj = searchStr
                                        ? Object.fromEntries(new URLSearchParams(searchStr).entries())
                                        : undefined;

                                    return (
                                        <Link
                                            key={item.path + item.title}
                                            to={pathOnly as any}
                                            search={searchObj as any}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-all ${
                                                isActive
                                                    ? config.activeItemClass
                                                    : 'text-slate-300 hover:text-white hover:bg-slate-900/80 border border-transparent'
                                            }`}
                                        >
                                            <div className={`p-1.5 rounded-lg shrink-0 ${
                                                isActive
                                                    ? config.activeIconClass
                                                    : 'bg-slate-800/80 text-slate-400'
                                            }`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <span className="truncate">{item.title}</span>
                                            {item.badge && (
                                                <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                    item.badgeColor ?? 'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </nav>
                        ))}
                    </div>

                    {/* Footer user area */}
                    <div className="pt-5 border-t border-slate-800 space-y-3 mt-6">
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

                        <div className="pt-2 flex flex-col gap-1.5">
                            <Button
                                variant="ghost"
                                asChild
                                onClick={() => setIsOpen(false)}
                                className="w-full justify-start text-sm text-slate-300 hover:text-white hover:bg-slate-800 gap-2.5 h-10 border border-slate-800 hover:border-slate-700"
                            >
                                <Link to="/swiftmove">
                                    <Globe2 className="h-4 w-4" /> SwiftMove Home
                                </Link>
                            </Button>

                            {logout && (
                                <Button
                                    variant="ghost"
                                    onClick={() => { setIsOpen(false); logout(); }}
                                    className="w-full justify-start text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2.5 border border-slate-800 hover:border-red-500/20 h-10"
                                >
                                    <LogOut className="h-4 w-4" /> Sign Out
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}