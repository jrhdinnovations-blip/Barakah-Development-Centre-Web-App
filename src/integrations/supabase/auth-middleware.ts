import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { supabase } from "@/integrations/supabase/client";

export const requireSupabaseAuth = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const authHeader = headers.get("authorization") || headers.get("cookie") || "";

  // Extract token or validate active session
  const token = authHeader.includes("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;

  const { data: { user }, error } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized access");
  }

  return next({
    context: {
      supabase,
      userId: user.id,
      user,
    },
  });
});