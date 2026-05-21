/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";

import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { getPlisioApiKey } from "@/lib/plisio-config.server";

const CreateInvoiceSchema = z.object({
  package_slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,40}$/),
});

async function logActivity(entry: Record<string, any>) {
  try {
    await (supabaseAdmin as any).from("plisio_activity_log").insert({
      event_type: "invoice_create",
      ...entry,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    console.warn("[plisio-create] activity log failed", error);
  }
}

async function getUserId(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new Error("Please login again before payment. (no token)");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Payment auth is not configured on the server.");

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    console.warn("[plisio-create] auth claims failed", { message: error?.message });
    throw new Error(
      `Please login again before payment. (${error?.message ?? "invalid token"})`,
    );
  }
  return data.claims.sub;
}

export const Route = createFileRoute("/api/public/plisio-create-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = randomUUID();
        const startedAt = Date.now();

        try {
          const userId = await getUserId(request);
          const body = CreateInvoiceSchema.parse(await request.json());
          const { apiKey, source: apiKeySource } = await getPlisioApiKey(supabaseAdmin);
          if (!apiKey) throw new Error("PLISIO_API_KEY missing on server.");

          const { data: pkg, error: pkgErr } = await (supabaseAdmin as any)
            .from("packages")
            .select("slug,name,price_monthly,price_onetime,billing_period,is_active")
            .eq("slug", body.package_slug)
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
              package_slug: body.package_slug,
              payment_method: "plisio",
              amount: totalAmount,
              transaction_ref: orderNumber,
              plisio_status: "pending",
              note: `Base $${baseAmount.toFixed(2)} + 2% fee = $${totalAmount.toFixed(2)}`,
            })
            .select("id")
            .single();
          if (insErr || !reqRow)
            throw new Error(insErr?.message ?? "Could not create upgrade request");

          const origin = process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
          const params = new URLSearchParams({
            api_key: apiKey,
            source_amount: totalAmount.toFixed(2),
            source_currency: "USD",
            currency: "BTC",
            order_name: `${pkg.name} — ${body.package_slug}`,
            order_number: orderNumber,
            callback_url: `${origin}/api/public/plisio-webhook?json=true`,
            success_url: `${origin}/upgrade?payment=success`,
            fail_url: `${origin}/upgrade?payment=failed`,
            email: profile?.email ?? "",
            expire_min: "30",
          });

          const res = await fetch(
            `https://api.plisio.net/api/v1/invoices/new?${params.toString()}`,
          );
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

          await logActivity({
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
              package_slug: body.package_slug,
              total_amount: totalAmount,
              duration_ms: Date.now() - startedAt,
              api_key_source: apiKeySource,
            },
          });

          return Response.json({
            invoice_url: payload.data.invoice_url,
            request_id: reqRow.id,
            total_amount: totalAmount,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create invoice";
          console.warn("[plisio-create] failed", { requestId, message });
          await logActivity({
            request_id: requestId,
            status_code: 400,
            outcome: "error",
            message,
            metadata: { duration_ms: Date.now() - startedAt },
          });
          return Response.json({ error: message }, { status: 400 });
        }
      },
      GET: async () => new Response("plisio create invoice alive", { status: 200 }),
    },
  },
});
