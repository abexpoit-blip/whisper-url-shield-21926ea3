import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Users, RefreshCw, ShieldCheck, Search, Loader2,
  MoreVertical, KeyRound, Package, PlusCircle, LogIn,
} from "lucide-react";
import {
  listMembers, setMemberRole, listPackages, updateMemberPlan,
  topUpMemberQuota, changeMemberPassword, impersonateMember,
} from "@/lib/admin-users.functions";
import { beginImpersonation } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Members & Roles" }] }),
  component: AdminUsersPage,
});

type Member = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan_slug: string;
  link_quota: number;
  links_used: number;
  is_banned: boolean;
  created_at: string;
  roles: string[];
};

type Pkg = { slug: string; name: string; link_limit: number; price_monthly: number };

type ActionKind = "plan" | "topup" | "password" | null;

function AdminUsersPage() {
  const fetchMembers = useServerFn(listMembers);
  const fetchPackages = useServerFn(listPackages);
  const mutateRole = useServerFn(setMemberRole);
  const mutatePlan = useServerFn(updateMemberPlan);
  const mutateTopUp = useServerFn(topUpMemberQuota);
  const mutatePass = useServerFn(changeMemberPassword);
  const mutateImp = useServerFn(impersonateMember);

  const [members, setMembers] = useState<Member[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  // Modal state
  const [openKind, setOpenKind] = useState<ActionKind>(null);
  const [target, setTarget] = useState<Member | null>(null);
  const [planSlug, setPlanSlug] = useState("");
  const [planQuota, setPlanQuota] = useState<string>("");
  const [topUpAmt, setTopUpAmt] = useState<string>("10");
  const [newPass, setNewPass] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  const refresh = async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMembers({ data: { search: q, limit: 200 } });
      setMembers(res.members as Member[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      refresh(""),
      fetchPackages().then((p) => setPackages(p.packages as Pkg[])).catch(() => undefined),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAdmin = async (m: Member) => {
    const isAdminUser = m.roles.includes("admin");
    const action = isAdminUser ? "revoke" : "grant";
    const verb = isAdminUser ? "Revoke admin from" : "Grant admin to";
    if (!confirm(`${verb} ${m.email ?? m.id}?`)) return;
    setPending(m.id);
    try {
      await mutateRole({ data: { userId: m.id, role: "admin", action } });
      toast.success(`Admin role ${action === "grant" ? "granted" : "revoked"}.`);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const openPlan = (m: Member) => {
    setTarget(m); setPlanSlug(m.plan_slug); setPlanQuota(String(m.link_quota));
    setOpenKind("plan");
  };
  const openTopUp = (m: Member) => {
    setTarget(m); setTopUpAmt("10"); setOpenKind("topup");
  };
  const openPass = (m: Member) => {
    setTarget(m); setNewPass(""); setOpenKind("password");
  };

  const submitPlan = async () => {
    if (!target) return;
    setModalBusy(true);
    try {
      const q = planQuota.trim() ? parseInt(planQuota, 10) : undefined;
      await mutatePlan({ data: { userId: target.id, planSlug, linkQuota: Number.isFinite(q) ? q : undefined } });
      toast.success("Plan updated");
      setOpenKind(null);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setModalBusy(false); }
  };

  const submitTopUp = async () => {
    if (!target) return;
    const n = parseInt(topUpAmt, 10);
    if (!Number.isFinite(n) || n < 1) return toast.error("Enter a positive number");
    setModalBusy(true);
    try {
      const res = await mutateTopUp({ data: { userId: target.id, addQuota: n } });
      toast.success(`Quota topped up. New total: ${res.newQuota}`);
      setOpenKind(null);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setModalBusy(false); }
  };

  const submitPass = async () => {
    if (!target) return;
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");
    setModalBusy(true);
    try {
      await mutatePass({ data: { userId: target.id, newPassword: newPass } });
      toast.success("Password changed");
      setOpenKind(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setModalBusy(false); }
  };

  const doImpersonate = async (m: Member) => {
    if (!m.email) return toast.error("User has no email on file");
    if (!confirm(`Sign in as ${m.email}? You can return to your admin account using the banner.`)) return;
    setPending(m.id);
    try {
      const res = await mutateImp({ data: { userId: m.id } });
      await beginImpersonation({ hashedToken: res.hashedToken, targetEmail: res.email });
      toast.success(`Signed in as ${res.email}`);
      // Send to user dashboard
      window.location.assign("/dashboard");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setPending(null); }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Members & Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage plans, top up quota, reset passwords and impersonate users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); void refresh(search); }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or name…"
              className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm"
            />
          </form>
          <button
            type="button"
            onClick={() => void refresh(search)}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Usage</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && members.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No members found.</td></tr>
            ) : (
              members.map((m) => {
                const isAdminUser = m.roles.includes("admin");
                return (
                  <tr key={m.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.full_name ?? "No name"} ·{" "}
                        <span className="font-mono">{m.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{m.plan_slug}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.links_used} / {m.link_quota}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">none</span>
                        ) : (
                          m.roles.map((r) => (
                            <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              r === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {r === "admin" && <ShieldCheck className="h-3 w-3" />}
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                          onClick={() => doImpersonate(m)} disabled={pending === m.id}>
                          {pending === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                          Login as
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">Manage user</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openPlan(m)}>
                              <Package className="mr-2 h-4 w-4" /> Edit plan & quota
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTopUp(m)}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Top up quota
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPass(m)}>
                              <KeyRound className="mr-2 h-4 w-4" /> Change password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleAdmin(m)}
                              className={isAdminUser ? "text-destructive focus:text-destructive" : ""}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              {isAdminUser ? "Revoke admin" : "Make admin"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Plan modal */}
      <Dialog open={openKind === "plan"} onOpenChange={(v) => !v && setOpenKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit plan — {target?.email}</DialogTitle>
            <DialogDescription>
              Changing the plan will update the package and may sync the quota automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Package</Label>
              <select value={planSlug} onChange={(e) => {
                const s = e.target.value; setPlanSlug(s);
                const p = packages.find((x) => x.slug === s);
                if (p) setPlanQuota(String(p.link_limit));
              }}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
                {packages.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name} — {p.link_limit} links {p.price_monthly ? `· $${p.price_monthly}/mo` : "· free"}
                  </option>
                ))}
                {!packages.find((p) => p.slug === planSlug) && planSlug && (
                  <option value={planSlug}>{planSlug} (current)</option>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Link quota override (optional)</Label>
              <Input type="number" min={0} value={planQuota} onChange={(e) => setPlanQuota(e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave blank to use the package's default quota.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenKind(null)} disabled={modalBusy}>Cancel</Button>
            <Button onClick={submitPlan} disabled={modalBusy}>
              {modalBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up modal */}
      <Dialog open={openKind === "topup"} onOpenChange={(v) => !v && setOpenKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up quota — {target?.email}</DialogTitle>
            <DialogDescription>
              Current quota: {target?.link_quota}. New links will be added on top.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Add links</Label>
            <Input type="number" min={1} value={topUpAmt} onChange={(e) => setTopUpAmt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenKind(null)} disabled={modalBusy}>Cancel</Button>
            <Button onClick={submitTopUp} disabled={modalBusy}>
              {modalBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Top up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password modal */}
      <Dialog open={openKind === "password"} onOpenChange={(v) => !v && setOpenKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password — {target?.email}</DialogTitle>
            <DialogDescription>
              The user will need to use the new password on their next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="text" autoComplete="new-password" value={newPass}
              onChange={(e) => setNewPass(e.target.value)} placeholder="Minimum 8 characters" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenKind(null)} disabled={modalBusy}>Cancel</Button>
            <Button onClick={submitPass} disabled={modalBusy}>
              {modalBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
