/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getPlisioApiKey } from "@/lib/plisio-config.server";

const SlugRe = /^[a-z0-9_-]{2,40}$/;

type PackageRow = {
  slug: string;
  name: string;
  price_monthly: number | string | null;
  price_onetime: number | string | null;
  billing_period: string | null;
  is_active: boolean | null;
};
type ProfileRow = { email?: string | null };
type UpgradeRequestRow = { id: string };
type PlisioPayload = {
  status?: string;
  message?: string;
  data?: { invoice_url?: string; txn_id?: string; message?: string };
};

const CreateInvoiceSchema = z.object({
  package_slug: z.string().trim().regex(SlugRe),
});

async function getVerifiedUserIdFromRequest() {
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Please login again.");

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: Please login again.");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) throw new Error("Unauthorized: Please login again.");
  return data.user.id;
}

async function logActivity(
  supabaseAdmin: any,
  entry: {
    event_type: "invoice_create" | "webhook_received";
    request_id: string;
    correlation_id?: string | null;
    status_code?: number | null;
    outcome: string;
    upgrade_request_id?: string | null;
    user_id?: string | null;
    txn_id?: string | null;
    order_number?: string | null;
    plisio_status?: string | null;
    message?: string | null;
    metadata?: Record<string, any>;
  },
) {
  try {
    await supabaseAdmin.from("plisio_activity_log").insert({
      ...entry,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.warn("[plisio-activity] insert failed", e);
  }
}

// Create a Plisio invoice for the chosen package, persist an upgrade_request,
// and return the hosted checkout URL.
export const createPlisioInvoice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreateInvoiceSchema.parse(i))
  .handler(async ({ data }) => {
    const userId = await getVerifiedUserIdFromRequest();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const requestId = randomUUID();
    const startedAt = Date.now();

    const { apiKey, source: apiKeySource } = await getPlisioApiKey(supabaseAdmin);
    if (!apiKey) {
      await logActivity(supabaseAdmin, {
        event_type: "invoice_create",
        request_id: requestId,
        outcome: "error",
        user_id: userId,
        message: "PLISIO_API_KEY missing",
        metadata: { package_slug: data.package_slug },
      });
      throw new Error("Plisio is not configured. Admin must add PLISIO_API_KEY.");
    }

    // 1) Load the package
    const { data: pkg, error: pkgErr } = await (supabaseAdmin as any)
      .from("packages")
      .select("slug,name,price_monthly,price_onetime,billing_period,is_active")
      .eq("slug", data.package_slug)
      .single();
    if (pkgErr || !pkg || !pkg.is_active) {
      await logActivity(supabaseAdmin, {
        event_type: "invoice_create",
        request_id: requestId,
        outcome: "error",
        user_id: userId,
        message: "Package not available",
        metadata: { package_slug: data.package_slug, pkgErr: pkgErr?.message },
      });
      throw new Error("Package not available");
    }

    const isLifetime = pkg.billing_period === "lifetime" || Number(pkg.price_onetime) > 0;
    const baseAmount = Number(isLifetime ? pkg.price_onetime : pkg.price_monthly);
    if (!baseAmount || baseAmount <= 0) {
      await logActivity(supabaseAdmin, {
        event_type: "invoice_create",
        request_id: requestId,
        outcome: "error",
        user_id: userId,
        message: "Free plan — no payment required",
        metadata: { package_slug: data.package_slug },
      });
      throw new Error("This plan is free — no payment required.");
    }

    const FEE_PCT = 0.02;
    const totalAmount = Math.round(baseAmount * (1 + FEE_PCT) * 100) / 100;

    const { data: profile } = await (supabaseAdmin as any)
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
    if (insErr) {
      await logActivity(supabaseAdmin, {
        event_type: "invoice_create",
        request_id: requestId,
        correlation_id: orderNumber,
        outcome: "error",
        user_id: userId,
        order_number: orderNumber,
        message: `DB insert failed: ${insErr.message}`,
        metadata: { package_slug: data.package_slug },
      });
      throw new Error(insErr.message);
    }

    const origin = process.env.PUBLIC_SITE_URL || "https://sleepox.com";
    const callbackUrl = `${origin}/api/public/plisio-webhook?json=true`;
    const successUrl = `${origin}/upgrade?payment=success`;
    const failUrl = `${origin}/upgrade?payment=failed`;

    const params = new URLSearchParams({
      api_key: apiKey,
      source_amount: totalAmount.toFixed(2),
      source_currency: "USD",
      currency: "BTC",
      order_name: `${pkg.name} — ${data.package_slug}`,
      order_number: orderNumber,
      callback_url: callbackUrl,
      success_url: successUrl,
      fail_url: failUrl,
      email: profile?.email ?? "",
      expire_min: "30",
    });

    const res = await fetch(`https://api.plisio.net/api/v1/invoices/new?${params.toString()}`);
    const payload: any = await res.json().catch(() => ({}));
    const durationMs = Date.now() - startedAt;

    if (!res.ok || payload?.status !== "success" || !payload?.data?.invoice_url) {
      const msg = payload?.data?.message || payload?.message || `Plisio error (${res.status})`;
      console.warn("Plisio invoice create failed", {
        status: res.status,
        message: msg,
        orderNumber,
      });
      await (supabaseAdmin as any)
        .from("upgrade_requests")
        .update({ plisio_status: "error", note: msg })
        .eq("id", reqRow.id);

      await logActivity(supabaseAdmin, {
        event_type: "invoice_create",
        request_id: requestId,
        correlation_id: orderNumber,
        status_code: res.status,
        outcome: "error",
        upgrade_request_id: reqRow.id,
        user_id: userId,
        order_number: orderNumber,
        plisio_status: "error",
        message: msg,
        metadata: {
          package_slug: data.package_slug,
          base_amount: baseAmount,
          total_amount: totalAmount,
          duration_ms: durationMs,
          plisio_response: payload,
          api_key_source: apiKeySource,
        },
      });
      throw new Error(msg);
    }

    const invoiceUrl = String(payload.data.invoice_url);
    const txnId = String(payload.data.txn_id ?? "");

    await (supabaseAdmin as any)
      .from("upgrade_requests")
      .update({ plisio_invoice_id: txnId, plisio_invoice_url: invoiceUrl })
      .eq("id", reqRow.id);

    await logActivity(supabaseAdmin, {
      event_type: "invoice_create",
      request_id: requestId,
      correlation_id: orderNumber,
      status_code: res.status,
      outcome: "success",
      upgrade_request_id: reqRow.id,
      user_id: userId,
      txn_id: txnId,
      order_number: orderNumber,
      plisio_status: "pending",
      message: `Invoice created (${pkg.name})`,
      metadata: {
        package_slug: data.package_slug,
        base_amount: baseAmount,
        total_amount: totalAmount,
        fee_pct: FEE_PCT,
        duration_ms: durationMs,
        invoice_url: invoiceUrl,
        api_key_source: apiKeySource,
      },
    });

    return {
      invoice_url: invoiceUrl,
      txn_id: txnId,
      request_id: reqRow.id,
      base_amount: baseAmount,
      total_amount: totalAmount,
      fee_pct: FEE_PCT,
    };
  });
