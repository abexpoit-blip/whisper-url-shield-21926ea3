/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SlugRe = /^[a-z0-9_-]{2,40}$/;

const CURRENT_PACKAGE_SLUGS = ["free", "pro_monthly", "lifetime"] as const;
const CURRENT_PACKAGE_SET = new Set<string>(CURRENT_PACKAGE_SLUGS);

const CURRENT_PACKAGE_CATALOG = [
  {
    id: "free",
    slug: "free",
    name: "Free",
    price_monthly: 0,
    price_onetime: 0,
    billing_period: "free",
    link_limit: 1,
    click_limit: 10000,
    features: ["1 short link", "10K tracked clicks", "Bot & fraud filtering", "Basic analytics"],
    sort_order: 0,
    is_active: true,
    created_at: null,
  },
  {
    id: "pro_monthly",
    slug: "pro_monthly",
    name: "Pro Monthly",
    price_monthly: 5,
    price_onetime: 0,
    billing_period: "monthly",
    link_limit: 50,
    click_limit: 1000000,
    features: [
      "50 short links",
      "1M tracked clicks per month",
      "Bot & fraud filtering",
      "Custom domains",
      "Advanced analytics",
      "Geo, device, OS, time & referer targeting",
      "Prelander variants",
      "Priority support",
    ],
    sort_order: 1,
    is_active: true,
    created_at: null,
  },
  {
    id: "lifetime",
    slug: "lifetime",
    name: "Lifetime",
    price_monthly: 0,
    price_onetime: 50,
    billing_period: "lifetime",
    link_limit: null,
    click_limit: null,
    features: [
      "Unlimited short links",
      "Unlimited clicks — forever",
      "Everything in Pro Monthly",
      "All current & future features",
      "Unlimited custom domains",
      "Unlimited prelander variants",
      "Full targeting suite",
      "Auto-tuning variant autopilot",
      "Advanced analytics + exports",
      "API access",
      "Priority support — lifetime",
      "One-time payment — no renewals ever",
    ],
    sort_order: 2,
    is_active: true,
    created_at: null,
  },
] as const;

function currentPackages(rows: any[] | null | undefined) {
  const bySlug = new Map((rows ?? []).map((row: any) => [row.slug, row]));
  return CURRENT_PACKAGE_CATALOG.map((pkg) => ({
    ...pkg,
    id: bySlug.get(pkg.slug)?.id ?? pkg.id,
    created_at: bySlug.get(pkg.slug)?.created_at ?? pkg.created_at,
  }));
}

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
  payment_method: z.literal("plisio").default("plisio"),
  transaction_ref: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

