import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

// ---------- FB ASN / IP blocklist ----------

export const listFbBlocklist = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("fb_asn_blocklist")
      .select("id,asn,ip_cidr,label,is_active,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

const blocklistInput = z.object({
  asn: z.number().int().positive().max(4294967295).nullable().optional(),
  ip_cidr: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/).nullable().optional(),
  label: z.string().min(1).max(200),
}).refine((v) => v.asn != null || (v.ip_cidr && v.ip_cidr.length > 0), {
  message: "Either ASN or CIDR is required",
});

export const addFbBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => blocklistInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("fb_asn_blocklist").insert({
      asn: data.asn ?? null,
      ip_cidr: data.ip_cidr || null,
      label: data.label,
      added_by: context.userId,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleFbBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("fb_asn_blocklist")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFbBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("fb_asn_blocklist")
      .delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Referer rules ----------

export const listRefererRules = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("referer_rules")
      .select("id,host_pattern,action,priority,is_active,note,created_at")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

const refererInput = z.object({
  host_pattern: z.string().min(1).max(200).regex(/^[a-zA-Z0-9.\-_*]+$/),
  action: z.enum(["safe", "cloak", "pass"]),
  priority: z.number().int().min(0).max(10000).default(100),
  note: z.string().max(500).optional().nullable(),
});

export const addRefererRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => refererInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("referer_rules").insert({
      host_pattern: data.host_pattern,
      action: data.action,
      priority: data.priority,
      note: data.note ?? null,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleRefererRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("referer_rules")
      .update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRefererRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("referer_rules")
      .delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
