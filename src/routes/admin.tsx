import { createFileRoute, Outlet, Link, redirect, useRouter, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft, ChevronRight, ChevronLeft, Shield, LayoutGrid,
  LogOut, LayoutDashboard,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin-stats.functions";
import { toast } from "sonner";

// ---------- Admin sections (order matches the sidebar) ----------
const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/rotation", label: "Rotation" },
  { href: "/admin/protection", label: "Protection" },
  { href: "/admin/variants", label: "Variants" },
  { href: "/admin/domains", label: "Domain Pool" },
  { href: "/admin/domain-health", label: "Domain Health" },
  { href: "/admin/users", label: "Members" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/scores", label: "Scores" },
  { href: "/admin/referer-rules", label: "Referer Rules" },
  { href: "/admin/asn-blocklist", label: "ASN Blocklist" },
] as const;

const SEG_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_SECTIONS.map((s) => [s.href.split("/").pop() || "admin", s.label]),
);
SEG_LABELS["admin"] = "Admin";

const ADMIN_CHECK_TTL_MS = 60_000;
let adminCheckCache: { userId: string; isAdmin: boolean; checkedAt: number } | null = null;

async function getCachedAdminAccess(userId: string) {
  if (
    adminCheckCache?.userId === userId &&
    Date.now() - adminCheckCache.checkedAt < ADMIN_CHECK_TTL_MS
  ) {
    return adminCheckCache.isAdmin;
  }
  const r = await getIsAdmin();
  adminCheckCache = { userId, isAdmin: r.isAdmin, checkedAt: Date.now() };
  return r.isAdmin;
}

function pretty(seg: string) {
  return SEG_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — LinkShield" }, { name: "robots", content: "noindex,nofollow" }] }),
  // Role-based gate: only admins reach any /admin/* route.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/control-panel" });
    }
    try {
      const isAdmin = await getCachedAdminAccess(data.session.user.id);
      if (!isAdmin) {
        throw redirect({ to: "/dashboard" });
      }
    } catch (e) {
      // Re-throw redirect; treat any other failure as forbidden.
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

function initialsOf(email: string | undefined) {
  if (!email) return "A";
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function AdminLayout() {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? undefined));
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: pretty(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));
  const currentTitle = crumbs[crumbs.length - 1]?.label ?? "Admin";
  const isRootAdmin = pathname === "/admin" || pathname === "/admin/";

  // Quick-nav prev/next within admin sections
  const { prev, next } = useMemo(() => {
    const normalized = pathname.replace(/\/$/, "") || "/admin";
    const idx = ADMIN_SECTIONS.findIndex((s) => s.href === normalized);
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? ADMIN_SECTIONS[idx - 1] : null,
      next: idx < ADMIN_SECTIONS.length - 1 ? ADMIN_SECTIONS[idx + 1] : null,
    };
  }, [pathname]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast.success("Signed out");
    navigate({ to: "/control-panel" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar email={email} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Sky-blue ambient wash */}
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-sky-500/10 via-primary/5 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-72 w-1/2 bg-gradient-to-bl from-cyan-400/10 to-transparent blur-2xl" />

          {/* Sticky topbar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl sm:gap-2 sm:px-5">
            <SidebarTrigger className="shrink-0" />

            {!isRootAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.history.back()}
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}

            {/* Prev / Next quick nav */}
            <div className="hidden items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 p-0.5 md:flex">
              <Button
                size="sm"
                variant="ghost"
                disabled={!prev}
                onClick={() => prev && navigate({ to: prev.href as never })}
                title={prev ? `Prev: ${prev.label}` : "No previous section"}
                className="h-7 w-7 p-0 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!next}
                onClick={() => next && navigate({ to: next.href as never })}
                title={next ? `Next: ${next.label}` : "No next section"}
                className="h-7 w-7 p-0 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Breadcrumb */}
            <nav className="hidden min-w-0 flex-1 items-center gap-1 text-sm sm:flex">
              <Link to="/admin" className="flex shrink-0 items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="font-medium">Admin Console</span>
              </Link>
              {crumbs.slice(1).map((c) => (
                <span key={c.href} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  {c.last ? (
                    <span className="truncate font-semibold text-foreground">{c.label}</span>
                  ) : (
                    <Link to={c.href as never} className="truncate text-muted-foreground hover:text-foreground">
                      {c.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>

            {/* Mobile current title */}
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold sm:hidden">{currentTitle}</h2>

            <Badge
              variant="outline"
              className="ml-auto hidden shrink-0 items-center gap-1.5 border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 sm:flex"
            >
              <Shield className="h-3 w-3" /> Admin
            </Badge>

            {/* Account menu */}

            {/* Account menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="ml-auto h-9 gap-2 px-1.5 sm:ml-1 sm:px-2">
                  <Avatar className="h-7 w-7 border border-sky-500/30">
                    <AvatarFallback className="bg-gradient-to-br from-sky-500/30 to-cyan-500/20 text-[11px] font-semibold text-sky-700 dark:text-sky-200">
                      {initialsOf(email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-xs font-medium text-muted-foreground lg:inline">
                    {email ?? "Loading…"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-sky-500/30 to-cyan-500/20 text-xs font-semibold text-sky-700 dark:text-sky-200">
                      {initialsOf(email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">Administrator</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{email ?? "—"}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" /> Admin Overview
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> User Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
