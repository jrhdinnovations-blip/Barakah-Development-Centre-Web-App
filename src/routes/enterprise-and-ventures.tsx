import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/enterprise-and-ventures")({
  head: () => ({
    meta: [
      { title: "Enterprise & Ventures — Barakah Development Centre" },
      { name: "description", content: "Enterprise & Ventures at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Enterprise & Ventures — Barakah Development Centre" },
      { property: "og:description", content: "Enterprise & Ventures at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Enterprise & Ventures" />,
});
