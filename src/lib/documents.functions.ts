import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  });

export const uploadDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(1),
        fileUrl: z.string().url(),
        documentType: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }: any) => {
    const { supabase, userId } = context;

    const { data: record, error } = await supabase
      .from("user_documents")
      .insert({
        user_id: userId,
        title: data.title,
        file_url: data.fileUrl,
        document_type: data.documentType ?? "general",
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { id: record.id, success: true };
  });

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        entityType: z.string(),
        entityId: z.string().uuid(),
        filePath: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }: { data: { entityType: string; entityId: string; filePath: string; fileName: string; mimeType: string; sizeBytes: number }; context: any }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_documents")
      .insert({
        user_id: userId,
        title: data.fileName,
        file_url: data.filePath,
        document_type: data.entityType,
      });

    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  });