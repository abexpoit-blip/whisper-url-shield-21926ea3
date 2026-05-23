import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const FiltersSchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
  source: z.string().min(1).max(32).optional(), // direct | silent | blocked | verify-silent | backfill
  minScore: z.number().int().min(0).max(200).optional(),
  maxScore: z.number().int().min(0).max(200).optional(),
  passed: z.enum(["all", "yes", "no"]).default("all"),
  uaQuery: z.string().max(128).optional(),
  sinceHours: z.number().int().min(1).max(720).default(24),
});

export const listRecentClicks = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => FiltersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const sinceIso = new Date(
      Date.now() - data.sinceHours * 3600 * 1000,
    ).toISOString();

    let q = supabaseAdmin
      .from("clicks")
      .select(
        "id, created_at, link_id, bot_score, challenge_passed, fingerprint_hash, signals, user_agent, ip_address, country, device, browser, os, referer_host",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.source) q = q.eq("signals->>source", data.source);
    if (typeof data.minScore === "number") q = q.gte("bot_score", data.minScore);
    if (typeof data.maxScore === "number") q = q.lte("bot_score", data.maxScore);
    if (data.passed === "yes") q = q.eq("challenge_passed", true);
    if (data.passed === "no") q = q.eq("challenge_passed", false);
    if (data.uaQuery) q = q.ilike("user_agent", `%${data.uaQuery}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregate by source for the same time window (independent of row filters).
    const { data: agg } = await supabaseAdmin
      .from("clicks")
      .select("signals, challenge_passed, bot_score")
      .gte("created_at", sinceIso)
      .limit(5000);

    const sourceCounts: Record<string, { total: number; passed: number; blocked: number; avgScore: number }> = {};
    let scoreSum = 0;
    let scoreN = 0;
    (agg ?? []).forEach((r: any) => {
      const src = r.signals?.source ?? "unknown";
      const bucket = (sourceCounts[src] ||= { total: 0, passed: 0, blocked: 0, avgScore: 0 });
      bucket.total += 1;
      if (r.challenge_passed) bucket.passed += 1;
      else bucket.blocked += 1;
      if (typeof r.bot_score === "number") {
        bucket.avgScore += r.bot_score;
        scoreSum += r.bot_score;
        scoreN += 1;
      }
    });
    Object.values(sourceCounts).forEach((b) => {
      b.avgScore = b.total ? Math.round(b.avgScore / b.total) : 0;
    });

    return {
      rows: rows ?? [],
      summary: {
        windowHours: data.sinceHours,
        totalInWindow: agg?.length ?? 0,
        avgScore: scoreN ? Math.round(scoreSum / scoreN) : null,
        bySource: sourceCounts,
      },
    };
  });
