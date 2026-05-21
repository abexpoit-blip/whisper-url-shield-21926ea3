import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Rocket } from "lucide-react";
import {
  getMyPlan,
  requestUpgrade,
  listMyUpgradeRequests,
  getPublicPaymentSettings,
} from "@/lib/billing.functions";
import { createPlisioInvoice } from "@/lib/plisio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { requireClientUser } from "@/lib/auth-guard";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

export const Route = createFileRoute("/upgrade")({
  beforeLoad: ({ location }) => requireClientUser(location.href),
  component: UpgradePage,
});

function UpgradePage() {
  const qc = useQueryClient();
  const mine = useServerFn(getMyPlan);
  const myReqs = useServerFn(listMyUpgradeRequests);
  const submit = useServerFn(requestUpgrade);
  const getSettings = useServerFn(getPublicPaymentSettings);

  const { data: pkgs = [], isLoading: packagesLoading, error: packagesError } = useQuery({
    queryKey: ["packages-active"],
    queryFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/packages?select=id,slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order,is_active,created_at&is_active=eq.true&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
  });
  const { data: plan } = useQuery({ queryKey: ["my-plan"], queryFn: () => mine() });
  const { data: requests = [] } = useQuery({ queryKey: ["my-upgrade-requests"], queryFn: () => myReqs() });
  const { data: settings } = useQuery({
    queryKey: ["payment-settings-public"],
    queryFn: () => getSettings().catch(() => null),
  });

  const [picked, setPicked] = useState<any | null>(null);
  const [txRef, setTxRef] = useState("");
  const [note, setNote] = useState("");

  const reqM = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error("Choose a package first");
      return submit({
        data: {
          package_slug: picked.slug,
          payment_method: "manual",
          transaction_ref: txRef || undefined,
          note: note || undefined,
        },
      });
    },
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
        {packagesLoading && ["free", "pro", "lifetime"].map((key) => (
          <Card key={key} className="min-h-72 animate-pulse border-primary/10 bg-card/70" />
        ))}
        {!packagesLoading && packagesError && (
          <Card className="md:col-span-3 border-destructive/30 bg-destructive/10">
            <CardContent className="p-5 text-sm text-destructive">
              Packages could not load. Please refresh or login again.
            </CardContent>
          </Card>
        )}
        {visible.map((p: any) => {
          const isCurrent = plan?.plan_slug === p.slug;
          const isLifetime = p.billing_period === "lifetime" || Number(p.price_onetime) > 0;
          const price = isLifetime ? Number(p.price_onetime) : Number(p.price_monthly);
          const periodLabel = isLifetime ? "one-time" : "/mo";
          const clickLabel =
            p.click_limit == null
              ? "Unlimited clicks"
              : `${Number(p.click_limit).toLocaleString()} clicks${isLifetime ? " — lifetime" : " / month"}`;
          const linkLabel =
            p.link_limit == null || p.link_limit >= 999999 ? "Unlimited links" : `${p.link_limit} links included`;
          const isFree = price === 0 && !isLifetime;
          return (
            <Card key={p.id} className={`flex flex-col ${isLifetime ? "border-primary shadow-lg" : ""} ${isCurrent ? "ring-2 ring-primary" : ""}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {p.name}
                    {isLifetime && <Badge variant="default" className="bg-gradient-to-r from-primary to-primary/70">Best value</Badge>}
                  </span>
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${price.toFixed(2)}</span>
                  <span className="text-muted-foreground"> {periodLabel}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-3 space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                  <div className="font-medium">{linkLabel}</div>
                  <div className="text-muted-foreground">{clickLabel}</div>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {(p.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  disabled={isCurrent || isFree}
                  onClick={() => setPicked(p)}
                >
                  {isCurrent ? "Current plan" : isFree ? "Free forever" : isLifetime ? "Get lifetime access" : "Request upgrade"}
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
