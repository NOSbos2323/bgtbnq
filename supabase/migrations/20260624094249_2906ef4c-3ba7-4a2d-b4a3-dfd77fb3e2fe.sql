
-- 1. Profiles: per-user deposit RIB + telegram link
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deposit_rib TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. App settings (global key/value, admin-only writes)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings read all auth" ON public.app_settings;
CREATE POLICY "settings read all auth" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings admin write" ON public.app_settings;
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- seed default global deposit RIB placeholder
INSERT INTO public.app_settings(key,value) VALUES
  ('default_deposit_rib','00799999000123456789'),
  ('default_deposit_name','E-Bank Algeria'),
  ('exchange_rate_dzd_usd','250')
ON CONFLICT (key) DO NOTHING;

-- 3. Limit virtual cards to 2 per user
CREATE OR REPLACE FUNCTION public.enforce_max_two_cards()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.virtual_cards WHERE user_id = NEW.user_id AND status <> 'cancelled') >= 2 THEN
    RAISE EXCEPTION 'card limit reached (max 2 per user)';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_max_two_cards ON public.virtual_cards;
CREATE TRIGGER trg_max_two_cards BEFORE INSERT ON public.virtual_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_two_cards();

-- 4. Transfers: add status + audit, and admin escrow flow
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- new tx types
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'transfer_out';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'transfer_in';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'transfer_hold';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'transfer_refund';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'admin_adjustment';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Redefine send_transfer to HOLD funds (pending)
CREATE OR REPLACE FUNCTION public.send_transfer(_recipient_identifier text, _amount numeric, _note text DEFAULT NULL::text)
 RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_profile public.profiles;
  recipient_profile public.profiles;
  sender_balance NUMERIC(14,2);
  tr public.transfers;
  ident TEXT;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT * INTO sender_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'sender not found'; END IF;
  ident := trim(_recipient_identifier);
  SELECT * INTO recipient_profile FROM public.profiles
    WHERE lower(email)=lower(ident) OR referral_code=upper(ident) OR rib=ident LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipient not found'; END IF;
  IF recipient_profile.id = sender_profile.id THEN RAISE EXCEPTION 'cannot transfer to yourself'; END IF;
  IF sender_profile.verification_status <> 'verified' AND NOT sender_profile.is_admin_account THEN
    RAISE EXCEPTION 'sender not verified';
  END IF;

  -- Hold funds
  UPDATE public.wallets
    SET balance_usd = balance_usd - _amount,
        frozen_balance = frozen_balance + _amount
    WHERE user_id = sender_profile.id AND balance_usd >= _amount
    RETURNING balance_usd INTO sender_balance;
  IF sender_balance IS NULL THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  INSERT INTO public.transfers (sender_id, recipient_id, amount_usd, note, status)
    VALUES (sender_profile.id, recipient_profile.id, _amount, _note, 'pending') RETURNING * INTO tr;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (sender_profile.id, 'transfer_hold', -_amount, sender_balance, tr.id,
      'حجز تحويل بانتظار موافقة الإدارة');

  INSERT INTO public.notifications (user_id, title, body)
    VALUES (sender_profile.id, 'تحويل قيد المراجعة',
      'تم حجز ' || _amount || '$ بانتظار موافقة الإدارة على تحويلك.');

  RETURN tr;
END; $$;

-- 6. Admin approve transfer
CREATE OR REPLACE FUNCTION public.approve_transfer(_transfer_id uuid, _note text DEFAULT NULL)
RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.transfers; sb NUMERIC; rb NUMERIC;
  sp public.profiles; rp public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO tr FROM public.transfers WHERE id=_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF tr.status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;

  SELECT * INTO sp FROM public.profiles WHERE id = tr.sender_id;
  SELECT * INTO rp FROM public.profiles WHERE id = tr.recipient_id;

  -- release hold from sender
  UPDATE public.wallets SET frozen_balance = frozen_balance - tr.amount_usd
    WHERE user_id = tr.sender_id RETURNING balance_usd INTO sb;
  -- credit recipient
  UPDATE public.wallets SET balance_usd = balance_usd + tr.amount_usd
    WHERE user_id = tr.recipient_id RETURNING balance_usd INTO rb;

  UPDATE public.transfers SET status='approved', reviewed_at=now(),
    reviewed_by=auth.uid(), admin_note=_note WHERE id=_transfer_id RETURNING * INTO tr;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (tr.sender_id, 'transfer_out', -tr.amount_usd, sb, tr.id,
      'تحويل إلى ' || COALESCE(rp.full_name, rp.email));
  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (tr.recipient_id, 'transfer_in', tr.amount_usd, rb, tr.id,
      'تحويل من ' || COALESCE(sp.full_name, sp.email));

  INSERT INTO public.notifications (user_id, title, body) VALUES
    (tr.sender_id, 'تمت الموافقة على التحويل', 'تم تنفيذ تحويلك بمبلغ ' || tr.amount_usd || '$'),
    (tr.recipient_id, 'تحويل جديد', 'استلمت ' || tr.amount_usd || '$ من ' || COALESCE(sp.full_name, sp.email));

  RETURN tr;
