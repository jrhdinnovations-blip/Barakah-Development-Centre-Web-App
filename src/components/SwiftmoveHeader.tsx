import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, LogOut, Radio, Shield, Truck, Package, Car, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { isSwiftmoveDomain } from '@/lib/domain-detection';
import { SwiftmoveLogo } from '@/components/SwiftmoveLogo';

export function SwiftmoveHeader() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const isDriver = role === 'driver' || role === 'dispatch_rider';
  const isDispatcher = role === 'swift_dispatcher' || role === 'dispatcher';
  const isAdmin = role === 'administrator' || role === 'admin' || role === 'swift_manager';
  const isSwiftDomain = isSwiftmoveDomain();
  const homePath = isSwiftDomain ? '/' : '/swiftmove';

  async function handleSignOut() {
    await logout();
    navigate({ to: '/auth', search: { mode: 'login' } });
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-xl text-slate-800 shadow-sm">
        {/* Top Bar — hidden on mobile to save space */}
        <div className="hidden sm:block bg-slate-50 border-b border-slate-200/70 px-4 py-1 text-xs text-slate-500">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">SwiftMove Logistics &amp; Ride Hailing</span>
              <span className="text-slate-500 hidden lg:inline">— On-Demand Passenger Rides &amp; Express Parcel Dispatch</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="text-emerald-600 font-bold">● 24/7 Operations</span>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <SwiftmoveLogo />

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-3 sm:gap-5">
            <Link
              to="/my-swift-move"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              activeProps={{ className: "text-orange-600 font-bold" }}
            >
              Send a Parcel
            </Link>
            <Link
              to="/my-vehicle-hires"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              activeProps={{ className: "text-blue-600 font-bold" }}
            >
              Request a Ride
            </Link>
            <Link
              to="/history"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              activeProps={{ className: "text-emerald-600 font-bold" }}
            >
              History
            </Link>

            {isDispatcher && (
              <Link
                to="/dispatcher"
                className="text-xs sm:text-sm font-semibold text-cyan-700 hover:text-cyan-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 whitespace-nowrap"
              >
                <Radio className="h-3.5 w-3.5 text-cyan-600" />
                Dispatcher Console
              </Link>
            )}

            {isDriver && (
              <Link
                to="/drive"
                className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 whitespace-nowrap"
              >
                <Truck className="h-3.5 w-3.5 text-emerald-600" />
                Driver Console
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                className="text-xs sm:text-sm font-semibold text-purple-700 hover:text-purple-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 whitespace-nowrap"
              >
                <Shield className="h-3.5 w-3.5 text-purple-600" />
                Admin Portal
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full capitalize">
                  {isDriver ? 'Driver' : isDispatcher ? 'Dispatcher' : isAdmin ? 'Admin' : 'Customer'}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors shadow-sm whitespace-nowrap"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile right side — just sign out icon */}
          <div className="flex sm:hidden items-center gap-2">
            {/* Role badge pill for mobile */}
            {user && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize
                {isDriver ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                isDispatcher ? 'bg-cyan-50 border-cyan-200 text-cyan-700' :
                isAdmin ? 'bg-purple-50 border-purple-200 text-purple-700' :
                'bg-blue-50 border-blue-200 text-blue-700'}">
                {isDriver ? 'Driver' : isDispatcher ? 'Dispatcher' : isAdmin ? 'Admin' : 'Customer'}
              </span>
            )}
            {user ? (
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/auth"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] px-1 pb-safe">
        <div className="flex items-center justify-around">
          <Link
            to="/my-swift-move"
            className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-orange-600"
            activeProps={{ className: 'active text-orange-600' }}
          >
            <Package className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-tight">Dispatch</span>
          </Link>

          <Link
            to="/my-vehicle-hires"
            className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-blue-600"
            activeProps={{ className: 'active text-blue-600' }}
          >
            <Car className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-tight">Ride</span>
          </Link>

          <Link
            to="/history"
            className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-emerald-600"
            activeProps={{ className: 'active text-emerald-600' }}
          >
            <Clock className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-tight">History</span>
          </Link>

          {isDispatcher && (
            <Link
              to="/dispatcher"
              className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-cyan-600"
              activeProps={{ className: 'active text-cyan-600' }}
            >
              <Radio className="h-5 w-5" />
              <span className="text-[10px] font-semibold leading-tight">Console</span>
            </Link>
          )}

          {isDriver && (
            <Link
              to="/drive"
              className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-emerald-600"
              activeProps={{ className: 'active text-emerald-600' }}
            >
              <Truck className="h-5 w-5" />
              <span className="text-[10px] font-semibold leading-tight">Drive</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors text-slate-500 [&.active]:text-purple-600"
              activeProps={{ className: 'active text-purple-600' }}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[10px] font-semibold leading-tight">Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}