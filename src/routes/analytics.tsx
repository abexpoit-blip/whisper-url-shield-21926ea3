import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", sans-serif';

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  boxShadow: "0 10px 30px -10px rgba(124, 58, 237, 0.2)",
  fontSize: "12px",
  fontFamily: FONT_STACK,
  padding: "8px 12px",
} as const;

const TOOLTIP_LABEL_STYLE = {
  color: "#111827",
  fontWeight: 600,
  marginBottom: 4,
} as const;

const TOOLTIP_ITEM_STYLE = {
  color: "#374151",
  fontSize: 12,
} as const;

const AXIS_TICK = {
  fill: "#6b7280",
  fontSize: 11,
  fontFamily: FONT_STACK,
  fontWeight: 500,
} as const;

const LEGEND_WRAPPER = {
  fontSize: "12px",
  fontFamily: FONT_STACK,
  fontWeight: 500,
  paddingTop: "8px",
  cursor: "pointer",
} as const;

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

function AnalyticsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const fetchAnalytics = useServerFn(getAnalytics);
  const { days, linkId } = Route.useSearch();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const toggleSeries = (key: string) =>
    setHidden((h) => ({ ...h, [key]: !h[key] }));

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
          <div className="h-72 sm:h-80 -mx-2 sm:mx-0">
            {data && data.timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.timeseries}
                  margin={{ top: 8, right: 12, left: isMobile ? -16 : 0, bottom: 0 }}
                >
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    minTickGap={isMobile ? 24 : 12}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    width={isMobile ? 32 : 44}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    cursor={{ stroke: "#c4b5fd", strokeWidth: 1 }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={LEGEND_WRAPPER}
                    onClick={(e) => toggleSeries(String(e.dataKey))}
                    formatter={(value, entry) => {
                      const key = String((entry as { dataKey?: string }).dataKey);
                      const off = hidden[key];
                      return (
                        <span style={{ color: off ? "#9ca3af" : "#374151", textDecoration: off ? "line-through" : "none" }}>
                          {value}
                        </span>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="humans"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#h)"
                    name="Real users"
                    hide={hidden.humans}
                  />
                  <Area
                    type="monotone"
                    dataKey="bots"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#b)"
                    name="Bots"
                    hide={hidden.bots}
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
            <div className="h-72 sm:h-80 -mx-2 sm:mx-0">
              {data && data.topReasons.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.topReasons}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 90 : 140}
                      interval={0}
                      tickFormatter={(v: string) =>
                        v.length > (isMobile ? 12 : 18) ? `${v.slice(0, isMobile ? 12 : 18)}…` : v
                      }
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      cursor={{ fill: "rgba(124,58,237,0.06)" }}
                    />
                    <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} barSize={isMobile ? 14 : 20} />
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
            <div className="h-80 sm:h-80">
              {data && data.byDevice.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={data.byDevice.filter((d) => !hidden[`dev:${d.key}`])}
                      dataKey="total"
                      nameKey="key"
                      cx="50%"
                      cy="45%"
                      innerRadius={isMobile ? 38 : 50}
                      outerRadius={isMobile ? 68 : 90}
                      paddingAngle={2}
                      label={
                        isMobile
                          ? false
                          : ({ percent }) => `${Math.round((percent ?? 0) * 100)}%`
                      }
                      labelLine={false}
                    >
                      {data.byDevice
                        .filter((d) => !hidden[`dev:${d.key}`])
                        .map((d) => {
                          const origIdx = data.byDevice.findIndex((x) => x.key === d.key);
                          return (
                            <Cell
                              key={d.key}
                              fill={PIE_COLORS[origIdx % PIE_COLORS.length]}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          );
                        })}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      formatter={(value: number, name: string) => [`${value} clicks`, name]}
                    />
                    <Legend
                      iconType="circle"
                      verticalAlign="bottom"
                      wrapperStyle={LEGEND_WRAPPER}
                      onClick={(e) => toggleSeries(`dev:${String(e.value)}`)}
                      payload={data.byDevice.map((d, i) => ({
                        value: d.key,
                        type: "circle",
                        id: d.key,
                        color: hidden[`dev:${d.key}`] ? "#d1d5db" : PIE_COLORS[i % PIE_COLORS.length],
                      }))}
                      formatter={(value) => {
                        const off = hidden[`dev:${String(value)}`];
                        return (
                          <span style={{ color: off ? "#9ca3af" : "#374151", textDecoration: off ? "line-through" : "none" }}>
                            {value}
                          </span>
                        );
                      }}
                    />
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
          <Card className="p-5 bg-gradient-to-br from-card via-card to-primary/5 border-primary/10 shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="font-semibold tracking-tight">Top countries</h2>
            </div>
            <BreakdownTable rows={data?.byCountry ?? []} keyLabel="Country" kind="country" />
          </Card>

          {/* Browser */}
          <Card className="p-5 bg-gradient-to-br from-card via-card to-primary/5 border-primary/10 shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="h-4 w-4 text-primary" />
              <h2 className="font-semibold tracking-tight">Browsers</h2>
            </div>
            <BreakdownTable rows={data?.byBrowser ?? []} keyLabel="Browser" kind="browser" />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OS */}
          <Card className="p-5 bg-gradient-to-br from-card via-card to-primary/5 border-primary/10 shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Tablet className="h-4 w-4 text-primary" />
              <h2 className="font-semibold tracking-tight">Operating systems</h2>
            </div>
            <BreakdownTable rows={data?.byOS ?? []} keyLabel="OS" kind="os" />
          </Card>

          {/* Variants */}
          <Card className="p-5 bg-gradient-to-br from-card via-card to-primary/5 border-primary/10 shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold tracking-tight">Pre-lander variant performance</h2>
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

// ---------- Premium label renderers (flags / OS / browser logos) ----------
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", ID: "Indonesia", TH: "Thailand", SG: "Singapore",
  IN: "India", GB: "United Kingdom", DE: "Germany", FR: "France",
  BR: "Brazil", JP: "Japan", CN: "China", RU: "Russia", CA: "Canada",
  AU: "Australia", MX: "Mexico", IT: "Italy", ES: "Spain", NL: "Netherlands",
  TR: "Turkey", BD: "Bangladesh", PK: "Pakistan", PH: "Philippines",
  VN: "Vietnam", MY: "Malaysia", KR: "South Korea", AE: "UAE", SA: "Saudi Arabia",
  EG: "Egypt", ZA: "South Africa", NG: "Nigeria", AR: "Argentina", CL: "Chile",
};

function countryFlag(cc: string) {
  if (!cc || cc.length !== 2) return "🌐";
  const up = cc.toUpperCase();
  try {
    return String.fromCodePoint(0x1f1e6 + up.charCodeAt(0) - 65, 0x1f1e6 + up.charCodeAt(1) - 65);
  } catch { return "🌐"; }
}

function OsLogo({ name }: { name: string }) {
  const n = name.toLowerCase();
  const cls = "h-4 w-4";
  if (n.includes("android")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#3DDC84"><path d="M17.6 9.48l1.84-3.18a.4.4 0 1 0-.69-.4l-1.86 3.23a11.43 11.43 0 0 0-9.78 0L5.25 5.9a.4.4 0 1 0-.69.4L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm10 0a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"/></svg>
  );
  if (n.includes("ios") || n.includes("iphone") || n.includes("ipad") || n.includes("mac")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor"><path d="M16.36 12.27c0-2.66 2.17-3.93 2.27-4-1.24-1.81-3.17-2.06-3.85-2.09-1.64-.17-3.2.97-4.04.97-.84 0-2.12-.94-3.49-.91a5.16 5.16 0 0 0-4.34 2.65c-1.85 3.2-.47 7.93 1.33 10.53.88 1.27 1.93 2.7 3.31 2.65 1.33-.05 1.83-.86 3.44-.86 1.6 0 2.06.86 3.46.83 1.43-.03 2.34-1.29 3.21-2.57.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.73-1.05-2.72-4.16zM13.74 4.34a4.7 4.7 0 0 0 1.07-3.36 4.76 4.76 0 0 0-3.12 1.62 4.46 4.46 0 0 0-1.1 3.24 3.94 3.94 0 0 0 3.15-1.5z"/></svg>
  );
  if (n.includes("windows")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#00A4EF"><path d="M3 5.5L11 4.4v7.1H3V5.5zM3 12.5h8v7.1L3 18.5v-6zM12 4.3L22 3v8.5H12V4.3zM12 12.5h10V21l-10-1.3v-7.2z"/></svg>
  );
  if (n.includes("linux")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#FCC624"><path d="M12.5 1c-2 0-3.4 1.6-3.4 3.8 0 .9.3 1.6.3 2.4 0 1.3-1.5 2.6-2.6 4-1.5 1.8-2.3 4-2.3 5.5 0 1.7.7 2.7 2 3.4 0 0-.5 1.4.5 2 1.7.9 4.5.4 5.5.4s3.8.5 5.5-.4c1-.6.5-2 .5-2 1.3-.7 2-1.7 2-3.4 0-1.5-.8-3.7-2.3-5.5-1.1-1.4-2.6-2.7-2.6-4 0-.8.3-1.5.3-2.4C15.9 2.6 14.5 1 12.5 1z"/></svg>
  );
  if (n.includes("bot") || n.includes("crawler")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
  );
  return <Monitor className={cls + " text-muted-foreground"} />;
}

function BrowserLogo({ name }: { name: string }) {
  const n = name.toLowerCase();
  const cls = "h-4 w-4";
  if (n.includes("chrome")) return (
    <svg viewBox="0 0 24 24" className={cls}><circle cx="12" cy="12" r="10" fill="#fff"/><circle cx="12" cy="12" r="4" fill="#4285F4"/><path d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5L3.34 7A10 10 0 0 1 12 2z" fill="#EA4335"/><path d="M2 12a10 10 0 0 0 5 8.66l4.33-7.5A5 5 0 0 1 7 9.5L2.66 7A10 10 0 0 0 2 12z" fill="#FBBC04"/><path d="M12 22a10 10 0 0 0 8.66-15H12a5 5 0 0 1 4.33 7.5L12 22z" fill="#34A853"/></svg>
  );
  if (n.includes("safari")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#1B73E8"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M12 6l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></svg>
  );
  if (n.includes("firefox")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#FF7139"><circle cx="12" cy="12" r="10"/><path fill="#FFCB6B" d="M12 6a6 6 0 1 0 6 6c0-2-2-3-3-2 1-3-3-5-3-4z"/></svg>
  );
  if (n.includes("edge")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#0078D7"><circle cx="12" cy="12" r="10"/></svg>
  );
  if (n.includes("opera")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="#FF1B2D"><ellipse cx="12" cy="12" rx="10" ry="10"/><ellipse cx="12" cy="12" rx="4" ry="7" fill="#fff"/></svg>
  );
  if (n.includes("bot")) return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
  );
  return <Monitor className={cls + " text-muted-foreground"} />;
}

