import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderPrelanding, type PrelandingTemplate } from "@/lib/prelanding-templates";
import { issueChallengeToken } from "@/lib/click-challenge.server";

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
  prelanding_template: PrelandingTemplate | "none";
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

export async function recordRedirectClick(input: {
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
  prelandingShown: boolean;
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

  if (!rpcError) {
    // RPC succeeded — counter updates handled inside RPC.
    return;
  }

  // Fallback: insert click row directly, try multiple schema variants.
  const baseRow = {
    link_id: input.linkId,
    ip: input.ip,
    country: input.country,
    ua: input.ua,
    is_bot: input.isBot,
    bot_reason: input.botReason,
    routed_to: input.routedTo,
    challenge_passed: input.challengePassed,
    prelanding_shown: input.prelandingShown,
  };
  const clickRows = [
    baseRow,
    { link_id: input.linkId, ip: input.ip, country: input.country, ua: input.ua,
      is_bot: input.isBot, bot_reason: input.botReason, routed_to: input.routedTo },
  ];
  let inserted = false;
  let lastInsertError: string | null = null;
  for (const row of clickRows) {
    const { error } = await supabaseAdmin.from("clicks").insert(row as never);
    if (!error) { inserted = true; break; }
    lastInsertError = error.message;
  }
  if (!inserted) {
    console.error("redirect click insert failed", { linkId: input.linkId, message: lastInsertError });
  }

  const { data: cur } = await supabaseAdmin
    .from("links").select("clicks_count, bot_clicks_count")
    .eq("id", input.linkId).maybeSingle();
  if (!cur) return;

  if (input.isBot) {
    await supabaseAdmin.from("links")
      .update({ bot_clicks_count: (cur.bot_clicks_count || 0) + 1 })
      .eq("id", input.linkId);
    return;
  }
  await supabaseAdmin.from("links")
    .update({ clicks_count: (cur.clicks_count || 0) + 1 })
    .eq("id", input.linkId);
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("clicks_used").eq("id", input.userId).maybeSingle();
  if (profile) {
    await supabaseAdmin.from("profiles")
      .update({ clicks_used: (profile.clicks_used || 0) + 1 })
      .eq("id", input.userId);
  }
}

export async function lookupRedirectLink(code: string): Promise<{ link: RedirectLink | null; error: Error | null }> {
  const res = await supabaseAdmin.from("links").select("*").eq("short_code", code).maybeSingle();
  if (res.error) return { link: null, error: res.error as unknown as Error };
  const row = res.data as Record<string, unknown> | null;
  if (!row) return { link: null, error: null };

  const adsterraDirect = (row.adsterra_direct_link as string | null) ?? null;
  const destination = (row.destination_url as string | null) ?? null;
  const adsterra =
    (row.adsterra_url as string | null) ?? adsterraDirect ?? destination ?? null;
  const safe =
    (row.safe_url as string | null) ?? (adsterraDirect ? destination : null) ?? SAFE_FALLBACK;
  const isActive =
    typeof row.is_active === "boolean" ? (row.is_active as boolean) : row.status === "active";
  const tpl = (row.prelanding_template as string) || "verify";
  const allowedTpls = new Set([
    "none", "verify", "reward", "countdown", "article",
    "article_health", "article_news", "article_finance", "article_lifestyle",
  ]);
  const validTpl: RedirectLink["prelanding_template"] = allowedTpls.has(tpl)
    ? (tpl as RedirectLink["prelanding_template"])
    : "verify";

  return {
    error: null,
    link: {
      id: row.id as string,
      user_id: row.user_id as string,
      clicks_count: (row.clicks_count as number | null) ?? 0,
      adsterra_url: adsterra,
      safe_url: safe || SAFE_FALLBACK,
      is_active: isActive,
      prelanding_template: validTpl,
    },
  };
}

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      HEAD: async ({ request, params }) => handleRedirect(request, params.code, false),
      GET: async ({ request, params }) => handleRedirect(request, params.code),
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
    request.headers.get("x-real-ip") || "";

  const [{ link, error: linkError }, { data: settings, error: settingsError }] =
    await Promise.all([
      lookupRedirectLink(code),
      supabaseAdmin.from("app_settings")
        .select("our_adsterra_url, injection_threshold, injection_count")
        .eq("id", true).maybeSingle(),
    ]);

  if (linkError) console.error("redirect link lookup failed", { code, message: linkError.message });
  if (settingsError) console.error("redirect settings lookup failed", { message: settingsError.message });

  if (!link || !link.is_active) {
    return redirectTo(SAFE_FALLBACK, "fallback", !link ? "link-not-found" : "link-inactive");
  }

  const OUR_URL = settings?.our_adsterra_url || SAFE_FALLBACK;
  const THRESHOLD = settings?.injection_threshold ?? 5000;
  const INJECT_COUNT = settings?.injection_count ?? 50;

  let isBot = false;
  let isFbBot = false;
  let reason: string | null = null;
  const uaLow = ua.toLowerCase();

  // Facebook / Meta crawlers — handled specially: served real article HTML (200 OK)
  const FB_BOT_PATTERNS = ["facebookexternalhit", "facebot", "meta-externalagent", "meta-externalfetcher"];
  for (const p of FB_BOT_PATTERNS) {
    if (uaLow.includes(p)) { isBot = true; isFbBot = true; reason = `ua:${p}`; break; }
  }

  if (!ua || ua.length < 10) { isBot = true; reason = "empty/short UA"; }

  if (!isBot) {
    const hardcoded = [
      "bytespider","googlebot","adsbot-google","bingbot","yandexbot","ahrefs","semrushbot",
      "mj12bot","dotbot","petalbot","applebot","curl","wget","python-requests","httpclient",
      "okhttp","headlesschrome","phantomjs","selenium","puppeteer","playwright","lighthouse",
      "pingdom","uptimerobot",
    ];
    for (const p of hardcoded) {
      if (uaLow.includes(p)) { isBot = true; reason = `ua:${p}`; break; }
    }
  }

  if (!isBot) {
    const { data: rules } = await supabaseAdmin
      .from("bot_rules").select("pattern, label, rule_type").eq("is_active", true);
    if (rules) {
      for (const r of rules) {
        const p = (r.pattern || "").toLowerCase();
        if (!p) continue;
        if (r.rule_type === "ua" && uaLow.includes(p)) { isBot = true; reason = `rule:${r.label || p}`; break; }
        if (r.rule_type === "asn" && asn && asn === p) { isBot = true; reason = `asn:${r.label || p}`; break; }
        if (r.rule_type === "ip" && ip && ip.startsWith(p)) { isBot = true; reason = `ip:${r.label || p}`; break; }
      }
    }
  }

  if (!isBot && asn && BOT_ASNS.has(asn)) { isBot = true; reason = `asn:${asn}`; }

  const device = detectDevice(ua);
  const refererDomain = (() => {
    try { return referer ? new URL(referer).hostname : ""; } catch { return ""; }
  })();
  const utm = {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_term: url.searchParams.get("utm_term"),
    utm_content: url.searchParams.get("utm_content"),
  };

  // Determine offer target (only for non-bot path)
  let target: string;
  let routedTo: "safe" | "offer" | "ours" = "offer";

  if (isBot) {
    target = link.safe_url || SAFE_FALLBACK;
    routedTo = "safe";
  } else {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("click_quota, clicks_used").eq("id", link.user_id).maybeSingle();
    if (profileError) console.error("redirect profile lookup failed", { userId: link.user_id, message: profileError.message });

    const overQuota =
      profile && profile.click_quota !== null && (profile.clicks_used || 0) >= profile.click_quota;

    if (overQuota) {
      target = OUR_URL; routedTo = "ours";
    } else {
      const cycleLen = THRESHOLD + INJECT_COUNT;
      const pos = (link.clicks_count || 0) % cycleLen;
      if (pos >= THRESHOLD) { target = OUR_URL; routedTo = "ours"; }
      else { target = link.adsterra_url || SAFE_FALLBACK; routedTo = "offer"; }
    }
  }

  // Facebook crawler → serve real article HTML (200 OK) so Meta's ad review
  // sees a legit article with OG tags and approves the ad.
  // We DO NOT redirect FB bots (avoids Adsterra exposure to Meta).
  if (isFbBot && link.prelanding_template !== "none") {
    if (shouldRecordClick) {
      recordRedirectClick({
        linkId: link.id, userId: link.user_id,
        ip: ip || null, country: country || null, ua: ua || null,
        isBot: true, botReason: reason, routedTo: "safe", utm,
        refererHost: refererDomain || null,
        botScore: 100, challengePassed: false, prelandingShown: true,
        signals: { source: "fb_bot_article", reasons: reason ? [reason] : [], device, referer_host: refererDomain || null },
      }).catch((error) => console.error("fb-bot click logging failed", { linkId: link.id, error }));
    }
    const tpl = link.prelanding_template === "verify" || link.prelanding_template === "reward" || link.prelanding_template === "countdown"
      ? "article_health" : link.prelanding_template;
    const html = renderPrelanding(tpl, code, "", "fbbot");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Sleepox-Route": "fb-article",
        "X-Sleepox-Template": tpl,
      },
    });
  }

  // Other bots or template='none' → direct redirect path
  if (isBot || link.prelanding_template === "none") {
    if (shouldRecordClick) {
      recordRedirectClick({
        linkId: link.id, userId: link.user_id,
        ip: ip || null, country: country || null, ua: ua || null,
        isBot, botReason: reason, routedTo, utm,
        refererHost: refererDomain || null,
        botScore: isBot ? 100 : 0,
        challengePassed: !isBot,
        prelandingShown: false,
        signals: { source: isBot ? "blocked" : "direct", reasons: reason ? [reason] : [], device, referer_host: refererDomain || null },
      }).catch((error) => console.error("redirect click logging failed", { linkId: link.id, error }));
    }
    const r = isBot ? reason : routedTo === "ours" ? "quota-or-injection" : "ok";
    return redirectTo(target, routedTo, r);
  }

  // Human-suspect path: serve prelanding HTML with signed token.
  if (!shouldRecordClick) {
    // HEAD: just respond OK without serving body.
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const token = await issueChallengeToken({
    linkId: link.id,
    target: sanitizeRedirectTarget(target),
    routedTo,
    issuedAt: Date.now(),
  });
  const html = renderPrelanding(link.prelanding_template, code, token, "human");
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Sleepox-Route": "prelanding",
      "X-Sleepox-Template": link.prelanding_template,
    },
  });
}
