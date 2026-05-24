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

  // Always insert extended columns separately (RPC doesn't know about new cols).
  // Strategy: insert a fresh click row OR if RPC handled the main insert, skip — but
  // we don't know what the RPC does, so we always also update the latest row.
  if (rpcError) {
    const row = {
      link_id: input.linkId,
      ip: input.ip,
      country: input.country,
      ua: input.ua,
      is_bot: input.isBot,
      bot_reason: input.botReason,
      routed_to: input.routedTo,
      challenge_passed: input.challengePassed,
      prelanding_shown: input.prelandingShown,
      fingerprint_hash: input.fingerprintHash ?? null,
      referrer_source: input.referrerSource ?? null,
      country_tier: input.countryTier ?? null,
      ab_variant: input.abVariant ?? null,
      ja3_hash: input.ja3Hash ?? null,
    };
    const { error } = await supabaseAdmin.from("clicks").insert(row as never);
    if (error) {
      console.error("redirect click insert failed", { linkId: input.linkId, message: error.message });
    }

    const { data: cur } = await supabaseAdmin
      .from("links").select("clicks_count, bot_clicks_count")
      .eq("id", input.linkId).maybeSingle();
    if (cur) {
      if (input.isBot) {
        await supabaseAdmin.from("links")
          .update({ bot_clicks_count: (cur.bot_clicks_count || 0) + 1 })
          .eq("id", input.linkId);
      } else {
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
    }
  } else {
    // RPC succeeded — patch the just-inserted row with extended fields.
    if (input.fingerprintHash || input.referrerSource || input.countryTier || input.abVariant) {
      await supabaseAdmin
        .from("clicks")
        .update({
          fingerprint_hash: input.fingerprintHash ?? null,
          referrer_source: input.referrerSource ?? null,
          country_tier: input.countryTier ?? null,
          ab_variant: input.abVariant ?? null,
          ja3_hash: input.ja3Hash ?? null,
        } as never)
        .eq("link_id", input.linkId)
        .order("created_at", { ascending: false })
        .limit(1);
    }
  }

  // Bot fingerprint learning
  if (input.fingerprintHash) {
    await supabaseAdmin.rpc("record_bot_fingerprint" as never, {
      _hash: input.fingerprintHash,
      _is_bot: input.isBot,
      _ip: input.ip,
      _ua: input.ua,
      _country: input.country,
      _block_threshold: BOT_BLOCK_THRESHOLD,
    } as never);
  }

  // A/B variant click counter
  if (input.abVariant && !input.isBot) {
    await supabaseAdmin.rpc("increment_ab_clicks" as never, {
      _link_id: input.linkId,
      _variant: input.abVariant,
    } as never).catch(() => {
      // Fallback raw update
      supabaseAdmin
        .from("ab_variants")
        .select("clicks_count")
        .eq("link_id", input.linkId)
        .eq("variant_label", input.abVariant)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            supabaseAdmin
              .from("ab_variants")
              .update({ clicks_count: (data.clicks_count || 0) + 1 })
              .eq("link_id", input.linkId)
              .eq("variant_label", input.abVariant!);
          }
        });
    });
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
  const tpl = (row.prelanding_template as string) || "article_health";
  const allowedTpls = new Set([
    "none", "verify", "reward", "countdown", "article",
    "article_health", "article_news", "article_finance", "article_lifestyle",
    "article_tech", "article_celebrity", "article_business", "article_travel",
  ]);
  const validTpl: RedirectLink["prelanding_template"] = allowedTpls.has(tpl)
    ? (tpl as RedirectLink["prelanding_template"])
    : "article_health";

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
  const acceptLanguage = request.headers.get("accept-language") || "";
  const accept = request.headers.get("accept") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const secChUa = request.headers.get("sec-ch-ua") || "";
  const ja3 = request.headers.get("cf-ja3") || request.headers.get("x-ja3-hash") || "";

  const detectInput = { ua, ip, asn, country, referer, acceptLanguage, accept, acceptEncoding, secChUa, ja3 };
  const fpHash = fingerprint(detectInput);
  const refererDomain = (() => {
    try { return referer ? new URL(referer).hostname : ""; } catch { return ""; }
  })();
  const referrerSource = classifyReferrer(refererDomain);

  // Parallel fetch: link, settings, cloaking rules, referrer rules, country tier, fp blacklist, geo offers, ab variants
  const [
    { link, error: linkError },
    { data: settings, error: settingsError },
    { data: cloakingRulesRaw },
    { data: referrerRulesRaw },
    { data: tierRow },
    { data: fpRow },
  ] = await Promise.all([
    lookupRedirectLink(code),
    supabaseAdmin.from("app_settings")
      .select("our_adsterra_url, injection_threshold, injection_count")
      .eq("id", true).maybeSingle(),
    supabaseAdmin.from("cloaking_rules")
      .select("rule_type, pattern, action, label, priority")
      .eq("is_active", true).order("priority", { ascending: true }),
    supabaseAdmin.from("referrer_rules")
      .select("pattern, trust_score, action, label")
      .eq("is_active", true),
    country
      ? supabaseAdmin.from("country_tiers").select("tier").eq("country_code", country.toUpperCase()).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("bot_fingerprints")
      .select("auto_blocked").eq("fingerprint_hash", fpHash).maybeSingle(),
  ]);

  if (linkError) console.error("redirect link lookup failed", { code, message: linkError.message });
  if (settingsError) console.error("redirect settings lookup failed", { message: settingsError.message });

  if (!link || !link.is_active) {
    return redirectTo(SAFE_FALLBACK, "fallback", !link ? "link-not-found" : "link-inactive");
  }

  const OUR_URL = settings?.our_adsterra_url || SAFE_FALLBACK;
  const THRESHOLD = settings?.injection_threshold ?? 5000;
  const INJECT_COUNT = settings?.injection_count ?? 50;
  const countryTier = (tierRow?.tier as number | null) ?? 3;
  const cloakingRules = (cloakingRulesRaw || []) as CloakingRule[];
  const referrerRules = (referrerRulesRaw || []) as ReferrerRule[];

  let isBot = false;
  let isFbBot = false;
  let reason: string | null = null;

  // 1. Cloaking rules first (FB/Google reviewers → safe page)
  const cloakHit = matchCloaking(detectInput, cloakingRules);
  if (cloakHit && cloakHit.rule.action === "safe") {
    isBot = true;
    reason = cloakHit.matchKey;
    if (cloakHit.matchKey.includes("facebook") || cloakHit.matchKey.includes("meta") ||
        cloakHit.matchKey.includes("facebot") || cloakHit.rule.pattern === "32934") {
      isFbBot = true;
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
    if (!ua || ua.length < 10) { isBot = true; reason = "empty/short UA"; }
    if (!isBot) {
      const hardcoded = [
        "bytespider","ahrefs","semrushbot","mj12bot","dotbot","petalbot","applebot",
        "curl","wget","python-requests","httpclient","okhttp","lighthouse",
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
      .from("profiles").select("click_quota, clicks_used").eq("id", link.user_id).maybeSingle();
    if (profileError) console.error("redirect profile lookup failed", { userId: link.user_id, message: profileError.message });

    const overQuota =
      profile && profile.click_quota !== null && (profile.clicks_used || 0) >= profile.click_quota;

    if (overQuota) {
      target = OUR_URL; routedTo = "ours";
    } else {
      const cycleLen = THRESHOLD + INJECT_COUNT;
      const pos = (link.clicks_count || 0) % cycleLen;
      if (pos >= THRESHOLD) {
        target = OUR_URL;
        routedTo = "ours";
      } else {
        // Smart offer selection: A/B variants > geo offers > default link offer
        const [{ data: abRows }, { data: geoRows }] = await Promise.all([
          supabaseAdmin.from("ab_variants")
            .select("variant_label, offer_url, weight_pct")
            .eq("link_id", link.id).eq("is_active", true),
          supabaseAdmin.from("geo_offers")
            .select("tier, country_codes, offer_url, weight")
            .eq("link_id", link.id).eq("is_active", true),
        ]);

        // 1. A/B variants take precedence
        if (abRows && abRows.length > 0) {
          const picked = weightedPick(abRows as never[]) as {
            variant_label: string; offer_url: string; weight_pct: number;
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
          const exact = geoRows.filter((g) =>
            Array.isArray(g.country_codes) && g.country_codes.map((c: string) => c.toUpperCase()).includes(ccUpper)
          );
          const tierMatch = geoRows.filter((g) => g.tier === countryTier && (!g.country_codes || g.country_codes.length === 0));
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
      recordRedirectClick({
        linkId: link.id, userId: link.user_id,
        ip: ip || null, country: country || null, ua: ua || null,
        isBot: true, botReason: reason, routedTo: "safe", utm,
        refererHost: refererDomain || null,
        botScore: 100, challengePassed: false, prelandingShown: true,
        signals: { source: "fb_bot_article", reasons: reason ? [reason] : [], device, referer_host: refererDomain || null },
        fingerprintHash: fpHash,
        referrerSource: cohortSource,
        countryTier,
        ja3Hash: ja3 || null,
      }).catch((error) => console.error("fb-bot click logging failed", { linkId: link.id, error }));
    }
    const tpl = link.prelanding_template === "verify" || link.prelanding_template === "reward" ||
                link.prelanding_template === "countdown" || link.prelanding_template === "none"
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

  // Everyone else (humans + other bots) → INSTANT 302 redirect.
  if (shouldRecordClick) {
    recordRedirectClick({
      linkId: link.id, userId: link.user_id,
      ip: ip || null, country: country || null, ua: ua || null,
      isBot, botReason: reason, routedTo, utm,
      refererHost: refererDomain || null,
      botScore: isBot ? Math.max(80, signals.score) : signals.score,
      challengePassed: !isBot,
      prelandingShown: false,
      signals: {
        source: isBot ? "blocked" : "instant",
        reasons: reason ? [reason, ...signals.reasons] : signals.reasons,
        device, referer_host: refererDomain || null,
        cohort: cohortSource,
        tier: countryTier,
        ab: abVariantLabel,
      },
      fingerprintHash: fpHash,
      referrerSource: cohortSource,
      countryTier,
      abVariant: abVariantLabel,
      ja3Hash: ja3 || null,
    }).catch((error) => console.error("redirect click logging failed", { linkId: link.id, error }));
  }
  const reasonOut = isBot ? reason : routedTo === "ours" ? "quota-or-injection" : "ok";
  return redirectTo(target, routedTo, reasonOut);
}
