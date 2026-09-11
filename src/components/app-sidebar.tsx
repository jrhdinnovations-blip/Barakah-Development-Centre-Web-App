import { Link, useLocation } from "@tanstack/react-router";
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
    Globe2,
    Activity,
    UserPlus,
    Key,
    Building,
    Briefcase,
    Mail,
    CheckCircle2,
    Settings,
    Radio,
    ShieldAlert,
    ChevronRight,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";

interface SidebarProps {
    className?: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
    title: string;
    path: string;
    icon: React.ElementType;
    description: string;
    badge?: string;
    badgeColor?: string;
}

interface NavSection {
    title: string;
    accentColor?: string;
    items: NavItem[];
}

interface RoleNav {
    roleLabel: string;
    roleColor: string;
    roleBg: string;
    roleDot: string;
    sections: NavSection[];
}

// ─── Customer Nav ─────────────────────────────────────────────────────────────

const customerNav: RoleNav = {
    roleLabel: "Customer",
    roleColor: "text-blue-400",
    roleBg: "bg-blue-500/10 border-blue-500/20",
    roleDot: "bg-blue-400",
    sections: [
        {
            title: "Logistics Services",
            items: [
                { title: "Book a Dispatch", path: "/my-swift-move", icon: Package, description: "Send parcels & packages" },
                { title: "Request a Ride", path: "/my-vehicle-hires", icon: Car, description: "On-demand passenger rides" },
            ],
        },
        {
            title: "My Account",
            items: [
                { title: "Order History", path: "/history", icon: Clock, description: "Past orders & receipts" },
                { title: "Payments", path: "/my-payments", icon: CreditCard, description: "Invoices & billing records" },
            ],
        },
    ],
};

// ─── Driver Nav ───────────────────────────────────────────────────────────────

const driverNav: RoleNav = {
    roleLabel: "Driver",
    roleColor: "text-orange-400",
    roleBg: "bg-orange-500/10 border-orange-500/20",
    roleDot: "bg-orange-400",
    sections: [
        {
            title: "Dispatch Operations",
            items: [
                { title: "Driver Console", path: "/drive", icon: Navigation2, description: "Accept & manage jobs" },
            ],
        },
        {
            title: "Driver Hub",
            items: [
                { title: "Trip History", path: "/history", icon: FileText, description: "Completed deliveries" },
                { title: "Wallet & Payouts", path: "/drive/wallet", icon: CreditCard, description: "30% earnings & payouts" },
            ],
        },
    ],
};

// ─── Admin Nav ────────────────────────────────────────────────────────────────
const adminNav: RoleNav = {
    roleLabel: "Administrator",
    roleColor: "text-purple-400",
    roleBg: "bg-purple-500/10 border-purple-500/20",
    roleDot: "bg-purple-400",
    sections: [
        {
            title: "Overview",
            items: [
                { title: "Dashboard", path: "/admin", icon: Activity, description: "System overview & operations metrics" },
            ],
        },
        {
            title: "Users Management",
            accentColor: "text-blue-400",
            items: [
                {
                    title: "All Users",
                    path: "/admin/users",
                    icon: Users,
                    description: "Browse, view & manage all accounts",
                },
                {
                    title: "Add User",
                    path: "/admin/users/create",
                    icon: UserPlus,
                    description: "Register a new user biodata",
                    badge: "Add",
                    badgeColor: "bg-blue-500/20 text-blue-400",
                },
                {
                    title: "Roles",
                    path: "/admin/users/roles",
                    icon: ShieldCheck,
                    description: "Manage role assignments",
                },
                {
                    title: "Permissions",
                    path: "/admin/users/permissions",
                    icon: Key,
                    description: "Control access privileges",
                },
            ],
        },
        {
            title: "Staff Management",
            accentColor: "text-emerald-400",
            items: [
                {
                    title: "Staff Directory",
                    path: "/admin/staff",
                    icon: Users,
                    description: "Full staff roster & employee profiles",
                },
                {
                    title: "Add Staff",
                    path: "/admin/staff/add",
                    icon: UserPlus,
                    description: "Onboard new staff member",
                    badge: "Add",
                    badgeColor: "bg-emerald-500/20 text-emerald-400",
                },
                {
                    title: "Company Emails",
                    path: "/admin/emails",
                    icon: Mail,
                    description: "Domains, webmail & mailboxes",
                },
            ],
        },
        {
            title: "Riders & Fleet",
            accentColor: "text-orange-400",
            items: [
                {
                    title: "All Riders",
                    path: "/admin/riders",
                    icon: Truck,
                    description: "Fleet drivers, vehicle info & status",
                },
                {
                    title: "Add Rider",
                    path: "/admin/riders/add",
                    icon: UserPlus,
                    description: "Register new dispatch rider or driver",
                    badge: "Add",
                    badgeColor: "bg-orange-500/20 text-orange-400",
                },
            ],
        },
        {
            title: "Logistics & Live Ops",
            accentColor: "text-cyan-400",
            items: [
                { title: "Dispatcher Console", path: "/dispatcher", icon: Radio, description: "Live dispatch ops & tracking" },
                { title: "Swift Move Orders", path: "/admin/swift-move", icon: Package, description: "Logistics orders & deliveries" },
            ],
        },
        {
            title: "Security & Logs",
            items: [
                { title: "Audit Logs", path: "/admin/audit", icon: ShieldAlert, description: "Security audit & activity history" },
            ],
        },
    ],
};

