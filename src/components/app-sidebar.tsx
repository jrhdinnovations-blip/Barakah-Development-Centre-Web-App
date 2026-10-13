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
    Clock,
    CreditCard,
    Car,
    Globe2,
    Activity,
    UserPlus,
    Key,
    Shield,
    Briefcase,
    Mail,
    Radio,
    ShieldAlert,
    ChevronRight,
    Image,
    LifeBuoy,
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

export interface NavItem {
    title: string;
    path: string;
    icon: React.ElementType;
    description: string;
    badge?: string;
    badgeColor?: string;
}

export interface NavSection {
    title: string;
    accentColor?: string;
    items: NavItem[];
}

export interface RoleNav {
    roleLabel: string;
    roleColor: string;
    roleBg: string;
    roleDot: string;
    activeItemClass: string;
    activeIconClass: string;
    activeIndicatorClass: string;
    sections: NavSection[];
}

// ─── 1. SwiftMove Customer Nav ────────────────────────────────────────────────

const customerNav: RoleNav = {
    roleLabel: "SwiftMove Customer",
    roleColor: "text-orange-400",
    roleBg: "bg-orange-500/10 border-orange-500/20",
    roleDot: "bg-orange-400",
    activeItemClass: "bg-orange-600/15 text-orange-300 border-orange-500/30 shadow-orange-950/20 shadow-sm",
    activeIconClass: "bg-orange-500/20 text-orange-400",
    activeIndicatorClass: "bg-orange-400",
    sections: [
        {
            title: "SwiftMove Services",
            accentColor: "text-orange-400",
            items: [
                {
                    title: "Book a Ride",
                    path: "/my-swift-move?service=ride",
                    icon: Car,
                    description: "On-demand city passenger rides",
                    badge: "Ride",
                    badgeColor: "bg-orange-500/20 text-orange-400",
                },
                {
                    title: "Send a Parcel",
                    path: "/my-swift-move?service=parcel",
                    icon: Package,
                    description: "Express courier & package delivery",
                    badge: "Delivery",
                    badgeColor: "bg-blue-500/20 text-blue-400",
                },
                {
                    title: "Track Live Order",
                    path: "/my-swift-move?service=track",
                    icon: Navigation2,
                    description: "Realtime GPS delivery tracking",
                    badge: "Live",
                    badgeColor: "bg-emerald-500/20 text-emerald-400",
                },
            ],
        },
        {
            title: "Orders & Activity",
            accentColor: "text-amber-400",
            items: [
                {
                    title: "Trip & Order History",
                    path: "/history",
                    icon: Clock,
                    description: "Past rides, deliveries & receipts",
                },
                {
                    title: "Payments & Invoices",
                    path: "/my-payments",
                    icon: CreditCard,
                    description: "Payment records & transaction receipts",
                },
            ],
        },
        {
            title: "Support & Help",
            accentColor: "text-cyan-400",
            items: [
                {
                    title: "Customer Support",
                    path: "/my-support",
                    icon: LifeBuoy,
                    description: "24/7 help desk & ride assistance",
                },
            ],
        },
    ],
};

// ─── 2. SwiftMove Rider / Driver Nav ──────────────────────────────────────────

