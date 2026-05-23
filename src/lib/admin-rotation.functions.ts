import { createServerFn } from "@tanstack/react-start";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditAdminGate } from "./admin-audit.server";
import { z } from "zod";

async function assertAdmin(userId: string, action: string, metadata?: Record<string, unknown>) {
  await auditAdminGate({ userId, action, metadata });
}

const WindowSchema = z.object({
  window: z.enum(["24h", "7d", "30d", "all"]).default("7d"),
});

type Row = {
  slug: string;
  category: string;
  title: string;
  is_active: boolean;
  total: number;   // verified attempts (bot + human)
  humans: number;  // verified humans (real conversions)
  bots: number;
  rate: number;    // humans / total
  smoothed: number; // (humans + 1) / (total + 2)
  lift: number;    // vs baseline (average of others), in pp
  isWinner: boolean;
  status: "exploring" | "evaluating" | "winning" | "losing";
};

const MIN_SAMPLE = 20;
const CONFIDENT_SAMPLE = 100;

export const getVariantLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) => WindowSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "rotation.leaderboard.view", { window: data.window });

    const since =
      data.window === "all"
        ? null
        : new Date(
            Date.now() -
              ({ "24h": 24, "7d": 24 * 7, "30d": 24 * 30 }[data.window] *
                60 *
                60 *
                1000),
          ).toISOString();

    const { data: variants } = await supabaseAdmin
      .from("prelander_variants")
      .select("slug,category,title,is_active")
      .order("sort_order", { ascending: true });

    let q = supabaseAdmin
      .from("clicks")
      .select("variant,is_bot")
      .like("bot_reason", "verify:%")
      .not("variant", "is", null)
      .limit(50000);
    if (since) q = q.gte("created_at", since);
    const { data: rows } = await q;

    const stats = new Map<string, { total: number; humans: number; bots: number }>();
    for (const r of rows ?? []) {
      const slug = r.variant as string;
      const e = stats.get(slug) ?? { total: 0, humans: 0, bots: 0 };
      e.total += 1;
      if (r.is_bot) e.bots += 1;
      else e.humans += 1;
      stats.set(slug, e);
    }

    const enriched: Row[] = (variants ?? []).map((v) => {
      const s = stats.get(v.slug) ?? { total: 0, humans: 0, bots: 0 };
      const rate = s.total ? s.humans / s.total : 0;
      const smoothed = (s.humans + 1) / (s.total + 2);
      return {
        slug: v.slug,
        category: v.category,
        title: v.title,
        is_active: v.is_active,
        total: s.total,
        humans: s.humans,
        bots: s.bots,
        rate,
        smoothed,
        lift: 0,
        isWinner: false,
        status: "exploring",
      };
    });

    // Compute lift vs average of OTHER variants
    enriched.forEach((row) => {
      const others = enriched.filter((o) => o.slug !== row.slug);
      const avgOthers =
        others.length === 0
          ? 0
          : others.reduce((acc, o) => acc + o.smoothed, 0) / others.length;
      row.lift = (row.smoothed - avgOthers) * 100; // percentage points
    });

    // Rank + winner badge
    const ranked = [...enriched].sort((a, b) => b.smoothed - a.smoothed);
    const top = ranked[0];
    if (top && top.total >= CONFIDENT_SAMPLE) {
      // declare winner only when leader has confident sample AND clear lift
      const runnerUp = ranked[1];
      const lead = runnerUp
        ? (top.smoothed - runnerUp.smoothed) * 100
        : top.smoothed * 100;
      if (lead >= 2) top.isWinner = true;
    }

    enriched.forEach((row) => {
      if (row.isWinner) row.status = "winning";
      else if (row.total < MIN_SAMPLE) row.status = "exploring";
      else if (row.total < CONFIDENT_SAMPLE) row.status = "evaluating";
      else row.status = "losing";
    });

    return {
      window: data.window,
      rows: ranked,
      totals: {
        attempts: enriched.reduce((a, r) => a + r.total, 0),
        humans: enriched.reduce((a, r) => a + r.humans, 0),
        bots: enriched.reduce((a, r) => a + r.bots, 0),
      },
    };
  });

// Promote a variant: deactivate all others (so rotation stops and only the
// winner serves). Reversible — admin can re-enable variants in /admin/variants.
export const promoteVariant = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "rotation.promote", { slug: data.slug });

    const { error: e1 } = await supabaseAdmin
      .from("prelander_variants")
      .update({ is_active: false })
      .neq("slug", data.slug);
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabaseAdmin
      .from("prelander_variants")
      .update({ is_active: true })
      .eq("slug", data.slug);
    if (e2) throw new Error(e2.message);

    return { ok: true };
  });

// Reset rotation — re-activate every variant.
export const resetRotation = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, "rotation.reset");
    const { error } = await supabaseAdmin
      .from("prelander_variants")
      .update({ is_active: true })
      .neq("slug", "");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
