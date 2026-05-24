import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Link2, MousePointerClick, Sparkles, Settings2, ShieldCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats,
  adminListUsers,
  adminBanUser,
  adminListPackages,
  adminSetUserPlan,
  adminListUpgradeRequests,
  adminDecideUpgradeRequest,
} from "@/lib/admin.functions";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings.functions";

export const Route = createFileRoute("/_authenticated/control-panel")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/admin-login" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Control Panel — Sleepox" }] }),
  component: AdminPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function AdminPage() {
  const qc = useQueryClient();
  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const banFn = useServerFn(adminBanUser);
  const settingsFn = useServerFn(getAppSettings);
  const updateSettingsFn = useServerFn(updateAppSettings);
  const packagesFn = useServerFn(adminListPackages);
  const setPlanFn = useServerFn(adminSetUserPlan);
  const upgradesFn = useServerFn(adminListUpgradeRequests);
  const decideFn = useServerFn(adminDecideUpgradeRequest);

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => settingsFn() });
  const packages = useQuery({ queryKey: ["admin-packages"], queryFn: () => packagesFn() });
  const upgrades = useQuery({ queryKey: ["admin-upgrades"], queryFn: () => upgradesFn() });

  const banMut = useMutation({
    mutationFn: (v: { id: string; is_banned: boolean }) => banFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const planMut = useMutation({
    mutationFn: (v: { user_id: string; package_slug: string }) => setPlanFn({ data: v }),
    onSuccess: () => { toast.success("Plan updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) => decideFn({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.decision === "approve" ? "Approved & plan applied" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-upgrades"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    mutationFn: () => updateSettingsFn({
      data: {
        fallback_url: fallbackUrl,
        our_adsterra_url: ourUrl,
        injection_threshold: Number(threshold),
        injection_count: Number(count),
        daily_redirect_enabled: dailyOn,
      },
    }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["app-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative min-h-screen bg-[#FFF9F5] text-[#4A3728] overflow-hidden" style={font}>
      {/* warm blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/15 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[#FEB47B]/20 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed top-[40%] left-[35%] w-[35%] h-[35%] bg-[#FFEDD5]/40 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-8 lg:p-12 space-y-10 max-w-[1500px] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
              <ShieldCheck className="w-3 h-3" /> Admin · Live
            </div>
            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#2D1B0D]">
              Control{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">
                Panel
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#7A5C45]">Monitor traffic, manage users & approve upgrades.</p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={Users} label="Users" value={stats.data?.users ?? "…"} />
          <Kpi icon={Link2} label="Links" value={stats.data?.links ?? "…"} />
          <Kpi icon={MousePointerClick} label="Clicks" value={stats.data?.clicks ?? "…"} />
          <Kpi icon={CreditCard} label="Pending upgrades" value={stats.data?.pending ?? "…"} accent />
        </div>

        {/* Traffic settings */}
        <Panel
          icon={Settings2}
          title="Traffic & Monetization"
          subtitle="Quota-overflow routing, every-N injection, daily redirect on login."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fallback / Daily redirect URL">
              <input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Our Adsterra Direct URL (rotation + overflow)">
              <input value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Injection threshold (clicks before rotation)">
              <input type="number" min={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Injection count (clicks routed to us)">
              <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} />
            </Field>
            <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={dailyOn} onChange={(e) => setDailyOn(e.target.checked)} className="w-4 h-4 accent-[#FF7E5F]" />
              <span className="text-sm text-[#4A3728]">Daily auto-redirect on first dashboard login</span>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || settings.isLoading}
              className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] hover:opacity-90 text-white font-semibold shadow-[0_8px_30px_-8px_rgba(255,126,95,0.5)] border-0"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {saveMut.isPending ? "Saving…" : "Save settings"}
            </Button>
            <p className="text-xs text-[#7A5C45]">
              Every <span className="font-semibold text-[#FF7E5F]">{threshold.toLocaleString()}</span> user clicks → next{" "}
              <span className="font-semibold text-[#FF7E5F]">{count}</span> go to your link → repeat.
            </p>
          </div>
        </Panel>

        {/* Upgrade requests */}
        <Panel icon={CreditCard} title="Upgrade requests" subtitle="Review Plisio crypto payments and apply plans.">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
                  <Th>When</Th><Th>User</Th><Th>Package</Th><Th>Amount</Th><Th>Invoice</Th><Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {upgrades.data?.length ? upgrades.data.map((r) => (
                  <tr key={r.id} className="border-t border-[#FFE4D0]/60">
                    <Td className="whitespace-nowrap text-[#7A5C45]">{new Date(r.created_at).toLocaleString()}</Td>
                    <Td>{r.email || r.user_id.slice(0, 8)}</Td>
                    <Td><Pill>{r.package_slug}</Pill></Td>
                    <Td className="font-semibold">${Number(r.amount).toFixed(2)}</Td>
                    <Td>{r.plisio_invoice_url ? <a href={r.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] font-semibold hover:underline">View</a> : <span className="text-[#A8907A]">—</span>}</Td>
                    <Td><StatusPill status={r.status} /></Td>
                    <Td>
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => decideMut.mutate({ id: r.id, decision: "approve" })}
                            className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] hover:opacity-90 text-white border-0">Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: r.id, decision: "reject" })}
                            className="border-[#FFD4BB] text-[#4A3728] hover:bg-[#FFEDD5]">Reject</Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="p-8 text-center text-[#A8907A]">No upgrade requests yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Users */}
        <Panel icon={Users} title="Users" subtitle="Change plan, ban / unban, monitor quotas.">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
                  <Th>Email</Th><Th>Plan</Th><Th>Change plan</Th><Th>Links</Th><Th>Clicks</Th><Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id} className="border-t border-[#FFE4D0]/60">
                    <Td className="font-medium text-[#2D1B0D]">{u.email}</Td>
                    <Td><Pill>{u.plan_slug}</Pill></Td>
                    <Td>
                      <select
                        value={u.plan_slug}
                        onChange={(e) => {
                          if (e.target.value !== u.plan_slug && confirm(`Change ${u.email} to ${e.target.value}?`)) {
                            planMut.mutate({ user_id: u.id, package_slug: e.target.value });
                          }
                        }}
                        className="bg-white/80 border border-[#FFD4BB] rounded-lg px-2 py-1 text-xs text-[#4A3728] focus:outline-none focus:border-[#FF7E5F]"
                      >
                        {packages.data?.map((p) => (
                          <option key={p.slug} value={p.slug}>{p.name}</option>
                        ))}
                        {!packages.data?.some((p) => p.slug === u.plan_slug) && (
                          <option value={u.plan_slug}>{u.plan_slug}</option>
                        )}
                      </select>
                    </Td>
                    <Td className="text-[#7A5C45]">{u.links_used} / {u.link_limit}</Td>
                    <Td className="text-[#7A5C45]">{u.clicks_used.toLocaleString()}{u.click_quota ? ` / ${u.click_quota.toLocaleString()}` : " / ∞"}</Td>
                    <Td>{u.is_banned ? <span className="text-rose-600 font-semibold">Banned</span> : <span className="text-emerald-600 font-semibold">Active</span>}</Td>
                    <Td>
                      <Button size="sm" variant="outline" onClick={() => banMut.mutate({ id: u.id, is_banned: !u.is_banned })}
                        className="border-[#FFD4BB] text-[#4A3728] hover:bg-[#FFEDD5]">
                        {u.is_banned ? "Unban" : "Ban"}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white/70 border border-[#FFD4BB] rounded-xl px-4 py-3 text-sm text-[#2D1B0D] placeholder:text-[#A8907A] focus:outline-none focus:border-[#FF7E5F] focus:bg-white/90 transition-all";

function Kpi({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-5 border backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(255,126,95,0.25)] ${accent ? "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] border-white/40 text-white" : "bg-white/70 border-white/80 text-[#2D1B0D]"}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-white/80" : "text-[#7A5C45]"}`}>{label}</div>
        <Icon className={`w-4 h-4 ${accent ? "text-white/90" : "text-[#FF7E5F]"}`} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function Panel({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#2D1B0D] tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-[#7A5C45] mb-6 ml-12">{subtitle}</p>}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A5C45] mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-3">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#FF7E5F] text-xs font-semibold">{children}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700",
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${map[status] ?? "bg-[#FFEDD5] text-[#7A5C45]"}`}>{status}</span>;
}
