import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    // RLS: only admins can read these aggregates (admin policies on each table)
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
