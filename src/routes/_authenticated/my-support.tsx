import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { mySupportCases, submitAssistanceRequest } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/my-support")({
  head: () => ({
    meta: [
      { title: "My Support — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MySupport,
});

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function MySupport() {
  const queryClient = useQueryClient();
  const cases = useQuery({ queryKey: ["my-support"], queryFn: () => mySupportCases() });
  const [needSummary, setNeedSummary] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [open, setOpen] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      submitAssistanceRequest({ data: { needSummary, ...(circumstances ? { circumstances } : {}) } }),
    onSuccess: () => {
      toast.success("Request submitted confidentially. A case officer will be in touch.");
      setNeedSummary(""); setCircumstances(""); setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-support"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">My Support</h1>
      <p className="mt-1 text-muted-foreground">
        Confidential humanitarian assistance requests. Only you, your assigned case officer and
        administrators can see these.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        Your requests are private. We never share your circumstances outside the case team without
        your consent.
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Request assistance
        </button>
      ) : (
        <form
          className="card-surface mt-6 space-y-3 p-6"
          onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        >
          <h2 className="text-lg font-semibold text-foreground">New assistance request</h2>
          <input
            className={inputCls}
            required
            minLength={5}
            maxLength={200}
            placeholder="What do you need help with? (short summary)"
            value={needSummary}
            onChange={(e) => setNeedSummary(e.target.value)}
          />
          <textarea
            className={inputCls}
            rows={5}
            maxLength={5000}
            placeholder="Tell us about your circumstances (optional, confidential)"
            value={circumstances}
            onChange={(e) => setCircumstances(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              disabled={submit.isPending}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending ? "Submitting…" : "Submit confidentially"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Your requests</h2>
        {(cases.data ?? []).length === 0 ? (
          <div className="card-surface mt-4 p-8 text-center">
            <LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">You have no support requests.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {(cases.data ?? []).map((c: any) => {
              const programme = Array.isArray(c.programme) ? c.programme[0] : c.programme;
              return (
                <li key={c.id} className="card-surface flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.need_summary}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmt(c.created_at)}{programme?.title ? ` · ${programme.title}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium capitalize text-accent-foreground">
                    {c.status.replace(/_/g, " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
