import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  enrolCourse,
  getCourseBySlug,
  getEnrolmentDetail,
  toggleLessonComplete,
} from "@/lib/learning.functions";

export const Route = createFileRoute("/learn/$slug")({
  loader: async ({ params }) => {
    const course = await getCourseBySlug({ data: { slug: params.slug } });
    if (!course) throw notFound();
    return course;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Course"} — Barakah Learn` },
      { name: "description", content: loaderData?.summary ?? "Course from Barakah Development Centre." },
      { property: "og:title", content: `${loaderData?.title ?? "Course"} — Barakah Learn` },
      { property: "og:description", content: loaderData?.summary ?? "" },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const course = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["enrolment", course.id],
    queryFn: () => getEnrolmentDetail({ data: { courseId: course.id } }),
    enabled: !!user,
  });

  const enrol = useMutation({
    mutationFn: () => enrolCourse({ data: { courseId: course.id } }),
    onSuccess: () => {
      toast.success("You're enrolled. Happy learning!");
      queryClient.invalidateQueries({ queryKey: ["enrolment", course.id] });
    },
    onError: (e) => toast.error(e.message || "Could not enrol"),
  });

  const toggle = useMutation({
    mutationFn: (input: { lessonId: string; complete: boolean }) =>
      toggleLessonComplete({
        data: { enrolmentId: detail.data!.enrolmentId, ...input },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrolment", course.id] }),
  });

  const lessons = detail.data?.lessons ?? course.lessons.map((l) => ({ ...l, completed: false }));
  const done = lessons.filter((l) => l.completed).length;
  const percent = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const enrolled = !!detail.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">Course</p>
      <h1 className="mt-2 text-4xl font-bold text-foreground">{course.title}</h1>
      {course.summary && <p className="mt-4 text-lg text-muted-foreground">{course.summary}</p>}
      {course.description && (
        <p className="mt-4 whitespace-pre-line text-muted-foreground">{course.description}</p>
      )}

      <div className="mt-8">
        {!user ? (
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create a free account to enrol
          </Link>
        ) : enrolled ? (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {done} of {lessons.length} lessons complete
              </span>
              <span className="font-semibold text-primary">{percent}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : course.self_enrol ? (
          <button
            onClick={() => enrol.mutate()}
            disabled={enrol.isPending}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {enrol.isPending ? "Enrolling…" : "Enrol now — free"}
          </button>
        ) : (
          <Link
            to="/apply"
            className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Apply to join this course
          </Link>
        )}
      </div>

      <h2 className="mt-12 text-2xl font-bold text-foreground">Lessons</h2>
      <div className="mt-6 space-y-4">
        {lessons.length === 0 && (
          <p className="text-sm text-muted-foreground">Lessons will be added soon.</p>
        )}
        {lessons.map((l, i) => (
          <div key={l.id} className="card-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                  {l.content_type === "video" ? (
                    <PlayCircle className="h-4 w-4 text-accent-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-accent-foreground" />
                  )}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {i + 1}. {l.title}
                  </h3>
                  {l.body && (
                    <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                      {l.body}
                    </p>
                  )}
                </div>
              </div>
              {enrolled && (
                <button
                  onClick={() => toggle.mutate({ lessonId: l.id, complete: !l.completed })}
                  aria-label={l.completed ? "Mark incomplete" : "Mark complete"}
                  className="shrink-0"
                >
                  {l.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground hover:text-primary" />
                  )}
                </button>
              )}
            </div>
            {l.content_type === "video" && l.video_url && enrolled && (
              <div className="mt-4 aspect-video overflow-hidden rounded-lg">
                <iframe
                  src={l.video_url}
                  title={l.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
