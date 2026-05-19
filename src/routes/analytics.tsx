import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield,
  ArrowLeft,
  Users,
  Bot,
  Target,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALLOWED_DAYS = [1, 7, 14, 30, 90] as const;
const RANGE_TO_DAYS = { day: 1, week: 7, month: 30 } as const;

type AnalyticsSearch = { days: number; linkId: string };

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — LinkShield" },
      { name: "description", content: "Real-time analytics: real users vs bots, devices, countries, and conversions for your short links." },
      { property: "og:title", content: "Analytics — LinkShield" },
      { property: "og:description", content: "Real-time analytics: real users vs bots, devices, countries, and conversions for your short links." },
      { property: "og:url", content: "https://sleepox.com/analytics" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/analytics" }],
  }),
  validateSearch: (s: Record<string, unknown>): AnalyticsSearch => {
    let days = 7;
    const d = s.days;
    const r = s.range;
    if (typeof d === "number" && (ALLOWED_DAYS as readonly number[]).includes(d)) {
      days = d;
    } else if (typeof d === "string" && /^\d+$/.test(d)) {
      const n = Number(d);
      if ((ALLOWED_DAYS as readonly number[]).includes(n)) days = n;
    } else if (typeof r === "string" && r in RANGE_TO_DAYS) {
      days = RANGE_TO_DAYS[r as keyof typeof RANGE_TO_DAYS];
    }
    const linkId = typeof s.linkId === "string" && s.linkId ? s.linkId : "all";
    return { days, linkId };
  },
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AnalyticsPage,
});

const PIE_COLORS = [
  "#7c3aed", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#84cc16", // lime
];

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  boxShadow: "0 10px 30px -10px rgba(124, 58, 237, 0.2)",
  fontSize: "12px",
  padding: "8px 12px",
} as const;

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

function AnalyticsPage() {
  const navigate = useNavigate();
  const fetchAnalytics = useServerFn(getAnalytics);
  const { days, linkId } = Route.useSearch();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const setDays = (n: number) =>
    navigate({ to: "/analytics", search: (prev: AnalyticsSearch) => ({ ...prev, days: n }), replace: true });
  const setLinkId = (id: string) =>
    navigate({ to: "/analytics", search: (prev: AnalyticsSearch) => ({ ...prev, linkId: id }), replace: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAnalytics({
        data: { days, linkId: linkId === "all" ? null : linkId },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [days, linkId]);

  const t = data?.totals;
  const conversionPct = useMemo(() => (t ? Math.round(t.conversionRate * 1000) / 10 : 0), [t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="font-bold tracking-tight text-lg">LinkShield Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All links" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All links</SelectItem>
                {data?.links.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title || l.short_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh analytics">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/funnel" })}>
              Cross-link funnel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Total Clicks"
            value={t?.total ?? 0}
            accent="text-foreground"
          />
          <KpiCard
            icon={<Users className="h-5 w-5" />}
            label="Real Users"
            value={t?.humans ?? 0}
            accent="text-emerald-500"
          />
          <KpiCard
            icon={<Bot className="h-5 w-5" />}
            label="Bots Blocked"
            value={t?.bots ?? 0}
            accent="text-rose-500"
          />
          <KpiCard
            icon={<Target className="h-5 w-5" />}
            label="Pass Rate"
            value={`${conversionPct}%`}
            accent="text-primary"
          />
        </div>

        {/* Traffic timeseries */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Real users vs bots over time</h2>
          </div>
          <div className="h-72">
            {data && data.timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeseries}>
                  <defs>
                    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="humans"
                    stroke="#22c55e"
                    fill="url(#h)"
                    name="Real users"
                  />
                  <Area
                    type="monotone"
                    dataKey="bots"
                    stroke="#ef4444"
                    fill="url(#b)"
                    name="Bots"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reject reasons */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h2 className="font-semibold">Top bot reject reasons</h2>
            </div>
            <div className="h-72">
              {data && data.topReasons.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topReasons} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      stroke="#6b7280"
                      fontSize={11}
                      width={120}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>

          {/* Device pie */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Device breakdown</h2>
            </div>
            <div className="h-72">
              {data && data.byDevice.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byDevice}
                      dataKey="total"
                      nameKey="key"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {data.byDevice.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Country */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Top countries</h2>
            </div>
            <BreakdownTable rows={data?.byCountry ?? []} keyLabel="Country" />
          </Card>

          {/* Browser */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Browsers</h2>
            </div>
            <BreakdownTable rows={data?.byBrowser ?? []} keyLabel="Browser" />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OS */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Tablet className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Operating systems</h2>
            </div>
            <BreakdownTable rows={data?.byOS ?? []} keyLabel="OS" />
          </Card>

          {/* Variants */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Pre-lander variant performance</h2>
            </div>
            <BreakdownTable rows={data?.byVariant ?? []} keyLabel="Variant" showConversion />
          </Card>
        </div>

        {/* Per-link conversion */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Per-link conversion</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Link</th>
                  <th className="text-left py-2 px-2">Destination</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Real</th>
                  <th className="text-right py-2 px-2">Bots</th>
                  <th className="text-right py-2 px-2">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byLink ?? []).map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                    onClick={() => navigate({ to: "/analytics/$linkId", params: { linkId: l.id } })}
                  >
                    <td className="py-2 px-2 font-mono text-primary underline-offset-2 hover:underline">
                      /r/{l.short_code}
                    </td>
                    <td
                      className="py-2 px-2 max-w-xs truncate text-muted-foreground"
                      title={l.destination_url}
                    >
                      {l.destination_url}
                    </td>
                    <td className="py-2 px-2 text-right">{l.total}</td>
                    <td className="py-2 px-2 text-right text-emerald-500">{l.humans}</td>
                    <td className="py-2 px-2 text-right text-rose-500">{l.bots}</td>
                    <td className="py-2 px-2 text-right font-semibold">
                      {Math.round(l.conversion * 1000) / 10}%
                    </td>
                  </tr>
                ))}
                {!data?.byLink.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Referrers */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Top referrers</h2>
          </div>
          <BreakdownTable
            rows={(data?.referrers ?? []).map((r) => ({
              key: r.host,
              total: r.count,
              humans: 0,
              bots: 0,
            }))}
            keyLabel="Source"
            hideSplit
          />
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          <Link to="/dashboard" className="hover:text-primary">
            ← Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data in this period yet
    </div>
  );
}

function BreakdownTable({
  rows,
  keyLabel,
  showConversion,
  hideSplit,
}: {
  rows: { key: string; total: number; humans: number; bots: number }[];
  keyLabel: string;
  showConversion?: boolean;
  hideSplit?: boolean;
}) {
  if (!rows.length) return <EmptyState />;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{r.key}</span>
            <span className="text-muted-foreground tabular-nums">
              {r.total}
              {!hideSplit && (
                <>
                  {" "}
                  <span className="text-emerald-500">{r.humans}</span>
                  {" / "}
                  <span className="text-rose-500">{r.bots}</span>
                </>
              )}
              {showConversion && r.total > 0 && (
                <span className="ml-2 text-primary">
                  {Math.round((r.humans / r.total) * 1000) / 10}%
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
