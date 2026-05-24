import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, MoreHorizontal,
  TrendingUp, Activity, ShieldCheck, Sparkles, ArrowUpRight, Globe2,
  Zap, Clock,
} from "lucide-react";
import { getDashboardData, createLink, deleteLink, toggleLink, updateLinkTemplate } from "@/lib/links.functions";
import { TEMPLATE_OPTIONS, type PrelandingTemplate } from "@/lib/prelanding-templates";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const body = { fontFamily: "'DM Sans', system-ui, sans-serif" } as const;

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
  const p = dashQ.data?.profile;
  const links = dashQ.data?.links ?? [];

  const totalHumans = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const totalBots = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const activeLinks = links.filter((l) => l.is_active).length;
  const pausedLinks = links.length - activeLinks;
  const total = totalHumans + totalBots;
  const ctr = total > 0 ? ((totalHumans / total) * 100).toFixed(1) : "0.0";
  const botPct = total > 0 ? ((totalBots / total) * 100).toFixed(1) : "0.0";
  const maxClicks = Math.max(1, ...links.map((l) => l.clicks_count || 0));
  const quotaUsed = Number(p?.clicks_used ?? 0);
  const quotaMax = Number(p?.click_quota ?? 0) || quotaUsed || 1;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaMax) * 100));

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

  const bars = useMemo(() => [42, 68, 55, 88, 72, 95, 78], []);
  const spark = useMemo(() => [12, 22, 18, 30, 26, 38, 44, 36, 52, 48, 60, 72], []);
  const sparkBot = useMemo(() => [60, 52, 58, 44, 50, 38, 42, 36, 30, 34, 28, 22], []);
  const sparkCtr = useMemo(() => [70, 68, 74, 78, 76, 82, 80, 85, 83, 88, 90, 92], []);

  return (
    <div className="min-h-screen w-full px-5 sm:px-8 lg:px-10 py-8 text-sky-50/95" style={body}>
      <div className="max-w-[1480px] mx-auto space-y-7">

        {/* ===== HERO HEADER ===== */}
        <header className="relative overflow-hidden rounded-[28px] border border-sky-300/15 bg-gradient-to-br from-sky-500/[0.08] via-sky-400/[0.04] to-cyan-500/[0.06] backdrop-blur-2xl p-7 lg:p-9 shadow-[0_0_60px_-15px_rgba(56,189,248,0.25)]">
          {/* glow accents */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-400/20 blur-[110px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-cyan-400/15 blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(125,211,252,0.08),transparent_50%)] pointer-events-none" />

          <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-400/10 border border-sky-300/20 text-[11px] font-medium text-sky-200 backdrop-blur-md">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-sky-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-sky-300" />
                </span>
                System Operational · Shield Active
              </div>
              <h1
                className="text-[34px] lg:text-[44px] leading-[1.05] font-bold tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-300/80 bg-clip-text text-transparent"
                style={display}
              >
                Performance Overview
              </h1>
              <p className="text-sm lg:text-base text-sky-200/60 max-w-xl">
                Monitoring <span className="text-sky-200 font-semibold">{links.length}</span> smart link{links.length === 1 ? "" : "s"} ·{" "}
                <span className="text-sky-200 font-semibold">{total.toLocaleString()}</span> total events ·{" "}
                <span className="text-emerald-300 font-semibold">{ctr}%</span> clean traffic.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-300/60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search links, codes, URLs…"
                  className="w-full bg-white/[0.04] border border-sky-300/15 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400/40 text-white placeholder:text-sky-200/30 backdrop-blur-md transition-all"
                />
              </div>
              <button
                onClick={() => setShowCreate((v) => !v)}
                className="relative group px-5 py-3 rounded-2xl font-semibold text-sm whitespace-nowrap text-white shadow-[0_8px_30px_-8px_rgba(56,189,248,0.55)] bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 hover:shadow-[0_12px_36px_-8px_rgba(56,189,248,0.75)] transition-all overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Create Link
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* ===== KPI GRID ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            icon={<Activity className="w-4 h-4" />}
            label="Total Clean Clicks"
            value={totalHumans.toLocaleString()}
            delta="+12.4%"
            deltaTone="up"
            sparkline={spark}
            sub="vs last 7 days"
          />
          <KpiCard
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Bots Blocked"
            value={totalBots.toLocaleString()}
            delta={`${botPct}%`}
            deltaTone="warn"
            sparkline={sparkBot}
            sub="of total traffic"
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Clean Rate"
            value={`${ctr}%`}
            delta="+2.1%"
            deltaTone="up"
            sparkline={sparkCtr}
            sub="conversion quality"
          />
          <PlanCard
            plan={(p?.plan_slug ?? "FREE").toUpperCase()}
            used={quotaUsed}
            max={quotaMax}
            pct={quotaPct}
            activeLinks={activeLinks}
            pausedLinks={pausedLinks}
          />
        </div>

        {/* ===== CREATE FORM ===== */}
        {showCreate && (
          <div className="relative overflow-hidden p-7 border border-sky-300/20 bg-gradient-to-br from-sky-500/[0.06] to-cyan-500/[0.04] backdrop-blur-2xl rounded-3xl shadow-[0_0_50px_-20px_rgba(56,189,248,0.4)]">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-sky-400/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white" style={display}>Create Smart Link</h3>
              </div>
              <p className="text-sm text-sky-200/60 mb-6 ml-13">Wrap your Adsterra link with bot-shield, cloak page & analytics.</p>
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
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-[0_8px_28px_-8px_rgba(56,189,248,0.6)] bg-gradient-to-br from-sky-400 to-cyan-500 disabled:opacity-50 hover:shadow-[0_10px_32px_-8px_rgba(56,189,248,0.75)] transition-all"
                  >
                    {createMut.isPending ? "Creating…" : "Create Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-6 py-3 rounded-xl text-sm text-sky-200/70 hover:text-white border border-sky-300/10 hover:bg-white/[0.04] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== CHART + QUALITY ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Traffic Velocity */}
          <GlassCard className="xl:col-span-8 p-7">
            <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-sky-300" />
                  <h4 className="text-lg font-semibold text-white" style={display}>Traffic Velocity</h4>
                </div>
                <p className="text-xs text-sky-200/50">Last 7 days · clean human clicks</p>
              </div>
              <div className="flex bg-white/[0.03] p-1 rounded-xl border border-sky-300/10 backdrop-blur-md">
                {["24H", "7D", "30D"].map((t, i) => (
                  <button
                    key={t}
                    className={
                      i === 1
                        ? "px-3 py-1.5 text-[11px] font-semibold bg-gradient-to-br from-sky-400/20 to-cyan-400/10 text-sky-100 rounded-lg border border-sky-300/20"
                        : "px-3 py-1.5 text-[11px] font-medium text-sky-200/40 hover:text-sky-200/80 transition-colors"
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-between h-52 gap-3 relative">
              {/* horizontal grid */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-px bg-gradient-to-r from-transparent via-sky-300/10 to-transparent" />
                ))}
              </div>
              {bars.map((h, i) => {
                const peak = h === Math.max(...bars);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                    <span className="text-[10px] font-bold text-sky-200/0 group-hover:text-sky-200 transition-opacity">{Math.round((totalHumans * h) / 100 / 7)}</span>
                    <div className="w-full relative" style={{ height: `${h}%` }}>
                      <div
                        className={
                          peak
                            ? "absolute inset-0 rounded-t-xl bg-gradient-to-t from-cyan-500 via-sky-400 to-sky-200 shadow-[0_0_30px_rgba(56,189,248,0.5)]"
                            : "absolute inset-0 rounded-t-xl bg-gradient-to-t from-sky-500/40 via-sky-400/50 to-sky-300/60 group-hover:from-cyan-500/60 group-hover:to-sky-200 transition-all"
                        }
                      />
                      <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-white/30" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 px-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span key={d} className="flex-1 text-center text-[10px] uppercase font-bold tracking-wider text-sky-200/30">{d}</span>
              ))}
            </div>
          </GlassCard>

          {/* Traffic Quality */}
          <GlassCard className="xl:col-span-4 p-7">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="w-4 h-4 text-sky-300" />
              <h4 className="text-lg font-semibold text-white" style={display}>Traffic Quality</h4>
            </div>

            {/* radial-ish summary */}
            <div className="relative mb-6 flex items-center justify-center">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="rgba(125,211,252,0.08)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="url(#g1)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(Number(ctr) / 100) * 264} 264`}
                  />
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#7dd3fc" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white" style={display}>{ctr}%</span>
                  <span className="text-[10px] uppercase tracking-widest text-sky-200/40">Clean</span>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <QualityBar label="Human Users" value={Number(ctr)} color="sky" />
              <QualityBar label="Bots Blocked" value={Number(botPct)} color="rose" />
              <QualityBar label="Conversion Potential" value={Math.min(100, Math.round(Number(ctr) * 0.85))} color="emerald" />
            </div>

            <div className="mt-6 pt-5 border-t border-sky-300/10">
              <p className="text-[11px] text-sky-200/40 text-center">
                {totalBots > 0
                  ? <><span className="text-rose-300 font-semibold">{totalBots.toLocaleString()}</span> threats neutralized</>
                  : "No bot activity detected"}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* ===== SMART LINKS ===== */}
        <GlassCard className="overflow-hidden">
          <div className="p-6 border-b border-sky-300/10 flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400/20 to-cyan-500/10 border border-sky-300/20 flex items-center justify-center backdrop-blur-md">
                <Globe2 className="w-5 h-5 text-sky-300" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white" style={display}>Smart Links</h4>
                <p className="text-[11px] text-sky-200/50">
                  Showing <span className="text-sky-200 font-semibold">{filtered.length}</span> of {links.length}
                </p>
              </div>
            </div>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs text-sky-300 hover:text-sky-100 flex items-center gap-1 font-semibold px-3 py-1.5 rounded-lg hover:bg-sky-400/10 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> New Link
              </button>
            )}
          </div>

          {dashQ.isLoading && (
            <div className="py-20 text-center text-sm text-sky-200/40">Loading links…</div>
          )}

          {!dashQ.isLoading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-sky-400/10 border border-sky-300/15 flex items-center justify-center">
                <Globe2 className="w-6 h-6 text-sky-300/60" />
              </div>
              <p className="text-sm text-sky-200/50">
                {search ? "No links match your search." : "No links yet — create your first one above."}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.18em] text-sky-200/40">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Link</th>
                    <th className="px-6 py-4 font-semibold">Performance</th>
                    <th className="px-6 py-4 font-semibold">Shield</th>
                    <th className="px-6 py-4 font-semibold">Cloak Page</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-300/5">
                  {filtered.map((l) => {
                    const shortUrl = `${origin}/r/${l.short_code}`;
                    const pct = Math.round(((l.clicks_count || 0) / maxClicks) * 100);
                    const linkBots = l.bot_clicks_count || 0;
                    const linkClean = l.clicks_count || 0;
                    const linkCtr = linkClean + linkBots > 0
                      ? Math.round((linkClean / (linkClean + linkBots)) * 100)
                      : 100;
                    return (
                      <tr key={l.id} className="hover:bg-sky-400/[0.03] transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400/15 to-cyan-500/5 border border-sky-300/15 flex items-center justify-center text-[10px] font-bold text-sky-200 backdrop-blur-md flex-shrink-0">
                              {(l.title || l.short_code).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate max-w-[240px]" style={display}>
                                {l.title || l.short_code}
                              </p>
                              <button
                                onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                                className="text-[11px] text-sky-300/70 hover:text-sky-200 inline-flex items-center gap-1.5 mt-1 font-mono group/copy"
                              >
                                /r/{l.short_code}
                                <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base font-bold text-white" style={display}>
                                {linkClean.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-sky-200/40 uppercase tracking-wider">clicks</span>
                            </div>
                            <div className="w-28 h-1.5 bg-sky-300/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-emerald-300">{linkCtr}%</span>
                            <p className="text-[10px] text-sky-200/40">
                              {linkBots.toLocaleString()} blocked
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <select
                            value={(l as { prelanding_template?: string }).prelanding_template || "article_health"}
                            onChange={(e) => tplMut.mutate({ id: l.id, prelanding_template: e.target.value as PrelandingTemplate })}
                            disabled={tplMut.isPending}
                            className="bg-white/[0.03] border border-sky-300/15 text-xs rounded-lg px-2.5 py-1.5 text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400/40 hover:border-sky-400/40 transition-all cursor-pointer max-w-[180px] backdrop-blur-md"
                          >
                            <optgroup label="Article (FB-safe)">
                              {TEMPLATE_OPTIONS.filter((t) => t.group.startsWith("Article")).map((t) => (
                                <option key={t.value} value={t.value} className="bg-[#020617]">{t.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Legacy">
                              {TEMPLATE_OPTIONS.filter((t) => t.group === "Legacy").map((t) => (
                                <option key={t.value} value={t.value} className="bg-[#020617]">{t.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                            className={
                              l.is_active
                                ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                                : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20"
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"}`} />
                            {l.is_active ? "LIVE" : "PAUSED"}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              to="/analytics"
                              className="text-sky-300/60 hover:text-sky-200 p-1.5 rounded-lg hover:bg-sky-400/10 transition-all"
                              aria-label="View analytics"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                              className="text-sky-300/60 hover:text-white p-1.5 rounded-lg hover:bg-sky-400/10 transition-all"
                              aria-label={l.is_active ? "Pause" : "Resume"}
                            >
                              {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                              className="text-sky-300/60 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="text-sky-300/60 hover:text-white p-1.5 rounded-lg hover:bg-sky-400/10 transition-all" aria-label="More">
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
        </GlassCard>

        <div className="flex items-center justify-center gap-2 text-[11px] text-sky-200/30 pt-2">
          <Clock className="w-3 h-3" />
          Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · auto-refresh every 30s
        </div>
      </div>
    </div>
  );
}

/* ============ COMPONENTS ============ */

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        "relative rounded-3xl border border-sky-300/10 bg-gradient-to-br from-white/[0.04] via-sky-500/[0.02] to-cyan-500/[0.03] backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(2,6,23,0.6)] " +
        className
      }
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent rounded-t-3xl pointer-events-none" />
      {children}
    </div>
  );
}

function KpiCard({
  icon, label, value, delta, deltaTone, sparkline, sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "warn";
  sparkline: number[];
  sub: string;
}) {
  const deltaColor =
    deltaTone === "up" ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" :
    deltaTone === "warn" ? "text-amber-300 bg-amber-400/10 border-amber-400/20" :
    "text-rose-300 bg-rose-400/10 border-rose-400/20";

  // sparkline path
  const w = 110, h = 32;
  const max = Math.max(...sparkline);
  const min = Math.min(...sparkline);
  const range = max - min || 1;
  const pts = sparkline.map((v, i) => {
    const x = (i / (sparkline.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M${pts.join(" L")}`;
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-sky-300/10 bg-gradient-to-br from-white/[0.04] via-sky-500/[0.02] to-transparent backdrop-blur-2xl p-5 shadow-[0_8px_30px_-10px_rgba(2,6,23,0.5)] hover:border-sky-300/25 hover:shadow-[0_8px_40px_-10px_rgba(56,189,248,0.25)] transition-all">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent pointer-events-none" />
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-sky-400/0 group-hover:bg-sky-400/10 blur-2xl transition-all pointer-events-none" />

      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-400/10 border border-sky-300/15 flex items-center justify-center text-sky-300">
            {icon}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/50">{label}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deltaColor}`}>{delta}</span>
      </div>

      <h3 className="text-3xl font-bold text-white" style={display}>{value}</h3>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-[10px] text-sky-200/40 uppercase tracking-wider">{sub}</p>
        <svg width={w} height={h} className="overflow-visible">
          <defs>
            <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${label.replace(/\s/g, "")})`} />
          <path d={path} fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function PlanCard({
  plan, used, max, pct, activeLinks, pausedLinks,
}: {
  plan: string; used: number; max: number; pct: number; activeLinks: number; pausedLinks: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-500/15 via-cyan-500/8 to-sky-400/5 backdrop-blur-2xl p-5 shadow-[0_8px_30px_-10px_rgba(56,189,248,0.35)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/50 to-transparent" />
      <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100/70">Current Plan</p>
          <Link
            to="/upgrade"
            className="text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-0.5 rounded-full transition-all"
          >
            UPGRADE
          </Link>
        </div>

        <h3 className="text-3xl font-bold text-white mb-3" style={display}>{plan}</h3>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-sky-100/70">
            <span>{used.toLocaleString()} / {max === 1 ? "∞" : max.toLocaleString()}</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-200 to-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-sky-100/60 pt-1">
            <span><span className="text-emerald-200 font-bold">{activeLinks}</span> active</span>
            <span><span className="text-amber-200 font-bold">{pausedLinks}</span> paused</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full bg-white/[0.04] border border-sky-300/15 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400/40 text-white placeholder:text-sky-200/30 backdrop-blur-md transition-all";

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/50 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function QualityBar({ label, value, color }: { label: string; value: number; color: "emerald" | "rose" | "sky" }) {
  const fill =
    color === "emerald" ? "bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]" :
    color === "rose" ? "bg-gradient-to-r from-rose-400 to-rose-300 shadow-[0_0_10px_rgba(251,113,133,0.5)]" :
    "bg-gradient-to-r from-sky-400 to-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]";
  const text =
    color === "emerald" ? "text-emerald-300" :
    color === "rose" ? "text-rose-300" :
    "text-sky-200";
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-sky-200/60">{label}</span>
        <span className={`${text} font-bold`} style={display}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-sky-300/5 rounded-full overflow-hidden">
        <div className={`h-full ${fill} rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
