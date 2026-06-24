import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Snowflake, Sun, Wifi } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cards")({
  component: CardsPage,
});

function CardsPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [flipped, setFlipped] = useState<string | null>(null);

  const cards = useQuery({
    queryKey: ["cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("virtual_cards")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const profile = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const activeCount = (cards.data ?? []).filter((c: any) => c.status !== "cancelled").length;
  const atLimit = activeCount >= 2;

  const createCard = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not signed");
      if (atLimit) throw new Error(lang === "ar" ? "الحد الأقصى بطاقتان لكل حساب" : "Maximum 2 cards per account");
      const num = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
      const last4 = num.slice(-4);
      const masked = `**** **** **** ${last4}`;
      const cvv = String(Math.floor(100 + Math.random() * 900));
      const now = new Date();
      const exp = new Date(now.getFullYear() + 4, now.getMonth());
      const { error } = await supabase.from("virtual_cards").insert({
        user_id: user.id,
        card_number_masked: masked,
        card_number_last4: last4,
        cvv_encrypted: btoa(cvv),
        expiry_month: exp.getMonth() + 1,
        expiry_year: exp.getFullYear(),
        cardholder_name: (profile.data?.full_name ?? user.email ?? "USER").toUpperCase().slice(0, 24),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إنشاء البطاقة" : "Card created");
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const toggleFreeze = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "frozen" }) => {
      const next = status === "frozen" ? "active" : "frozen";
      const { error } = await supabase.from("virtual_cards").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t("virtual_cards")}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {lang === "ar" ? `${activeCount} / 2 بطاقة` : `${activeCount} / 2 cards`}
          </p>
        </div>
        <button
          onClick={() => createCard.mutate()}
          disabled={createCard.isPending || atLimit}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm font-bold neon-emerald disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> {t("create_card")}
        </button>
      </header>

      {atLimit && (
        <div className="glass-strong rounded-2xl p-3 text-xs text-yellow-300/90 border border-yellow-400/20">
          {lang === "ar"
            ? "وصلت للحد الأقصى من البطاقات (2). يمكنك تجميد إحداها أو التواصل مع الإدارة."
            : "You reached the card limit (2). Freeze one or contact admin."}
        </div>
      )}

      {cards.data && cards.data.length > 0 ? (
        <div className="space-y-5">
          {cards.data.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setFlipped(flipped === c.id ? null : c.id)}
                className="block w-full text-start"
              >
                <div className="relative h-52 rounded-3xl overflow-hidden card-3d bg-gradient-to-br from-[oklch(0.32_0.08_158)] via-[oklch(0.22_0.05_220)] to-[oklch(0.18_0.04_280)] border border-white/10 p-5 transition-transform duration-500" style={{ transform: flipped === c.id ? "rotateY(180deg)" : "none", transformStyle: "preserve-3d" }}>
                  {/* Front */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-between" style={{ backfaceVisibility: "hidden" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">NeoBank · USD</span>
                      <Wifi className="h-5 w-5 text-white/60 rotate-90" />
                    </div>
                    <div className="num-mono text-xl font-bold tracking-[0.2em] text-white" dir="ltr">
                      {c.card_number_masked}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] text-white/50 uppercase">Cardholder</div>
                        <div className="text-sm font-semibold text-white">{c.cardholder_name}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-[10px] text-white/50 uppercase">Balance</div>
                        <div className="num-mono text-lg font-bold text-primary" dir="ltr">
                          ${Number(c.balance_usd).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Back */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-between" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                    <div className="h-10 bg-black/40 -mx-5 mt-2" />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-white/50 uppercase">EXP</div>
                        <div className="num-mono text-sm text-white" dir="ltr">
                          {String(c.expiry_month).padStart(2, "0")}/{String(c.expiry_year).slice(-2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/50 uppercase">CVV</div>
                        <div className="num-mono text-sm text-white" dir="ltr">{atob(c.cvv_encrypted)}</div>
                      </div>
                      <span className="text-[10px] text-white/40">{c.status}</span>
                    </div>
                  </div>
                </div>
              </button>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => toggleFreeze.mutate({ id: c.id, status: c.status as any })}
                  className="flex-1 rounded-2xl glass-strong py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  {c.status === "frozen" ? <Sun className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                  {c.status === "frozen" ? t("unfreeze") : t("freeze")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-strong rounded-3xl p-10 text-center text-sm text-muted-foreground">
          {lang === "ar" ? "لا توجد بطاقات بعد. أنشئ بطاقتك الأولى." : "No cards yet. Create your first one."}
        </div>
      )}
    </div>
  );
}
