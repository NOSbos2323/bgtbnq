
DROP FUNCTION IF EXISTS public.admin_set_deposit_rib(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_set_deposit_rib(_user_id uuid, _rib text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET deposit_rib = NULLIF(trim(_rib), '') WHERE id = _user_id RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  RETURN p;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_set_deposit_rib(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_deposit_rib(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_deposit_rib(_deposit_id uuid, _rib text)
RETURNS public.deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dep public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _rib IS NULL OR length(btrim(_rib)) < 6 THEN RAISE EXCEPTION 'invalid RIB'; END IF;
  UPDATE public.deposits
     SET status='awaiting_receipt', assigned_rib=btrim(_rib),
         rib_deadline = now() + interval '5 minutes', reviewed_by = auth.uid()
   WHERE id = _deposit_id AND status = 'awaiting_rib'
   RETURNING * INTO dep;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not in awaiting_rib state'; END IF;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (dep.user_id, 'تم تخصيص رقم الشحن',
    'أدخل الوصل خلال 5 دقائق. RIP: ' || dep.assigned_rib);
  RETURN dep;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_deposit_rib(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_deposit_rib(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.telegram_admin_action(
  _kind text, _id uuid, _action text, _note text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'no admin user configured'; END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', admin_id::text, 'role', 'authenticated')::text, true);
  IF _kind = 'deposit' AND _action = 'approve' THEN PERFORM public.approve_deposit(_id, _note);
  ELSIF _kind = 'deposit' AND _action = 'reject' THEN PERFORM public.reject_deposit(_id, _note);
  ELSIF _kind = 'deposit' AND _action = 'assign_rib' THEN PERFORM public.admin_assign_deposit_rib(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'approve' THEN PERFORM public.approve_transfer(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'reject' THEN PERFORM public.reject_transfer(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'approve' THEN PERFORM public.approve_verification(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'reject' THEN PERFORM public.reject_verification(_id, _note);
  ELSE RAISE EXCEPTION 'unknown action %/%', _kind, _action;
  END IF;
  RETURN 'ok';
END; $$;
