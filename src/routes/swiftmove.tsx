import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Truck, Package, MapPin, Clock, ShieldCheck, Zap,
  ArrowRight, Star, PhoneCall, CheckCircle2, Navigation,
  Bike, Globe2, HeartHandshake,
} from 'lucide-react';

export const Route = createFileRoute('/swiftmove')({
  head: () => ({
    meta: [
      { title: 'SwiftMove Logistics — Fast, Reliable Deliveries in Nigeria' },
      {
        name: 'description',
        content:
          'SwiftMove by Barakah Development Centre. Same-day dispatch, package delivery, and vehicle hire across Nigeria. Book online in seconds.',
      },
    ],
  }),
  component: SwiftMoveLanding,
});

const STATS = [
  { value: '2,400+', label: 'Deliveries Completed', icon: Package },
  { value: '< 45min', label: 'Average Delivery Time', icon: Clock },
  { value: '98%', label: 'On-Time Rate', icon: CheckCircle2 },
  { value: '24 / 7', label: 'Service Availability', icon: Zap },
];

const SERVICES = [
  {
    icon: Bike,
    title: 'Express Dispatch',
    desc: 'Motorbike couriers for small packages, documents, and same-day deliveries across the city.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  {
    icon: Truck,
    title: 'Vehicle Hire',
    desc: 'Hire a van or truck for large cargo, furniture, equipment, or bulk business deliveries.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Package,
    title: 'Package Delivery',
    desc: 'Safe, tracked delivery for fragile items, electronics, food, and anything in between.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Globe2,
    title: 'Inter-City Runs',
    desc: 'Long-distance deliveries between cities. Reliable, insured, with real-time tracking.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Book Online', desc: 'Enter your pickup and delivery address. Get an instant price quote.' },
  { step: '02', title: 'We Dispatch', desc: 'A verified courier is assigned and picks up within minutes.' },
  { step: '03', title: 'Track Live', desc: 'Watch your delivery on the live map in real time.' },
  { step: '04', title: 'Delivered', desc: 'Your package arrives safely. Rate the experience.' },
];

const REVIEWS = [
  { name: 'Amina Usman', role: 'Business Owner, Jos', stars: 5, text: 'SwiftMove has transformed how I send goods to clients. Super fast and the rider was professional. Will use again!' },
  { name: 'Emmanuel Bello', role: 'Student, Abuja', stars: 5, text: 'Ordered a delivery at 9am and it arrived before lunch. Honestly impressive. The app tracking is smooth too.' },
  { name: 'Fatima Al-Hassan', role: 'HR Manager', stars: 5, text: 'We use SwiftMove for all our office dispatch runs. Reliable, affordable, and great customer support.' },
];

function SwiftMoveLanding() {
  return (
    <div className="min-h-screen bg-[#080c17] text-slate-200 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#080c17]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight">SwiftMove</span>
              <span className="text-xs text-orange-400 font-semibold block -mt-1">by Barakah</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#reviews" className="hover:text-white transition-colors">Reviews</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <Link
            to="/auth"
            search={{ mode: 'login' }}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-400 rounded-xl text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:scale-105"
          >
            Book Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-orange-500/5 blur-[120px]" />
          <div className="absolute top-1/3 right-0 h-[400px] w-[500px] rounded-full bg-amber-400/5 blur-[100px]" />
          {/* Animated grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-xs font-semibold text-orange-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
            Dispatchers Online Now — Book Instantly
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-none">
            <span className="text-white">Delivery, </span>
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              Done Swift.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Same-day dispatch, live tracking, and reliable couriers across Nigeria.
            Book a delivery in under 60 seconds — no phone calls needed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              search={{ mode: 'signup' }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl text-base font-bold text-white shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:scale-105"
            >
              <Package className="h-5 w-5" />
              Book a Delivery — It's Free
            </Link>
            <Link
              to="/auth"
              search={{ mode: 'login' }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-slate-700 bg-slate-900/60 text-base font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800/60 transition-all"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            {[
              { icon: ShieldCheck, text: 'Insured deliveries' },
              { icon: MapPin, text: 'Live GPS tracking' },
              { icon: Clock, text: 'Same-day service' },
              { icon: HeartHandshake, text: 'By Barakah Dev. Centre' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-orange-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-slate-800/60 bg-slate-900/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-orange-400" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-white mb-1">{value}</p>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────────────── */}
      <section id="services" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-400 text-sm font-bold uppercase tracking-widest mb-3">What We Offer</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Logistics for every need</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From a single envelope to a full truck — SwiftMove handles it all with speed and care.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div
                key={title}
                className={`group p-6 rounded-2xl border ${border} ${bg} hover:scale-[1.02] transition-all cursor-default`}
              >
                <div className={`h-12 w-12 rounded-xl ${bg} border ${border} flex items-center justify-center mb-5`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <h3 className={`text-lg font-bold ${color} mb-2`}>{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-slate-900/20 border-y border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-400 text-sm font-bold uppercase tracking-widest mb-3">Simple Process</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">How SwiftMove works</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Four easy steps from booking to delivered.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="relative group">
                <div className="p-6 rounded-2xl bg-[#0d1221] border border-slate-800 hover:border-orange-500/30 transition-all h-full">
                  <span className="text-5xl font-black text-orange-500/20 group-hover:text-orange-500/30 transition-colors block mb-4 font-mono">
                    {step}
                  </span>
                  <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/auth"
              search={{ mode: 'signup' }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl text-base font-bold text-white shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:scale-105"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Reviews ────────────────────────────────────────────────── */}
      <section id="reviews" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-400 text-sm font-bold uppercase tracking-widest mb-3">Customer Stories</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Loved by our customers</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {REVIEWS.map(({ name, role, stars, text }) => (
              <div key={name} className="p-6 rounded-2xl bg-[#0d1221] border border-slate-800 hover:border-slate-700 transition-all">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{text}"</p>
                <div>
                  <p className="text-white font-bold text-sm">{name}</p>
                  <p className="text-slate-500 text-xs">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-amber-500 to-orange-600 p-12 text-center shadow-2xl shadow-orange-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-6 mx-auto">
                <Navigation className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Ready to send something?
              </h2>
              <p className="text-orange-100 mb-8 max-w-xl mx-auto">
                Create a free account and book your first delivery in under 60 seconds. No subscription, no hidden fees.
              </p>
              <Link
                to="/auth"
                search={{ mode: 'signup' }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white rounded-2xl text-orange-600 font-black text-base hover:bg-orange-50 transition-colors shadow-lg"
              >
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer id="contact" className="border-t border-slate-800 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-base font-black text-white">SwiftMove</span>
                  <span className="text-xs text-orange-400 font-semibold block -mt-0.5">by Barakah</span>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Nigeria's fast, reliable logistics service. Part of the Barakah Development Centre family.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/auth" search={{ mode: 'signup' }} className="hover:text-orange-400 transition-colors">Book a Delivery</Link></li>
                <li><Link to="/auth" search={{ mode: 'login' }} className="hover:text-orange-400 transition-colors">Sign In</Link></li>
                <li><a href="https://barakahdevcentre.com" className="hover:text-orange-400 transition-colors">Main Barakah Site</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-orange-400 shrink-0" />
                  <span>+234 (0) 800 BARAKAH</span>
                </li>
                <li className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-orange-400 shrink-0" />
                  <a href="https://swiftmovelogistics.com" className="hover:text-orange-400 transition-colors">swiftmovelogistics.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} SwiftMove Logistics · A Barakah Development Centre Service</p>
            <a href="https://barakahdevcentre.com" className="hover:text-slate-400 transition-colors">barakahdevcentre.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
