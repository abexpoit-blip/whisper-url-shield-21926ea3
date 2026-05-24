import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// ============================================================
// STATS
// ============================================================
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const todayISO = new Date(Date.now() - 86_400_000).toISOString();
    const [
      { count: users },
      { count: links },
      { count: clicks },
      { count: pending },
      { count: ours },
      { count: offer },
      { count: bots },
      { count: todayTotal },
      { count: todayOurs },
      { count: bannedUsers },
      { count: activeLinks },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("links").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("upgrade_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("routed_to", "ours"),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("routed_to", "offer"),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("is_bot", true),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", todayISO),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("routed_to", "ours").gte("created_at", todayISO),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true),
      supabaseAdmin.from("links").select("*", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const monthISO = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: paidRows } = await supabaseAdmin
      .from("upgrade_requests").select("amount").eq("status", "paid").gte("created_at", monthISO);
    const mrr = (paidRows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const { data: allPaid } = await supabaseAdmin
      .from("upgrade_requests").select("amount").eq("status", "paid");
    const totalRevenue = (allPaid ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

    return {
      users: users ?? 0,
      links: links ?? 0,
      active_links: activeLinks ?? 0,
      clicks: clicks ?? 0,
      pending: pending ?? 0,
      ours: ours ?? 0,
      offer: offer ?? 0,
      bots: bots ?? 0,
      today_total: todayTotal ?? 0,
      today_ours: todayOurs ?? 0,
      banned_users: bannedUsers ?? 0,
      mrr_30d: mrr,
      total_revenue: totalRevenue,
    };
  });

// ============================================================
// TIME-SERIES CLICKS (last 14 days)
// ============================================================
export const adminClicksTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const days = 14;
    const fromISO = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await supabaseAdmin
      .from("clicks").select("created_at, routed_to, is_bot").gte("created_at", fromISO).limit(200000);
    const buckets: Record<string, { date: string; total: number; ours: number; offer: number; bots: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      buckets[d] = { date: d, total: 0, ours: 0, offer: 0, bots: 0 };
    }
    (data ?? []).forEach((c) => {
      const d = (c.created_at as string).slice(0, 10);
      if (!buckets[d]) return;
      buckets[d].total++;
      if (c.is_bot) buckets[d].bots++;
      if (c.routed_to === "ours") buckets[d].ours++;
      if (c.routed_to === "offer") buckets[d].offer++;
    });
    return Object.values(buckets);
  });

// ============================================================
// TOP COUNTRIES (last 7d)
// ============================================================
export const adminTopCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const fromISO = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data } = await supabaseAdmin
      .from("clicks").select("country").gte("created_at", fromISO).limit(100000);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((c) => {
      const k = c.country || "??";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  });

// ============================================================
// TOP USERS (by clicks)
// ============================================================
export const adminTopUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("profiles").select("id, email, clicks_used, plan_slug").order("clicks_used", { ascending: false }).limit(10);
    return data ?? [];
  });

// ============================================================
// USERS
// ============================================================
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const oursByUser: Record<string, number> = {};
    const { data: linkRows } = await supabaseAdmin.from("links").select("id, user_id");
    const linkToUser: Record<string, string> = {};
    (linkRows ?? []).forEach((l) => { linkToUser[l.id] = l.user_id; });
    const { data: oursRows } = await supabaseAdmin
      .from("clicks").select("link_id").eq("routed_to", "ours").limit(200000);
    (oursRows ?? []).forEach((r) => {
      const uid = linkToUser[r.link_id];
      if (uid) oursByUser[uid] = (oursByUser[uid] ?? 0) + 1;
    });
    return (data ?? []).map((u) => ({ ...u, ours_clicks: oursByUser[u.id] ?? 0 }));
  });

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ is_banned: data.is_banned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBulkBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500), is_banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ is_banned: data.is_banned }).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

export const adminResetUserQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ clicks_used: 0, clicks_period_start: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

export const adminBulkSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500), package_slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("slug", data.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        clicks_used: 0,
        clicks_period_start: new Date().toISOString(),
      })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

export const adminUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [{ data: profile }, { data: links }, { data: payments }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("links").select("*").eq("user_id", data.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("upgrade_requests").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const linkIds = (links ?? []).map((l) => l.id);
    const trend: { date: string; clicks: number; bots: number }[] = [];
    if (linkIds.length) {
      const fromISO = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: cl } = await supabaseAdmin
        .from("clicks").select("created_at, is_bot").in("link_id", linkIds).gte("created_at", fromISO).limit(50000);
      const buckets: Record<string, { date: string; clicks: number; bots: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
        buckets[d] = { date: d, clicks: 0, bots: 0 };
      }
      (cl ?? []).forEach((c) => {
        const d = (c.created_at as string).slice(0, 10);
        if (!buckets[d]) return;
        buckets[d].clicks++;
        if (c.is_bot) buckets[d].bots++;
      });
      trend.push(...Object.values(buckets));
    }
    return { profile, links: links ?? [], payments: payments ?? [], trend };
  });

export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), package_slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("slug", data.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        clicks_used: 0,
        clicks_period_start: new Date().toISOString(),
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// PACKAGES (CRUD)
// ============================================================
export const adminListPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("packages").select("*").eq("is_active", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data;
  });

export const adminListAllPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("packages").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
    name: z.string().min(1).max(120),
    price_usd: z.number().min(0).max(100000),
    click_quota