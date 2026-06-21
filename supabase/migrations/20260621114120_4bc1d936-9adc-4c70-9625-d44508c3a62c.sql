
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.deposit_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.loan_status AS ENUM ('pending', 'approved', 'rejected', 'repaying', 'completed');
CREATE TYPE public.card_status AS ENUM ('active', 'frozen', 'cancelled');
CREATE TYPE public.tx_type AS ENUM ('deposit', 'loan_disbursement', 'loan_repayment', 'card_topup', 'card_refund', 'referral_bonus', 'adjustment');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.profiles(id),
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  frozen_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (frozen_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ============ DEPOSITS ============
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  amount_dzd NUMERIC(14,2) NOT NULL CHECK (amount_dzd > 0),
  exchange_rate NUMERIC(10,4) NOT NULL,
  receipt_path TEXT NOT NULL,
  status public.deposit_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- ============ VIRTUAL CARDS ============
CREATE TABLE public.virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number_masked TEXT NOT NULL,
  card_number_last4 TEXT NOT NULL,
  expiry_month INT NOT NULL,
  expiry_year INT NOT NULL,
  cvv_encrypted TEXT NOT NULL,
  cardholder_name TEXT NOT NULL,
  balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  status public.card_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.virtual_cards TO authenticated;
GRANT ALL ON public.virtual_cards TO service_role;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;

-- ============ LOANS ============
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_repayment NUMERIC(14,2) NOT NULL,
  remaining_balance NUMERIC(14,2) NOT NULL,
  installment_count INT NOT NULL DEFAULT 1,
  status public.loan_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- ============ REFERRALS ============
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_paid BOOLEAN NOT NULL DEFAULT false,
  bonus_amount_usd NUMERIC(14,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount_usd NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin updates any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- wallets
CREATE POLICY "users view own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- deposits
CREATE POLICY "users view own deposits" ON public.deposits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own deposits" ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "admin updates deposits" ON public.deposits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- virtual_cards
CREATE POLICY "users view own cards" ON public.virtual_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own cards" ON public.virtual_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own cards" ON public.virtual_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- loans
CREATE POLICY "users view own loans" ON public.loans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own loans" ON public.loans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- referrals
CREATE POLICY "users view own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "users view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users mark own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- transactions
CREATE POLICY "users view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- generate unique referral code
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE code TEXT;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END; $$;

-- on new user: create profile, wallet, default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code_input TEXT;
  referrer_uuid UUID;
BEGIN
  ref_code_input := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code_input IS NOT NULL THEN
    SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code = upper(ref_code_input);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, referral_code, referred_by, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone',
    public.gen_referral_code(),
    referrer_uuid,
    COALESCE(NEW.raw_user_meta_data->>'language','ar')
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  IF referrer_uuid IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (referrer_uuid, NEW.id);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- secure RPC: approve a deposit (admin only)
CREATE OR REPLACE FUNCTION public.approve_deposit(_deposit_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dep public.deposits;
  new_balance NUMERIC(14,2);
  ref RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF dep.status <> 'pending' THEN RAISE EXCEPTION 'deposit already processed'; END IF;

  UPDATE public.wallets SET balance_usd = balance_usd + dep.amount_usd
    WHERE user_id = dep.user_id RETURNING balance_usd INTO new_balance;

  UPDATE public.deposits SET status='approved', admin_note=_note,
    reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_deposit_id RETURNING * INTO dep;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
  VALUES (dep.user_id, 'deposit', dep.amount_usd, new_balance, dep.id, 'BaridiMob deposit approved');

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (dep.user_id, 'تمت الموافقة على الإيداع',
    'تم إضافة ' || dep.amount_usd || '$ إلى محفظتك.');

  -- referral bonus on first approved deposit
  SELECT r.* INTO ref FROM public.referrals r
    WHERE r.referred_id = dep.user_id AND r.bonus_paid = false;
  IF FOUND THEN
    UPDATE public.wallets SET balance_usd = balance_usd + ref.bonus_amount_usd
      WHERE user_id = ref.referrer_id RETURNING balance_usd INTO new_balance;
    UPDATE public.referrals SET bonus_paid = true WHERE id = ref.id;
    INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
      VALUES (ref.referrer_id, 'referral_bonus', ref.bonus_amount_usd, new_balance, ref.id, 'Referral bonus');
    INSERT INTO public.notifications (user_id, title, body)
      VALUES (ref.referrer_id, 'مكافأة إحالة',
        'حصلت على ' || ref.bonus_amount_usd || '$ بعد أول شحن لمن أحلتهم.');
  END IF;

  RETURN dep;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_deposit(_deposit_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dep public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO dep FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF dep.status <> 'pending' THEN RAISE EXCEPTION 'deposit already processed'; END IF;

  UPDATE public.deposits SET status='rejected', admin_note=_note,
    reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_deposit_id RETURNING * INTO dep;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (dep.user_id, 'تم رفض الإيداع',
    COALESCE(_note,'يرجى مراجعة الوصل وإعادة المحاولة.'));

  RETURN dep;
END; $$;

-- top up virtual card from wallet
CREATE OR REPLACE FUNCTION public.topup_card(_card_id UUID, _amount NUMERIC)
RETURNS public.virtual_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.virtual_cards; w_balance NUMERIC;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT * INTO c FROM public.virtual_cards WHERE id=_card_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'card not active'; END IF;

  UPDATE public.wallets SET balance_usd = balance_usd - _amount
    WHERE user_id = auth.uid() AND balance_usd >= _amount RETURNING balance_usd INTO w_balance;
  IF w_balance IS NULL THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  UPDATE public.virtual_cards SET balance_usd = balance_usd + _amount
    WHERE id = _card_id RETURNING * INTO c;

  INSERT INTO public.transactions (user_id, type, amount_usd, balance_after, reference_id, description)
    VALUES (auth.uid(), 'card_topup', -_amount, w_balance, _card_id, 'Card top-up');
  RETURN c;
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_card TO authenticated;
