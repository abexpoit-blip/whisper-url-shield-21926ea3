import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueRetry, processPlisioPayload } from "@/lib/plisio-process.server";


async function logActivity(entry: {
  request_id: string;
  correlation_id?: string | null;
  status_code: number;
  outcome: string;
  upgrade_request_id?: string | null;
  user_id?: string | null;
  txn_id?: string | null;
  order_number?: string | null;
  plisio_status?: string | null;
  message?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    await (supabaseAdmin as any).from("plisio_activity_log").insert({
      event_type: "webhook_received",
      ...entry,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.warn("[plisio-activity] webhook log failed", e);
  }
}

// Plisio sends POST callback with JSON body (when ?json=true is on callback_url).
// Verification: HMAC-SHA1(sorted_post_minus_verify_hash, api_secret).
export const Route = createFileRoute("/api/public/plisio-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = randomUUID();
        const startedAt = Date.now();
        const apiKey = process.env.PLISIO_API_KEY;
        if (!apiKey) {
          await logActivity({
            request_id: requestId, status_code: 500, outcome: "error",
            message: "PLISIO_API_KEY missing",
          });
          return new Response("not configured", { status: 500 });
        }

        let payload: Record<string, any>;
        try {
          payload = await request.json();
        } catch {
          await logActivity({
            request_id: requestId, status_code: 400, outcome: "error",
            message: "Invalid JSON body",
          });
          return new Response("invalid json", { status: 400 });
        }

        const txnId = String(payload.txn_id ?? "");
        const orderNumber = String(payload.order_number ?? "");
        const status = String(payload.status ?? "");

        const verifyHash = String(payload.verify_hash ?? "");
        if (!verifyHash) {
          await logActivity({
            request_id: requestId, correlation_id: orderNumber, status_code: 401,
            outcome: "error", txn_id: txnId, order_number: orderNumber,
            plisio_status: status, message: "Missing verify_hash",
            metadata: { payload },
          });
          return new Response("missing hash", { status: 401 });
        }

        const clone: Record<string, any> = { ...payload };
        delete clone.verify_hash;
        const sorted = Object.keys(clone).sort().reduce<Record<string, any>>((acc, k) => {
          acc[k] = clone[k]; return acc;
        }, {});
        const jsonBody = JSON.stringify(sorted);
        const expectedJson = createHmac("sha1", apiKey).update(jsonBody).digest("hex");
        const formBody = Object.entries(sorted)
          .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
          .join("&");
        const expectedForm = createHmac("sha1", apiKey).update(formBody).digest("hex");

        const provided = Buffer.from(verifyHash);
        const okJson = provided.length === expectedJson.length &&
          timingSafeEqual(provided, Buffer.from(expectedJson));
        const okForm = provided.length === expectedForm.length &&
          timingSafeEqual(provided, Buffer.from(expectedForm));

        if (!okJson && !okForm) {
          console.warn("Plisio webhook hash mismatch", { txnId, orderNumber });
          await (supabaseAdmin as any).from("plisio_webhook_logs").insert({
            txn_id: txnId, order_number: orderNumber, status,
            signature_valid: false, payload, note: "Rejected: signature mismatch",
          });
          await logActivity({
            request_id: requestId, correlation_id: orderNumber, status_code: 401,
            outcome: "signature_invalid", txn_id: txnId, order_number: orderNumber,
            plisio_status: status, message: "Signature mismatch",
            metadata: { duration_ms: Date.now() - startedAt, payload },
          });
          return new Response("invalid signature", { status: 401 });
        }

        const result = await processPlisioPayload(payload);

        // Transient failure → enqueue for retry, still return 200 so Plisio doesn't hammer us.
        if (!result.ok && result.retryable) {
          await enqueueRetry({
            payload,
            txn_id: txnId,
            order_number: orderNumber,
            source: "webhook",
            last_error: result.message,
          });
          await logActivity({
            request_id: requestId, correlation_id: orderNumber, status_code: 202,
            outcome: "queued_for_retry", txn_id: txnId, order_number: orderNumber,
            plisio_status: status, message: `Enqueued for retry: ${result.message}`,
            metadata: { duration_ms: Date.now() - startedAt, error: result.message },
          });
          return new Response("queued", { status: 202 });
        }

        const sanity = createHash("sha1").update(txnId).digest("hex").slice(0, 8);
        console.log(`Plisio webhook handled txn=${txnId} status=${status} outcome=${result.outcome} sig=${sanity}`);

        await logActivity({
          request_id: requestId, correlation_id: orderNumber, status_code: result.status_code,
          outcome: result.outcome,
          upgrade_request_id: result.upgrade_request_id ?? null,
          user_id: result.user_id ?? null,
          txn_id: txnId, order_number: orderNumber, plisio_status: status,
          message: result.message,
          metadata: { duration_ms: Date.now() - startedAt, package_slug: result.package_slug ?? null },
        });

        return new Response("ok", { status: 200 });

      },
      GET: async () => new Response("plisio webhook alive", { status: 200 }),
    },
  },
});
