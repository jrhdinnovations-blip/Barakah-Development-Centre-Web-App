-- Fix: Allow admins and swift_managers to read ALL profiles
-- The original enum only has 'registered_user' and 'administrator'.
-- swift_manager role is stored in user_roles but NOT in the enum,
-- so we need a more permissive approach using a direct subquery.

-- 1. Drop the conflicting old policies
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;

-- 2. Create a single clean policy:
--    - Users can read their own profile
--    - Anyone whose user_id appears in user_roles with role = administrator can read all
--    - We also check raw text via a direct subquery to support swift_manager (stored outside enum)
CREATE POLICY "Profiles select policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('administrator', 'swift_manager')
    )
  );
