import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertLinkOwner(supabase: any, userId: string, linkId: string) {
  const { data } = await supabase
    .from("links")
    .select("id")
    .eq("id", linkId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Link not found or not owned");
}

export const listTimeRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertLinkOwner(supabase, context.userId, data.linkId);
    const { data: rows, error } = await supabase
      .from("link_time_rules")
      .select("id,days_mask,start_minute,end_minute,action,timezone,priority,is_active,note,created_at")
      .eq("link_id", data.linkId)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const addInput = z.object({
  linkId: z.string().uuid(),
  days_mask: z.number().int().min(1).max(127),
  start_minute: z.number().int().min(0).max(1440),
  end_minute: z.number().int().min(0).max(1440),
  action: z.enum(["safe", "cloak", "pass"]),
  timezone: z.string().min(1).max(64).default("UTC"),
  priority: z.number().int().min(0).max(10000).default(100),
  note: z.string().max(200).optional(),
});

export const addTimeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertLinkOwner(supabase, context.userId, data.linkId);
    const { error } = await supabase.from("link_time_rules").insert({
      link_id: data.linkId,
      days_mask: data.days_mask,
      start_minute: data.start_minute,
      end_minute: data.end_minute,
      action: data.action,
      timezone: data.timezone,
      priority: data.priority,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTimeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("link_time_rules")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTimeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("link_time_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
