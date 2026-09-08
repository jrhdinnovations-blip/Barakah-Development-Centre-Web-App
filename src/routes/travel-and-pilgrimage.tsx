import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  FileCheck,
  Globe2,
  HeartHandshake,
  MapPin,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/travel-and-pilgrimage")({
  head: () => ({
    meta: [
      { title: "Barakah Travel and Tours Limited — Excellence beyond Borders" },
      {
        name: "description",
        content:
          "Official travel and pilgrimage platform of Barakah Development Centre. Seamless Umrah & Hajj journeys, scholarly guidance, instalment payments, and curated global tours.",
      },
      { property: "og:title", content: "Barakah Travel and Tours Limited" },
      {
        property: "og:description",
        content: "Excellence beyond Borders — Trusted Umrah, Hajj & Educational Travel with flexible instalment plans.",
      },
    ],
  }),
  component: TravelAndPilgrimagePage,
});

function TravelAndPilgrimagePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-gradient-to-b from-amber-500/15 via-emerald-600/10 to-transparent blur-3xl -z-10" />
        <div className="pointer-events-none absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-emerald-700/10 blur-3xl -z-10" />

        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            {/* Dedicated Brand Badge & Logo Presentation */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-amber-500/30 shadow-2xl shadow-black/60 mb-5">
                <img
                  src="/barakah-logo-cropped.png"
                  alt="Barakah Travel and Tours Limited - Excellence beyond Borders"
                  className="h-20 sm:h-24 w-auto object-contain"
                />
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300 uppercase tracking-widest">
                <Sparkles className="h-3.5 w-3.5" />
                Excellence beyond Borders
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Sacred Journeys &amp; Global Expeditions,{" "}
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-emerald-300 bg-clip-text text-transparent">
                Elevated with Care.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed">
              Barakah Travel and Tours Limited delivers end-to-end spiritual pilgrimage (Umrah &amp; Hajj) and
              educational travel services. Experience trusted scholarly accompaniment, stress-free instalment
              payments, and vetted hospitality.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/travel" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-8 shadow-lg shadow-amber-500/25">
                  <Plane className="mr-2 h-5 w-5" /> View Available Packages
                </Button>
              </Link>
              <Link to="/my-journey" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white">
                  <Compass className="mr-2 h-5 w-5 text-emerald-400" /> Pilgrim Portal (My Journey)
                </Button>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-800/80 pt-8 text-center">
              <div className="p-3">
                <p className="text-2xl sm:text-3xl font-bold text-amber-400">100%</p>
                <p className="text-xs text-slate-400 mt-1">Licensed Partners</p>
              </div>
              <div className="p-3">
                <p className="text-2xl sm:text-3xl font-bold text-emerald-400">Instalments</p>
                <p className="text-xs text-slate-400 mt-1">Flexible Payment Plans</p>
              </div>
              <div className="p-3">
                <p className="text-2xl sm:text-3xl font-bold text-amber-400">Scholar</p>
                <p className="text-xs text-slate-400 mt-1">Guided Ziyarat &amp; Rites</p>
              </div>
              <div className="p-3">
                <p className="text-2xl sm:text-3xl font-bold text-emerald-400">24/7</p>
                <p className="text-xs text-slate-400 mt-1">On-Ground Support</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE PILLARS ── */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Why Travel with Barakah?</h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              We eliminate anxiety and logistical complexity so you can focus entirely on your spiritual and educational enrichment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-amber-500/40 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                  <CreditCard className="h-6 w-6 text-amber-400" />
                </div>
                <CardTitle className="text-white text-lg">Instalment Payment Structure</CardTitle>
                <CardDescription className="text-slate-400">
                  Never let finances stall your sacred intentions. Break down package costs into convenient monthly instalments leading right up to departure.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/80 border-slate-800 hover:border-emerald-500/40 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-emerald-400" />
                </div>
                <CardTitle className="text-white text-lg">Scholarly Mentorship</CardTitle>
                <CardDescription className="text-slate-400">
                  Accompanied by respected Islamic scholars who conduct daily reminders, practical rites walkthroughs, and historically accurate Ziyarat tours.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/80 border-slate-800 hover:border-amber-500/40 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                </div>
                <CardTitle className="text-white text-lg">Full Regulatory Compliance</CardTitle>
                <CardDescription className="text-slate-400">
                  Operating in partnership with accredited, licensed operators and statutory aviation bodies for complete peace of mind and safety.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* ── ROADMAP SECTION ── */}
      <section className="py-16 border-t border-slate-800/80">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Simple 4-Step Process</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">How Your Journey Unfolds</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative">
              <span className="text-3xl font-black text-slate-700">01</span>
              <h3 className="text-base font-semibold text-white mt-2">Select Your Package</h3>
              <p className="text-xs text-slate-400 mt-2">
                Browse our seasonal Umrah, Ramadan, or educational packages and select dates that match your calendar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative">
              <span className="text-3xl font-black text-slate-700">02</span>
              <h3 className="text-base font-semibold text-white mt-2">Enrol &amp; Plan Payments</h3>
              <p className="text-xs text-slate-400 mt-2">
                Sign in with your My Barakah account to lock in your slot with an initial deposit or full payment.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative">
              <span className="text-3xl font-black text-slate-700">03</span>
              <h3 className="text-base font-semibold text-white mt-2">Upload Details via My Journey</h3>
              <p className="text-xs text-slate-400 mt-2">
                Provide passenger passport data and medical notes securely through your personalized pilgrim dashboard.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative">
              <span className="text-3xl font-black text-amber-500/80">04</span>
              <h3 className="text-base font-semibold text-white mt-2">Pre-Departure &amp; Travel</h3>
              <p className="text-xs text-slate-400 mt-2">
                Attend pre-travel webinar briefings, receive your visa documentation, and embark on your life-changing trip.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ── */}
      <section className="py-16 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-amber-950/40 border-t border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 text-center max-w-3xl">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            Ready to Begin Your Spiritual Journey?
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
            Our team is available to assist you with package customization, family travel arrangements, and group bookings.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/travel">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8">
                Explore Packages Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                Contact Travel Advisors
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
