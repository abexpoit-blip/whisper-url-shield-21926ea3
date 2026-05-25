import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, Link2, MousePointerClick, Sparkles, Settings2, ShieldCheck, CreditCard, Bot,
  Target, Zap, Calendar, DollarSign, TrendingUp, Globe, Package, Ban, RotateCcw, Trash2,
  Plus, Search, X, Eye,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats, adminListUsers, adminBanUser, adminBulkBan, adminResetUserQuota, adminBulkSetPlan,
  adminListPackages, adminListAllPackages, adminUpsertPackage, adminDeletePackage,
  adminSetUserPlan, adminListUpgradeRequests, adminDecideUpgradeRequest,
  adminClicksTimeseries, adminTopCountries, adminTopUsers, adminRevenueTimeseries,
  adminListLinks, adminToggleLink, adminUpdateLink, adminDeleteLink,
  adminListBotRules, adminUpsertBotRule, adminDeleteBotRule,
  adminListCloakingRules, adminUpsertCloakingRule, adminDeleteCloakingRule,
  adminListCountryTiers, adminUpsertCountryTier, adminDeleteCountryTier,
  adminUserDetail,
} from "@/lib/admin.functions";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings.functions";

export const Route = createFileRoute("/_authenticated/control-panel")({
  head: () => ({ meta: [{ title: "Control Panel — Sleepox" }] }),
  component: AdminPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;
const PIE_COLORS = ["#FF7E5F", "#FEB47B", "#FFD4BB", "#7A5C45", "#FFEDD5", "#2D1B0D", "#4A3728", "#A8907A"];

function AdminPage() {
  const navigate = useNavigate();
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        navigate({ to: "/sx-vault-9k2m7x" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!mounted) return;
      if (!data) {
        navigate({ to: "/dashboard" });
        return;
      }
      setAdminChecked(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (!adminChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5] text-[#7A5C45] text-sm">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen bg-[#FFF9F5] text-[#4A3728] overflow-hidden" style={font}>
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/15 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[#FEB47B]/20 blur-[160px] rounded-full pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-8 lg:p-12 space-y-8 max-w-[1600px] mx-auto">
        <Header />
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="rules">Bot/Cloak</TabsTrigger>
            <TabsTrigger value="geo">Geo Tiers</TabsTrigger>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="links"><LinksTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="packages"><PackagesTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
          <TabsContent value="geo"><GeoTab /></TabsContent>
          <TabsContent value="traffic"><TrafficTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
        <ShieldCheck className="w-3 h-3" /> Admin · Live
      </div>
      <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#2D1B0D]">
        Control{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">Panel</span>
      </h1>
      <p className="mt-2 text-sm text-[#7A5C45]">Full system control · users, links, revenue, rules & analytics.</p>
    </div>
  );
}

// ===================== OVERVIEW =====================
function OverviewTab() {
  const statsFn = useServerFn(adminStats);
  const tsFn = useServerFn(adminClicksTimeseries);
  const ctyFn = useServerFn(adminTopCountries);
  const topUsersFn = useServerFn(adminTopUsers);
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const ts = useQuery({ queryKey: ["admin-ts"], queryFn: () => tsFn() });
  const cty = useQuery({ queryKey: ["admin-cty"], queryFn: () => ctyFn() });
  const top = useQuery({ queryKey: ["admin-top-users"], queryFn: () => topUsersFn() });

  const s = stats.data;
  const botPct = s && s.clicks ? ((s.bots / s.clicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Users" value={s?.users ?? "…"} sub={`${s?.banned_users ?? 0} banned`} />
        <Kpi icon={Link2} label="Links" value={s?.links ?? "…"} sub={`${s?.active_links ?? 0} active`} />
        <Kpi icon={MousePointerClick} label="Total clicks" value={(s?.clicks ?? 0).toLocaleString()} sub={`${botPct}% bots`} />
        <Kpi icon={DollarSign} label="MRR (30d)" value={`$${(s?.mrr_30d ?? 0).toFixed(2)}`} sub={`$${(s?.total_revenue ?? 0).toFixed(2)} all-time`} accent />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Zap} label="Ours rotations" value={(s?.ours ?? 0).toLocaleString()} />
        <Kpi icon={Target} label="Offer clicks" value={(s?.offer ?? 0).toLocaleString()} />
        <Kpi icon={Bot} label="Bots blocked" value={(s?.bots ?? 0).toLocaleString()} />
        <Kpi icon={Calendar} label="Today ours/total" value={`${(s?.today_ours ?? 0).toLocaleString()} / ${(s?.today_total ?? 0).toLocaleString()}`} accent />
      </div>

      <Panel icon={TrendingUp} title="Clicks · last 14 days" subtitle="Daily breakdown of routing & bot traffic">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={ts.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7A5C45" }} />
              <YAxis tick={{ fontSize: 10, fill: "#7A5C45" }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #FFD4BB", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#FF7E5F" strokeWidth={2} />
              <Line type="monotone" dataKey="ours" stroke="#FEB47B" strokeWidth={2} />
              <Line type="monotone" dataKey="offer" stroke="#2D1B0D" strokeWidth={2} />
              <Line type="monotone" dataKey="bots" stroke="#A8907A" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel icon={Globe} title="Top countries · 7d">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={cty.data ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#7A5C45" }} />
                <YAxis dataKey="country" type="category" tick={{ fontSize: 10, fill: "#7A5C45" }} width={50} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #FFD4BB", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#FF7E5F" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel icon={Users} title="Top users · by clicks">
          <div className="space-y-2">
            {(top.data ?? []).map((u, i) => (
              <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-white/60 border border-[#FFE4D0]">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#2D1B0D]">{u.email}</div>
                    <div className="text-[10px] uppercase font-bold text-[#7A5C45]">{u.plan_slug}</div>
                  </div>
                </div>
                <span className="font-bold text-[#FF7E5F]">{(u.clicks_used ?? 0).toLocaleString()}</span>
              </div>
            ))}
            {!top.data?.length && <div className="text-sm text-[#A8907A] p-4 text-center">No data yet.</div>}
          </div>
        </Panel>
      </div>

      <Panel icon={Bot} title="Bot vs Human · all-time">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={[
                  { name: "Human (ours)", value: s?.ours ?? 0 },
                  { name: "Human (offer)", value: s?.offer ?? 0 },
                  { name: "Bots", value: s?.bots ?? 0 },
                ]}
                cx="50%" cy="50%" outerRadius={90} dataKey="value" label
              >
                {PIE_COLORS.slice(0, 3).map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

// ===================== USERS =====================
function UsersTab() {
  const qc = useQueryClient();
  const usersFn = useServerFn(adminListUsers);
  const packagesFn = useServerFn(adminListPackages);
  const banFn = useServerFn(adminBanUser);
  const planFn = useServerFn(adminSetUserPlan);
  const bulkBanFn = useServerFn(adminBulkBan);
  const bulkPlanFn = useServerFn(adminBulkSetPlan);
  const resetFn = useServerFn(adminResetUserQuota);
  const detailFn = useServerFn(adminUserDetail);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const packages = useQuery({ queryKey: ["admin-packages"], queryFn: () => packagesFn() });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["admin-user-detail", detailId],
    queryFn: () => detailFn({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const filtered = useMemo(() => {
    const list = users.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((u) => (u.email ?? "").toLowerCase().includes(q) || u.id.includes(q) || u.plan_slug.includes(q));
  }, [users.data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const banMut = useMutation({ mutationFn: (v: { id: string; is_banned: boolean }) => banFn({ data: v }), onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const planMut = useMutation({ mutationFn: (v: { user_id: string; package_slug: string }) => planFn({ data: v }), onSuccess: () => { toast.success("Plan updated"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const bulkBanMut = useMutation({ mutationFn: (v: { ids: string[]; is_banned: boolean }) => bulkBanFn({ data: v }), onSuccess: (r) => { toast.success(`Updated ${r.updated} users`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const bulkPlanMut = useMutation({ mutationFn: (v: { ids: string[]; package_slug: string }) => bulkPlanFn({ data: v }), onSuccess: (r) => { toast.success(`${r.updated} users moved`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const resetMut = useMutation({ mutationFn: (v: { ids: string[] }) => resetFn({ data: v }), onSuccess: (r) => { toast.success(`Quota reset for ${r.updated}`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((u) => u.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  return (
    <Panel icon={Users} title="Users" subtitle="Search · bulk ban · reset quota · plan switch · per-user detail">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8907A]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, plan, id…" className={`${inputCls} pl-10`} />
        </div>
        <span className="text-xs text-[#7A5C45]">{selected.size} selected</span>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F]/10 to-[#FEB47B]/10 border border-[#FFD4BB] flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: true })} className="border-[#FFD4BB]"><Ban className="w-3 h-3 mr-1" />Ban</Button>
          <Button size="sm" variant="outline" onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: false })} className="border-[#FFD4BB]">Unban</Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Reset quota for ${selected.size} users?`)) resetMut.mutate({ ids: [...selected] }); }} className="border-[#FFD4BB]"><RotateCcw className="w-3 h-3 mr-1" />Reset quota</Button>
          <select value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value)} className="bg-white/80 border border-[#FFD4BB] rounded-lg px-2 py-1 text-xs">
            <option value="">Move to plan…</option>
            {packages.data?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <Button size="sm" disabled={!bulkPlan} onClick={() => { bulkPlanMut.mutate({ ids: [...selected], package_slug: bulkPlan }); setBulkPlan(""); }} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Apply</Button>
        </div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
              <Th><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} /></Th>
              <Th>Email</Th><Th>Plan</Th><Th>Change</Th><Th>Links</Th><Th>Clicks</Th><Th>Ours</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[#FFE4D0]/60 hover:bg-white/40">
                <Td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} /></Td>
                <Td className="font-medium text-[#2D1B0D]">{u.email}</Td>
                <Td><Pill>{u.plan_slug}</Pill></Td>
                <Td>
                  <select value={u.plan_slug} onChange={(e) => { if (e.target.value !== u.plan_slug && confirm(`Change ${u.email} to ${e.target.value}?`)) planMut.mutate({ user_id: u.id, package_slug: e.target.value }); }}
                    className="bg-white/80 border border-[#FFD4BB] rounded-lg px-2 py-1 text-xs">
                    {packages.data?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                    {!packages.data?.some((p) => p.slug === u.plan_slug) && <option value={u.plan_slug}>{u.plan_slug}</option>}
                  </select>
                </Td>
                <Td className="text-[#7A5C45]">{u.links_used} / {u.link_limit}</Td>
                <Td className="text-[#7A5C45]">{u.clicks_used.toLocaleString()}{u.click_quota ? ` / ${u.click_quota.toLocaleString()}` : " / ∞"}</Td>
                <Td><span className="inline-flex px-2 py-0.5 rounded-md bg-gradient-to-r from-[#FF7E5F]/15 to-[#FEB47B]/15 text-[#FF7E5F] text-xs font-bold">{(u.ours_clicks ?? 0).toLocaleString()}</span></Td>
                <Td>{u.is_banned ? <span className="text-rose-600 font-semibold">Banned</span> : <span className="text-emerald-600 font-semibold">Active</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)} className="border-[#FFD4BB]"><Eye className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => banMut.mutate({ id: u.id, is_banned: !u.is_banned })} className="border-[#FFD4BB]">{u.is_banned ? "Unban" : "Ban"}</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail.data?.profile?.email ?? "User detail"}</DialogTitle></DialogHeader>
          {detail.isLoading && <div className="text-sm text-[#7A5C45]">Loading…</div>}
          {detail.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Plan" value={detail.data.profile?.plan_slug ?? "—"} />
                <Stat label="Links" value={`${detail.data.profile?.links_used ?? 0} / ${detail.data.profile?.link_limit ?? 0}`} />
                <Stat label="Clicks" value={(detail.data.profile?.clicks_used ?? 0).toLocaleString()} />
              </div>
              <div className="h-44">
                <ResponsiveContainer>
                  <LineChart data={detail.data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="clicks" stroke="#FF7E5F" />
                    <Line type="monotone" dataKey="bots" stroke="#A8907A" strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A5C45] mb-2">Links ({detail.data.links.length})</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.links.map((l) => (
                    <div key={l.id} className="text-xs flex justify-between p-2 rounded bg-white/60 border border-[#FFE4D0]">
                      <span className="font-mono">{l.short_code}</span>
                      <span className="text-[#7A5C45]">{l.clicks_count} clicks · {l.bot_clicks_count} bots</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A5C45] mb-2">Payments ({detail.data.payments.length})</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.payments.map((p) => (
                    <div key={p.id} className="text-xs flex justify-between p-2 rounded bg-white/60 border border-[#FFE4D0]">
                      <span>{new Date(p.created_at).toLocaleDateString()} · {p.package_slug}</span>
                      <span className="font-semibold">${Number(p.amount).toFixed(2)} · {p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== LINKS =====================
function LinksTab() {
  const qc = useQueryClient();
  const linksFn = useServerFn(adminListLinks);
  const toggleFn = useServerFn(adminToggleLink);
  const updateFn = useServerFn(adminUpdateLink);
  const delFn = useServerFn(adminDeleteLink);
  const links = useQuery({ queryKey: ["admin-links"], queryFn: () => linksFn() });
  const [search, setSearch] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-links"] });
  const toggleMut = useMutation({ mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }), onSuccess: () => { toast.success("Toggled"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: (v: { id: string; adsterra_url?: string; safe_url?: string; title?: string }) => updateFn({ data: v }), onSuccess: () => { toast.success("Updated"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  const filtered = useMemo(() => {
    const l = links.data ?? [];
    if (!search) return l;
    const q = search.toLowerCase();
    return l.filter((x) => x.short_code.toLowerCase().includes(q) || (x.title ?? "").toLowerCase().includes(q) || (x.owner_email ?? "").toLowerCase().includes(q));
  }, [links.data, search]);

  return (
    <Panel icon={Link2} title="All links" subtitle="Force disable, edit destination, view click/bot stats">
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8907A]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search short code, title, owner…" className={`${inputCls} pl-10`} />
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
              <Th>Code</Th><Th>Owner</Th><Th>Title</Th><Th>Destination</Th><Th>Clicks</Th><Th>Bots</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-[#FFE4D0]/60">
                <Td className="font-mono text-xs">{l.short_code}</Td>
                <Td className="text-xs text-[#7A5C45]">{l.owner_email}</Td>
                <Td>{l.title || <span className="text-[#A8907A]">—</span>}</Td>
                <Td className="max-w-[280px] truncate text-xs"><a href={l.adsterra_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] hover:underline">{l.adsterra_url}</a></Td>
                <Td>{l.clicks_count.toLocaleString()}</Td>
                <Td className="text-[#A8907A]">{l.bot_clicks_count.toLocaleString()}</Td>
                <Td>{l.is_active ? <span className="text-emerald-600 font-semibold">Active</span> : <span className="text-rose-600 font-semibold">Disabled</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: l.id, is_active: !l.is_active })} className="border-[#FFD4BB]">{l.is_active ? "Disable" : "Enable"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { const url = prompt("New destination URL:", l.adsterra_url); if (url) updateMut.mutate({ id: l.id, adsterra_url: url }); }} className="border-[#FFD4BB]">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete link "${l.short_code}"?`)) delMut.mutate({ id: l.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== REVENUE =====================
function RevenueTab() {
  const qc = useQueryClient();
  const upgradesFn = useServerFn(adminListUpgradeRequests);
  const decideFn = useServerFn(adminDecideUpgradeRequest);
  const revTsFn = useServerFn(adminRevenueTimeseries);
  const upgrades = useQuery({ queryKey: ["admin-upgrades"], queryFn: () => upgradesFn() });
  const revTs = useQuery({ queryKey: ["admin-rev-ts"], queryFn: () => revTsFn() });
  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) => decideFn({ data: v }),
    onSuccess: (_, v) => { toast.success(v.decision === "approve" ? "Approved" : "Rejected"); qc.invalidateQueries({ queryKey: ["admin-upgrades"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-rev-ts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const exportCsv = () => {
    const rows = upgrades.data ?? [];
    const csv = ["created_at,email,package,amount,status,invoice_id"].concat(rows.map((r) => `${r.created_at},${r.email},${r.package_slug},${r.amount},${r.status},${r.plisio_invoice_id ?? ""}`)).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `revenue-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Panel icon={DollarSign} title="Revenue · last 30 days">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={revTs.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#FF7E5F" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel icon={CreditCard} title="Upgrade requests" subtitle="Approve, reject, export to CSV">
        <div className="mb-4"><Button size="sm" onClick={exportCsv} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Export CSV</Button></div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>When</Th><Th>User</Th><Th>Package</Th><Th>Amount</Th><Th>Invoice</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody>
              {upgrades.data?.length ? upgrades.data.map((r) => (
                <tr key={r.id} className="border-t border-[#FFE4D0]/60">
                  <Td className="whitespace-nowrap text-[#7A5C45] text-xs">{new Date(r.created_at).toLocaleString()}</Td>
                  <Td>{r.email || r.user_id.slice(0, 8)}</Td>
                  <Td><Pill>{r.package_slug}</Pill></Td>
                  <Td className="font-semibold">${Number(r.amount).toFixed(2)}</Td>
                  <Td>{r.plisio_invoice_url ? <a href={r.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] font-semibold hover:underline">View</a> : <span className="text-[#A8907A]">—</span>}</Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td>{r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decideMut.mutate({ id: r.id, decision: "approve" })} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: r.id, decision: "reject" })} className="border-[#FFD4BB]">Reject</Button>
                    </div>
                  )}</Td>
                </tr>
              )) : <tr><td colSpan={7} className="p-8 text-center text-[#A8907A]">No upgrade requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ===================== PACKAGES =====================
type PkgForm = { id?: string; slug: string; name: string; price_usd: number; click_quota: number | null; link_limit: number | null; sort_order: number; is_active: boolean };
const emptyPkg: PkgForm = { slug: "", name: "", price_usd: 0, click_quota: null, link_limit: null, sort_order: 99, is_active: true };

function PackagesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAllPackages);
  const upFn = useServerFn(adminUpsertPackage);
  const delFn = useServerFn(adminDeletePackage);
  const list = useQuery({ queryKey: ["admin-pkgs-all"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<PkgForm | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ["admin-pkgs-all"] }); qc.invalidateQueries({ queryKey: ["admin-packages"] }); };
  const upMut = useMutation({ mutationFn: (v: PkgForm) => upFn({ data: v }), onSuccess: () => { toast.success("Saved"); inv(); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={Package} title="Packages" subtitle="Create, edit, delete pricing tiers">
      <div className="mb-4"><Button onClick={() => setEdit(emptyPkg)} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Plus className="w-4 h-4 mr-1" />New package</Button></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.data?.map((p) => (
          <div key={p.id} className={`p-4 rounded-2xl border ${p.is_active ? "bg-white/70 border-[#FFD4BB]" : "bg-white/30 border-[#A8907A]/40"}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-[#7A5C45]">{p.slug}</div>
                <div className="text-lg font-bold text-[#2D1B0D]">{p.name}</div>
              </div>
              <span className="text-2xl font-extrabold text-[#FF7E5F]">${Number(p.price_usd).toFixed(2)}</span>
            </div>
            <div className="mt-2 text-xs text-[#7A5C45]">{p.click_quota?.toLocaleString() ?? "∞"} clicks · {p.link_limit ?? "∞"} links</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, slug: p.slug, name: p.name, price_usd: Number(p.price_usd), click_quota: p.click_quota, link_limit: p.link_limit, sort_order: p.sort_order, is_active: p.is_active })} className="border-[#FFD4BB]">Edit</Button>
              <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete ${p.name}?`)) delMut.mutate({ id: p.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Slug (lowercase, no spaces)"><input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} className={inputCls} /></Field>
              <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price USD"><input type="number" step="0.01" value={edit.price_usd} onChange={(e) => setEdit({ ...edit, price_usd: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Sort order"><input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Click quota (blank = ∞)"><input type="number" value={edit.click_quota ?? ""} onChange={(e) => setEdit({ ...edit, click_quota: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Link limit (blank = ∞)"><input type="number" value={edit.link_limit ?? ""} onChange={(e) => setEdit({ ...edit, link_limit: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
              <Button onClick={() => upMut.mutate(edit)} disabled={upMut.isPending} className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">{upMut.isPending ? "Saving…" : "Save"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== RULES (bot + cloaking) =====================
type RuleForm = { id?: string; rule_type: string; pattern: string; action: string; label: string; is_active: boolean; priority?: number };

function RulesTab() {
  return (
    <div className="space-y-6">
      <RuleSection title="Bot rules" icon={Bot} listFnRef={adminListBotRules} upFnRef={adminUpsertBotRule} delFnRef={adminDeleteBotRule} keyName="bot-rules" showPriority={false} />
      <RuleSection title="Cloaking rules" icon={ShieldCheck} listFnRef={adminListCloakingRules} upFnRef={adminUpsertCloakingRule} delFnRef={adminDeleteCloakingRule} keyName="cloak-rules" showPriority />
    </div>
  );
}

function RuleSection({ title, icon, listFnRef, upFnRef, delFnRef, keyName, showPriority }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listFnRef: any; upFnRef: any; delFnRef: any;
  keyName: string; showPriority: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFnRef);
  const upFn = useServerFn(upFnRef);
  const delFn = useServerFn(delFnRef);
  const list = useQuery({ queryKey: [keyName], queryFn: () => listFn() });
  const [edit, setEdit] = useState<RuleForm | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: [keyName] });
  const upMut = useMutation({ mutationFn: (v: RuleForm) => upFn({ data: v as never }), onSuccess: () => { toast.success("Saved"); inv(); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={icon} title={title}>
      <div className="mb-4"><Button onClick={() => setEdit({ rule_type: "ua", pattern: "", action: "safe", label: "", is_active: true, priority: showPriority ? 100 : undefined })} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Plus className="w-4 h-4 mr-1" />New rule</Button></div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>Type</Th><Th>Pattern</Th><Th>Action</Th><Th>Label</Th>{showPriority && <Th>Pri</Th>}<Th>Active</Th><Th></Th></tr></thead>
          <tbody>
            {list.data?.map((r: any) => (
              <tr key={r.id} className="border-t border-[#FFE4D0]/60">
                <Td><Pill>{r.rule_type}</Pill></Td>
                <Td className="font-mono text-xs max-w-[280px] truncate">{r.pattern}</Td>
                <Td><Pill>{r.action}</Pill></Td>
                <Td className="text-[#7A5C45] text-xs">{r.label ?? "—"}</Td>
                {showPriority && <Td>{(r as { priority?: number }).priority}</Td>}
                <Td>{r.is_active ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-rose-600 font-semibold">No</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdit({ id: r.id, rule_type: r.rule_type, pattern: r.pattern, action: r.action, label: r.label ?? "", is_active: r.is_active, priority: (r as { priority?: number }).priority })} className="border-[#FFD4BB]">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete?")) delMut.mutate({ id: r.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit rule" : "New rule"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Type (ua, ip, asn, header…)"><input value={edit.rule_type} onChange={(e) => setEdit({ ...edit, rule_type: e.target.value })} className={inputCls} /></Field>
              <Field label="Pattern (regex or substring)"><input value={edit.pattern} onChange={(e) => setEdit({ ...edit, pattern: e.target.value })} className={inputCls} /></Field>
              <Field label="Action (safe, block, allow…)"><input value={edit.action} onChange={(e) => setEdit({ ...edit, action: e.target.value })} className={inputCls} /></Field>
              <Field label="Label (optional)"><input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className={inputCls} /></Field>
              {showPriority && <Field label="Priority (lower = earlier)"><input type="number" value={edit.priority ?? 100} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} className={inputCls} /></Field>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
              <Button onClick={() => upMut.mutate(edit)} disabled={upMut.isPending} className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">{upMut.isPending ? "Saving…" : "Save"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== GEO TIERS =====================
function GeoTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCountryTiers);
  const upFn = useServerFn(adminUpsertCountryTier);
  const delFn = useServerFn(adminDeleteCountryTier);
  const list = useQuery({ queryKey: ["geo-tiers"], queryFn: () => listFn() });
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [tier, setTier] = useState(1);
  const inv = () => qc.invalidateQueries({ queryKey: ["geo-tiers"] });
  const upMut = useMutation({ mutationFn: (v: { country_code: string; country_name: string | null; tier: number }) => upFn({ data: v }), onSuccess: () => { toast.success("Saved"); inv(); setCode(""); setName(""); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { country_code: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={Globe} title="Country tiers" subtitle="Tier 1 = highest payout, Tier 5 = lowest">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input placeholder="CC (2 letters)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} className={inputCls} />
        <input placeholder="Country name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} md:col-span-2`} />
        <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className={inputCls}>{[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <Button onClick={() => upMut.mutate({ country_code: code, country_name: name || null, tier })} disabled={code.length !== 2} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Add / Update</Button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>Code</Th><Th>Name</Th><Th>Tier</Th><Th></Th></tr></thead>
          <tbody>
            {list.data?.map((r) => (
              <tr key={r.country_code} className="border-t border-[#FFE4D0]/60">
                <Td className="font-mono font-bold">{r.country_code}</Td>
                <Td>{r.country_name ?? "—"}</Td>
                <Td><Pill>Tier {r.tier}</Pill></Td>
                <Td><Button size="sm" variant="outline" onClick={() => { if (confirm(`Remove ${r.country_code}?`)) delMut.mutate({ country_code: r.country_code }); }} className="border-rose-300 text-rose-600"><X className="w-3 h-3" /></Button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== TRAFFIC SETTINGS =====================
function TrafficTab() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getAppSettings);
  const updateSettingsFn = useServerFn(updateAppSettings);
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => settingsFn() });
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [ourUrl, setOurUrl] = useState("");
  const [threshold, setThreshold] = useState(5000);
  const [count, setCount] = useState(50);
  const [dailyOn, setDailyOn] = useState(true);
  useEffect(() => {
    if (settings.data) {
      setFallbackUrl(settings.data.fallback_url);
      setOurUrl(settings.data.our_adsterra_url);
      setThreshold(settings.data.injection_threshold);
      setCount(settings.data.injection_count);
      setDailyOn(settings.data.daily_redirect_enabled);
    }
  }, [settings.data]);
  const saveMut = useMutation({
    mutationFn: () => updateSettingsFn({ data: { fallback_url: fallbackUrl, our_adsterra_url: ourUrl, injection_threshold: Number(threshold), injection_count: Number(count), daily_redirect_enabled: dailyOn } }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["app-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel icon={Settings2} title="Traffic & Monetization">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fallback / Daily redirect URL"><input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)} className={inputCls} /></Field>
        <Field label="Our Adsterra Direct URL"><input value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} className={inputCls} /></Field>
        <Field label="Injection threshold"><input type="number" min={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Injection count"><input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} /></Field>
        <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={dailyOn} onChange={(e) => setDailyOn(e.target.checked)} className="w-4 h-4 accent-[#FF7E5F]" />
          <span className="text-sm">Daily auto-redirect on first dashboard login</span>
        </label>
      </div>
      <div className="mt-6"><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Sparkles className="w-4 h-4 mr-1.5" />{saveMut.isPending ? "Saving…" : "Save settings"}</Button></div>
    </Panel>
  );
}

// ===================== shared UI =====================
const inputCls = "w-full bg-white/70 border border-[#FFD4BB] rounded-xl px-4 py-2.5 text-sm text-[#2D1B0D] placeholder:text-[#A8907A] focus:outline-none focus:border-[#FF7E5F] focus:bg-white/90 transition-all";

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-5 border backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(255,126,95,0.25)] ${accent ? "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] border-white/40 text-white" : "bg-white/70 border-white/80 text-[#2D1B0D]"}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-white/80" : "text-[#7A5C45]"}`}>{label}</div>
        <Icon className={`w-4 h-4 ${accent ? "text-white/90" : "text-[#FF7E5F]"}`} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-[10px] ${accent ? "text-white/80" : "text-[#A8907A]"}`}>{sub}</div>}
    </div>
  );
}
function Panel({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]"><Icon className="w-4 h-4 text-white" /></div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#2D1B0D] tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-[#7A5C45] mb-6 ml-12">{subtitle}</p>}
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A5C45] mb-2 block">{label}</label>{children}</div>;
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="p-3 rounded-xl bg-white/60 border border-[#FFE4D0]"><div className="text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">{label}</div><div className="mt-1 font-bold text-[#2D1B0D]">{value}</div></div>;
}
function Th({ children }: { children?: React.ReactNode }) { return <th className="px-3 py-3">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 ${className}`}>{children}</td>; }
function Pill({ children }: { children: React.ReactNode }) { return <span className="inline-flex px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#FF7E5F] text-xs font-semibold">{children}</span>; }
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { paid: "bg-emerald-100 text-emerald-700", completed: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700", rejected: "bg-rose-100 text-rose-700" };
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${map[status] ?? "bg-[#FFEDD5] text-[#7A5C45]"}`}>{status}</span>;
}