// ─── Dispatcher Nav ───────────────────────────────────────────────────────────
const dispatcherNav: RoleNav = {
    roleLabel: "Dispatcher",
    roleColor: "text-cyan-400",
    roleBg: "bg-cyan-500/10 border-cyan-500/20",
    roleDot: "bg-cyan-400",
    sections: [
        {
            title: "Live Operations",
            items: [
                { title: "Dispatcher Console", path: "/dispatcher", icon: Radio, description: "Live Ops & Trip Control" },
                { title: "Swift Move Orders", path: "/admin/swift-move", icon: Package, description: "Logistics engine" },
            ],
        },
        {
            title: "Fleet & Riders",
            items: [
                { title: "All Riders", path: "/admin/riders", icon: Truck, description: "Fleet drivers directory" },
                { title: "Add Rider", path: "/admin/riders/add", icon: UserPlus, description: "Onboard fleet rider" },
            ],
        },
        {
            title: "Access Control",
            items: [
                { title: "Permissions", path: "/admin/users/permissions", icon: Key, description: "Privilege overview" },
            ],
        },
    ],
};

// ─── Role resolver ────────────────────────────────────────────────────────────
function getRoleConfig(role: string, user?: any): RoleNav {
    const email = user?.email?.toLowerCase();
    if (email === "barakahdevcentre@gmail.com" || email === "barakahdevelopmentcentre@gmail.com") {
        return adminNav;
    }
    if (role === "driver" || role === "dispatch_rider") return driverNav;
    if (role === "swift_dispatcher" || role === "dispatcher") return dispatcherNav;
    if (role === "administrator" || role === "admin" || role === "swift_manager") return adminNav;
    return customerNav;
}

// ─── Nav Item Component ───────────────────────────────────────────────────────

interface NavItemProps {
    item: NavItem;
    currentPath: string;
}

function SidebarNavItem({ item, currentPath }: NavItemProps) {
    const Icon = item.icon;
    // Exact match for dashboard root, prefix match for everything else
    const isActive =
        currentPath === item.path ||
        (item.path !== "/admin" && currentPath.startsWith(item.path));

    return (
        <Link
            to={item.path as any}
            className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800"
            }`}
        >
            {/* Active indicator bar */}
            {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-full -ml-px" />
            )}

            {/* Icon */}
            <div
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isActive
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-slate-800/60 text-slate-500 group-hover:bg-slate-800 group-hover:text-slate-200"
                }`}
            >
                <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Label */}
            <span className="flex-1 text-[13px] font-semibold leading-none truncate">
                {item.title}
            </span>

            {/* Optional badge */}
            {item.badge && (
                <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        item.badgeColor ?? "bg-slate-700 text-slate-300"
                    }`}
                >
                    {item.badge}
                </span>
            )}
        </Link>
    );
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export function AppSidebar({ className = "" }: SidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;
    const role = auth?.role ?? "registered_user";
    const config = getRoleConfig(role, user);

    const displayName =
        user?.user_metadata?.full_name || user?.email || "User";
    const initials = displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const defaultOpenSections = config.sections.map((_, i) => `section-${i}`);

    return (
        <aside
            className={`w-64 bg-slate-950 border-r border-slate-800/60 flex flex-col h-screen sticky top-0 ${className}`}
        >
            {/* ═══ SCROLLABLE BODY ═══ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {/* Brand logo */}
                <Link
                    to="/"
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
                    title="Return to Home Page"
                >
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/30 group-hover:scale-105 transition-transform bg-white">
                        <img
                            src="/barakah-centre-logo.png"
                            alt="Barakah Development Centre Logo"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white tracking-tight leading-none">
                            BARAKAH
                        </h2>
                        <p className="text-[9px] font-semibold text-emerald-400 mt-1 tracking-wider uppercase">
                            Development Centre
                        </p>
                    </div>
                </Link>

                {/* Role pill */}
                <div
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${config.roleBg}`}
                >
                    <span
                        className={`h-2 w-2 rounded-full animate-pulse shrink-0 ${config.roleDot}`}
                    />
                    <span
                        className={`text-xs font-bold tracking-wide ${config.roleColor}`}
                    >
                        {config.roleLabel}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto font-mono">
                        Online
                    </span>
                </div>

                {/* Navigation accordion */}
                <Accordion
                    type="multiple"
                    defaultValue={defaultOpenSections}
                    className="w-full space-y-0.5"
                >
                    {config.sections.map((section, idx) => (
                        <AccordionItem
                            value={`section-${idx}`}
                            key={`${section.title}-${idx}`}
                            className="border-none"
                        >
                            <AccordionTrigger className="group flex w-full items-center justify-between px-2 py-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.12em] hover:text-slate-300 hover:bg-slate-900/40 hover:no-underline rounded-lg transition-all [&>svg]:hidden">
                                <span className={section.accentColor ?? ""}>
                                    {section.title}
                                </span>
                                <ChevronRight className="h-3 w-3 shrink-0 text-slate-600 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                            </AccordionTrigger>

                            <AccordionContent className="pb-1 pt-0.5 space-y-0.5 px-0">
                                {section.items.map((item) => (
                                    <SidebarNavItem
                                        key={`${item.path}-${item.title}`}
                                        item={item}
                                        currentPath={currentPath}
                                    />
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>

            {/* ═══ FOOTER ═══ */}
            <div className="shrink-0 border-t border-slate-800/60 p-4 space-y-3 bg-slate-950/80">
                {/* User identity */}
                <div className="flex items-center gap-3">
                    <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 border ${config.roleBg}`}
                    >
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-tight">
                            {displayName}
                        </p>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Session
                        </span>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex flex-col gap-1">
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
