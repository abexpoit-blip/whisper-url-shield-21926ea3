import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Activity, Play, TrendingUp, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  listLinkScores,
  listVariantTests,
  runAutopilotNow,
} from "@/lib/auto-pilot.functions";

export const Route = createFileRoute("/admin/scores")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AdminScoresPage,
});

type ScoreRow = {
  id: string;
  short_code: string;
  title: string | null;
  owner_email: string | null;
  health_score: number | null;
  health_updated_at: string | null;
  clicks_count: number;
  bot_clicks_count: number;
};

type VariantRow = {
  id: string;
  link_id: string;
  short_code: string | null;
  title: string | null;
  variant_slug: string;
  status: string;
  total_clicks: number;
  human_clicks: number;
  bot_clicks: number;
  score: number;
  paused_reason: string | null;
  last_evaluated_at: string | null;
};

function scoreColor(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 75) return "bg-emerald-500/15 text-emerald-600";
  if (score >= 50) return "bg-amber-500/15 text-amber-600";
  return "bg-red-500/15 text-red-600";
}

function AdminScoresPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        listLinkScores({ data: { limit: 100 } }),
        listVariantTests({ data: { limit: 200 } }),
      ]);
      setScores(s.rows as ScoreRow[]);
      setVariants(v.rows as VariantRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await runAutopilotNow();
      toast.success(
        `Updated ${res.scores.updated} scores, ${res.variants.evaluated} variants (${res.variants.paused} paused)`,
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Link Scores & A/B Autopilot
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last 7 days clicks-এর data থেকে প্রতিটি link-এর health score (0-100) এবং variant performance auto-calculate হয়। দুর্বল variant auto-pause হবে।
            </p>
          </div>
          <Button onClick={handleRun} disabled={running}>
            <Play className="w-4 h-4 mr-1" />
            {running ? "Running…" : "Run autopilot now"}
          </Button>
        </div>

        {/* LINK SCORES */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Link Performance Scores
            </CardTitle>
            <CardDescription>
              ৭৫+ ভালো · ৫০-৭৪ মাঝারি · ৫০-এর নিচে দুর্বল (high bot ratio / low geo diversity)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : scores.length === 0 ? (
              <p className="text-sm text-muted-foreground">কোনো link নেই।</p>
            ) : (
              <div className="divide-y">
                {scores.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-bold w-12 text-center ${scoreColor(r.health_score)}`}>
                      {r.health_score ?? "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        /{r.short_code} {r.title ? `· ${r.title}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.owner_email ?? "—"} · {r.clicks_count} clicks · {r.bot_clicks_count} bots
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.health_updated_at
                        ? new Date(r.health_updated_at).toLocaleString()
                        : "Not evaluated"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* VARIANT TESTS */}
        <Card>
          <CardHeader>
            <CardTitle>A/B Variant Performance</CardTitle>
            <CardDescription>
              ৩০+ click হলে এবং best variant-এর ৫০%-এর কম human ratio হলে variant auto-pause হবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                এখনো কোনো A/B data নেই। যেসব link-এ ২+ variant সার্ভ হয়েছে, autopilot run করলে দেখা যাবে।
              </p>
            ) : (
              <div className="divide-y">
                {variants.map((r) => (
                  <div key={r.id} className="py-3 text-sm space-y-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">{r.variant_slug}</Badge>
                      <span className="font-medium truncate flex-1">
                        /{r.short_code ?? "?"} {r.title ? `· ${r.title}` : ""}
                      </span>
                      {r.status === "paused" ? (
                        <Badge className="bg-red-500/15 text-red-600 border-0">
                          <Pause className="w-3 h-3 mr-1" /> Paused
                        </Badge>
                      ) : r.status === "winner" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-0">Winner</Badge>
                      ) : (
                        <Badge className="bg-blue-500/15 text-blue-600 border-0">Active</Badge>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-bold w-12 text-center ${scoreColor(r.score)}`}>
                        {r.score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.total_clicks} clicks · {r.human_clicks} human · {r.bot_clicks} bot
                      {r.paused_reason ? ` · ${r.paused_reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
