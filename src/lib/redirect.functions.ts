import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseUA } from "@/lib/ua";
import { pickVariant, type Variant, type VariantSection } from "@/lib/variants";

function extractAttribution(urlLike: string | null | undefined) {
  const out = {
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
    utm_term: null as string | null,
    utm_content: null as string | null,
    referer_host: null as string | null,
  };
  if (!urlLike) return out;
  try {
    const u = new URL(urlLike);
    const g = (k: string) => {
      const v = u.searchParams.get(k);
      return v ? v.slice(0, 120) : null;
    };
    out.utm_source = g("utm_source");
    out.utm_medium = g("utm_medium");
    out.utm_campaign = g("utm_campaign");
    out.utm_term = g("utm_term");
    out.utm_content = g("utm_content");
  } catch { /* ignore */ }
  return out;
}

function refererHost(ref: string | null | undefined) {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, "").slice(0, 120); }
  catch { return null; }
}

function attributionFromRequestUrl() {
  // The request URL on resolveLink is the /r/$code?utm_... URL during SSR
  let urlStr: string | null = null;
  try { urlStr = getRequestUrl().toString(); } catch { /* ignore */ }
  const attr = extractAttribution(urlStr);
  const ref = getRequestHeader("referer") || null;
  attr.referer_host = refererHost(ref);
  return attr;
}

function attributionFromReferer() {
  // For verifyHuman: referer header is the lander URL carrying UTMs
  const ref = getRequestHeader("referer") || null;
  const attr = extractAttribution(ref);
  attr.referer_host = refererHost(ref);
  return attr;
}
// ---------- Server-side helpers ----------

const BOT_UA_PATTERNS = [
  "bot", "crawler", "spider", "scraper", "facebookexternalhit", "facebookcatalog",
  "meta-externalagent", "meta-externalfetcher", "twitterbot", "linkedinbot",
  "whatsapp", "telegrambot", "slackbot", "discordbot", "embedly", "pinterest",
  "googlebot", "bingbot", "yandex", "duckduckbot", "baiduspider", "applebot",
  "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "petalbot",
  "headless", "phantom", "selenium", "puppeteer", "playwright", "chrome-lighthouse",
  "curl", "wget", "python", "scrapy", "go-http", "java/", "okhttp", "ruby",
  "axios", "node-fetch", "got (", "http_request", "libwww",
  "preview", "monitor", "uptime", "validator", "checker", "fetcher", "scan",
];

function analyzeRequest() {
  const ua = (getRequestHeader("user-agent") || "").toLowerCase();
  const accept = (getRequestHeader("accept") || "").toLowerCase();
  const acceptLang = getRequestHeader("accept-language") || "";
  const acceptEnc = getRequestHeader("accept-encoding") || "";
  const secFetchSite = getRequestHeader("sec-fetch-site") || "";
  const secFetchMode = getRequestHeader("sec-fetch-mode") || "";
  const secFetchDest = getRequestHeader("sec-fetch-dest") || "";
  const secChUa = getRequestHeader("sec-ch-ua") || "";
  const secChUaMobile = getRequestHeader("sec-ch-ua-mobile") || "";
  const dnt = getRequestHeader("dnt") || "";
  const referer = getRequestHeader("referer") || "";
  const cfBotMgmt = getRequestHeader("cf-bot-management-score") || "";
  const cfVerifiedBot = getRequestHeader("cf-verified-bot") || "";
  const cfThreatScore = getRequestHeader("cf-threat-score") || "";

  let score = 0;
  const reasons: string[] = [];
  // hardBot = strong, near-certain bot signal. Used to decide silent-cloak.
  // Score-based suspicion alone does NOT silence — we don't want to lose
  // paid FB traffic on a real mobile user with weird headers.
  let hardBot = false;

  if (!ua) { score += 50; reasons.push("no-ua"); hardBot = true; }
  for (const p of BOT_UA_PATTERNS) {
    if (ua.includes(p)) { score += 60; reasons.push(`ua:${p}`); hardBot = true; break; }
  }

  if (!accept.includes("text/html")) { score += 25; reasons.push("no-html-accept"); }
  if (!acceptLang) { score += 20; reasons.push("no-accept-lang"); }
  if (!acceptEnc.includes("gzip") && !acceptEnc.includes("br")) {
    score += 15; reasons.push("no-compression");
  }

  const looksModern = /chrome\/|firefox\/|safari\//.test(ua);
  if (looksModern && !secFetchMode) { score += 15; reasons.push("no-sec-fetch"); }
  if (looksModern && !secFetchDest) { score += 10; reasons.push("no-sec-fetch-dest"); }
  if (ua.includes("chrome/") && !secChUa) { score += 20; reasons.push("chrome-no-ch-ua"); }

  if (cfVerifiedBot === "true") { score += 100; reasons.push("cf-verified-bot"); hardBot = true; }
  if (cfBotMgmt) {
    const s = parseInt(cfBotMgmt, 10);
    if (!isNaN(s) && s < 30) { score += 40; reasons.push(`cf-bot-score:${s}`); }
    if (!isNaN(s) && s < 5) hardBot = true; // CF extremely confident
  }
  if (cfThreatScore) {
    const s = parseInt(cfThreatScore, 10);
    if (!isNaN(s) && s > 30) { score += 30; reasons.push(`cf-threat:${s}`); }
  }

  if (!referer && secFetchSite === "none" && score === 0) {
    reasons.push("direct-nav");
  }

  return {
    ua, isBot: score >= 50, hardBot, score,
    reasons: reasons.join(","),
    acceptLang, secChUaMobile, dnt,
  };
}

