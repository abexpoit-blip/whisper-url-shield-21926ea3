import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFbAdQuality } from "@/lib/analytics.functions";
import { withFreshServerFnAuth } from "@/lib/supabase-retry";
import { requireClientUser } from "@/lib/auth-guard";
import { CountryFlag, COUNTRY_NAMES } from "@/components/brand-icons";

type Search = { days: number; linkId: string };
const ALLOWED_DAYS = [1, 7, 14, 30] as const;

export const Route = createFileRoute("/fb-quality")({
  head: () => ({
    meta: [
      { title: "FB Ad Quality Score — LinkShield" },
      { name: "description", content: "Quality score for your Facebook ad traffic per hour, GEO, and device." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => {
    let days = 7;
    const d = s.days;
    if (typeof d === "number" && (ALLOWED_DAYS as readonly number[]).includes(d)) days = d;
    else if (typeof d === "string" && /^\d+$/.test(d)) {
      const n = Number(d);
      if ((ALLOWED_DAYS as readonly number[]).includes(n)) days = n;
    }
    const linkId = typeof s.linkId === "string" && s.linkId.length ? s.linkId : "all";
    return { days, linkId };
  },
  beforeLoad: ({ location }) => requireClientUser(location.href),
  component: FbQualityPage,
});

type Data = Awaited<ReturnType<typeof getFbAdQuality>>;

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-rose-500";
}
function scoreBgHex(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#f43f5e";
}

function FbQualityPage() {
  const navigate = useNavigate();
  const fetchQuality = useServerFn(getFbAdQuality);
  const { days, linkId } = Route.useSearch();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const tzOffsetMinutes = useMemo(
    () => -new Date().getTimezoneOffset(), // local minus UTC (e.g. BD = +360)
    []
  );

  const setDays = (n: number) =>
    navigate({ to: "/fb-quality", search: (p: Search) => ({ ...p, days: n }), replace: true });
  const setLinkId = (id: string) =>
    navigate({ to: "/fb-quality", search: (p: Search) => ({ ...p, linkId: id }), replace: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await withFreshServerFnAuth(() =>
        fetchQuality({
          data: { days, linkId: linkId === "all" ? null : linkId, tzOffsetMinutes },
        }),
      );
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [days, linkId]);

  const s = data?.summary;
  const overallScore = s?.score ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-gradient-to-b from-card/60 to-card/20 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="font-bold tracking-tight text-lg">FB Ad Quality Score</h1>
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/30">
              Local time {tzOffsetMinutes >= 0 ? "+" : ""}
              {(tzOffsetMinutes / 60).toFixed(1)}h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All links" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All links</SelectItem>
                {data?.links.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.title || l.short_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/analytics", search: { days, linkId } })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Analytics
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Overall score hero */}
        <Card className="p-8 bg-gradient-to-br from-card via-card to-primary/10 border-primary/20">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative flex items-center justify-center">
              <svg className="h-40 w-40 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.25 0.02 220)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={scoreBgHex(overallScore)} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(overallScore / 100) * 264} 264`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-5xl font-bold tabular-nums ${scoreColor(overallScore)}`}>{overallScore}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Quality</div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              <Stat label="Quality clicks" value={s?.quality ?? 0} hint="Real first-time" color="text-emerald-500" />
              <Stat label="Duplicate" value={s?.duplicate ?? 0} hint="Real, returning" color="text-cyan-500" />
              <Stat label="Wasted bots" value={s?.wasted ?? 0} hint="Malicious / scripts" color="text-rose-500" />
              <Stat label="FB crawlers" value={s?.crawler ?? 0} hint="Not charged" color="text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6 max-w-2xl">
            Quality score = (real first-time clicks + 50% of duplicate clicks) ÷ billable traffic. FB/Google/WhatsApp crawlers are excluded because they aren't charged. Higher score = FB is delivering high-intent users.
          </p>
        </Card>

        {/* Recommendations */}
        {data?.recommendations.length ? (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Recommendations</h2>
            </div>
            <ul className="space-y-2">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  {r.type === "good" && <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
                  {r.type === "bad" && <TrendingDown className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />}
                  {r.type === "info" && <Info className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />}
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* Hourly chart */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold">Quality by hour of day (local time)</h2>
            <span className="text-xs text-muted-foreground">— bar height = billable clicks, color = quality score</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byHour ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 220)" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}h`} stroke="oklch(0.6 0.02 220)" />
                <YAxis stroke="oklch(0.6 0.02 220)" />
                <Tooltip
                  contentStyle={{ background: "oklch(0.15 0.02 220)", border: "1px solid oklch(0.3 0.02 220)", borderRadius: 8 }}
                  formatter={(_v, _n, p) => {
                    const d = p.payload as { billable: number; score: number; quality: number; duplicate: number; wasted: number; crawler: number };
                    return [`${d.billable} clicks · score ${d.score}% · ✓${d.quality} ↺${d.duplicate} ✗${d.wasted} 🤖${d.crawler}`, "Hour"];
                  }}
                />
                <Bar dataKey="billable" radius={[4, 4, 0, 0]}>
                  {(data?.byHour ?? []).map((h, i) => (
                    <Cell key={i} fill={scoreBgHex(h.score)} opacity={h.billable === 0 ? 0.15 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Country + Device tables */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Quality by country</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">GEO</th>
                  <th className="text-right py-2">Billable</th>
                  <th className="text-right py-2">Wasted</th>
                  <th className="text-right py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byCountry ?? []).map((c) => (
                  <tr key={c.country} className="border-b border-border/40">
                    <td className="py-2 flex items-center gap-2">
                      <CountryFlag cc={c.country} />
                      <span>{COUNTRY_NAMES[c.country] || c.country}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.billable}</td>
                    <td className="py-2 text-right tabular-nums text-rose-500">{c.wasted}</td>
                    <td className={`py-2 text-right font-bold tabular-nums ${scoreColor(c.score)}`}>{c.score}%</td>
                  </tr>
                ))}
                {!data?.byCountry.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-4">Quality by device</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Device</th>
                  <th className="text-right py-2">Billable</th>
                  <th className="text-right py-2">Wasted</th>
                  <th className="text-right py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byDevice ?? []).map((d) => (
                  <tr key={d.device} className="border-b border-border/40">
                    <td className="py-2 capitalize">{d.device}</td>
                    <td className="py-2 text-right tabular-nums">{d.billable}</td>
                    <td className="py-2 text-right tabular-nums text-rose-500">{d.wasted}</td>
                    <td className={`py-2 text-right font-bold tabular-nums ${scoreColor(d.score)}`}>{d.score}%</td>
                  </tr>
                ))}
                {!data?.byDevice.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
