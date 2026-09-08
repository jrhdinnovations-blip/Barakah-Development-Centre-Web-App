import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV, ORG } from "@/lib/site";
import { BarakahCentreLogo } from "@/components/BarakahCentreLogo";
import { supabase } from "@/integrations/supabase/client";
import { getStaffMailboxes, getCompanyDomains, type StaffMailbox, type CompanyDomain } from "@/lib/company-email-service";

/** Shown only to logged-in staff who have a corporate mailbox provisioned. */
function StaffMailboxButton() {
  const [mailbox, setMailbox] = useState<StaffMailbox | null>(null);
  const [domain, setDomain] = useState<CompanyDomain | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Look up profile for stored corporate_email
        const { data: profile } = await supabase
          .from("profiles")
          .select("corporate_email")
          .eq("id", user.id)
          .maybeSingle();
        const corpEmail = profile?.corporate_email as string | null;

        const mailboxes = getStaffMailboxes();
        const found =
          mailboxes.find((m) => m.userId === user.id) ??
          (corpEmail
            ? mailboxes.find((m) => m.email.toLowerCase() === corpEmail.toLowerCase())
            : undefined);

        if (found && !cancelled) {
          setMailbox(found);
          const domains = getCompanyDomains();
          const dom = domains.find((d) => d.domain.toLowerCase() === found.domain.toLowerCase()) ?? null;
          setDomain(dom);
          // Small delay so it animates in gracefully
          setTimeout(() => { if (!cancelled) setVisible(true); }, 400);
        }
      } catch {
        // Not a staff user / not logged in — hide silently
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!mailbox) return null;

  const webmailUrl = domain?.webmailUrl ?? `https://mail.${mailbox.domain}`;

  return (
    <a
      href={webmailUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open your mailbox — ${mailbox.email}`}
      aria-label={`Open staff mailbox: ${mailbox.email}`}
      className={`group relative flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary backdrop-blur transition-all duration-500 hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/30 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{ transition: "opacity 0.5s ease, transform 0.5s ease, background 0.2s, color 0.2s, box-shadow 0.2s" }}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Mail className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">{mailbox.email}</span>
      {/* Tooltip on mobile */}
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-sidebar-foreground px-2 py-1 text-xs text-sidebar opacity-0 shadow transition-opacity group-hover:opacity-100 sm:hidden">
        {mailbox.email}
      </span>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="kente-divider" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <div className="mb-4">
            <BarakahCentreLogo variant="footer" />
          </div>

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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs opacity-60 sm:px-6">
          <span>© {new Date().getFullYear()} {ORG.legalName}. All rights reserved.</span>
          {/* Staff mailbox quick-access — only visible to logged-in staff */}
          <StaffMailboxButton />
          <span className="hidden md:inline">{ORG.values.join(" · ")}</span>
        </div>
      </div>
    </footer>
  );
}
