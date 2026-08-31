import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  audit,
  notifyUserFromTemplate,
  passengerSchema,
  paymentPlanSchema,
  requireStaff,
  travelPackageSchema,
  uuid,
} from "./staff.server";
import { createPaymentIntent } from "./payments.server";

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

export const listTravelPackages = createServerFn({ method: "GET" }).handler(async () => {
  const pub = await publicClient();
  const { data } = await pub
    .from("travel_packages")
    .select("id, slug, title, summary, provider_name, starts_on, ends_on, price_kobo, currency")
    .eq("status", "published")
    .order("starts_on", { nullsFirst: false });
  return data ?? [];
});

export const getTravelPackage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const pub = await publicClient();
    const { data: pkg } = await pub
      .from("travel_packages")
      .select("id, slug, title, summary, body, provider_name, provider_notes, itinerary, instalments_allowed, starts_on, ends_on, price_kobo, currency")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return pkg;
  });

export const enrolInPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ packageId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pkg } = await supabase
      .from("travel_packages")
      .select("id, title, status")
      .eq("id", data.packageId)
      .single();
    if (!pkg || pkg.status !== "published") throw new Error("Package unavailable");
    const { data: existing } = await supabase
      .from("travel_enrolments")
      .select("id")
      .eq("package_id", data.packageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { id: existing.id };
    const { data: enrolment, error } = await supabase
      .from("travel_enrolments")
      .insert({ package_id: data.packageId, user_id: userId, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyUserFromTemplate(supabase, userId, "travel_enrolled", "Travel enrolment received", {
      package_title: pkg.title,
    }, "/my-journey");
    await audit({ supabase, userId }, "travel.enrol", "travel_enrolments", enrolment.id);
    return { id: enrolment.id };
  });

export const myJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: enrolments } = await supabase
      .from("travel_enrolments")
      .select("id, status, created_at, package:travel_packages(title, slug, starts_on, ends_on, price_kobo, currency, provider_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const ids = (enrolments ?? []).map((e) => e.id);
    if (!ids.length) return { enrolments: [], passengers: [], plans: [], instalments: [] };
    const [passengers, plans] = await Promise.all([
      supabase.from("passenger_details").select("*").in("enrolment_id", ids),
      supabase.from("payment_plans").select("*").in("enrolment_id", ids),
    ]);
    const planIds = (plans.data ?? []).map((p) => p.id);
    const { data: instalments } = planIds.length
      ? await supabase.from("payment_plan_instalments").select("*").in("plan_id", planIds).order("due_date")
      : { data: [] };
    return {
      enrolments: enrolments ?? [],
      passengers: passengers.data ?? [],
      plans: plans.data ?? [],
      instalments: instalments ?? [],
    };
  });

export const savePassengerDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => passengerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: enrolment } = await supabase
      .from("travel_enrolments")
      .select("id, user_id")
      .eq("id", data.enrolmentId)
      .single();
    if (!enrolment || enrolment.user_id !== userId) throw new Error("Enrolment not found");
    const fields = {
      full_name: data.fullName,
      date_of_birth: data.dateOfBirth || null,
      passport_number: data.passportNumber || null,
      passport_expiry: data.passportExpiry || null,
      next_of_kin_name: data.nextOfKinName || null,
      next_of_kin_phone: data.nextOfKinPhone || null,
      medical_notes: data.medicalNotes || null,
    };
    const { data: existing } = await supabase
      .from("passenger_details")
      .select("id")
      .eq("enrolment_id", data.enrolmentId)
      .maybeSingle();
    if (existing) {
      await supabase.from("passenger_details").update(fields).eq("id", existing.id);
    } else {
      await supabase.from("passenger_details").insert({ ...fields, enrolment_id: data.enrolmentId });
    }
    await supabase
      .from("travel_enrolments")
      .update({ status: "documents_pending" })
      .eq("id", data.enrolmentId)
      .eq("status", "enrolled");
    return { ok: true };
  });

