import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ScrollText, RefreshCw, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { listAuditLogs } from "@/lib/admin-audit.functions";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Logs — LinkShield Admin" },
      { name: "description", content: "Admin-only audit trail of sensitive actions across the LinkShield workspace." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditPage,
});

type Row = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource: string | null;
  status: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function AuditPage() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "denied" | "error">("all");
  const [limit, setLimit] = useState(100);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLogs({ data: { limit, statusFilter } });
      setRows(res.rows as Row[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, limit]);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary" />
            Admin Audit Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every admin action attempt — success, denial, or error.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="error">Error</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
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
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.user_email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {r.user_id?.slice(0, 8) ?? "anon"}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.reason && <div className="text-destructive">{r.reason}</div>}
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted/40 px-2 py-1 text-[11px]">
                        {JSON.stringify(r.metadata, null, 0)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> Success
      </span>
    );
  }
  if (status === "denied") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
        <ShieldAlert className="h-3 w-3" /> Denied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
      <XCircle className="h-3 w-3" /> Error
    </span>
  );
}
