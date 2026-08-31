REVOKE ALL ON FUNCTION public.log_ride_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_driver_rating() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_ride_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_driver_rating() TO service_role;