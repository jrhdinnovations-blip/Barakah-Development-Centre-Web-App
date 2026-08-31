import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { listOpenProgrammes, submitApplication } from "@/lib/applications.functions";
import { registerDocument } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/apply")({
  head: () => ({
    meta: [
      { title: "Apply — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplyPage,
});

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 10 * 1024 * 1024;

function ApplyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const programmes = useQuery({ queryKey: ["open-programmes"], queryFn: () => listOpenProgrammes() });

  const [programmeId, setProgrammeId] = useState("");
  const [motivation, setMotivation] = useState("");
  const [background, setBackground] = useState("");
  const [commitment, setCommitment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type (PDF or image).`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: file exceeds 10MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next].slice(0, 5));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (motivation.trim().length < 10) {
      toast.error("Please tell us a bit more about your motivation (at least 10 characters).");
      return;
    }
    setBusy(true);
    try {
      const { id } = await submitApplication({
        data: {
          programmeId: programmeId || undefined,
          motivation: motivation.trim(),
          background: background.trim() || undefined,
          commitment: commitment.trim() || undefined,
        },
      });
      for (const f of files) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `${user.id}/applications/${id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, f);
        if (upErr) throw new Error(`Upload failed for ${f.name}`);
        await registerDocument({
          entityType: "application",
          entityId: id,
          filePath: path,
          fileName: f.name,
          mimeType: f.type,
          sizeBytes: f.size,
        });
      }
      toast.success("Application submitted. We'll review it shortly.");
      navigate({ to: "/my-barakah" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">Submit an Application</h1>
      <p className="mt-2 text-muted-foreground">
        Apply to a Barakah programme or opportunity. You can track the status from My Barakah.
      </p>

      <form onSubmit={submit} className="card-surface mt-8 space-y-5 p-8">
        <div>
          <label htmlFor="programme" className="text-sm font-medium text-foreground">
            Programme / opportunity
          </label>
          <select
            id="programme"
            value={programmeId}
            onChange={(e) => setProgrammeId(e.target.value)}
            className={inputCls}
          >
            <option value="">General application</option>
            {(programmes.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {(programmes.data ?? []).length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Programmes will appear here as they are published — you can still submit a general
              application.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="motivation" className="text-sm font-medium text-foreground">
            Why are you applying? *
          </label>
          <textarea
            id="motivation"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="background" className="text-sm font-medium text-foreground">
            Relevant background or experience
          </label>
          <textarea
            id="background"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            rows={3}
            maxLength={2000}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="commitment" className="text-sm font-medium text-foreground">
            Your commitment (time, goals…)
          </label>
          <textarea
            id="commitment"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            rows={2}
            maxLength={1000}
            className={inputCls}
          />
        </div>

        <div>
          <span className="text-sm font-medium text-foreground">Supporting documents</span>
          <label className="mt-1.5 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground hover:bg-accent/50">
            <UploadCloud className="h-6 w-6" />
            PDF or image, up to 10MB each (max 5 files)
            <input
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => pickFiles(e.target.files)}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}
