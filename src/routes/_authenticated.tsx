import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Use getSession() — reads from localStorage, no network round-trip (fast on slow VPS)
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/login" });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-mesh text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link to="/dashboard" className="hover:text-primary transition">Dashboard</Link>
            <Link to="/upgrade" className="hover:text-primary transition">Upgrade</Link>
            {isAdmin && <Link to="/control-panel" className="text-primary font-medium hover:underline">Control Panel</Link>}
            <span className="hidden sm:inline text-xs text-muted-foreground">{user.email}</span>
            <Button size="sm" variant="outline" className="border-sky/40" onClick={logout}>Logout</Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
