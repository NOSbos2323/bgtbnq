CREATE OR REPLACE FUNCTION public.telegram_admin_action(
  _kind text, _id uuid, _action text, _note text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'no admin user configured'; END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id::text, 'role', 'authenticated')::text,
    true
  );

  IF _kind = 'deposit' AND _action = 'approve' THEN
    PERFORM public.approve_deposit(_id, _note);
  ELSIF _kind = 'deposit' AND _action = 'reject' THEN
    PERFORM public.reject_deposit(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'approve' THEN
    PERFORM public.approve_transfer(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'reject' THEN
    PERFORM public.reject_transfer(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'approve' THEN
    PERFORM public.approve_verification(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'reject' THEN
    PERFORM public.reject_verification(_id, _note);
  ELSE
    RAISE EXCEPTION 'unknown action %/%', _kind, _action;
  END IF;

  RETURN 'ok';
END; $$;

REVOKE EXECUTE ON FUNCTION public.telegram_admin_action(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_admin_action(text, uuid, text, text) TO service_role;