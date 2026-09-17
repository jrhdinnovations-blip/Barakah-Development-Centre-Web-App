import { Link } from '@tanstack/react-router';
import { isSwiftmoveDomain } from '@/lib/domain-detection';

interface SwiftmoveLogoProps {
  className?: string;
  variant?: 'header' | 'hero' | 'badge' | 'footer';
  showText?: boolean;
}

export function SwiftmoveLogo({
  className = '',
  variant = 'header',
  showText = true,
}: SwiftmoveLogoProps) {
  const isSwiftDomain = isSwiftmoveDomain();
  const homePath = isSwiftDomain ? '/' : '/swiftmove';

  if (variant === 'hero') {
    return (
      <div className={`inline-block relative group ${className}`}>
        <div className="relative rounded-3xl overflow-hidden p-1.5 bg-gradient-to-br from-orange-500/20 via-slate-900/40 to-blue-500/20 border border-orange-400/40 shadow-2xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-300 group-hover:scale-[1.02]">
          <img
            src="/swiftmove-logo.jpg"
            alt="SwiftMove Express Network — Move Smart. Move Swift."
            className="w-full max-w-[340px] sm:max-w-[420px] md:max-w-[480px] h-auto rounded-2xl object-cover shadow-inner"
          />
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 p-1 pr-3 rounded-2xl bg-slate-950/90 border border-orange-500/30 shadow-lg ${className}`}>
        <img
          src="/swiftmove-logo.jpg"
          alt="SwiftMove"
          className="h-8 w-8 rounded-xl object-cover"
        />
        <div className="flex flex-col text-left">
          <span className="text-xs font-black text-white tracking-wider">SWIFTMOVE</span>
          <span className="text-[9px] font-bold text-orange-400 -mt-0.5">EXPRESS NETWORK</span>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={homePath as any}
      className={`inline-flex items-center gap-3 group select-none ${className}`}
      aria-label="SwiftMove Logistics & Rides Home"
    >
      {/* Official Brand Logo Icon */}
      <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-orange-500/15 ring-2 ring-orange-500/30 bg-slate-950 group-hover:scale-105 transition-transform duration-200">
        <img
          src="/swiftmove-logo.jpg"
          alt="SwiftMove Logo"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-lg font-black text-slate-900 tracking-tight leading-none group-hover:text-orange-600 transition-colors">
            SwiftMove
          </span>
          <span className="text-[11px] font-bold text-orange-600 tracking-wide mt-0.5">
            Logistics &amp; Rides
          </span>
        </div>
      )}
    </Link>
  );
}
