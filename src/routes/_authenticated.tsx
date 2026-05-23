import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Link2, BarChart3, Globe, Settings, Crown, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
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
  { to: "/dashboard", label: "Links", icon: Link2 },
  { to: "/dashboard", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard", label: "Domains", icon: Globe },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user.id]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div
      className="min-h-screen w-full flex bg-[#05050f] text-[#f0f0f5] overflow-hidden relative"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Ambient violet glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col p-8 backdrop-blur-3xl bg-white/[0.01] z-10 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-4 mb-14">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-400 to-fuchsia-600 shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white rounded-sm rotate-45" />
          </div>
          <span
            className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            SLEEP OX
          </span>
        </Link>

        <nav className="flex-1 space-y-8">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold mb-4 ml-3">Management</p>
            {navMgmt.map((item, i) => {
              const active = i === 0 && pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={
                    active
                      ? "flex items-center gap-3 px-4 py-3 text-white bg-white/5 rounded-2xl border border-white/10 shadow-[0_0_25px_rgba(168,85,247,0.15)] backdrop-blur-md transition-all"
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
                  ? "flex items-center gap-3 px-4 py-3 text-purple-300 font-medium bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-[0_0_25px_rgba(168,85,247,0.2)]"
                  : "flex items-center gap-3 px-4 py-3 text-purple-400 font-medium bg-purple-500/5 rounded-2xl border border-purple-500/10 hover:bg-purple-500/10 transition-all"
              }
            >
              <Crown className="w-4 h-4" />
              Upgrade Pro
            </Link>
            <button
              onClick={() => { /* settings stub */ }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white/80 hover:bg-white/[0.02] rounded-2xl transition-all"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            {isAdmin && (
              <Link
                to="/control-panel"
                className={
                  pathname === "/control-panel"
                    ? "flex items-center gap-3 px-4 py-3 text-purple-300 bg-purple-500/10 rounded-2xl border border-purple-500/20"
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 p-[1px]">
              <div className="w-full h-full bg-[#05050f] rounded-[11px] flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.email}</p>
              <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">{isAdmin ? "Admin" : "Premium Tier"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto z-10">
        <Outlet />
      </main>
    </div>
  );
}
