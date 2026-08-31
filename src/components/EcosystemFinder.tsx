import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import { ECO_ACTIONS } from "@/lib/site";

export function EcosystemFinder() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  const action = ECO_ACTIONS.find((a) => a.label === selected);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="ecosystem-finder">
      <div className="card-surface card-lift relative overflow-hidden p-8 md:p-12">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-gold/15" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </span>
          <div>
            <h2 id="ecosystem-finder" className="text-2xl font-bold text-foreground md:text-3xl">
              What would you like to do?
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose a goal and we'll point you to the right place in the ecosystem.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2.5">
          {ECO_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => setSelected(a.label)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                selected === a.label
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-accent"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {action && (
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl bg-sand p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{action.label}</span> — this service is being
              prepared as part of the Barakah ecosystem.
            </p>
            <button
              onClick={() => navigate({ to: action.to })}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
