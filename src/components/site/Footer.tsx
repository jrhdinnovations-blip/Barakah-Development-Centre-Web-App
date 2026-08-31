import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { NAV, ORG } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="kente-divider" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <img
            src="/barakah-logo-cropped.png"
            alt="Barakah Travel and Tours Limited"
            className="h-14 w-auto object-contain mb-3"
            style={{ maxWidth: '200px' }}
          />
          <p className="font-display text-xl font-semibold">{ORG.legalName}</p>
          <p className="mt-1 text-sm opacity-70">{ORG.rc}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-80">{ORG.tagline}</p>
          <p className="mt-3 text-xs tracking-wide opacity-60">
            {ORG.promise.join(" • ")}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide uppercase opacity-70">Explore</p>
          <ul className="mt-4 grid grid-cols-1 gap-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-sm opacity-80 transition-opacity hover:opacity-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide uppercase opacity-70">Contact</p>
          <ul className="mt-4 space-y-3 text-sm opacity-80">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ORG.address}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ORG.phones.join(" · ")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <a href={`mailto:${ORG.email}`} className="hover:opacity-100">
                {ORG.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs opacity-60 sm:px-6 md:flex-row">
          <span>© {new Date().getFullYear()} {ORG.legalName}. All rights reserved.</span>
          <span>{ORG.values.join(" · ")}</span>
        </div>
      </div>
    </footer>
  );
}
