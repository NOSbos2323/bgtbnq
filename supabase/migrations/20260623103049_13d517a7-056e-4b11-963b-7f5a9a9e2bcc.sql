
-- 1) Profiles: verification + RIB + admin account flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rib TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS verification_note TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_admin_account BOOLEAN NOT NULL DEFAULT false;

-- Allow admins to read all profiles (for admin search / transfer recipient lookups admins do)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to look up minimal recipient info via RPC (we'll use SECURITY DEFINER RPCs instead of broad SELECT).

-- 2) Transfers table (user <-> user)
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their transfers" ON public.transfers
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Inserts are done via SECURITY DEFINER RPC; block direct inserts:
CREATE POLICY "Block direct insert" ON public.transfers
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE INDEX IF NOT EXISTS transfers_sender_idx ON public.transfers(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transfers_recipient_idx ON public.transfers(recipient_id, created_at DESC);

-- 3) Verification requests log
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  balance_at_request_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own verification requests" ON public.verification_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Block direct insert" ON public.verification_requests
  FOR INSERT TO authenticated WITH CHECK (false);

-- 4) RPC: transfer funds between users
CREATE OR REPLACE FUNCTION public.send_transfer(_recipient_identifier TEXT, _amount NUMERIC, _note TEXT DEFAULT NULL)
RETURNS public.transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_profile public.profiles;
  recipient_profile public.profiles;
  sender_balance NUMERIC(14,2);
  recipient_balance NUMERIC(14,2);
  tr public.transfers;
  ident TEXT;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT * INTO sender_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'sender not found'; END IF;

  ident := trim(_recipient_identifier);
  SELECT * INTO recipient_profile FROM public.profiles
    WHERE lower(email) = lower(ident)
       OR referral_code = upper(ident)
       OR rib = ident
    LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipient not found'; END IF;
  IF recipient_profile.id = sender_profile.id THEN RAISE EXCEPTION 'cannot transfer to yourself'; END IF;

  -- Both sides must be verified (admin account counts as verified)
  IF sender_profile.verification_status <> 'verified' AND NOT sender_profile.is_admin_account THEN
    RAISE EXCEPTION 'sender not verified';
  END IF;

  -- Deduct from sender atomically
  UPDATE public.wallets SET balance_usd = balance_usd - _amount
    WHERE user_id = sender_profile.id AND balance_usd >= _amount
    RETURNING balance_usd INTO sender_balance;
  IF sender_balance IS NULL THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  UPDATE public.wallets SET balance_usd = balance_usd + _amount
    WHERE user_id = recipient_profile.id
    RETURNING balance_usd INTO recipient_balance;

  INSERT INTO public.transfers (sender_id, recipient_id, amount_usd, note)
    VALUES (sender_profile.id, recipient_profile.id, _amount, _note)
    RETURNING * INTO tr;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (sender_profile.id, 'transfer_out', -_amount, sender_balance, tr.id,
      'Sent to ' || COALESCE(recipient_profile.full_name, recipient_profile.email));
  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (recipient_profile.id, 'transfer_in', _amount, recipient_balance, tr.id,
      'Received from ' || COALESCE(sender_profile.full_name, sender_profile.email));

  INSERT INTO public.notifications (user_id, title, body)
    VALUES (recipient_profile.id, 'تحويل جديد',
      'استلمت ' || _amount || '$ من ' || COALESCE(sender_profile.full_name, sender_profile.email));

  RETURN tr;
END; $$;

-- 5) RPC: lookup recipient (limited fields) to preview before sending
CREATE OR REPLACE FUNCTION public.lookup_recipient(_identifier TEXT)
RETURNS TABLE(id UUID, full_name TEXT, email TEXT, verification_status TEXT, is_admin_account BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.verification_status, p.is_admin_account
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_identifier))
     OR p.referral_code = upper(trim(_identifier))
     OR p.rib = trim(_identifier)
  LIMIT 1;
$$;

