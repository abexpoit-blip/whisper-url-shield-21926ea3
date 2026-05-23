import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

// ============================================================
// CORE: Recompute Link Performance Score (0-100)
// ============================================================
// Score factors (last 7 days):
//  - humanRatio (40 pts)    : human / total
//  - geoDiversity (20 pts)  : distinct countries (cap 10)
//  - velocitySanity (20 pts): no extreme spikes
//  - duplicatePenalty (-20) : ratio of duplicates
//  - botPenalty (-20)       : if bot_ratio > 0.5
// ============================================================

export async function computeScoresAdmin() {
  const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: links, error: linksErr } = await supabaseAdmin
    .from("links")
    .select("id");
  if (linksErr) throw new Error(linksErr.message);

  let updated = 0;

  for (const l of links ?? []) {
    const { data: clicks } = await supabaseAdmin
      .from("clicks")
      .select("is_bot,country,variant,created_at")
      .eq("link_id", l.id)
      .gte("created_at", sinceISO)
      .limit(5000);

    const total = clicks?.length ?? 0;
    if (total === 0) {
      await supabaseAdmin
        .from("links")
        .update({ health_score: null, health_updated_at: new Date().toISOString() })
        .eq("id", l.id);
      continue;
    }

    const bot = clicks!.filter((c) => c.is_bot).length;
    const human = total - bot;
    const humanRatio = human / total;
    const countries = new Set(clicks!.map((c) => c.country).filter(Boolean));
    const geoDiversity = Math.min(countries.size, 10) / 10;

    // velocity sanity: max 1-min burst vs avg
    const buckets = new Map<number, number>();
    for (const c of clicks!) {
      const m = Math.floor(new Date(c.created_at).getTime() / 60000);
      buckets.set(m, (buckets.get(m) ?? 0) + 1);
    }
    const counts = [...buckets.values()];
    const maxBurst = Math.max(...counts);
    const avg = total / counts.length;
    const velocitySanity = avg === 0 ? 1 : Math.max(0, 1 - Math.min(1, (maxBurst / avg - 3) / 10));

    let score = humanRatio * 40 + geoDiversity * 20 + velocitySanity * 20;
    if (bot / total > 0.5) score -= 20;
    score = Math.round(Math.max(0, Math.min(100, score)));

    await supabaseAdmin
      .from("links")
      .update({ health_score: score, health_updated_at: new Date().toISOString() })
      .eq("id", l.id);
    updated++;
  }

  return { ok: true, updated };
}

// ============================================================
// A/B AUTOPILOT: Variant Performance + auto-pause
// ============================================================

export async function recomputeVariantTestsAdmin() {
  const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: links } = await supabaseAdmin.from("links").select("id");

  let evaluated = 0;
  let paused = 0;

  for (const l of links ?? []) {
    const { data: clicks } = await supabaseAdmin
      .from("clicks")
      .select("variant,is_bot")
      .eq("link_id", l.id)
      .gte("created_at", sinceISO)
      .limit(5000);

    if (!clicks || clicks.length === 0) continue;

    const agg = new Map<string, { total: number; bot: number; human: number }>();
    for (const c of clicks) {
      const v = c.variant || "default";
      const a = agg.get(v) ?? { total: 0, bot: 0, human: 0 };
      a.total++;
      if (c.is_bot) a.bot++; else a.human++;
      agg.set(v, a);
    }

    if (agg.size < 2) continue; // need at least 2 variants

    // Compute scores
    const rows = [...agg.entries()].map(([slug, a]) => ({
      slug,
      ...a,
      humanRatio: a.total > 0 ? a.human / a.total : 0,
    }));
    const bestRatio = Math.max(...rows.map((r) => r.humanRatio));

    for (const r of rows) {
      const score = Math.round(r.humanRatio * 100);
      // Auto-pause: variant has 30+ clicks AND human ratio < 50% of best
      const shouldPause =
        r.total >= 30 && bestRatio > 0 && r.humanRatio < bestRatio * 0.5;

      const status = shouldPause ? "paused" : "active";
      const paused_reason = shouldPause
        ? `Auto-paused: ${Math.round(r.humanRatio * 100)}% human vs best ${Math.round(bestRatio * 100)}%`
        : null;

      await supabaseAdmin.from("link_variant_tests").upsert(
        {
          link_id: l.id,
          variant_slug: r.slug,
          status,
          total_clicks: r.total,
          human_clicks: r.human,
          bot_clicks: r.bot,
          score,
          paused_reason,
          last_evaluated_at: new Date().toISOString(),
        },
        { onConflict: "link_id,variant_slug" },
      );

      if (shouldPause) paused++;
      evaluated++;
    }
  }

  return { ok: true, evaluated, paused };
}

// ============================================================
// PUBLIC SERVER FNs (admin-gated)
// ============================================================

export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const a = await computeScoresAdmin();
    const b = await recomputeVariantTestsAdmin();
    return { scores: a, variants: b };
  });

export const listLinkScores = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("links")
      .select("id,short_code,title,user_id,health_score,health_updated_at,clicks_count,bot_clicks_count")
      .order("health_score", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    // attach owner email
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        owner_email: emailMap.get(r.user_id) ?? null,
      })),
    };
  });

export const listVariantTests = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(500).default(200) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("link_variant_tests")
      .select("id,link_id,variant_slug,status,total_clicks,human_clicks,bot_clicks,score,paused_reason,last_evaluated_at")
      .order("last_evaluated_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const linkIds = [...new Set((rows ?? []).map((r) => r.link_id))];
    const { data: links } = await supabaseAdmin
      .from("links")
      .select("id,short_code,title")
      .in("id", linkIds.length ? linkIds : ["00000000-0000-0000-0000-000000000000"]);
    const linkMap = new Map((links ?? []).map((l) => [l.id, l]));

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        short_code: linkMap.get(r.link_id)?.short_code ?? null,
        title: linkMap.get(r.link_id)?.title ?? null,
      })),
    };
  });
