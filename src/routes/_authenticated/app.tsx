import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  Eye, EyeOff, ArrowDownToLine, Coins, CreditCard, Gift,
  ArrowUpRight, ArrowDownLeft, Bell,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance_usd, frozen_balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, referral_code")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const tx = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, type, amount_usd, created_at, description")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!user,
  });

  const balance = wallet.data?.balance_usd ?? 0;
  const firstName = profile.data?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t("welcome")} 👋</p>
          <h1 className="text-xl font-bold">{firstName || "User"}</h1>
        </div>
        <button className="glass h-11 w-11 grid place-items-center rounded-2xl">
          <Bell className="h-5 w-5" />
        </button>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-3xl card-3d p-5 bg-gradient-to-br from-[oklch(0.28_0.06_158)] via-[oklch(0.22_0.04_220)] to-[oklch(0.2_0.04_280)] border border-white/10">
        <div className="absolute -top-16 -end-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-20 -start-10 h-48 w-48 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs text-white/70">{t("total_balance")}</span>
          <button
            onClick={() => setHidden((h) => !h)}
            className="rounded-full glass px-2.5 py-1 text-[11px] inline-flex items-center gap-1"
          >
            {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hidden ? t("show_balance") : t("hide_balance")}
          </button>
        </div>

        <div className="relative mt-4 flex items-baseline gap-2 num-mono">
          <span className="text-4xl font-extrabold tracking-tight" dir="ltr">
            {hidden ? "•••••" : `$${Number(balance).toLocaleString(lang === "ar" ? "ar-DZ" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <span className="text-xs text-white/60">USD</span>
        </div>

        <div className="relative mt-5 flex gap-2">
          <Link
            to="/deposit"
            className="flex-1 rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-bold text-center neon-emerald inline-flex items-center justify-center gap-1.5"
          >
            <ArrowDownToLine className="h-4 w-4" /> {t("recharge")}
          </Link>
          <Link
            to="/cards"
            className="rounded-2xl glass-strong px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <CreditCard className="h-4 w-4" /> {t("cards")}
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">{t("quick_actions")}</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction to="/deposit" icon={<ArrowDownToLine className="h-5 w-5" />} label={t("recharge")} accent="emerald" />
          <QuickAction to="/loans" icon={<Coins className="h-5 w-5" />} label={t("request_loan")} accent="cyan" />
          <QuickAction to="/cards" icon={<CreditCard className="h-5 w-5" />} label={t("new_card")} accent="emerald" />
          <QuickAction to="/referrals" icon={<Gift className="h-5 w-5" />} label={t("referral_program")} accent="cyan" />
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">{t("recent_activity")}</h2>
        <div className="glass-strong rounded-3xl divide-y divide-white/5">
          {tx.data && tx.data.length > 0 ? (
            tx.data.map((row) => {
              const positive = Number(row.amount_usd) >= 0;
              return (
                <div key={row.id} className="flex items-center gap-3 p-4">
                  <div className={`h-10 w-10 grid place-items-center rounded-2xl ${positive ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                    {positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{labelForTxType(row.type, lang)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{row.description || new Date(row.created_at).toLocaleString(lang === "ar" ? "ar-DZ" : "en-US")}</p>
                  </div>
                  <div className={`num-mono text-sm font-bold ${positive ? "text-primary" : "text-foreground"}`} dir="ltr">
                    {positive ? "+" : ""}${Math.abs(Number(row.amount_usd)).toFixed(2)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("no_activity")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to, icon, label, accent,
}: { to: string; icon: React.ReactNode; label: string; accent: "emerald" | "cyan" }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2">
      <div className={`h-14 w-14 grid place-items-center rounded-2xl glass-strong ${accent === "emerald" ? "text-primary neon-emerald" : "text-accent neon-cyan"}`}>
        {icon}
      </div>
      <span className="text-[11px] text-center leading-tight">{label}</span>
    </Link>
  );
}

function labelForTxType(type: string, lang: string) {
  const ar: Record<string, string> = {
    deposit: "إيداع BaridiMob",
    loan_disbursement: "صرف قرض",
    loan_repayment: "سداد قرض",
    card_topup: "شحن بطاقة",
    card_refund: "استرداد بطاقة",
    referral_bonus: "مكافأة إحالة",
    adjustment: "تسوية",
  };
  const en: Record<string, string> = {
    deposit: "BaridiMob deposit",
    loan_disbursement: "Loan disbursement",
    loan_repayment: "Loan repayment",
    card_topup: "Card top-up",
    card_refund: "Card refund",
    referral_bonus: "Referral bonus",
    adjustment: "Adjustment",
  };
  return (lang === "ar" ? ar : en)[type] ?? type;
}
