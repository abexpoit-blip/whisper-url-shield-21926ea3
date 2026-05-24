import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Activity, Download, Globe2, Smartphone, Monitor, Tablet, HelpCircle, Zap, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
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
        <p className="text-[#5D4538] text-sm">Couldn't load analytics.</p>
        <p className="text-[#A38D7D] text-xs max-w-md">{(q.error as Error)?.message ?? "Unknown error"}</p>
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
          <p className="text-[#A38D7D] text-sm mt-1">Live performance signals across all your smart links — last 7 days.</p>
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
                <p className="text-[#A38D7D] text-xs uppercase tracking-[0.25em] mt-2 font-bold">Clicks per second</p>
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
        <Card className="col-span-12 xl:col-span-7" title="Geographic Heatmap" right={<span className="text-[10px] text-[#A38D7D] uppercase tracking-widest">Updates every 15s</span>}>
          <div className="relative h-72 rounded-2xl bg-gradient-to-br from-[#2D1B0D] to-[#1A0E07] border border-[#FFEDD5] overflow-hidden">
            {/* SVG abstract world dots */}
            <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full opacity-20">
              {Array.from({ length: 280 }).map((_, i) => {
                const x = ((i * 37) % 1000);
                const y = ((i * 53) % 500);
                return <circle key={i} cx={x} cy={y} r="1.2" fill="#FEB47B" />;
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
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF7E5F] shadow-[0_0_20px_rgba(255,126,95,0.9)]"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: size, height: size }}
                  title={`${c.code}: ${c.count}`}
                />
              );
            })}
            <div className="absolute bottom-3 left-4 flex items-center gap-2 text-[10px] text-white/60 uppercase tracking-widest">
              <Globe2 className="w-3 h-3" /> {d.topCountries.length} countries
            </div>
          </div>
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
                    <p className="text-[10px] text-[#A38D7D] uppercase tracking-wider font-mono">{c.code}</p>
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
                <span className="w-8 text-[9px] text-[#BFA899] font-mono">
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
            <div className="flex justify-between pl-10 pt-2 text-[9px] text-[#BFA899] font-mono">
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
                  <span className="font-mono text-[10px] text-[#A38D7D] w-14 shrink-0">
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
                  <span className="font-mono text-[10px] text-[#A38D7D] w-12 text-right">{r.pct}%</span>
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
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#FFEDD5] hover:border-[#FF7E5F]/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#2D1B0D] truncate font-mono">/{l.code}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#A38D7D] truncate">
                    {l.title ?? "Untitled link"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-emerald-600 font-mono">{l.humans.toLocaleString()} ✓</p>
                  <p className="text-[10px] text-amber-600 font-mono">{l.bots.toLocaleString()} 🛡</p>
                </div>
                <div className="text-right shrink-0 min-w-[58px]">
                  <p className={`text-sm font-bold font-mono ${l.health >= 70 ? "text-emerald-600" : l.health >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                    {l.health}%
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-[#A38D7D]">Health</p>
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
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#BFA899] font-bold mb-1">{label}</p>
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
      <p className="text-xs text-[#A38D7D] mt-1">{sub}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-[#BFA899] italic">{label}</p>;
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
        <p className="text-[9px] uppercase tracking-widest text-[#A38D7D] font-bold">{centerLabel}</p>
      </div>
    </div>
  );
}

/* ---- Country flag (flagcdn.com — free, no install) ---- */
function Flag({ code, small = false }: { code: string; small?: boolean }) {
  const lower = code.toLowerCase();
  const size = small ? "w-5 h-3.5" : "w-7 h-5";
  if (!code || code === "??" || code.length !== 2) {
    return <span className={`${size} inline-flex items-center justify-center bg-white/70 rounded-[2px] text-[#A38D7D] text-[8px]`}>?</span>;
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
    return <span className={`${size} inline-flex items-center justify-center bg-white/70 rounded text-[#A38D7D] text-[10px] shrink-0`} title={title}>?</span>;
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
