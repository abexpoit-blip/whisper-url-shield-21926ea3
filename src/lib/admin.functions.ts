import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

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
    ]);
    return {
      users: users ?? 0,
      links: links ?? 0,
      clicks: clicks ?? 0,
      pending: pending ?? 0,
      ours: ours ?? 0,
      offer: offer ?? 0,
      bots: bots ?? 0,
      today_total: todayTotal ?? 0,
      today_ours: todayOurs ?? 0,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);

    // Build map: user_id -> total "ours" clicks (admin monetization revenue)
    const oursByUser: Record<string, number> = {};
    const { data: linkRows } = await supabaseAdmin.from("links").select("id, user_id");
    const linkToUser: Record<string, string> = {};
    (linkRows ?? []).forEach((l) => { linkToUser[l.id] = l.user_id; });
    const { data: oursRows } = await supabaseAdmin
      .from("clicks").select("link_id").eq("routed_to", "ours").limit(100000);
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

export const adminListPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("packages").select("*").eq("is_active", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data;
  });

export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    package_slug: z.string().min(1).max(64),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pkg, error: pErr } = await supabaseAdmin
      .from("packages").select("*").eq("slug", data.package_slug).maybeSingle();
    if (pErr || !pkg) throw new Error("Package not found");
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

export const adminListUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id, user_id, package_slug, amount, status, plisio_invoice_id, plisio_invoice_url, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Attach user email for display
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    let emailMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, email").in("id", ids);
      emailMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email ?? ""]));
    }
    return (data ?? []).map((r) => ({ ...r, email: emailMap[r.user_id] ?? "" }));
  });

export const adminDecideUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req, error: rErr } = await supabaseAdmin
      .from("upgrade_requests").select("*").eq("id", data.id).maybeSingle();
    if (rErr || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Request already ${req.status}`);

    if (data.decision === "reject") {
      const { error } = await supabaseAdmin
        .from("upgrade_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // approve: apply package then mark paid
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("slug", req.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        clicks_used: 0,
        clicks_period_start: new Date().toISOString(),
      })
      .eq("id", req.user_id);
    if (pErr) throw new Error(pErr.message);
    const { error: uErr } = await supabaseAdmin
      .from("upgrade_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });
