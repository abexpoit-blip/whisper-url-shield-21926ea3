import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Trophy, ArrowLeft, RotateCcw, Crown, FlaskConical, Search, TrendingUp, Bot, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getVariantLeaderboard,
  promoteVariant,
  resetRotation,
} from "@/lib/admin-rotation.functions";

export const Route = createFileRoute("/admin/rotation")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: RotationPage,
});

type Window = "24h" | "7d" | "30d" | "all";

type Row = {
  slug: string;
  category: string;
  title: string;
  is_active: boolean;
  total: number;
  humans: number;
  bots: number;
  rate: number;
  smoothed: number;
  lift: number;
  isWinner: boolean;
  status: "exploring" | "evaluating" | "winning" | "losing";
};

const WINDOWS: { v: Window; label: string }[] = [
  { v: "24h", label: "Last 24h" },
  { v: "7d", label: "Last 7 days" },
  { v: "30d", label: "Last 30 days" },
  { v: "all", label: "All time" },
];

function RotationPage() {
  const fetchBoard = useServerFn(getVariantLeaderboard);
  const promote = useServerFn(promoteVariant);
  const reset = useServerFn(resetRotation);

  const [win, setWin] = useState<Window>("7d");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ attempts: 0, humans: 0, bots: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (w: Window) => {
    setLoading(true);
    try {
      const r = await fetchBoard({ data: { window: w } });
      setRows(r.rows as Row[]);
      setTotals(r.totals);
    } catch (e) {
      toast.error("Failed to load: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(win); /* eslint-disable-next-line */ }, [win]);

  const onPromote = async (slug: string) => {
    if (!confirm(`Promote "${slug}" as the only active variant? Others will be deactivated.`)) return;
    setBusy(slug);
    try {
      await promote({ data: { slug } });
      toast.success(`"${slug}" promoted — rotation stopped.`);
      await load(win);
    } catch (e) {
      toast.error("Promote failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onReset = async () => {
    if (!confirm("Re-activate every variant and resume rotation?")) return;
    setBusy("__reset");
    try {
      await reset({});
      toast.success("Rotation resumed across all variants.");
      await load(win);
    } catch (e) {
      toast.error("Reset failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const maxRate = Math.max(0.0001, ...rows.map((r) => r.smoothed));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border glass">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">Variant Leaderboard</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ad-approval rotation</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Every active landing variant is rotated automatically with an epsilon-greedy
              bandit on real human conversions. Pick the time window and promote the winner
              when you're ready.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="inline-flex rounded-lg border border-border p-1 bg-card">
              {WINDOWS.map((w) => (
                <button
                  key={w.v}
                  onClick={() => setWin(w.v)}
                  className={`px-3 py-1.5 text-sm rounded-md transition ${
                    win === w.v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={onReset} disabled={busy === "__reset"}>
              <RotateCcw className="h-4 w-4 mr-1" /> Resume all
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={<Search className="h-4 w-4" />} label="Verify attempts" value={totals.attempts} />
          <Stat icon={<Users className="h-4 w-4" />} label="Humans" value={totals.humans} tone="success" />
          <Stat icon={<Bot className="h-4 w-4" />} label="Bots" value={totals.bots} tone="warn" />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Overall CR"
            value={totals.attempts ? Math.round((totals.humans / totals.attempts) * 100) : 0}
            suffix="%"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>
              Ranked by Laplace-smoothed conversion rate. Winner badge appears once the leader
              has ≥100 verified attempts and ≥2 pp lead over the runner-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No variants yet. Create some at{" "}
                <Link to="/admin/variants" className="text-primary underline">
                  /admin/variants
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r, i) => {
                  const width = (r.smoothed / maxRate) * 100;
                  return (
                    <div
                      key={r.slug}
                      className={`rounded-lg border p-4 transition ${
                        r.isWinner
                          ? "border-primary bg-accent shadow-card"
                          : !r.is_active
                          ? "border-border opacity-60"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{i + 1}
                            </span>
                            <span className="font-semibold truncate">{r.title}</span>
                            <Badge variant="outline" className="text-xs">{r.slug}</Badge>
                            <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                            {r.isWinner && (
                              <Badge className="text-xs bg-primary text-primary-foreground gap-1">
                                <Crown className="h-3 w-3" /> Winner
                              </Badge>
                            )}
                            {!r.is_active && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                            {r.status === "exploring" && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <FlaskConical className="h-3 w-3" /> Exploring
                              </Badge>
                            )}
                          </div>

                          <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                r.isWinner ? "bg-primary" : "bg-primary/50"
                              }`}
                              style={{ width: `${width}%` }}
                            />
                          </div>

                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              <span className="text-foreground font-semibold">
                                {(r.rate * 100).toFixed(1)}%
                              </span>{" "}
                              CR
                            </span>
                            <span>
                              {r.humans} / {r.total} verified
                            </span>
                            <span>{r.bots} bots filtered</span>
                            <span className={r.lift > 0 ? "text-success" : "text-destructive"}>
                              {r.lift > 0 ? "+" : ""}
                              {r.lift.toFixed(1)} pp vs avg
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={r.isWinner ? "default" : "outline"}
                          onClick={() => onPromote(r.slug)}
                          disabled={busy === r.slug}
                        >
                          {busy === r.slug ? "…" : "Promote"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Tip: While ads are in review, keep rotation on so the bandit collects real conversion
          data. Once a variant is clearly winning, promote it so every click serves the approved
          creative.
        </p>
      </main>
    </div>
  );
}

function Stat({
  icon, label, value, suffix, tone,
}: {
  icon: React.ReactNode; label: string; value: number; suffix?: string;
  tone?: "success" | "warn";
}) {
  const color =
    tone === "success" ? "text-success" :
    tone === "warn" ? "text-warning" :
    "text-primary";
  return (
    <Card className="glass">
      <CardContent className="pt-6">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${color}`}>
          {icon}{label}
        </div>
        <div className="mt-2 text-3xl font-bold">
          {value.toLocaleString()}{suffix ?? ""}
        </div>
      </CardContent>
    </Card>
  );
}
