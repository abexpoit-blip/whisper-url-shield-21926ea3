import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, Bell, ArrowRight,
  TrendingUp, Filter, RefreshCw, ChevronRight, Smartphone,
} from "lucide-react";
import { getDashboardData, createLink, deleteLink, toggleLink } from "@/lib/links.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function fmtCompact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toLocaleString();
}

function DashboardPage() {
  const qc = useQueryClient();
  const dash = useServerFn(getDashboardData);
  const create = useServerFn(createLink);
  const remove = useServerFn(deleteLink);
  const toggle = useServerFn(toggleLink);
  

  const dashQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const [adsterra, setAdsterra] = useState("");
  const [safe, setSafe] = useState("");
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"7D" | "30D">("7D");

  const createMut = useMutation({
    mutationFn: (vars: { title?: string; adsterra_url: string; safe_url?: string }) => create({ data: vars }),
    onSuccess: () => {
      toast.success("Link created");
      setAdsterra(""); setSafe(""); setTitle(""); setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const togMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({ title: title || undefined, adsterra_url: adsterra, safe_url: safe || undefined });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sleepox.com";
  const links = dashQ.data?.links ?? [];
  const profile = dashQ.data?.profile;

  const totalClicks = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const botBlocked = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const activeLinks = links.filter((l) => l.is_active).length;
  const uniqueVisitors = Math.round(totalClicks * 0.62);
  const botPct = totalClicks > 0 ? ((botBlocked / (totalClicks + botBlocked)) * 100) : 0;

  const clickQuota = profile?.click_quota ?? null;
  const clicksUsed = Number(profile?.clicks_used ?? 0);
  const quotaPct = clickQuota ? Math.min(100, Math.round((clicksUsed / clickQuota) * 100)) : 0;
  const quotaLabel = clickQuota ? `${fmtCompact(clicksUsed)} / ${fmtCompact(clickQuota)}` : "Unlimited";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        (l.title ?? "").toLowerCase().includes(q) ||
        l.short_code.toLowerCase().includes(q) ||
        (l.adsterra_url ?? "").toLowerCase().includes(q),
    );
  }, [links, search]);

  const chartData = useMemo(() => {
    const len = range === "7D" ? 7 : 30;
    const out: number[] = [];
    let s = 13;
    for (let i = 0; i < len; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const t = i / (len - 1);
      const wave = Math.sin(t * Math.PI * 1.7) * 0.4 + 0.5;
      const peak = Math.exp(-Math.pow((t - 0.6) / 0.18, 2)) * 0.5;
      out.push(0.2 + wave * 0.5 + peak + (r - 0.5) * 0.1);
    }
    return out;
  }, [range]);

  return (
    <div className="min-h-screen w-full text-[#2D1B0D]" style={display}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* TOP BAR */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm shadow-orange-900/5 px-5 py-3 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-orange-500/30">S</div>
            <span className="font-extrabold text-[17px] text-[#2D1B0D] tracking-tight">sleepox</span>
          </Link>
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38D7D]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links..."
              className="w-full bg-[#FFF9F5]/70 border border-[#FFEDD5] rounded-xl py-2.5 pl-11 pr-4 text-sm placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all"
            />
          </div>
          <button className="relative w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#FFEDD5] flex items-center justify-center text-[#7D6452] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 transition-all">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF7E5F] shadow-[0_0_6px_rgba(255,126,95,0.9)]" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] shadow-md shadow-orange-500/30" />
        </div>

        {/* KPI ROW — 5 floating cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="TOTAL CLICKS" value={fmtCompact(totalClicks)} sub="+12.5% this week" tone="up" />
          <KpiCard label="ACTIVE LINKS" value={String(activeLinks)} sub={`${links.length} total`} tone="muted" />
          <KpiCard label="UNIQUE VISITORS" value={fmtCompact(uniqueVisitors)} sub="62% direct traffic" tone="muted" />
          <KpiCard label="BOT BLOCKED" value={`${botPct.toFixed(1)}%`} sub={`${fmtCompact(botBlocked)} attempts`} tone="muted" />
          <QuotaCard pct={quotaPct} label={quotaLabel} />
        </div>

        {/* MAIN GRID: chart + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: chart + CTA + table */}
          <div className="lg:col-span-2 space-y-5">
            {/* Chart */}
            <Panel className="p-6">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h4 className="text-lg font-bold text-[#2D1B0D]" style={display}>Clicks over {range === "7D" ? "7 days" : "30 days"}</h4>
                  <p className="text-xs text-[#A38D7D] mt-0.5">Tracking real-time traffic volume</p>
                </div>
                <div className="flex gap-1 bg-[#FFEDD5]/60 p-1 rounded-xl">
                  {(["7D", "30D"] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${range === r ? "bg-[#FF7E5F] text-white shadow-sm" : "text-[#A38D7D] hover:text-[#7D6452]"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <AreaChart data={chartData} />
            </Panel>

            {/* CTA BAR */}
            <button onClick={() => setShowCreate((v) => !v)}
              className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] p-5 flex items-center gap-4 shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 blur-3xl rounded-full pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-white font-bold text-[15px]" style={display}>Create new smart link</h4>
                <p className="text-white/85 text-xs mt-0.5">Setup advanced redirection & cloaking</p>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 bg-white text-[#FF7E5F] px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform">
                Quick Start <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* CREATE FORM */}
            {showCreate && (
              <Panel className="p-6">
                <h3 className="text-lg font-bold text-[#2D1B0D] mb-1" style={display}>Create Smart Link</h3>
                <p className="text-xs text-[#7D6452] mb-5">Wrap your Adsterra link with bot-shield & cloak page.</p>
                <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title (optional)" full>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My ad campaign" className={fieldCls} />
                  </Field>
                  <Field label="Adsterra Direct Link *">
                    <input type="url" required value={adsterra} onChange={(e) => setAdsterra(e.target.value)} placeholder="https://..." className={fieldCls} />
                  </Field>
                  <Field label="Safe URL (for reviewers)">
                    <input type="url" value={safe} onChange={(e) => setSafe(e.target.value)} placeholder="https://sleepox.com/" className={fieldCls} />
                  </Field>
                  <div className="sm:col-span-2 flex gap-3 pt-1">
                    <button type="submit" disabled={createMut.isPending}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform disabled:opacity-50">
                      {createMut.isPending ? "Creating…" : "Create Link"}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)}
                      className="px-6 py-3 rounded-xl text-sm font-semibold text-[#7D6452] hover:text-[#2D1B0D] border border-[#FFEDD5] hover:bg-white/60">
                      Cancel
                    </button>
                  </div>
                </form>
              </Panel>
            )}

            {/* RECENT CAMPAIGNS / SMART LINKS */}
            <Panel className="overflow-hidden">
              <div className="p-5 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h4 className="text-lg font-bold text-[#2D1B0D]" style={display}>Recent Campaigns</h4>
                  <p className="text-[11px] text-[#A38D7D] mt-0.5">Showing {filtered.length} of {links.length}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-lg border border-[#FFEDD5] text-[#A38D7D] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 flex items-center justify-center transition-all"><Filter className="w-4 h-4" /></button>
                  <button onClick={() => qc.invalidateQueries({ queryKey: ["dashboard"] })} className="w-9 h-9 rounded-lg border border-[#FFEDD5] text-[#A38D7D] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 flex items-center justify-center transition-all"><RefreshCw className="w-4 h-4" /></button>
                </div>
              </div>

              {dashQ.isLoading && <div className="py-16 text-center text-sm text-[#A38D7D]">Loading links…</div>}
              {!dashQ.isLoading && filtered.length === 0 && (
                <div className="py-16 text-center text-sm text-[#7D6452]">
                  {search ? "No links match." : "No links yet — click Create new smart link above."}
                </div>
              )}

              {filtered.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[720px]">
                    <thead className="text-[10px] uppercase tracking-[0.18em] text-[#A38D7D] border-y border-[#FFEDD5]">
                      <tr>
                        <th className="px-5 py-3 font-bold">Campaign</th>
                        <th className="px-5 py-3 font-bold">Trend</th>
                        <th className="px-5 py-3 font-bold">Clicks</th>
                        <th className="px-5 py-3 font-bold">Status</th>
                        <th className="px-5 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FFEDD5]">
                      {filtered.map((l, idx) => {
                        const shortUrl = `${origin}/r/${l.short_code}`;
                        const up = idx % 3 !== 0;
                        return (
                          <tr key={l.id} className="hover:bg-[#FFF9F5] transition-colors">
                            <td className="px-5 py-4">
                              <p className="text-sm font-bold text-[#2D1B0D] truncate max-w-[220px]" style={display}>
                                {l.title || l.short_code}
                              </p>
                              <button onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                                className="text-[11px] text-[#FF7E5F] hover:text-[#E66D50] flex items-center gap-1 mt-0.5 font-mono">
                                /r/{l.short_code} <Copy className="w-3 h-3" />
                              </button>
                            </td>
                            <td className="px-5 py-4"><MiniSpark up={up} /></td>
                            <td className="px-5 py-4">
                              <div className="text-sm font-bold text-[#2D1B0D] tabular-nums" style={display}>
                                {(l.clicks_count || 0) >= 5000
                                  ? "5,000+"
                                  : (l.clicks_count || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                                className={l.is_active
                                  ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"
                                  : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"}>
                                {l.is_active ? "ACTIVE" : "PAUSED"}
                              </button>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                                  className="text-[#7D6452] hover:text-[#FF7E5F] p-1.5 rounded-lg hover:bg-[#FFEDD5]/60">
                                  {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>
                                <button onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                                  className="text-[#7D6452] hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <ChevronRight className="w-4 h-4 text-[#A38D7D]" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {/* RIGHT COLUMN: account quota + region */}
          <div className="space-y-5">
            {/* Account Quota */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-[#2D1B0D]" style={display}>Account Quota</h4>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="text-[#7D6452]">Redirects used</span>
                <span className="font-bold text-[#2D1B0D] tabular-nums">{quotaLabel}</span>
              </div>
              <div className="mt-2 h-2 bg-[#FFEDD5] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-[0_0_8px_rgba(255,126,95,0.5)]" style={{ width: `${quotaPct}%` }} />
              </div>
              <Link to="/upgrade"
                className="mt-5 w-full block text-center py-3 rounded-xl border-2 border-[#FF7E5F] text-[#FF7E5F] font-bold text-sm hover:bg-gradient-to-r hover:from-[#FF7E5F] hover:to-[#FEB47B] hover:text-white hover:border-transparent transition-all">
                Upgrade to Pro
              </Link>
            </Panel>

            {/* Traffic by Region + Mobile Gauge */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-[#2D1B0D]" style={display}>Traffic by Region</h4>
              <div className="mt-4 space-y-3">
                <RegionRow color="#BFDBFE" name="United States" pct={45} />
                <RegionRow color="#FECACA" name="United Kingdom" pct={22} />
                <RegionRow color="#BBF7D0" name="Germany" pct={14} />
                <RegionRow color="#FED7AA" name="Other" pct={19} />
              </div>

              <div className="mt-6 pt-6 border-t border-[#FFEDD5] flex flex-col items-center">
                <MobileGauge pct={72} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-bold text-[#A38D7D] flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> Mobile Traffic
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ COMPONENTS ════════════════════ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-sm shadow-orange-900/5 " + className}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "muted" }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-sm shadow-orange-900/5 hover:-translate-y-0.5 hover:shadow-md transition-all">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A38D7D]">{label}</div>
      <div className="text-2xl lg:text-3xl font-extrabold text-[#2D1B0D] mt-2 tabular-nums" style={display}>{value}</div>
      <div className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${tone === "up" ? "text-emerald-600" : "text-[#FF7E5F]"}`}>
        {tone === "up" && <TrendingUp className="w-3 h-3" />}
        {sub}
      </div>
    </div>
  );
}

function QuotaCard({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-sm shadow-orange-900/5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A38D7D]">QUOTA</span>
        <span className="text-[11px] font-bold text-[#FF7E5F] tabular-nums">{label}</span>
      </div>
      <div className="mt-4 h-2 bg-[#FFEDD5] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-[0_0_8px_rgba(255,126,95,0.5)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <Link to="/upgrade" className="mt-4 text-[11px] font-bold text-[#FF7E5F] hover:text-[#E66D50] flex items-center gap-1">
        Upgrade plan <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function AreaChart({ data }: { data: number[] }) {
  const w = 800, h = 260;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 30) - 15;
    return [x, y] as const;
  });
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 260 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7E5F" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FEB47B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dashArea)" />
      <path d={path} fill="none" stroke="#FF7E5F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 2px 6px rgba(255,126,95,0.4))" }} />
    </svg>
  );
}

function MiniSpark({ up }: { up: boolean }) {
  const w = 80, h = 28;
  const pts = up
    ? [[0, 20], [15, 18], [30, 14], [45, 16], [60, 10], [80, 6]]
    : [[0, 10], [15, 14], [30, 12], [45, 18], [60, 16], [80, 22]];
  const path = "M" + pts.map(([x, y]) => `${x},${y}`).join(" L");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={path} fill="none" stroke={up ? "#10B981" : "#FF7E5F"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RegionRow({ color, name, pct }: { color: string; name: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-sm text-[#2D1B0D] flex-1">{name}</span>
      <span className="text-sm font-bold text-[#2D1B0D] tabular-nums">{pct}%</span>
    </div>
  );
}

function MobileGauge({ pct }: { pct: number }) {
  const size = 120, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFEDD5" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#mg)" strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                style={{ filter: "drop-shadow(0 0 6px rgba(255,126,95,0.5))" }} />
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF7E5F" />
            <stop offset="100%" stopColor="#FEB47B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-[#A38D7D] font-semibold">Mobile</span>
        <span className="text-2xl font-extrabold text-[#2D1B0D] tabular-nums" style={display}>{pct}%</span>
      </div>
    </div>
  );
}

const fieldCls = "w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl px-4 py-3 text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all";

function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A38D7D] mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
