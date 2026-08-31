import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap } from "lucide-react";
import { listCourses } from "@/lib/learning.functions";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: `Course Catalogue — ${ORG.legalName}` },
      { name: "description", content: "Browse courses and skills training from Barakah Development Centre." },
      { property: "og:title", content: `Course Catalogue — ${ORG.legalName}` },
      { property: "og:description", content: "Browse courses and skills training from Barakah Development Centre." },
    ],
  }),
  component: LearnPage,
});

function LearnPage() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => listCourses() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-foreground md:text-5xl">Course Catalogue</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Practical courses from the Learn &amp; Develop programme. Enrol with your free My Barakah
        account and track your progress.
      </p>

      {courses.isLoading && (
        <p className="mt-12 text-sm text-muted-foreground">Loading courses…</p>
      )}
      {!courses.isLoading && (courses.data ?? []).length === 0 && (
        <div className="card-surface mt-12 p-10 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Courses launching soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Our first courses are being prepared. Check back shortly or contact us to register your
            interest.
          </p>
        </div>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(courses.data ?? []).map((c) => (
          <Link
            key={c.id}
            to="/learn/$slug"
            params={{ slug: c.slug }}
            className="card-surface group flex flex-col p-6 transition-shadow hover:shadow-lg"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
              <BookOpen className="h-5 w-5 text-accent-foreground" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground group-hover:text-primary">
              {c.title}
            </h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.summary}</p>
            <span className="mt-4 text-sm font-medium text-primary">
              {c.self_enrol ? "Self-enrol →" : "Apply to join →"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
