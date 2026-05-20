import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Copy,
  ExternalLink,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Bot,
  MousePointerClick,
  Link2,
  ArrowUpRight,
  Search,
  Bell,
  Sparkles,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Pause,
  Play,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getAnalytics } from "@/lib/analytics.functions";
import { getBrandIcon, prettyLabel } from "@/components/brand-icons";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LinkShield" },
      { name: "description", content: "Manage your bot-filtered short links, monitor click quality, and pause underperforming campaigns from one place." },
      { property: "og:title", content: "Dashboard — LinkShield" },
      { property: "og:description", content: "Manage short links and ad-campaign click quality in real time." },
      { property: "og:url", content: "https://sleepox.com/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/dashboard" }],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: Dashboard,
});

type DashboardAnalytics = Awaited<ReturnType<typeof getAnalytics>>;

type LinkRow = {
  id: string;
  short_code: string;
  destination_url: string;
  title: string | null;
  clicks_count: number;
  bot_clicks_count: number;
  created_at: string;
};

function genCode() {
  return Math.random().toString(36).slice(2, 8);
}

function linePath(values: number[], w = 100, h = 28) {
  if (values.length === 0) return `M0,${h} L${w},${h}`;
  if (values.length === 1) {
    const y = values[0] > 0 ? h * 0.35 : h;
    return `M0,${y.toFixed(1)} L${w},${y.toFixed(1)}`;
  }
  const max = Math.max(...values, 1);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Dashboard() {
  const fetchAnalytics = useServerFn(getAnalytics);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  // adsterra extra-link field removed — destination_url is the Adsterra link.
  // Bots automatically see the prelander article via redirect.functions.ts.
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const navigate = useNavigate();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getSession();
    setEmail(userData.session?.user.email ?? "");
    const { data, error } = await supabase
      .from("links")
      .select("id, short_code, destination_url, title, clicks_count, bot_clicks_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setLinks(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setAnalyticsLoading(true);
    setRefreshError(null);
    const days = range === "day" ? 1 : range === "week" ? 7 : 30;
    void fetchAnalytics({ data: { days, linkId: null } })
      .then((res) => {
        setAnalytics(res);
        setLastUpdated(new Date());
        setRefreshError(null);
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : "Analytics failed to load";
        setRefreshError(msg);
        toast.error(msg);
      })
      .finally(() => setAnalyticsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, refreshTick]);

  // Auto-refresh only while the tab is visible; keep it lightweight.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRefreshTick((t) => t + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const manualRefresh = () => {
    setRefreshTick((t) => t + 1);
    void load();
    toast.success("Refreshing…");
  };

  const rangeDays = range === "day" ? 1 : range === "week" ? 7 : 30;
  const goToLinkAnalytics = (id: string) => {
    void navigate({ to: "/analytics/$linkId", params: { linkId: id }, search: { days: rangeDays } });
  };
  const goToAnalytics = () => {
    void navigate({ to: "/analytics", search: { days: rangeDays, linkId: "all" } });
  };


  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: userData } = await supabase.auth.getSession();
    if (!userData.session?.user) return;
    try {
      new URL(url);
    } catch {
      toast.error("Invalid URL");
      setCreating(false);
      return;
    }
    const { error } = await supabase.from("links").insert({
      user_id: userData.session.user.id,
      short_code: genCode(),
      destination_url: url,
      title: title || null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Link created");
    setUrl("");
    setTitle("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${baseUrl}/r/${code}`);
    toast.success("Copied to clipboard");
  };

  const stats = useMemo(() => {
    const totalClicks = links.reduce((s, l) => s + l.clicks_count, 0);
    const totalBots = links.reduce((s, l) => s + l.bot_clicks_count, 0);
    const totalAll = totalClicks + totalBots;
    const blockRate = totalAll > 0 ? (totalBots / totalAll) * 100 : 0;
    const cleanRate = totalAll > 0 ? (totalClicks / totalAll) * 100 : 100;
    return {
      totalLinks: links.length,
      totalClicks,
      totalBots,
      blockRate,
      cleanRate,
    };
  }, [links]);

  const filtered = useMemo(
    () =>
      links.filter(
        (l) =>
          !search ||
          l.short_code.toLowerCase().includes(search.toLowerCase()) ||
          l.destination_url.toLowerCase().includes(search.toLowerCase()) ||
          (l.title ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [links, search],
  );

  const topLink = useMemo(
    () => [...links].sort((a, b) => b.clicks_count - a.clicks_count)[0],
    [links],
  );

  const chartValues = useMemo(
    () => (analytics?.timeseries ?? []).map((p) => p.humans),
    [analytics],
  );
  const botChartValues = useMemo(
    () => (analytics?.timeseries ?? []).map((p) => p.bots),
    [analytics],
  );
  const rangeTotals = analytics?.totals ?? {
    humans: stats.totalClicks,
    bots: stats.totalBots,
    total: stats.totalClicks + stats.totalBots,
    conversionRate: stats.cleanRate / 100,
  };
  const rangeLabel = range === "day" ? "Today" : range === "week" ? "7 days" : "30 days";

  return (
      <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar email={email} />

        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/40 bg-background/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-2" />
            <div className="hidden md:block h-5 w-px bg-border" />
            <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Workspace</span>
              <span>/</span>
              <span>Dashboard</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search links..."
                  className="h-8 w-56 pl-8 text-sm"
                />
              </div>
              <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
                {analyticsLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-primary">Refreshing…</span>
                  </>
                ) : refreshError ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">Refresh failed</span>
                  </>
                ) : (
                  <>
                    <span className={`flex h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
                    <span>
                      {autoRefresh ? "Auto · 30s" : "Paused"}
                    </span>
                  </>
                )}
                {lastUpdated && !analyticsLoading && (
                  <span className="text-muted-foreground/70">
                    · {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setAutoRefresh((v) => !v)}
                title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                aria-label={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
              >
                {autoRefresh ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={manualRefresh} title="Refresh now" aria-label="Refresh now">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Notifications">
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden">
            {/* Hero band */}
            <div className="relative overflow-hidden border-b border-border/40 bg-hero">
              <div className="absolute inset-0 grid-pattern opacity-40" />
              <div className="relative px-6 py-8 lg:px-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      <span>All systems operational</span>
                    </div>
                    <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
                      Welcome back<span className="text-gradient">.</span>
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Here's what's happening with your traffic today.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link to="/analytics" search={{ days: rangeDays, linkId: "all" }}>
                        <Activity className="h-3.5 w-3.5" /> View analytics
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 lg:px-10 space-y-6">
              {/* Command Center — Conversion ring + KPIs */}
              {(() => {
                const convPct = rangeTotals.total > 0 ? rangeTotals.conversionRate * 100 : 0;
                const R = 86;
                const C = 2 * Math.PI * R;
                const dash = (convPct / 100) * C;
                const avgCtr = analytics?.byLink?.length
                  ? (analytics.byLink.reduce((s, l) => s + l.conversion, 0) / analytics.byLink.length) * 100
                  : convPct;
                return (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* Conversion radial ring */}
                    <div
                      className="relative overflow-hidden rounded-3xl border border-border bg-card-gradient p-6 shadow-card cursor-pointer transition-all hover:shadow-glow"
                      role="button"
                      tabIndex={0}
                      onClick={() => goToAnalytics()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Conversion · {rangeLabel}
                          </span>
                        </div>
                        <div className="flex rounded-lg border border-border bg-background/60 p-0.5" onClick={(e) => e.stopPropagation()}>
                          {(["day", "week", "month"] as const).map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRange(item); }}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-center">
                        {analyticsLoading ? (
                          <div className="h-56 w-56 animate-pulse rounded-full bg-muted" />
                        ) : (
                          <div className="relative h-56 w-56">
                            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                              <defs>
                                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="oklch(0.75 0.16 215)" />
                                  <stop offset="100%" stopColor="oklch(0.55 0.20 245)" />
                                </linearGradient>
                              </defs>
                              <circle cx="100" cy="100" r={R} fill="none" stroke="oklch(0.94 0.02 230)" strokeWidth="16" />
                              <circle
                                cx="100" cy="100" r={R} fill="none"
                                stroke="url(#ringGrad)"
                                strokeWidth="16"
                                strokeLinecap="round"
                                strokeDasharray={`${dash} ${C}`}
                                className="transition-all duration-700"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="font-display text-5xl font-bold tracking-tight">
                                {convPct.toFixed(1)}<span className="text-2xl text-muted-foreground">%</span>
                              </span>
                              <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Real humans
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: 2×2 KPI grid */}
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Total Clicks */}
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card cursor-pointer transition-all hover:border-primary/40"
                        role="button" tabIndex={0} onClick={() => goToAnalytics()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total Clicks</span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <MousePointerClick className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        {analyticsLoading ? (
                          <div className="mt-3 h-9 w-28 animate-pulse rounded bg-muted" />
                        ) : (
                          <div className="mt-2 font-display text-3xl font-bold tracking-tight">
                            {rangeTotals.total.toLocaleString()}
                          </div>
                        )}
                        <svg viewBox="0 0 100 28" className="mt-3 h-10 w-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="clkFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="oklch(0.62 0.18 235)" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="oklch(0.62 0.18 235)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={`${linePath(chartValues.map((v, i) => v + (botChartValues[i] ?? 0)), 100, 28)} L100,28 L0,28 Z`} fill="url(#clkFill)" />
                          <path d={linePath(chartValues.map((v, i) => v + (botChartValues[i] ?? 0)), 100, 28)} stroke="oklch(0.55 0.20 245)" strokeWidth="1.5" fill="none" />
                        </svg>
                      </div>

                      {/* Bots Blocked */}
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card cursor-pointer transition-all hover:border-destructive/40"
                        role="button" tabIndex={0} onClick={() => goToAnalytics()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Bots Blocked</span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        {analyticsLoading ? (
                          <div className="mt-3 h-9 w-28 animate-pulse rounded bg-muted" />
                        ) : (
                          <div className="mt-2 font-display text-3xl font-bold tracking-tight">
                            {rangeTotals.bots.toLocaleString()}
                          </div>
                        )}
                        <svg viewBox="0 0 100 28" className="mt-3 h-10 w-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="botFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="oklch(0.72 0.15 200)" stopOpacity="0.30" />
                              <stop offset="100%" stopColor="oklch(0.72 0.15 200)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={`${linePath(botChartValues, 100, 28)} L100,28 L0,28 Z`} fill="url(#botFill)" />
                          <path d={linePath(botChartValues, 100, 28)} stroke="oklch(0.72 0.15 200)" strokeWidth="1.5" fill="none" />
                        </svg>
                      </div>

                      {/* Active Links */}
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card cursor-pointer transition-all hover:border-primary/40"
                        role="button" tabIndex={0} onClick={() => setLinksDialogOpen(true)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Active Links</span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Link2 className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="mt-2 font-display text-3xl font-bold tracking-tight">{stats.totalLinks}</div>
                        <div className="mt-2 text-[11px] text-muted-foreground">Campaigns in rotation</div>
                      </div>

                      {/* Avg CTR */}
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card cursor-pointer transition-all hover:border-success/40"
                        role="button" tabIndex={0} onClick={() => goToAnalytics()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Avg CTR</span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-success/10 text-success">
                            <TrendingUp className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        {analyticsLoading ? (
                          <div className="mt-3 h-9 w-24 animate-pulse rounded bg-muted" />
                        ) : (
                          <div className="mt-2 font-display text-3xl font-bold tracking-tight">
                            {avgCtr.toFixed(1)}<span className="text-xl text-muted-foreground">%</span>
                          </div>
                        )}
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, avgCtr)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Real-Time Activity + Top Countries */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Real-Time Activity feed */}
                <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card">
                  <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                        Real-Time Activity
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Live browser & device feed</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {analyticsLoading ? (
                      [1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="px-5 py-3"><div className="h-6 animate-pulse rounded bg-secondary/60" /></div>
                      ))
                    ) : (analytics?.byBrowser ?? []).filter((r) => (r.key ?? "").toLowerCase() !== "bot" && (r.key ?? "").toLowerCase() !== "unknown").slice(0, 6).length === 0 ? (
                      <div className="px-5 py-10 text-center text-xs text-muted-foreground">No activity yet</div>
                    ) : (
                      (analytics?.byBrowser ?? [])
                        .filter((r) => (r.key ?? "").toLowerCase() !== "bot" && (r.key ?? "").toLowerCase() !== "unknown")
                        .slice(0, 6)
                        .map((row, i) => {
                          const Icon = getBrandIcon(row.key);
                          const osRow = (analytics?.byOS ?? []).filter((r) => (r.key ?? "").toLowerCase() !== "bot" && (r.key ?? "").toLowerCase() !== "unknown")[i % Math.max(1, (analytics?.byOS?.length ?? 1))];
                          const OsIcon = osRow ? getBrandIcon(osRow.key) : Activity;
                          const mins = i * 7 + 2;
                          return (
                            <div key={row.key} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/20">
                              <span className="font-mono text-[10px] text-muted-foreground w-10">
                                {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`}
                              </span>
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="text-sm font-medium flex-1 truncate">{prettyLabel(row.key)}</span>
                              <OsIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground w-16 text-right">{prettyLabel(osRow?.key ?? "—")}</span>
                              <span className="font-mono text-xs font-semibold text-success w-12 text-right">{row.humans}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Top Countries */}
                <div className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card">
                  <div className="border-b border-border/60 px-5 py-3">
                    <h3 className="font-display text-sm font-semibold">Top Countries</h3>
                    <p className="text-[11px] text-muted-foreground">Traffic distribution · {rangeLabel}</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {(() => {
                      const flag = (cc: string) => {
                        if (!cc || cc.length !== 2) return "🌐";
                        const up = cc.toUpperCase();
                        const A = 0x1f1e6;
                        try {
                          return String.fromCodePoint(A + up.charCodeAt(0) - 65, A + up.charCodeAt(1) - 65);
                        } catch { return "🌐"; }
                      };
                      const rows = (analytics?.byCountry ?? [])
                        .filter((r) => r.key && r.key !== "unknown")
                        .slice(0, 6);
                      const max = Math.max(1, ...rows.map((r) => r.total));
                      if (analyticsLoading) {
                        return [1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                        ));
                      }
                      if (rows.length === 0) {
                        return <p className="text-xs text-muted-foreground py-4 text-center">No country data yet</p>;
                      }
                      return rows.map((row) => {
                        const pct = (row.total / max) * 100;
                        const share = rangeTotals.total ? (row.total / rangeTotals.total) * 100 : 0;
                        return (
                          <div key={row.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="text-base leading-none">{flag(row.key)}</span>
                                <span className="font-semibold uppercase tracking-wide">{row.key}</span>
                              </span>
                              <span className="font-mono text-muted-foreground">{share.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-gradient-to-r from-[oklch(0.75_0.16_215)] to-[oklch(0.55_0.20_245)]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Create link */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-base font-semibold">Create new short link</h2>
                      <p className="text-xs text-muted-foreground">Cloaked, geo-aware, bot-filtered out of the box.</p>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      Auto bot filter on
                    </div>
                  </div>
                  <form onSubmit={create} className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_auto]">
                    <div className="relative">
                      <Label htmlFor="url" className="sr-only">Destination URL</Label>
                      <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input id="url" placeholder="https://your-adsterra-direct-link..." required value={url} onChange={(e) => setUrl(e.target.value)} className="pl-9" />
                    </div>
                    <div>
                      <Label htmlFor="title" className="sr-only">Title</Label>
                      <Input id="title" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={creating} className="gap-1.5 shadow-glow">
                      <Plus className="h-4 w-4" /> {creating ? "Creating..." : "Create link"}
                    </Button>
                  </form>
                </div>
              </div>



              {/* Links table */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-semibold">Your links</h2>
                    <p className="text-xs text-muted-foreground">
                      {filtered.length} of {links.length} shown
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2 p-5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/60" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {links.length === 0 ? "No links yet" : "No matches"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {links.length === 0
                        ? "Create your first cloaked short link above."
                        : "Try a different search."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filtered.map((l) => {
                      const total = l.clicks_count + l.bot_clicks_count;
                      const cleanPct = total > 0 ? (l.clicks_count / total) * 100 : 100;
                      return (
                        <div
                          key={l.id}
                          className="group flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => copy(l.short_code)}
                                className="group/code inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary hover:bg-primary/15"
                                title="Click to copy"
                              >
                                /r/{l.short_code}
                                <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover/code:opacity-100" />
                              </button>
                              {l.title && <span className="text-sm font-medium">{l.title}</span>}
                            </div>
                            <a
                              href={l.destination_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground max-w-full"
                            >
                              <span className="truncate">{l.destination_url}</span>
                              <ArrowUpRight className="h-3 w-3 shrink-0" />
                            </a>
                          </div>

                          {/* Traffic split */}
                          <div className="hidden md:block w-40">
                            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span>Traffic</span>
                              <span className="font-mono text-success">
                                {cleanPct.toFixed(0)}% clean
                              </span>
                            </div>
                            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div className="bg-success" style={{ width: `${cleanPct}%` }} />
                              <div
                                className="bg-destructive"
                                style={{ width: `${100 - cleanPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Real
                              </div>
                              <div className="font-mono text-sm font-bold text-success">
                                {l.clicks_count}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Bots
                              </div>
                              <div className="font-mono text-sm font-bold text-destructive">
                                {l.bot_clicks_count}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Analytics"
                            >
                              <Link to="/analytics/$linkId" params={{ linkId: l.id }} search={{ days: rangeDays }}>
                                <Activity className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Smart Targeting (Geo / Device / Duplicate)"
                            >
                              <Link to="/links/$linkId/targeting" params={{ linkId: l.id }}>
                                <Activity className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Settings"
                            >
                              <Link to="/links/$linkId/settings" params={{ linkId: l.id }}>
                                <Settings className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <a
                              href={`/r/${l.short_code}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Open">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => remove(l.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Active Links drill-down dialog */}
      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Active Links · {links.length}</DialogTitle>
            <DialogDescription>
              Pick a link to drill into its full analytics, clicks, and bot-filter timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {links.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No links yet. Create one below.</p>
            ) : (
              <div className="space-y-1.5">
                {links.map((l) => {
                  const total = l.clicks_count + l.bot_clicks_count;
                  const cleanPct = total > 0 ? (l.clicks_count / total) * 100 : 100;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        setLinksDialogOpen(false);
                        goToLinkAnalytics(l.id);
                      }}
                      className="w-full rounded-xl border border-border bg-card-gradient p-3 text-left transition-all hover:border-primary/40 hover:shadow-card"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                              /r/{l.short_code}
                            </span>
                            {l.title && <span className="truncate text-sm font-medium">{l.title}</span>}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{l.destination_url}</div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Real</div>
                            <div className="font-mono text-sm font-bold text-success">{l.clicks_count}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Bots</div>
                            <div className="font-mono text-sm font-bold text-destructive">{l.bot_clicks_count}</div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-secondary">
                        <div className="bg-success" style={{ width: `${cleanPct}%` }} />
                        <div className="bg-destructive" style={{ width: `${100 - cleanPct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
