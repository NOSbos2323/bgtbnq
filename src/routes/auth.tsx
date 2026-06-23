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

        <div className="flex items-center gap-3 py-1">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-[11px] text-muted-foreground">{lang === "ar" ? "أو" : "OR"}</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <button
          type="button"
          onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
            if (result.error) {
              toast.error((result.error as any)?.message ?? t("error_generic"));
              return;
            }
            if (result.redirected) return;
            navigate({ to: "/app" });
          }}
          className="w-full rounded-2xl glass-strong py-3 font-semibold inline-flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4.6 24 4.6 13.3 4.6 4.6 13.3 4.6 24S13.3 43.4 24 43.4c10.9 0 19.4-7.9 19.4-19.4 0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4.6 24 4.6 16.3 4.6 9.7 9 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.4c5.2 0 10-2 13.6-5.2l-6.3-5.2c-2 1.4-4.5 2.2-7.3 2.2-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 38.9 16.3 43.4 24 43.4z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.2c-.4.4 6.7-4.9 6.7-14.9 0-1.2-.1-2.4-.4-3.5z"/></svg>
          {lang === "ar" ? "المتابعة عبر Google" : "Continue with Google"}
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