function RowLabel({ kind, value }: { kind?: string; value: string }) {
  if (kind === "country") {
    const cc = value.toUpperCase();
    return (
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-lg leading-none">{countryFlag(cc)}</span>
        <span className="font-mono text-xs font-bold uppercase tracking-wider">{cc}</span>
        <span className="truncate text-xs text-muted-foreground">{COUNTRY_NAMES[cc] ?? ""}</span>
      </span>
    );
  }
  if (kind === "os") {
    return (
      <span className="flex items-center gap-2 min-w-0">
        <OsLogo name={value} />
        <span className="truncate font-medium capitalize">{value}</span>
      </span>
    );
  }
  if (kind === "browser") {
    return (
      <span className="flex items-center gap-2 min-w-0">
        <BrowserLogo name={value} />
        <span className="truncate font-medium capitalize">{value}</span>
      </span>
    );
  }
  return <span className="truncate font-medium">{value}</span>;
}

function BreakdownTable({
  rows,
  keyLabel: _keyLabel,
  showConversion,
  hideSplit,
  kind,
}: {
  rows: { key: string; total: number; humans: number; bots: number }[];
  keyLabel: string;
  showConversion?: boolean;
  hideSplit?: boolean;
  kind?: "country" | "os" | "browser" | "generic";
}) {
  if (!rows.length) return <EmptyState />;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
      {rows.map((r) => (
        <div key={r.key} className="group space-y-1.5 rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-accent/30">
          <div className="flex items-center justify-between text-sm gap-3">
            <RowLabel kind={kind} value={r.key} />
            <span className="text-muted-foreground tabular-nums font-mono text-xs whitespace-nowrap">
              <span className="font-semibold text-foreground">{r.total}</span>
              {!hideSplit && (
                <>
                  {" "}
                  <span className="text-emerald-500">{r.humans}</span>
                  <span className="opacity-50"> / </span>
                  <span className="text-rose-500">{r.bots}</span>
                </>
              )}
              {showConversion && r.total > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  {Math.round((r.humans / r.total) * 1000) / 10}%
                </span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary/60 overflow-hidden ring-1 ring-border/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[oklch(0.75_0.16_215)] via-[oklch(0.65_0.20_245)] to-[oklch(0.55_0.22_280)] shadow-[0_0_12px_oklch(0.62_0.20_245_/_0.45)] transition-all duration-500 group-hover:shadow-[0_0_20px_oklch(0.62_0.20_245_/_0.7)]"
              style={{ width: `${(r.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