-- 6) RPC: request verification (requires balance >= 3000 DZD ~= 12 USD)
CREATE OR REPLACE FUNCTION public.request_verification()
RETURNS public.verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal NUMERIC(14,2);
  cur_status TEXT;
  req public.verification_requests;
  min_usd NUMERIC := 12; -- 3000 DZD at ~250 rate
BEGIN
  SELECT verification_status INTO cur_status FROM public.profiles WHERE id = auth.uid();
  IF cur_status = 'verified' THEN RAISE EXCEPTION 'already verified'; END IF;
  IF cur_status = 'pending' THEN RAISE EXCEPTION 'verification already pending'; END IF;

  SELECT balance_usd INTO bal FROM public.wallets WHERE user_id = auth.uid();
  IF bal IS NULL OR bal < min_usd THEN
    RAISE EXCEPTION 'insufficient balance for verification (need 3000 DZD)';
  END IF;

  UPDATE public.profiles SET verification_status = 'pending' WHERE id = auth.uid();

  INSERT INTO public.verification_requests (user_id, balance_at_request_usd)
    VALUES (auth.uid(), bal) RETURNING * INTO req;

  INSERT INTO public.notifications (user_id, title, body)
    VALUES (auth.uid(), 'طلب توثيق', 'تم إرسال طلب توثيق حسابك للمراجعة.');

  RETURN req;
END; $$;

-- 7) Admin: approve verification
CREATE OR REPLACE FUNCTION public.approve_verification(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.verification_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO req FROM public.verification_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;

  UPDATE public.verification_requests SET status='approved', admin_note=_note,
    reviewed_by=auth.uid(), reviewed_at=now() WHERE id = _request_id RETURNING * INTO req;

  UPDATE public.profiles SET verification_status='verified', verified_at=now(),
    verification_note=_note WHERE id = req.user_id;

  INSERT INTO public.notifications (user_id, title, body)
    VALUES (req.user_id, 'تم توثيق حسابك ✓', 'مبروك! أصبح حسابك موثقاً.');
  RETURN req;
END; $$;

-- 8) Admin: reject verification
CREATE OR REPLACE FUNCTION public.reject_verification(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.verification_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO req FROM public.verification_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;

  UPDATE public.verification_requests SET status='rejected', admin_note=_note,
    reviewed_by=auth.uid(), reviewed_at=now() WHERE id = _request_id RETURNING * INTO req;
  UPDATE public.profiles SET verification_status='rejected', verification_note=_note
    WHERE id = req.user_id;
  INSERT INTO public.notifications (user_id, title, body)
    VALUES (req.user_id, 'رفض التوثيق', COALESCE(_note, 'يرجى استيفاء الشروط وإعادة المحاولة.'));
  RETURN req;
END; $$;

-- 9) Admin: update a user's RIB
CREATE OR REPLACE FUNCTION public.admin_update_user_rib(_user_id UUID, _rib TEXT)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET rib = NULLIF(trim(_rib), '') WHERE id = _user_id RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.notifications (user_id, title, body)
    VALUES (_user_id, 'تحديث RIB', 'تم تحديث رقم RIB الخاص بحسابك من قبل الإدارة.');
  RETURN p;
END; $$;

-- 10) Admin: adjust wallet (credit/debit) - optional power
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_user_id UUID, _delta NUMERIC, _reason TEXT DEFAULT 'manual adjustment')
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.wallets SET balance_usd = balance_usd + _delta
    WHERE user_id = _user_id AND balance_usd + _delta >= 0
    RETURNING balance_usd INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'adjustment would make balance negative or wallet missing'; END IF;
  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, description)
    VALUES (_user_id, 'admin_adjustment', _delta, new_bal, _reason);
  INSERT INTO public.notifications (user_id, title, body)
    VALUES (_user_id, 'تعديل من الإدارة', _reason || ': ' || _delta || '$');
  RETURN new_bal;
END; $$;

-- 11) Mark medpikora@gmail.com as the admin account
UPDATE public.profiles SET is_admin_account = true, verification_status='verified', verified_at=now()
  WHERE lower(email) = 'medpikora@gmail.com';