const SectionSchema = z.object({
  heading: z.string().max(300),
  body: z.string().max(4000),
});

function rowToVariant(r: {
  id: string; slug: string; category: string; title: string; subtitle: string;
  intro: string; sections: unknown; outro: string;
}): Variant {
  const parsed = z.array(SectionSchema).safeParse(r.sections);
  const sections: VariantSection[] = parsed.success ? parsed.data : [];
  return {
    id: r.id, slug: r.slug, category: r.category, title: r.title,
    subtitle: r.subtitle, intro: r.intro, sections, outro: r.outro,
  };
}

// ---------- Protection config + rate limit ----------

type ProtectionConfig = {
  ip_rate_limit_per_min: number;
  ip_rate_limit_window_sec: number;
  suspicious_action: "block" | "safe_page" | "allow";
  block_threshold_score: number;
  safe_page_message: string;
};

const DEFAULT_PROTECTION: ProtectionConfig = {
  ip_rate_limit_per_min: 30,
  ip_rate_limit_window_sec: 60,
  suspicious_action: "safe_page",
  block_threshold_score: 60,
  safe_page_message:
    "This article is temporarily unavailable. Please check back later.",
};

async function loadProtection(): Promise<ProtectionConfig> {
  const { data } = await supabaseAdmin
    .from("bot_protection_config")
    .select("ip_rate_limit_per_min,ip_rate_limit_window_sec,suspicious_action,block_threshold_score,safe_page_message")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_PROTECTION;
  return {
    ...DEFAULT_PROTECTION,
    ...data,
    suspicious_action: (data.suspicious_action as ProtectionConfig["suspicious_action"]) ?? "safe_page",
  };
}

async function ipExceedsRate(ip: string, cfg: ProtectionConfig): Promise<number> {
  if (!ip) return 0;
  const since = new Date(Date.now() - cfg.ip_rate_limit_window_sec * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("clicks")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);
  const perMinEquivalent = ((count ?? 0) * 60) / Math.max(1, cfg.ip_rate_limit_window_sec);
  return perMinEquivalent > cfg.ip_rate_limit_per_min ? count ?? 0 : 0;
}

// ---------- Targeting (geo / device / language / time) ----------

type Targeting = {
  allowed_countries?: string[];
  blocked_countries?: string[];
  allowed_devices?: string[];   // "desktop" | "mobile" | "tablet"
  blocked_devices?: string[];
  allowed_languages?: string[]; // e.g. ["en","bn"]
  blocked_languages?: string[];
  allowed_hours?: { start: number; end: number } | null; // 0-23 UTC
};

function primaryLang(acceptLang: string | undefined | null): string | null {
  if (!acceptLang) return null;
  const first = acceptLang.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  return first.split("-")[0].slice(0, 5);
}

