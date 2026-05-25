import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Activity, Download, Globe2, Smartphone, Monitor, Tablet, HelpCircle, Zap, ShieldCheck, ShieldAlert, AlertTriangle, X, TrendingDown, Users } from "lucide-react";
import { ComposableMap, Geographies, Geography, Sphere, Graticule, Marker } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { getAnalyticsData, getCohortRetention, getLinkDrilldown } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Sleepox" }] }),
  component: AnalyticsPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function AnalyticsPage() {
  const fn = useServerFn(getAnalyticsData);
  const cohortFn = useServerFn(getCohortRetention);
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const cohortQ = useQuery({
    queryKey: ["cohort-retention"],
    queryFn: () => cohortFn(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const d = q.data;

  const maxSeries = useMemo(() => Math.max(1, ...(d?.series24h ?? [1])), [d]);
  const sparkPath = useMemo(() => {
    if (!d) return "";
    const pts = d.series24h.map((v, i) => {
      const x = (i / 23) * 1000;
      const y = 100 - (v / maxSeries) * 90;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [d, maxSeries]);

  if (q.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center p-6">
        <p className="text-[#5D4538] text-sm">Couldn't load analytics.</p>
        <p className="text-[#7D6452] text-xs max-w-md">{(q.error as Error)?.message ?? "Unknown error"}</p>
        <button onClick={() => q.refetch()} className="mt-2 px-4 py-2 rounded-xl bg-[#FF7E5F]/15 border border-[#FF7E5F]/40 text-[#FF7E5F] text-xs font-bold hover:bg-[#FF7E5F]/25 transition">
          Retry
        </button>
      </div>
    );
  }

  if (q.isLoading || !d) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#7D6452]">
        <Activity className="w-5 h-5 animate-pulse mr-2" /> Loading analytics…
      </div>
    );
  }


  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF7E5F]/80 font-bold mb-2">
            Real-time Command
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-[#2D1B0D] tracking-tight" style={display}>
            Advanced Analytics
          </h1>
          <p className="text-[#7D6452] text-sm mt-1">Live performance signals across all your smart links — last 7 days.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-white/80 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs text-emerald-600 font-bold tracking-wider uppercase">Live</span>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white text-sm font-bold shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </header>

      {/* HERO — Live ticker + total card */}
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 p-8 rounded-3xl bg-white/80 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)] relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#FF7E5F]/10 blur-[100px] rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-indigo-600/10 blur-[100px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 font-bold">Live Traffic</span>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <h2 className="text-6xl lg:text-7xl font-bold text-[#2D1B0D] tracking-tighter" style={display}>
                  {d.kpis.cps}
                </h2>
                <p className="text-[#7D6452] text-xs uppercase tracking-[0.25em] mt-2 font-bold">Clicks per second</p>
              </div>
              <div className="flex-1 min-w-[280px] h-24 relative">
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF7E5F" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#FF7E5F" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkPath} L 1000,100 L 0,100 Z`} fill="url(#aGrad)" />
                  <path d={sparkPath} fill="none" stroke="#FF7E5F" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/80">
              <Stat label="Last 24h" value={d.kpis.last24h.toLocaleString()} />
              <Stat label="Total (7d)" value={d.kpis.total.toLocaleString()} />
              <Stat label="Human rate" value={`${d.kpis.humanRate}%`} accent="emerald" />
              <Stat label="Sent to ads" value={(d.kpis.oursClicks ?? 0).toLocaleString()} accent="sky" />
              <Stat label="Active links" value={d.kpis.activeLinks.toString()} />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
          <MiniCard
            icon={<ShieldCheck className="w-5 h-5" />}
            label="Bot detection"
            value={d.kpis.total ? `${((d.kpis.bots / d.kpis.total) * 100).toFixed(2)}%` : "0%"}
            sub={`${d.kpis.bots.toLocaleString()} bots blocked`}
            tone="amber"
          />
          <MiniCard
            icon={<Zap className="w-5 h-5" />}
            label="Humans served"
            value={d.kpis.humans.toLocaleString()}
            sub={`${d.kpis.humanRate}% of total traffic`}
            tone="sky"
          />
        </div>
      </section>

      {/* Geo + Top countries */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 xl:col-span-7" title="World Map" right={<span className="text-[10px] text-[#7D6452] uppercase tracking-widest">Click intensity by country</span>}>
          <WorldMap topCountries={d.topCountries} />
        </Card>

        <Card className="col-span-12 xl:col-span-5" title="Top Countries">
          <div className="space-y-3">
            {d.topCountries.length === 0 && <Empty label="No clicks yet" />}
            {d.topCountries.map((c) => (
              <div key={c.code} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <Flag code={c.code} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#2D1B0D] font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-[#7D6452] uppercase tracking-wider font-mono">{c.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-[#2D1B0D]">{c.count.toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-[#FF7E5F]">{c.pct}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-[#FFEDD5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] rounded-full shadow-[0_0_6px_rgba(255,126,95,0.4)]"
                    style={{ width: `${Math.max(c.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Heatmap + live stream */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 xl:col-span-8" title="Click Velocity (7d × 24h, UTC)">
          <div className="space-y-1">
            {d.heatmap.map((row, di) => (
              <div key={di} className="flex items-center gap-2">
                <span className="w-8 text-[9px] text-[#8B7563] font-mono">
                  {dayLabel(6 - di)}
                </span>
                <div className="flex-1 grid grid-cols-24 gap-[3px]">
                  {row.map((v, hi) => {
                    const intensity = v / d.heatMax;
                    return (
                      <div
                        key={hi}
                        className="aspect-square rounded-[2px]"
                        style={{
                          backgroundColor:
                            v === 0
                              ? "rgba(45,27,13,0.05)"
                              : `rgba(255, 126, 95, ${0.18 + intensity * 0.82})`,
                          boxShadow: intensity > 0.7 ? "0 0 6px rgba(255,126,95,0.5)" : undefined,
                        }}
                        title={`${v} clicks @ ${hi}:00`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-between pl-10 pt-2 text-[9px] text-[#8B7563] font-mono">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-4" title="Live Event Stream">
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {d.liveEvents.length === 0 && <Empty label="Waiting for events…" />}
            {d.liveEvents.map((e, i) => {
              const color = e.isBot
                ? "border-amber-500/50 text-amber-600"
                : e.routed === "safe"
                ? "border-[#6366F1]/50 text-[#6366F1]"
                : "border-emerald-500/50 text-emerald-600";
              return (
                <div
                  key={e.id}
                  className={`flex items-center gap-2 text-xs border-l-2 ${color} pl-2 py-2 bg-white/60 rounded-r-md`}
                  style={{ opacity: 1 - i * 0.03 }}
                >
                  <span className="font-mono text-[10px] text-[#7D6452] w-14 shrink-0">
                    {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <Flag code={e.country} small />
                  <DeviceIcon name={e.device} />
                  <BrowserIcon slug={e.browserSlug} color={e.browserColor} title={e.browser} />
                  <span className="text-[#3D2818] truncate flex-1 text-[11px]">
                    {e.isBot ? "🛡 Bot blocked" : e.routed === "safe" ? "↪ Safe redirect" : "✓ Offer click"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Devices + Browsers + OS */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Devices">
          <div className="flex items-center justify-center mb-6">
            <Donut
              data={d.devices.map((dv, i) => ({
                value: dv.count,
                color: ["#FF7E5F", "#FEB47B", "#F59E0B", "#A38D7D"][i % 4],
              }))}
              centerLabel={d.devices[0]?.name ?? "—"}
              centerValue={`${d.devices[0]?.pct ?? 0}%`}
            />
          </div>
          <div className="space-y-2.5">
            {d.devices.length === 0 && <Empty label="No device data" />}
            {d.devices.map((dv, i) => (
              <div key={dv.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2.5 text-[#3D2818]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ["#FF7E5F", "#FEB47B", "#F59E0B", "#A38D7D"][i % 4] }}
                  />
                  <DeviceIcon name={dv.name} />
                  <span className="font-medium">{dv.name}</span>
                </span>
                <span className="font-mono text-[#7D6452]">{dv.count.toLocaleString()} · {dv.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Browsers">
          <div className="space-y-3">
            {d.browsers.length === 0 && <Empty label="No browser data" />}
            {d.browsers.map((b) => (
              <div key={b.name} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <BrowserIcon slug={b.slug} color={b.color} title={b.name} large />
                  <div className="flex-1">
                    <p className="text-sm text-[#2D1B0D] font-medium">{b.name}</p>
                  </div>
                  <span className="font-mono text-xs text-[#7D6452]">{b.count.toLocaleString()} · {b.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#FFEDD5] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(b.pct, 2)}%`, background: `linear-gradient(90deg, #${b.color}, #${b.color}88)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-4" title="Operating Systems">
          <div className="space-y-3">
            {d.operatingSystems.length === 0 && <Empty label="No OS data" />}
            {d.operatingSystems.map((o) => (
              <div key={o.name} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <BrowserIcon slug={o.slug} color="94a3b8" title={o.name} large />
                  <div className="flex-1">
                    <p className="text-sm text-[#2D1B0D] font-medium">{o.name}</p>
                  </div>
                  <span className="font-mono text-xs text-[#7D6452]">{o.count.toLocaleString()} · {o.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#FFEDD5] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-slate-300 to-slate-500 rounded-full" style={{ width: `${Math.max(o.pct, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Bot Reasons + Top Links */}
      <section className="grid grid-cols-12 gap-6 pb-10">
        <Card
          className="col-span-12 xl:col-span-5"
          title="Bot Detection Breakdown"
          right={<span className="text-[10px] text-amber-600/80 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Protected</span>}
        >
          <div className="space-y-3">
            {d.botReasons.length === 0 && <Empty label="No bot traffic detected — clean!" />}
            {d.botReasons.map((r) => (
              <div key={r.name} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-sm text-[#3D2818] font-medium flex-1">{r.name}</p>
                  <span className="font-mono text-xs text-amber-600">{r.count.toLocaleString()}</span>
                  <span className="font-mono text-[10px] text-[#7D6452] w-12 text-right">{r.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#FFEDD5] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${Math.max(r.pct, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-7" title="Top Performing Links">
          <div className="space-y-3">
            {d.topLinks.length === 0 && <Empty label="No link data yet" />}
            {d.topLinks.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setDrilldownId(l.id)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#FFEDD5] hover:border-[#FF7E5F]/60 hover:bg-white/90 hover:shadow-md transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#2D1B0D] truncate font-mono">/{l.code}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#7D6452] truncate">
                    {l.title ?? "Untitled link"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-emerald-600 font-mono">
                    {(l.humans >= 5000 ? "5,000+" : l.humans.toLocaleString())} ✓
                  </p>
                  <p className="text-[10px] text-amber-600 font-mono">{l.bots.toLocaleString()} 🛡</p>
                </div>
                <div className="text-right shrink-0 min-w-[58px]">
                  <p className={`text-sm font-bold font-mono ${l.health >= 70 ? "text-emerald-600" : l.health >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                    {l.health}%
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-[#7D6452]">Drill →</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Traffic Sources — quality per cohort */}
      <section className="grid grid-cols-12 gap-6 pb-10">
        <Card className="col-span-12" title="Traffic Sources" right={<span className="text-[10px] text-[#7D6452] uppercase tracking-widest">Quality = human / total</span>}>
          {d.trafficSources.length === 0 ? <Empty label="No traffic yet — share a link to see sources" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {d.trafficSources.map((s) => (
                <div key={s.key} className="group p-4 rounded-2xl bg-white/70 border border-[#FFEDD5] hover:border-[#FF7E5F]/40 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#FFEDD5] flex items-center justify-center shadow-sm">
                      <BrowserIcon slug={s.slug} color={s.color} title={s.name} large />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#2D1B0D] truncate">{s.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#7D6452]">{s.pct}% share</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.quality >= 80 ? "bg-emerald-500/15 text-emerald-700" : s.quality >= 50 ? "bg-amber-500/15 text-amber-700" : "bg-rose-500/15 text-rose-700"}`}>
                      {s.quality}%
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-[#5D4538]">
                    <span><span className="text-emerald-600">✓</span> {s.humans.toLocaleString()}</span>
                    <span><span className="text-amber-600">🛡</span> {s.bots.toLocaleString()}</span>
                    <span className="text-[#2D1B0D] font-bold">{s.total.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 mt-2 bg-[#FFEDD5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B]" style={{ width: `${Math.max(s.pct, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Conversion Funnel */}
      <section className="grid grid-cols-12 gap-6 pb-2">
        <Card className="col-span-12" title="Conversion Funnel" right={<span className="text-[10px] text-[#7D6452] uppercase tracking-widest flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Click → Landing</span>}>
          <Funnel stages={d.funnel} />
        </Card>
      </section>

      {/* Cohort Retention */}
      <section className="grid grid-cols-12 gap-6 pb-10">
        <Card className="col-span-12" title="Cohort Retention" right={<span className="text-[10px] text-[#7D6452] uppercase tracking-widest flex items-center gap-1"><Users className="w-3 h-3" /> Returning visitors by first-seen day</span>}>
          <CohortGrid loading={cohortQ.isLoading} rows={cohortQ.data?.rows ?? []} />
        </Card>
      </section>

      {drilldownId && <DrilldownModal linkId={drilldownId} onClose={() => setDrilldownId(null)} />}
    </div>
  );
}

/* ---- helpers ---- */

function Card({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-6 rounded-3xl bg-white/80 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)] ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] tracking-wide" style={display}>
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "sky" }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "sky" ? "text-[#FF7E5F]" : "text-[#2D1B0D]";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B7563] font-bold mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function MiniCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "amber" | "sky";
}) {
  const toneClasses = tone === "amber"
    ? "from-amber-500/20 to-orange-500/10 text-amber-600 border-amber-400/40"
    : "from-[#FF7E5F]/15 to-[#FEB47B]/10 text-[#FF7E5F] border-[#FF7E5F]/30";
  return (
    <div className="p-6 rounded-3xl bg-white/80 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)]">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${toneClasses} border text-[10px] uppercase tracking-[0.2em] font-bold mb-4`}>
        {icon}
        {label}
      </div>
      <p className="text-3xl font-bold text-[#2D1B0D] font-mono" style={display}>{value}</p>
      <p className="text-xs text-[#7D6452] mt-1">{sub}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-[#8B7563] italic">{label}</p>;
}

function dayLabel(daysAgo: number) {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yest";
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toLocaleDateString([], { weekday: "short" });
}

function Donut({
  data, centerLabel, centerValue,
}: {
  data: { value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = Math.max(1, data.reduce((s, x) => s + x.value, 0));
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(45,27,13,0.08)" strokeWidth="14" />
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const seg = (
            <circle
              key={i}
              cx="70" cy="70" r={R}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xl font-bold text-[#2D1B0D]">{centerValue}</p>
        <p className="text-[9px] uppercase tracking-widest text-[#7D6452] font-bold">{centerLabel}</p>
      </div>
    </div>
  );
}

/* ---- Country flag (flagcdn.com — free, no install) ---- */
function Flag({ code, small = false }: { code: string; small?: boolean }) {
  const lower = code.toLowerCase();
  const size = small ? "w-5 h-3.5" : "w-7 h-5";
  if (!code || code === "??" || code.length !== 2) {
    return <span className={`${size} inline-flex items-center justify-center bg-white/70 rounded-[2px] text-[#7D6452] text-[8px]`}>?</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      alt={code}
      className={`${size} object-cover rounded-[2px] shadow-sm shrink-0`}
      loading="lazy"
    />
  );
}

/* ---- Device icon — uses real brand logos (Android, Apple, Windows...) ---- */
function DeviceIcon({ name, os, large = false }: { name: string; os?: string; large?: boolean }) {
  const size = large ? "w-5 h-5" : "w-3.5 h-3.5";
  const o = (os ?? "").toLowerCase();
  if (o.includes("android")) return <img src="https://cdn.simpleicons.org/android/3DDC84" alt="Android" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("ios") || o.includes("ipad") || o.includes("iphone")) return <img src="https://cdn.simpleicons.org/apple/000000" alt="iOS" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("mac")) return <img src="https://cdn.simpleicons.org/apple/000000" alt="macOS" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("windows")) return <img src="https://cdn.simpleicons.org/windows11/0078D4" alt="Windows" className={`${size} shrink-0`} loading="lazy" />;
  if (o.includes("linux")) return <img src="https://cdn.simpleicons.org/linux/000000" alt="Linux" className={`${size} shrink-0`} loading="lazy" />;
  const n = name.toLowerCase();
  const cls = `${size} text-[#7D6452] shrink-0`;
  if (n === "mobile") return <Smartphone className={cls} />;
  if (n === "tablet") return <Tablet className={cls} />;
  if (n === "desktop") return <Monitor className={cls} />;
  return <HelpCircle className={cls} />;
}


/* ---- Browser/OS brand icon (simpleicons CDN — free SVG, brand color) ---- */
function BrowserIcon({ slug, color, title, large = false }: { slug: string; color: string; title: string; large?: boolean }) {
  const size = large ? "w-6 h-6" : "w-4 h-4";
  if (!slug || slug === "unknown") {
    return <span className={`${size} inline-flex items-center justify-center bg-white/70 rounded text-[#7D6452] text-[10px] shrink-0`} title={title}>?</span>;
  }
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/${color}`}
      alt={title}
      title={title}
      className={`${size} shrink-0`}
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

/* ---- Conversion Funnel ---- */
function Funnel({ stages }: { stages: Array<{ stage: string; value: number; pct: number; color: string }> }) {
  if (!stages.length || stages[0].value === 0) return <Empty label="No traffic yet to build a funnel" />;
  const max = stages[0].value || 1;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const widthPct = Math.max(8, (s.value / max) * 100);
        const dropoff = i > 0 ? stages[i - 1].value - s.value : 0;
        const dropPct = i > 0 && stages[i - 1].value ? Math.round((dropoff / stages[i - 1].value) * 1000) / 10 : 0;
        return (
          <div key={s.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center text-[10px] font-bold" style={{ borderColor: s.color, color: s.color }}>{i + 1}</span>
                <span className="font-bold text-[#2D1B0D] text-sm" style={display}>{s.stage}</span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-[#2D1B0D] font-bold">{s.value.toLocaleString()}</span>
                <span className="text-[#7D6452]">{s.pct}%</span>
                {i > 0 && dropoff > 0 && (
                  <span className="text-rose-600 text-[10px]">▼ {dropPct}%</span>
                )}
              </div>
            </div>
            <div className="relative h-9 rounded-xl bg-[#FFF5EE] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-xl flex items-center justify-end pr-3 text-white text-xs font-bold shadow-md transition-all"
                style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)` }}
              >
                {widthPct > 18 && <span className="opacity-90">{s.pct}%</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Cohort Retention Grid ---- */
function CohortGrid({ rows, loading }: { rows: Array<{ day: string; size: number; d1: number; d7: number; d30: number }>; loading: boolean }) {
  if (loading) return <p className="text-xs text-[#7D6452]">Loading cohorts…</p>;
  if (!rows.length || rows.every(r => r.size === 0)) return <Empty label="Not enough returning visitors yet — needs at least a few days of traffic" />;
  const cell = (pct: number) => {
    if (pct === 0) return "rgba(45,27,13,0.04)";
    const a = 0.15 + (pct / 100) * 0.7;
    return `rgba(255,126,95,${a})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-[#7D6452]">
            <th className="py-2 pr-3 font-bold">First seen</th>
            <th className="py-2 pr-3 font-bold">Cohort size</th>
            <th className="py-2 px-2 font-bold text-center">Day 1</th>
            <th className="py-2 px-2 font-bold text-center">Day 7</th>
            <th className="py-2 px-2 font-bold text-center">Day 30</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className="border-t border-[#FFEDD5]">
              <td className="py-2 pr-3 font-mono text-[#3D2818]">{r.day}</td>
              <td className="py-2 pr-3 font-mono text-[#2D1B0D] font-bold">{r.size.toLocaleString()}</td>
              {[r.d1, r.d7, r.d30].map((v, i) => (
                <td key={i} className="py-1 px-2">
                  <div className="rounded-md text-center font-mono font-bold text-[11px] py-1.5 text-[#2D1B0D]" style={{ backgroundColor: cell(v) }}>
                    {r.size ? `${v}%` : "—"}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Real SVG World Map (react-simple-maps + d3-style choropleth) ---- */
const WORLD_TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO-2 → numeric ID used by world-atlas
const ISO2_TO_ID: Record<string, string> = {
  US:"840",GB:"826",DE:"276",FR:"250",CA:"124",IN:"356",BD:"050",PK:"586",JP:"392",CN:"156",
  BR:"076",AU:"036",NL:"528",IT:"380",ES:"724",MX:"484",RU:"643",ID:"360",PH:"608",NG:"566",
  ZA:"710",SE:"752",PL:"616",TR:"792",KR:"410",VN:"704",AE:"784",SA:"682",EG:"818",AR:"032",
  CO:"170",CL:"152",TH:"764",MY:"458",SG:"702",CH:"756",BE:"056",AT:"040",PT:"620",IE:"372",
  NO:"578",DK:"208",FI:"246",NZ:"554",
};

function WorldMap({ topCountries }: { topCountries: Array<{ code: string; name: string; count: number; pct: number }> }) {
  const max = Math.max(1, ...topCountries.map(c => c.count));
  const lookup = new Map<string, { name: string; count: number; pct: number; code: string }>();
  topCountries.forEach(c => {
    const id = ISO2_TO_ID[c.code];
    if (id) lookup.set(id, { name: c.name, count: c.count, pct: c.pct, code: c.code });
  });
  const colorFor = (count: number) => {
    if (!count) return "#FFE4D2";
    const t = Math.min(1, Math.pow(count / max, 0.6));
    const g = Math.round(180 - t * 110);
    const b = Math.round(140 - t * 90);
    return `rgb(255,${g},${b})`;
  };

  return (
    <div className="relative h-[420px] rounded-2xl overflow-hidden border border-[#FFD9BE]
      bg-[radial-gradient(ellipse_at_top_left,_#FFFBF7_0%,_#FFE9D6_60%,_#FFD4B5_100%)]
      shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_30px_-12px_rgba(255,126,95,0.25)]">
      <div className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,126,95,0.13) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <ComposableMap
        projectionConfig={{ scale: 165, center: [10, 12] }}
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="dotGlow">
            <stop offset="0%" stopColor="#FF4E2B" stopOpacity="1" />
            <stop offset="60%" stopColor="#FF7E5F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF7E5F" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Sphere id="sphere" fill="transparent" stroke="rgba(255,126,95,0.2)" strokeWidth={0.6} />
        <Graticule stroke="rgba(255,126,95,0.1)" strokeWidth={0.4} />

        <Geographies geography={WORLD_TOPO}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const hit = lookup.get(geo.id);
              const isActive = !!hit;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={colorFor(hit?.count ?? 0)}
                  stroke={isActive ? "#FFFFFF" : "#FFC9A8"}
                  strokeWidth={isActive ? 0.7 : 0.45}
                  style={{
                    default: { outline: "none", transition: "fill 200ms" },
                    hover: { outline: "none", fill: "#FF4E2B", cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                >
                  <title>
                    {hit ? `${hit.name} (${hit.code}) — ${hit.count.toLocaleString()} clicks · ${hit.pct}%` : geo.properties?.name}
                  </title>
                </Geography>
              );
            })
          }
        </Geographies>

        <Geographies geography={WORLD_TOPO}>
          {({ geographies }: { geographies: any[] }) =>
            geographies
              .filter((geo) => lookup.has(geo.id))
              .map((geo) => {
                const hit = lookup.get(geo.id)!;
                const [cx, cy] = geoCentroid(geo);
                const r = 3 + Math.min(1, hit.count / max) * 8;
                return (
                  <Marker key={`m-${geo.rsmKey}`} coordinates={[cx, cy]}>
                    <circle r={r * 2.2} fill="url(#dotGlow)" filter="url(#mapGlow)" />
                    <circle r={r} fill="#FF4E2B" stroke="#FFFFFF" strokeWidth={1.4} />
                  </Marker>
                );
              })
          }
        </Geographies>
      </ComposableMap>

      <div className="absolute bottom-3 left-4 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full
        bg-white/95 backdrop-blur border border-[#FFE4D2] shadow-[0_4px_12px_-4px_rgba(255,126,95,0.3)]">
        <Globe2 className="w-3.5 h-3.5 text-[#FF4E2B]" />
        <span className="text-[10px] font-bold text-[#2D1B0D] uppercase tracking-[0.18em]">
          {topCountries.length} countries
        </span>
        <span className="ml-1.5 flex items-center gap-[3px]">
          {[0.18, 0.4, 0.65, 0.9, 1].map((t, i) => (
            <span key={i} className="w-3 h-2 rounded-[2px]"
              style={{ background: colorFor(Math.round(max * t)) }} />
          ))}
        </span>
        <span className="text-[9px] text-[#7D6452] font-mono uppercase tracking-wider">low → high</span>
      </div>

      <div className="absolute top-3 right-4 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur
        border border-[#FFE4D2] shadow-sm flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF4E2B] animate-pulse" />
        <span className="text-[10px] font-mono text-[#2D1B0D] tracking-wider">
          {topCountries.reduce((s, c) => s + c.count, 0).toLocaleString()} CLICKS
        </span>
      </div>
    </div>
  );
}

/* ---- Per-link Drill-down Modal ---- */
function DrilldownModal({ linkId, onClose }: { linkId: string; onClose: () => void }) {
  const fn = useServerFn(getLinkDrilldown);
  const q = useQuery({
    queryKey: ["drilldown", linkId],
    queryFn: () => fn({ data: { linkId } }),
    staleTime: 30_000,
  });
  const d = q.data;
  const maxS = Math.max(1, ...(d?.series ?? [1]));
  const path = useMemo(() => {
    if (!d) return "";
    const pts = d.series.map((v, i) => {
      const x = (i / 23) * 1000;
      const y = 100 - (v / maxS) * 90;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [d, maxS]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D1B0D]/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-[#FFFBF7] to-[#FFF1E6] border border-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-[#FFEDD5] bg-white/85 backdrop-blur-xl rounded-t-3xl">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF7E5F] font-bold">Link Drill-down · Last 24h</p>
            <h2 className="text-xl font-bold text-[#2D1B0D] font-mono mt-1" style={display}>
              {q.isLoading ? "Loading…" : d ? `/${d.link.code}` : "—"}
            </h2>
            {d?.link.title && <p className="text-xs text-[#7D6452] mt-0.5">{d.link.title}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border border-[#FFEDD5] flex items-center justify-center hover:bg-[#FF7E5F]/10 hover:border-[#FF7E5F]/40 transition">
            <X className="w-4 h-4 text-[#5D4538]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {q.isError && <p className="text-rose-600 text-sm">Couldn't load: {(q.error as Error).message}</p>}
          {!d && !q.isError && <p className="text-[#7D6452] text-sm">Loading data…</p>}
          {d && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPIBox label="Clicks 24h" value={d.kpis24h.total.toLocaleString()} />
                <KPIBox label="Humans" value={d.kpis24h.humans.toLocaleString()} accent="emerald" />
                <KPIBox label="Bots blocked" value={d.kpis24h.bots.toLocaleString()} accent="amber" />
                <KPIBox label="Human rate" value={`${d.kpis24h.humanRate}%`} accent="orange" />
              </div>

              {/* 24h sparkline */}
              <div className="p-5 rounded-2xl bg-white/85 border border-[#FFEDD5]">
                <p className="text-[10px] uppercase tracking-widest text-[#7D6452] font-bold mb-3">24h Click Velocity (humans, hourly)</p>
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-24">
                  <defs>
                    <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF7E5F" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#FF7E5F" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${path} L 1000,100 L 0,100 Z`} fill="url(#dGrad)" />
                  <path d={path} fill="none" stroke="#FF7E5F" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div className="flex justify-between mt-1 text-[9px] text-[#8B7563] font-mono">
                  <span>-24h</span><span>-18h</span><span>-12h</span><span>-6h</span><span>now</span>
                </div>
              </div>

              {/* Top countries + browsers side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/85 border border-[#FFEDD5]">
                  <p className="text-[10px] uppercase tracking-widest text-[#7D6452] font-bold mb-3">Top Countries (24h)</p>
                  {d.countries.length === 0 ? <Empty label="No data" /> : (
                    <div className="space-y-2">
                      {d.countries.map((c) => (
                        <div key={c.code} className="flex items-center gap-3">
                          <Flag code={c.code} />
                          <span className="text-xs text-[#3D2818] truncate flex-1">{c.name}</span>
                          <span className="text-xs font-mono text-[#2D1B0D] font-bold">{c.count}</span>
                          <span className="text-[10px] font-mono text-[#FF7E5F] w-12 text-right">{c.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-5 rounded-2xl bg-white/85 border border-[#FFEDD5]">
                  <p className="text-[10px] uppercase tracking-widest text-[#7D6452] font-bold mb-3">Top Browsers (24h)</p>
                  {d.browsers.length === 0 ? <Empty label="No data" /> : (
                    <div className="space-y-2.5">
                      {d.browsers.map((b) => (
                        <div key={b.name} className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <BrowserIcon slug={b.slug} color={b.color} title={b.name} large />
                            <span className="text-xs text-[#3D2818] flex-1">{b.name}</span>
                            <span className="text-xs font-mono text-[#7D6452]">{b.count} · {b.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-[#FFEDD5] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(b.pct, 2)}%`, background: `linear-gradient(90deg, #${b.color}, #${b.color}aa)` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KPIBox({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" | "orange" }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "amber" ? "text-amber-600" : accent === "orange" ? "text-[#FF7E5F]" : "text-[#2D1B0D]";
  return (
    <div className="p-4 rounded-2xl bg-white/85 border border-[#FFEDD5]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#7D6452] font-bold mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
