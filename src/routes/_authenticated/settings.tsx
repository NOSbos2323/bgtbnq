import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { notifyAdmin } from "@/lib/notify-admin";
import { User as UserIcon, Globe, LogOut, ShieldCheck, Bell, BadgeCheck, Clock, ShieldAlert, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const wallet = useQuery({
    queryKey: ["wallet-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance_usd").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const requestVerify = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_verification");
      if (error) throw error;
      return data as { id: string } | null;
    },
    onSuccess: (data) => {
      toast.success(lang === "ar" ? "تم إرسال طلب التوثيق" : "Verification request sent");
      qc.invalidateQueries({ queryKey: ["profile-full"] });
      notifyAdmin("verification", `New verification request from ${user?.email ?? "user"}`, data?.id);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("insufficient balance"))
        return toast.error(lang === "ar" ? "تحتاج 3000 دج على الأقل في رصيدك" : "You need at least 3000 DZD in balance");
      toast.error(msg || t("error_generic"));
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "ar" ? "تم إرسال رابط إعادة التعيين" : "Reset link sent");
  };

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("settings")}</h1>
      </header>

      {/* Profile card */}
      <div className="glass-strong card-3d rounded-3xl p-5 flex items-center gap-4">
        <div className="h-14 w-14 grid place-items-center rounded-2xl bg-primary/15 text-primary">
          {profile.data?.is_admin_account ? <Crown className="h-7 w-7 text-yellow-300" /> : <UserIcon className="h-7 w-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate flex items-center gap-1.5">
            {profile.data?.full_name ?? user?.email}
            {profile.data?.verification_status === "verified" && <BadgeCheck className="h-4 w-4 text-primary" />}
          </div>
          <div className="text-xs text-muted-foreground truncate" dir="ltr">{user?.email}</div>
          {profile.data?.rib && (
            <div className="text-[10px] text-muted-foreground num-mono truncate mt-0.5" dir="ltr">RIB: {profile.data.rib}</div>
          )}
        </div>
      </div>

      {/* Verification */}
      <Section title={t("verify_account")} icon={<BadgeCheck className="h-4 w-4" />}>
        <VerificationCard
          status={profile.data?.verification_status ?? "unverified"}
          balanceUsd={Number(wallet.data?.balance_usd ?? 0)}
          onRequest={() => requestVerify.mutate()}
          loading={requestVerify.isPending}
        />
      </Section>

      {/* Language */}
      <Section title={t("language")} icon={<Globe className="h-4 w-4" />}>
        <div className="flex gap-2">
          {(["ar", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
                lang === l ? "bg-primary text-primary-foreground neon-emerald" : "glass"
              }`}
            >
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section title={t("security")} icon={<ShieldCheck className="h-4 w-4" />}>
        <button
          onClick={sendReset}
          className="w-full text-start glass rounded-2xl p-4 text-sm font-semibold flex items-center justify-between"
        >
          {t("change_password")}
          <span className="text-xs text-muted-foreground">→</span>
        </button>
      </Section>

      {/* Notifications */}
      <Section title={t("notifications")} icon={<Bell className="h-4 w-4" />}>
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
          {lang === "ar" ? "إعدادات الإشعارات قريباً." : "Notification preferences coming soon."}
        </div>
      </Section>

      {isAdmin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="w-full glass-strong rounded-2xl p-4 text-sm font-semibold text-accent inline-flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" /> {t("admin_panel")}
        </button>
      )}

      <button
        onClick={handleLogout}
        className="w-full rounded-2xl bg-destructive/15 text-destructive py-3.5 font-bold inline-flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> {t("logout")}
      </button>
    </div>
  );
}

const RATE = 250;
const MIN_DZD = 3000;

function VerificationCard({ status, balanceUsd, onRequest, loading }: {
  status: string; balanceUsd: number; onRequest: () => void; loading: boolean;
}) {
  const { lang, t } = useI18n();
  const balanceDzd = balanceUsd * RATE;
  const meets = balanceDzd >= MIN_DZD;
  const pct = Math.min(100, (balanceDzd / MIN_DZD) * 100);

  if (status === "verified") {
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-primary/30">
        <BadgeCheck className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <div className="font-bold text-sm">{lang === "ar" ? "حسابك موثق ✓" : "Account verified ✓"}</div>
          <div className="text-[11px] text-muted-foreground">
            {lang === "ar" ? "يمكنك الإرسال والاستقبال دون قيود." : "You can send and receive without limits."}
          </div>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-yellow-500/30">
        <Clock className="h-6 w-6 text-yellow-400" />
        <div className="flex-1">
          <div className="font-bold text-sm">{t("verify_pending")}</div>
          <div className="text-[11px] text-muted-foreground">
            {lang === "ar" ? "ستصلك إشعار فور المراجعة." : "You'll be notified shortly."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-xs flex-1">
          <div className="font-bold mb-1">{t("verify_hint")}</div>
          <div className="text-muted-foreground">
            {lang === "ar"
              ? "التوثيق مجاني — فقط احتفظ بالمبلغ كادخار في رصيدك."
              : "Verification is free — just keep the amount as savings in your balance."}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground">{lang === "ar" ? "رصيدك" : "Your balance"}</span>
          <span className="num-mono font-bold" dir="ltr">
            {balanceDzd.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {MIN_DZD} DZD
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all ${meets ? "bg-primary" : "bg-yellow-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button
        onClick={onRequest}
        disabled={loading || !meets}
        className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground neon-emerald disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <BadgeCheck className="h-4 w-4" />
        {loading ? t("loading") : t("request_verify")}
      </button>
      {!meets && (
        <p className="text-[10px] text-muted-foreground text-center">
          {lang === "ar"
            ? `اشحن المزيد للوصول إلى ${MIN_DZD} دج`
            : `Top up to reach ${MIN_DZD} DZD`}
        </p>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground px-1">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
