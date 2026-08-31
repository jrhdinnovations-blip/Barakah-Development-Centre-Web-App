import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/media-and-insights")({
  head: () => ({
    meta: [
      { title: "Media & Insights — Barakah Development Centre" },
      { name: "description", content: "Media & Insights at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Media & Insights — Barakah Development Centre" },
      { property: "og:description", content: "Media & Insights at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Media & Insights" />,
});
