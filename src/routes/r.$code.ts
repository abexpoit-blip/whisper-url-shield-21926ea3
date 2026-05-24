import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SAFE_FALLBACK = "https://sleepox.com/";

// Facebook / Google / known crawler ASNs
const BOT_ASNS = new Set(["32934", "15169", "8075", "13335", "16509", "14618", "396982"]);

type RedirectLink = {
  id: string;
  user_id: string;
  clicks_count: number | null;
  adsterra_url: string | null;
  safe_url: string | null;
  is_active: boolean;
};

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return "tablet";
  if (/mobile|iphone|android|phone|webos|opera mini/.test(u)) return "mobile";
  return "desktop";
}

function sanitizeRedirectTarget(target: string | null | undefined): string {
  try {
    if (!target) return SAFE_FALLBACK;
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return SAFE_FALLBACK;
    return parsed.toString();
  } catch {
    return SAFE_FALLBACK;
  }
}

function redirectTo(
  target: string | null | undefined,
  route: "safe" | "offer" | "ours" | "fallback",
  reason?: string | null,
) {
  const headers = new Headers({
    Location: sanitizeRedirectTarget(target),
    "Cache-Control": "no-store",
    "X-Sleepox-Route": route,
  });
  if (reason)
    headers.set("X-Sleepox-Reason", reason.replace(/[^a-zA-Z0-9:._ -]/g, "").slice(0, 80));
  return new Response(null, { status: 302, headers });
}

