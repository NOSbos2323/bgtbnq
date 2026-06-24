import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Send, ArrowDownLeft, ArrowUpRight, Search, BadgeCheck, ShieldAlert, Crown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/transfers")({
  component: TransfersPage,
});

interface Recipient {
  id: string;
  full_name: string | null;
  email: string;
  verification_status: string;
  is_admin_account: boolean;
}

function TransfersPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [identifier, setIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);

  const profile = useQuery({
    queryKey: ["profile-verify", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verification_status,is_admin_account")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const wallet = useQuery({
    queryKey: ["wallet-transfers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_usd")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const history = useQuery({
    queryKey: ["transfers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("id, sender_id, recipient_id, amount_usd, note, status, created_at, admin_note")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  const lookup = useMutation({
    mutationFn: async () => {
      const ident = identifier.trim();
      if (!ident) throw new Error(lang === "ar" ? "أدخل بريد أو كود" : "Enter email or code");
      const { data, error } = await supabase.rpc("lookup_recipient", { _identifier: ident });
      if (error) throw error;
      const r = (data as any[])?.[0];
      if (!r) throw new Error(lang === "ar" ? "المستلم غير موجود" : "Recipient not found");
      setRecipient(r as Recipient);
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const send = useMutation({
    mutationFn: async () => {
      const a = Number(amount);
      if (!recipient) throw new Error(lang === "ar" ? "ابحث عن المستلم أولاً" : "Look up recipient first");
      if (!a || a <= 0) throw new Error(lang === "ar" ? "مبلغ غير صحيح" : "Invalid amount");
      const { error } = await supabase.rpc("send_transfer", {
        _recipient_identifier: identifier.trim(),
        _amount: a,
        _note: note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar"
        ? "تم استلام طلب التحويل وحجز المبلغ، بانتظار موافقة الإدارة."
        : "Transfer queued and amount held — awaiting admin approval.");
      setAmount(""); setNote(""); setRecipient(null); setIdentifier("");
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-transfers"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("sender not verified"))
        return toast.error(lang === "ar" ? "يجب توثيق حسابك للإرسال" : "Verify your account first");
      if (msg.includes("insufficient funds"))
        return toast.error(lang === "ar" ? "رصيد غير كافٍ" : "Insufficient balance");
      if (msg.includes("cannot transfer to yourself"))
        return toast.error(lang === "ar" ? "لا يمكنك التحويل لنفسك" : "Cannot transfer to yourself");
      toast.error(msg || t("error_generic"));
    },
  });

  const isVerified =
    profile.data?.verification_status === "verified" || profile.data?.is_admin_account;
  const bal = Number(wallet.data?.balance_usd ?? 0);

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("transfers")}</h1>
        <p className="text-xs text-muted-foreground">
          {lang === "ar"
            ? "أرسل واستقبل الأموال بين المستخدمين فوراً."
            : "Send and receive money between users instantly."}
        </p>
      </header>

      {/* Balance pill */}
      <div className="glass-strong rounded-2xl p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("available_balance")}</span>
        <span className="num-mono font-extrabold text-primary text-lg" dir="ltr">
          ${bal.toFixed(2)}
        </span>
      </div>

      {!isVerified && (
        <div className="glass-strong rounded-2xl p-4 border border-yellow-500/30 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-yellow-400 shrink-0" />
          <div className="text-xs">
            <div className="font-bold mb-1">
              {lang === "ar" ? "حسابك غير موثق" : "Account not verified"}
            </div>
            <div className="text-muted-foreground">
              {lang === "ar"
                ? "لا يمكنك إرسال التحويلات إلا بعد توثيق الحساب. الشرط: الاحتفاظ بمبلغ 3000 دج في الرصيد."
                : "You can only send transfers after verification. Requirement: keep 3000 DZD in balance."}
            </div>
          </div>
        </div>
      )}

      {/* Send form */}
      <div className="glass-strong card-3d rounded-3xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            {lang === "ar" ? "البريد / كود الإحالة / RIB" : "Email / referral code / RIB"}
          </label>
          <div className="flex gap-2">
            <input
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setRecipient(null); }}
              placeholder={lang === "ar" ? "مثال: user@mail.com" : "e.g. user@mail.com"}
              className="bank-input flex-1"
              dir="ltr"
            />
            <button
              onClick={() => lookup.mutate()}
              disabled={lookup.isPending}
              className="glass-strong px-4 rounded-2xl inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        {recipient && (
          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className={`h-10 w-10 grid place-items-center rounded-2xl ${recipient.is_admin_account ? "bg-yellow-400/20 text-yellow-300" : "bg-primary/15 text-primary"}`}>
              {recipient.is_admin_account ? <Crown className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate flex items-center gap-1.5">
                {recipient.full_name || recipient.email}
                {recipient.verification_status === "verified" && (
                  <BadgeCheck className="h-4 w-4 text-primary" />
                )}
                {recipient.is_admin_account && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-bold">
                    {lang === "ar" ? "إدارة" : "ADMIN"}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
                {recipient.email}
              </div>
            </div>
          </div>
        )}

        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">{t("amount")} ($)</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bank-input num-mono text-lg"
            dir="ltr"
            placeholder="0.00"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">
            {lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bank-input"
            maxLength={120}
          />
        </label>

        <button
          onClick={() => send.mutate()}
          disabled={send.isPending || !recipient || !isVerified}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {send.isPending ? t("loading") : (lang === "ar" ? "إرسال" : "Send")}
        </button>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-bold mb-3 text-muted-foreground">
          {lang === "ar" ? "آخر التحويلات" : "Recent transfers"}
        </h2>
        <div className="glass-strong rounded-3xl divide-y divide-white/5">
          {history.data && history.data.length > 0 ? (
            history.data.map((tr: any) => {
              const incoming = tr.recipient_id === user?.id;
              const st = tr.status as string;
              const stMap: Record<string, { ar: string; en: string; cls: string }> = {
                pending:  { ar: "قيد المراجعة", en: "Pending",  cls: "bg-yellow-400/15 text-yellow-300" },
                approved: { ar: "مقبول",        en: "Approved", cls: "bg-primary/15 text-primary" },
                rejected: { ar: "مرفوض",        en: "Rejected", cls: "bg-destructive/15 text-destructive" },
              };
              const stInfo = stMap[st] ?? stMap.pending;
              return (
                <div key={tr.id} className="flex items-center gap-3 p-4">
                  <div className={`h-10 w-10 grid place-items-center rounded-2xl ${incoming ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                    {incoming ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold inline-flex items-center gap-2">
                      {incoming ? (lang === "ar" ? "وارد" : "Received") : (lang === "ar" ? "صادر" : "Sent")}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stInfo.cls}`}>
                        {lang === "ar" ? stInfo.ar : stInfo.en}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tr.note || tr.admin_note || new Date(tr.created_at).toLocaleString(lang === "ar" ? "ar-DZ" : "en-US")}
                    </p>
                  </div>
                  <div className={`num-mono text-sm font-bold ${incoming ? "text-primary" : "text-foreground"}`} dir="ltr">
                    {incoming ? "+" : "-"}${Number(tr.amount_usd).toFixed(2)}
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
