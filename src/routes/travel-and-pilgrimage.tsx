import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/travel-and-pilgrimage")({
  head: () => ({
    meta: [
      { title: "Travel & Pilgrimage — Barakah Development Centre" },
      { name: "description", content: "Travel & Pilgrimage at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Travel & Pilgrimage — Barakah Development Centre" },
      { property: "og:description", content: "Travel & Pilgrimage at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Travel & Pilgrimage" />,
});
