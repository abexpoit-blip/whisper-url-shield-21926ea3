import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield,
  ArrowLeft,
  Eye,
  Users,
  Bot,
  Target,
  AlertTriangle,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  RefreshCw,
  Copy,
  ExternalLink,
  Fingerprint,
  Megaphone,
  Radio,
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
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getLinkMonitor } from "@/lib/link-monitor.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ALLOWED_DAYS = [1, 7, 14, 30, 90] as const;
const RANGE_TO_DAYS = { day: 1, week: 7, month: 30 } as const;
type LinkSearch = { days: number };

export const Route = createFileRoute("/analytics/$linkId")({
  validateSearch: (s: Record<string, unknown>): LinkSearch => {
    let days = 7;
    const d = s.days;
    const r = s.range;
    if (typeof d === "number" && (ALLOWED_DAYS as readonly number[]).includes(d)) days = d;
    else if (typeof d === "string" && /^\d+$/.test(d)) {
      const n = Number(d);
      if ((ALLOWED_DAYS as readonly number[]).includes(n)) days = n;
    } else if (typeof r === "string" && r in RANGE_TO_DAYS) {
      days = RANGE_TO_DAYS[r as keyof typeof RANGE_TO_DAYS];
    }
    return { days };
  },
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: LinkMonitorPage,
});

type Data = Awaited<ReturnType<typeof getLinkMonitor>>;

