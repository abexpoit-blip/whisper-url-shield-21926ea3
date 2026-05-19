import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [users, links, clicks, pending, domains, packages] = await Promise.all([
      (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
      (supabase as any).from("links").select("id", { count: "exact", head: true }),
      (supabase as any).from("clicks").select("id", { count: "exact", head: true }),
      (supabase as any).from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase as any).from("shared_domains").select("id", { count: "exact", head: true }).eq("is_active", true),
      (supabase as any).from("packages").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const { data: recentReqs } = await (supabase as any)
      .from("upgrade_requests")
      .select("id,user_id,package_slug,status,amount,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentLinks } = await (supabase as any)
      .from("links")
      .select("id,short_code,title,clicks_count,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: topPlans } = await (supabase as any)
      .from("profiles")
      .select("plan_slug")
      .limit(1000);
    const planCounts: Record<string, number> = {};
    (topPlans ?? []).forEach((p: any) => {
      planCounts[p.plan_slug] = (planCounts[p.plan_slug] ?? 0) + 1;
    });

    return {
      counts: {
        users: users.count ?? 0,
        links: links.count ?? 0,
        clicks: clicks.count ?? 0,
        pendingRequests: pending.count ?? 0,
        activeDomains: domains.count ?? 0,
        activePackages: packages.count ?? 0,
      },
      planDistribution: planCounts,
      recentRequests: recentReqs ?? [],
      recentLinks: recentLinks ?? [],
    };
  });

// =============== ADVANCED STATS ===============

export const getAdminAdvancedStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const since7dIso = since7d.toISOString();
    const since30dIso = since30d.toISOString();

    // Single 7d scan covers daily series, 24h KPIs and all top lists.
    // Tighter window + smaller cap than the old 30d/20k pull = faster & more accurate.
    const clicks7dPromise = supabaseAdmin
      .from("clicks")
      .select("is_bot,country,referer_host,created_at,link_id,bot_reason")
      .gte("created_at", since7dIso)
      .order("created_at", { ascending: false })
      .limit(10000);

    // Run all independent reads in parallel.
    const [
      clicks7dRes,
      approvedReqsRes,
      newUsers7dRes,
      newUsers30dRes,
      bannedUsersRes,
      activeLinksRes,
    ] = await Promise.all([
      clicks7dPromise,
      supabaseAdmin
        .from("upgrade_requests")
        .select("amount,package_slug")
        .eq("status", "approved")
        .gte("created_at", since30dIso)
        .limit(5000),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7dIso),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30dIso),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_banned", true),
      supabaseAdmin
        .from("links")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    const rows = clicks7dRes.data ?? [];

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const seriesMap: Record<string, { total: number; bot: number; human: number }> = {};
    for (let i = 6; i >= 0; i--) {
      seriesMap[dayKey(new Date(now.getTime() - i * 86400000))] = { total: 0, bot: 0, human: 0 };
    }

    let last24hTotal = 0, last24hBot = 0, last24hHuman = 0;
    const countryCounts: Record<string, number> = {};
    const refererCounts: Record<string, number> = {};
    const linkCounts: Record<string, { total: number; bot: number; human: number }> = {};
    const botReasonCounts: Record<string, number> = {};

    for (const r of rows as any[]) {
      const created = new Date(r.created_at);
      const bucket = seriesMap[dayKey(created)];
      if (bucket) {
        bucket.total++;
        if (r.is_bot) bucket.bot++; else bucket.human++;
      }
      if (created >= since24h) {
        last24hTotal++;
        if (r.is_bot) last24hBot++; else last24hHuman++;
      }
      const cc = (r.country || "??").toUpperCase();
      countryCounts[cc] = (countryCounts[cc] ?? 0) + 1;
      const rh = (r.referer_host || "(direct)").toLowerCase();
      refererCounts[rh] = (refererCounts[rh] ?? 0) + 1;
      const lid = r.link_id as string;
      const lc = linkCounts[lid] ?? (linkCounts[lid] = { total: 0, bot: 0, human: 0 });
      lc.total++;
      if (r.is_bot) {
        lc.bot++;
        if (r.bot_reason) {
          const tag = String(r.bot_reason).split(":")[0];
          botReasonCounts[tag] = (botReasonCounts[tag] ?? 0) + 1;
        }
      } else {
        lc.human++;
      }
    }

    const dailySeries = Object.entries(seriesMap).map(([date, v]) => ({ date, ...v }));

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([country, count]) => ({ country, count }));
    const topReferers = Object.entries(refererCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([host, count]) => ({ host, count }));
    const topBotReasons = Object.entries(botReasonCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([reason, count]) => ({ reason, count }));

    const topLinkIds = Object.entries(linkCounts)
      .sort((a, b) => b[1].total - a[1].total).slice(0, 8)
      .map(([id]) => id);

    let topLinks: Array<{ id: string; short_code: string; title: string | null; total: number; bot: number; human: number }> = [];
    if (topLinkIds.length) {
      const { data: linkRows } = await supabaseAdmin
        .from("links").select("id,short_code,title").in("id", topLinkIds);
      const byId = new Map((linkRows ?? []).map((l: any) => [l.id, l]));
      topLinks = topLinkIds.map((id) => {
        const l: any = byId.get(id) || { id, short_code: id.slice(0, 8), title: null };
        return { id: l.id, short_code: l.short_code, title: l.title, ...linkCounts[id] };
      });
    }

    let revenue30d = 0;
    const revenueByPackage: Record<string, number> = {};
    for (const r of (approvedReqsRes.data ?? []) as any[]) {
      const amt = Number(r.amount ?? 0);
      revenue30d += amt;
      revenueByPackage[r.package_slug] = (revenueByPackage[r.package_slug] ?? 0) + amt;
    }

    const total7d = dailySeries.reduce((a, b) => a + b.total, 0);
    const bot7d = dailySeries.reduce((a, b) => a + b.bot, 0);
    const human7d = dailySeries.reduce((a, b) => a + b.human, 0);

    return {
      dailySeries,
      last24h: { total: last24hTotal, bot: last24hBot, human: last24hHuman },
      last7d: { total: total7d, bot: bot7d, human: human7d, botPct: total7d ? Math.round((bot7d / total7d) * 100) : 0 },
      topCountries,
      topReferers,
      topLinks,
      topBotReasons,
      revenue: { last30d: revenue30d, byPackage: revenueByPackage },
      growth: {
        newUsers7d: newUsers7dRes.count ?? 0,
        newUsers30d: newUsers30dRes.count ?? 0,
        bannedUsers: bannedUsersRes.count ?? 0,
        activeLinks: activeLinksRes.count ?? 0,
      },
      truncated: rows.length >= 10000,
    };
  });
