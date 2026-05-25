import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderPrelanding, type PrelandingTemplate } from "@/lib/prelanding-templates";
import {
  analyzeSignals,
  classifyReferrer,
  fingerprint,
  matchCloaking,
  matchReferrer,
  weightedPick,
  type CloakingRule,
  type ReferrerRule,
} from "@/lib/bot-detect";

const SAFE_FALLBACK = "https://sleepox.com/";
const BOT_BLOCK_THRESHOLD = 3;

// Facebook / Google / known crawler ASNs (fallback if cloaking_rules empty)
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

// ------- IP → Country lookup (workerd-compatible, no native deps) -------
// Cache by /24 subnet to drastically reduce upstream calls under high traffic.
// Uses https://api.country.is (free, no key, HTTPS, country-only).
const countryCache = new Map<string, { c: string; exp: number }>();
const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const COUNTRY_CACHE_MAX = 50_000;

function subnetKey(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":"); // IPv6 /64-ish
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
}

async function lookupCountryByIp(ip: string): Promise<string> {
  const key = subnetKey(ip);
  const now = Date.now();
  const hit = countryCache.get(key);
  if (hit && hit.exp > now) return hit.c;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const r = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json()) as { country?: string };
      const c = (j.country || "").toUpperCase();
      if (countryCache.size >= COUNTRY_CACHE_MAX) {
        const firstKey = countryCache.keys().next().value;
        if (firstKey) countryCache.delete(firstKey);
      }
      countryCache.set(key, { c, exp: now + COUNTRY_TTL_MS });
      return c;
    }
  } catch (e) {
    console.warn("[redirect] country lookup failed", (e as Error)?.message);
  }
  // Negative cache for 5 min to avoid hammering on bad IPs
  countryCache.set(key, { c: "", exp: now + 5 * 60 * 1000 });
  return "";
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
  fingerprintHash?: string | null;
  referrerSource?: string | null;
  countryTier?: number | null;
  abVariant?: string | null;
  ja3Hash?: string | null;
}) {
  // Verified columns on self-host clicks table (PostgREST probe):
  // link_id, ip, ua, country, city, device, browser, os, is_bot, bot_reason,
  // user_agent, referer, referer_host, bot_score, fingerprint_hash, signals,
  // challenge_passed, routed_to, variant, utm_*.
  // NO: ip_address, prelanding_shown, ja3_hash, ab_variant, country_tier, referrer_source.
  const row: Record<string, unknown> = {
    link_id: input.linkId,
    ip: input.ip,
    ua: input.ua,
    user_agent: input.ua,
    country: input.country,
    is_bot: input.isBot,
    bot_reason: input.botReason,
    routed_to: input.routedTo,
    challenge_passed: input.challengePassed,
    fingerprint_hash: input.fingerprintHash ?? null,
    referer_host: input.refererHost ?? null,
    bot_score: input.botScore ?? null,
    signals: input.signals ?? null,
    variant: input.abVariant ?? null,
    utm_source: input.utm?.utm_source ?? null,
    utm_medium: input.utm?.utm_medium ?? null,
    utm_campaign: input.utm?.utm_campaign ?? null,
    utm_term: input.utm?.utm_term ?? null,
    utm_content: input.utm?.utm_content ?? null,
  };
  const { error: insertErr } = await supabaseAdmin.from("clicks").insert(row as never);
  if (insertErr) {
    console.error("redirect click insert failed", {
      linkId: input.linkId,
      message: insertErr.message,
      code: (insertErr as { code?: string }).code,
      details: (insertErr as { details?: string }).details,
    });
  }

  // Update link counters
  const { data: cur } = await supabaseAdmin
    .from("links")
    .select("clicks_count, bot_clicks_count")
    .eq("id", input.linkId)
    .maybeSingle();
  if (cur) {
    if (input.isBot) {
      await supabaseAdmin
        .from("links")
        .update({ bot_clicks_count: (cur.bot_clicks_count || 0) + 1 })
        .eq("id", input.linkId);
    } else {
      await supabaseAdmin
        .from("links")
        .update({ clicks_count: (cur.clicks_count || 0) + 1 })
        .eq("id", input.linkId);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("clicks_used")
        .eq("id", input.userId)
        .maybeSingle();
      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({ clicks_used: (profile.clicks_used || 0) + 1 })
          .eq("id", input.userId);
      }
    }
  }

  // Bot fingerprint learning
  if (input.fingerprintHash) {
    await supabaseAdmin.rpc(
      "record_bot_fingerprint" as never,
      {
        _hash: input.fingerprintHash,
        _is_bot: input.isBot,
        _ip: input.ip,
        _ua: input.ua,
        _country: input.country,
        _block_threshold: BOT_BLOCK_THRESHOLD,
      } as never,
    );
  }

  // A/B variant click counter
  if (input.abVariant && !input.isBot) {
    const variantLabel = input.abVariant;
    try {
      const { data } = await supabaseAdmin
        .from("ab_variants")
        .select("clicks_count")
        .eq("link_id", input.linkId)
        .eq("variant_label", variantLabel)
        .maybeSingle();
      if (data) {
        await supabaseAdmin
          .from("ab_variants")
          .update({ clicks_count: (data.clicks_count || 0) + 1 })
          .eq("link_id", input.linkId)
          .eq("variant_label", variantLabel);
      }
    } catch (e) {
      console.error("ab variant click increment failed", e);
    }
  }
}