async function recordRedirectClick(input: {
  linkId: string;
  userId: string;
  ip: string | null;
  country: string | null;
  ua: string | null;
  isBot: boolean;
  botReason: string | null;
  routedTo: "safe" | "offer" | "ours";
  utm: Record<
    "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content",
    string | null
  >;
  refererHost: string | null;
  botScore: number;
  signals: Record<string, unknown>;
  challengePassed: boolean;
}) {
  const { error: rpcError } = await supabaseAdmin.rpc(
    "record_redirect_click" as never,
    {
      _link_id: input.linkId,
      _user_id: input.userId,
      _ip: input.ip,
      _country: input.country,
      _ua: input.ua,
      _is_bot: input.isBot,
      _bot_reason: input.botReason,
      _routed_to: input.routedTo,
      _utm_source: input.utm.utm_source,
      _utm_medium: input.utm.utm_medium,
      _utm_campaign: input.utm.utm_campaign,
      _utm_term: input.utm.utm_term,
      _utm_content: input.utm.utm_content,
      _referer_host: input.refererHost,
      _bot_score: input.botScore,
      _signals: input.signals,
      _challenge_passed: input.challengePassed,
    } as never,
  );

  if (!rpcError) return;

  const clickRows = [
    {
      link_id: input.linkId,
      ip: input.ip,
      country: input.country,
      ua: input.ua,
      is_bot: input.isBot,
      bot_reason: input.botReason,
      routed_to: input.routedTo,
      utm_source: input.utm.utm_source,
      utm_medium: input.utm.utm_medium,
      utm_campaign: input.utm.utm_campaign,
      utm_term: input.utm.utm_term,
      utm_content: input.utm.utm_content,
      referer_host: input.refererHost,
      bot_score: input.botScore,
      signals: input.signals,
      challenge_passed: input.challengePassed,
    },
    {
      link_id: input.linkId,
      ip_address: input.ip,
      country: input.country,
      user_agent: input.ua,
      is_bot: input.isBot,
      bot_reason: input.botReason,
      variant: input.routedTo,
      utm_source: input.utm.utm_source,
      utm_medium: input.utm.utm_medium,
      utm_campaign: input.utm.utm_campaign,
      utm_term: input.utm.utm_term,
      utm_content: input.utm.utm_content,
      referer_host: input.refererHost,
      bot_score: input.botScore,
      signals: input.signals,
      challenge_passed: input.challengePassed,
    },
    {
      link_id: input.linkId,
      ip: input.ip,
      country: input.country,
      ua: input.ua,
      is_bot: input.isBot,
      bot_reason: input.botReason,
      routed_to: input.routedTo,
    },
    {
      link_id: input.linkId,
      ip_address: input.ip,
      country: input.country,
      user_agent: input.ua,
      is_bot: input.isBot,
      bot_reason: input.botReason,
      variant: input.routedTo,
    },
  ];

  let inserted = false;
  let lastInsertError: string | null = null;
  for (const row of clickRows) {
    const { error } = await supabaseAdmin.from("clicks").insert(row as never);
    if (!error) {
      inserted = true;
      break;
    }
    lastInsertError = error.message;
  }

  if (!inserted) {
    console.error("redirect click insert failed", { linkId: input.linkId, message: lastInsertError });
  }

  const { data: cur } = await supabaseAdmin
    .from("links")
    .select("clicks_count, bot_clicks_count")
    .eq("id", input.linkId)
    .single();
  if (!cur) return;

  if (input.isBot) {
    await supabaseAdmin
      .from("links")
      .update({ bot_clicks_count: (cur.bot_clicks_count || 0) + 1 })
      .eq("id", input.linkId);
    return;
  }

  await supabaseAdmin
    .from("links")
    .update({ clicks_count: (cur.clicks_count || 0) + 1 })
    .eq("id", input.linkId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("clicks_used")
    .eq("id", input.userId)
    .single();
  if (profile) {
    await supabaseAdmin
      .from("profiles")
      .update({ clicks_used: (profile.clicks_used || 0) + 1 })
      .eq("id", input.userId);
  }
}

async function lookupRedirectLink(code: string): Promise<{ link: RedirectLink | null; error: Error | null }> {
  const legacy = await supabaseAdmin
    .from("links")
    .select("id, destination_url, adsterra_direct_link, status, user_id, clicks_count")
    .eq("short_code", code)
    .maybeSingle();

  if (legacy.error) {
    const modern = await supabaseAdmin
      .from("links")
      .select("id, adsterra_url, safe_url, is_active, user_id, clicks_count")
      .eq("short_code", code)
      .maybeSingle();
    return modern.error
      ? { link: null, error: legacy.error }
      : { link: modern.data as RedirectLink | null, error: null };
  }

  const row = legacy.data as {
    id: string;
    destination_url: string | null;
    adsterra_direct_link: string | null;
    status: string | null;
    user_id: string;
    clicks_count: number | null;
  } | null;

  return {
    error: null,
    link: row
      ? {
          id: row.id,
          user_id: row.user_id,
          clicks_count: row.clicks_count,
          adsterra_url: row.adsterra_direct_link || row.destination_url,
          safe_url: row.adsterra_direct_link ? row.destination_url || SAFE_FALLBACK : SAFE_FALLBACK,
          is_active: row.status === "active",
        }
      : null,
  };
}

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      HEAD: async ({ request, params }) => handleRedirect(request, params.code, false),
      GET: async ({ request, params }) => {
        return handleRedirect(request, params.code);
      },
    },
  },
});

