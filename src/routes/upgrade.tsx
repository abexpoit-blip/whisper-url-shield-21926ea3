import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Rocket } from "lucide-react";
import {
  listPackages,
  getMyPlan,
  requestUpgrade,
  listMyUpgradeRequests,
  getPaymentSettings,
} from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/upgrade")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: UpgradePage,
});

function UpgradePage() {
  const qc = useQueryClient();
  // Note: listPackages requires auth; this page must be visited while signed in.
  const list = useServerFn(listPackages);
  const mine = useServerFn(getMyPlan);
  const myReqs = useServerFn(listMyUpgradeRequests);
  const submit = useServerFn(requestUpgrade);
  const getSettings = useServerFn(getPaymentSettings);

  const { data: pkgs = [] } = useQuery({ queryKey: ["packages-active"], queryFn: () => list() });
  const { data: plan } = useQuery({ queryKey: ["my-plan"], queryFn: () => mine() });
  const { data: requests = [] } = useQuery({ queryKey: ["my-upgrade-requests"], queryFn: () => myReqs() });
  // Settings query is admin-only; ignore failures
  const { data: settings } = useQuery({
    queryKey: ["payment-settings-public"],
    queryFn: () => getSettings().catch(() => null),
  });

  const [picked, setPicked] = useState<any | null>(null);
  const [txRef, setTxRef] = useState("");
  const [note, setNote] = useState("");

  const reqM = useMutation({
    mutationFn: () =>
      submit({
        data: {
          package_slug: picked.slug,
          payment_method: "manual",
          transaction_ref: txRef || undefined,
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Request submitted — admin will review shortly");
      setPicked(null); setTxRef(""); setNote("");
      qc.invalidateQueries({ queryKey: ["my-upgrade-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const visible = pkgs.filter((p: any) => p.is_active);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Rocket className="h-7 w-7 text-primary" /> Upgrade your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You're on <Badge variant="outline">{plan?.plan_slug ?? "free"}</Badge> · {plan?.links_used ?? 0}/{plan?.link_quota ?? 1} links used.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {visible.map((p: any) => {
          const isCurrent = plan?.plan_slug === p.slug;
          return (
            <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${Number(p.price_monthly).toFixed(2)}</span>
                  <span className="text-muted-foreground"> /mo</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 text-sm font-medium">{p.link_limit} links included</div>
                <ul className="space-y-2 text-sm">
                  {(p.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" />{f}</li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  disabled={isCurrent || Number(p.price_monthly) === 0}
                  onClick={() => setPicked(p)}
                >
                  {isCurrent ? "Current plan" : Number(p.price_monthly) === 0 ? "Free" : "Request upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Your upgrade requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upgrade requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <div className="font-medium">{r.package_slug} · ${Number(r.amount ?? 0).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.payment_method}</div>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Request {picked?.name}</DialogTitle>
            <DialogDescription>
              {settings?.payment_instructions ?? "Send payment via the method described by admin, then submit the transaction reference below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Transaction reference (optional)</Label><Input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="Plisio invoice ID / TXID / bKash txn" /></div>
            <div><Label>Note for admin (optional)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicked(null)}>Cancel</Button>
            <Button onClick={() => reqM.mutate()} disabled={reqM.isPending}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
