import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const mySupportCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assistance_requests")
      .select("id, need_summary, created_at, status")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const submitAssistanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { needSummary: string; circumstances?: string }) =>
    z.object({ needSummary: z.string().min(1), circumstances: z.string().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("assistance_requests").insert({
      user_id: userId,
      need_summary: data.needSummary,
      circumstances: data.circumstances ?? null,
      status: "submitted",
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const caseQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return [];
  });

export const caseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string }) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async () => {
    return { case: { need_summary: "mock", status: "open", circumstances: "" }, history: [] };
  });

export const assignCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string; officerId: string }) =>
    z.object({ caseId: z.string().uuid(), officerId: z.string().uuid() }).parse(input)
  )
  .handler(async () => {
    return { success: true };
  });

export const setCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string; status: string }) =>
    z.object({ caseId: z.string().uuid(), status: z.string() }).parse(input)
  )
  .handler(async () => {
    return { success: true };
  });

export const addCaseAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string; notes: string; recommendation?: string }) =>
    z.object({ caseId: z.string().uuid(), notes: z.string(), recommendation: z.string().optional() }).parse(input)
  )
  .handler(async () => {
    return { success: true };
  });

export const recordEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string; eligible: boolean; criteriaNotes?: string }) =>
    z.object({ caseId: z.string().uuid(), eligible: z.boolean(), criteriaNotes: z.string().optional() }).parse(input)
  )
  .handler(async () => {
    return { success: true };
  });

export const addCaseReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { caseId: string; referredTo: string; reason?: string }) =>
    z.object({ caseId: z.string().uuid(), referredTo: z.string(), reason: z.string().optional() }).parse(input)
  )
  .handler(async () => {
    return { success: true };
  });