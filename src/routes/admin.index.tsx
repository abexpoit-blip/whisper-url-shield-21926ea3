import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Link2, MousePointerClick, Clock, Globe2, Package,
  ArrowRight, ShieldCheck, TrendingUp, Activity, Bot, UserCheck,
  DollarSign, UserPlus, Ban, Flame, Globe, ExternalLink,
} from "lucide-react";
import { getAdminOverview, getAdminAdvancedStats } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const fn = useServerFn(getAdminOverview);
  const advFn = useServerFn(getAdminAdvancedStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const { data: adv, isLoading: advLoading } = useQuery({
    queryKey: ["admin", "advanced"],
    queryFn: () => advFn(),
    staleTime: 5 * 60_000,
  });

  const c = data?.counts;
  const stats = [
    { label: "Users", value: c?.users ?? 0, icon: Users, accent: "from-blue-500/20 to-blue-500/0", iconColor: "text-blue-400" },
    { label: "Links", value: c?.links ?? 0, icon: Link2, accent: "from-purple-500/20 to-purple-500/0", iconColor: "text-purple-400" },
    { label: "Total clicks", value: c?.clicks ?? 0, icon: MousePointerClick, accent: "from-emerald-500/20 to-emerald-500/0", iconColor: "text-emerald-400" },
    { label: "Pending requests", value: c?.pendingRequests ?? 0, icon: Clock, accent: "from-amber-500/20 to-amber-500/0", iconColor: "text-amber-400" },
    { label: "Active domains", value: c?.activeDomains ?? 0, icon: Globe2, accent: "from-cyan-500/20 to-cyan-500/0", iconColor: "text-cyan-400" },
    { label: "Active packages", value: c?.activePackages ?? 0, icon: Package, accent: "from-pink-500/20 to-pink-500/0", iconColor: "text-pink-400" },
  ];

  return (
    <div className="relative min-h-screen">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:space-y-8 md:p-8">
        {/* Hero */}
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Badge variant="outline" className="mb-2 gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Activity className="h-3 w-3" /> Admin Console
            </Badge>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Welcome back, operator.
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Live overview of users, traffic, revenue requests and infrastructure.
            </p>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <Link to="/admin/payments"><Button size="sm" variant="default" className="shrink-0 gap-2">Review requests <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/admin/packages"><Button size="sm" variant="outline" className="shrink-0">Packages</Button></Link>
            <Link to="/admin/users"><Button size="sm" variant="outline" className="shrink-0">Members</Button></Link>
          </div>
        </header>

        {/* Stats grid */}
        <div className="grid gap-3 grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} className="relative overflow-hidden border-border/60">
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${s.accent}`} />
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">{s.label}</p>
                  <s.icon className={`h-4 w-4 shrink-0 ${s.iconColor}`} />
                </div>
                <p className="mt-2 font-display text-xl font-bold tabular-nums sm:mt-3 sm:text-3xl">
                  {isLoading ? "—" : s.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Advanced KPI strip */}
        <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="Last 24h clicks" value={adv?.last24h.total ?? 0} sub={`${adv?.last24h.human ?? 0} human · ${adv?.last24h.bot ?? 0} bot`} icon={Flame} tone="text-orange-400" loading={advLoading} />
          <KpiCard label="Bot ratio (7d)" value={`${adv?.last7d.botPct ?? 0}%`} sub={`${(adv?.last7d.bot ?? 0).toLocaleString()} of ${(adv?.last7d.total ?? 0).toLocaleString()}`} icon={Bot} tone="text-rose-400" loading={advLoading} />
          <KpiCard label="Revenue (30d)" value={`$${(adv?.revenue.last30d ?? 0).toFixed(2)}`} sub={`${Object.keys(adv?.revenue.byPackage ?? {}).length} packages`} icon={DollarSign} tone="text-emerald-400" loading={advLoading} />
          <KpiCard label="New users (7d / 30d)" value={`${adv?.growth.newUsers7d ?? 0} / ${adv?.growth.newUsers30d ?? 0}`} sub={`${adv?.growth.activeLinks ?? 0} active · ${adv?.growth.bannedUsers ?? 0} banned`} icon={UserPlus} tone="text-blue-400" loading={advLoading} />
        </div>

        {/* Traffic chart + bot reasons */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Traffic — last 7 days</CardTitle>
              <CardDescription>Human vs bot clicks per day</CardDescription>
            </CardHeader>
            <CardContent>
              <TrafficChart series={adv?.dailySeries ?? []} />
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Human</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Bot</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Bot detection (7d)</CardTitle>
              <CardDescription>Top trigger reasons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(adv?.topBotReasons?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No bot hits yet.</p>
              ) : adv!.topBotReasons.map((b) => (
                <div key={b.reason} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{b.reason}</span>
                  <Badge variant="outline" className="tabular-nums">{b.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Top countries / referrers / links */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-primary" /> Top countries (7d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(adv?.topCountries?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : <RankBars items={adv!.topCountries.map((c) => ({ label: c.country, value: c.count }))} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="h-4 w-4 text-primary" /> Top referrers (7d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(adv?.topReferers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : <RankBars items={adv!.topReferers.map((r) => ({ label: r.host, value: r.count }))} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-primary" /> Top links (7d)</CardTitle>
              <CardDescription>By total clicks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(adv?.topLinks?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : adv!.topLinks.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.title || l.short_code}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">/{l.short_code} · {l.human}h / {l.bot}b</p>
                  </div>
                  <Badge variant="outline" className="tabular-nums">{l.total}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>



        <div className="grid gap-6 lg:grid-cols-3">
          {/* Plan distribution */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Plan distribution</CardTitle>
              <CardDescription>Users per package</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data?.planDistribution ?? {}).length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
              {Object.entries(data?.planDistribution ?? {}).sort((a, b) => b[1] - a[1]).map(([slug, count]) => {
                const total = Object.values(data?.planDistribution ?? {}).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={slug}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{slug}</span>
                      <span className="text-muted-foreground tabular-nums">{count} · {pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recent upgrade requests */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent upgrade requests</CardTitle>
                <CardDescription>Latest 5 payment requests</CardDescription>
              </div>
              <Link to="/admin/payments"><Button size="sm" variant="ghost" className="gap-1">All <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
            </CardHeader>
            <CardContent>
              {(data?.recentRequests?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data!.recentRequests.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Badge variant="outline">{r.package_slug}</Badge>
                          <span className="text-muted-foreground">${Number(r.amount ?? 0).toFixed(2)}</span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{r.user_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent links</CardTitle>
            <CardDescription>Newest short links created across all users</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.recentLinks?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No links yet.</p>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {data!.recentLinks.map((l: any) => (
                  <div key={l.id} className="rounded-xl border border-border/60 bg-card-gradient p-4 transition hover:border-primary/40">
                    <p className="truncate text-sm font-semibold">{l.title || l.short_code}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">/{l.short_code}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold text-primary tabular-nums">{l.clicks_count} hits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============== small UI helpers ==============

function KpiCard({ label, value, sub, icon: Icon, tone, loading }: { label: string; value: string | number; sub?: string; icon: any; tone: string; loading?: boolean }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</p>
          <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
        </div>
        <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{loading ? "—" : value}</p>
        {sub && <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function TrafficChart({ series }: { series: Array<{ date: string; total: number; bot: number; human: number }> }) {
  const w = 560;
  const h = 160;
  const pad = { top: 8, right: 8, bottom: 22, left: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const max = Math.max(1, ...series.map((s) => s.total));
  const n = series.length || 1;
  const bw = (innerW / n) * 0.7;
  const gap = (innerW / n) * 0.3;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[480px]">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad.left} x2={w - pad.right} y1={pad.top + innerH * (1 - t)} y2={pad.top + innerH * (1 - t)} className="stroke-border" strokeWidth={1} strokeDasharray="2 3" />
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={`l${t}`} x={pad.left - 4} y={pad.top + innerH * (1 - t) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
            {Math.round(max * t)}
          </text>
        ))}
        {series.map((d, i) => {
          const x = pad.left + i * (bw + gap) + gap / 2;
          const humanH = (d.human / max) * innerH;
          const botH = (d.bot / max) * innerH;
          const yHuman = pad.top + innerH - humanH;
          const yBot = yHuman - botH;
          return (
            <g key={d.date}>
              <rect x={x} y={yHuman} width={bw} height={Math.max(humanH, 0.5)} rx={2} className="fill-emerald-400/70" />
              <rect x={x} y={yBot} width={bw} height={Math.max(botH, 0.5)} rx={2} className="fill-rose-400/70" />
              <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RankBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = Math.max(4, Math.round((it.value / max) * 100));
        return (
          <div key={it.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium">{it.label}</span>
              <span className="text-muted-foreground tabular-nums">{it.value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
