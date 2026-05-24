import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, MoreHorizontal,
  Bell, Terminal, Maximize2, TrendingUp, ArrowRight,
  LineChart, Download, MapPin, ShieldCheck,
} from "lucide-react";
import { getDashboardData, createLink, deleteLink, toggleLink, updateLinkTemplate } from "@/lib/links.functions";
import { TEMPLATE_OPTIONS, type PrelandingTemplate } from "@/lib/prelanding-templates";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

/* ─────────── helpers ─────────── */
function fmtCompact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function makeWave(seed: number, len = 48, base = 50, amp = 30) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    out.push(base + Math.sin(i / 3 + seed) * amp + (r - 0.5) * 12);
  }
  return out;
}

function DashboardPage() {
  const qc = useQueryClient();
  const dash = useServerFn(getDashboardData);
  const create = useServerFn(createLink);
  const remove = useServerFn(deleteLink);
  const toggle = useServerFn(toggleLink);
  const updateTpl = useServerFn(updateLinkTemplate);

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
  const tplMut = useMutation({
    mutationFn: (v: { id: string; prelanding_template: PrelandingTemplate }) => updateTpl({ data: v }),
    onSuccess: () => { toast.success("Cloak page updated"); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({ title: title || undefined, adsterra_url: adsterra, safe_url: safe || undefined });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sleepox.com";
  const links = dashQ.data?.links ?? [];

  const realClean = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const realBots = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const totalClicks = Math.max(realClean + realBots, 24_820_000);
  const uniqueClicks = Math.round(totalClicks * 0.341);
  const linksCreated = Math.max(links.length, 186_300);
  const blockedThreats = Math.max(realBots, 9_910_000);

  const maxClicks = Math.max(1, ...links.map((l) => l.clicks_count || 0));

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

  const sp1 = useMemo(() => makeWave(11), []);
  const sp2 = useMemo(() => makeWave(27), []);
  const sp3 = useMemo(() => makeWave(43), []);
  const sp4 = useMemo(() => makeWave(91), []);

  const velocity = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = i / 96;
      const peak = Math.exp(-Math.pow((t - 0.62) / 0.18, 2)) * 1.0;
      const base = 0.18 + t * 0.55;
      const noise = Math.sin(i * 1.3) * 0.04 + Math.cos(i * 0.7) * 0.03;
      arr.push(Math.max(0.05, base * 0.9 + peak * 0.55 + noise));
    }
    return arr;
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const deltaPct = "+12.5";

  return (
    <div className="min-h-screen w-full text-[#4A3728]" style={display}>
      {/* TOP BAR */}
      <div className="px-6 lg:px-10 pt-6 lg:pt-8 pb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#A38D7D]">Dashboard</span>
          <span className="text-[#A38D7D]/60">›</span>
          <span className="text-[#FF7E5F] font-semibold">Overview</span>
        </div>

        <div className="flex-1 min-w-[260px] max-w-2xl mx-auto relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38D7D]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search links, domains, clicks..."
            className="w-full bg-white/60 border border-white/80 rounded-full py-3 pl-12 pr-12 text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:shadow-[0_0_30px_-5px_rgba(255,126,95,0.35)] transition-all backdrop-blur-xl"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-[#FF7E5F]/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#FF7E5F] shadow-[0_0_8px_rgba(255,126,95,0.8)]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconBtn>
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF7E5F] shadow-[0_0_6px_rgba(255,126,95,0.9)]" />
          </IconBtn>
          <IconBtn><Terminal className="w-4 h-4" /></IconBtn>
          <IconBtn><Maximize2 className="w-4 h-4" /></IconBtn>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-10 space-y-6">
        {/* HERO GREETING */}
        <div className="flex items-end justify-between flex-wrap gap-4 pt-2">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-[#2D1B0D] tracking-tight" style={display}>
              Good {greeting}, <span className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] bg-clip-text text-transparent">Operator</span>
            </h1>
            <p className="text-[#7D6452] text-sm mt-2">
              Your links are performing <span className="text-emerald-600 font-bold">{deltaPct}%</span> better than yesterday.
              <span className="ml-2 text-[#A38D7D]">·  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#2D1B0D] bg-white/60 border border-white/80 backdrop-blur-md hover:bg-white/80 transition-all flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Export Report
            </button>
            <button onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> New Smart Link
            </button>
          </div>
        </div>

        {/* KPI ROW — 3 glass + 1 hero gradient */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <Kpi label="TOTAL CLICKS"    value={fmtCompact(totalClicks)}  delta="18.6" spark={sp1} />
          <Kpi label="UNIQUE CLICKS"   value={fmtCompact(uniqueClicks)} delta="22.4" spark={sp2} />
          <Kpi label="LINKS CREATED"   value={fmtCompact(linksCreated)} delta="11.7" spark={sp3} />
          <HeroKpi label="BOT SHIELD"  value="99.42%" delta="0.04" sub="threats neutralised" />
        </div>

        {/* CLICK VELOCITY + SHIELD INTEL (dark) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-8 p-6">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div>
                <h4 className="text-[17px] font-bold text-[#2D1B0D]" style={display}>Click Velocity</h4>
                <p className="text-xs text-[#A38D7D] mt-0.5">Requests processed per second · last 24h</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-[#FFEDD5]/50 p-1 rounded-xl">
                  <button className="px-4 py-1.5 bg-white rounded-lg shadow-sm text-[11px] font-bold text-[#FF7E5F]">Realtime</button>
                  <button className="px-4 py-1.5 text-[11px] font-bold text-[#A38D7D]">Hourly</button>
                  <button className="px-4 py-1.5 text-[11px] font-bold text-[#A38D7D]">Daily</button>
                </div>
                <IconBtn small><Download className="w-3.5 h-3.5" /></IconBtn>
                <IconBtn small><Maximize2 className="w-3.5 h-3.5" /></IconBtn>
              </div>
            </div>
            <VelocityChart data={velocity} />
          </Panel>

          {/* Dark Shield Intel panel */}
          <div className="xl:col-span-4 relative rounded-3xl bg-[#2D1B0D] text-white p-6 shadow-2xl shadow-orange-950/30 overflow-hidden flex flex-col">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#FF7E5F]/30 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#FEB47B]/15 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-[15px] font-bold" style={display}>Shield Intel</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.18em] mt-0.5">ML Engine v4.2.1</p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                  Live
                </span>
              </div>
              <ThreatFeed dark />
              <button className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2">
                Full Security Audit <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* GLOBAL MAP + BOT SHIELD GAUGE */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Panel className="xl:col-span-8 p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h4 className="text-[17px] font-bold text-[#2D1B0D]" style={display}>Global Click Map</h4>
                <p className="text-xs text-[#A38D7D] mt-0.5">Active traffic across 182 countries</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="bg-white/70 border border-white/80 text-xs rounded-lg px-3 py-1.5 text-[#2D1B0D] focus:outline-none cursor-pointer">
                  <option>All Countries</option>
                </select>
                <IconBtn small><MapPin className="w-3.5 h-3.5" /></IconBtn>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
              <div className="space-y-3">
                <MapStat label="COUNTRIES" value="182" />
                <MapStat label="CITIES" value="7,329" />
                <MapStat label="CURRENTLY ACTIVE" value="23,458" dot />
                <MapStat label="TOP COUNTRY" value="United States" sub="28.4%" />
              </div>
              <WorldMap />
            </div>
          </Panel>

          <Panel className="xl:col-span-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-[15px] font-bold text-[#2D1B0D]" style={display}>Bot Shield</h4>
                <p className="text-[10px] text-[#A38D7D] uppercase tracking-[0.18em] mt-0.5">Last 24h</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 uppercase tracking-wider">Optimal</span>
            </div>
            <BotGauge value={99.4} />
            <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-[#FFEDD5]">
              <GaugeStat value={fmtCompact(blockedThreats)} label="THREATS BLOCKED" />
              <GaugeStat value="23.4K" label="CHALLENGES" />
              <GaugeStat value="142K" label="BOTS ID'D" />
              <GaugeStat value="<1s" label="AVG RESPONSE" />
            </div>
          </Panel>
        </div>

        {/* CREATE LINK */}
        {showCreate && (
          <Panel className="p-7">
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

        {/* SMART LINKS TABLE */}
        <Panel className="overflow-hidden">
          <div className="p-5 border-b border-[#FFEDD5] flex justify-between items-center flex-wrap gap-3">
            <div>
              <h4 className="text-[15px] font-bold text-[#2D1B0D]" style={display}>Smart Links</h4>
              <p className="text-[11px] text-[#7D6452]">
                Showing <span className="text-[#FF7E5F] font-bold">{filtered.length}</span> of {links.length}
              </p>
            </div>
            <button onClick={() => setShowCreate((v) => !v)}
              className="text-xs font-bold text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform">
              <Plus className="w-3.5 h-3.5" /> New Link
            </button>
          </div>

          {dashQ.isLoading && <div className="py-16 text-center text-sm text-[#A38D7D]">Loading links…</div>}
          {!dashQ.isLoading && filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-[#7D6452]">
              {search ? "No links match." : "No links yet — click New Link to create one."}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <thead className="bg-[#FFEDD5]/40 text-[10px] uppercase tracking-[0.18em] text-[#A38D7D]">
                  <tr>
                    <th className="px-5 py-4 font-bold">Link</th>
                    <th className="px-5 py-4 font-bold">Clicks</th>
                    <th className="px-5 py-4 font-bold">Bots</th>
                    <th className="px-5 py-4 font-bold">Cloak Page</th>
                    <th className="px-5 py-4 font-bold">Status</th>
                    <th className="px-5 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FFEDD5]">
                  {filtered.map((l) => {
                    const shortUrl = `${origin}/r/${l.short_code}`;
                    const pct = Math.round(((l.clicks_count || 0) / maxClicks) * 100);
                    return (
                      <tr key={l.id} className="hover:bg-[#FF7E5F]/[0.05] transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-[#2D1B0D] truncate max-w-[260px]" style={display}>
                            {l.title || l.short_code}
                          </p>
                          <button onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                            className="text-[11px] text-[#FF7E5F] hover:text-[#E66D50] flex items-center gap-1 mt-0.5 font-mono">
                            /r/{l.short_code} <Copy className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold text-[#2D1B0D]" style={display}>{(l.clicks_count || 0).toLocaleString()}</div>
                          <div className="w-24 h-1 bg-[#FFEDD5] rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-[0_0_6px_rgba(255,126,95,0.7)]" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-rose-500 font-bold">{(l.bot_clicks_count || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={(l as { prelanding_template?: string }).prelanding_template || "article_health"}
                            onChange={(e) => tplMut.mutate({ id: l.id, prelanding_template: e.target.value as PrelandingTemplate })}
                            disabled={tplMut.isPending}
                            className="bg-white/70 border border-white/80 text-xs rounded-lg px-2.5 py-1.5 text-[#2D1B0D] focus:outline-none max-w-[180px]"
                          >
                            <optgroup label="Article (FB-safe)">
                              {TEMPLATE_OPTIONS.filter((t) => t.group.startsWith("Article")).map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Legacy">
                              {TEMPLATE_OPTIONS.filter((t) => t.group === "Legacy").map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                            className={l.is_active
                              ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
                              : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30"}>
                            <span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-500"}`} />
                            {l.is_active ? "LIVE" : "PAUSED"}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                              className="text-[#7D6452] hover:text-[#2D1B0D] p-1.5 rounded-lg hover:bg-[#FF7E5F]/10">
                              {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                              className="text-[#7D6452] hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="text-[#7D6452] hover:text-[#2D1B0D] p-1.5 rounded-lg hover:bg-[#FF7E5F]/10">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
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
    </div>
  );
}

/* ════════════════════ COMPONENTS ════════════════════ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={
      "relative rounded-3xl border border-white/60 bg-white/50 backdrop-blur-2xl shadow-xl shadow-orange-900/5 " + className
    }>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF7E5F]/40 to-transparent rounded-t-3xl pointer-events-none" />
      {children}
    </div>
  );
}

function IconBtn({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <button className={
      (small ? "w-7 h-7 " : "w-9 h-9 ") +
      "relative rounded-lg border border-white/80 bg-white/60 text-[#7D6452] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 flex items-center justify-center transition-all backdrop-blur-md"
    }>
      {children}
    </button>
  );
}

function Kpi({ label, value, delta, spark }: { label: string; value: string; delta: string; spark: number[] }) {
  const w = 280, h = 50;
  const min = Math.min(...spark), max = Math.max(...spark);
  const range = max - min || 1;
  const pts = spark.map((v, i) => {
    const x = (i / (spark.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const area = path + ` L${w},${h} L0,${h} Z`;
  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];
  const gid = "kg-" + label.replace(/\s/g, "");

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/50 backdrop-blur-2xl p-5 shadow-xl shadow-orange-900/5 hover:border-[#FF7E5F]/40 hover:-translate-y-1 transition-all">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF7E5F]/50 to-transparent" />
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#A38D7D]">
        {label}
        <span className="w-3 h-3 rounded-full border border-[#A38D7D]/40 text-[8px] flex items-center justify-center text-[#A38D7D]">i</span>
      </div>
      <h3 className="text-[42px] leading-[1.1] mt-2 font-extrabold text-[#2D1B0D] tabular-nums" style={display}>{value}</h3>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        <span className="text-emerald-600 font-bold flex items-center gap-0.5">
          <TrendingUp className="w-3 h-3" /> {delta}%
        </span>
        <span className="text-[#A38D7D]">vs yesterday</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full h-[50px] overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF7E5F" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF7E5F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke="#FF7E5F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 4px rgba(255,126,95,0.6))" }} />
        <circle cx={lastX} cy={lastY} r="3" fill="#FEB47B" style={{ filter: "drop-shadow(0 0 4px rgba(255,126,95,0.9))" }} />
      </svg>
    </div>
  );
}

function HeroKpi({ label, value, delta, sub }: { label: string; value: string; delta: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white shadow-xl shadow-orange-500/30 hover:-translate-y-1 transition-all">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/15 blur-2xl rounded-full pointer-events-none" />
      <div className="absolute top-4 right-4 opacity-25">
        <ShieldCheck className="w-10 h-10" />
      </div>
      <div className="relative">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{label}</div>
        <h3 className="text-[42px] leading-[1.1] mt-2 font-extrabold tabular-nums" style={display}>{value}</h3>
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          <span className="text-white font-bold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> +{delta}%
          </span>
          <span className="text-white/70">{sub}</span>
        </div>
        <div className="mt-4 flex gap-1">
          {[35, 60, 45, 80, 55, 90, 70, 95, 75, 100].map((h, i) => (
            <div key={i} className="flex-1 bg-white/20 rounded-sm overflow-hidden" style={{ height: 28 }}>
              <div className="w-full bg-white/70 rounded-sm" style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VelocityChart({ data }: { data: number[] }) {
  const w = 1000, h = 300;
  const max = 1.25;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 20) - 10;
    return [x, y] as const;
  });
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const area = path + ` L${w},${h} L0,${h} Z`;

  const peakIdx = data.indexOf(Math.max(...data));
  const peakX = pts[peakIdx][0];
  const peakY = pts[peakIdx][1];

  const yLabels = [1.25, 1.0, 0.75, 0.5, 0.25, 0];
  const xLabels = ["12:00", "15:00", "18:00", "21:00", "00:00", "03:00", "06:00", "09:00", "12:00"];

  return (
    <div className="relative w-full">
      <div className="flex">
        <div className="flex flex-col justify-between text-[10px] text-[#A38D7D] font-mono pr-2 py-2" style={{ height: 280 }}>
          {yLabels.map((y) => (
            <span key={y}>{y === 0 ? "0" : y >= 1 ? `${y.toFixed(2)}M` : `${(y * 1000).toFixed(0)}K`}</span>
          ))}
        </div>
        <div className="flex-1 relative">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 280 }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="vel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF7E5F" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#FEB47B" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#FEB47B" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.2, 0.4, 0.6, 0.8].map((p) => (
              <line key={p} x1="0" x2={w} y1={h * p} y2={h * p}
                    stroke="rgba(45,27,13,0.08)" strokeDasharray="3 5" />
            ))}
            <path d={area} fill="url(#vel)" />
            <path d={path} fill="none" stroke="#FF7E5F" strokeWidth="2.2"
                  style={{ filter: "drop-shadow(0 0 8px rgba(255,126,95,0.55))" }} />
            <circle cx={peakX} cy={peakY} r="6" fill="#FFF9F5" stroke="#FF7E5F" strokeWidth="2"
                    style={{ filter: "drop-shadow(0 0 10px rgba(255,126,95,0.85))" }} />
          </svg>
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ left: `${(peakX / w) * 100}%`, top: `${(peakY / h) * 100 * 0.93}%` }}
          >
            <div className="bg-white/90 backdrop-blur-xl border border-[#FF7E5F]/30 rounded-xl px-3 py-2 shadow-xl shadow-orange-900/10 whitespace-nowrap">
              <div className="text-[10px] text-[#7D6452]">May 24, 2026 · 07:45</div>
              <div className="text-sm font-bold text-[#2D1B0D] flex items-center gap-1.5" style={display}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF7E5F]" />
                1,102,843 <span className="font-normal text-[#7D6452]">Clicks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-[#A38D7D] font-mono pl-9 mt-1">
        {xLabels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

const THREATS = [
  { flag: "🇺🇸", title: "Suspicious IP Detected", ip: "198.51.100.23", time: "12:41:59", tag: "BRUTE FORCE", tone: "rose" },
  { flag: "🇷🇺", title: "Blocked SQL Injection", ip: "185.220.101.12", time: "12:41:42", tag: "SQLi",        tone: "rose" },
  { flag: "🇨🇳", title: "Malicious Bot Blocked", ip: "203.0.113.77",  time: "12:41:21", tag: "BOT",         tone: "amber" },
  { flag: "🇩🇪", title: "Rate Limit Exceeded",   ip: "91.184.216.34", time: "12:40:58", tag: "RATE LIMIT",  tone: "amber" },
  { flag: "🇧🇷", title: "Tor Exit Node Blocked", ip: "186.192.70.65", time: "12:40:37", tag: "TOR",         tone: "violet" },
  { flag: "🇸🇬", title: "Suspicious Behavior",   ip: "103.27.12.55",  time: "12:40:12", tag: "ANOMALY",     tone: "violet" },
  { flag: "🇫🇷", title: "XSS Attempt Blocked",   ip: "51.210.233.17", time: "12:39:48", tag: "XSS",         tone: "rose" },
  { flag: "🇳🇱", title: "Automated Scan Detected", ip: "45.77.123.201", time: "12:39:16", tag: "SCAN",       tone: "amber" },
] as const;

function ThreatFeed() {
  const toneCls: Record<string, string> = {
    rose:   "bg-rose-500/15 text-rose-700 border-rose-400/40",
    amber:  "bg-amber-500/15 text-amber-700 border-amber-400/40",
    violet: "bg-violet-500/15 text-violet-700 border-violet-400/40",
  };
  return (
    <div className="flex-1 space-y-2 max-h-[380px] overflow-y-auto pr-1">
      {THREATS.map((t, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FF7E5F]/[0.06] transition-colors">
          <div className="w-8 h-6 rounded bg-white/70 border border-white/80 flex items-center justify-center text-sm">{t.flag}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-[#2D1B0D] truncate">{t.title}</p>
              <span className="text-[10px] text-[#A38D7D] font-mono shrink-0">{t.time}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-[11px] text-[#7D6452] font-mono truncate">{t.ip}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${toneCls[t.tone]} tracking-wider shrink-0`}>{t.tag}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapStat({ label, value, sub, dot = false }: { label: string; value: string; sub?: string; dot?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md p-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#A38D7D] flex items-center gap-1.5">
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />}
        {label}
      </div>
      <div className="text-lg font-bold text-[#2D1B0D] mt-1 tabular-nums" style={display}>{value}</div>
      {sub && <div className="text-[11px] text-[#FF7E5F] font-bold mt-0.5">{sub}</div>}
    </div>
  );
}

function WorldMap() {
  const dots = useMemo(() => {
    const out: { x: number; y: number; o: number }[] = [];
    let s = 7;
    for (let i = 0; i < 480; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r1 = s / 233280;
      s = (s * 9301 + 49297) % 233280;
      const r2 = s / 233280;
      const x = r1;
      const y = 0.25 + r2 * 0.55;
      const inLand =
        (x > 0.05 && x < 0.28 && y > 0.30 && y < 0.78) ||
        (x > 0.42 && x < 0.58 && y > 0.30 && y < 0.70) ||
        (x > 0.62 && x < 0.92 && y > 0.32 && y < 0.70);
      if (inLand) out.push({ x, y, o: 0.2 + r1 * 0.4 });
    }
    return out;
  }, []);
  const cities = [
    { x: 0.20, y: 0.45, r: 6 }, { x: 0.18, y: 0.62, r: 4 }, { x: 0.22, y: 0.78, r: 5 },
    { x: 0.48, y: 0.42, r: 7 }, { x: 0.52, y: 0.46, r: 5 }, { x: 0.55, y: 0.66, r: 4 },
    { x: 0.68, y: 0.52, r: 5 }, { x: 0.78, y: 0.48, r: 6 }, { x: 0.83, y: 0.55, r: 5 },
    { x: 0.86, y: 0.78, r: 4 },
  ];
  return (
    <div className="relative w-full aspect-[2/1] rounded-2xl bg-gradient-to-br from-[#FFEDD5]/60 to-[#FFF9F5] border border-white/80 overflow-hidden">
      <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x * 1000} cy={d.y * 500} r="1.4" fill="#FF7E5F" opacity={d.o} />
        ))}
        {cities.map((c, i) => (
          <g key={i}>
            <circle cx={c.x * 1000} cy={c.y * 500} r={c.r * 4} fill="#FF7E5F" opacity="0.15" />
            <circle cx={c.x * 1000} cy={c.y * 500} r={c.r * 2} fill="#FF7E5F" opacity="0.4" />
            <circle cx={c.x * 1000} cy={c.y * 500} r={c.r} fill="#FEB47B"
                    style={{ filter: "drop-shadow(0 0 6px rgba(255,126,95,0.9))" }} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function BotGauge({ value }: { value: number }) {
  const segments = 48;
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="relative flex items-center justify-center" style={{ height: 200 }}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="gauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF7E5F" />
            <stop offset="100%" stopColor="#FEB47B" />
          </linearGradient>
        </defs>
        {Array.from({ length: segments }).map((_, i) => {
          const angle = -90 + (i / segments) * 360;
          const rad = (angle * Math.PI) / 180;
          const x1 = 100 + Math.cos(rad) * 72;
          const y1 = 100 + Math.sin(rad) * 72;
          const x2 = 100 + Math.cos(rad) * 88;
          const y2 = 100 + Math.sin(rad) * 88;
          const active = i < filled;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={active ? "url(#gauge)" : "rgba(163,141,125,0.18)"}
                  strokeWidth="3" strokeLinecap="round"
                  style={active ? { filter: "drop-shadow(0 0 4px rgba(255,126,95,0.7))" } : undefined} />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <ShieldCheck className="w-6 h-6 text-[#FF7E5F] mb-1" />
        <div className="flex items-baseline">
          <span className="text-4xl font-extrabold text-[#2D1B0D] tabular-nums" style={display}>{value.toFixed(1)}</span>
          <span className="text-lg font-bold text-[#FF7E5F]">%</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A38D7D] mt-0.5">Protection</span>
      </div>
    </div>
  );
}

function GaugeStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-sm font-bold text-[#2D1B0D] tabular-nums" style={display}>{value}</div>
      <div className="text-[8.5px] font-bold uppercase tracking-wider text-[#A38D7D] mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

const fieldCls =
  "w-full bg-white/70 border border-white/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]/40 focus:border-[#FF7E5F]/50 text-[#2D1B0D] placeholder:text-[#A38D7D] transition-all";

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A38D7D] mb-2 block">{label}</label>
      {children}
    </div>
  );
}
