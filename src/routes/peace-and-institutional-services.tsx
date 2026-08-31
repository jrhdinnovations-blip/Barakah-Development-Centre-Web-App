import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/peace-and-institutional-services")({
  head: () => ({
    meta: [
      { title: "Peace & Institutional Services — Barakah Development Centre" },
      { name: "description", content: "Peace & Institutional Services at Barakah Development Centre — coming soon." },
      { property: "og:title", content: "Peace & Institutional Services — Barakah Development Centre" },
      { property: "og:description", content: "Peace & Institutional Services at Barakah Development Centre — coming soon." },
    ],
  }),
  component: () => <ComingSoon title="Peace & Institutional Services" />,
});
