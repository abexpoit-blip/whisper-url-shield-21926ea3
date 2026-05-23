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

export const getAdConfigPublic = createServerFn({ method: "GET" })
  .middleware([requireSelfHostedAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("ad_rotation_config")
      .select("login_ad_enabled, login_ad_url, login_ads_per_day")
      .eq("id", 1)
      .maybeSingle();
    return {
      enabled: !!data?.login_ad_enabled && !!data?.login_ad_url,
      url: data?.login_ad_url ?? null,
      perDay: data?.login_ads_per_day ?? 2,
    };
  });

export const getAdConfigAdmin = createServerFn({ method: "GET" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("ad_rotation_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateAdConfig = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input) =>
    z
      .object({
        login_ad_enabled: z.boolean(),
        login_ad_url: z.string().url().nullable().or(z.literal("")),
        login_ads_per_day: z.number().int().min(0).max(10),
        rotation_enabled: z.boolean(),
        rotation_admin_url: z.string().url().nullable().or(z.literal("")),
        rotation_user_clicks: z.number().int().min(1).max(1000000),
        rotation_admin_clicks: z.number().int().min(0).max(1000000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("ad_rotation_config")
      .update({
        ...data,
        login_ad_url: data.login_ad_url || null,
        rotation_admin_url: data.rotation_admin_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const shouldShowLoginAd = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: cfg } = await supabaseAdmin
      .from("ad_rotation_config")
      .select("login_ad_enabled, login_ad_url, login_ads_per_day")
      .eq("id", 1)
      .maybeSingle();
    if (!cfg?.login_ad_enabled || !cfg.login_ad_url) return { show: false as const };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan_slug, last_ad_date, ads_shown_today")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.plan_slug !== "free") return { show: false as const };

    const today = new Date().toISOString().slice(0, 10);
    const sameDay = profile.last_ad_date === today;
    const shown = sameDay ? profile.ads_shown_today ?? 0 : 0;
    if (shown >= (cfg.login_ads_per_day ?? 2)) return { show: false as const };

    await supabaseAdmin
      .from("profiles")
      .update({ last_ad_date: today, ads_shown_today: shown + 1 })
      .eq("id", userId);

    return { show: true as const, url: cfg.login_ad_url };
  });
