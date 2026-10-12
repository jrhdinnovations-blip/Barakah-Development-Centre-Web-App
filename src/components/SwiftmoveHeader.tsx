import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, Radio, Shield, Truck, Package, Car, Clock, LayoutDashboard, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { isSwiftmoveDomain } from '@/lib/domain-detection';
import { SwiftmoveLogo } from '@/components/SwiftmoveLogo';

export function SwiftmoveHeader() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const userMetaRole = user?.user_metadata?.['role'];
  const riderCat = user?.user_metadata?.['rider_category'];
  const userEmail = user?.email?.toLowerCase() || '';

  const isDriver =
    role === 'driver' ||
    role === 'dispatch_rider' ||
    userMetaRole === 'driver' ||
    userMetaRole === 'dispatch_rider' ||
    riderCat === 'dispatch_rider';

  const isDispatcher =
    role === 'swift_dispatcher' ||
    role === 'dispatcher' ||
    userMetaRole === 'swift_dispatcher' ||
    userMetaRole === 'dispatcher';

  const isAdmin =
    role === 'administrator' ||
    role === 'admin' ||
    role === 'swift_manager' ||
    userMetaRole === 'administrator' ||
    ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com', 'raymondlongdiem22@gmail.com'].includes(userEmail);

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
          <nav className="hidden sm:flex items-center gap-1.5 md:gap-3">
            <Link
              to="/my-swift-move"
              search={{ service: 'ride' }}
              className="text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100/80 border border-blue-200"
            >
              <Car className="h-4 w-4 text-blue-600" />
              Order a Ride
            </Link>
            <Link
              to="/my-swift-move"
              search={{ service: 'parcel' }}
              className="text-xs sm:text-sm font-semibold text-orange-700 hover:text-orange-800 transition-colors whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100/80 border border-orange-200"
            >
              <Package className="h-4 w-4 text-orange-600" />
              Send a Parcel
            </Link>
            <Link
              to="/my-swift-move"
              search={{ service: 'track' }}
              className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              Track
            </Link>
            <Link
              to="/my-swift-move"
              search={{ service: 'history' }}
              className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
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
                className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-sm whitespace-nowrap"
              >
                <Truck className="h-4 w-4 text-emerald-600" />
                Rider &amp; Driver Console
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
                  {isDriver ? 'Driver / Rider' : isDispatcher ? 'Dispatcher' : isAdmin ? 'Admin' : 'Customer'}
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
                search={{ mode: 'login', app: 'swiftmove' }}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors shadow-sm whitespace-nowrap"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile right side — role console button + sign out icon */}
          <div className="flex sm:hidden items-center gap-2">
            {user ? (
              <>
                {isDriver && (
                  <Link
                    to="/drive"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white flex items-center gap-1 shadow-sm whitespace-nowrap"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Rider Console</span>
                  </Link>
                )}
                {isDispatcher && (
                  <Link
                    to="/dispatcher"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-cyan-600 text-white flex items-center gap-1 shadow-sm whitespace-nowrap"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Dispatcher</span>
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-600 text-white flex items-center gap-1 shadow-sm whitespace-nowrap"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Admin</span>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-1.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                search={{ mode: 'login', app: 'swiftmove' }}
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
            search={{ service: 'ride' }}
            className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors text-slate-600 hover:text-blue-600"
          >
            <Car className="h-5 w-5 text-blue-600" />
            <span className="text-[10px] font-bold leading-tight">Ride</span>
          </Link>

          <Link
            to="/my-swift-move"
            search={{ service: 'parcel' }}
            className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors text-slate-600 hover:text-orange-600"
          >
            <Package className="h-5 w-5 text-orange-600" />
            <span className="text-[10px] font-bold leading-tight">Parcel</span>
          </Link>

          <Link
            to="/my-swift-move"
            search={{ service: 'track' }}
            className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors text-slate-600 hover:text-slate-900"
          >
            <Search className="h-5 w-5 text-slate-600" />
            <span className="text-[10px] font-bold leading-tight">Track</span>
          </Link>

          <Link
            to="/my-swift-move"
            search={{ service: 'history' }}
            className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors text-slate-600 hover:text-slate-900"
          >
            <Clock className="h-5 w-5 text-slate-600" />
            <span className="text-[10px] font-bold leading-tight">History</span>
          </Link>

          {isDispatcher && (
            <Link
              to="/dispatcher"
              className="flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl transition-colors text-cyan-600 bg-cyan-50 font-bold border border-cyan-200"
              activeProps={{ className: 'active text-cyan-700 bg-cyan-100' }}
            >
              <Radio className="h-5 w-5 text-cyan-600" />
              <span className="text-[10px] font-bold leading-tight">Dispatcher</span>
            </Link>
          )}

          {isDriver && (
            <Link
              to="/drive"
              className="flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl transition-colors text-emerald-600 bg-emerald-50 font-bold border border-emerald-200"
              activeProps={{ className: 'active text-emerald-700 bg-emerald-100' }}
            >
              <Truck className="h-5 w-5 text-emerald-600" />
              <span className="text-[10px] font-bold leading-tight">Rider Console</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl transition-colors text-purple-600 bg-purple-50 font-bold border border-purple-200"
              activeProps={{ className: 'active text-purple-700 bg-purple-100' }}
            >
              <Shield className="h-5 w-5 text-purple-600" />
              <span className="text-[10px] font-bold leading-tight">Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}