function checkTargeting(
  t: Targeting | null | undefined,
  ctx: { country: string | null; device: string | null; lang: string | null },
): { blocked: boolean; reason: string } {
  if (!t || typeof t !== "object") return { blocked: false, reason: "" };
  const country = (ctx.country || "").toUpperCase();
  const device = (ctx.device || "").toLowerCase();
  const lang = (ctx.lang || "").toLowerCase();

  if (t.allowed_countries?.length && country && !t.allowed_countries.map(c => c.toUpperCase()).includes(country)) {
    return { blocked: true, reason: `geo-not-allowed:${country}` };
  }
  if (t.blocked_countries?.length && country && t.blocked_countries.map(c => c.toUpperCase()).includes(country)) {
    return { blocked: true, reason: `geo-blocked:${country}` };
  }
  if (t.allowed_devices?.length && device && !t.allowed_devices.map(d => d.toLowerCase()).includes(device)) {
    return { blocked: true, reason: `device-not-allowed:${device}` };
  }
  if (t.blocked_devices?.length && device && t.blocked_devices.map(d => d.toLowerCase()).includes(device)) {
    return { blocked: true, reason: `device-blocked:${device}` };
  }
  if (t.allowed_languages?.length && lang && !t.allowed_languages.map(l => l.toLowerCase()).includes(lang)) {
    return { blocked: true, reason: `lang-not-allowed:${lang}` };
  }
  if (t.blocked_languages?.length && lang && t.blocked_languages.map(l => l.toLowerCase()).includes(lang)) {
    return { blocked: true, reason: `lang-blocked:${lang}` };
  }
  if (t.allowed_hours && typeof t.allowed_hours.start === "number" && typeof t.allowed_hours.end === "number") {
    const h = new Date().getUTCHours();
    const { start, end } = t.allowed_hours;
    const inWindow = start <= end ? (h >= start && h <= end) : (h >= start || h <= end);
    if (!inWindow) return { blocked: true, reason: `hour-blocked:${h}UTC` };
  }
  return { blocked: false, reason: "" };
}

function pickWeightedDestination(
  rows: { url: string; weight: number; is_active: boolean }[],
  fallback: string,
): string {
  const active = rows.filter(r => r.is_active && r.weight > 0 && r.url);
  if (active.length === 0) return fallback;
  const total = active.reduce((s, r) => s + r.weight, 0);
  let pick = Math.random() * total;
  for (const r of active) {
    pick -= r.weight;
    if (pick <= 0) return r.url;
  }
  return active[active.length - 1].url;
}

// ---------- Batch-1 defense helpers: FB blocklist + referer rules + dup-clicks + geo/device destinations ----------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v < 0 || v > 255) return null;
    n = (n * 256) + v;
  }
  return n;
}
function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base);
  if (ipN === null || baseN === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

async function checkFbBlocklist(ip: string, asn: number | null): Promise<string | null> {
  if (!ip && !asn) return null;
  const { data } = await supabaseAdmin
    .from("fb_asn_blocklist")
    .select("asn,ip_cidr,label")
    .eq("is_active", true);
  if (!data) return null;
  for (const row of data) {
    if (asn && row.asn === asn) return `fb-asn:${row.label}`;
    if (ip && row.ip_cidr && ipInCidr(ip, row.ip_cidr)) return `fb-ip:${row.label}`;
  }
  return null;
}

function matchHostPattern(host: string, pattern: string): boolean {
  // exact, dot-suffix, or wildcard like "*.facebook.com" / "l.*.com"
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (h === p) return true;
  if (!p.includes("*")) {
    return h === p || h.endsWith(`.${p}`);
  }
  // Convert wildcard pattern → regex (escape dots, * → [^.]*)
  const rx = new RegExp(
    "^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*") + "$",
  );
  return rx.test(h);
}

async function checkRefererRule(host: string | null): Promise<"safe" | "cloak" | "pass" | null> {
  if (!host) return null;
  const { data } = await supabaseAdmin
    .from("referer_rules")
    .select("host_pattern,action,priority")
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (!data) return null;
  for (const r of data) {
    if (matchHostPattern(host, r.host_pattern)) {
      return r.action as "safe" | "cloak" | "pass";
    }
  }
  return null;
}