const driverNav: RoleNav = {
    roleLabel: "Rider & Driver",
    roleColor: "text-amber-400",
    roleBg: "bg-amber-500/10 border-amber-500/20",
    roleDot: "bg-amber-400",
    activeItemClass: "bg-amber-600/15 text-amber-300 border-amber-500/30 shadow-amber-950/20 shadow-sm",
    activeIconClass: "bg-amber-500/20 text-amber-400",
    activeIndicatorClass: "bg-amber-400",
    sections: [
        {
            title: "Dispatch Operations",
            accentColor: "text-amber-400",
            items: [
                {
                    title: "Driver Cockpit",
                    path: "/drive",
                    icon: Navigation2,
                    description: "Live ride & parcel dispatches",
                    badge: "LIVE",
                    badgeColor: "bg-emerald-500/20 text-emerald-400",
                },
                {
                    title: "Enterprise Dispatches",
                    path: "/driver-dispatch",
                    icon: Package,
                    description: "Corporate delivery missions",
                },
            ],
        },
        {
            title: "Earnings & Records",
            accentColor: "text-orange-400",
            items: [
                {
                    title: "Wallet & Payouts",
                    path: "/drive/wallet",
                    icon: CreditCard,
                    description: "70/30 earnings & withdrawal balance",
                    badge: "Payouts",
                    badgeColor: "bg-orange-500/20 text-orange-400",
                },
                {
                    title: "Trip History",
                    path: "/history",
                    icon: FileText,
                    description: "Completed trips, logs & receipts",
                },
            ],
        },
        {
            title: "Rider Assistance",
            accentColor: "text-cyan-400",
            items: [
                {
                    title: "Rider Support & SOS",
                    path: "/my-support",
                    icon: ShieldCheck,
                    description: "Emergency & rider support",
                },
            ],
        },
    ],
};

// ─── 3. SwiftMove Dispatcher Nav ──────────────────────────────────────────────

const dispatcherNav: RoleNav = {
    roleLabel: "Swift Dispatcher",
    roleColor: "text-cyan-400",
    roleBg: "bg-cyan-500/10 border-cyan-500/20",
    roleDot: "bg-cyan-400",
    activeItemClass: "bg-cyan-600/15 text-cyan-300 border-cyan-500/30 shadow-cyan-950/20 shadow-sm",
    activeIconClass: "bg-cyan-500/20 text-cyan-400",
    activeIndicatorClass: "bg-cyan-400",
    sections: [
        {
            title: "Live Operations",
            accentColor: "text-cyan-400",
            items: [
                {
                    title: "Dispatcher Console",
                    path: "/dispatcher",
                    icon: Radio,
                    description: "Live trip control & radar",
                    badge: "LIVE",
                    badgeColor: "bg-amber-500/20 text-amber-400",
                },
                {
                    title: "Dispatches History",
                    path: "/history",
                    icon: Clock,
                    description: "Past dispatches & delivery logs",
                },
            ],
        },
        {
            title: "Fleet & Riders",
            accentColor: "text-orange-400",
            items: [
                {
                    title: "Fleet Riders & Drivers",
                    path: "/admin/riders",
                    icon: Truck,
                    description: "Fleet directory & active units",
                },
                {
                    title: "Add Fleet Personnel",
                    path: "/admin/riders/add",
                    icon: UserPlus,
                    description: "Onboard new rider or vehicle",
                    badge: "Add",
                    badgeColor: "bg-cyan-500/20 text-cyan-400",
                },
            ],
        },
        {
            title: "Access Control",
            accentColor: "text-purple-400",
            items: [
                {
                    title: "Permissions Matrix",
                    path: "/admin/users/permissions",
                    icon: Key,
                    description: "Privileges & authorization levels",
                },
            ],
        },
    ],
};

// ─── 4. SwiftMove Administrator Nav ───────────────────────────────────────────

