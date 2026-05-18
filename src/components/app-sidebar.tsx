import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Shield,
  LayoutDashboard,
  BarChart3,
  Trophy,
  ShieldCheck,
  Settings,
  GitBranch,
  Sparkles,
  LogOut,
  Globe2,
  ScrollText,
  Users,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Funnel", url: "/funnel", icon: GitBranch },
  { title: "Domains", url: "/domains", icon: Globe2 },
];

const adminNav = [
  { title: "Rotation", url: "/admin/rotation", icon: Trophy },
  { title: "Protection", url: "/admin/protection", icon: ShieldCheck },
  { title: "Variants", url: "/admin/variants", icon: Settings },
  { title: "Members", url: "/admin/users", icon: Users },
  { title: "Audit Logs", url: "/admin/audit", icon: ScrollText },
];

export function AppSidebar({ email }: { email?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (path: string) =>
    path === "/dashboard" ? currentPath === path : currentPath.startsWith(path);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-5">
        <Link to="/" className="flex items-center gap-2.5 font-display font-bold">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary-glow blur-md opacity-60" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          {!collapsed && (
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent text-lg tracking-tight">
              LinkShield
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
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
                    className="h-9 rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-transparent data-[active=true]:text-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--color-primary)]"
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

        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Pro tools
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="h-9 rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-transparent data-[active=true]:text-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--color-primary)]"
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

        {!collapsed && (
          <div className="mx-2 mt-6 overflow-hidden rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/10 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Free plan</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Upgrade for unlimited links, custom domains & API.
            </p>
            <Button size="sm" className="mt-3 h-7 w-full text-xs">
              Upgrade
            </Button>
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
              <div className="text-[10px] text-muted-foreground">Free tier</div>
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
