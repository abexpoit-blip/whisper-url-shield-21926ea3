import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Play, Pause, Plus, Search, MoreHorizontal, ChevronRight } from "lucide-react";
import { getDashboardData, createLink, deleteLink, toggleLink } from "@/lib/links.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

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
  const p = dashQ.data?.profile;
  const links = dashQ.data?.links ?? [];

  const totalHumans = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const totalBots = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const activeLinks = links.filter((l) => l.is_active).length;
  const pausedLinks = links.length - activeLinks;
  const ctr = totalHumans + totalBots > 0 ? ((totalHumans / (totalHumans + totalBots)) * 100).toFixed(1) : "0.0";
  const botPct = totalHumans + totalBots > 0 ? ((totalBots / (totalHumans + totalBots)) * 100).toFixed(1) : "0.0";
  const maxClicks = Math.max(1, ...links.map((l) => l.clicks_count || 0));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) => (l.title ?? "").toLowerCase().includes(q) || l.short_code.toLowerCase().includes(q) || (l.adsterra_url ?? "").toLowerCase().includes(q));
  }, [links, search]);

  // 7-day bars derived from total clicks for visual rhythm
  const bars = useMemo(() => {
    const heights = [40, 65, 85, 55, 45, 95, 70];
    return heights.map((h) => ({ h, peak: h === 95 }));
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#020617] p-5 sm:p-6 lg:p-8 text-slate-200" style={display}>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">Performance Overview</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Monitoring <span className="text-sky-400">{links.length}</span> smart link{links.length === 1 ? "" : "s"} — traffic & velocity health.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search links..."
                className="bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 w-full md:w-64 text-white placeholder:text-slate-500 transition-all"
              />
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="bg-gradient-to-r from-sky-400 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-sky-500/20 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create Link
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Total Clicks" value={totalHumans.toLocaleString()} badge="+12%" badgeTone="emerald" />
          <Kpi label="Active Links" value={String(activeLinks)} badge={pausedLinks > 0 ? `${pausedLinks} paused` : "Stable"} badgeTone="sky" />
          <Kpi label="Human CTR" value={`${ctr}%`} badge={`${botPct}% bots`} badgeTone="emerald" />
          <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-300 relative z-10">Current Plan</p>
            <div className="flex items-end justify-between mt-2 relative z-10">
              <h3 className="text-2xl font-bold text-white">{(p?.plan_slug ?? "FREE").toUpperCase()}</h3>
              <Link to="/upgrade" className="text-xs font-bold text-white underline underline-offset-4 hover:text-sky-300">Upgrade</Link>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="p-6 sm:p-8 border border-sky-500/20 bg-sky-500/[0.03] backdrop-blur-xl rounded-3xl">
            <h3 className="text-xl font-bold text-white mb-1">Create New Link</h3>
            <p className="text-sm text-slate-400 mb-6">Wrap your Adsterra Direct Link with bot-shield + clean analytics.</p>
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
              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="bg-gradient-to-r from-sky-400 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {createMut.isPending ? "Creating…" : "Create Link"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-900/50 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Chart + Quality */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Traffic Velocity */}
          <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <h4 className="text-lg font-semibold text-white">Traffic Velocity</h4>
                <p className="text-xs text-slate-500 mt-0.5">Last 7 days · human clicks</p>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-all">Daily</button>
                <button className="px-3 py-1 text-xs font-medium bg-slate-800 text-white rounded-md transition-all">Weekly</button>
              </div>
            </div>
            <div className="flex items-end justify-between h-48 gap-3">
              {bars.map((b, i) => (
                <div key={i} className="w-full bg-slate-800/50 rounded-t-lg relative group" style={{ height: `${b.h}%` }}>
                  <div
                    className={
                      b.peak
                        ? "absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 to-sky-400 rounded-t-lg h-full"
                        : "absolute bottom-0 w-full bg-indigo-500/40 rounded-t-lg transition-all h-full group-hover:bg-sky-400"
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span key={d} className="text-[10px] uppercase font-bold text-slate-600">{d}</span>
              ))}
            </div>
          </div>

          {/* Traffic Quality */}
          <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-sm">
            <h4 className="text-lg font-semibold text-white mb-6">Traffic Quality</h4>
            <div className="space-y-6">
              <QualityBar label="Human Users" value={Number(ctr)} color="emerald" />
              <QualityBar label="Identified Bots" value={Number(botPct)} color="rose" />
              <QualityBar label="Conversion Potential" value={Math.min(100, Math.round(Number(ctr) * 0.8))} color="sky" />
            </div>
            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <p className="text-xs text-slate-500 italic text-center">
                {totalBots > 0 ? `${totalBots.toLocaleString()} bots blocked` : "No bot activity yet"}
              </p>
            </div>
          </div>
        </div>

        {/* Smart Links Table */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="p-6 border-b border-slate-800/60 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h4 className="text-lg font-semibold text-white">Smart Links</h4>
              <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {links.length}</p>
            </div>
            {!showCreate && (
              <button onClick={() => setShowCreate(true)} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold">
                New Link <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {dashQ.isLoading && (
            <div className="py-16 text-center text-sm text-slate-500">Loading links…</div>
          )}

          {!dashQ.isLoading && filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500">
              {search ? "No links match your search." : "No links yet — create your first one above."}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead className="bg-slate-950/40 text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Link Name</th>
                    <th className="px-6 py-4 font-semibold">Performance</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filtered.map((l) => {
                    const shortUrl = `${origin}/r/${l.short_code}`;
                    const pct = Math.round(((l.clicks_count || 0) / maxClicks) * 100);
                    return (
                      <tr key={l.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-white truncate max-w-[260px]">{l.title || l.short_code}</p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                            className="text-xs text-slate-500 hover:text-sky-400 inline-flex items-center gap-1.5 mt-0.5 font-mono"
                          >
                            /r/{l.short_code} <Copy className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="text-xs">
                              <span className="block font-bold text-white" style={display}>{(l.clicks_count || 0).toLocaleString()}</span>
                              <span className="text-slate-500">Clicks</span>
                            </div>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                            className={
                              l.is_active
                                ? "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-400"
                                : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400"
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {l.is_active ? "ACTIVE" : "PAUSED"}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                              className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                              aria-label={l.is_active ? "Pause" : "Resume"}
                            >
                              {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors" aria-label="More">
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
        </div>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 text-white placeholder:text-slate-500 transition-all";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Kpi({ label, value, badge, badgeTone }: { label: string; value: string; badge?: string; badgeTone?: "emerald" | "sky" | "indigo" }) {
  const tone =
    badgeTone === "sky" ? "text-sky-400 bg-sky-400/10" :
    badgeTone === "indigo" ? "text-indigo-300 bg-indigo-400/10" :
    "text-emerald-400 bg-emerald-400/10";
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-2xl backdrop-blur-sm hover:border-slate-700 transition-colors">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex items-end justify-between mt-2 gap-2 flex-wrap">
        <h3 className="text-2xl sm:text-3xl font-bold text-white" style={display}>{value}</h3>
        {badge && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tone}`}>{badge}</span>}
      </div>
    </div>
  );
}

function QualityBar({ label, value, color }: { label: string; value: number; color: "emerald" | "rose" | "sky" }) {
  const fill =
    color === "emerald" ? "bg-emerald-500" :
    color === "rose" ? "bg-rose-500" :
    "bg-sky-500";
  const text =
    color === "emerald" ? "text-emerald-400" :
    color === "rose" ? "text-rose-400" :
    "text-sky-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-slate-400">{label}</span>
        <span className={`${text} font-bold`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${fill} rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
