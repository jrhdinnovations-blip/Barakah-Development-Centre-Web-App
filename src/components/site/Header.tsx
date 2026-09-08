import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NAV, ORG } from "@/lib/site";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BarakahCentreLogo } from "@/components/BarakahCentreLogo";


export function SiteHeader() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const dashboardTarget =
    role === "driver" || role === "dispatch_rider"
      ? "/drive"
      : role === "swift_dispatcher" || role === "dispatcher"
      ? "/dispatcher"
      : role === "administrator" || role === "admin" || role === "swift_manager"
      ? "/admin"
      : "/my-barakah";
  const dashboardLabel =
    role === "driver" || role === "dispatch_rider"
      ? "Driver Console"
      : role === "swift_dispatcher" || role === "dispatcher"
      ? "Dispatcher Console"
      : role === "administrator" || role === "admin" || role === "swift_manager"
      ? "Admin Dashboard"
      : "Dashboard";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <BarakahCentreLogo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) =>
            item.children ? (
              <DropdownMenu key={item.label}>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground">
                  {item.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuItem asChild>
                    <Link to={item.to} className="font-semibold">
                      {item.label} — Overview
                    </Link>
                  </DropdownMenuItem>
                  {item.children.map((child) => (
                    <DropdownMenuItem key={child.to} asChild>
                      <Link to={child.to} className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{child.label}</span>
                        {child.description && (
                          <span className="text-xs text-muted-foreground">{child.description}</span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "text-primary bg-accent" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <NotificationBell />
              <Link
                to={dashboardTarget as any}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LayoutDashboard className="h-4 w-4" />
                {dashboardLabel}
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ShieldCheck className="h-4 w-4" />
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile drawer */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <button
              aria-label="Open menu"
              className="rounded-md p-2 text-foreground hover:bg-accent"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">
                <BarakahCentreLogo />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => (
                <div key={item.label}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    {item.label}
                  </Link>
                  {item.children?.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={() => setOpen(false)}
                      className="block rounded-md py-2 pr-3 pl-7 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              {user ? (
                <>
                  <Link
                    to={dashboardTarget as any}
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
                  >
                    {dashboardLabel}
                  </Link>
                  <button
                    onClick={signOut}
                    className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-input px-4 py-2.5 text-center text-sm font-medium text-foreground"
                  >
                    Login
                  </Link>
                  <Link
                    to="/auth"
                    search={{ mode: "register" }}
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
                  >
                    Create My Barakah Account
                  </Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
