import { Link } from '@tanstack/react-router';
import { Truck, MapPin } from 'lucide-react';

export function SwiftmoveHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-blue-500" />
          <span className="text-xl font-bold text-white tracking-tight">Swift Move</span>
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link 
            to="/my-swift-move" 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Book Dispatch
          </Link>
          <Link 
            to="/driver-dispatch" 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Driver Console
          </Link>
        </nav>
      </div>
    </header>
  );
}