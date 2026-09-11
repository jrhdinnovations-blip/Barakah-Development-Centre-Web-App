import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Truck, BookOpen, HeartHandshake, Globe2, ShieldCheck, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isSwiftmoveDomain } from '@/lib/domain-detection';
import { SwiftMoveLanding } from './swiftmove';

export const Route = createFileRoute('/')({
  head: () => {
    const isSwift = typeof window !== 'undefined' && isSwiftmoveDomain();
    if (isSwift) {
      return {
        meta: [
          { title: 'SwiftMove Logistics — Fast, Reliable Deliveries & Ride Hailing' },
          { name: 'description', content: 'Same-day dispatch, package delivery, and on-demand vehicle hire across Nigeria. Book online in seconds.' },
          { property: 'og:title', content: 'SwiftMove Logistics — On-Demand Deliveries & Rides' },
          { property: 'og:description', content: 'Same-day parcel dispatch, live tracking, and on-demand rides.' },
        ],
      };
    }
    return {
      meta: [
        { title: 'Barakah Development Centre — Building a Better Today for a Brighter Tomorrow' },
        { name: 'description', content: 'A comprehensive ecosystem dedicated to logistics, learning, humanitarian aid, institutional excellence, and sacred travel.' },
      ],
    };
  },
  component: HomePageDispatcher,
});

function HomePageDispatcher() {
  const isSwift = isSwiftmoveDomain();
  if (isSwift) {
    return <SwiftMoveLanding />;
  }
  return <BarakahHomePage />;
}

function BarakahHomePage() {
  return (
    // Added overflow-x-hidden to prevent mobile horizontal scrolling
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-x-hidden">
      {/* HERO SECTION */}
      {/* Adjusted padding for mobile vs desktop */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-32">
        <div className="absolute inset-0 bg-blue-900/10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
        <div className="container relative mx-auto px-4 sm:px-6 text-center">

          {/* Official Brand Logo Medallion */}
          <div className="flex justify-center mb-6">
            <div className="relative p-2 rounded-full bg-gradient-to-b from-amber-400/25 via-emerald-500/10 to-slate-900 border border-amber-400/35 shadow-2xl shadow-emerald-950/40 backdrop-blur group">
              <img
                src="/barakah-centre-logo.png"
                alt="Barakah Development Centre — Building a Better Today for a Brighter Tomorrow"
                width={144}
                height={144}
                className="h-28 w-28 sm:h-36 sm:w-36 rounded-full object-cover shadow-inner group-hover:scale-105 transition-transform duration-300"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
          </div>

          <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-amber-300 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Building a Better Today for a Brighter Tomorrow
          </div>

          {/* Responsive text scaling: 4xl (mobile) -> 5xl (tablet) -> 7xl (desktop) */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Barakah Development Centre
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl text-slate-400 mb-10 px-2">
            A comprehensive ecosystem dedicated to logistics, learning, humanitarian aid, institutional excellence, and sacred travel.
          </p>

          {/* Buttons stack on mobile, side-by-side on larger screens */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-md mx-auto sm:max-w-none">
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                Learn More
              </Button>
            </Link>
          </div>

        </div>
      </section>

      {/* SERVICES GRID */}
      <section className="py-16 sm:py-20 bg-slate-900/50 border-t border-slate-800">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Our Ecosystem</h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              Discover the diverse range of services and initiatives powered by the Barakah Development Centre.
            </p>
          </div>

          {/* Grid changes from 1 column (mobile) -> 2 columns (tablet) -> 3 columns (desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* SwiftMove Service Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-colors group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Truck className="h-6 w-6 text-blue-400" />
                </div>
                <CardTitle className="text-white text-xl">SwiftMove Logistics & Ride Hailing</CardTitle>
                <CardDescription className="text-slate-400">
                  Reliable package delivery and on-demand ride-hailing services at your fingertips.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/my-swift-move" className="text-sm text-blue-400 hover:text-blue-300 font-medium inline-flex items-center">
                  Book a delivery <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Learning Service Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-colors group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-white text-xl">Training and Development</CardTitle>
                <CardDescription className="text-slate-400">
                  Access educational resources, courses, and developmental programs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/learn-and-develop" className="text-sm text-purple-400 hover:text-purple-300 font-medium inline-flex items-center">
                  Explore courses <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Humanitarian Service Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/50 transition-colors group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <HeartHandshake className="h-6 w-6 text-emerald-400" />
                </div>
                <CardTitle className="text-white text-xl">Community & Humanitarian</CardTitle>
                <CardDescription className="text-slate-400">
                  Join our initiatives to support and uplift local communities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/community-and-humanitarian" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center">
                  Get involved <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Travel Service Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-amber-500/50 transition-colors group">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe2 className="h-6 w-6 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Travel &amp; Tours
                  </span>
                </div>
                <CardTitle className="text-white text-xl">Travel &amp; Pilgrimage</CardTitle>
                <CardDescription className="text-slate-400">
                  Barakah Travel and Tours Limited — spiritual Umrah &amp; Hajj journeys, scholarly mentorship, and flexible instalment plans.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/travel-and-pilgrimage" className="text-sm text-amber-400 hover:text-amber-300 font-medium inline-flex items-center">
                  Explore Travel &amp; Tours <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Peace & Institutional Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-rose-500/50 transition-colors group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-6 w-6 text-rose-400" />
                </div>
                <CardTitle className="text-white text-xl">Peace & Institutional Services</CardTitle>
                <CardDescription className="text-slate-400">
                  Fostering institutional integrity and peace-building frameworks for a secure future.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/peace-and-institutional-services" className="text-sm text-rose-400 hover:text-rose-300 font-medium inline-flex items-center">
                  View services <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Media & Insights Card */}
            <Card className="bg-slate-900 border-slate-800 hover:border-amber-500/50 transition-colors group">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Galleries &amp; Films
                  </span>
                </div>
                <CardTitle className="text-white text-xl">Media &amp; Insights</CardTitle>
                <CardDescription className="text-slate-400">
                  Watch official documentaries, browse field galleries, and read thought leadership articles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/media-and-insights" className="text-sm text-amber-400 hover:text-amber-300 font-medium inline-flex items-center">
                  Explore Media &amp; Insights <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FEATURED MEDIA & STORIES BANNER */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-900/40 via-[#070b14] to-slate-950 border-t border-slate-800/80">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-slate-800 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                Official Media Stream
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Experience Barakah's Work in High Definition
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                From emergency relief convoys and community convocation ceremonies to pilgrimage orientations and fleet logistics — discover our stories captured live.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link to="/media-and-insights">
                  <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                    View Photo &amp; Video Gallery <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0 w-full sm:w-auto">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-amber-400">HD</p>
                <p className="text-xs text-slate-400 mt-1">Photo Gallery</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-emerald-400">4K</p>
                <p className="text-xs text-slate-400 mt-1">Video Stories</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-blue-400">Live</p>
                <p className="text-xs text-slate-400 mt-1">Admin Updates</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <p className="text-2xl font-black text-purple-400">100%</p>
                <p className="text-xs text-slate-400 mt-1">Authentic</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}