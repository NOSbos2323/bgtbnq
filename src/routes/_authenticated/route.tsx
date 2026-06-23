import { createFileRoute, Outlet, useLocation, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { Home, CreditCard, ArrowDownToLine, Coins, Settings, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, isAdmin } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const navItems = [
    { to: "/app", icon: Home, label: t("home") },
    { to: "/cards", icon: CreditCard, label: t("cards") },
    { to: "/deposit", icon: ArrowDownToLine, label: t("deposit"), primary: true },
    { to: "/loans", icon: Coins, label: t("loans") },
    { to: "/settings", icon: Settings, label: t("settings") },
  ];

  return (
    <div className="min-h-screen pb-28">
      <Outlet />

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2">
        <div className="glass-strong card-3d mx-auto max-w-md rounded-3xl px-2 py-2 flex items-center justify-between">
          {navItems.map((item) => {
            const active =
              item.to === "/app"
                ? location.pathname === "/app"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            if (item.primary) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="grid h-14 w-14 -mt-7 place-items-center rounded-full bg-primary text-primary-foreground neon-emerald shrink-0"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl transition flex-1 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-2 mx-auto max-w-md flex items-center justify-center gap-2 glass rounded-2xl py-2 text-xs text-accent"
          >
            <ShieldCheck className="h-4 w-4" />
            {t("admin_panel")}
          </Link>
        )}
      </nav>
    </div>
  );
}
