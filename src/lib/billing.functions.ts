import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SlugRe = /^[a-z0-9_-]{2,40}$/;

const PackageCreateSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(SlugRe),
  name: z.string().trim().min(1).max(60),
  price_monthly: z.number().min(0).max(99999),
  link_limit: z.number().int().min(0).max(1000000),
  features: z.array(z.string().min(1).max(120)).max(20).default([]),
  sort_order: z.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

const PackageUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  price_monthly: z.number().min(0).max(99999).optional(),
  link_limit: z.number().int().min(0).max(1000000).optional(),
  features: z.array(z.string().min(1).max(120)).max(20).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

const IdSchema = z.object({ id: z.string().uuid() });

const UpgradeRequestSchema = z.object({
  package_slug: z.string().trim().regex(SlugRe),
  payment_method: z.enum(["plisio", "manual"]).default("manual"),
  transaction_ref: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

const ReviewSchema = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

const PaymentSettingsSchema = z.object({
  plisio_enabled: z.boolean().optional(),
  plisio_api_key: z.string().trim().max(200).optional().nullable(),
  plisio_webhook_secret: z.string().trim().max(200).optional().nullable(),
  payment_instructions: z.string().trim().max(2000).optional().nullable(),
});

const AssignPlanSchema = z.object({
  user_id: z.string().uuid(),
  package_slug: z.string().trim().regex(SlugRe),
});

// ---------- Packages ----------
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("packages")
      .select("id,slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order,is_active,created_at")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAvailablePackages = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("packages")
      .select("id,slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order,is_active,created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PackageCreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Unauthorized: Admin access required");
    const { error } = await (context.supabase as any).from("packages").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PackageUpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Unauthorized: Admin access required");
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("packages").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: role } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Unauthorized: Admin access required");
    const { error } = await (context.supabase as any).from("packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Current plan (for any signed-in user) ----------
export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("plan_slug,link_quota,links_used")
      .eq("id", userId)
      .single();
    return profile ?? { plan_slug: "free", link_quota: 1, links_used: 0 };
  });

// ---------- Upgrade requests ----------
export const requestUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpgradeRequestSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pkg } = await (supabase as any)
      .from("packages")
      .select("price_monthly,price_onetime,billing_period,is_active")
      .eq("slug", data.package_slug)
      .single();
    if (!pkg || !pkg.is_active) throw new Error("Package not available");
    const amount = pkg.billing_period === "lifetime" || Number(pkg.price_onetime) > 0
      ? pkg.price_onetime
      : pkg.price_monthly;
    const { error } = await (supabase as any).from("upgrade_requests").insert({
      user_id: userId,
      package_slug: data.package_slug,
      payment_method: data.payment_method,
      transaction_ref: data.transaction_ref ?? null,
      amount,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("upgrade_requests")
      .select("id,package_slug,status,amount,payment_method,transaction_ref,note,created_at,reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("upgrade_requests")
      .select("id,user_id,package_slug,status,amount,payment_method,transaction_ref,note,created_at,reviewed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    let emails: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id,email")
        .in("id", userIds);
      emails = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return (data ?? []).map((r: any) => ({ ...r, user_email: emails[r.user_id] ?? null }));
  });

export const reviewUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReviewSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error: re } = await (supabase as any)
      .from("upgrade_requests")
      .select("id,user_id,package_slug,status")
      .eq("id", data.id)
      .single();
    if (re || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Already reviewed");

    const newStatus = data.approve ? "approved" : "rejected";
    const { error: ue } = await (supabase as any)
      .from("upgrade_requests")
      .update({ status: newStatus, reviewed_by: userId, reviewed_at: new Date().toISOString(), note: data.note ?? null })
      .eq("id", data.id);
    if (ue) throw new Error(ue.message);

    if (data.approve) {
      const { error: pe } = await (supabase as any)
        .from("profiles")
        .update({ plan_slug: req.package_slug })
        .eq("id", req.user_id);
      if (pe) throw new Error(pe.message);
    }
    return { ok: true, status: newStatus };
  });

// ---------- Payment settings ----------
export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("payment_settings")
      .select("plisio_enabled,plisio_api_key,plisio_webhook_secret,payment_instructions,updated_at")
      .eq("id", 1)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PaymentSettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("payment_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: directly assign a plan to a user ----------
export const adminAssignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AssignPlanSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ plan_slug: data.package_slug })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public — list active packages for pricing page (no auth required for unauthed view via client)
export const listActivePackages = createServerFn({ method: "GET" })
  .handler(async () => {
    // Use anon read via service role admin client is unnecessary; packages have public-active policy
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("packages")
      .select("slug,name,price_monthly,link_limit,features,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