async function checkTimeRule(linkId: string): Promise<"safe" | "cloak" | "pass" | null> {
  const { data } = await supabaseAdmin
    .from("link_time_rules")
    .select("days_mask,start_minute,end_minute,action,timezone,priority")
    .eq("link_id", linkId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (!data || data.length === 0) return null;
  const { pickActiveTimeRule } = await import("@/lib/time-rule-eval");
  return pickActiveTimeRule(data as any);
}

async function pickGeoDeviceDestination(
  linkId: string,
  country: string | null,
  device: string | null,
  os: string | null,
): Promise<string | null> {
  // Geo first
  if (country) {
    const { data } = await supabaseAdmin
      .from("link_geo_rules")
      .select("adsterra_url,priority")
      .eq("link_id", linkId)
      .eq("country_code", country.toUpperCase())
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(1);
    if (data && data.length > 0) return data[0].adsterra_url;
  }
  // Device + OS
  if (device) {
    const { data } = await supabaseAdmin
      .from("link_device_rules")
      .select("adsterra_url,device,os,priority")
      .eq("link_id", linkId)
      .eq("is_active", true)
      .in("device", [device.toLowerCase(), "any"])
      .order("priority", { ascending: true });
    if (data) {
      const osLower = (os || "").toLowerCase();
      // Prefer exact device+os match, then device+any, then any+any
      const exact = data.find(r => r.device === device.toLowerCase() && r.os.toLowerCase() === osLower);
      if (exact) return exact.adsterra_url;
      const devAny = data.find(r => r.device === device.toLowerCase() && r.os === "any");
      if (devAny) return devAny.adsterra_url;
      const anyAny = data.find(r => r.device === "any" && r.os === "any");
      if (anyAny) return anyAny.adsterra_url;
    }
  }
  return null;
}

async function isDuplicateClick(
  ip: string,
  linkId: string,
  windowMinutes: number,
): Promise<boolean> {
  if (!ip) return false;
  const cutoff = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("duplicate_clicks")
    .select("last_seen")
    .eq("ip", ip)
    .eq("link_id", linkId)
    .gte("last_seen", cutoff)
    .maybeSingle();
  return Boolean(data);
}

async function recordDuplicateClick(ip: string, linkId: string): Promise<void> {
  if (!ip) return;
  // Upsert: bump last_seen + hit_count
  const { data: existing } = await supabaseAdmin
    .from("duplicate_clicks")
    .select("hit_count")
    .eq("ip", ip)
    .eq("link_id", linkId)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin.from("duplicate_clicks")
      .update({ last_seen: new Date().toISOString(), hit_count: existing.hit_count + 1 })
      .eq("ip", ip)
      .eq("link_id", linkId);
  } else {
    await supabaseAdmin.from("duplicate_clicks")
      .insert({ ip, link_id: linkId, hit_count: 1 });
  }
}

