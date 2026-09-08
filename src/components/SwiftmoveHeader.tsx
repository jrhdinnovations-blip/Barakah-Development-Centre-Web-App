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
    <header className="sticky top-0 z-50 w-full border-b border-slate-700/70 bg-slate-900/90 backdrop-blur-xl text-slate-100 shadow-md">
      {/* Top Bar linking back to parent ecosystem */}
      <div className="bg-slate-800/70 border-b border-slate-700/50 px-4 py-1 text-xs text-slate-400">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-200">SwiftMove Logistics &amp; Ride Hailing</span>
            <span className="text-slate-400 hidden sm:inline">— On-Demand Passenger Rides &amp; Express Parcel Dispatch</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-semibold">● 24/7 Operations</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/my-swift-move" className="flex items-center gap-2 group">
          <img
            src="/swiftmove-logo.jpg"
            alt="SwiftMove Logo"
            className="h-10 object-contain mix-blend-screen transition-transform group-hover:scale-105"
          />
        </Link>
        
        {/* Customer & Role-Specific Navigation */}
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link 
            to="/my-swift-move" 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            activeProps={{ className: "text-blue-400 font-semibold" }}
          >
            Book Dispatch
          </Link>
          <Link 
            to="/my-vehicle-hires" 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            activeProps={{ className: "text-blue-400 font-semibold" }}
          >
            Request a Ride
          </Link>
          <Link 
            to="/history" 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            activeProps={{ className: "text-blue-400 font-semibold" }}
          >
            History
          </Link>

          {/* Dispatcher, Driver, and Admin Console shortcuts */}
          {isDispatcher && (
            <Link 
              to="/dispatcher" 
              className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20"
            >
              <Radio className="h-3.5 w-3.5" />
              Dispatcher Console
            </Link>
          )}

          {isDriver && (
            <Link 
              to="/drive" 
              className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20"
            >
              <Truck className="h-3.5 w-3.5" />
              Driver Console
            </Link>
          )}

          {isAdmin && (
            <Link 
              to="/admin" 
              className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Portal
            </Link>
          )}

          {/* User Status & Sign Out */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full capitalize">
                {isDriver ? 'Driver' : isDispatcher ? 'Dispatcher' : isAdmin ? 'Admin' : 'Customer'}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}