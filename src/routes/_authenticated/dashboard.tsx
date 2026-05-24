import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Play, Pause, Plus, Search, TrendingUp, Activity, Shield, Link2 as LinkIcon } from "lucide-react";
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
  const ctr = totalHumans + totalBots > 0 ? ((totalHumans / (totalHumans + totalBots)) * 100).toFixed(1) : "0.0";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) => (l.title ?? "").toLowerCase().includes(q) || l.short_code.toLowerCase().includes(q) || (l.adsterra_url ?? "").toLowerCase().includes(q));
  }, [links, search]);

  // Mock 7-day bars based on total clicks (visual rhythm only)
  const bars = useMemo(() => {
    const seed = Math.max(totalHumans, 7);
    const heights = [40, 65, 50, 85, 70, 95, 60];
    return heights.map((h) => ({ h, peak: h === 95, label: Math.round((seed * h) / 100 / 7) }));
  }, [totalHumans]);

  return (
    <section className="p-5 sm:p-8 lg:p-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-10 lg:mb-16 flex-wrap gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight" style={display}>Performance</h1>
          <p className="text-white/30 mt-2 font-light text-sm sm:text-base">
            Monitoring activity across <span className="text-sky-300/90">{links.length}</span> smart link{links.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links…"
              className="bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm w-full sm:w-72 focus:outline-none focus:border-sky-400/50 focus:bg-white/[0.05] transition-all backdrop-blur-md text-white placeholder:text-white/30"
            />
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white px-5 sm:px-8 py-3 rounded-2xl font-bold text-sm tracking-tight transition-all shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Link</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>


      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-10 lg:mb-12">
        <Kpi label="Total Clicks" value={totalHumans.toLocaleString()} delta="+12%" accent>
          <div className="h-1.5 w-full bg-white/5 overflow-hidden rounded-full">
            <div className="h-full w-[70%] bg-gradient-to-r from-sky-400 via-indigo-500 to-indigo-400 shadow-[0_0_12px_rgba(56,189,248,0.55)]" />
          </div>
        </Kpi>

        <Kpi label="Active Links" value={`${activeLinks}`} delta={p?.link_limit ? `/ ${p.link_limit}` : ""}>
          <div className="flex gap-1.5 h-5 items-end">
            {[3, 5, 2.5, 4, 3.5].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h * 4}px` }}
                className={i % 2 === 0 ? "w-1.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)]" : "w-1.5 bg-indigo-500/40 rounded-full"}
              />
            ))}
          </div>
        </Kpi>
        <Kpi label="Human CTR" value={`${ctr}%`} delta={`${totalBots.toLocaleString()} bots`}>
          <div className="h-1.5 w-full bg-white/5 overflow-hidden rounded-full">
            <div className="h-full bg-white/30" style={{ width: `${Math.min(100, Number(ctr))}%` }} />
          </div>
        </Kpi>
        <Kpi label="Current Plan" value={(p?.plan_slug ?? "FREE").toUpperCase()} delta={p?.click_quota ? `${p.click_quota.toLocaleString()} quota` : "Unlimited"}>
          <p className="text-[10px] text-white/20 uppercase tracking-widest italic">Premium tier active</p>
        </Kpi>
      </div>

      {/* Create form (collapsible) */}
      {showCreate && (
        <div className="mb-12 p-10 border border-indigo-500/20 bg-indigo-500/[0.03] backdrop-blur-xl rounded-[2.5rem] shadow-[0_0_60px_rgba(99,102,241,0.08)]">
          <h3 className="text-2xl font-medium text-white mb-2" style={display}>Create New Link</h3>
          <p className="text-sm text-white/40 mb-8">Wrap your Adsterra Direct Link with bot-shield + clean analytics.</p>
          <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
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
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-bold text-sm tracking-tight transition-all shadow-[0_0_25px_rgba(99,102,241,0.35)] disabled:opacity-50"
              >
                {createMut.isPending ? "Creating…" : "Create Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-8 py-3 rounded-2xl text-sm text-white/50 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chart + Device */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 p-10 border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem]">
          <div className="flex justify-between items-center mb-12 flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-medium text-white" style={display}>Traffic Velocity</h3>
              <p className="text-xs text-white/30 mt-1">Last 7 days · human clicks</p>
            </div>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button className="px-5 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white transition-all">Daily</button>
              <button className="px-5 py-2 rounded-xl bg-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] text-xs font-bold text-white">Weekly</button>
            </div>
          </div>
          <div className="h-72 flex items-end justify-between gap-4 sm:gap-6 px-2">
            {bars.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div
                  className={
                    b.peak
                      ? "w-full bg-gradient-to-t from-indigo-900/40 to-indigo-500/60 rounded-t-2xl border-x border-t border-indigo-400/30 relative shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                      : "w-full bg-white/5 rounded-t-2xl transition-all group-hover:bg-indigo-500/20"
                  }
                  style={{ height: `${b.h}%` }}
                >
                  {b.peak && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 rounded-lg text-[10px] font-bold shadow-xl whitespace-nowrap">
                      PEAK
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-10 border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem]">
          <h3 className="text-2xl font-medium text-white mb-10" style={display}>Traffic Quality</h3>
          <div className="space-y-10">
            <Bar icon={<Activity className="w-4 h-4" />} label="Humans" value={totalHumans} total={totalHumans + totalBots} color="violet" />
            <Bar icon={<Shield className="w-4 h-4" />} label="Bots Blocked" value={totalBots} total={totalHumans + totalBots} color="white" />
            <Bar icon={<TrendingUp className="w-4 h-4" />} label="Conversion" value={Math.round(totalHumans * 0.04)} total={Math.max(1, totalHumans)} color="dim" />
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="p-6 sm:p-10 border border-white/10 bg-white/[0.01] backdrop-blur-2xl rounded-[2.5rem]">
        <div className="flex justify-between items-center mb-10 flex-wrap gap-4">
          <h3 className="text-2xl font-medium text-white" style={display}>Smart Links</h3>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 border-b border-indigo-400/20 pb-1">
            {filtered.length} of {links.length}
          </span>
        </div>

        {dashQ.isLoading && (
          <div className="py-16 text-center text-sm text-white/40">Loading links…</div>
        )}

        {!dashQ.isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <LinkIcon className="mx-auto h-10 w-10 text-white/20" />
            <p className="mt-4 text-sm text-white/40">{search ? "No links match your search." : "No links yet. Create your first cloaked link above."}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3 min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
                  <th className="px-4 pb-2">Short Code</th>
                  <th className="px-4 pb-2">Destination</th>
                  <th className="px-4 pb-2 text-right">Humans</th>
                  <th className="px-4 pb-2 text-right">Bots</th>
                  <th className="px-4 pb-2 text-right">Status</th>
                  <th className="px-4 pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-white/60">
                {filtered.map((l) => {
                  const shortUrl = `${origin}/r/${l.short_code}`;
                  return (
                    <tr key={l.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                      <td className="py-5 px-4 rounded-l-2xl">
                        <button
                          onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                          className="font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-2 group/copy"
                          title="Click to copy"
                        >
                          <span className="font-mono">{l.short_code}</span>
                          <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                        </button>
                        {l.title && <div className="text-[11px] text-white/30 mt-1 truncate max-w-[180px]">{l.title}</div>}
                      </td>
                      <td className="py-5 px-4 italic opacity-50 truncate max-w-[260px]">{l.adsterra_url}</td>
                      <td className="py-5 px-4 text-right text-white" style={display}>{(l.clicks_count || 0).toLocaleString()}</td>
                      <td className="py-5 px-4 text-right text-white/40" style={display}>{(l.bot_clicks_count || 0).toLocaleString()}</td>
                      <td className="py-5 px-4 text-right">
                        <button
                          onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                          className={
                            l.is_active
                              ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                              : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[11px] font-bold uppercase tracking-wider"
                          }
                        >
                          {l.is_active ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                          {l.is_active ? "Live" : "Paused"}
                        </button>
                      </td>
                      <td className="py-5 px-4 rounded-r-2xl text-right">
                        <button
                          onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                          className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const fieldCls =
  "w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-white placeholder:text-white/30";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Kpi({
  label, value, delta, accent, children,
}: { label: string; value: string; delta?: string; accent?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`p-6 sm:p-8 border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-[2rem] transition-all hover:bg-white/[0.04] hover:-translate-y-1 ${accent ? "shadow-[0_0_40px_rgba(56,189,248,0.12)] border-sky-400/20" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-4 sm:mb-6">{label}</p>
      <div className="flex items-baseline gap-3 mb-4 sm:mb-6 flex-wrap">
        <span className="text-3xl sm:text-4xl xl:text-5xl font-medium text-white" style={display}>{value}</span>
        {delta && <span className={`text-xs sm:text-sm font-bold ${accent ? "text-sky-300" : "text-white/30"}`}>{delta}</span>}
      </div>
      {children}
    </div>
  );
}

function Bar({ icon, label, value, total, color }: { icon: React.ReactNode; label: string; value: number; total: number; color: "violet" | "white" | "dim" }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fill =
    color === "violet"
      ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]"
      : color === "white"
        ? "bg-white/30"
        : "bg-white/15";

  return (
    <div className="group">
      <div className="flex justify-between text-xs font-bold uppercase tracking-[0.1em] text-white/40 mb-3">
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
        <span className="text-white">{value.toLocaleString()} · {pct}%</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
