import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditAdminGate, writeAuditLog } from "./admin-audit.server";

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().max(255).optional().default(""),
        limit: z.number().int().min(1).max(500).default(200),
        includePackages: z.boolean().optional().default(false),
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

    const packagesPromise = data.includePackages
      ? supabaseAdmin
          .from("packages")
          .select("slug, name, link_limit, price_monthly")
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: null, error: null });

    const [{ data: profiles, error }, packagesRes] = await Promise.all([q, packagesPromise]);
    if (error) throw new Error(error.message);
    if (packagesRes.error) throw new Error(packagesRes.error.message);

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
      packages: packagesRes.data ?? undefined,
    };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
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

// List active packages (for admin UI plan picker)
export const listPackages = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await auditAdminGate({ userId: context.userId, action: "users.packages.list" });
    const { data, error } = await supabaseAdmin
      .from("packages")
      .select("slug, name, link_limit, price_monthly")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { packages: data ?? [] };
  });

// Update a member's plan (and optionally override quota)
export const updateMemberPlan = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      planSlug: z.string().min(1).max(64),
      linkQuota: z.number().int().min(0).max(1_000_000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({
      userId: context.userId,
      action: "users.plan.update",
      metadata: { targetUserId: data.userId, planSlug: data.planSlug, linkQuota: data.linkQuota },
    });
    const patch: { plan_slug: string; link_quota?: number } = { plan_slug: data.planSlug };
    if (typeof data.linkQuota === "number") patch.link_quota = data.linkQuota;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Top up (add) extra link quota to a member
export const topUpMemberQuota = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      addQuota: z.number().int().min(1).max(1_000_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({
      userId: context.userId,
      action: "users.quota.topup",
      metadata: { targetUserId: data.userId, addQuota: data.addQuota },
    });
    const { data: prof, error: e1 } = await supabaseAdmin
      .from("profiles").select("link_quota").eq("id", data.userId).single();
    if (e1) throw new Error(e1.message);
    const newQuota = (prof?.link_quota ?? 0) + data.addQuota;
    const { error } = await supabaseAdmin
      .from("profiles").update({ link_quota: newQuota }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, newQuota };
  });

// Change a member's password (admin reset)
export const changeMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      newPassword: z.string().min(8).max(72),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({
      userId: context.userId,
      action: "users.password.change",
      metadata: { targetUserId: data.userId },
    });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Generate a magic-link token so admin can impersonate (sign in as) a user.
// Returns { email, hashedToken } — client verifies via supabase.auth.verifyOtp.
export const impersonateMember = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await auditAdminGate({
      userId: context.userId,
      action: "users.impersonate",
      metadata: { targetUserId: data.userId },
    });
    const { data: prof, error: e1 } = await supabaseAdmin
      .from("profiles").select("email").eq("id", data.userId).single();
    if (e1) throw new Error(e1.message);
    if (!prof?.email) throw new Error("Target user has no email on file.");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: prof.email,
    });
    if (error) throw new Error(error.message);
    const hashedToken = link?.properties?.hashed_token;
    if (!hashedToken) throw new Error("Failed to generate impersonation token.");
    return { email: prof.email, hashedToken };
  });
