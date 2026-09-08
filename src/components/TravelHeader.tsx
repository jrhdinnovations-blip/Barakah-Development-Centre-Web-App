import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, Compass, Globe2, LayoutDashboard, LogOut, Menu, MoonStar, Plane, ShieldCheck, Ticket } from "lucide-react";
import { useState } from "react";
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

export function TravelHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/travel-and-pilgrimage", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-slate-950/90 backdrop-blur-md text-slate-100 shadow-lg shadow-black/20">
      {/* Top micro-bar for parent ecosystem context */}
      <div className="bg-emerald-950/70 border-b border-emerald-800/30 px-4 py-1 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-medium text-amber-300">Barakah Travel &amp; Tours</span>
            <span className="text-slate-400 hidden sm:inline">— Excellence beyond Borders · Licensed Umrah &amp; Hajj Facilitators</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-white transition-colors"
            title="Return to Barakah Development Centre Main Hub"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Main Barakah Hub</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand Logo - Official Barakah Travel and Tours Limited */}
        <Link to="/travel-and-pilgrimage" className="flex items-center gap-3 group">
          <div className="rounded-xl bg-white/95 px-3 py-1.5 shadow-sm transition-transform group-hover:scale-105">
            <img
              src="/barakah-logo-cropped.png"
              alt="Barakah Travel and Tours Limited"
              className="h-9 sm:h-10 w-auto object-contain"
              style={{ maxWidth: "185px" }}
            />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Travel Platform">
          <Link
            to="/travel-and-pilgrimage"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
            activeProps={{ className: "text-amber-400 bg-amber-500/10 font-semibold" }}
          >
            Overview &amp; Services
          </Link>
          <Link
            to="/travel"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
            activeProps={{ className: "text-amber-400 bg-amber-500/10 font-semibold" }}
          >
            <Plane className="h-4 w-4 text-amber-400" />
            Travel Packages
          </Link>
          <Link
            to="/my-journey"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
            activeProps={{ className: "text-amber-400 bg-amber-500/10 font-semibold" }}
          >
            <Compass className="h-4 w-4 text-emerald-400" />
            My Journey
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/my-journey"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500"
              >
                <Compass className="h-4 w-4" />
                My Pilgrim Portal
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                to="/travel"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500"
              >
                <Ticket className="h-4 w-4" />
                Explore Packages
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              aria-label="Open Travel menu"
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-slate-950 text-slate-100 border-slate-800 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">
                  <img
                    src="/barakah-logo-cropped.png"
                    alt="Barakah Travel and Tours Limited"
                    className="h-10 w-auto object-contain"
                    style={{ maxWidth: "160px", height: "auto" }}
                  />
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 flex flex-col gap-1.5" aria-label="Mobile Travel Navigation">
              <Link
                to="/travel-and-pilgrimage"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900"
              >
                <Globe2 className="h-4 w-4 text-amber-400" />
                Overview &amp; Services
              </Link>
              <Link
                to="/travel"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900"
              >
                <Plane className="h-4 w-4 text-amber-400" />
                Travel Packages
              </Link>
              <Link
                to="/my-journey"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900"
              >
                <Compass className="h-4 w-4 text-emerald-400" />
                My Journey (Pilgrim Portal)
              </Link>
              
              <div className="my-3 border-t border-slate-800 pt-3">
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to Barakah Development Centre Hub
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t border-slate-800 pt-6">
              {user ? (
                <>
                  <Link
                    to="/my-journey"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-amber-400"
                  >
                    My Pilgrim Portal
                  </Link>
                  <button
                    onClick={signOut}
                    className="rounded-lg border border-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    search={{ mode: "login" }}
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-800 px-4 py-2.5 text-center text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/travel"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-amber-400"
                  >
                    Explore Packages
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
