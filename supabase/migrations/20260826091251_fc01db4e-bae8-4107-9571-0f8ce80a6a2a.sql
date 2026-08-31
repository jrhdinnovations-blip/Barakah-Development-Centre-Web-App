REVOKE EXECUTE ON FUNCTION public.is_swift_staff(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_swift_staff(uuid) TO authenticated, service_role;