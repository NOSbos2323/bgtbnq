import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { notifyAdmin } from "@/lib/notify-admin";
import { Copy, Check, Upload, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/deposit")({
  component: DepositPage,
});

const FALLBACK_RIP = "00799999000123456789";
const DEFAULT_RATE = 250;

function DepositPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [amountUsd, setAmountUsd] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [file, setFile] = useState<File | null>(null);

  // Per-user RIB (if admin set one), else global default from app_settings
  const ripQ = useQuery({
    queryKey: ["my-deposit-rib", user?.id],
    queryFn: async () => {
      const [{ data: prof }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("deposit_rib").eq("id", user!.id).maybeSingle(),
        supabase.from("app_settings").select("key,value").in("key", ["default_deposit_rib", "default_deposit_name", "exchange_rate_dzd_usd"]),
      ]);
      const map = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
      return {
        rib: prof?.deposit_rib || map.default_deposit_rib || FALLBACK_RIP,
        name: map.default_deposit_name || "E-Bank Algeria",
        personal: !!prof?.deposit_rib,
        defaultRate: map.exchange_rate_dzd_usd ? Number(map.exchange_rate_dzd_usd) : DEFAULT_RATE,
      };
    },
    enabled: !!user,
  });

  const RIP = ripQ.data?.rib ?? FALLBACK_RIP;

  const deposits = useQuery({
    queryKey: ["my-deposits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("id, amount_usd, amount_dzd, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not signed in");
      if (!file) throw new Error(lang === "ar" ? "الرجاء رفع وصل التحويل" : "Please upload the receipt");
      const usd = Number(amountUsd);
      const r = Number(rate);
      if (!usd || usd <= 0) throw new Error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("deposit-receipts")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("deposits").insert({
        user_id: user.id,
        amount_usd: usd,
        amount_dzd: usd * r,
        exchange_rate: r,
        receipt_path: path,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إرسال الطلب للمراجعة" : "Request sent for review");
      setAmountUsd("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const copyRip = async () => {
    await navigator.clipboard.writeText(RIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const usdNum = Number(amountUsd) || 0;
  const dzdNum = usdNum * (Number(rate) || 0);

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("deposit_title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "حوّل إلى رقم RIP، ثم ارفع الوصل ليتم اعتماده وإضافة الرصيد لمحفظتك."
            : "Transfer to the RIP number then upload the receipt to credit your wallet."}
        </p>
      </header>

      {/* RIP card */}
      <div className="glass-strong card-3d rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{t("rip_label")}</div>
          {ripQ.data?.personal && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {lang === "ar" ? "ريب خاص بك" : "Your personal RIB"}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="num-mono text-xl font-bold tracking-wider" dir="ltr">{RIP}</div>
          <button
            onClick={copyRip}
            className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold neon-emerald inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2" dir="ltr">{ripQ.data?.name}</div>
      </div>

      {/* Submission form */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        className="glass-strong rounded-3xl p-5 space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-muted-foreground mb-1.5">{t("amount_usd")}</span>
            <input
              required
              inputMode="decimal"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              className="bank-input num-mono"
              placeholder="100"
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground mb-1.5">{t("exchange_rate")}</span>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="bank-input num-mono"
              dir="ltr"
            />
          </label>
        </div>

        <div className="glass rounded-2xl p-3 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">{t("amount_dzd")}</span>
          <span className="num-mono font-bold" dir="ltr">
            {dzdNum.toLocaleString("en-US", { maximumFractionDigits: 2 })} DZD
          </span>
        </div>

        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">{t("upload_receipt")}</span>
          <div className="relative glass rounded-2xl border border-dashed border-white/15 p-5 text-center cursor-pointer hover:bg-white/[0.03] transition">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              {file ? <ImageIcon className="h-6 w-6 text-primary" /> : <Upload className="h-6 w-6" />}
              <span className="text-sm">
                {file ? file.name : lang === "ar" ? "اضغط لاختيار صورة الوصل" : "Tap to choose receipt image"}
              </span>
            </div>
          </div>
        </label>

        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald disabled:opacity-60"
        >
          {submit.isPending ? t("loading") : t("submit_deposit")}
        </button>
      </form>

      {/* History */}
      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">{t("my_deposits")}</h2>
        <div className="glass-strong rounded-3xl divide-y divide-white/5">
          {deposits.data && deposits.data.length > 0 ? (
            deposits.data.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="num-mono font-bold" dir="ltr">${Number(d.amount_usd).toFixed(2)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleString(lang === "ar" ? "ar-DZ" : "en-US")}
                  </div>
                </div>
                <StatusBadge status={d.status} />
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

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t("pending_review"), cls: "bg-warning/15 text-warning" },
    approved: { label: t("approved"), cls: "bg-primary/15 text-primary" },
    rejected: { label: t("rejected"), cls: "bg-destructive/15 text-destructive" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}
