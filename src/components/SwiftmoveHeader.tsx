import { Link, useNavigate } from '@tanstack/react-router';
import { Truck, ArrowLeft, LogOut, Radio, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function SwiftmoveHeader() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const isDriver = role === 'driver' || role === 'dispatch_rider';
  const isDispatcher = role === 'swift_dispatcher' || role === 'dispatcher';
  const isAdmin = role === 'administrator' || role === 'admin' || role === 'swift_manager';

  async function handleSignOut() {
    await logout();
    navigate({ to: '/auth', search: { mode: 'login' } });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-xl text-slate-800 shadow-sm">
      {/* Top Bar linking back to parent ecosystem */}
      <div className="bg-slate-50 border-b border-slate-200/70 px-4 py-1 text-xs text-slate-500">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">SwiftMove Logistics &amp; Ride Hailing</span>
            <span className="text-slate-500 hidden sm:inline">— On-Demand Passenger Rides &amp; Express Parcel Dispatch</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="text-emerald-600 font-bold">● 24/7 Operations</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/swiftmove" className="flex items-center gap-2.5 group" title="SwiftMove Home">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-black text-slate-900 tracking-tight leading-tight block">SwiftMove</span>
            <span className="text-xs text-orange-600 font-bold block -mt-1">Logistics &amp; Rides</span>
          </div>
        </Link>
        
        {/* Customer & Role-Specific Navigation */}
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link 
            to="/my-swift-move" 
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            activeProps={{ className: "text-orange-600 font-bold" }}
          >
            Send a Parcel
          </Link>
          <Link 
            to="/my-vehicle-hires" 
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            activeProps={{ className: "text-blue-600 font-bold" }}
          >
            Request a Ride
          </Link>
          <Link 
            to="/history" 
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            activeProps={{ className: "text-emerald-600 font-bold" }}
          >
            History
          </Link>

          {/* Dispatcher, Driver, and Admin Console shortcuts */}
          {isDispatcher && (
            <Link 
              to="/dispatcher" 
              className="text-xs sm:text-sm font-semibold text-cyan-700 hover:text-cyan-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200"
            >
              <Radio className="h-3.5 w-3.5 text-cyan-600" />
              Dispatcher Console
            </Link>
          )}

          {isDriver && (
            <Link 
              to="/drive" 
              className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200"
            >
              <Truck className="h-3.5 w-3.5 text-emerald-600" />
              Driver Console
            </Link>
          )}

          {isAdmin && (
            <Link 
              to="/admin" 
              className="text-xs sm:text-sm font-semibold text-purple-700 hover:text-purple-800 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200"
            >
              <Shield className="h-3.5 w-3.5 text-purple-600" />
              Admin Portal
            </Link>
          )}

          {/* User Status & Sign Out */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full capitalize">
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
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}