import { createFileRoute } from "@tanstack/react-router";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About — ${ORG.legalName}` },
      { name: "description", content: ORG.mission },
      { property: "og:title", content: `About — ${ORG.legalName}` },
      { property: "og:description", content: ORG.mission },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">About Barakah</h1>
      <p className="mt-4 text-lg text-muted-foreground">{ORG.tagline}</p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground">Our Vision</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{ORG.vision}</p>
        </div>
        <div className="card-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground">Our Mission</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{ORG.mission}</p>
        </div>
      </div>

      <div className="card-surface mt-6 p-8">
        <h2 className="text-2xl font-semibold text-foreground">Our Core Values</h2>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {ORG.values.map((v) => (
            <span
              key={v}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground"
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="card-surface mt-6 p-8">
        <h2 className="text-2xl font-semibold text-foreground">Leadership</h2>
        <p className="mt-3 text-muted-foreground">
          <span className="font-semibold text-foreground">{ORG.founder}</span>
          <br />
          {ORG.founderTitle}
        </p>
        <div className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{ORG.legalName} · {ORG.rc}</p>
          <p className="mt-1">{ORG.address}</p>
        </div>
      </div>
    </div>
  );
}
