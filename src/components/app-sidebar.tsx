import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Trophy,
  ShieldCheck,
  Settings,
  GitBranch,
  LogOut,
  Globe2,
  ScrollText,
  Users,
  Package,
  CreditCard,
  Rocket,
  LayoutGrid,
  Activity,
  Megaphone,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const planLabels: Record<string, string> = {
  free: "Free plan",
  starter: "Pro Monthly",
  pro: "Pro Monthly",
  agency: "Pro Monthly",
  pro_monthly: "Pro Monthly",
  lifetime: "Lifetime plan",
};

function planLabelFromSlug(slug?: string | null) {
  return planLabels[slug ?? ""] ?? "Free plan";
}

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Funnel", url: "/funnel", icon: GitBranch },
  { title: "Domains", url: "/domains", icon: Globe2 },
  { title: "Upgrade", url: "/upgrade", icon: Rocket },
];

const adminNav = [
  { title: "Admin Dashboard", url: "/admin", icon: LayoutGrid },
  { title: "Packages", url: "/admin/packages", icon: Package },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Plisio Activity", url: "/admin/activity", icon: Activity },
  { title: "Rotation", url: "/admin/rotation", icon: Trophy },
  { title: "Ads & Rotation", url: "/admin/ads", icon: Megaphone },
  { title: "Protection", url: "/admin/protection", icon: ShieldCheck },
  { title: "Variants", url: "/admin/variants", icon: Settings },
  { title: "Domain Pool", url: "/admin/domains", icon: Globe2 },
  { title: "Members", url: "/admin/users", icon: Users },
  { title: "Audit Logs", url: "/admin/audit", icon: ScrollText },
  { title: "Recent Clicks", url: "/admin/clicks", icon: Activity },
];

export function AppSidebar({ email, isAdmin = false }: { email?: string; isAdmin?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const [planLabel, setPlanLabel] = useState("Free plan");

  const isActive = (path: string) =>
    path === "/dashboard" ? currentPath === path : currentPath.startsWith(path);

  const logout = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  useEffect(() => {
    let active = true;
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (active) setPlanLabel("Free plan");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("plan_slug")
        .eq("id", userId)
        .maybeSingle();
      if (active) setPlanLabel(planLabelFromSlug(data?.plan_slug));
    });
    return () => {
      active = false;
    };
  }, [email]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-5">
        <Link to="/" className="flex items-center gap-2.5 font-display font-bold">
          <Logo glow glowSize="sm" className="h-8 w-8 drop-shadow-sm" />
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="bg-gradient-to-r from-white via-sky-200 to-sky-400 bg-clip-text text-transparent text-lg tracking-tight">
                LinkShield
              </span>
              <span className="mt-1 font-mono text-[10px] font-medium tracking-wider text-sidebar-foreground/60">
                sleepox.com
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {!isAdmin && (
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="h-9 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-sky-500/25 data-[active=true]:via-sky-400/10 data-[active=true]:to-transparent data-[active=true]:text-white data-[active=true]:shadow-[inset_2px_0_0_oklch(0.72_0.16_235)]"
                  >
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {isAdmin && (
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Admin
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="h-9 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-sky-500/25 data-[active=true]:via-sky-400/10 data-[active=true]:to-transparent data-[active=true]:text-white data-[active=true]:shadow-[inset_2px_0_0_oklch(0.72_0.16_235)]"
                  >
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {/* Dev Credit */}
        {!collapsed && (
          <div className="mx-2 mt-2 flex justify-center">
            <span className="inline-block rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-white shadow-glow">
              Developed by Sleepox LLC
            </span>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground">
              {(email?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{email ?? "Account"}</div>
              <div className="text-[10px] text-muted-foreground">{planLabel}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="mx-auto" onClick={logout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
