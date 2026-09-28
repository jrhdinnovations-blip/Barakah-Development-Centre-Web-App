-- Fix: Add missing enum values AND update trigger to handle role mapping
-- This fixes the root cause of drivers/dispatch_riders seeing the customer dashboard

-- Step 1: Add missing roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatch_rider';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatcher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- Step 2: Update the handle_new_user trigger to properly map roles
-- dispatch_rider maps to 'dispatch_rider' (now valid)
-- driver maps to 'driver' (already valid)  
-- staff maps to 'staff' (now valid)
-- unknown roles fall back to registered_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
  meta_role text;
BEGIN
  meta_role := NEW.raw_user_meta_data ->> 'role';
  
  -- Map role strings to valid app_role enum values
  -- This handles cases where the role is set via admin API
  BEGIN
    IF meta_role IS NOT NULL THEN
      -- Explicit mapping for known roles
      CASE meta_role
        WHEN 'administrator' THEN assigned_role := 'administrator'::public.app_role;
        WHEN 'admin' THEN assigned_role := 'admin'::public.app_role;
        WHEN 'driver' THEN assigned_role := 'driver'::public.app_role;
        WHEN 'dispatch_rider' THEN assigned_role := 'dispatch_rider'::public.app_role;
        WHEN 'swift_manager' THEN assigned_role := 'swift_manager'::public.app_role;
        WHEN 'swift_dispatcher' THEN assigned_role := 'swift_dispatcher'::public.app_role;
        WHEN 'dispatcher' THEN assigned_role := 'dispatcher'::public.app_role;
        WHEN 'staff' THEN assigned_role := 'staff'::public.app_role;
        WHEN 'programme_officer' THEN assigned_role := 'programme_officer'::public.app_role;
        WHEN 'content_editor' THEN assigned_role := 'content_editor'::public.app_role;
        WHEN 'registered_user' THEN assigned_role := 'registered_user'::public.app_role;
        ELSE assigned_role := 'registered_user'::public.app_role;
      END CASE;
    ELSE
      assigned_role := 'registered_user'::public.app_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'registered_user'::public.app_role;
  END;

  INSERT INTO public.profiles (user_id, full_name, phone, consent_given)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE((NEW.raw_user_meta_data ->> 'consent_given')::boolean, false)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Step 3: Fix existing drivers who have registered_user role but should be driver/dispatch_rider
-- This updates existing users based on their auth metadata
UPDATE public.user_roles ur
SET role = CASE 
  WHEN (
    SELECT raw_user_meta_data ->> 'role' 
    FROM auth.users 
    WHERE id = ur.user_id
  ) = 'driver' THEN 'driver'::public.app_role
  WHEN (
    SELECT raw_user_meta_data ->> 'role' 
    FROM auth.users 
    WHERE id = ur.user_id
  ) = 'dispatch_rider' THEN 'dispatch_rider'::public.app_role
  ELSE ur.role
END
WHERE ur.role = 'registered_user'
  AND (
    SELECT raw_user_meta_data ->> 'role' 
    FROM auth.users 
    WHERE id = ur.user_id
  ) IN ('driver', 'dispatch_rider');
