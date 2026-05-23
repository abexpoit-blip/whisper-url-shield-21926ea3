import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";

const linkIdSchema = z.object({ linkId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOwner(supabase: any, linkId: string, userId: string) {
  const { data, error } = await supabase
    .from("links")
    .select("id,user_id,duplicate_protection,duplicate_window_minutes,short_code,title")
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Not found or access denied");
  return data;
}

// ---------- Read combined targeting state ----------

export const getTargetingState = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => linkIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const link = await assertOwner(supabase, data.linkId, userId);

    const [geoRes, devRes] = await Promise.all([
      supabase.from("link_geo_rules")
        .select("id,country_code,adsterra_url,priority,is_active")
        .eq("link_id", data.linkId)
        .order("priority", { ascending: true }),
      supabase.from("link_device_rules")
        .select("id,device,os,adsterra_url,priority,is_active")
        .eq("link_id", data.linkId)
        .order("priority", { ascending: true }),
    ]);

    return {
      link: {
        id: link.id,
        short_code: link.short_code,
        title: link.title,
        duplicate_protection: link.duplicate_protection,
        duplicate_window_minutes: link.duplicate_window_minutes,
      },
      geoRules: geoRes.data ?? [],
      deviceRules: devRes.data ?? [],
    };
  });

// ---------- Geo rules ----------

const geoInput = z.object({
  linkId: z.string().uuid(),
  country_code: z.string().length(2).regex(/^[A-Za-z]{2}$/),
  adsterra_url: z.string().url().max(2000),
  priority: z.number().int().min(0).max(10000).default(100),
});

export const upsertGeoRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => geoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.linkId, userId);
    const { error } = await supabase.from("link_geo_rules")
      .upsert({
        link_id: data.linkId,
        country_code: data.country_code.toUpperCase(),
        adsterra_url: data.adsterra_url,
        priority: data.priority,
        is_active: true,
      }, { onConflict: "link_id,country_code" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGeoRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ linkId: z.string().uuid(), ruleId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.linkId, userId);
    const { error } = await supabase.from("link_geo_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("link_id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Device rules ----------

const deviceInput = z.object({
  linkId: z.string().uuid(),
  device: z.enum(["mobile", "tablet", "desktop", "any"]),
  os: z.string().min(1).max(40).default("any"),
  adsterra_url: z.string().url().max(2000),
  priority: z.number().int().min(0).max(10000).default(100),
});

export const upsertDeviceRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) => deviceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.linkId, userId);
    const { error } = await supabase.from("link_device_rules")
      .upsert({
        link_id: data.linkId,
        device: data.device,
        os: data.os,
        adsterra_url: data.adsterra_url,
        priority: data.priority,
        is_active: true,
      }, { onConflict: "link_id,device,os" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeviceRule = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({ linkId: z.string().uuid(), ruleId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.linkId, userId);
    const { error } = await supabase.from("link_device_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("link_id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Duplicate-click toggle ----------

export const setDuplicateProtection = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z.object({
      linkId: z.string().uuid(),
      enabled: z.boolean(),
      window_minutes: z.number().int().min(1).max(1440),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.linkId, userId);
    const { error } = await supabase.from("links")
      .update({
        duplicate_protection: data.enabled,
        duplicate_window_minutes: data.window_minutes,
      })
      .eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
