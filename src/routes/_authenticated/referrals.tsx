import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { Copy, Check, Gift, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const profile = useQuery({
    queryKey: ["profile-ref", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("referral_code").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const refs = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id, bonus_paid, bonus_amount_usd, created_at")
        .eq("referrer_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalEarned = (refs.data ?? []).filter((r) => r.bonus_paid).reduce((s, r) => s + Number(r.bonus_amount_usd), 0);

  const copy = async () => {
    if (!profile.data?.referral_code) return;
    await navigator.clipboard.writeText(profile.data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("referral_program")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("referral_hint")}</p>
      </header>

      <div className="glass-strong card-3d rounded-3xl p-6 text-center">
        <div className="text-xs text-muted-foreground">{t("your_code")}</div>
        <div className="mt-2 num-mono text-3xl font-extrabold tracking-[0.3em] text-primary" dir="ltr">
          {profile.data?.referral_code ?? "—"}
        </div>
        <button
          onClick={copy}
          className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold neon-emerald"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Users className="h-4 w-4" /> {lang === "ar" ? "المُحالين" : "Referrals"}
          </div>
          <div className="mt-2 num-mono font-bold text-2xl">{refs.data?.length ?? 0}</div>
        </div>
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary text-xs">
            <Gift className="h-4 w-4" /> {lang === "ar" ? "أرباحك" : "Earned"}
          </div>
          <div className="mt-2 num-mono font-bold text-2xl text-primary" dir="ltr">${totalEarned.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
