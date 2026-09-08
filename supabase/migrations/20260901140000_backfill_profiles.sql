-- Backfill: Create profiles for all existing auth.users who don't have one yet
INSERT INTO public.profiles (user_id, full_name, phone, consent_given, created_at)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(NULLIF(u.raw_user_meta_data->>'phone', ''), NULL),
  true,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Backfill: Create user_roles for all existing auth.users who don't have one yet
-- Default everyone to 'registered_user' since that's in the enum
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
  u.id,
  'registered_user'::public.app_role,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify counts
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_count,
  (SELECT COUNT(*) FROM public.profiles) as profile_count,
  (SELECT COUNT(*) FROM public.user_roles) as roles_count;
