-- Create a SECURITY DEFINER RPC function that admins can call
-- to fetch all profiles regardless of RLS policies.
-- This runs as the DB owner, bypassing row-level security.

CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles ORDER BY created_at DESC;
$$;

-- Only authenticated users can call this function
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles() TO authenticated;
