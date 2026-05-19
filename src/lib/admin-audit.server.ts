import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditStatus = "success" | "denied" | "error";

export interface AuditEntry {
  userId: string | null;
  userEmail?: string | null;
  action: string;
  resource?: string | null;
  status: AuditStatus;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const WRITE_SUCCESS_AUDIT_ACTIONS = [
  ".create",
  ".add",
  ".insert",
  ".update",
  ".save",
  ".delete",
  ".remove",
  ".toggle",
  ".role.",
  ".plan.",
  ".quota.",
  ".password.",
  ".impersonate",
  ".promote",
  ".reset",
  ".upsert",
];

function shouldWriteSuccessAudit(action: string) {
  return WRITE_SUCCESS_AUDIT_ACTIONS.some((token) => action.includes(token));
}

// Fire-and-forget audit log writer. Never throws — auditing must never break
// the admin action itself.
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      user_id: entry.userId,
      user_email: entry.userEmail ?? null,
      action: entry.action,
      resource: entry.resource ?? null,
      status: entry.status,
      reason: entry.reason ?? null,
      metadata: (entry.metadata ?? {}) as never,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin-audit] failed to write log", e);
  }
}

// Wraps an admin gate: verifies role and writes an audit entry for the
// outcome (denied / success / error). Throws on denial so callers can rely on
// the existing control flow.
export async function auditAdminGate(opts: {
  userId: string;
  userEmail?: string | null;
  action: string;
  resource?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: opts.userId,
    _role: "admin",
  });

  if (error) {
    await writeAuditLog({
      userId: opts.userId,
      userEmail: opts.userEmail,
      action: opts.action,
      resource: opts.resource,
      status: "error",
      reason: error.message,
      metadata: opts.metadata,
    });
    throw new Error(error.message);
  }

  if (!data) {
    await writeAuditLog({
      userId: opts.userId,
      userEmail: opts.userEmail,
      action: opts.action,
      resource: opts.resource,
      status: "denied",
      reason: "Forbidden: admin role required",
      metadata: opts.metadata,
    });
    throw new Error("Forbidden: admin role required");
  }

  if (shouldWriteSuccessAudit(opts.action)) {
    await writeAuditLog({
      userId: opts.userId,
      userEmail: opts.userEmail,
      action: opts.action,
      resource: opts.resource,
      status: "success",
      metadata: opts.metadata,
    });
  }
}
