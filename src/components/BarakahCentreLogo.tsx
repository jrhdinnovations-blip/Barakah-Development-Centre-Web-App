import { Link } from "@tanstack/react-router";

interface BarakahCentreLogoProps {
  className?: string;
  variant?: "default" | "light" | "footer" | "medallion";
  showTagline?: boolean;
}

export function BarakahCentreLogo({
  className = "",
  variant = "default",
  showTagline = false,
}: BarakahCentreLogoProps) {
  const isLight = variant === "light" || variant === "footer";

  if (variant === "medallion") {
    return (
      <Link to="/" className={`inline-block group ${className}`} aria-label="Barakah Development Centre Home">
        <div className="relative p-1.5 rounded-full bg-gradient-to-b from-amber-400/30 via-slate-800 to-slate-950 border border-amber-400/40 shadow-2xl group-hover:scale-105 transition-transform">
          <img
            src="/barakah-centre-logo.png"
            alt="Barakah Development Centre — Building a Better Today for a Brighter Tomorrow"
            width={144}
            height={144}
            className="h-28 w-28 sm:h-36 sm:w-36 rounded-full object-cover"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>
      </Link>
    );
  }

  return (
    <Link to="/" className={`inline-flex items-center gap-3 group select-none ${className}`} aria-label="Barakah Development Centre Home">
      {/* Official Brand Logo Medallion */}
      <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-md shadow-amber-950/20 ring-2 ring-amber-500/40 group-hover:scale-105 transition-transform duration-200 bg-white">
        <img
          src="/barakah-centre-logo.png"
          alt="Barakah Development Centre Logo"
          width={44}
          height={44}
          className="h-full w-full object-cover"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>

      {/* Typography matching official brand styling */}
      <div className="flex flex-col text-left">
        <span
          className={`font-display text-lg sm:text-xl font-bold tracking-tight leading-none ${
            isLight ? "text-white" : "text-foreground"
          }`}
        >
          BARAKAH
        </span>
        <span
          className={`text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase mt-1 ${
            isLight ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          Development Centre
        </span>
        {showTagline && (
          <span className="text-[9px] text-muted-foreground tracking-wider hidden sm:block mt-0.5 italic">
            Building a Better Today for a Brighter Tomorrow
          </span>
        )}
      </div>
    </Link>
  );
}
