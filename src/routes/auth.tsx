import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { Eye, EyeOff, Wallet, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "نيو بنك — تسجيل الدخول" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: {
              full_name: fullName,
              phone,
              referral_code: referral || undefined,
              language: lang,
            },
          },
        });
        if (error) throw error;
        toast.success(lang === "ar" ? "تم إنشاء الحساب" : "Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message ?? t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-5 py-8 flex flex-col">
      {/* Top: brand + language toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground neon-emerald">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-lg">{t("app_name")}</div>
            <div className="text-[11px] text-muted-foreground">{t("tagline")}</div>
          </div>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {/* Hero */}
      <div className="mt-10 mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          USD · BaridiMob · Virtual cards
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-balance">
          {mode === "login"
            ? lang === "ar" ? "أهلاً بعودتك" : "Welcome back"
            : lang === "ar" ? "أنشئ حسابك الآن" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "ar"
            ? "إدارة كاملة لرصيدك بالدولار، شحن سريع، وبطاقات افتراضية بضغطة زر."
            : "Manage your USD balance, top up in seconds, and issue virtual cards instantly."}
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="glass-strong card-3d rounded-3xl p-5 space-y-3">
        {mode === "signup" && (
          <>
            <Field label={t("full_name")}>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bank-input"
                placeholder={lang === "ar" ? "محمد أحمد" : "John Doe"}
              />
            </Field>
            <Field label={t("phone")}>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bank-input"
                placeholder="+213…"
                dir="ltr"
              />
            </Field>
          </>
        )}
        <Field label={t("email")}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bank-input"
            placeholder="you@example.com"
            dir="ltr"
          />
        </Field>
        <Field label={t("password")}>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bank-input pe-11"
              placeholder="••••••••"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 end-3 grid place-items-center text-muted-foreground"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {mode === "signup" && (
          <Field label={t("referral_optional")}>
            <input
              value={referral}
              onChange={(e) => setReferral(e.target.value.toUpperCase())}
              className="bank-input uppercase tracking-widest"
              placeholder="ABCD1234"
              dir="ltr"
              maxLength={8}
            />
          </Field>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground neon-emerald transition active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? t("loading") : mode === "login" ? t("login") : t("signup")}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-sm text-muted-foreground py-1"
        >
          {mode === "login" ? t("no_account") : t("have_account")}{" "}
          <span className="text-primary font-semibold">
            {mode === "login" ? t("signup") : t("login")}
          </span>
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="glass rounded-full p-1 flex text-xs font-semibold">
      {(["ar", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 rounded-full transition ${
            lang === l ? "bg-primary text-primary-foreground neon-emerald" : "text-muted-foreground"
          }`}
        >
          {l === "ar" ? "العربية" : "EN"}
        </button>
      ))}
    </div>
  );
}
