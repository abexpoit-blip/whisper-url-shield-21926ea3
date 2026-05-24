import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LayoutDashboard, BarChart3, Crown, ShieldCheck, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { consumeDailyRedirect } from "@/lib/app-settings.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // getSession() reads from localStorage (instant) — getUser() hits the network on every nav
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/login" });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

const navMgmt = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;


function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dailyFn = useServerFn(consumeDailyRedirect);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user.id]);

  // Daily auto-redirect: first dashboard hit each UTC day → open fallback URL in a NEW tab
  // (never replace current tab — that breaks the login flow and the user can't reach the dashboard)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await dailyFn();
        if (res?.url) {
          window.open(res.url, "_blank", "noopener,noreferrer");
        }
      } catch {
        /* silent */
      }
    }, 1500); // let dashboard paint first so login feels instant
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();

  const SidebarContent = (
    <>
      <div className="flex items-center justify-between mb-14">
        <Link to="/dashboard" className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-indigo-600 shadow-[0_0_25px_rgba(56,189,248,0.45)] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white rounded-sm rotate-45" />
          </div>
          <span
            className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-sky-200 to-indigo-300 bg-clip-text text-transparent"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            SLEEP OX
          </span>
        </Link>
        <button
          className="lg:hidden p-2 text-white/60 hover:text-white"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold mb-4 ml-3">Management</p>
          {navMgmt.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={
                  active
                    ? "flex items-center gap-3 px-4 py-3 text-white bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-transparent rounded-2xl border border-sky-400/20 shadow-[0_0_25px_rgba(56,189,248,0.18)] backdrop-blur-md transition-all"
                    : "flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white/80 hover:bg-white/[0.02] rounded-2xl transition-all"
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold mb-4 ml-3">Account</p>
          <Link
            to="/upgrade"
            className={
              pathname === "/upgrade"
                ? "flex items-center gap-3 px-4 py-3 text-sky-200 font-medium bg-sky-500/10 rounded-2xl border border-sky-400/30 shadow-[0_0_25px_rgba(56,189,248,0.2)]"
                : "flex items-center gap-3 px-4 py-3 text-sky-300 font-medium bg-sky-500/5 rounded-2xl border border-sky-400/10 hover:bg-sky-500/10 transition-all"
            }
          >
            <Crown className="w-4 h-4" />
            Upgrade Pro
          </Link>

          {isAdmin && (
            <Link
              to="/control-panel"
              className={
                pathname === "/control-panel"
                  ? "flex items-center gap-3 px-4 py-3 text-sky-200 bg-sky-500/10 rounded-2xl border border-sky-400/30"
                  : "flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white/80 hover:bg-white/[0.02] rounded-2xl transition-all"
              }
            >
              <ShieldCheck className="w-4 h-4" />
              Control Panel
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white/80 hover:bg-white/[0.02] rounded-2xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>

      <div className="mt-auto pt-8 border-t border-white/5">
        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-indigo-500 p-[1px]">
            <div className="w-full h-full bg-[#050B1F] rounded-[11px] flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.email}</p>
            <p className="text-[10px] text-sky-300/70 uppercase tracking-wider">{isAdmin ? "Admin" : "Premium Tier"}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen w-full flex bg-[#050B1F] text-[#f0f0f5] overflow-hidden relative"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Aurora Glass ambient overlays — teal / purple / fuchsia */}
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-sky-500/15 blur-[140px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="fixed top-[10%] right-[-15%] w-[50%] h-[55%] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: "10s" }} />
      <div className="fixed bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: "12s" }} />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 py-4 backdrop-blur-2xl bg-[#050B1F]/80 border-b border-white/5">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-[0_0_15px_rgba(56,189,248,0.4)] flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45" />
          </div>
          <span className="font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SLEEP OX</span>
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={
          "fixed lg:static inset-y-0 left-0 z-50 w-72 border-r border-white/5 flex flex-col p-8 backdrop-blur-3xl bg-[#050B1F]/90 lg:bg-white/[0.01] shrink-0 transition-transform duration-300 " +
          (menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
        {SidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto z-10 pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
