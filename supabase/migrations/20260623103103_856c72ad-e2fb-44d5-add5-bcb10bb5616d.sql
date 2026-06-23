
REVOKE EXECUTE ON FUNCTION public.send_transfer(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lookup_recipient(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_verification() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_verification(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_verification(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_rib(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_transfer(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_recipient(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_verification(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_verification(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_rib(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(UUID, NUMERIC, TEXT) TO authenticated;
