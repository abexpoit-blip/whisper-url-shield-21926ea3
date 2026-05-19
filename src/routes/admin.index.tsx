import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Link2, MousePointerClick, Clock, Globe2, Package,
  ArrowRight, ShieldCheck, TrendingUp, Activity,
} from "lucide-react";
import { getAdminOverview } from "@/lib/admin-stats.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const isAdmin = useIsAdmin();
  const fn = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fn(),
    enabled: isAdmin === true,
  });

  if (isAdmin === null) {
    return <div className="p-8 text-sm text-muted-foreground">Checking access…</div>;
  }
  if (isAdmin === false) {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-2xl border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Admin access required</h2>
        <p className="mt-2 text-sm text-muted-foreground">This area is restricted to administrators.</p>
        <Link to="/dashboard"><Button className="mt-4" variant="outline">Back to dashboard</Button></Link>
      </div>
    );
  }

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

      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
        {/* Hero */}
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Activity className="h-3 w-3" /> Admin Console
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Welcome back, operator.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live overview of users, traffic, revenue requests and infrastructure.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/payments"><Button variant="default" className="gap-2">Review requests <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/admin/packages"><Button variant="outline">Packages</Button></Link>
            <Link to="/admin/users"><Button variant="outline">Members</Button></Link>
          </div>
        </header>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} className="relative overflow-hidden border-border/60">
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${s.accent}`} />
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <p className="mt-3 font-display text-3xl font-bold tabular-nums">
                  {isLoading ? "—" : s.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