async function handleRedirect(request: Request, code: string, shouldRecordClick = true) {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || "";
  const country =
    request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || "";
  const asn = request.headers.get("cf-asn") || "";
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // 1) Lookup link + app settings in parallel
  const [{ link, error: linkError }, { data: settings, error: settingsError }] =
    await Promise.all([
      lookupRedirectLink(code),
      supabaseAdmin
        .from("app_settings")
        .select("our_adsterra_url, injection_threshold, injection_count")
        .eq("id", true)
        .maybeSingle(),
    ]);

  if (linkError) console.error("redirect link lookup failed", { code, message: linkError.message });
  if (settingsError)
    console.error("redirect settings lookup failed", { message: settingsError.message });

  if (!link || !link.is_active) {
    return redirectTo(SAFE_FALLBACK, "fallback", !link ? "link-not-found" : "link-inactive");
  }

  const OUR_URL = settings?.our_adsterra_url || SAFE_FALLBACK;
  const THRESHOLD = settings?.injection_threshold ?? 5000;
  const INJECT_COUNT = settings?.injection_count ?? 50;

  // 2) Multi-layer bot check
  let isBot = false;
  let reason: string | null = null;
  const uaLow = ua.toLowerCase();

  // Layer A: empty UA
  if (!ua || ua.length < 10) {
    isBot = true;
    reason = "empty/short UA";
  }

  // Layer B: UA pattern (DB rules + hardcoded fallbacks)
  if (!isBot) {
    const hardcoded = [
      "facebookexternalhit",
      "facebot",
      "meta-externalagent",
      "bytespider",
      "googlebot",
      "adsbot-google",
      "bingbot",
      "yandexbot",
      "ahrefs",
      "semrushbot",
      "mj12bot",
      "dotbot",
      "petalbot",
      "applebot",
      "curl",
      "wget",
      "python-requests",
      "httpclient",
      "okhttp",
      "headlesschrome",
      "phantomjs",
      "selenium",
      "puppeteer",
      "playwright",
      "lighthouse",
      "pingdom",
      "uptimerobot",
    ];
    for (const p of hardcoded) {
      if (uaLow.includes(p)) {
        isBot = true;
        reason = `ua:${p}`;
        break;
      }
    }
  }

  if (!isBot) {
    const { data: rules } = await supabaseAdmin
      .from("bot_rules")
      .select("pattern, label, rule_type")
      .eq("is_active", true);
    if (rules) {
      for (const r of rules) {
        const p = (r.pattern || "").toLowerCase();
        if (!p) continue;
        if (r.rule_type === "ua" && uaLow.includes(p)) {
          isBot = true;
          reason = `rule:${r.label || p}`;
          break;
        }
        if (r.rule_type === "asn" && asn && asn === p) {
          isBot = true;
          reason = `asn:${r.label || p}`;
          break;
        }
        if (r.rule_type === "ip" && ip && ip.startsWith(p)) {
          isBot = true;
          reason = `ip:${r.label || p}`;
          break;
        }
      }
    }
  }

  // Layer C: bot ASN
  if (!isBot && asn && BOT_ASNS.has(asn)) {
    isBot = true;
    reason = `asn:${asn}`;
  }

  const device = detectDevice(ua);
  const refererDomain = (() => {
    try {
      return referer ? new URL(referer).hostname : "";
    } catch {
      return "";
    }
  })();
  const utm = {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_term: url.searchParams.get("utm_term"),
    utm_content: url.searchParams.get("utm_content"),
  };

  // Determine target: bot → safe; human → check quota + injection rotation
  let target: string;
  let routedTo: "safe" | "offer" | "ours" = "offer";

  if (isBot) {
    target = link.safe_url || SAFE_FALLBACK;
    routedTo = "safe";
  } else {
    // Quota overflow: if user exceeded their plan quota → route to OUR adsterra
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("click_quota, clicks_used")
      .eq("id", link.user_id)
      .maybeSingle();
    if (profileError) console.error("redirect profile lookup failed", { userId: link.user_id, message: profileError.message });

    const overQuota =
      profile && profile.click_quota !== null && (profile.clicks_used || 0) >= profile.click_quota;

    if (overQuota) {
      target = OUR_URL;
      routedTo = "ours";
    } else {
      // 5K injection rotation: every (THRESHOLD + INJECT_COUNT) clicks,
      // last INJECT_COUNT go to our adsterra link, then back to user's link
      const cycleLen = THRESHOLD + INJECT_COUNT;
      const pos = (link.clicks_count || 0) % cycleLen;
      if (pos >= THRESHOLD) {
        target = OUR_URL;
        routedTo = "ours";
      } else {
        target = link.adsterra_url || SAFE_FALLBACK;
        routedTo = "offer";
      }
    }
  }

  const botScore = isBot ? 100 : 0;
  if (shouldRecordClick) {
    await recordRedirectClick({
      linkId: link.id,
      userId: link.user_id,
      ip: ip || null,
      country: country || null,
      ua: ua || null,
      isBot,
      botReason: reason,
      routedTo,
      utm,
      refererHost: refererDomain || null,
      botScore,
      challengePassed: !isBot,
      signals: {
        source: isBot ? "blocked" : "direct",
        reasons: reason ? [reason] : [],
        device,
        referer_host: refererDomain || null,
      },
    }).catch((error) => console.error("redirect click logging failed", { linkId: link.id, error }));
  }

  const redirectReason = isBot ? reason : routedTo === "ours" ? "quota-or-injection" : "ok";
  return redirectTo(target, routedTo, redirectReason);
}
