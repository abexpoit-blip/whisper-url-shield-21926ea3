import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nextBackoffSeconds, processPlisioPayload } from "@/lib/plisio-process.server";

const MAX_PER_RUN = 25;

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
      event_type: "webhook_retry",
      ...entry,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.warn("[plisio-retry] activity log failed", e);
  }
}

export const Route = createFileRoute("/api/public/hooks/plisio-retry-queue")({
  server: {
    handlers: {
      POST: async () => {
        const runId = randomUUID();
        const nowIso = new Date().toISOString();

        const { data: rows, error } = await (supabaseAdmin as any)
          .from("plisio_webhook_retry_queue")
          .select("*")
          .eq("status", "queued")
          .lte("next_attempt_at", nowIso)
          .order("next_attempt_at", { ascending: true })
          .limit(MAX_PER_RUN);

        if (error) {
          console.error("[plisio-retry] fetch failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const items = (rows ?? []) as any[];
        let processed = 0, succeeded = 0, requeued = 0, failed = 0;

        for (const item of items) {
          processed++;
          // Mark processing (best-effort lock).
          await (supabaseAdmin as any)
            .from("plisio_webhook_retry_queue")
            .update({ status: "processing", last_attempt_at: nowIso })
            .eq("id", item.id);

          const result = await processPlisioPayload(item.payload || {});
          const nextAttempt = (item.attempts ?? 0) + 1;

          if (result.ok) {
            succeeded++;
            await (supabaseAdmin as any)
              .from("plisio_webhook_retry_queue")
              .update({
                status: "done",
                attempts: nextAttempt,
                last_error: null,
              })
              .eq("id", item.id);

            await logActivity({
              request_id: runId,
              correlation_id: item.order_number ?? null,
              status_code: result.status_code,
              outcome: `retry_${result.outcome}`,
              upgrade_request_id: result.upgrade_request_id ?? null,
              user_id: result.user_id ?? null,
              txn_id: item.txn_id ?? null,
              order_number: item.order_number ?? null,
              plisio_status: String(item.payload?.status ?? ""),
              message: `Retry success (attempt ${nextAttempt}): ${result.message}`,
              metadata: { retry_id: item.id, attempts: nextAttempt },
            });
          } else if (result.retryable && nextAttempt < (item.max_attempts ?? 6)) {
            requeued++;
            const delay = nextBackoffSeconds(nextAttempt);
            const nextAt = new Date(Date.now() + delay * 1000).toISOString();
            await (supabaseAdmin as any)
              .from("plisio_webhook_retry_queue")
              .update({
                status: "queued",
                attempts: nextAttempt,
                next_attempt_at: nextAt,
                last_error: result.message,
              })
              .eq("id", item.id);

            await logActivity({
              request_id: runId,
              correlation_id: item.order_number ?? null,
              status_code: result.status_code,
              outcome: "retry_requeued",
              txn_id: item.txn_id ?? null,
              order_number: item.order_number ?? null,
              message: `Retry failed (attempt ${nextAttempt}/${item.max_attempts}): ${result.message}. Next in ${delay}s.`,
              metadata: { retry_id: item.id, attempts: nextAttempt, next_in_seconds: delay },
            });
          } else {
            failed++;
            await (supabaseAdmin as any)
              .from("plisio_webhook_retry_queue")
              .update({
                status: "failed",
                attempts: nextAttempt,
                last_error: result.message,
              })
              .eq("id", item.id);

            await logActivity({
              request_id: runId,
              correlation_id: item.order_number ?? null,
              status_code: result.status_code,
              outcome: "retry_failed",
              txn_id: item.txn_id ?? null,
              order_number: item.order_number ?? null,
              message: `Retry exhausted (attempt ${nextAttempt}): ${result.message}`,
              metadata: { retry_id: item.id, attempts: nextAttempt },
            });
          }
        }

        return new Response(JSON.stringify({
          ok: true, run_id: runId, processed, succeeded, requeued, failed,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
      GET: async () => new Response("plisio retry queue worker alive", { status: 200 }),
    },
  },
});
