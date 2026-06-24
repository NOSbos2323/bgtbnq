import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Check, X, ArrowLeft, Eye, ShieldCheck, BadgeCheck, Users, Wallet,
  Receipt, Crown, Edit3, Plus, Minus, Search, Send, CreditCard, Banknote,
  EyeOff, Snowflake, Sun, Copy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "deposits" | "transfers" | "verifications" | "users";

function AdminPage() {
  const { t, lang } = useI18n();
  const { isAdmin, loading, user } = useAuth();
  const [tab, setTab] = useState<Tab>("deposits");

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/app" className="h-10 w-10 grid place-items-center rounded-xl glass">
          <ArrowLeft className="h-4 w-4 flip-x" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">{t("admin_panel")}</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-400/20 text-yellow-300">
              <Crown className="h-3 w-3" /> ADMIN
            </span>
          </div>
          <p className="text-xs text-muted-foreground" dir="ltr">{user?.email}</p>
        </div>
      </header>

      <AdminHero />

      {/* Tabs */}
      <div className="glass-strong rounded-2xl p-1.5 grid grid-cols-4 gap-1">
        <TabBtn active={tab === "deposits"} onClick={() => setTab("deposits")} icon={<Receipt className="h-4 w-4" />} label={lang === "ar" ? "إيداعات" : "Deposits"} />
        <TabBtn active={tab === "transfers"} onClick={() => setTab("transfers")} icon={<Send className="h-4 w-4" />} label={lang === "ar" ? "تحويلات" : "Transfers"} />
        <TabBtn active={tab === "verifications"} onClick={() => setTab("verifications")} icon={<BadgeCheck className="h-4 w-4" />} label={lang === "ar" ? "توثيق" : "Verify"} />
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />} label={lang === "ar" ? "مستخدمون" : "Users"} />
      </div>

      {tab === "deposits" && <DepositsTab />}
      {tab === "transfers" && <TransfersTab />}
      {tab === "verifications" && <VerificationsTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
        active ? "bg-primary text-primary-foreground neon-emerald" : "text-muted-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function AdminHero() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, totals, pendingDep, pendingVer, pendingTr, myWallet] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance_usd"),
        supabase.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("wallets").select("balance_usd").eq("user_id", user!.id).maybeSingle(),
      ]);
      const totalBalance = (totals.data ?? []).reduce((s, w) => s + Number(w.balance_usd), 0);
      return {
        users: u.count ?? 0,
        totalBalance,
        pendingDep: pendingDep.count ?? 0,
        pendingVer: pendingVer.count ?? 0,
        pendingTr: pendingTr.count ?? 0,
        myBalance: Number(myWallet.data?.balance_usd ?? 0),
      };
    },
  });

  return (
    <div className="relative overflow-hidden rounded-3xl card-3d p-5 bg-gradient-to-br from-[oklch(0.32_0.09_60)] via-[oklch(0.22_0.04_220)] to-[oklch(0.2_0.05_280)] border border-yellow-400/20">
      <div className="absolute -top-16 -end-16 h-56 w-56 rounded-full bg-yellow-400/20 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <span className="text-xs text-white/70">
          {lang === "ar" ? "حساب الإدارة" : "Admin wallet"}
        </span>
        <Crown className="h-5 w-5 text-yellow-300" />
      </div>
      <div className="relative mt-3 num-mono text-4xl font-extrabold" dir="ltr">
        ${stats.data?.myBalance.toFixed(2) ?? "—"}
      </div>
      <div className="relative mt-4 grid grid-cols-4 gap-2 text-center">
        <Mini label={lang === "ar" ? "مستخدمون" : "Users"} value={String(stats.data?.users ?? "—")} />
        <Mini label={lang === "ar" ? "الإجمالي" : "Total"} value={`$${(stats.data?.totalBalance ?? 0).toFixed(0)}`} />
        <Mini label={lang === "ar" ? "إيداعات" : "Deps"} value={String(stats.data?.pendingDep ?? 0)} accent />
        <Mini label={lang === "ar" ? "توثيق" : "Verif"} value={String(stats.data?.pendingVer ?? 0)} accent />
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-xl py-2">
      <div className="text-[10px] text-white/60">{label}</div>
      <div className={`num-mono font-bold text-sm ${accent ? "text-yellow-300" : "text-white"}`} dir="ltr">{value}</div>
    </div>
  );
}

