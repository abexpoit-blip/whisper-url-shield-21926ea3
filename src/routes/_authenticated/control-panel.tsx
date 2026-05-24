import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
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


  // ── App-wide settings form ─────────────────────────────────────────
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
    <div className="p-5 sm:p-8 lg:p-12 space-y-10">
      <h1 className="text-3xl sm:text-4xl font-medium text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        Control Panel
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Users" value={stats.data?.users ?? "..."} />
        <Stat label="Links" value={stats.data?.links ?? "..."} />
        <Stat label="Clicks" value={stats.data?.clicks ?? "..."} />
        <Stat label="Pending upgrades" value={stats.data?.pending ?? "..."} />
      </div>

      {/* App-wide traffic settings */}
      <section className="p-6 sm:p-8 border border-teal-400/20 bg-teal-500/[0.03] backdrop-blur-xl rounded-3xl shadow-[0_0_60px_rgba(45,212,191,0.08)]">
        <h2 className="text-xl sm:text-2xl font-medium text-white mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Traffic & Monetization
        </h2>
        <p className="text-sm text-white/40 mb-6">
          Controls quota-overflow routing, the every-N rotation injection, and daily auto-redirect on login.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Fallback / Daily redirect URL">
            <input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)} className={fieldCls} />
          </Field>
          <Field label="Our Adsterra Direct URL (rotation + overflow)">
            <input value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} className={fieldCls} />
          </Field>
          <Field label="Injection threshold (clicks before rotation kicks in)">
            <input type="number" min={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={fieldCls} />
          </Field>
          <Field label="Injection count (how many clicks routed to us)">
            <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={fieldCls} />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={dailyOn} onChange={(e) => setDailyOn(e.target.checked)} className="w-4 h-4 accent-teal-400" />
            <span className="text-sm text-white/80">Daily auto-redirect on first dashboard login</span>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || settings.isLoading}
            className="bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white shadow-[0_0_25px_rgba(45,212,191,0.35)]"
          >
            {saveMut.isPending ? "Saving…" : "Save settings"}
          </Button>
          <p className="text-xs text-white/40 self-center">
            Rotation: every <span className="text-teal-300">{threshold.toLocaleString()}</span> user clicks → next <span className="text-teal-300">{count}</span> go to your link → repeat.
          </p>
        </div>
      </section>

      {/* Upgrade requests */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Upgrade requests</h2>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/60">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">User</th>
                <th className="p-3">Package</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {upgrades.data?.length ? upgrades.data.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-3 whitespace-nowrap text-white/60">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">{r.email || r.user_id.slice(0, 8)}</td>
                  <td className="p-3">{r.package_slug}</td>
                  <td className="p-3">${Number(r.amount).toFixed(2)}</td>
                  <td className="p-3">
                    {r.plisio_invoice_url
                      ? <a href={r.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-teal-300 hover:underline">View</a>
                      : <span className="text-white/30">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={
                      r.status === "paid" ? "text-teal-300" :
                      r.status === "rejected" ? "text-red-400" :
                      "text-amber-300"
                    }>{r.status}</span>
                  </td>
                  <td className="p-3">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decideMut.mutate({ id: r.id, decision: "approve" })}
                          className="bg-teal-500 hover:bg-teal-400 text-black">Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: r.id, decision: "reject" })}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-6 text-center text-white/40">No upgrade requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/60">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Change plan</th>
                <th className="p-3">Links</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {users.data?.map((u) => (
                <tr key={u.id} className="border-t border-white/10">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80">{u.plan_slug}</span></td>
                  <td className="p-3">
                    <select
                      value={u.plan_slug}
                      onChange={(e) => {
                        if (e.target.value !== u.plan_slug && confirm(`Change ${u.email} to ${e.target.value}?`)) {
                          planMut.mutate({ user_id: u.id, package_slug: e.target.value });
                        }
                      }}
                      className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs text-white"
                    >
                      {packages.data?.map((p) => (
                        <option key={p.slug} value={p.slug} className="bg-zinc-900">{p.name}</option>
                      ))}
                      {/* fallback option for unknown slug so the select stays controlled */}
                      {!packages.data?.some((p) => p.slug === u.plan_slug) && (
                        <option value={u.plan_slug} className="bg-zinc-900">{u.plan_slug}</option>
                      )}
                    </select>
                  </td>
                  <td className="p-3">{u.links_used} / {u.link_limit}</td>
                  <td className="p-3">{u.clicks_used.toLocaleString()}{u.click_quota ? ` / ${u.click_quota.toLocaleString()}` : " / ∞"}</td>
                  <td className="p-3">{u.is_banned ? <span className="text-red-400">Banned</span> : <span className="text-teal-300">Active</span>}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => banMut.mutate({ id: u.id, is_banned: !u.is_banned })}>
                      {u.is_banned ? "Unban" : "Ban"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const fieldCls =
  "w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400/50 focus:bg-white/[0.05] transition-all text-white placeholder:text-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5">
      <div className="text-xs text-white/40 uppercase tracking-widest font-bold">{label}</div>
      <div className="mt-2 text-3xl font-medium text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}
