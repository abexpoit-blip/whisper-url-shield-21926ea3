import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SAFE_FALLBACK = "https://sleepox.com/";

export const resolveRedirect = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({
      code: z.string().min(1).max(64),
      ua: z.string().max(2000).default(""),
      ip: z.string().max(64).default(""),
      referer: z.string().max(2000).default(""),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    // 1) Lookup link
    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, adsterra_url, safe_url, is_active")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || !link.is_active) {
      return { url: SAFE_FALLBACK, routed: "safe" as const };
    }

    // 2) Bot check via bot_rules (UA patterns)
    const ua = data.ua.toLowerCase();
    let isBot = false;
    let reason: string | null = null;

    const { data: rules } = await supabaseAdmin
      .from("bot_rules")
      .select("pattern, label, rule_type")
      .eq("rule_type", "ua")
      .eq("is_active", true);

    if (rules) {
      for (const r of rules) {
        if (ua.includes(r.pattern.toLowerCase())) {
          isBot = true;
          reason = r.label ?? r.pattern;
          break;
        }
      }
    }

    if (!ua) {
      isBot = true;
      reason = reason ?? "empty UA";
    }

    const target = isBot ? (link.safe_url || SAFE_FALLBACK) : link.adsterra_url;
    const routed = isBot ? "safe" : "offer";

    // 3) Log click (fire & forget — don't block the redirect)
    void supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip: data.ip || null,
      ua: data.ua || null,
      is_bot: isBot,
      bot_reason: reason,
      routed_to: routed,
    });

    // 4) Update counters (fire & forget)
    if (isBot) {
      void supabaseAdmin.from("links").update({ bot_clicks_count: (await supabaseAdmin.from("links").select("bot_clicks_count").eq("id", link.id).single()).data?.bot_clicks_count ?? 0 + 1 }).eq("id", link.id);
    } else {
      void supabaseAdmin.from("links").update({ clicks_count: (await supabaseAdmin.from("links").select("clicks_count").eq("id", link.id).single()).data?.clicks_count ?? 0 + 1 }).eq("id", link.id);
    }

    return { url: target, routed };
  });
