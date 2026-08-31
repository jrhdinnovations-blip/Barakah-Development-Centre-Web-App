import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/what-we-do")({
  head: () => ({
    meta: [
      { title: "What We Do — Barakah Development Centre" },
      { name: "description", content: "What We Do at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "What We Do — Barakah Development Centre" },
      { property: "og:description", content: "What We Do at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="What We Do" />,
});
