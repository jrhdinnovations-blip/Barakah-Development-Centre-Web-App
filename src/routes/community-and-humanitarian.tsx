import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/community-and-humanitarian")({
  head: () => ({
    meta: [
      { title: "Community & Humanitarian — Barakah Development Centre" },
      { name: "description", content: "Community & Humanitarian at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Community & Humanitarian — Barakah Development Centre" },
      { property: "og:description", content: "Community & Humanitarian at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Community & Humanitarian" />,
});
