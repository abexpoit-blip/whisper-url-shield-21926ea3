import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminStats, adminListUsers, adminBanUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — Sleepox" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const banFn = useServerFn(adminBanUser);
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const banMut = useMutation({
    mutationFn: (v: { id: string; is_banned: boolean }) => banFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Users" value={stats.data?.users ?? "..."} />
        <Stat label="Links" value={stats.data?.links ?? "..."} />
        <Stat label="Clicks" value={stats.data?.clicks ?? "..."} />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Links</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.plan_slug}</td>
                  <td className="p-3">{u.links_used} / {u.link_limit}</td>
                  <td className="p-3">{u.clicks_used.toLocaleString()}</td>
                  <td className="p-3">{u.is_banned ? <span className="text-red-600">Banned</span> : <span className="text-green-600">Active</span>}</td>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
