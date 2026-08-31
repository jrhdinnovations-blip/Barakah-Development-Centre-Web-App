import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { ORG } from "@/lib/site";
import { submitEnquiry } from "@/lib/crm.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${ORG.legalName}` },
      { name: "description", content: `Reach ${ORG.legalName} in Jos, Plateau State, Nigeria.` },
      { property: "og:title", content: `Contact — ${ORG.legalName}` },
      { property: "og:description", content: `Reach ${ORG.legalName} in Jos, Plateau State, Nigeria.` },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitEnquiry({
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          subject: form.subject,
          message: form.message,
        },
      });
      toast.success("Message received — our team will follow up with you shortly.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">Contact Us</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        We'd love to hear from you — whether you want to learn, partner, volunteer or access a
        service.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card-surface flex items-start gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">Office</h3>
              <p className="mt-1 text-sm text-muted-foreground">{ORG.address}</p>
            </div>
          </div>
          <div className="card-surface flex items-start gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Phone className="h-5 w-5 text-accent-foreground" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">Phone</h3>
              <p className="mt-1 text-sm text-muted-foreground">{ORG.phones.join(" · ")}</p>
            </div>
          </div>
          <div className="card-surface flex items-start gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Mail className="h-5 w-5 text-accent-foreground" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">Email</h3>
              <a href={`mailto:${ORG.email}`} className="mt-1 block text-sm text-primary hover:underline">
                {ORG.email}
              </a>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="card-surface space-y-5 p-8">
          <h2 className="text-xl font-semibold text-foreground">Send a message</h2>
          <div>
            <label htmlFor="name" className="text-sm font-medium text-foreground">Full name</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              required
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              required
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Phone (optional)
              </label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={30}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="subject" className="text-sm font-medium text-foreground">Subject</label>
              <input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                maxLength={150}
                required
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
            <textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              maxLength={1000}
              rows={5}
              required
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
