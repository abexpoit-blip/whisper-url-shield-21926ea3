import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ProcessOutcome = {
  ok: boolean;
  outcome: string;       // for activity log
  status_code: number;
  message: string;
  upgrade_request_id?: string | null;
  user_id?: string | null;
  package_slug?: string | null;
  // when false AND retryable=true, the caller should enqueue this payload
  retryable?: boolean;
};

/**
 * Reconciles one Plisio payload against upgrade_requests.
 * Signature verification MUST happen before calling this.
 * Returns ok=false retryable=true on transient DB errors (so caller enqueues).
 */
export async function processPlisioPayload(
  payload: Record<string, any>,
): Promise<ProcessOutcome> {
  const txnId = String(payload.txn_id ?? "");
  const orderNumber = String(payload.order_number ?? "");
  const status = String(payload.status ?? "");

  try {
    const { data: req, error: reqErr } = await (supabaseAdmin as any)
      .from("upgrade_requests")
      .select("id,user_id,package_slug,status,plisio_status")
      .or(`plisio_invoice_id.eq.${txnId},transaction_ref.eq.${orderNumber}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqErr) {
      return {
        ok: false, retryable: true, status_code: 500,
        outcome: "db_error", message: `lookup failed: ${reqErr.message}`,
      };
    }

    if (!req) {
      await (supabaseAdmin as any).from("plisio_webhook_logs").insert({
        txn_id: txnId, order_number: orderNumber, status,
        signature_valid: true, payload, note: "No matching upgrade_request",
      });
      return {
        ok: true, retryable: false, status_code: 200,
        outcome: "not_found", message: "No matching upgrade_request",
      };
    }

    const terminal = req.status === "approved" || req.status === "rejected";
    if (terminal && req.plisio_status === status) {
      await (supabaseAdmin as any).from("plisio_webhook_logs").insert({
        upgrade_request_id: req.id, txn_id: txnId, order_number: orderNumber, status,
        signature_valid: true, payload, note: `Duplicate — already ${req.status}`,
      });
      return {
        ok: true, retryable: false, status_code: 200,
        outcome: "duplicate", upgrade_request_id: req.id, user_id: req.user_id,
        package_slug: req.package_slug,
        message: `Duplicate — already ${req.status}`,
      };
    }

    const { error: upErr } = await (supabaseAdmin as any).from("upgrade_requests")
      .update({ plisio_status: status, plisio_invoice_id: txnId })
      .eq("id", req.id);
    if (upErr) {
      return {
        ok: false, retryable: true, status_code: 500,
        outcome: "db_error", message: `update status failed: ${upErr.message}`,
        upgrade_request_id: req.id, user_id: req.user_id,
      };
    }

    let outcomeNote = `status=${status}`;
    let activityOutcome = "received";
    const success = status === "completed" || status === "mismatch";

    if (success && req.status !== "approved") {
      const { data: flipped, error: flipErr } = await (supabaseAdmin as any)
        .from("upgrade_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          note: `Auto-approved by Plisio (${status})`,
        })
        .eq("id", req.id)
        .neq("status", "approved")
        .select("id")
        .maybeSingle();

      if (flipErr) {
        return {
          ok: false, retryable: true, status_code: 500,
          outcome: "db_error", message: `approve failed: ${flipErr.message}`,
          upgrade_request_id: req.id, user_id: req.user_id,
        };
      }

      if (flipped) {
        const { error: planErr } = await (supabaseAdmin as any).from("profiles")
          .update({ plan_slug: req.package_slug })
          .eq("id", req.user_id);
        if (planErr) {
          return {
            ok: false, retryable: true, status_code: 500,
            outcome: "db_error", message: `plan update failed: ${planErr.message}`,
            upgrade_request_id: req.id, user_id: req.user_id,
          };
        }
        outcomeNote = `Approved & plan=${req.package_slug}`;
        activityOutcome = "approved";
      } else {
        outcomeNote = `Already approved (race)`;
        activityOutcome = "duplicate";
      }
    } else if ((status === "cancelled" || status === "error" || status === "expired") &&
               req.status === "pending") {
      await (supabaseAdmin as any).from("upgrade_requests")
        .update({ status: "rejected", note: `Plisio: ${status}` })
        .eq("id", req.id)
        .eq("status", "pending");
      outcomeNote = `Rejected: ${status}`;
      activityOutcome = "rejected";
    }

    await (supabaseAdmin as any).from("plisio_webhook_logs").insert({
      upgrade_request_id: req.id, txn_id: txnId, order_number: orderNumber, status,
      signature_valid: true, payload, note: outcomeNote,
    });

    return {
      ok: true, retryable: false, status_code: 200,
      outcome: activityOutcome, message: outcomeNote,
      upgrade_request_id: req.id, user_id: req.user_id,
      package_slug: req.package_slug,
    };
  } catch (e: any) {
    return {
      ok: false, retryable: true, status_code: 500,
      outcome: "exception", message: e?.message || "unknown error",
    };
  }
}

/**
 * Exponential backoff schedule (in seconds) per attempt index (0-based).
 * 0:2m  1:10m  2:30m  3:2h  4:6h  5:24h
 */
const BACKOFF_SECONDS = [120, 600, 1800, 7200, 21600, 86400];

export function nextBackoffSeconds(attempt: number): number {
  return BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)];
}

export async function enqueueRetry(args: {
  payload: Record<string, any>;
  txn_id?: string | null;
  order_number?: string | null;
  source?: string;
  last_error?: string | null;
}) {
  try {
    const nextAt = new Date(Date.now() + nextBackoffSeconds(0) * 1000).toISOString();
    await (supabaseAdmin as any).from("plisio_webhook_retry_queue").insert({
      payload: args.payload,
      txn_id: args.txn_id ?? null,
      order_number: args.order_number ?? null,
      source: args.source ?? "webhook",
      last_error: args.last_error ?? null,
      next_attempt_at: nextAt,
      status: "queued",
    });
  } catch (e) {
    console.error("[plisio-retry] enqueue failed", e);
  }
}