function asnFromHeaders(): number | null {
  const raw = getRequestHeader("cf-connecting-asn") || getRequestHeader("cf-asn") || "";
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// ---------- Server functions ----------

export const resolveLink = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const a = analyzeRequest();
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for") ||
      "";
    const country = getRequestHeader("cf-ipcountry") || null;
    const referer = getRequestHeader("referer") || "";

    const cfg = await loadProtection();

    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, status, targeting")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") return { found: false as const };

    // Targeting check (geo/device/lang/time)
    const uaInfoT = parseUA(a.ua);
    const targetingCheck = checkTargeting(link.targeting as Targeting | null, {
      country,
      device: uaInfoT.device,
      lang: primaryLang(a.acceptLang),
    });

    // IP velocity check
    const rateHits = await ipExceedsRate(ip, cfg);
    const rateLimited = rateHits > 0;

    // Aggregate suspicion: pre-flag bot OR rate-limited OR over hard threshold OR targeting block
    const suspicious =
      a.isBot || rateLimited || a.score >= cfg.block_threshold_score || targetingCheck.blocked;

    const suspicionReasons = [
      a.reasons,
      rateLimited ? `rate:${rateHits}/${cfg.ip_rate_limit_window_sec}s` : "",
      targetingCheck.blocked ? `target:${targetingCheck.reason}` : "",
    ].filter(Boolean).join(",");

    // Targeting block: also serve silent prelander instead of giving away that we filtered
    const effectiveAction = targetingCheck.blocked ? "safe_page" : cfg.suspicious_action;

    // Hard block path — only when admin explicitly chose "block"
    if (suspicious && effectiveAction === "block") {
      const uaInfoB = parseUA(a.ua);
      const attrB = attributionFromRequestUrl();
      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country,
        user_agent: a.ua || null,
        referer: referer || null,
        is_bot: true,
        bot_reason: `blocked:${suspicionReasons}`,
        device: uaInfoB.device,
        os: uaInfoB.os,
        browser: uaInfoB.browser,
        variant: null,
        ...attrB,
      });
      return {
        found: true as const,
        blocked: true as const,
        safe: false as const,
        message: cfg.safe_page_message,
      };
    }

    // NOTE: "safe page" path no longer renders a separate "Article unavailable"
    // screen — that was a giveaway cloaking signal to Facebook's ad reviewer
    // bot. Instead we fall through and render a real prelander variant, but
    // set silentBot:true so the client never auto-triggers verifyHuman and
    // never reveals the real destination. To the reviewer this looks like a
    // legitimate article page that simply isn't auto-redirecting.

    // Load active variants from DB
    const { data: variantRows } = await supabaseAdmin
      .from("prelander_variants")
      .select("id,slug,category,title,subtitle,intro,sections,outro")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const variants: Variant[] = (variantRows ?? []).map(rowToVariant);
    if (variants.length === 0) {
      return { found: false as const };
    }
    const slugs = variants.map((v) => v.slug);

    const { data: override } = await supabaseAdmin
      .from("link_variant_overrides")
      .select("variant_slug")
      .eq("link_id", link.id)
      .maybeSingle();

    let chosenSlug: string;
    if (override && slugs.includes(override.variant_slug)) {
      chosenSlug = override.variant_slug;
    } else {
      const { data: recent } = await supabaseAdmin
        .from("clicks")
        .select("variant,is_bot,bot_reason")
        .eq("link_id", link.id)
        .not("variant", "is", null)
        .like("bot_reason", "verify:%")
        .order("created_at", { ascending: false })
        .limit(1500);

      const stats = slugs.map((slug) => {
        let total = 0, humans = 0;
        for (const r of recent ?? []) {
          if (r.variant !== slug) continue;
          total += 1;
          if (!r.is_bot) humans += 1;
        }
        return { slug, total, humans };
      });
      chosenSlug = pickVariant(slugs, stats);
    }

    const chosenVariant = variants.find((v) => v.slug === chosenSlug) ?? variants[0];

    const uaInfo = parseUA(a.ua);
    const attr = attributionFromRequestUrl();
    // Batch-1: FB blocklist + referer rule check (treat as silent cloak)
    const asn = asnFromHeaders();
    const fbHitRaw = await checkFbBlocklist(ip, asn);
    // IMPORTANT: Facebook's mobile in-app browser routes REAL users through
    // FB's own IP ranges. If the UA looks like a real browser (Chrome/Safari/
    // Firefox) and has no scraper signal, do NOT cloak based on IP alone —
    // otherwise we silently lose every FB in-app browser human click.
    // Only honor the FB-IP hit when the UA itself is also a known scraper.
    const fbHit = fbHitRaw && a.hardBot ? fbHitRaw : null;
    const refHost = refererHost(referer);
    const refAction = await checkRefererRule(refHost);
    const timeAction = await checkTimeRule(link.id);
    const refSafe = refAction === "safe" || refAction === "cloak";
    const timeSafe = timeAction === "safe" || timeAction === "cloak";
    // Only silent-cloak when we have a STRONG bot signal. Soft score-based
    // suspicion alone keeps the human path open — we'd rather risk one bot
    // click reaching the offer than burn a real $0.50 FB ad click on the
    // silent page. The client-side fingerprint check in verifyHuman is the
    // safety net for borderline cases.
    const silentBot = a.hardBot || Boolean(fbHit) || refSafe || timeSafe || targetingCheck.blocked;
    const defenseReasons = [
      suspicionReasons,
      fbHit || "",
      refAction ? `referer:${refAction}:${refHost}` : "",
      timeAction ? `time:${timeAction}` : "",
    ].filter(Boolean).join(",");
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: a.ua || null,
      referer: referer || null,
      is_bot: silentBot || a.isBot,
      bot_reason: silentBot ? `silent:${defenseReasons}` : (defenseReasons || null),
      device: uaInfo.device,
      os: uaInfo.os,
      browser: uaInfo.browser,
      variant: chosenVariant.slug,
      ...attr,
    });

    if (a.isBot || silentBot) {
      const { data: cur } = await supabaseAdmin
        .from("links").select("bot_clicks_count").eq("id", link.id).single();
      if (cur) {
        await supabaseAdmin.from("links")
          .update({ bot_clicks_count: cur.bot_clicks_count + 1 })
          .eq("id", link.id);
      }
    }

    return {
      found: true as const,
      blocked: false as const,
      safe: false as const,
      silentBot,
      linkId: link.id,
      variant: chosenVariant,
      preFlagBot: a.isBot,
      serverScore: a.score,
    };
  });

