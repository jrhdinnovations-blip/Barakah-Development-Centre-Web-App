import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  audit,
  courseSchema,
  lessonSchema,
  notifyUserFromTemplate,
  requireStaff,
  uuid,
} from "./staff.server";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const pub = await publicClient();
  const { data } = await pub
    .from("courses")
    .select("id, slug, title, summary, cover_url, self_enrol")
    .eq("status", "published")
    .order("title");
  return data ?? [];
});

export const getCourseBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const pub = await publicClient();
    const { data: course } = await pub
      .from("courses")
      .select("id, slug, title, summary, description, cover_url, self_enrol")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!course) return null;
    const { data: lessons } = await pub
      .from("lessons")
      .select("id, title, content_type, video_url, body, sort_order")
      .eq("course_id", course.id)
      .eq("status", "active")
      .order("sort_order");
    return { ...course, lessons: lessons ?? [] };
  });

export const enrolCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: course } = await supabase
      .from("courses")
      .select("id, title, self_enrol, status")
      .eq("id", data.courseId)
      .single();
    if (!course || course.status !== "published" || !course.self_enrol)
      throw new Error("This course is not open for self-enrolment");

    const { data: enr, error } = await supabase
      .from("enrolments")
      .upsert(
        { course_id: data.courseId, user_id: userId, created_by: userId },
        { onConflict: "course_id,user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyUserFromTemplate(
      supabase,
      userId,
      "course_enrolment",
      "Enrolled in course",
      { course_name: course.title },
      "/my-barakah",
    );
    await audit({ supabase, userId }, "course.enrol", "enrolments", enr.id);
    return { id: enr.id };
  });

export const myEnrolments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: enrolments } = await supabase
      .from("enrolments")
      .select("id, status, created_at, course:courses(id, slug, title, summary, cover_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!enrolments?.length) return [];

    const enrolIds = enrolments.map((e) => e.id);
    const courseIds = enrolments.map((e: any) => e.course?.id).filter(Boolean);
    const [progress, lessons] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("enrolment_id, completed_at")
        .in("enrolment_id", enrolIds)
        .not("completed_at", "is", null),
      courseIds.length
        ? supabase.from("lessons").select("id, course_id").in("course_id", courseIds).eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const totalByCourse = new Map<string, number>();
    for (const l of lessons.data ?? [])
      totalByCourse.set(l.course_id, (totalByCourse.get(l.course_id) ?? 0) + 1);
    const doneByEnrol = new Map<string, number>();
    for (const p of progress.data ?? [])
      if (p.completed_at) doneByEnrol.set(p.enrolment_id, (doneByEnrol.get(p.enrolment_id) ?? 0) + 1);

    return enrolments.map((e: any) => {
      const total = totalByCourse.get(e.course?.id) ?? 0;
      const done = doneByEnrol.get(e.id) ?? 0;
      return {
        ...e,
        totalLessons: total,
        completedLessons: done,
        percent: total ? Math.round((done / total) * 100) : 0,
      };
    });
  });

export const getEnrolmentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: enrolment } = await supabase
      .from("enrolments")
      .select("id, course:courses(id, slug, title, summary)")
      .eq("course_id", data.courseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!enrolment) return null;
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, content_type, video_url, body, sort_order")
      .eq("course_id", data.courseId)
      .eq("status", "active")
      .order("sort_order");
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .eq("enrolment_id", enrolment.id);
    const done = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
    return {
      enrolmentId: enrolment.id,
      course: enrolment.course,
      lessons: (lessons ?? []).map((l) => ({ ...l, completed: done.has(l.id) })),
    };
  });

export const toggleLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ enrolmentId: uuid, lessonId: uuid, complete: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: enrolment } = await supabase
      .from("enrolments")
      .select("id")
      .eq("id", data.enrolmentId)
      .eq("user_id", userId)
      .single();
    if (!enrolment) throw new Error("Enrolment not found");

    const { error } = await supabase.from("lesson_progress").upsert(
      {
        enrolment_id: data.enrolmentId,
        lesson_id: data.lessonId,
        user_id: userId,
        completed_at: data.complete ? new Date().toISOString() : null,
      },
      { onConflict: "enrolment_id,lesson_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Staff / facilitator ----

export const staffListCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const [courses, enrolCounts] = await Promise.all([
      supabase.from("courses").select("*").order("updated_at", { ascending: false }),
      supabase.from("enrolments").select("course_id"),
    ]);
    const counts = new Map<string, number>();
    for (const e of enrolCounts.data ?? [])
      counts.set(e.course_id, (counts.get(e.course_id) ?? 0) + 1);
    return (courses.data ?? []).map((c) => ({ ...c, enrolments: counts.get(c.id) ?? 0 }));
  });

export const staffUpsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => courseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? null,
      description: data.description ?? null,
      self_enrol: data.selfEnrol,
      status: data.status,
    };
    if (data.id) {
      await supabase.from("courses").update(fields).eq("id", data.id);
    } else {
      await supabase.from("courses").insert({ ...fields, created_by: userId });
    }
    await audit({ supabase, userId }, "course.save", "courses", data.id, { slug: data.slug });
    return { ok: true };
  });

export const staffListLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: rows } = await supabase
      .from("lessons")
      .select("*")
      .eq("course_id", data.courseId)
      .order("sort_order");
    return rows ?? [];
  });

export const staffUpsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => lessonSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      course_id: data.courseId,
      title: data.title,
      content_type: data.contentType,
      video_url: data.videoUrl || null,
      body: data.body ?? null,
      sort_order: data.sortOrder,
    };
    if (data.id) {
      await supabase.from("lessons").update(fields).eq("id", data.id);
    } else {
      await supabase.from("lessons").insert({ ...fields, created_by: userId });
    }
    return { ok: true };
  });