const CreatePlisioInvoiceSchema = z.object({
  package_slug: z.string().trim().regex(SlugRe),
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

async function logPlisioInvoiceActivity(admin: any, entry: Record<string, any>) {
  try {
    await admin.from("plisio_activity_log").insert({
      event_type: "invoice_create",
      ...entry,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    console.warn("[plisio-create] activity log failed", error);
  }
}

// ---------- Packages ----------
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("packages")
      .select(
        "id,slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order,is_active,created_at",
      )
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAvailablePackages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await (supabase as any)
    .from("packages")
    .select(
      "id,slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order,is_active,created_at",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return currentPackages(data);
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
  .handler(async () => {
    throw new Error("Manual upgrade requests are disabled. Please use automatic Plisio checkout.");
  });

export const createPlisioInvoice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreatePlisioInvoiceSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPlisioApiKey } = await import("@/lib/plisio-config.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const { requirePaymentUser } = await import("@/lib/payment-auth.server");
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    let userId: string | undefined;

    try {
      const request = getRequest();
      if (!request) throw new Error("Please login again before payment. (missing request)");
      const paymentUser = await requirePaymentUser(request);
      userId = paymentUser.userId;

      const { apiKey, source: apiKeySource } = await getPlisioApiKey(supabaseAdmin);
      if (!apiKey) throw new Error("PLISIO_API_KEY missing on server.");

      const { data: pkg, error: pkgErr } = await (supabaseAdmin as any)
        .from("packages")
        .select("slug,name,price_monthly,price_onetime,billing_period,is_active")
        .eq("slug", data.package_slug)
        .single();
      if (pkgErr || !pkg?.is_active) throw new Error("Package not available");

      const baseAmount = Number(
        pkg.billing_period === "lifetime" || Number(pkg.price_onetime) > 0
          ? pkg.price_onetime
          : pkg.price_monthly,
      );
      if (!baseAmount || baseAmount <= 0)
        throw new Error("This plan is free — no payment required.");

      const totalAmount = Math.round(baseAmount * 1.02 * 100) / 100;
      const { data: profile } = await (paymentUser.supabase as any)
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      const orderNumber = `up_${userId.slice(0, 8)}_${Date.now()}`;

      const { data: reqRow, error: insErr } = await (supabaseAdmin as any)
        .from("upgrade_requests")
        .insert({
          user_id: userId,
          package_slug: data.package_slug,
          payment_method: "plisio",
          amount: totalAmount,
          transaction_ref: orderNumber,
          plisio_status: "pending",
          note: `Base $${baseAmount.toFixed(2)} + 2% fee = $${totalAmount.toFixed(2)}`,
        })
        .select("id")
        .single();
      if (insErr || !reqRow) throw new Error(insErr?.message ?? "Could not create upgrade request");

      const origin = process.env.PUBLIC_SITE_URL || (request ? new URL(request.url).origin : "");
      const params = new URLSearchParams({
        api_key: apiKey,
        source_amount: totalAmount.toFixed(2),
        source_currency: "USD",
        currency: "BTC",
        order_name: `${pkg.name} — ${data.package_slug}`,
        order_number: orderNumber,
        callback_url: `${origin}/api/public/plisio-webhook?json=true`,
        success_url: `${origin}/upgrade?payment=success`,
        fail_url: `${origin}/upgrade?payment=failed`,
        email: profile?.email ?? "",
        expire_min: "30",
      });

      const res = await fetch(`https://api.plisio.net/api/v1/invoices/new?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== "success" || !payload?.data?.invoice_url) {
        const message =
          payload?.data?.message || payload?.message || `Plisio error (${res.status})`;
        await (supabaseAdmin as any)
          .from("upgrade_requests")
          .update({ plisio_status: "error", note: message })
          .eq("id", reqRow.id);
        throw new Error(message);
      }

      await (supabaseAdmin as any)
        .from("upgrade_requests")
        .update({
          plisio_invoice_id: payload.data.txn_id ?? null,
          plisio_invoice_url: payload.data.invoice_url,
        })
        .eq("id", reqRow.id);

      await logPlisioInvoiceActivity(supabaseAdmin, {
        request_id: requestId,
        correlation_id: orderNumber,
        status_code: res.status,
        outcome: "success",
        upgrade_request_id: reqRow.id,
        user_id: userId,
        txn_id: payload.data.txn_id ?? null,
        order_number: orderNumber,
        plisio_status: "pending",
        message: `Invoice created (${pkg.name})`,
        metadata: {
          package_slug: data.package_slug,
          total_amount: totalAmount,
          duration_ms: Date.now() - startedAt,
          api_key_source: apiKeySource,
        },
      });

      return {
        invoice_url: payload.data.invoice_url,
        request_id: reqRow.id,
        total_amount: totalAmount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create invoice";
      console.warn("[plisio-create] failed", { requestId, message });
      await logPlisioInvoiceActivity(supabaseAdmin, {
        request_id: requestId,
        status_code: 400,
        outcome: "error",
        user_id: userId,
        message,
        metadata: { duration_ms: Date.now() - startedAt },
      });
      throw new Error(message);
    }
  });

export const listMyUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("upgrade_requests")
      .select(
        "id,package_slug,status,amount,payment_method,transaction_ref,note,created_at,reviewed_at,plisio_status,plisio_invoice_url,plisio_invoice_id",
      )
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
      .select(
        "id,user_id,package_slug,status,amount,payment_method,transaction_ref,note,created_at,reviewed_at,plisio_status,plisio_invoice_id,plisio_invoice_url",
      )
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

export const getUpgradeRequestDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v: any = i;
    if (!v?.id || typeof v.id !== "string") throw new Error("id required");
    return { id: v.id as string };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: req, error } = await (supabase as any)
      .from("upgrade_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("id,email,full_name,plan_slug")
      .eq("id", req.user_id)
      .maybeSingle();

    const { data: logs } = await (supabase as any)
      .from("plisio_webhook_logs")
      .select("id,txn_id,order_number,status,signature_valid,payload,note,created_at")
      .or(
        `upgrade_request_id.eq.${req.id}${req.plisio_invoice_id ? `,txn_id.eq.${req.plisio_invoice_id}` : ""}${req.transaction_ref ? `,order_number.eq.${req.transaction_ref}` : ""}`,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    return { request: req, profile: profile ?? null, logs: logs ?? [] };
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
      .update({
        status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        note: data.note ?? null,
      })
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

export const getPublicPaymentSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("payment_settings")
    .select("plisio_enabled,payment_instructions,updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { plisio_enabled: false, payment_instructions: null, updated_at: null };
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
export const listActivePackages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await (supabase as any)
    .from("packages")
    .select(
      "slug,name,price_monthly,price_onetime,billing_period,link_limit,click_limit,features,sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Auto-expire any Plisio invoices older than 30 minutes that never completed.
// Called from the upgrade page on load so the UI always reflects accurate state.
export const expireStalePlisioRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from("upgrade_requests")
      .update({
        status: "rejected",
        plisio_status: "expired",
        reviewed_at: new Date().toISOString(),
        note: "Auto-expired: payment not completed within 30 minutes.",
      })
      .eq("user_id", userId)
      .eq("payment_method", "plisio")
      .eq("status", "pending")
      .not("plisio_status", "in", '("completed","approved")')
      .lt("created_at", cutoff)
      .select("id");
    if (error) {
      console.warn("[expire-stale] failed", error.message);
      return { expired: 0 };
    }
    return { expired: data?.length ?? 0 };
  });

