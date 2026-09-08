import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft, Lightbulb, Workflow, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/$')({
  component: UnderConstructionPage,
});

function UnderConstructionPage() {
  const router = useRouter();
  const path = router.state.location.pathname;

  // Derive a human-readable module name from the path
  const moduleName = path
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Module';

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
          <div className="h-24 w-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl relative shadow-blue-500/20">
            <Construction className="h-10 w-10 text-blue-400 animate-pulse" />
          </div>
          <div className="absolute -top-3 -right-3 h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center border-4 border-[#070b14]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            <span className="text-blue-400">{moduleName}</span> is building.
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            This module is part of the Barakah Enterprise Ecosystem roadmap. Our engineering team is currently developing this feature to bring you a seamless management experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left pt-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c]/80 backdrop-blur p-5 space-y-2">
            <Workflow className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-slate-200">Phase 2 Implementation</h3>
            <p className="text-xs text-slate-500">Scheduled for the upcoming enterprise rollout cycle.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c]/80 backdrop-blur p-5 space-y-2">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-slate-200">Submit Feedback</h3>
            <p className="text-xs text-slate-500">Have requirements for {moduleName}? Let us know.</p>
          </div>
        </div>

        <div className="pt-8">
          <Button 
            onClick={() => window.history.back()} 
            className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white h-12 px-8 rounded-full shadow-lg gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