export async function lookupRedirectLink(
  code: string,
): Promise<{ link: RedirectLink | null; error: Error | null }> {
  const res = await supabaseAdmin.from("links").select("*").eq("short_code", code).maybeSingle();
  if (res.error) return { link: null, error: res.error as unknown as Error };
  const row = res.data as Record<string, unknown> | null;
  if (!row) return { link: null, error: null };

  const adsterraDirect = (row.adsterra_direct_link as string | null) ?? null;
  const destination = (row.destination_url as string | null) ?? null;
  const adsterra = (row.adsterra_url as string | null) ?? adsterraDirect ?? destination ?? null;
  const safe =
    (row.safe_url as string | null) ?? (adsterraDirect ? destination : null) ?? SAFE_FALLBACK;
  const isActive =
    typeof row.is_active === "boolean" ? (row.is_active as boolean) : row.status === "active";
  const tpl = (row.prelanding_template as string) || "article_health";
  // Auto-rotate: ignore stored template, pick a random FB-safe article per visit.
  const AUTO_TPLS = [
    "article_health",
    "article_news",
    "article_finance",
    "article_lifestyle",
    "article_tech",
    "article_celebrity",
    "article_business",
    "article_travel",
  ] as const;
  const validTpl: RedirectLink["prelanding_template"] = AUTO_TPLS[
    Math.floor(Math.random() * AUTO_TPLS.length)
  ] as RedirectLink["prelanding_template"];
  void tpl;

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
  const asn = request.headers.get("cf-asn") || "";
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // Country: prefer CDN headers, then IP geolocation, then Accept-Language hint
  let country =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  if (!country && ip && ip !== "127.0.0.1" && !ip.startsWith("::1")) {
    country = await lookupCountryByIp(ip);
  }
  if (!country && acceptLanguage) {
    // last-resort: en-BD,en;q=0.9 → BD
    const m = acceptLanguage.match(/[a-z]{2}-([A-Z]{2})/);
    if (m) country = m[1];
  }
  country = (country || "").toUpperCase();

  const accept = request.headers.get("accept") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const secChUa = request.headers.get("sec-ch-ua") || "";
  const ja3 = request.headers.get("cf-ja3") || request.headers.get("x-ja3-hash") || "";

  const detectInput = {
    ua,
    ip,
    asn,
    country,
    referer,
    acceptLanguage,
    accept,
    acceptEncoding,
    secChUa,
    ja3,
  };
  const fpHash = fingerprint(detectInput);
  const refererDomain = (() => {
    try {
      return referer ? new URL(referer).hostname : "";
    } catch {
      return "";
    }
  })();
  const referrerSource = classifyReferrer(refererDomain);

  // Parallel fetch: link, settings, cloaking rules, referrer rules, country tier, fp blacklist, recent-ad seen
  const [
    { link, error: linkError },
    { data: settings, error: settingsError },
    { data: cloakingRulesRaw },
    { data: referrerRulesRaw },
    { data: tierRow },
    { data: fpRow },
    { data: recentAdRow },
  ] = await Promise.all([
    lookupRedirectLink(code),
    supabaseAdmin
      .from("app_settings")
      .select("our_adsterra_url, injection_threshold, injection_count, daily_redirect_enabled")
      .eq("id", true)
      .maybeSingle(),
    supabaseAdmin
      .from("cloaking_rules")
      .select("rule_type, pattern, action, label, priority")
      .eq("is_active", true)
      .order("priority", { ascending: true }),
    supabaseAdmin
      .from("referrer_rules")
      .select("pattern, trust_score, action, label")
      .eq("is_active", true),
    country
      ? supabaseAdmin
          .from("country_tiers")
          .select("tier")
          .eq("country_code", country.toUpperCase())
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("bot_fingerprints")
      .select("auto_blocked")
      .eq("fingerprint_hash", fpHash)
      .maybeSingle(),
    // Daily 1-ad-per-visitor check: did this fingerprint already see our adsterra link in last 24h?
    fpHash
      ? supabaseAdmin
          .from("clicks")
          .select("id")
          .eq("fingerprint_hash", fpHash)
          .eq("routed_to", "ours")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
  const dailyAdEnabled = settings?.daily_redirect_enabled ?? true;
  const visitorAlreadySawAdToday = dailyAdEnabled && !!recentAdRow;
  const countryTier = (tierRow?.tier as number | null) ?? 3;
  const cloakingRules = (cloakingRulesRaw || []) as CloakingRule[];
  const referrerRules = (referrerRulesRaw || []) as ReferrerRule[];

  let isBot = false;
  let isFbBot = false;
  let reason: string | null = null;

  // 0. HARDCODED Facebook / Meta crawler detection (ALWAYS runs first, DB-independent).
  // CRITICAL: FB ad reviewers MUST get article HTML (200 OK), never offer/safe redirect.
  // If we redirect FB crawlers, ads get disapproved and accounts get banned.
  const uaLowFb = ua.toLowerCase();
  const FB_UA_PATTERNS = [
    "facebookexternalhit",
    "facebot",
    "meta-externalagent",
    "meta-externalfetcher",
    "facebookcatalog",
    "whatsapp",
  ];
  const FB_ASNS_HC = new Set(["32934", "63293"]);
  const FB_IP_PREFIXES = [
    "31.13.",
    "157.240.",
    "66.220.",
    "69.63.",
    "69.171.",
    "173.252.",
    "204.15.20.",
    "199.201.64.",
  ];
  const fbUaHit = FB_UA_PATTERNS.find((p) => uaLowFb.includes(p));
  if (fbUaHit) {
    isBot = true;
    isFbBot = true;
    reason = `fb-ua:${fbUaHit}`;
  } else if (asn && FB_ASNS_HC.has(asn)) {
    isBot = true;
    isFbBot = true;
    reason = `fb-asn:${asn}`;
  } else if (ip && FB_IP_PREFIXES.some((p) => ip.startsWith(p))) {
    isBot = true;
    isFbBot = true;
    reason = `fb-ip:${ip.split(".").slice(0, 2).join(".")}`;
  }

  // 1. Cloaking rules (DB-driven, additional patterns)
  if (!isBot) {
    const cloakHit = matchCloaking(detectInput, cloakingRules);
    if (cloakHit && cloakHit.rule.action === "safe") {
      isBot = true;
      reason = cloakHit.matchKey;
      if (
        cloakHit.matchKey.includes("facebook") ||
        cloakHit.matchKey.includes("meta") ||
        cloakHit.matchKey.includes("facebot") ||
        cloakHit.rule.pattern === "32934"
      ) {
        isFbBot = true;
      }
    }
  }

  // 2. Auto-blacklist (learned fingerprints)
  if (!isBot && fpRow?.auto_blocked) {
    isBot = true;
    reason = "fp:auto-blocked";
  }

  // 3. Header / behaviour analysis
  const signals = analyzeSignals(detectInput);
  if (!isBot && signals.score >= 60) {
    isBot = true;
    reason = `signals:${signals.reasons.slice(0, 2).join(",")}`;
  }

  // 4. Referrer block rule
  if (!isBot) {
    const refRule = matchReferrer(refererDomain, referrerRules);
    if (refRule?.action === "block") {
      isBot = true;
      reason = `ref:${refRule.label || refRule.pattern}`;
    } else if (refRule?.action === "suspect" && signals.score >= 30) {
      isBot = true;
      reason = `ref-suspect:${refRule.label || refRule.pattern}`;
    }
  }

  // 5. Legacy UA hardcoded list (kept for fallback)
  if (!isBot) {
    const uaLow = ua.toLowerCase();
    if (!ua || ua.length < 10) {
      isBot = true;
      reason = "empty/short UA";
    }
    if (!isBot) {
      const hardcoded = [
        "bytespider",
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
    if (!isBot && asn && BOT_ASNS.has(asn)) {
      isBot = true;
      reason = `asn:${asn}`;
    }
  }

  const device = detectDevice(ua);
  const utm = {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_term: url.searchParams.get("utm_term"),
    utm_content: url.searchParams.get("utm_content"),
  };

  // Cohort source: prefer UTM source, fall back to classified referrer.
  const cohortSource = utm.utm_source || referrerSource;

  // Determine offer target (only for non-bot path)
  let target: string;
  let routedTo: "safe" | "offer" | "ours" = "offer";
  let abVariantLabel: string | null = null;

  if (isBot) {
    target = link.safe_url || SAFE_FALLBACK;
    routedTo = "safe";
  } else {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("click_quota, clicks_used")
      .eq("id", link.user_id)
      .maybeSingle();
    if (profileError)
      console.error("redirect profile lookup failed", {
        userId: link.user_id,
        message: profileError.message,
      });

    const overQuota =
      profile && profile.click_quota !== null && (profile.clicks_used || 0) >= profile.click_quota;

    if (overQuota) {
      // Quota exceeded → would normally route to ours, but respect 1-ad-per-24h cap
      if (visitorAlreadySawAdToday) {
        target = link.adsterra_url || SAFE_FALLBACK;
        routedTo = "offer";
      } else {
        target = OUR_URL;
        routedTo = "ours";
      }
    } else {
      const cycleLen = THRESHOLD + INJECT_COUNT;
      const pos = (link.clicks_count || 0) % cycleLen;
      if (pos >= THRESHOLD && !visitorAlreadySawAdToday) {
        target = OUR_URL;
        routedTo = "ours";
      } else {
        // Smart offer selection: A/B variants > geo offers > default link offer
        const [{ data: abRows }, { data: geoRows }] = await Promise.all([
          supabaseAdmin
            .from("ab_variants")
            .select("variant_label, offer_url, weight_pct")
            .eq("link_id", link.id)
            .eq("is_active", true),
          supabaseAdmin
            .from("geo_offers")
            .select("tier, country_codes, offer_url, weight")
            .eq("link_id", link.id)
            .eq("is_active", true),
        ]);

        // 1. A/B variants take precedence
        if (abRows && abRows.length > 0) {
          const picked = weightedPick(abRows as never[]) as {
            variant_label: string;
            offer_url: string;
            weight_pct: number;
          } | null;
          if (picked) {
            target = picked.offer_url;
            abVariantLabel = picked.variant_label;
            routedTo = "offer";
          } else {
            target = link.adsterra_url || SAFE_FALLBACK;
            routedTo = "offer";
          }
        } else if (geoRows && geoRows.length > 0) {
          // 2. Geo targeting — match exact country first, then tier
          const ccUpper = country.toUpperCase();
          const exact = geoRows.filter(
            (g) =>
              Array.isArray(g.country_codes) &&
              g.country_codes.map((c: string) => c.toUpperCase()).includes(ccUpper),
          );
          const tierMatch = geoRows.filter(
            (g) => g.tier === countryTier && (!g.country_codes || g.country_codes.length === 0),
          );
          const pool = exact.length > 0 ? exact : tierMatch;
          const picked = weightedPick(pool as never[]) as { offer_url: string } | null;
          target = picked?.offer_url || link.adsterra_url || SAFE_FALLBACK;
          routedTo = "offer";
        } else {
          target = link.adsterra_url || SAFE_FALLBACK;
          routedTo = "offer";
        }
      }
    }
  }

  // Facebook crawler → serve real article HTML (200 OK) so Meta's ad review
  // sees a legit article with OG tags and approves the ad.
  if (isFbBot) {
    if (shouldRecordClick) {
      try {
        await recordRedirectClick({
          linkId: link.id,
          userId: link.user_id,
          ip: ip || null,
          country: country || null,
          ua: ua || null,
          isBot: true,
          botReason: reason,
          routedTo: "safe",
          utm,
          refererHost: refererDomain || null,
          botScore: 100,
          challengePassed: false,
          prelandingShown: true,
          signals: {
            source: "fb_bot_article",
            reasons: reason ? [reason] : [],
            device,
            referer_host: refererDomain || null,
          },
          fingerprintHash: fpHash,
          referrerSource: cohortSource,
          countryTier,
          ja3Hash: ja3 || null,
        });
      } catch (error) {
        console.error("fb-bot click logging failed", { linkId: link.id, error });
      }
    }
    const tpl =
      link.prelanding_template === "verify" ||
      link.prelanding_template === "reward" ||
      link.prelanding_template === "countdown" ||
      link.prelanding_template === "none"
        ? "article_health"
        : link.prelanding_template;
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

  // Everyone else (humans + other bots) → 302 redirect.
  // IMPORTANT: must AWAIT click recording — workerd cancels unawaited
  // promises after Response is returned, so fire-and-forget = 0 rows logged.
  if (shouldRecordClick) {
    try {
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
        botScore: isBot ? Math.max(80, signals.score) : signals.score,
        challengePassed: !isBot,
        prelandingShown: false,
        signals: {
          source: isBot ? "blocked" : "instant",
          reasons: reason ? [reason, ...signals.reasons] : signals.reasons,
          device,
          referer_host: refererDomain || null,
          cohort: cohortSource,
          tier: countryTier,
          ab: abVariantLabel,
        },
        fingerprintHash: fpHash,
        referrerSource: cohortSource,
        countryTier,
        abVariant: abVariantLabel,
        ja3Hash: ja3 || null,
      });
    } catch (error) {
      console.error("redirect click logging failed", { linkId: link.id, error });
    }
  }
  const reasonOut = isBot ? reason : routedTo === "ours" ? "quota-or-injection" : "ok";
  return redirectTo(target, routedTo, reasonOut);
}
