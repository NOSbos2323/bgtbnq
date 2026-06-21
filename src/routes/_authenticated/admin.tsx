import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Check, X, ArrowLeft, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useI18n();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("id, amount_usd, amount_dzd, receipt_path, created_at, user_id, profiles:profiles!deposits_user_id_fkey(full_name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, totals, today] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance_usd"),
        supabase
          .from("deposits")
          .select("amount_usd")
          .eq("status", "approved")
          .gte("reviewed_at", new Date(new Date().toDateString()).toISOString()),
      ]);
      const totalBalance = (totals.data ?? []).reduce((s, w) => s + Number(w.balance_usd), 0);
      const todayUsd = (today.data ?? []).reduce((s, d) => s + Number(d.amount_usd), 0);
      return { users: u.count ?? 0, totalBalance, todayUsd };
    },
    enabled: isAdmin,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_deposit", { _deposit_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("approved"));
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_deposit", { _deposit_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("rejected"));
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("deposit-receipts")
      .createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    setPreviewUrl(data.signedUrl);
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/app" className="h-10 w-10 grid place-items-center rounded-xl glass">
          <ArrowLeft className="h-4 w-4 flip-x" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold">{t("admin_panel")}</h1>
          <p className="text-xs text-muted-foreground">
            {lang === "ar" ? "مراجعة طلبات الشحن ومراقبة العمليات." : "Review top-ups and monitor activity."}
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("total_users")} value={String(stats.data?.users ?? "—")} />
        <Stat label={t("total_deposits_today")} value={`$${(stats.data?.todayUsd ?? 0).toFixed(0)}`} accent />
        <Stat label={t("pending_count")} value={String(pending.data?.length ?? 0)} />
      </div>

      {/* Pending list */}
      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">{t("pending_deposits")}</h2>
        <div className="glass-strong rounded-3xl divide-y divide-white/5">
          {pending.data && pending.data.length > 0 ? (
            pending.data.map((d: any) => (
              <div key={d.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {d.profiles?.full_name ?? d.profiles?.email ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
                      {d.profiles?.email}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="num-mono font-bold text-primary" dir="ltr">
                      ${Number(d.amount_usd).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground num-mono" dir="ltr">
                      {Number(d.amount_dzd).toLocaleString()} DZD
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReceipt(d.receipt_path)}
                    className="flex-1 glass rounded-xl py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" /> {t("view")}
                  </button>
                  <button
                    onClick={() => approve.mutate(d.id)}
                    disabled={approve.isPending}
                    className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 neon-emerald disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> {t("approve")}
                  </button>
                  <button
                    onClick={() => reject.mutate(d.id)}
                    disabled={reject.isPending}
                    className="flex-1 bg-destructive/15 text-destructive rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" /> {t("reject")}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد طلبات معلقة." : "No pending requests."}
            </div>
          )}
        </div>
      </div>

      {/* Receipt preview modal */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4"
        >
          <img
            src={previewUrl}
            alt="receipt"
            className="max-h-[85vh] max-w-full rounded-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-strong rounded-2xl p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 num-mono font-extrabold text-lg ${accent ? "text-primary" : ""}`} dir="ltr">{value}</div>
    </div>
  );
}
