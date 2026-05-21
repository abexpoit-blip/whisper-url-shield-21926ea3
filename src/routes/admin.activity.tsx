import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Copy, RefreshCw, Search } from "lucide-react";
import { listPlisioActivity } from "@/lib/plisio-activity.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/activity")({ component: AdminActivityPage });

type Row = {
  id: string; event_type: string; request_id: string; correlation_id: string | null;
  status_code: number | null; outcome: string; upgrade_request_id: string | null;
  user_id: string | null; txn_id: string | null; order_number: string | null;
  plisio_status: string | null; message: string | null;
  metadata: Record<string, any>; created_at: string;
};

const OUTCOMES = ["all", "success", "error", "approved", "rejected", "duplicate", "received", "signature_invalid", "not_found"];

function copy(value: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed"),
  );
}

function outcomeBadge(o: string) {
  const cls =
    o === "success" || o === "approved" ? "bg-emerald-600 hover:bg-emerald-600" :
    o === "error" || o === "rejected" || o === "signature_invalid" ? "" :
    o === "duplicate" || o === "not_found" ? "bg-amber-600 hover:bg-amber-600" :
    "bg-sky-600 hover:bg-sky-600";
  const variant = o === "error" || o === "rejected" || o === "signature_invalid" ? "destructive" : "default";
  return <Badge variant={variant as any} className={cls}>{o}</Badge>;
}

function eventBadge(t: string) {
  return t === "invoice_create"
    ? <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300">invoice</Badge>
    : <Badge variant="outline" className="border-violet-500/40 text-violet-700 dark:text-violet-300">webhook</Badge>;
}

function AdminActivityPage() {
  const fn = useServerFn(listPlisioActivity);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<"all" | "invoice_create" | "webhook_received">("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [open, setOpen] = useState<Row | null>(null);

  const query = useQuery({
    queryKey: ["plisio-activity", { search, eventType, outcome }],
    queryFn: () => fn({ data: { search, event_type: eventType, outcome, limit: 200 } }),
  });

  const rows: Row[] = useMemo(() => (query.data?.rows ?? []) as Row[], [query.data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const errors = rows.filter(r => r.outcome === "error" || r.outcome === "signature_invalid" || r.outcome === "rejected").length;
    const success = rows.filter(r => r.outcome === "success" || r.outcome === "approved").length;
    return { total, errors, success };
  }, [rows]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-sky-600" />
          <h1 className="text-xl font-semibold">Plisio Activity</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Events</p><p className="text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Success</p><p className="text-2xl font-semibold text-emerald-600">{stats.success}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Errors</p><p className="text-2xl font-semibold text-destructive">{stats.errors}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search & Filter</CardTitle>
          <CardDescription>
            Search by request ID, correlation ID (order number), txn ID, Plisio status, or message text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search request_id / correlation_id / txn_id / message…"
                className="pl-8"
              />
            </div>
            <Select value={eventType} onValueChange={(v) => setEventType(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="invoice_create">Invoice create</SelectItem>
                <SelectItem value="webhook_received">Webhook</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plisio</TableHead>
                  <TableHead>Correlation</TableHead>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!query.isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No events.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{eventBadge(r.event_type)}</TableCell>
                    <TableCell>{outcomeBadge(r.outcome)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.status_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.plisio_status ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.correlation_id ? (
                        <span className="inline-flex items-center gap-1">
                          {r.correlation_id.slice(0, 18)}…
                          <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); copy(r.correlation_id!); }} />
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        {r.request_id.slice(0, 8)}…
                        <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); copy(r.request_id); }} />
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs">{r.message ?? "—"}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(r); }}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open && eventBadge(open.event_type)}
              {open && outcomeBadge(open.outcome)}
              <span className="text-sm font-mono">{open?.request_id}</span>
            </DialogTitle>
            <DialogDescription>
              {open && new Date(open.created_at).toLocaleString()} • status {open?.status_code ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Correlation:</span> <span className="font-mono break-all">{open.correlation_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Txn ID:</span> <span className="font-mono break-all">{open.txn_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Order #:</span> <span className="font-mono break-all">{open.order_number ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Plisio status:</span> {open.plisio_status ?? "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Upgrade request:</span> <span className="font-mono break-all">{open.upgrade_request_id ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">User:</span> <span className="font-mono break-all">{open.user_id ?? "—"}</span></div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Message</p>
                <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap break-words">{open.message ?? "—"}</pre>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Metadata</p>
                <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">
{JSON.stringify(open.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