END; $$;

-- 7. Admin reject transfer (refund hold)
CREATE OR REPLACE FUNCTION public.reject_transfer(_transfer_id uuid, _note text DEFAULT NULL)
RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.transfers; sb NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO tr FROM public.transfers WHERE id=_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF tr.status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;

  UPDATE public.wallets
    SET balance_usd = balance_usd + tr.amount_usd,
        frozen_balance = frozen_balance - tr.amount_usd
    WHERE user_id = tr.sender_id RETURNING balance_usd INTO sb;

  UPDATE public.transfers SET status='rejected', reviewed_at=now(),
    reviewed_by=auth.uid(), admin_note=_note WHERE id=_transfer_id RETURNING * INTO tr;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (tr.sender_id, 'transfer_refund', tr.amount_usd, sb, tr.id,
      'إعادة مبلغ تحويل مرفوض' || COALESCE(': '||_note,''));

  INSERT INTO public.notifications (user_id, title, body)
    VALUES (tr.sender_id, 'رفض التحويل',
      COALESCE(_note,'تم رفض تحويلك وإعادة المبلغ إلى محفظتك.'));

  RETURN tr;
END; $$;

-- 8. Admin sets per-user deposit RIB
CREATE OR REPLACE FUNCTION public.admin_set_deposit_rib(_user_id uuid, _rib text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET deposit_rib = NULLIF(trim(_rib),'') WHERE id=_user_id RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.notifications (user_id, title, body)
    VALUES (_user_id, 'تحديث ريب الشحن', 'تم تخصيص ريب شحن جديد لحسابك من قبل الإدارة.');
  RETURN p;
END; $$;

-- 9. Admin full user dossier
CREATE OR REPLACE FUNCTION public.admin_get_user_details(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id=_user_id),
    'wallet',  (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id=_user_id),
    'cards',   (SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC), '[]'::jsonb)
                 FROM public.virtual_cards c WHERE c.user_id=_user_id),
    'deposits',(SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.created_at DESC), '[]'::jsonb)
                 FROM public.deposits d WHERE d.user_id=_user_id),
    'transfers_sent', (SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
                 FROM public.transfers t WHERE t.sender_id=_user_id),
    'transfers_received', (SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
                 FROM public.transfers t WHERE t.recipient_id=_user_id),
    'verifications', (SELECT COALESCE(jsonb_agg(row_to_json(v) ORDER BY v.created_at DESC), '[]'::jsonb)
                 FROM public.verification_requests v WHERE v.user_id=_user_id),
    'transactions', (SELECT COALESCE(jsonb_agg(row_to_json(tx) ORDER BY tx.created_at DESC), '[]'::jsonb)
                 FROM (SELECT * FROM public.transactions WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 50) tx)
  ) INTO result;
  RETURN result;
END; $$;

-- 10. Admin set telegram chat id for self
CREATE OR REPLACE FUNCTION public.set_my_telegram_chat(_chat_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET telegram_chat_id = NULLIF(trim(_chat_id),'') WHERE id = auth.uid();
END; $$;

-- 11. Admin SELECT policies on cards/deposits/transfers/verification/profiles/wallets/transactions
DROP POLICY IF EXISTS "admin read all profiles" ON public.profiles;
CREATE POLICY "admin read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin update profiles" ON public.profiles;
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all wallets" ON public.wallets;
CREATE POLICY "admin read all wallets" ON public.wallets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all cards" ON public.virtual_cards;
CREATE POLICY "admin read all cards" ON public.virtual_cards FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all deposits" ON public.deposits;
CREATE POLICY "admin read all deposits" ON public.deposits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all transfers" ON public.transfers;
CREATE POLICY "admin read all transfers" ON public.transfers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all verification" ON public.verification_requests;
CREATE POLICY "admin read all verification" ON public.verification_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read all tx" ON public.transactions;
CREATE POLICY "admin read all tx" ON public.transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin read notifications" ON public.notifications;
CREATE POLICY "admin read notifications" ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