export const verifyHuman = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      code: z.string().min(1).max(32),
      variant: z.string().min(1).max(64),
      fp: z.object({
        ua: z.string().max(500),
        webdriver: z.boolean(),
        languages: z.array(z.string().max(20)).max(20),
        platform: z.string().max(50),
        hwConcurrency: z.number().min(0).max(256),
        deviceMemory: z.number().min(0).max(1024),
        screen: z.object({
          w: z.number().min(0).max(20000),
          h: z.number().min(0).max(20000),
          cd: z.number().min(0).max(64),
        }),
        tz: z.string().max(100),
        plugins: z.number().min(0).max(100),
        touchPoints: z.number().min(0).max(50),
        hasChrome: z.boolean(),
        mouse: z.number().min(0).max(100000),
        scroll: z.number().min(0).max(100000),
        key: z.number().min(0).max(100000),
        touch: z.number().min(0).max(100000),
        timeOnPage: z.number().min(0).max(3600000),
        canvasHash: z.string().max(64),
      }),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const a = analyzeRequest();
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for") ||
      "";

    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, destination_url, status, targeting, duplicate_protection, duplicate_window_minutes")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") {
      return { ok: false as const, reason: "not-found" };
    }

    // Batch-1: FB blocklist + referer rules (silently fail any FB / safe-referer hit)
    const asn = asnFromHeaders();
    const fbHitRaw = await checkFbBlocklist(ip, asn);
    // Same fix as resolveLink: only honor FB IP/ASN hit when UA itself is a
    // known scraper. Real users in FB in-app browser share these IP ranges.
    const fbHit = fbHitRaw && a.hardBot ? fbHitRaw : null;
    const refHost = refererHost(getRequestHeader("referer"));
    const refAction = await checkRefererRule(refHost);
    const timeAction = await checkTimeRule(link.id);
    if (fbHit || refAction === "safe" || refAction === "cloak" || timeAction === "safe" || timeAction === "cloak") {
      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country: getRequestHeader("cf-ipcountry") || null,
        user_agent: a.ua || null,
        referer: getRequestHeader("referer") || null,
        is_bot: true,
        bot_reason: `verify-silent:${fbHit || ""}${refAction ? `|referer:${refAction}:${refHost}` : ""}${timeAction ? `|time:${timeAction}` : ""}`,
        device: parseUA(a.ua).device,
        os: parseUA(a.ua).os,
        browser: parseUA(a.ua).browser,
        variant: data.variant,
      });
      return { ok: false as const, reason: "blocklist" };
    }

    // Batch-1: Duplicate click protection
    if (link.duplicate_protection) {
      const dup = await isDuplicateClick(ip, link.id, link.duplicate_window_minutes ?? 30);
      if (dup) {
        await recordDuplicateClick(ip, link.id);
        return { ok: false as const, reason: "duplicate" };
      }
    }

    // Re-check protection + targeting at verification time
    const cfg = await loadProtection();
    const rateHits = await ipExceedsRate(ip, cfg);

    const uaInfo2 = parseUA(a.ua);
    const country = getRequestHeader("cf-ipcountry") || null;
    const targetingCheck2 = checkTargeting(link.targeting as Targeting | null, {
      country,
      device: uaInfo2.device,
      lang: primaryLang(a.acceptLang),
    });

    let score = a.score;
    const reasons: string[] = a.reasons ? [a.reasons] : [];
    if (rateHits > 0) {
      score += 60;
      reasons.push(`rate:${rateHits}/${cfg.ip_rate_limit_window_sec}s`);
    }
    if (targetingCheck2.blocked) {
      score += 100;
      reasons.push(`target:${targetingCheck2.reason}`);
    }
    const fp = data.fp;

    if (fp.webdriver) { score += 80; reasons.push("webdriver"); }
    if (fp.ua.toLowerCase().includes("headless")) { score += 80; reasons.push("fp-headless"); }
    if (!fp.languages.length) { score += 30; reasons.push("no-languages"); }
    if (fp.screen.w < 200 || fp.screen.h < 200) { score += 50; reasons.push("tiny-screen"); }
    if (fp.screen.cd === 0) { score += 30; reasons.push("no-colordepth"); }
    if (fp.hwConcurrency === 0) { score += 20; reasons.push("no-hw-concurrency"); }
    if (!fp.tz) { score += 20; reasons.push("no-tz"); }
    if (fp.canvasHash === "blocked" || fp.canvasHash.length < 4) {
      score += 25; reasons.push("canvas-blocked");
    }
    if (fp.ua.toLowerCase().includes("chrome/") && !fp.hasChrome) {
      score += 40; reasons.push("chrome-spoof");
    }
    if (/mobile|android|iphone/i.test(fp.ua) && fp.touchPoints === 0) {
      score += 30; reasons.push("mobile-no-touch");
    }

    const interactions = fp.mouse + fp.scroll + fp.key + fp.touch;
    if (interactions === 0) { score += 10; reasons.push("no-interaction"); }
    if (fp.timeOnPage < 100) { score += 10; reasons.push("too-fast"); }

    if (fp.ua && a.ua && fp.ua.toLowerCase() !== a.ua) {
      score += 25; reasons.push("ua-mismatch");
    }

    const isBot = score >= cfg.block_threshold_score;

    const attr2 = attributionFromReferer();
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: a.ua || null,
      referer: getRequestHeader("referer") || null,
      is_bot: isBot,
      bot_reason: `verify:${reasons.join(",")}|score:${score}`,
      device: uaInfo2.device,
      os: uaInfo2.os,
      browser: uaInfo2.browser,
      variant: data.variant,
      ...attr2,
    });

    if (isBot) {
      const { data: cur } = await supabaseAdmin
        .from("links").select("bot_clicks_count").eq("id", link.id).single();
      if (cur) {
        await supabaseAdmin.from("links")
          .update({ bot_clicks_count: cur.bot_clicks_count + 1 })
          .eq("id", link.id);
      }
      return { ok: false as const, reason: "bot-detected" };
    }

    const { data: cur } = await supabaseAdmin
      .from("links").select("clicks_count").eq("id", link.id).single();
    if (cur) {
      await supabaseAdmin.from("links")
        .update({ clicks_count: cur.clicks_count + 1 })
        .eq("id", link.id);
    }

    // Record this IP so subsequent quick re-clicks are deduped
    if (link.duplicate_protection) {
      await recordDuplicateClick(ip, link.id);
    }

    // Final destination priority (cascade):
    //   1) Geo / device-OS specific Adsterra link (per-link rules)
    //   2) Weighted rotator over link_destinations
    //   3) Plain destination_url (THE Adsterra link the user pasted)
    const geoDev = await pickGeoDeviceDestination(link.id, country, uaInfo2.device, uaInfo2.os);
    if (geoDev) return { ok: true as const, destination: geoDev };

    const { data: destRows } = await supabaseAdmin
      .from("link_destinations")
      .select("url,weight,is_active")
      .eq("link_id", link.id);
    const destination = pickWeightedDestination(destRows ?? [], link.destination_url);

    return { ok: true as const, destination };
  });

