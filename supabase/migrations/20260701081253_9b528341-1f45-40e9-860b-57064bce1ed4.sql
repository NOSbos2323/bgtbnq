
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'awaiting_rib' BEFORE 'pending';
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'awaiting_receipt' BEFORE 'pending';

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS assigned_rib text,
  ADD COLUMN IF NOT EXISTS rib_deadline timestamptz;

ALTER TABLE public.deposits ALTER COLUMN receipt_path DROP NOT NULL;

DROP FUNCTION IF EXISTS public.admin_set_deposit_rib(uuid, text);
DROP FUNCTION IF EXISTS public.create_deposit_request(numeric, numeric);
DROP FUNCTION IF EXISTS public.submit_deposit_receipt(uuid, text);

CREATE OR REPLACE FUNCTION public.create_deposit_request(_amount_usd numeric, _rate numeric)
RETURNS public.deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dep public.deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount_usd IS NULL OR _amount_usd <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _rate IS NULL OR _rate <= 0 THEN RAISE EXCEPTION 'invalid rate'; END IF;
  INSERT INTO public.deposits (user_id, amount_usd, amount_dzd, exchange_rate, status)
  VALUES (auth.uid(), _amount_usd, _amount_usd * _rate, _rate, 'awaiting_rib')
  RETURNING * INTO dep;
  RETURN dep;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_deposit_rib(_deposit_id uuid, _rib text)
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

CREATE OR REPLACE FUNCTION public.submit_deposit_receipt(_deposit_id uuid, _receipt_path text)
RETURNS public.deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dep public.deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _receipt_path IS NULL OR length(_receipt_path) < 3 THEN RAISE EXCEPTION 'invalid receipt'; END IF;
  UPDATE public.deposits
     SET receipt_path = _receipt_path, status = 'pending'
   WHERE id = _deposit_id AND user_id = auth.uid()
     AND status = 'awaiting_receipt'
     AND (rib_deadline IS NULL OR rib_deadline > now())
   RETURNING * INTO dep;
  IF NOT FOUND THEN RAISE EXCEPTION 'expired or invalid request'; END IF;
  RETURN dep;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_deposit_request(numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deposit_receipt(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_deposit_rib(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_deposit_rib(uuid, text) TO authenticated, service_role;

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
  ELSIF _kind = 'deposit' AND _action = 'set_rib' THEN PERFORM public.admin_set_deposit_rib(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'approve' THEN PERFORM public.approve_transfer(_id, _note);
  ELSIF _kind = 'transfer' AND _action = 'reject' THEN PERFORM public.reject_transfer(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'approve' THEN PERFORM public.approve_verification(_id, _note);
  ELSIF _kind = 'verification' AND _action = 'reject' THEN PERFORM public.reject_verification(_id, _note);
  ELSE RAISE EXCEPTION 'unknown action %/%', _kind, _action;
  END IF;
  RETURN 'ok';
END; $$;