const adminNav: RoleNav = {
    roleLabel: "SwiftMove Administrator",
    roleColor: "text-purple-400",
    roleBg: "bg-purple-500/10 border-purple-500/20",
    roleDot: "bg-purple-400",
    activeItemClass: "bg-purple-600/15 text-purple-300 border-purple-500/30 shadow-purple-950/20 shadow-sm",
    activeIconClass: "bg-purple-500/20 text-purple-400",
    activeIndicatorClass: "bg-purple-400",
    sections: [
        {
            title: "Operations & Control",
            accentColor: "text-purple-400",
            items: [
                {
                    title: "Operations Dashboard",
                    path: "/admin",
                    icon: Activity,
                    description: "System overview & live metrics",
                },
                {
                    title: "Dispatcher Console",
                    path: "/dispatcher",
                    icon: Radio,
                    description: "Live dispatch radar & tracking",
                    badge: "LIVE",
                    badgeColor: "bg-amber-500/20 text-amber-400",
                },
                {
                    title: "SwiftMove Orders",
                    path: "/admin/swift-move",
                    icon: Package,
                    description: "All logistics & ride orders",
                },
            ],
        },
        {
            title: "Fleet & Drivers",
            accentColor: "text-orange-400",
            items: [
                {
                    title: "All Fleet Personnel",
                    path: "/admin/riders",
                    icon: Truck,
                    description: "Fleet riders & drivers registry",
                },
                {
                    title: "Add Rider / Driver",
                    path: "/admin/riders/add",
                    icon: UserPlus,
                    description: "Register new rider or vehicle",
                    badge: "Add",
                    badgeColor: "bg-orange-500/20 text-orange-400",
                },
                {
                    title: "Driver Cockpit View",
                    path: "/drive",
                    icon: Navigation2,
                    description: "Live driver & rider interface",
                },
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
                    description: "Customer accounts directory",
                },
                {
                    title: "Add User",
                    path: "/admin/users/create",
                    icon: UserPlus,
                    description: "Register a user account",
                    badge: "New",
                    badgeColor: "bg-blue-500/20 text-blue-400",
                },
                {
                    title: "System Roles",
                    path: "/admin/users/roles",
                    icon: ShieldCheck,
                    description: "Manage role assignments",
                },
                {
                    title: "Permissions Matrix",
                    path: "/admin/users/permissions",
                    icon: Key,
                    description: "Granular access privileges",
                },
            ],
        },
        {
            title: "Staff Management",
            accentColor: "text-emerald-400",
            items: [
                {
                    title: "All Staff",
                    path: "/admin/staff",
                    icon: Shield,
                    description: "Internal operations staff",
                },
                {
                    title: "Add Staff Member",
                    path: "/admin/staff/add",
                    icon: UserPlus,
                    description: "Onboard new employee",
                    badge: "New",
                    badgeColor: "bg-emerald-500/20 text-emerald-400",
                },
                {
                    title: "Company Emails",
                    path: "/admin/emails",
                    icon: Mail,
                    description: "Corporate mailboxes & webmail",
                },
                {
                    title: "Executive Staff Portal",
                    path: "/staff",
                    icon: Briefcase,
                    description: "Executive workspace",
                },
            ],
        },
        {
            title: "Finance & Records",
            accentColor: "text-cyan-400",
            items: [
                {
                    title: "All Transactions",
                    path: "/history",
                    icon: BarChart3,
                    description: "System-wide orders & trip ledger",
                },
                {
                    title: "Payments & Invoices",
                    path: "/my-payments",
                    icon: CreditCard,
                    description: "Payment records & receipts",
                },
            ],
        },
        {
            title: "System & Media",
            accentColor: "text-violet-400",
            items: [
                {
                    title: "Media Library",
                    path: "/admin/media",
                    icon: Image,
                    description: "Upload & manage website assets",
                    badge: "Media",
                    badgeColor: "bg-violet-500/20 text-violet-400",
                },
                {
                    title: "Audit Logs",
                    path: "/admin/audit",
                    icon: ShieldAlert,
                    description: "Security audit & activity history",
                },
            ],
        },
    ],
};

// ─── 5. Staff Nav Fallback ───────────────────────────────────────────────────

const staffNav: RoleNav = {
    roleLabel: "Operations Staff",
    roleColor: "text-emerald-400",
    roleBg: "bg-emerald-500/10 border-emerald-500/20",
    roleDot: "bg-emerald-400",
    activeItemClass: "bg-emerald-600/15 text-emerald-300 border-emerald-500/30 shadow-emerald-950/20 shadow-sm",
    activeIconClass: "bg-emerald-500/20 text-emerald-400",
    activeIndicatorClass: "bg-emerald-400",
    sections: [
        {
            title: "Staff Operations",
            accentColor: "text-emerald-400",
            items: [
                { title: "Executive Workspace", path: "/staff", icon: Briefcase, description: "Operations portal" },
                { title: "Company Emails", path: "/admin/emails", icon: Mail, description: "Internal mailboxes & webmail" },
            ],
        },
        {
            title: "Records & Activity",
            accentColor: "text-cyan-400",
            items: [
                { title: "Order History", path: "/history", icon: Clock, description: "Past transactions & services" },
                { title: "Payments", path: "/my-payments", icon: CreditCard, description: "Payment transactions" },
            ],
        },
    ],
};