export const payInstalment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ instalmentId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inst } = await supabase
      .from("payment_plan_instalments")
      .select("id, label, amount_kobo, status, plan:payment_plans(enrolment_id, enrolment:travel_enrolments(user_id, package:travel_packages(title, legal_entity_id, programme_id)))")
      .eq("id", data.instalmentId)
      .single();
    if (!inst || inst.status !== "due") throw new Error("Instalment not payable");
    const plan: any = Array.isArray(inst.plan) ? inst.plan[0] : inst.plan;
    const enrolment: any = Array.isArray(plan?.enrolment) ? plan.enrolment[0] : plan?.enrolment;
    if (!enrolment || enrolment.user_id !== userId) throw new Error("Not your instalment");
    const pkg: any = Array.isArray(enrolment.package) ? enrolment.package[0] : enrolment.package;
    const result = await createPaymentIntent(supabase, userId, {
      entityType: "travel_instalment",
      entityId: inst.id,
      amountKobo: inst.amount_kobo,
      description: `${pkg?.title ?? "Travel package"} — ${inst.label}`,
      legalEntityId: pkg?.legal_entity_id ?? null,
      programmeId: pkg?.programme_id ?? null,
      callbackPath: "/my-journey",
    });
    return result;
  });

// ===== Staff / Travel Officer =====

export const staffListPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data } = await supabase
      .from("travel_packages")
      .select("id, slug, title, provider_name, starts_on, ends_on, price_kobo, currency, status")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const staffUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => travelPackageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? null,
      body: data.body ?? null,
      provider_name: data.providerName || null,
      provider_notes: data.providerNotes || null,
      itinerary: data.itinerary ?? null,
      starts_on: data.startsOn || null,
      ends_on: data.endsOn || null,
      price_kobo: data.priceKobo,
      status: data.status,
    };
    if (data.id) {
      await supabase.from("travel_packages").update(fields).eq("id", data.id);
    } else {
      await supabase.from("travel_packages").insert({ ...fields, created_by: userId });
    }
    await audit({ supabase, userId }, "travel.package.upsert", "travel_packages", data.id);
    return { ok: true };
  });

export const staffListEnrolments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: enrolments } = await supabase
      .from("travel_enrolments")
      .select("id, status, created_at, package:travel_packages(title), traveller:profiles!travel_enrolments_user_id_fkey(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = (enrolments ?? []).map((e) => e.id);
    const [passengers, plans] = ids.length
      ? await Promise.all([
          supabase.from("passenger_details").select("*").in("enrolment_id", ids),
          supabase.from("payment_plans").select("*").in("enrolment_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const planIds = (plans.data ?? []).map((p: any) => p.id);
    const { data: instalments } = planIds.length
      ? await supabase.from("payment_plan_instalments").select("*").in("plan_id", planIds).order("due_date")
      : { data: [] };
    return {
      enrolments: enrolments ?? [],
      passengers: passengers.data ?? [],
      plans: plans.data ?? [],
      instalments: instalments ?? [],
    };
  });

export const staffSetEnrolmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enrolmentId: uuid,
        status: z.enum(["documents_verified", "confirmed", "completed", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: enrolment } = await supabase
      .from("travel_enrolments")
      .select("user_id, package:travel_packages(title)")
      .eq("id", data.enrolmentId)
      .single();
    if (!enrolment) throw new Error("Enrolment not found");
    await supabase.from("travel_enrolments").update({ status: data.status }).eq("id", data.enrolmentId);
    const pkg: any = Array.isArray(enrolment.package) ? enrolment.package[0] : enrolment.package;
    await notifyUserFromTemplate(supabase, enrolment.user_id, "travel_status", `Travel update: ${data.status.replace(/_/g, " ")}`, {
      package_title: pkg?.title ?? "your package",
    }, "/my-journey");
    await audit({ supabase, userId }, "travel.status", "travel_enrolments", data.enrolmentId, { status: data.status });
    return { ok: true };
  });

export const staffCreatePaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => paymentPlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const total = data.instalments.reduce((s, i) => s + i.amountKobo, 0);
    const { data: existing } = await supabase
      .from("payment_plans")
      .select("id")
      .eq("enrolment_id", data.enrolmentId)
      .eq("status", "active")
      .maybeSingle();
    if (existing) throw new Error("An active payment plan already exists for this enrolment");
    const { data: plan, error } = await supabase
      .from("payment_plans")
      .insert({ enrolment_id: data.enrolmentId, total_kobo: total })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("payment_plan_instalments").insert(
      data.instalments.map((i) => ({
        plan_id: plan.id,
        label: i.label,
        amount_kobo: i.amountKobo,
        due_date: i.dueDate,
      })),
    );
    const { data: enrolment } = await supabase
      .from("travel_enrolments")
      .select("user_id")
      .eq("id", data.enrolmentId)
      .single();
    if (enrolment) {
      await notifyUserFromTemplate(supabase, enrolment.user_id, "travel_plan", "Your payment plan is ready", {}, "/my-journey");
    }
    await audit({ supabase, userId }, "travel.plan.create", "payment_plans", plan.id);
    return { ok: true };
  });
