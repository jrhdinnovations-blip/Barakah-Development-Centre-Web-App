import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/learn-and-develop")({
  head: () => ({
    meta: [
      { title: "Learn & Develop — Barakah Development Centre" },
      { name: "description", content: "Learn & Develop at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Learn & Develop — Barakah Development Centre" },
      { property: "og:description", content: "Learn & Develop at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Learn & Develop" />,
});