// ─── Role Resolver ────────────────────────────────────────────────────────────

export function getRoleConfig(
    role: string,
    user?: any,
    currentPath = "",
    roles: string[] = []
): RoleNav {
    const p = (currentPath || "").toLowerCase();
    const metaRole = user?.user_metadata?.["role"] as string | undefined;
    const riderCat = (user?.user_metadata?.["rider_category"] || user?.user_metadata?.["category"]) as string | undefined;
    const email = user?.email?.toLowerCase() || "";
    const allRoles = new Set<string>([role, metaRole, riderCat, ...roles].filter(Boolean) as string[]);

    const isRiderOrDriver =
        allRoles.has("driver") ||
        allRoles.has("dispatch_rider") ||
        role === "driver" ||
        role === "dispatch_rider" ||
        metaRole === "driver" ||
        metaRole === "dispatch_rider" ||
        riderCat === "driver" ||
        riderCat === "dispatch_rider";

    const isDispatchCategory =
        role === "dispatch_rider" ||
        metaRole === "dispatch_rider" ||
        riderCat === "dispatch_rider" ||
        allRoles.has("dispatch_rider");

    const effectiveDriverNav: RoleNav = isDispatchCategory
        ? { ...driverNav, roleLabel: "Dispatch Rider" }
        : driverNav;

    // 1. If currently inside driver/rider console routes, ALWAYS render driver navigation
    if (p.startsWith("/drive") || p.startsWith("/driver-dispatch")) {
        return effectiveDriverNav;
    }

    // 2. If the user is a registered driver or dispatch rider and NOT actively on admin/dispatcher routes
    if (isRiderOrDriver && !p.startsWith("/admin") && !p.startsWith("/dispatcher")) {
        return effectiveDriverNav;
    }

    // 3. Dispatcher operations
    const isDispatcher =
        p.startsWith("/dispatcher") ||
        allRoles.has("swift_dispatcher") ||
        allRoles.has("dispatcher") ||
        role === "swift_dispatcher" ||
        role === "dispatcher";

    if (isDispatcher && !p.startsWith("/admin")) {
        return dispatcherNav;
    }

    // 4. Administrator operations
    const SUPER_ADMINS = [
        "barakahdevcentre@gmail.com",
        "barakahdevelopmentcentre@gmail.com",
    ];
    const isSuperAdmin = email && SUPER_ADMINS.includes(email);
    const isAdmin =
        isSuperAdmin ||
        p.startsWith("/admin") ||
        allRoles.has("administrator") ||
        allRoles.has("admin") ||
        allRoles.has("swift_manager") ||
        role === "administrator" ||
        role === "admin" ||
        role === "swift_manager";

    if (isAdmin) {
        return adminNav;
    }

    // 5. Staff operations
    const isStaff =
        p.startsWith("/staff") ||
        allRoles.has("staff") ||
        allRoles.has("programme_officer") ||
        allRoles.has("content_editor") ||
        role === "staff" ||
        role === "programme_officer" ||
        role === "content_editor";

    if (isStaff) {
        return staffNav;
    }

    // 6. Default Customer navigation
    return customerNav;
}

// ─── Active Nav Item Matcher ──────────────────────────────────────────────────

