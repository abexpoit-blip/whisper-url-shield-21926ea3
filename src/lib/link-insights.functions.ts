import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  linkId: z.string().uuid(),
  sinceHours: z.number().int().min(1).max(720).default(24),
});

export const getLinkBotInsights = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // Owner-scope check via authed supabase (RLS makes sure user owns the link)
    const { data: link, error: linkErr } = await context.supabase
      .from("links")
      .select("id, user_id, short_code")
      .eq("id", data.linkId)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("Link not found or access denied");

    const sinceIso = new Date(
      Date.now() - data.sinceHours * 3600 * 1000,
    ).toISOString();

    // Use admin client for fast aggregation after ownership check above
    const { data: rows, error } = await supabaseAdmin
      .from("clicks")
      .select(
        "created_at, bot_score, challenge_passed, signals, user_agent, country",
      )
      .eq("link_id", data.linkId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    type Bucket = { total: number; passed: number; blocked: number };
    const mkBucket = (): Bucket => ({ total: 0, passed: 0, blocked: 0 });

    const bySource: Record<string, Bucket> = {};
    const byCountry: Record<string, Bucket> = {};
    const blockedUAs: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    const hourly: Record<string, { human: number; bot: number }> = {};

    let scoreSum = 0;
    let scoreN = 0;

    (rows ?? []).forEach((r: any) => {
      const src = (r.signals?.source as string) ?? "unknown";
      const country = (r.country as string) || "unknown";
      const passed = !!r.challenge_passed;

      const sb = (bySource[src] ||= mkBucket());
      sb.total++;
      passed ? sb.passed++ : sb.blocked++;

      const cb = (byCountry[country] ||= mkBucket());
      cb.total++;
      passed ? cb.passed++ : cb.blocked++;

      if (typeof r.bot_score === "number") {
        scoreSum += r.bot_score;
        scoreN++;
      }

      // Hour bucket (YYYY-MM-DDTHH)
      const hr = new Date(r.created_at).toISOString().slice(0, 13);
      const hb = (hourly[hr] ||= { human: 0, bot: 0 });
      passed ? hb.human++ : hb.bot++;

      if (!passed) {
        const ua = (r.user_agent || "unknown").slice(0, 80);
        blockedUAs[ua] = (blockedUAs[ua] || 0) + 1;

        const reasonsArr = Array.isArray(r.signals?.reasons)
          ? r.signals.reasons
          : [];
        reasonsArr.forEach((rsn: string) => {
          const key = String(rsn).split(":")[0]; // group "ua:facebook" → "ua"
          reasons[key] = (reasons[key] || 0) + 1;
        });
      }
    });

    const topN = <T extends Record<string, any>>(
      obj: Record<string, T | number>,
      n = 10,
    ) =>
      Object.entries(obj)
        .sort((a, b) => {
          const av = typeof a[1] === "number" ? a[1] : (a[1] as any).total ?? 0;
          const bv = typeof b[1] === "number" ? b[1] : (b[1] as any).total ?? 0;
          return bv - av;
        })
        .slice(0, n);

    // Sort hourly by time ascending
    const hourlyArr = Object.entries(hourly)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([hour, v]) => ({ hour, ...v }));

    return {
      windowHours: data.sinceHours,
      totalClicks: rows?.length ?? 0,
      avgScore: scoreN ? Math.round(scoreSum / scoreN) : null,
      bySource: topN(bySource, 20).map(([key, v]) => ({ key, ...(v as Bucket) })),
      byCountry: topN(byCountry, 10).map(([key, v]) => ({ key, ...(v as Bucket) })),
      blockedUAs: topN(blockedUAs, 10).map(([key, v]) => ({ key, count: v as number })),
      reasons: topN(reasons, 10).map(([key, v]) => ({ key, count: v as number })),
      hourly: hourlyArr,
    };
  });
