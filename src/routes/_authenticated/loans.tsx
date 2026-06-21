import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/loans")({
  component: LoansPage,
});

const INTEREST = 0.08;

function LoansPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("100");
  const [installments, setInstallments] = useState(3);

  const loans = useQuery({
    queryKey: ["loans", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const calc = useMemo(() => {
    const a = Number(amount) || 0;
    const total = a * (1 + INTEREST);
    return { total, perInstallment: installments ? total / installments : 0 };
  }, [amount, installments]);

  const request = useMutation({
    mutationFn: async () => {
      const a = Number(amount);
      if (!a || a <= 0) throw new Error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
      const total = a * (1 + INTEREST);
      const { error } = await supabase.from("loans").insert({
        user_id: user!.id,
        amount_usd: a,
        interest_rate: INTEREST * 100,
        total_repayment: total,
        remaining_balance: total,
        installment_count: installments,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تقديم طلب القرض" : "Loan request submitted");
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("loan_calculator")}</h1>
      </header>

      <div className="glass-strong card-3d rounded-3xl p-5 space-y-4">
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">{t("amount")} ($)</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bank-input num-mono"
            dir="ltr"
          />
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{t("installments")}</span>
            <span className="num-mono font-bold text-primary">{installments}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 6, 9, 12].map((n) => (
              <button
                key={n}
                onClick={() => setInstallments(n)}
                className={`py-2 rounded-xl text-sm num-mono font-bold transition ${
                  installments === n
                    ? "bg-primary text-primary-foreground neon-emerald"
                    : "glass text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] text-muted-foreground">{t("total_repay")}</div>
            <div className="num-mono font-bold text-lg" dir="ltr">${calc.total.toFixed(2)}</div>
          </div>
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] text-muted-foreground">{t("installment_value")}</div>
            <div className="num-mono font-bold text-lg text-primary" dir="ltr">${calc.perInstallment.toFixed(2)}</div>
          </div>
        </div>

        <button
          onClick={() => request.mutate()}
          disabled={request.isPending}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald disabled:opacity-60"
        >
          {request.isPending ? t("loading") : t("submit_loan")}
        </button>
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">
          {lang === "ar" ? "قروضي" : "My loans"}
        </h2>
        <div className="glass-strong rounded-3xl divide-y divide-white/5">
          {loans.data && loans.data.length > 0 ? (
            loans.data.map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="num-mono font-bold" dir="ltr">${Number(l.amount_usd).toFixed(2)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {l.installment_count} × ${(Number(l.total_repayment) / l.installment_count).toFixed(2)}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {l.status}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("no_activity")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
