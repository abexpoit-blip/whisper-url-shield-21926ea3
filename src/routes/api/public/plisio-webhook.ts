import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Plisio callback verification.
 *
 * Form-encoded callbacks use the "sort values then md5" scheme. JSON callbacks
 * (?json=true) use a different scheme (PHP serialize) that's fragile in JS,
 * so for JSON we also re-fetch the operation from Plisio as a source of truth.
 *
 * Docs: https://plisio.net/documentation/appendices/script-of-checking-data-from-callback
 */
function verifyFormHash(body: Record<string, string>, apiKey: string): boolean {
  const verifyHash = body.verify_hash;
  if (!verifyHash) return false;
  const clone = { ...body };
  delete clone.verify_hash;
  const ordered = Object.keys(clone).sort().map((k) => clone[k]).join(":");
  const expected = createHash("md5").update(`${ordered}:${apiKey}`).digest("hex");
  return expected === verifyHash;
}

async function fetchPlisioOperation(txnId: string, apiKey: string) {
  try {
    const res = await fetch(`https://api.plisio.net/api/v1/operations/${encodeURIComponent(txnId)}?api_key=${encodeURIComponent(apiKey)}`);
    const json = await res.json() as { status?: string; data?: { status?: string; order_number?: string } };
    if (json.status === "success" && json.data) return json.data;
  } catch (e) {
    console.error("[plisio] fetch operation failed", e);
  }
  return null;
}

export const Route = createFileRoute("/api/public/plisio-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.PLISIO_API_KEY;
        if (!apiKey) {
          console.error("[plisio] PLISIO_API_KEY missing");
          return new Response("not configured", { status: 500 });
        }

        const rawText = await request.text();
        const body: Record<string, string> = {};
        let isJson = false;

        if (rawText.trim().startsWith("{")) {
          isJson = true;
          try {
            const j = JSON.parse(rawText);
            for (const k of Object.keys(j)) body[k] = typeof j[k] === "string" ? j[k] : JSON.stringify(j[k]);
          } catch (e) {
            console.error("[plisio] JSON parse failed", e);
            return new Response("bad json", { status: 400 });
          }
        } else {
          const params = new URLSearchParams(rawText);
          params.forEach((v, k) => { body[k] = v; });
        }

        // Verification: form callback uses verify_hash; JSON callback we re-fetch from Plisio.
        let verified = false;
        if (!isJson) {
          verified = verifyFormHash(body, apiKey);
          if (!verified) {
            console.error("[plisio] form verify_hash mismatch", { keys: Object.keys(body) });
          }
        }

        const orderNumber = body.order_number;
        const txnId = body.txn_id || body.id;
        let status = body.status;

        if (!orderNumber && !txnId) {
          console.error("[plisio] no order_number or txn_id in callback", { body });
          return new Response("no order", { status: 400 });
        }

        // For JSON callbacks (or if hash failed), confirm via Plisio API
        if (!verified && txnId) {
          const op = await fetchPlisioOperation(txnId, apiKey);
          if (!op) {
            console.error("[plisio] could not verify via API", { txnId });
            return new Response("unverified", { status: 401 });
          }
          if (op.status) status = op.status;
          verified = true;
        }

        if (!verified) {
          return new Response("invalid signature", { status: 401 });
        }
        if (!status) {
          console.error("[plisio] no status after verification", { orderNumber, txnId });
          return new Response("no status", { status: 400 });
        }

        const { data: req } = await supabaseAdmin
          .from("upgrade_requests")
          .select("id, user_id, package_slug, status")
          .eq("id", orderNumber)
          .maybeSingle();
        if (!req) return new Response("not found", { status: 404 });

        await supabaseAdmin
          .from("upgrade_requests")
          .update({ status })
          .eq("id", req.id);

        if (status === "completed" && req.status !== "completed") {
          // Apply package to user
          const { data: pkg } = await supabaseAdmin
            .from("packages").select("slug, click_quota, link_limit")
            .eq("slug", req.package_slug).single();
          if (pkg) {
            await supabaseAdmin
              .from("profiles")
              .update({
                plan_slug: pkg.slug,
                click_quota: pkg.click_quota,
                link_limit: pkg.link_limit,
                clicks_used: 0,
                clicks_period_start: new Date().toISOString(),
              })
              .eq("id", req.user_id);
          }
        }

        return new Response("ok");
      },
      GET: async () => new Response("ok"),
    },
  },
});
