import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { User as UserIcon, Globe, LogOut, ShieldCheck, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ["profile-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "ar" ? "تم إرسال رابط إعادة التعيين" : "Reset link sent");
  };

  return (
    <div className="px-5 pt-8 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t("settings")}</h1>
      </header>

      {/* Profile card */}
      <div className="glass-strong card-3d rounded-3xl p-5 flex items-center gap-4">
        <div className="h-14 w-14 grid place-items-center rounded-2xl bg-primary/15 text-primary">
          <UserIcon className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{profile.data?.full_name ?? user?.email}</div>
          <div className="text-xs text-muted-foreground truncate" dir="ltr">{user?.email}</div>
        </div>
      </div>

      {/* Language */}
      <Section title={t("language")} icon={<Globe className="h-4 w-4" />}>
        <div className="flex gap-2">
          {(["ar", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
                lang === l ? "bg-primary text-primary-foreground neon-emerald" : "glass"
              }`}
            >
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section title={t("security")} icon={<ShieldCheck className="h-4 w-4" />}>
        <button
          onClick={sendReset}
          className="w-full text-start glass rounded-2xl p-4 text-sm font-semibold flex items-center justify-between"
        >
          {t("change_password")}
          <span className="text-xs text-muted-foreground">→</span>
        </button>
      </Section>

      {/* Notifications */}
      <Section title={t("notifications")} icon={<Bell className="h-4 w-4" />}>
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
          {lang === "ar" ? "إعدادات الإشعارات قريباً." : "Notification preferences coming soon."}
        </div>
      </Section>

      {isAdmin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="w-full glass-strong rounded-2xl p-4 text-sm font-semibold text-accent inline-flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" /> {t("admin_panel")}
        </button>
      )}

      <button
        onClick={handleLogout}
        className="w-full rounded-2xl bg-destructive/15 text-destructive py-3.5 font-bold inline-flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> {t("logout")}
      </button>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground px-1">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