/* ─────────── Deposits Tab ─────────── */
function DepositsTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: ["admin-pending-deposits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("id, amount_usd, amount_dzd, receipt_path, created_at, user_id, profiles:profiles!deposits_user_id_fkey(full_name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_deposit", { _deposit_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("approved"));
      qc.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
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
      qc.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("deposit-receipts").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    setPreviewUrl(data.signedUrl);
  };

  return (
    <div>
      <h2 className="text-sm font-bold mb-3 text-muted-foreground">{t("pending_deposits")}</h2>
      <div className="glass-strong rounded-3xl divide-y divide-white/5">
        {pending.data && pending.data.length > 0 ? (
          pending.data.map((d: any) => (
            <div key={d.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold truncate">{d.profiles?.full_name ?? d.profiles?.email ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{d.profiles?.email}</div>
                </div>
                <div className="text-end">
                  <div className="num-mono font-bold text-primary" dir="ltr">${Number(d.amount_usd).toFixed(2)}</div>
                  <div className="text-[11px] text-muted-foreground num-mono" dir="ltr">
                    {Number(d.amount_dzd).toLocaleString()} DZD
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openReceipt(d.receipt_path)} className="flex-1 glass rounded-xl py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> {t("view")}
                </button>
                <button onClick={() => approve.mutate(d.id)} disabled={approve.isPending} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 neon-emerald disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" /> {t("approve")}
                </button>
                <button onClick={() => reject.mutate(d.id)} disabled={reject.isPending} className="flex-1 bg-destructive/15 text-destructive rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5">
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

      {previewUrl && (
        <div onClick={() => setPreviewUrl(null)} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4">
          <img src={previewUrl} alt="receipt" className="max-h-[85vh] max-w-full rounded-2xl border border-white/10" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/* ─────────── Verifications Tab ─────────── */
function VerificationsTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const reqs = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("id, user_id, status, balance_at_request_usd, created_at, profiles:profiles!verification_requests_user_id_fkey(full_name, email, rib)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_verification", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم التوثيق" : "Verified");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_verification", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("rejected"));
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  return (
    <div>
      <h2 className="text-sm font-bold mb-3 text-muted-foreground">
        {lang === "ar" ? "طلبات التوثيق المعلقة" : "Pending verification requests"}
      </h2>
      <div className="glass-strong rounded-3xl divide-y divide-white/5">
        {reqs.data && reqs.data.length > 0 ? (
          reqs.data.map((r: any) => (
            <div key={r.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {r.profiles?.full_name ?? r.profiles?.email}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{r.profiles?.email}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {lang === "ar" ? "الرصيد عند الطلب: " : "Balance at request: "}
                    <span className="num-mono text-primary" dir="ltr">${Number(r.balance_at_request_usd).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve.mutate(r.id)} disabled={approve.isPending} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 neon-emerald disabled:opacity-60">
                  <BadgeCheck className="h-3.5 w-3.5" /> {lang === "ar" ? "توثيق" : "Verify"}
                </button>
                <button onClick={() => reject.mutate(r.id)} disabled={reject.isPending} className="flex-1 bg-destructive/15 text-destructive rounded-xl py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <X className="h-3.5 w-3.5" /> {t("reject")}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد طلبات توثيق." : "No verification requests."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Users Tab ─────────── */
function UsersTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [ribValue, setRibValue] = useState("");
  const [adjustOpen, setAdjustOpen] = useState<{ id: string; sign: 1 | -1 } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const users = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, rib, verification_status, is_admin_account, wallets:wallets!wallets_user_id_fkey(balance_usd)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.trim()) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const updateRib = useMutation({
    mutationFn: async (vars: { id: string; rib: string }) => {
      const { error } = await supabase.rpc("admin_update_user_rib", { _user_id: vars.id, _rib: vars.rib });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  const adjust = useMutation({
    mutationFn: async () => {
      if (!adjustOpen) return;
      const amt = Number(adjustAmount) * adjustOpen.sign;
      if (!amt) throw new Error(lang === "ar" ? "مبلغ غير صحيح" : "Invalid");
      const { error } = await supabase.rpc("admin_adjust_wallet", {
        _user_id: adjustOpen.id,
        _delta: amt,
        _reason: adjustReason || (adjustOpen.sign > 0 ? "Credit" : "Debit"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setAdjustOpen(null); setAdjustAmount(""); setAdjustReason("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("error_generic")),
  });

  return (
    <div className="space-y-3">
      <div className="glass-strong rounded-2xl flex items-center gap-2 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "ar" ? "بحث بالاسم أو البريد…" : "Search name or email…"}
          className="flex-1 bg-transparent py-3 text-sm outline-none"
        />
      </div>

      <div className="space-y-2">
        {users.data?.map((u: any) => {
          const bal = Number(u.wallets?.[0]?.balance_usd ?? 0);
          const isEditing = editing === u.id;
          return (
            <div key={u.id} className="glass-strong rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {u.full_name || u.email}
                    {u.verification_status === "verified" && <BadgeCheck className="h-4 w-4 text-primary" />}
                    {u.is_admin_account && <Crown className="h-4 w-4 text-yellow-300" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{u.email}</div>
                </div>
                <div className="text-end shrink-0">
                  <div className="num-mono font-bold text-primary" dir="ltr">${bal.toFixed(2)}</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    u.verification_status === "verified" ? "bg-primary/15 text-primary" :
                    u.verification_status === "pending" ? "bg-yellow-400/15 text-yellow-300" :
                    u.verification_status === "rejected" ? "bg-destructive/15 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {u.verification_status}
                  </span>
                </div>
              </div>

              {/* RIB row */}
              <div className="glass rounded-xl p-2.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">RIB</span>
                {isEditing ? (
                  <>
                    <input
                      value={ribValue}
                      onChange={(e) => setRibValue(e.target.value)}
                      className="flex-1 bg-transparent text-xs num-mono outline-none"
                      dir="ltr"
                      placeholder="0079..."
                    />
                    <button onClick={() => updateRib.mutate({ id: u.id, rib: ribValue })} className="text-primary text-xs font-bold">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(null)} className="text-muted-foreground text-xs">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs num-mono truncate" dir="ltr">
                      {u.rib || (lang === "ar" ? "غير محدد" : "not set")}
                    </span>
                    <button onClick={() => { setEditing(u.id); setRibValue(u.rib ?? ""); }} className="text-accent">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Adjust */}
              <div className="flex gap-2">
                <button onClick={() => setAdjustOpen({ id: u.id, sign: 1 })} className="flex-1 glass rounded-xl py-2 text-[11px] font-bold text-primary inline-flex items-center justify-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> {lang === "ar" ? "إضافة رصيد" : "Credit"}
                </button>
                <button onClick={() => setAdjustOpen({ id: u.id, sign: -1 })} className="flex-1 glass rounded-xl py-2 text-[11px] font-bold text-destructive inline-flex items-center justify-center gap-1">
                  <Minus className="h-3.5 w-3.5" /> {lang === "ar" ? "خصم" : "Debit"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {adjustOpen && (
        <div onClick={() => setAdjustOpen(null)} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-end sm:place-items-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-5 space-y-4 border border-white/10">
            <h3 className="font-extrabold text-lg inline-flex items-center gap-2">
              {adjustOpen.sign > 0 ? <Plus className="h-5 w-5 text-primary" /> : <Minus className="h-5 w-5 text-destructive" />}
              {adjustOpen.sign > 0
                ? (lang === "ar" ? "إضافة رصيد" : "Credit wallet")
                : (lang === "ar" ? "خصم رصيد" : "Debit wallet")}
            </h3>
            <input
              inputMode="decimal"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="0.00"
              className="bank-input num-mono text-lg"
              dir="ltr"
            />
            <input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={lang === "ar" ? "السبب…" : "Reason…"}
              className="bank-input"
            />
            <button onClick={() => adjust.mutate()} disabled={adjust.isPending} className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground neon-emerald disabled:opacity-60">
              {adjust.isPending ? t("loading") : t("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
