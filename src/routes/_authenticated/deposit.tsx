import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { notifyAdmin } from "@/lib/notify-admin";
import { Copy, Check, Upload, ImageIcon, Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/deposit")({
  component: DepositPage,
});

const DEFAULT_RATE = 250;

function DepositPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [amountUsd, setAmountUsd] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Look up an in-flight request (awaiting_rib or awaiting_receipt)
  const active = useQuery({
    queryKey: ["active-deposit", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("id, amount_usd, amount_dzd, exchange_rate, status, assigned_rib, rib_deadline, created_at")
        .eq("user_id", user!.id)
        .in("status", ["awaiting_rib", "awaiting_receipt"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) setActiveId(data.id);
      return data;
    },
    enabled: !!user,
    refetchInterval: 3000,
  });

  const deposits = useQuery({
    queryKey: ["my-deposits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("id, amount_usd, amount_dzd, status, created_at")
        .eq("user_id", user!.id)
        .not("status", "in", "(awaiting_rib,awaiting_receipt)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      const usd = Number(amountUsd);
      const r = Number(rate);
      if (!usd || usd <= 0) throw new Error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
      const { data, error } = await supabase.rpc("create_deposit_request", {
        _amount_usd: usd,
        _rate: r,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (dep: any) => {
      setActiveId(dep.id);
      notifyAdmin(
        "deposit_new",
        `New deposit request: ${user?.email} · $${Number(dep.amount_usd).toFixed(2)} (${Number(dep.amount_dzd).toLocaleString()} DZD)`,
        dep.id,
      );
      setAmountUsd("");
      qc.invalidateQueries({ queryKey: ["active-deposit"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const usdNum = Number(amountUsd) || 0;
  const dzdNum = usdNum * (Number(rate) || 0);

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("deposit_title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "أدخل المبلغ وأرسِل الطلب — سيرسل لك الأدمين رقم الحساب لتحويل المبلغ ورفع الوصل."
            : "Enter the amount and submit — the admin will send you the RIP for transfer and receipt upload."}
        </p>
      </header>

      {active.data ? (
        <ActiveDeposit dep={active.data as any} onDone={() => {
          setActiveId(null);
          qc.invalidateQueries({ queryKey: ["active-deposit"] });
          qc.invalidateQueries({ queryKey: ["my-deposits"] });
        }} />
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
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

          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {create.isPending ? (lang === "ar" ? "جارٍ الإرسال…" : "Sending…") : (lang === "ar" ? "متابعة" : "Continue")}
          </button>
        </form>
      )}

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

function ActiveDeposit({ dep, onDone }: { dep: any; onDone: () => void }) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(lang === "ar" ? "الرجاء رفع وصل التحويل" : "Please upload the receipt");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("deposit-receipts")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.rpc("submit_deposit_receipt", {
        _deposit_id: dep.id,
        _receipt_path: path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إرسال الوصل للمراجعة" : "Receipt sent for review");
      notifyAdmin(
        "deposit",
        `Receipt uploaded · ${user?.email} · $${Number(dep.amount_usd).toFixed(2)}`,
        dep.id,
      );
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  if (dep.status === "awaiting_rib") {
    return (
      <div className="glass-strong card-3d rounded-3xl p-8 text-center space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
        <div className="text-lg font-bold">
          {lang === "ar" ? "بانتظار موافقة الأدمين…" : "Waiting for admin…"}
        </div>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "سيتم إرسال رقم الحساب (RIP) لك خلال لحظات."
            : "The transfer RIP will appear here shortly."}
        </p>
        <div className="num-mono text-primary text-xl font-bold" dir="ltr">
          ${Number(dep.amount_usd).toFixed(2)}
        </div>
      </div>
    );
  }

  // awaiting_receipt
  const deadline = dep.rib_deadline ? new Date(dep.rib_deadline).getTime() : now;
  const remainingMs = Math.max(0, deadline - now);
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const expired = remainingMs <= 0;

  const copyRip = async () => {
    await navigator.clipboard.writeText(dep.assigned_rib || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="glass-strong card-3d rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {lang === "ar" ? "حوّل إلى رقم RIP التالي" : "Transfer to this RIP"}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${expired ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
            <Clock className="h-3 w-3" />
            <span className="num-mono" dir="ltr">
              {expired
                ? (lang === "ar" ? "انتهى" : "expired")
                : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="num-mono text-xl font-bold tracking-wider" dir="ltr">{dep.assigned_rib}</div>
          <button
            onClick={copyRip}
            className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold neon-emerald inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <div className="glass rounded-2xl p-3 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</span>
          <span className="num-mono font-bold" dir="ltr">
            {Number(dep.amount_dzd).toLocaleString()} DZD (${Number(dep.amount_usd).toFixed(2)})
          </span>
        </div>
        <p className="text-[12px] text-warning">
          {lang === "ar"
            ? "حاول إكمال الإجراء ورفع الوصل خلال 5 دقائق."
            : "Please complete the transfer and upload the receipt within 5 minutes."}
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        className="glass-strong rounded-3xl p-5 space-y-4"
      >
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">{t("upload_receipt")}</span>
          <div className="relative glass rounded-2xl border border-dashed border-white/15 p-5 text-center cursor-pointer hover:bg-white/[0.03] transition">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={expired}
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
          disabled={submit.isPending || expired || !file}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {expired
            ? (lang === "ar" ? "انتهى الوقت — أعِد الإرسال" : "Time expired — resubmit")
            : t("submit_deposit")}
        </button>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t, lang } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_rib:     { label: lang === "ar" ? "بانتظار RIP" : "Awaiting RIP", cls: "bg-warning/15 text-warning" },
    awaiting_receipt: { label: lang === "ar" ? "بانتظار الوصل" : "Awaiting receipt", cls: "bg-warning/15 text-warning" },
    pending:          { label: t("pending_review"), cls: "bg-warning/15 text-warning" },
    approved:         { label: t("approved"),       cls: "bg-primary/15 text-primary" },
    rejected:         { label: t("rejected"),       cls: "bg-destructive/15 text-destructive" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}
