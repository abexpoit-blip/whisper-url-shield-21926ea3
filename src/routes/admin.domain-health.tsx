import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listDomainHealth, runDomainHealthCheck } from "@/lib/domain-health.functions";

export const Route = createFileRoute("/admin/domain-health")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AdminDomainHealthPage,
});

type Latest = {
  dns_ok: boolean; http_ok: boolean; http_status: number | null;
  dns_target_observed: string | null; error: string | null; checked_at: string;
} | null;
type Row = {
  id: string; domain: string; dns_target: string; status: string;
  last_checked_at: string | null; is_primary: boolean; latest: Latest;
};

function AdminDomainHealthPage() {
  const fetchHealth = useServerFn(listDomainHealth);
  const runHealthCheck = useServerFn(runDomainHealthCheck);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchHealth();
      setRows(res.rows as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleRun = async (domainId?: string) => {
    setRunning(true);
    try {
      const res = await runHealthCheck({ data: { domainId } });
      toast.success(`Checked ${res.checked} domain(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" /> Domain Health Monitor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Custom domain গুলোর DNS + HTTP health একসাথে দেখুন। যেকোনো সময় manual check trigger করুন।
          </p>
        </div>
        <Button onClick={() => handleRun(undefined)} disabled={running}>
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Run all checks
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          কোনো custom domain যুক্ত নেই।
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const ok = d.latest?.dns_ok && d.latest?.http_ok;
            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {ok ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                      {d.domain}
                      {d.is_primary && <Badge variant="secondary">primary</Badge>}
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => handleRun(d.id)} disabled={running}>
                      <RefreshCw className={`w-3 h-3 mr-2 ${running ? "animate-spin" : ""}`} />
                      Recheck
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    Expected DNS: {d.dns_target}
                    {d.last_checked_at && ` · Last checked ${new Date(d.last_checked_at).toLocaleString()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  {d.latest ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">DNS</div>
                        <div className={d.latest.dns_ok ? "text-emerald-600" : "text-amber-600"}>
                          {d.latest.dns_ok ? "OK" : "Mismatch"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 break-all">
                          {d.latest.dns_target_observed || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">HTTP</div>
                        <div className={d.latest.http_ok ? "text-emerald-600" : "text-amber-600"}>
                          {d.latest.http_ok ? "OK" : "Fail"} {d.latest.http_status ? `(${d.latest.http_status})` : ""}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Error</div>
                        <div className="text-xs break-all">{d.latest.error || "—"}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">এখনো কোনো check run হয়নি।</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
