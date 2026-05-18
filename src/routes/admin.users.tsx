import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Users, RefreshCw, ShieldAlert, ShieldCheck, Search, Loader2 } from "lucide-react";
import { listMembers, setMemberRole } from "@/lib/admin-users.functions";
import { isAdmin as isAdminFn } from "@/lib/admin-variants.functions";
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

function AdminUsersPage() {
  const checkAdmin = useServerFn(isAdminFn);
  const fetchMembers = useServerFn(listMembers);
  const mutateRole = useServerFn(setMemberRole);

  const [admin, setAdmin] = useState<boolean | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);

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
    void checkAdmin().then((r) => {
      setAdmin(r.isAdmin);
      if (r.isAdmin) void refresh("");
      else setLoading(false);
    });
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

  if (admin === false) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h1 className="font-display text-2xl font-bold">Admin only</h1>
        <p className="mt-2 text-muted-foreground">You need the admin role to manage members.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Members & Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Promote or demote users between admin and standard roles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void refresh(search);
            }}
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

      <div className="overflow-hidden rounded-lg border border-border">
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
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
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
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {m.plan_slug}
                      </span>
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
                            <span
                              key={r}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                r === "admin"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {r === "admin" && <ShieldCheck className="h-3 w-3" />}
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleAdmin(m)}
                        disabled={pending === m.id}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition disabled:opacity-50 ${
                          isAdminUser
                            ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                            : "border-primary/40 text-primary hover:bg-primary/10"
                        }`}
                      >
                        {pending === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        {isAdminUser ? "Revoke admin" : "Make admin"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
