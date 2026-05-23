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

const AnalyzeSchema = z.object({
  sinceDays: z.number().int().min(1).max(30).default(7),
  minSamples: z.number().int().min(5).max(1000).default(20),
});

function suggestWeight(precision: number, samples: number): number {
  if (samples < 10) return 0;
  if (precision >= 0.9) return 30;
  if (precision >= 0.7) return 15;
  if (precision >= 0.5) return 5;
  return 0;
}

export const analyzeSignalWeights = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => AnalyzeSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const sinceIso = new Date(
      Date.now() - data.sinceDays * 86400 * 1000,
    ).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("clicks")
      .select("challenge_passed, signals")
      .gte("created_at", sinceIso)
      .limit(50000);
    if (error) throw new Error(error.message);

    // Pull current config
    const { data: cfg } = await supabaseAdmin
      .from("bot_protection_config")
      .select("signal_weights, soft_reasons")
      .eq("id", 1)
      .maybeSingle();

    const currentWeights: Record<string, number> =
      (cfg?.signal_weights as any) ?? {};
    const currentSoft: string[] = (cfg?.soft_reasons as any) ?? [];

    type Stat = { blocked: number; passed: number };
    const stats: Record<string, Stat> = {};

    let totalRows = 0;
    let totalBlocked = 0;
    (rows ?? []).forEach((r: any) => {
      totalRows++;
      const passed = !!r.challenge_passed;
      if (!passed) totalBlocked++;
      const arr = Array.isArray(r.signals?.reasons) ? r.signals.reasons : [];
      const seen = new Set<string>();
      arr.forEach((rsn: string) => {
        const key = String(rsn).split(":")[0];
        if (seen.has(key)) return;
        seen.add(key);
        const s = (stats[key] ||= { blocked: 0, passed: 0 });
        if (passed) s.passed++;
        else s.blocked++;
      });
    });

    const analysis = Object.entries(stats)
      .map(([signal, s]) => {
        const samples = s.blocked + s.passed;
        const precision = samples ? s.blocked / samples : 0;
        const suggested = suggestWeight(precision, samples);
        return {
          signal,
          blocked: s.blocked,
          passed: s.passed,
          samples,
          precision: Math.round(precision * 1000) / 1000,
          currentWeight: currentWeights[signal] ?? 0,
          suggestedWeight: suggested,
          suggestedSoft: precision < 0.5 && samples >= data.minSamples,
        };
      })
      .filter((r) => r.samples >= data.minSamples)
      .sort((a, b) => b.samples - a.samples);

    return {
      windowDays: data.sinceDays,
      totalRows,
      totalBlocked,
      blockRate: totalRows ? Math.round((totalBlocked / totalRows) * 1000) / 10 : 0,
      currentWeights,
      currentSoft,
      analysis,
    };
  });

const ApplySchema = z.object({
  weights: z.record(z.string().min(1).max(64), z.number().int().min(0).max(200)),
  softReasons: z.array(z.string().min(1).max(64)).max(64),
});

export const applyTunedWeights = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => ApplySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("bot_protection_config")
      .update({
        signal_weights: data.weights,
        soft_reasons: data.softReasons,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);

    return { ok: true, applied: Object.keys(data.weights).length };
  });
