import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Activity, Download, Globe2, MonitorSmartphone, Zap, ShieldCheck } from "lucide-react";
import { getAnalyticsData } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Sleepox" }] }),
  component: AnalyticsPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function AnalyticsPage() {
  const fn = useServerFn(getAnalyticsData);
  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fn(),
    refetchInterval: 60_000, // 60s — was 15s, way too aggressive for high-traffic VPS
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
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
        <p className="text-white/70 text-sm">Couldn't load analytics.</p>
        <p className="text-white/40 text-xs max-w-md">{(q.error as Error)?.message ?? "Unknown error"}</p>
        <button onClick={() => q.refetch()} className="mt-2 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold hover:bg-sky-500/30 transition">
          Retry
        </button>
      </div>
    );
  }

  if (q.isLoading || !d) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        <Activity className="w-5 h-5 animate-pulse mr-2" /> Loading analytics…
      </div>
    );
  }


  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-sky-300/70 font-bold mb-2">
            Real-time Command
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight" style={display}>
            Advanced Analytics
          </h1>
          <p className="text-white/40 text-sm mt-1">Live performance signals across all your smart links — last 7 days.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs text-emerald-300 font-bold tracking-wider uppercase">Live</span>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-sky-500/30 hover:scale-[1.02] transition-transform">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </header>

      {/* HERO — Live ticker + total card */}
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-sky-500/10 blur-[100px] rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-indigo-600/10 blur-[100px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300 font-bold">Live Traffic</span>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <h2 className="text-6xl lg:text-7xl font-bold text-white tracking-tighter" style={display}>
                  {d.kpis.cps}
                </h2>
                <p className="text-white/40 text-xs uppercase tracking-[0.25em] mt-2 font-bold">Clicks per second</p>
              </div>
              <div className="flex-1 min-w-[280px] h-24 relative">
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkPath} L 1000,100 L 0,100 Z`} fill="url(#aGrad)" />
                  <path d={sparkPath} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
              <Stat label="Last 24h" value={d.kpis.last24h.toLocaleString()} />
              <Stat label="Total (7d)" value={d.kpis.total.toLocaleString()} />
              <Stat label="Human rate" value={`${d.kpis.humanRate}%`} accent="emerald" />
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
        <Card className="col-span-12 xl:col-span-7" title="Geographic Heatmap" right={<span className="text-[10px] text-white/40 uppercase tracking-widest">Updates every 15s</span>}>
          <div className="relative h-72 rounded-2xl bg-[#020617] border border-white/5 overflow-hidden">
            {/* SVG abstract world dots */}
            <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full opacity-20">
              {Array.from({ length: 280 }).map((_, i) => {
                const x = ((i * 37) % 1000);
                const y = ((i * 53) % 500);
                return <circle key={i} cx={x} cy={y} r="1.2" fill="#38BDF8" />;
              })}
            </svg>
            {/* Country pins */}
            {d.topCountries.slice(0, 6).map((c, i) => {
              const positions = [
                { x: 22, y: 38 }, { x: 48, y: 32 }, { x: 52, y: 36 },
                { x: 70, y: 45 }, { x: 30, y: 60 }, { x: 80, y: 40 },
              ];
              const p = positions[i];
              const size = 8 + (c.pct / 10);
              return (
                <div
                  key={c.code}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.8)]"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: size, height: size }}
                  title={`${c.code}: ${c.count}`}
                />
              );
            })}
            <div className="absolute bottom-3 left-4 flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
              <Globe2 className="w-3 h-3" /> {d.topCountries.length} countries
            </div>
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-5" title="Top Countries">
          <div className="space-y-4">
            {d.topCountries.length === 0 && <Empty label="No clicks yet" />}
            {d.topCountries.map((c) => (
              <div key={c.code} className="space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-white/80">
                    <span className="text-lg">{c.flag}</span>
                    <span className="font-medium">{c.code}</span>
                  </span>
                  <span className="text-white/40 text-xs font-mono">
                    {c.count.toLocaleString()} · {c.pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full shadow-[0_0_6px_rgba(56,189,248,0.4)]"
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
                <span className="w-8 text-[9px] text-white/30 font-mono">
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
                              ? "rgba(255,255,255,0.03)"
                              : `rgba(56, 189, 248, ${0.15 + intensity * 0.85})`,
                          boxShadow: intensity > 0.7 ? "0 0 4px rgba(56,189,248,0.6)" : undefined,
                        }}
                        title={`${v} clicks @ ${hi}:00`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-between pl-10 pt-2 text-[9px] text-white/30 font-mono">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-4" title="Live Event Stream">
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {d.liveEvents.length === 0 && <Empty label="Waiting for events…" />}
            {d.liveEvents.map((e, i) => {
              const color = e.isBot
                ? "border-amber-400/60 text-amber-300"
                : e.routed === "safe"
                ? "border-indigo-400/60 text-indigo-300"
                : "border-sky-400/60 text-sky-300";
              return (
                <div
                  key={e.id}
                  className={`flex items-center gap-3 text-xs border-l-2 ${color} pl-3 py-2 bg-white/[0.02] rounded-r-md`}
                  style={{ opacity: 1 - i * 0.05 }}
                >
                  <span className="font-mono text-[10px] text-white/40">
                    {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="text-base leading-none">{e.flag}</span>
                  <span className="text-white/80 truncate flex-1">
                    {e.isBot ? "Bot blocked" : e.routed === "safe" ? "Safe redirect" : "Offer click"} · {e.country}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Devices + Browsers + Top Links */}
      <section className="grid grid-cols-12 gap-6 pb-10">
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Devices">
          <div className="flex items-center justify-center mb-6">
            <Donut
              data={d.devices.map((dv, i) => ({
                value: dv.count,
                color: ["#38BDF8", "#6366F1", "#A78BFA", "#475569"][i % 4],
              }))}
              centerLabel={d.devices[0]?.name ?? "—"}
              centerValue={`${d.devices[0]?.pct ?? 0}%`}
            />
          </div>
          <div className="space-y-2">
            {d.devices.length === 0 && <Empty label="No device data" />}
            {d.devices.map((dv, i) => (
              <div key={dv.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-white/70">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ["#38BDF8", "#6366F1", "#A78BFA", "#475569"][i % 4] }}
                  />
                  <MonitorSmartphone className="w-3 h-3 text-white/30" />
                  {dv.name}
                </span>
                <span className="font-mono text-white/50">{dv.count.toLocaleString()} · {dv.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Browsers">
          <div className="space-y-4">
            {d.browsers.length === 0 && <Empty label="No browser data" />}
            {d.browsers.map((b) => (
              <div key={b.name} className="space-y-1.5">
                <div className="flex justify-between text-xs text-white/70">
                  <span className="font-medium">{b.name}</span>
                  <span className="font-mono text-white/40">{b.count.toLocaleString()} · {b.pct}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-500 rounded-full"
                    style={{ width: `${Math.max(b.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-4" title="Top Performing Links">
          <div className="space-y-3">
            {d.topLinks.length === 0 && <Empty label="No link data yet" />}
            {d.topLinks.map((l, i) => (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-sky-400/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-300 text-xs font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    /{l.code}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 truncate">
                    {l.title ?? "Untitled link"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white font-mono">{l.count.toLocaleString()}</p>
                  <p className="text-[9px] text-sky-300 uppercase tracking-wider">clicks</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
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
    <div className={`p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-white tracking-wide" style={display}>
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "sky" }) {
  const color = accent === "emerald" ? "text-emerald-300" : accent === "sky" ? "text-sky-300" : "text-white";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">{label}</p>
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
    ? "from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-400/20"
    : "from-sky-500/20 to-indigo-500/10 text-sky-300 border-sky-400/20";
  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${toneClasses} border text-[10px] uppercase tracking-[0.2em] font-bold mb-4`}>
        {icon}
        {label}
      </div>
      <p className="text-3xl font-bold text-white font-mono" style={display}>{value}</p>
      <p className="text-xs text-white/40 mt-1">{sub}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-white/30 italic">{label}</p>;
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
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
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
        <p className="text-xl font-bold text-white">{centerValue}</p>
        <p className="text-[9px] uppercase tracking-widest text-white/40 font-bold">{centerLabel}</p>
      </div>
    </div>
  );
}
