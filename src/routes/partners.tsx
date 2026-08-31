import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners — Barakah Development Centre" },
      { name: "description", content: "Partners at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Partners — Barakah Development Centre" },
      { property: "og:description", content: "Partners at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Partners" />,
});
