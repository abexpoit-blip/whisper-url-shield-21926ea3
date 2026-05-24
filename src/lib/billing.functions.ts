import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Create a Plisio invoice for the selected package and return the checkout URL.
 * Plisio API: https://plisio.net/documentation/endpoints/create-an-invoice
 */
export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ package_slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) throw new Error("Plisio API key not configured");

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("slug, name, price_usd")
      .eq("slug", data.package_slug)
      .eq("is_active", true)
      .single();
    if (pkgErr || !pkg) throw new Error("Package not found");
    if (Number(pkg.price_usd) <= 0) throw new Error("This package does not require payment");

    // Add 2% network/processing fee so customer pays it ($5 -> $5.10, $50 -> $51.00)
    const chargeAmount = (Number(pkg.price_usd) * 1.02).toFixed(2);

    // Create local order first
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("upgrade_requests")
      .insert({
        user_id: context.userId,
        package_slug: pkg.slug,
        amount: Number(chargeAmount),
        status: "pending",
      })
      .select()
      .single();
    if (reqErr || !req) throw new Error("Failed to create order");

    // Build Plisio invoice
    const origin = "https://sleepox.com";
    const params = new URLSearchParams({
      api_key: apiKey,
      order_number: req.id,
      order_name: `${pkg.name} — Sleepox`,
      source_amount: chargeAmount,
      source_currency: "USD",
      currency: "USDT_TRX",
      callback_url: `${origin}/api/public/plisio-webhook?json=true`,
      success_callback_url: `${origin}/upgrade?status=success`,
      fail_callback_url: `${origin}/upgrade?status=fail`,
      email: "",
    });

    const res = await fetch(`https://api.plisio.net/api/v1/invoices/new?${params}`);
    const json = (await res.json()) as { status: string; data?: { invoice_url?: string; txn_id?: string }; message?: string };

    if (json.status !== "success" || !json.data?.invoice_url) {
      throw new Error(`Plisio error: ${json.message || "unknown"}`);
    }

    await supabaseAdmin
      .from("upgrade_requests")
      .update({
        plisio_invoice_id: json.data.txn_id || null,
        plisio_invoice_url: json.data.invoice_url,
      })
      .eq("id", req.id);

    return { invoice_url: json.data.invoice_url };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("upgrade_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });
