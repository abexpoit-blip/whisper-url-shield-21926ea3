import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditAdminGate, writeAuditLog } from "./admin-audit.server";

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().max(255).optional().default(""),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({ userId: context.userId, action: "users.list" });

    let q = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, plan_slug, link_quota, links_used, is_banned, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`email.ilike.${s},full_name.ilike.${s}`);
    }

    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    let rolesByUser = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      if (rolesErr) throw new Error(rolesErr.message);
      for (const r of roles ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      }
    }

    return {
      members: (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "user"]),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({
      userId: context.userId,
      action: `users.role.${data.action}`,
      metadata: { targetUserId: data.userId, role: data.role },
    });

    // Safety: prevent revoking your own admin role (lockout protection)
    if (
      data.action === "revoke" &&
      data.role === "admin" &&
      data.userId === context.userId
    ) {
      await writeAuditLog({
        userId: context.userId,
        action: `users.role.revoke`,
        status: "denied",
        reason: "Cannot revoke your own admin role",
        metadata: { targetUserId: data.userId },
      });
      throw new Error("You cannot revoke your own admin role.");
    }

    if (data.action === "grant") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.userId, role: data.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