function LinkMonitorPage() {
  const { linkId } = Route.useParams();
  const navigate = useNavigate();
  const fetchMonitor = useServerFn(getLinkMonitor);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchMonitor({ data: { linkId, days } });
      setData(res);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [days, linkId]);

  // Realtime: subscribe to new clicks for this link and debounce-refetch.
  useEffect(() => {
    const channel = supabase
      .channel(`clicks-live-${linkId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clicks", filter: `link_id=eq.${linkId}` },
        () => {
          setPulse((p) => p + 1);
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => void load(true), 800);
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line
  }, [linkId, days]);

  const t = data?.totals;
  const shortUrl = data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${data.link.short_code}`
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <div className="font-bold tracking-tight text-lg leading-tight">Link Monitor</div>
              <div className="text-xs text-muted-foreground font-mono">
                /r/{data?.link.short_code ?? "…"}
              </div>
            </div>
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
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/analytics" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> All links
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Link summary */}
        {data && (
          <Card className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {data.link.title || data.link.short_code}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono text-primary truncate">{shortUrl}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(shortUrl);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                → {data.link.destination_url}
                <a
                  href={data.link.destination_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex ml-2 text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Status:{" "}
              <span className="text-foreground font-semibold uppercase">{data.link.status}</span>
              <span className="mx-2">·</span>
              Created {new Date(data.link.created_at).toLocaleDateString()}
            </div>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            icon={<Eye className="h-5 w-5" />}
            label="Impressions"
            value={t?.impressions ?? 0}
            accent="text-foreground"
          />
          <KpiCard
            icon={<Users className="h-5 w-5" />}
            label="Real Clicks"
            value={t?.humans ?? 0}
            accent="text-emerald-500"
          />
          <KpiCard
            icon={<Bot className="h-5 w-5" />}
            label="Bots"
            value={t?.bots ?? 0}
            accent="text-rose-500"
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Bot Rate"
            value={`${Math.round((t?.botRate ?? 0) * 1000) / 10}%`}
            accent="text-amber-500"
          />
          <KpiCard
            icon={<Target className="h-5 w-5" />}
            label="Conversion"
            value={`${Math.round((t?.conversionRate ?? 0) * 1000) / 10}%`}
            accent="text-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <Fingerprint className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Unique human IPs</div>
              <div className="text-xl font-bold">{t?.uniqHumanIps ?? 0}</div>
            </div>
          </Card>
        </div>

        {/* Timeseries */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Impressions vs real clicks over time</h2>
          </div>
          <div className="h-72">
            {data && data.timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeseries}>
                  <defs>
                    <linearGradient id="imp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="impressions"
                    stroke="hsl(var(--primary))"
                    fill="url(#imp)"
                    name="Impressions"
                  />
                  <Area
                    type="monotone"
                    dataKey="humans"
                    stroke="#22c55e"
                    fill="url(#hh)"
                    name="Real clicks"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rejection reasons */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h2 className="font-semibold">Rejection reasons</h2>
            </div>
            <div className="h-72">
              {data && data.rejectionReasons.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rejectionReasons} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty msg="No rejections yet — nice!" />
              )}
            </div>
          </Card>

          {/* Variant breakdown */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Pre-lander variant performance</h2>
            </div>
            <BreakdownTable rows={data?.byVariant ?? []} showConversion />
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Countries</h2>
            </div>
            <BreakdownTable rows={data?.byCountry ?? []} />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Devices</h2>
            </div>
            <BreakdownTable rows={data?.byDevice ?? []} />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Browsers</h2>
            </div>
            <BreakdownTable rows={data?.byBrowser ?? []} />
          </Card>
        </div>

        {/* Funnel: Impressions → Real clicks → Conversions */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Conversion funnel</h2>
            </div>
            <div className="text-xs text-muted-foreground">
              Impression → Real click → Conversion
            </div>
          </div>

          {/* Overall funnel bars */}
          <div className="space-y-3 mb-6">
            {(data?.overallFunnel ?? []).map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{s.stage}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.count.toLocaleString()}{" "}
                    <span className="text-primary">({s.pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${i === 0 ? "bg-primary" : i === 1 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.max(s.pct, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Per-source funnel chart */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Per-source funnel
            </h3>
            {data && data.sourceFunnel.length > 0 ? (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sourceFunnel}
                      margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="source"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="impressions"
                        name="Impressions"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="realClicks"
                        name="Real clicks"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="conversions"
                        name="Conversions"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Per-source conversion rate table */}
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2">Source</th>
                        <th className="text-right py-2 px-2">Impr.</th>
                        <th className="text-right py-2 px-2">Real clicks</th>
                        <th className="text-right py-2 px-2">Conv.</th>
                        <th className="text-right py-2 px-2">CTR</th>
                        <th className="text-right py-2 px-2">Conv. rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sourceFunnel.map((r) => (
                        <tr key={r.source} className="border-b border-border/50">
                          <td
                            className="py-2 px-2 font-medium truncate max-w-[10rem]"
                            title={r.source}
                          >
                            {r.source}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {r.impressions.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-emerald-500">
                            {r.realClicks.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-amber-500">
                            {r.conversions.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {(r.ctr * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-semibold text-primary">
                            {(r.conversionRate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Empty msg="Tag your links with ?utm_source=… to see per-source funnels." />
            )}
          </div>
        </Card>

        {/* Source attribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Top ad sources (utm_source)</h2>
            </div>
            <BreakdownTable
              rows={data?.bySource ?? []}
              showConversion
              emptyMsg="No tagged sources yet. Add ?utm_source=facebook to your links."
            />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Top campaigns (utm_campaign)</h2>
            </div>
            <BreakdownTable
              rows={data?.byCampaign ?? []}
              showConversion
              emptyMsg="No campaign tags detected."
            />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Mediums (utm_medium)</h2>
            </div>
            <BreakdownTable rows={data?.byMedium ?? []} showConversion emptyMsg="No medium tags." />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Referrer hosts</h2>
            </div>
            <BreakdownTable
              rows={data?.byReferer ?? []}
              showConversion
              emptyMsg="Direct traffic only."
            />
          </Card>
        </div>

        {/* Recent events */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Latest visitors</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`}
              />
              {live ? "Live updates on" : "Connecting…"}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">When</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Source</th>
                  <th className="text-left py-2 px-2">Campaign</th>
                  <th className="text-left py-2 px-2">Referrer</th>
                  <th className="text-left py-2 px-2">Country</th>
                  <th className="text-left py-2 px-2">Device</th>
                  <th className="text-left py-2 px-2">Variant</th>
                  <th className="text-left py-2 px-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 animate-in fade-in">
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-2">
                      {r.is_bot ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 text-xs">
                          BOT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-xs">
                          HUMAN
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs">{r.utm_source ?? "—"}</td>
                    <td className="py-2 px-2 text-xs">{r.utm_campaign ?? "—"}</td>
                    <td
                      className="py-2 px-2 text-xs text-muted-foreground max-w-[12rem] truncate"
                      title={r.referer_host ?? ""}
                    >
                      {r.referer_host ?? "—"}
                    </td>
                    <td className="py-2 px-2">{r.country ?? "—"}</td>
                    <td className="py-2 px-2">{r.device ?? "—"}</td>
                    <td className="py-2 px-2 text-xs">{r.variant ?? "—"}</td>
                    <td className="py-2 px-2 font-mono text-xs">{r.ip ?? "—"}</td>
                  </tr>
                ))}
                {!data?.recent.length && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-muted-foreground">
                      No clicks in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          <Link to="/analytics" className="hover:text-primary">
            ← Back to all analytics
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

function Empty({ msg }: { msg?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      {msg ?? "No data in this period yet"}
    </div>
  );
}

function BreakdownTable({
  rows,
  showConversion,
  emptyMsg,
}: {
  rows: { key: string; total: number; humans: number; bots: number }[];
  showConversion?: boolean;
  emptyMsg?: string;
}) {
  if (!rows.length) return <Empty msg={emptyMsg} />;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{r.key}</span>
            <span className="text-muted-foreground tabular-nums">
              {r.total} <span className="text-emerald-500">{r.humans}</span>
              {" / "}
              <span className="text-rose-500">{r.bots}</span>
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
