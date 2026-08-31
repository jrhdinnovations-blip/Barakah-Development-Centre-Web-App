import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact — Barakah Development Centre" },
      { name: "description", content: "Impact at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Impact — Barakah Development Centre" },
      { property: "og:description", content: "Impact at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Impact" />,
});