export function isNavItemActive(
    itemPath: string,
    currentPath: string,
    currentSearch: Record<string, any>,
    allItemPaths: string[]
): boolean {
    const [targetPath, targetQuery] = itemPath.split("?");
    const targetParams = targetQuery
        ? Object.fromEntries(new URLSearchParams(targetQuery).entries())
        : null;

    // If item specifies query parameters (e.g. ?service=ride), both path and search param must match
    if (targetParams) {
        if (currentPath !== targetPath) return false;
        return Object.entries(targetParams).every(
            ([k, v]) => String(currentSearch[k] ?? "") === String(v)
        );
    }

    // Exact path match
    if (currentPath === targetPath) {
        // If current URL has a query that another item targets specifically on this path, don't steal
        const hasSpecificQueryItem = allItemPaths.some((p) => {
            const [pPath, pQuery] = p.split("?");
            if (pPath !== currentPath || !pQuery) return false;
            const params = Object.fromEntries(new URLSearchParams(pQuery).entries());
            return Object.entries(params).every(
                ([k, v]) => String(currentSearch[k] ?? "") === String(v)
            );
        });
        if (hasSpecificQueryItem) return false;
        return true;
    }

    // Subpath prefix match: only if currentPath is under targetPath + '/'
    if (currentPath.startsWith(targetPath + "/")) {
        // Check if there is a more specific (longer) match among all items in this sidebar
        const hasMoreSpecificMatch = allItemPaths.some((other) => {
            const otherPath = other.split("?")[0] || "";
            return (
                otherPath !== (targetPath || "") &&
                otherPath.length > (targetPath || "").length &&
                (currentPath === otherPath || currentPath.startsWith(otherPath + "/"))
            );
        });
        return !hasMoreSpecificMatch;
    }

    return false;
}

// ─── Nav Item Component ───────────────────────────────────────────────────────

interface NavItemProps {
    item: NavItem;
    currentPath: string;
    currentSearch: Record<string, any>;
    allItemPaths: string[];
    roleNav: RoleNav;
    onItemClick?: () => void;
}

export function SidebarNavItem({
    item,
    currentPath,
    currentSearch,
    allItemPaths,
    roleNav,
    onItemClick,
}: NavItemProps) {
    const Icon = item.icon;
    const isActive = isNavItemActive(item.path, currentPath, currentSearch, allItemPaths);

    const [pathOnly, searchStr] = item.path.split("?");
    const searchObj = searchStr
        ? Object.fromEntries(new URLSearchParams(searchStr).entries())
        : undefined;

    return (
        <Link
            to={pathOnly as any}
            search={searchObj as any}
            onClick={onItemClick}
            className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                    ? roleNav.activeItemClass
                    : "text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800"
            }`}
        >
            {/* Active indicator bar */}
            {isActive && (
                <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full -ml-px ${roleNav.activeIndicatorClass}`}
                />
            )}

            {/* Icon */}
            <div
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isActive
                        ? roleNav.activeIconClass
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
    const currentSearch = (location.search as Record<string, any>) || {};
    const auth = useAuth() as any;
    const user = auth?.user || auth?.session?.user;
    const logout = auth?.logout || auth?.signOut;
    const role = auth?.role ?? "registered_user";
    const roles = auth?.roles ?? [];
    const config = getRoleConfig(role, user, currentPath, roles);

    const displayName =
        user?.user_metadata?.full_name || user?.email || "User";
    const initials = displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const allItemPaths = config.sections.flatMap((s) => s.items.map((i) => i.path));
    const defaultOpenSections = config.sections.map((_, i) => `section-${i}`);

    return (
        <aside
            className={`w-64 bg-slate-950 border-r border-slate-800/60 flex flex-col h-screen sticky top-0 ${className}`}
        >
            {/* ═══ SCROLLABLE BODY ═══ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {/* Brand logo: Always SwiftMove */}
                <Link
                    to="/swiftmove"
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
                    title="SwiftMove Logistics & Ride Hailing"
                >
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden shadow-lg group-hover:scale-105 transition-transform bg-white ring-2 ring-orange-500/50 shadow-orange-950/30">
                        <img
                            src="/swiftmove-logo.jpg"
                            alt="SwiftMove Logo"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div>
                        <h2 className="text-base font-black tracking-tight leading-none text-orange-400">
                            SwiftMove
                        </h2>
                        <p className="text-[9px] font-semibold mt-1 tracking-wider uppercase text-orange-300/70">
                            Logistics & Ride Hailing
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
                                        currentSearch={currentSearch}
                                        allItemPaths={allItemPaths}
                                        roleNav={config}
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
                        <Link to="/swiftmove">
                            <Globe2 className="h-3.5 w-3.5" /> SwiftMove Home
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
