import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, XCircle, ExternalLink, Eye, Copy, ShieldCheck, ShieldAlert, Bitcoin } from "lucide-react";
import {
  getPaymentSettings,
  updatePaymentSettings,
  listAllUpgradeRequests,
  reviewUpgradeRequest,
  getUpgradeRequestDetail,
} from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/payments")({ component: AdminPaymentsPage });

function copy(value: string, label = "Copied") {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed"),
  );
}

function statusBadge(s?: string | null) {
  if (!s) return <Badge variant="outline">—</Badge>;
  if (s === "approved" || s === "completed") return <Badge className="bg-emerald-600 hover:bg-emerald-600">{s}</Badge>;
  if (s === "rejected" || s === "error" || s === "cancelled" || s === "expired") return <Badge variant="destructive">{s}</Badge>;
  if (s === "mismatch") return <Badge className="bg-amber-600 hover:bg-amber-600">{s}</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getPaymentSettings);
  const saveSettings = useServerFn(updatePaymentSettings);
  const listReqs = useServerFn(listAllUpgradeRequests);
  const review = useServerFn(reviewUpgradeRequest);
  const getDetail = useServerFn(getUpgradeRequestDetail);

  const { data: settings } = useQuery({ queryKey: ["admin", "payment-settings"], queryFn: () => getSettings() });
  const { data: reqs = [] } = useQuery({
    queryKey: ["admin", "upgrade-requests"],
    queryFn: () => listReqs(),
    refetchInterval: 20000,
  });

  const [form, setForm] = useState({
    plisio_enabled: false,
    plisio_api_key: "",
    plisio_webhook_secret: "",
    payment_instructions: "",
  });
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        plisio_enabled: settings.plisio_enabled ?? false,
        plisio_api_key: settings.plisio_api_key ?? "",
        plisio_webhook_secret: settings.plisio_webhook_secret ?? "",
        payment_instructions: settings.payment_instructions ?? "",
      });
    }
  }, [settings]);

  const saveM = useMutation({
    mutationFn: () => saveSettings({ data: form }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "payment-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reviewM = useMutation({
    mutationFn: (vars: { id: string; approve: boolean }) => review({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Approved & plan assigned" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin", "upgrade-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const detailQ = useQuery({
    queryKey: ["admin", "upgrade-detail", detailId],
    queryFn: () => getDetail({ data: { id: detailId! } }),
    enabled: !!detailId,
    refetchInterval: detailId ? 10000 : false,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><CreditCard className="h-6 w-6" /> Payments</h1>
        <p className="text-sm text-muted-foreground">Configure Plisio, review upgrade requests, and inspect webhook activity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plisio (crypto gateway)</CardTitle>
          <CardDescription>Runtime API key is read from the <code>PLISIO_API_KEY</code> secret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={form.plisio_enabled} onCheckedChange={(v) => setForm({ ...form, plisio_enabled: v })} />
            <Label>Enable Plisio</Label>
          </div>
          <div><Label>Plisio API key (reference)</Label><Input value={form.plisio_api_key} onChange={(e) => setForm({ ...form, plisio_api_key: e.target.value })} /></div>
          <div><Label>Webhook secret (reference)</Label><Input value={form.plisio_webhook_secret} onChange={(e) => setForm({ ...form, plisio_webhook_secret: e.target.value })} /></div>
          <div><Label>Payment instructions (shown to users)</Label><Textarea rows={3} value={form.payment_instructions} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} /></div>
          <Button disabled={saveM.isPending} onClick={() => saveM.mutate()}>Save settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upgrade requests</CardTitle>
          <CardDescription>Click the eye icon to inspect Plisio invoice + webhook history.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Plisio txn</TableHead>
                <TableHead>Plisio status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reqs.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{r.user_email ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge>{r.package_slug}</Badge></TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs">
                      {r.payment_method === "plisio" && <Bitcoin className="h-3 w-3" />} {r.payment_method}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate font-mono text-xs">{r.plisio_invoice_id ?? "—"}</TableCell>
                  <TableCell>{statusBadge(r.plisio_status)}</TableCell>
                  <TableCell>${Number(r.amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)} title="Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="default" onClick={() => reviewM.mutate({ id: r.id, approve: true })} title="Approve"><CheckCircle2 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => reviewM.mutate({ id: r.id, approve: false })} title="Reject"><XCircle className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {reqs.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">No requests yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment detail</DialogTitle>
            <DialogDescription>Full Plisio invoice + webhook log for this upgrade request.</DialogDescription>
          </DialogHeader>

          {detailQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {detailQ.error && <p className="text-sm text-destructive">{(detailQ.error as any).message}</p>}

          {detailQ.data && (() => {
            const r = detailQ.data.request as any;
            const p = detailQ.data.profile as any;
            const logs = detailQ.data.logs as any[];
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                  <Field label="User">{p?.email ?? r.user_id} {p?.plan_slug && <Badge variant="outline" className="ml-1">{p.plan_slug}</Badge>}</Field>
                  <Field label="Package"><Badge>{r.package_slug}</Badge></Field>
                  <Field label="Method">{r.payment_method}</Field>
                  <Field label="Amount">${Number(r.amount ?? 0).toFixed(2)}</Field>
                  <Field label="Created">{new Date(r.created_at).toLocaleString()}</Field>
                  <Field label="Reviewed">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}</Field>
                  <Field label="Request status">{statusBadge(r.status)}</Field>
                  <Field label="Plisio status">{statusBadge(r.plisio_status)}</Field>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 font-medium">Plisio invoice</div>
                  <Row label="txn_id" value={r.plisio_invoice_id} mono />
                  <Row label="order_number" value={r.transaction_ref} mono />
                  <Row label="invoice_url" value={r.plisio_invoice_url} link />
                  {r.note && <div className="mt-2 text-xs text-muted-foreground">Note: {r.note}</div>}
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-3 font-medium">Webhook log ({logs.length})</div>
                  {logs.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No webhook events recorded yet.</p>
                  ) : (
                    <div className="divide-y">
                      {logs.map((l) => (
                        <details key={l.id} className="p-3 text-xs">
                          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                            {l.signature_valid
                              ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              : <ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
                            <span className="font-mono">{new Date(l.created_at).toLocaleString()}</span>
                            {statusBadge(l.status)}
                            <span className="text-muted-foreground">{l.note}</span>
                          </summary>
                          <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(l.payload, null, 2)}</pre>
                        </details>
                      ))}
                    </div>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="flex justify-end gap-2 border-t pt-3">
                    <Button variant="outline" onClick={() => { reviewM.mutate({ id: r.id, approve: false }); setDetailId(null); }}>
                      <XCircle className="mr-1 h-4 w-4" /> Reject
                    </Button>
                    <Button onClick={() => { reviewM.mutate({ id: r.id, approve: true }); setDetailId(null); }}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Approve & assign plan
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, link }: { label: string; value?: string | null; mono?: boolean; link?: boolean }) {
  if (!value) return (
    <div className="flex justify-between py-1 text-xs"><span className="text-muted-foreground">{label}</span><span>—</span></div>
  );
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        {link
          ? <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-primary hover:underline">{value} <ExternalLink className="h-3 w-3 shrink-0" /></a>
          : <span className={`truncate ${mono ? "font-mono" : ""}`}>{value}</span>}
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(value, label)}><Copy className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}
