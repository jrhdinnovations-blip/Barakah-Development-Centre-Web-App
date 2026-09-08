-- Update the handle_new_user trigger function to read and assign the requested role from user metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
  meta_role text;
BEGIN
  meta_role := NEW.raw_user_meta_data ->> 'role';
  
  -- Attempt to cast the meta_role to app_role, fallback to registered_user if null or invalid
  BEGIN
    IF meta_role IS NOT NULL THEN
      assigned_role := meta_role::public.app_role;
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
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$;
