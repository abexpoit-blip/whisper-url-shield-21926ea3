import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, ArrowLeft, Save, AlertTriangle, Bot, Activity, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireClientUser } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getProtectionConfig,
  updateProtectionConfig,
  getProtectionStats,
} from "@/lib/admin-protection.functions";
import { analyzeSignalWeights, applyTunedWeights } from "@/lib/admin-tune.functions";
import { SmartBackButton } from "@/components/smart-back-button";

export const Route = createFileRoute("/admin/protection")({
  beforeLoad: ({ location }) => requireClientUser(location.href),
  component: AdminProtectionPage,
});

type Action = "block" | "safe_page" | "allow";
type Config = {
  ip_rate_limit_per_min: number;
  ip_rate_limit_window_sec: number;
  suspicious_action: Action;
  block_threshold_score: number;
  safe_page_message: string;
};

const DEFAULTS: Config = {
  ip_rate_limit_per_min: 30,
  ip_rate_limit_window_sec: 60,
  suspicious_action: "safe_page",
  block_threshold_score: 60,
  safe_page_message: "This article is temporarily unavailable. Please check back later.",
};

function AdminProtectionPage() {
  const get = useServerFn(getProtectionConfig);
  const save = useServerFn(updateProtectionConfig);
  const stats = useServerFn(getProtectionStats);

  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<{
    total: number;
    bots: number;
    blocked: number;
    safe: number;
    rateLimited: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, st] = await Promise.all([get({}), stats({})]);
        if (c) setCfg({ ...DEFAULTS, ...c, suspicious_action: c.suspicious_action as Action });
        setS(st);
      } catch (e) {
        toast.error("Failed to load protection settings: " + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ data: cfg });
      toast.success("Protection settings saved");
    } catch (e) {
      toast.error("Save failed: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border glass">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Bot Protection</span>
          </div>
          <SmartBackButton fallbackTo="/dashboard">Dashboard</SmartBackButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bot & rate-limit protection</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Detect suspicious traffic (bots, scrapers, abusive IPs) and decide how to respond.
            Settings apply globally to every short link.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Clicks (24h)"
            value={s?.total ?? 0}
          />
          <StatCard
            icon={<Bot className="h-4 w-4" />}
            label="Bots flagged"
            value={s?.bots ?? 0}
            tone="warn"
          />
          <StatCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Safe-paged"
            value={s?.safe ?? 0}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Blocked"
            value={s?.blocked ?? 0}
            tone="danger"
          />
        </div>

        {/* Rate limit */}
        <Card>
          <CardHeader>
            <CardTitle>IP rate limit</CardTitle>
            <CardDescription>
              Same IP exceeding this rate inside the window is treated as suspicious.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max clicks per minute (per IP)</Label>
              <Input
                type="number"
                min={1}
                value={cfg.ip_rate_limit_per_min}
                onChange={(e) =>
                  setCfg({ ...cfg, ip_rate_limit_per_min: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sampling window (seconds)</Label>
              <Input
                type="number"
                min={5}
                value={cfg.ip_rate_limit_window_sec}
                onChange={(e) =>
                  setCfg({ ...cfg, ip_rate_limit_window_sec: Number(e.target.value) || 5 })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Bot threshold */}
        <Card>
          <CardHeader>
            <CardTitle>Bot detection threshold</CardTitle>
            <CardDescription>
              Higher = stricter (fewer false positives). Combines UA, headers, fingerprint, and
              behavior signals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm">
              <Label>Block threshold score</Label>
              <Input
                type="number"
                min={10}
                value={cfg.block_threshold_score}
                onChange={(e) =>
                  setCfg({ ...cfg, block_threshold_score: Number(e.target.value) || 10 })
                }
              />
              <p className="text-xs text-muted-foreground">Recommended: 60</p>
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <Card>
          <CardHeader>
            <CardTitle>Action for suspicious visitors</CardTitle>
            <CardDescription>
              How should the system respond when a visitor is flagged?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              {(["safe_page", "block", "allow"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setCfg({ ...cfg, suspicious_action: a })}
                  className={`text-left rounded-lg border p-4 transition ${
                    cfg.suspicious_action === a
                      ? "border-primary bg-accent shadow-card"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold mb-1 capitalize">
                    {a === "safe_page" ? "Safe page" : a}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a === "safe_page" &&
                      "Show a neutral 'unavailable' page. Never reveal the destination."}
                    {a === "block" && "Return an explicit Access Denied page."}
                    {a === "allow" && "Log only — let them through (use for soft monitoring)."}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Safe page message</Label>
              <Textarea
                rows={3}
                value={cfg.safe_page_message}
                onChange={(e) => setCfg({ ...cfg, safe_page_message: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>

        <AutoTuneSection />
      </main>
    </div>
  );
}

function AutoTuneSection() {
  const analyze = useServerFn(analyzeSignalWeights);
  const apply = useServerFn(applyTunedWeights);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzeSignalWeights>> | null>(null);

  const runAnalyze = async () => {
    setBusy(true);
    try {
      const r = await analyze({ data: { sinceDays: days, minSamples: 20 } });
      setResult(r);
      toast.success(`Analyzed ${r.totalRows} clicks · ${r.analysis.length} signals`);
    } catch (e) {
      toast.error("Analyze failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!result) return;
    if (!confirm("Apply suggested weights to live config?")) return;
    setBusy(true);
    try {
      const weights: Record<string, number> = { ...result.currentWeights };
      const soft = new Set<string>(result.currentSoft);
      result.analysis.forEach((r) => {
        weights[r.signal] = r.suggestedWeight;
        if (r.suggestedSoft) soft.add(r.signal);
        else soft.delete(r.signal);
      });
      const res = await apply({ data: { weights, softReasons: Array.from(soft) } });
      toast.success(`Applied ${res.applied} weights. Refresh stats to verify.`);
    } catch (e) {
      toast.error("Apply failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-tune signal weights</CardTitle>
        <CardDescription>
          Analyze recent clicks to see which bot signals reliably catch bots vs.
          which cause false positives. Suggested weights are based on signal
          precision (blocked / total occurrences).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label>Window (days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              className="w-24"
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
            />
          </div>
          <Button onClick={runAnalyze} disabled={busy}>
            {busy ? "Analyzing…" : "Analyze"}
          </Button>
          {result && (
            <Button variant="default" onClick={runApply} disabled={busy}>
              Apply suggested weights
            </Button>
          )}
        </div>

        {result && (
          <>
            <div className="text-xs text-muted-foreground">
              {result.totalRows} clicks · {result.totalBlocked} blocked ({result.blockRate}%)
              · last {result.windowDays} days
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Signal</th>
                    <th className="text-right px-3 py-2">Blocked</th>
                    <th className="text-right px-3 py-2">Passed</th>
                    <th className="text-right px-3 py-2">Precision</th>
                    <th className="text-right px-3 py-2">Current</th>
                    <th className="text-right px-3 py-2">Suggested</th>
                    <th className="text-right px-3 py-2">Soft?</th>
                  </tr>
                </thead>
                <tbody>
                  {result.analysis.map((r) => {
                    const changed = r.currentWeight !== r.suggestedWeight;
                    return (
                      <tr key={r.signal} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{r.signal}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-500">{r.blocked}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-500">{r.passed}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(r.precision * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.currentWeight}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${changed ? "text-primary" : ""}`}>
                          {r.suggestedWeight}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">{r.suggestedSoft ? "✓" : ""}</td>
                      </tr>
                    );
                  })}
                  {result.analysis.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Not enough samples (need ≥20 per signal)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "warn" | "danger";
}) {
  const color =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-primary";
  return (
    <Card className="glass">
      <CardContent className="pt-6">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${color}`}>
          {icon}
          {label}
        </div>
        <div className="mt-2 text-3xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
