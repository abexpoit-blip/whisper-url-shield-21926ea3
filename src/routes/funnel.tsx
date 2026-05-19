import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  GitCompare,
  TrendingDown,
  Target,
  BarChart3,
  Calendar as CalendarIcon,
  Radio,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getCrossLinkFunnel } from "@/lib/cross-funnel.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/funnel")({
  head: () => ({
    meta: [
      { title: "Cross-Link Funnel — LinkShield" },
      { name: "description", content: "Compare impressions, real clicks, and conversions across your short links." },
      { property: "og:title", content: "Cross-Link Funnel — LinkShield" },
      { property: "og:description", content: "Compare impressions, real clicks, and conversions across your short links." },
      { property: "og:url", content: "https://sleepox.com/funnel" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/funnel" }],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: FunnelPage,
});

type Data = Awaited<ReturnType<typeof getCrossLinkFunnel>>;

function FunnelPage() {
  const navigate = useNavigate();
  const fetchFunnel = useServerFn(getCrossLinkFunnel);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [from, setFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [sortBy, setSortBy] = useState<
    "impressions" | "realClicks" | "conversions" | "conversionRate"
  >("impressions");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchFunnel({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      setData(res);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [from, to]);

  // Realtime: subscribe to all new clicks and debounce-refetch.
  useEffect(() => {
    const channel = supabase
      .channel("cross-funnel-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clicks" }, () => {
        setPulse((p) => p + 1);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(() => void load(true), 800);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line
  }, [from, to]);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  }, [data, sortBy]);

  const chartData = useMemo(
    () =>
      rows.slice(0, 12).map((r) => ({
        name: r.title || `/r/${r.short_code}`,
        Impressions: r.impressions,
        "Real clicks": r.realClicks,
        Conversions: r.conversions,
      })),
    [rows],
  );

  const t = data?.totals;
  const overallCtr = t && t.impressions ? (t.realClicks / t.impressions) * 100 : 0;
  const overallConv = t && t.impressions ? (t.conversions / t.impressions) * 100 : 0;
  const dropOff = t && t.impressions ? ((t.impressions - t.conversions) / t.impressions) * 100 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="font-bold tracking-tight text-lg">Cross-Link Funnel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value="custom"
              onValueChange={(v) => {
                const now = new Date();
                now.setHours(23, 59, 59, 999);
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                if (v === "1") start.setDate(start.getDate() - 1);
                else if (v === "7") start.setDate(start.getDate() - 7);
                else if (v === "14") start.setDate(start.getDate() - 14);
                else if (v === "30") start.setDate(start.getDate() - 30);
                else if (v === "90") start.setDate(start.getDate() - 90);
                setFrom(start);
                setTo(now);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-[130px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(from, "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={from}
                  onSelect={(d) => d && setFrom(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-[130px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(to, "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={to}
                  onSelect={(d) => d && setTo(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border">
              <span
                className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`}
              />
              {live ? "Live" : "Offline"}
              {pulse > 0 && <span className="text-muted-foreground tabular-nums">· {pulse}</span>}
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Overall totals */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Kpi
            icon={<BarChart3 className="h-5 w-5" />}
            label="Links"
            value={data?.rows.length ?? 0}
          />
          <Kpi
            icon={<GitCompare className="h-5 w-5" />}
            label="Impressions"
            value={t?.impressions ?? 0}
          />
          <Kpi
            icon={<Target className="h-5 w-5" />}
            label="Real clicks"
            value={t?.realClicks ?? 0}
            accent="text-emerald-500"
          />
          <Kpi
            icon={<Target className="h-5 w-5" />}
            label="Conversions"
            value={t?.conversions ?? 0}
            accent="text-primary"
          />
          <Kpi
            icon={<TrendingDown className="h-5 w-5" />}
            label="Overall drop-off"
            value={`${dropOff.toFixed(1)}%`}
            accent="text-rose-500"
          />
        </div>

        {/* Overall funnel bars */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Overall funnel</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              CTR {overallCtr.toFixed(1)}% · Conv {overallConv.toFixed(1)}%
            </span>
          </div>
          <FunnelBars
            impressions={t?.impressions ?? 0}
            realClicks={t?.realClicks ?? 0}
            conversions={t?.conversions ?? 0}
          />
        </Card>

        {/* Comparison chart */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Per-link comparison (top 12 by impressions)</h2>
          </div>
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Impressions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Real clicks" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Conversions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data in this period yet
              </div>
            )}
          </div>
        </Card>

        {/* Detailed table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Per-link funnel breakdown</h2>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impressions">Sort: Impressions</SelectItem>
                <SelectItem value="realClicks">Sort: Real clicks</SelectItem>
                <SelectItem value="conversions">Sort: Conversions</SelectItem>
                <SelectItem value="conversionRate">Sort: Conv. rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Link</th>
                  <th className="text-left py-2 px-2">Destination</th>
                  <th className="text-right py-2 px-2">Impr.</th>
                  <th className="text-right py-2 px-2">Real clicks</th>
                  <th className="text-right py-2 px-2">Conv.</th>
                  <th className="text-right py-2 px-2">CTR</th>
                  <th className="text-right py-2 px-2">Conv. rate</th>
                  <th className="text-right py-2 px-2">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const drop = r.impressions
                    ? ((r.impressions - r.conversions) / r.impressions) * 100
                    : 0;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                      onClick={() =>
                        navigate({ to: "/analytics/$linkId", params: { linkId: r.id } })
                      }
                    >
                      <td className="py-2 px-2 font-mono text-primary underline-offset-2 hover:underline">
                        /r/{r.short_code}
                        {r.title && (
                          <span className="ml-2 text-xs text-muted-foreground">{r.title}</span>
                        )}
                      </td>
                      <td
                        className="py-2 px-2 max-w-xs truncate text-muted-foreground"
                        title={r.destination_url}
                      >
                        {r.destination_url}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.impressions}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-emerald-500">
                        {r.realClicks}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-primary">
                        {r.conversions}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {(r.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">
                        {(r.conversionRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-rose-500">
                        {drop.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      No links yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          <Link to="/analytics" className="hover:text-primary">
            ← Back to analytics
          </Link>
        </p>
      </main>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
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

function FunnelBars({
  impressions,
  realClicks,
  conversions,
}: {
  impressions: number;
  realClicks: number;
  conversions: number;
}) {
  const max = Math.max(impressions, 1);
  const stages = [
    { label: "Impressions", count: impressions, color: "bg-primary", pct: 100 },
    {
      label: "Real clicks",
      count: realClicks,
      color: "bg-emerald-500",
      pct: impressions ? (realClicks / impressions) * 100 : 0,
    },
    {
      label: "Conversions",
      count: conversions,
      color: "bg-amber-500",
      pct: impressions ? (conversions / impressions) * 100 : 0,
    },
  ];
  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {s.count} <span className="text-primary ml-1">({s.pct.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${s.color}`} style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
