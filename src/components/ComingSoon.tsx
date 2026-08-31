import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center">
      <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        <Clock className="h-3.5 w-3.5" />
        Coming Soon
      </span>
      <h1 className="mt-6 text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        {description ??
          "This part of the Barakah ecosystem is being prepared. Details will be published here as they are confirmed."}
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg border border-input bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
}
