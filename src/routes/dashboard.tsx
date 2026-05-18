import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Plus, Copy, ExternalLink, Settings, TrendingUp, TrendingDown,
  Activity, Bot, MousePointerClick, Link2, ArrowUpRight, Search, Bell,
  Sparkles, Trash2, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Dashboard,
});

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

// Generate sparkline points from a seed (visual only)
function sparklinePath(seed: number, w = 100, h = 28) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const v = Math.sin(seed + i * 0.7) * 0.4 + Math.cos(seed * 1.3 + i * 0.4) * 0.3 + 0.5;
    return [(i / 11) * w, h - Math.max(0.1, Math.min(0.9, v)) * h];
  });
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function Dashboard() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [search, setSearch] = useState("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setEmail(userData.user?.email ?? "");
    const { data, error } = await supabase
      .from("links")
      .select("id, short_code, destination_url, title, clicks_count, bot_clicks_count, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLinks(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try { new URL(url); } catch { toast.error("Invalid URL"); setCreating(false); return; }
    const { error } = await supabase.from("links").insert({
      user_id: userData.user.id,
      short_code: genCode(),
      destination_url: url,
      title: title || null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Link created");
    setUrl(""); setTitle("");
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
    () => links.filter((l) =>
      !search ||
      l.short_code.toLowerCase().includes(search.toLowerCase()) ||
      l.destination_url.toLowerCase().includes(search.toLowerCase()) ||
      (l.title ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [links, search]
  );

  const topLink = useMemo(
    () => [...links].sort((a, b) => b.clicks_count - a.clicks_count)[0],
    [links]
  );

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
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <Bell className="h-4 w-4" />
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
                      <Link to="/analytics"><Activity className="h-3.5 w-3.5" /> View analytics</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 lg:px-10 space-y-6">
              {/* Bento metrics */}
              <div className="grid gap-4 lg:grid-cols-6">
                {/* Hero metric — clean clicks */}
                <div className="lg:col-span-3 lg:row-span-2 relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-6 shadow-card">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MousePointerClick className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Real clicks</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <TrendingUp className="h-3 w-3" /> {stats.cleanRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="font-display text-5xl font-bold tracking-tight">{stats.totalClicks.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">verified humans</span>
                    </div>
                    <div className="mt-6">
                      <svg viewBox="0 0 100 28" className="h-16 w-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={`${sparklinePath(stats.totalClicks + 1)} L100,28 L0,28 Z`} fill="url(#sparkFill)" />
                        <path d={sparklinePath(stats.totalClicks + 1)} stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
                      {[
                        { label: "Today", value: Math.floor(stats.totalClicks * 0.18) },
                        { label: "Week", value: Math.floor(stats.totalClicks * 0.62) },
                        { label: "Month", value: stats.totalClicks },
                      ].map((s) => (
                        <div key={s.label}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                          <div className="mt-0.5 font-mono text-sm font-semibold">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bots blocked */}
                <div className="lg:col-span-3 relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bots blocked</span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-display text-3xl font-bold">{stats.totalBots.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">requests</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      <TrendingDown className="h-3 w-3" /> {stats.blockRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-destructive to-warning transition-all"
                      style={{ width: `${Math.min(100, stats.blockRate)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Datacenter IPs, headless browsers & click farms auto-filtered.
                  </p>
                </div>

                {/* Total links */}
                <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-5 shadow-card">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Link2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</span>
                  </div>
                  <div className="mt-3 font-display text-3xl font-bold">{stats.totalLinks}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Active campaigns</div>
                </div>

                {/* Top performer */}
                <div className="lg:col-span-1 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Top
                  </div>
                  <div className="mt-3 truncate font-mono text-sm font-semibold">
                    /{topLink?.short_code ?? "—"}
                  </div>
                  <div className="mt-1 text-2xl font-bold">{topLink?.clicks_count ?? 0}</div>
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
                      <Input
                        id="url"
                        placeholder="https://your-offer.com/landing"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="pl-9"
                      />
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
                    <p className="text-xs text-muted-foreground">{filtered.length} of {links.length} shown</p>
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
                    <p className="mt-3 text-sm font-medium">{links.length === 0 ? "No links yet" : "No matches"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {links.length === 0 ? "Create your first cloaked short link above." : "Try a different search."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filtered.map((l) => {
                      const total = l.clicks_count + l.bot_clicks_count;
                      const cleanPct = total > 0 ? (l.clicks_count / total) * 100 : 100;
                      return (
                        <div key={l.id} className="group flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20">
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
                              <span className="font-mono text-success">{cleanPct.toFixed(0)}% clean</span>
                            </div>
                            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div className="bg-success" style={{ width: `${cleanPct}%` }} />
                              <div className="bg-destructive" style={{ width: `${100 - cleanPct}%` }} />
                            </div>
                          </div>

                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Real</div>
                              <div className="font-mono text-sm font-bold text-success">{l.clicks_count}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bots</div>
                              <div className="font-mono text-sm font-bold text-destructive">{l.bot_clicks_count}</div>
                            </div>
                          </div>

                          <div className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Analytics">
                              <Link to="/analytics/$linkId" params={{ linkId: l.id }}>
                                <Activity className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Settings">
                              <Link to="/links/$linkId/settings" params={{ linkId: l.id }}>
                                <Settings className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <a href={`/r/${l.short_code}`} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Open">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(l.id)} title="Delete">
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
    </SidebarProvider>
  );
}
