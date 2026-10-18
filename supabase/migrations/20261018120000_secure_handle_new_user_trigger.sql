-- Secure handle_new_user trigger:
-- Ensures that unprivileged signups can NEVER be assigned administrative roles (administrator, admin, swift_manager, dispatcher) via metadata.
-- Only barakahdevelopmentcentre@gmail.com (and barakahdevcentre@gmail.com) can ever be assigned administrator.
-- Drivers/riders applying are mapped to driver/dispatch_rider.
-- All other signups default strictly to 'registered_user'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
  meta_role text;
  user_email text;
BEGIN
  meta_role := NEW.raw_user_meta_data ->> 'role';
  user_email := lower(coalesce(NEW.email, ''));

  IF user_email = 'barakahdevelopmentcentre@gmail.com' OR user_email = 'barakahdevcentre@gmail.com' THEN
    assigned_role := 'administrator'::public.app_role;
  ELSIF meta_role IN ('driver', 'dispatch_rider') THEN
    assigned_role := meta_role::public.app_role;
  ELSE
    assigned_role := 'registered_user'::public.app_role;
  END IF;

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
