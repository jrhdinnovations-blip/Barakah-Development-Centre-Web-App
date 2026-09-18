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
      <div className={`inline-block relative group w-full max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto ${className}`}>
        <div className="relative rounded-3xl overflow-hidden p-2 bg-gradient-to-br from-orange-500/20 via-slate-900/40 to-blue-500/20 border-2 border-orange-400/40 shadow-2xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-300 group-hover:scale-[1.01]">
          <img
            src="/swiftmove-hero-banner.jpg"
            alt="SwiftMove Express Network — Need it moved? We move it swift."
            className="w-full h-auto rounded-2xl object-cover shadow-inner block"
          />
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-3 p-2 pr-4 rounded-2xl bg-slate-950/95 border border-orange-500/40 shadow-xl shadow-orange-500/15 ${className}`}>
        <img
          src="/swiftmove-logo-banner.png"
          alt="SwiftMove Express Network"
          className="h-10 sm:h-11 w-auto object-contain rounded-lg"
        />
        <div className="flex flex-col text-left">
          <span className="text-sm font-black text-white tracking-wider">SWIFTMOVE</span>
          <span className="text-[10px] font-bold text-orange-400 -mt-0.5 tracking-wider uppercase">EXPRESS NETWORK</span>
        </div>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <Link
        to={homePath as any}
        className={`inline-flex items-center gap-3 group select-none ${className}`}
        aria-label="SwiftMove Logistics & Rides Home"
      >
        <div className="relative flex shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/30 bg-slate-950 px-3 py-1.5 group-hover:ring-orange-500/60 transition-all duration-200">
          <img
            src="/swiftmove-logo-banner.png"
            alt="SwiftMove Express Network"
            className="h-10 sm:h-11 w-auto object-contain block"
          />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-lg font-black text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">
            SwiftMove
          </span>
          <span className="text-xs font-bold text-orange-600 tracking-wide">
            Express Network · By Barakah
          </span>
        </div>
      </Link>
    );
  }

  // ── Header variant (default) ─────────────────────────────────────────
  return (
    <Link
      to={homePath as any}
      className={`inline-flex items-center gap-3 group select-none ${className}`}
      aria-label="SwiftMove Logistics & Rides Home"
    >
      {/* Logo image — wide banner on dark pill background with high visibility & perfect fit */}
      <div
        className="relative flex shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/30 bg-slate-950 group-hover:ring-orange-500/60 transition-all duration-200"
        style={{ height: '48px', padding: '4px 10px' }}
      >
        <img
          src="/swiftmove-logo-banner.png"
          alt="SwiftMove Express Network"
          style={{ height: '100%', width: 'auto', minWidth: '130px', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Text label with high visibility */}
      {showText && (
        <div className="flex flex-col text-left leading-tight pl-1 border-l-2 border-orange-500/30">
          <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">
            SwiftMove
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-orange-600 tracking-wider uppercase">
            Logistics &amp; Rides
          </span>
        </div>
      )}
    </Link>
  );
}
