import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { parseUA } from "@/lib/ua";
import { pickVariant, type Variant, type VariantSection } from "@/lib/variants";

function createRedirectAdminClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "http://127.0.0.1:8000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key)
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY for redirect lookup");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let redirectAdminClient: ReturnType<typeof createRedirectAdminClient> | undefined;
const supabaseAdmin = new Proxy({} as ReturnType<typeof createRedirectAdminClient>, {
  get(_, prop, receiver) {
    if (!redirectAdminClient) redirectAdminClient = createRedirectAdminClient();
    return Reflect.get(redirectAdminClient, prop, receiver);
  },
});

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
  } catch {
    /* ignore */
  }
  return out;
}

// ---------- Phase 3: Fingerprint hashing + repeat detection ----------

/**
 * Stable SHA-256 hash of stable fingerprint parts (no volatile behavior counters).
 * Same device returning later → same hash.
 */
async function hashFingerprint(fp: {
  ua: string;
  platform: string;
  languages: string[];
  hwConcurrency: number;
  deviceMemory: number;
  screen: { w: number; h: number; cd: number };
  tz: string;
  canvasHash: string;
}): Promise<string> {
  const payload = [
    fp.ua,
    fp.platform,
    fp.languages.join(","),
    String(fp.hwConcurrency),
    String(fp.deviceMemory),
    `${fp.screen.w}x${fp.screen.h}x${fp.screen.cd}`,
    fp.tz,
    fp.canvasHash,
  ].join("|");
  try {
    const buf = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    let h = 5381;
    for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, "0");
  }
}

/**
 * Count recent clicks sharing this fingerprint hash from DIFFERENT IPs in last N minutes.
 * High count → same browser identity spraying from proxy pool → strong bot signal.
 */
async function repeatFingerprintHits(
  fpHash: string,
  currentIp: string,
  windowMinutes = 10,
): Promise<number> {
  if (!fpHash) return 0;
  try {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("clicks")
      .select("ip_address")
      .eq("fingerprint_hash", fpHash)
      .gte("created_at", since)
      .limit(50);
    if (!data) return 0;
    const distinctIps = new Set(
      data.map((r) => r.ip_address).filter((ip): ip is string => !!ip && ip !== currentIp),
    );
    return distinctIps.size;
  } catch {
    return 0;
  }
}

function phase3Signals(input: {
  source: "direct" | "blocked" | "silent" | "verify-silent";
  request: ReturnType<typeof analyzeRequest>;
  reasons: string[];
  rateHits?: number;
  duplicateClick?: boolean;
  targetBlocked?: boolean;
  targetReason?: string;
  fbHit?: string | null;
  refAction?: string | null;
  timeAction?: string | null;
}) {
  return {
    phase: 3,
    source: input.source,
    serverScore: input.request.score,
    hardBot: input.request.hardBot,
    requestBot: input.request.isBot,
    acceptLang: Boolean(input.request.acceptLang),
    secChUa: Boolean(input.request.secChUa),
    dnt: input.request.dnt || null,
    rateHits: input.rateHits ?? 0,
    duplicateClick: Boolean(input.duplicateClick),
    targetBlocked: Boolean(input.targetBlocked),
    targetReason: input.targetReason || null,
    fbHit: input.fbHit || null,
    refAction: input.refAction || null,
    timeAction: input.timeAction || null,
    reasons: input.reasons.filter(Boolean),
  };
}

async function serverFingerprintHash(
  request: ReturnType<typeof analyzeRequest>,
  uaInfo: ReturnType<typeof parseUA>,
  country: string | null,
) {
  return hashFingerprint({
    ua: request.ua,
    platform: "server",
    languages: request.acceptLang ? request.acceptLang.split(",").slice(0, 4) : [],
    hwConcurrency: 0,
    deviceMemory: 0,
    screen: { w: 0, h: 0, cd: 0 },
    tz: "",
    canvasHash: [
      country || "",
      uaInfo.device,
      uaInfo.os,
      uaInfo.browser,
      request.secChUaMobile,
    ].join("|"),
  });
}

function refererHost(ref: string | null | undefined) {
  if (!ref) return null;
  try {
    return new URL(ref).hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return null;
  }
}

function attributionFromRequestUrl() {
  // The request URL on resolveLink is the /r/$code?utm_... URL during SSR
  let urlStr: string | null = null;
  try {
    urlStr = getRequestUrl().toString();
  } catch {
    /* ignore */
  }
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

// HARD bot signatures — near-certain non-human. Silent-cloak immediately.
// Keep this list TIGHT. Anything ambiguous goes in SOFT_BOT_UA_PATTERNS.
const HARD_BOT_UA_PATTERNS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "applebot",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "facebot",
  "facebookexternalhit",
  "facebookcatalog",
  "meta-externalagent",
  "meta-externalfetcher",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "slackbot",
  "discordbot",
  "embedly",
  "pinterestbot",
  "redditbot",
  "tiktokbot",
  "bytespider",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "chrome-lighthouse",
  "pagespeed",
  "gtmetrix",
  "pingdom",
  "uptimerobot",
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "scrapy",
  "go-http-client",
  "java/",
  "okhttp/",
  "ruby/",
  "axios/",
  "node-fetch",
  "got/",
  "libwww-perl",
];

// SOFT bot signatures — suspicious but might be a real user with an unusual UA.
// Adds score only (no silent cloak). User goes through prelander where JS
// fingerprinting (canvas / webdriver / interaction) makes the final call.
const SOFT_BOT_UA_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "preview",
  "validator",
  "monitor",
  "checker",
  "fetcher",
  "scan",
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

  if (!ua) {
    score += 50;
    reasons.push("no-ua");
    hardBot = true;
  }
  // HARD patterns → definite bot, silent cloak
  for (const p of HARD_BOT_UA_PATTERNS) {
    if (ua.includes(p)) {
      score += 80;
      reasons.push(`hardbot:${p}`);
      hardBot = true;
      break;
    }
  }
  // SOFT patterns → suspicion only, prelander will verify with JS
  if (!hardBot) {
    for (const p of SOFT_BOT_UA_PATTERNS) {
      if (ua.includes(p)) {
        score += 25;
        reasons.push(`soft:${p}`);
        break;
      }
    }
  }

  if (!accept.includes("text/html")) {
    score += 25;
    reasons.push("no-html-accept");
  }
  if (!acceptLang) {
    score += 20;
    reasons.push("no-accept-lang");
  }
  if (!acceptEnc.includes("gzip") && !acceptEnc.includes("br")) {
    score += 15;
    reasons.push("no-compression");
  }

  const looksModern = /chrome\/|firefox\/|safari\//.test(ua);
  if (looksModern && !secFetchMode) {
    score += 15;
    reasons.push("no-sec-fetch");
  }
  if (looksModern && !secFetchDest) {
    score += 10;
    reasons.push("no-sec-fetch-dest");
  }
  if (ua.includes("chrome/") && !secChUa) {
    score += 20;
    reasons.push("chrome-no-ch-ua");
  }

  if (cfVerifiedBot === "true") {
    score += 100;
    reasons.push("cf-verified-bot");
    hardBot = true;
  }
  if (cfBotMgmt) {
    const s = parseInt(cfBotMgmt, 10);
    if (!isNaN(s) && s < 30) {
      score += 40;
      reasons.push(`cf-bot-score:${s}`);
    }
    if (!isNaN(s) && s < 5) hardBot = true; // CF extremely confident
  }
  if (cfThreatScore) {
    const s = parseInt(cfThreatScore, 10);
    if (!isNaN(s) && s > 30) {
      score += 30;
      reasons.push(`cf-threat:${s}`);
    }
  }

  if (!referer && secFetchSite === "none" && score === 0) {
    reasons.push("direct-nav");
  }

  return {
    ua,
    isBot: score >= 50,
    hardBot,
    score,
    reasons: reasons.join(","),
    acceptLang,
    secChUa,
    secChUaMobile,
    dnt,
  };
}

const SectionSchema = z.object({
  heading: z.string().max(300),
  body: z.string().max(4000),
});

function rowToVariant(r: {
  id: string;
  slug: string;
  category: string;
  title: string;
  subtitle: string;
  intro: string;
  sections: unknown;
  outro: string;
}): Variant {
  const parsed = z.array(SectionSchema).safeParse(r.sections);
  const sections: VariantSection[] = parsed.success ? parsed.data : [];
  return {
    id: r.id,
    slug: r.slug,
    category: r.category,
    title: r.title,
    subtitle: r.subtitle,
    intro: r.intro,
    sections,
    outro: r.outro,
  };
}

// ---------- Protection config + rate limit ----------

type ProtectionConfig = {
  ip_rate_limit_per_min: number;
  ip_rate_limit_window_sec: number;
  suspicious_action: "block" | "safe_page" | "allow";
  block_threshold_score: number;
  safe_page_message: string;
  signal_weights: Record<string, number>;
  soft_reasons: string[];
  inapp_browser_relief: boolean;
};

const DEFAULT_PROTECTION: ProtectionConfig = {
  ip_rate_limit_per_min: 30,
  ip_rate_limit_window_sec: 60,
  suspicious_action: "safe_page",
  block_threshold_score: 60,
  safe_page_message: "This article is temporarily unavailable. Please check back later.",
  signal_weights: {},
  soft_reasons: [],
  inapp_browser_relief: true,
};

async function loadProtection(): Promise<ProtectionConfig> {
  const { data } = await supabaseAdmin
    .from("bot_protection_config")
    .select(
      "ip_rate_limit_per_min,ip_rate_limit_window_sec,suspicious_action,block_threshold_score,safe_page_message,signal_weights,soft_reasons,inapp_browser_relief",
    )
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_PROTECTION;
  return {
    ...DEFAULT_PROTECTION,
    ...data,
    suspicious_action:
      (data.suspicious_action as ProtectionConfig["suspicious_action"]) ?? "safe_page",
    signal_weights: (data.signal_weights as Record<string, number> | null) ?? {},
    soft_reasons: (data.soft_reasons as string[] | null) ?? [],
    inapp_browser_relief: data.inapp_browser_relief ?? true,
  };
}

// ---------- Phase 3.5: tunable weight adjustments + structured logging ----------

const DEFAULT_REASON_WEIGHTS: Record<string, number> = {
  "no-ua": 50,
  "no-html-accept": 25,
  "no-accept-lang": 20,
  "no-compression": 15,
  "no-sec-fetch": 15,
  "no-sec-fetch-dest": 10,
  "chrome-no-ch-ua": 20,
  "cf-verified-bot": 100,
  "cf-bot-score": 40,
  "cf-threat": 30,
  ua: 60, // matches "ua:<pattern>" prefix
};

// FB/IG/Line in-app browsers strip many of these headers — heavily penalize = false positives.
const INAPP_SOFT_BASES = new Set([
  "no-html-accept",
  "no-accept-lang",
  "no-compression",
  "no-sec-fetch",
  "no-sec-fetch-dest",
  "chrome-no-ch-ua",
]);

const INAPP_UA_RE = /fbav|fban|fbios|instagram|line\/|fb_iab|; wv\)|\(.*; wv\)/i;

function isInAppBrowserUA(ua: string): boolean {
  return INAPP_UA_RE.test(ua);
}

function applyConfigAdjustments(
  a: ReturnType<typeof analyzeRequest>,
  cfg: ProtectionConfig,
): {
  score: number;
  hardBot: boolean;
  inapp: boolean;
  adjustments: Array<{ reason: string; delta: number; rule: string }>;
} {
  const reasons = a.reasons ? a.reasons.split(",").filter(Boolean) : [];
  let score = a.score;
  let hardBot = a.hardBot;
  const adjustments: Array<{ reason: string; delta: number; rule: string }> = [];
  const overrides = cfg.signal_weights || {};
  const soft = new Set(cfg.soft_reasons || []);
  const inapp = isInAppBrowserUA(a.ua);

  for (const reason of reasons) {
    const base = reason.split(":")[0];
    const def = DEFAULT_REASON_WEIGHTS[reason] ?? DEFAULT_REASON_WEIGHTS[base] ?? 0;

    // 1) Admin-marked soft reason: zero it out, clear hard flag if it came from this reason.
    if (soft.has(reason) || soft.has(base)) {
      if (def) {
        score -= def;
        adjustments.push({ reason, delta: -def, rule: "soft" });
      }
      if (base === "no-ua" || base === "ua" || reason === "cf-verified-bot") {
        hardBot = false;
      }
      continue;
    }

    // 2) Explicit weight override (exact key or base key).
    if (overrides[reason] != null || overrides[base] != null) {
      const want = Number(overrides[reason] ?? overrides[base] ?? def);
      const delta = want - def;
      if (delta) {
        score += delta;
        adjustments.push({ reason, delta, rule: "override" });
      }
      continue;
    }

    // 3) In-app browser relief: cut header-based signals to 1/3.
    if (inapp && cfg.inapp_browser_relief && INAPP_SOFT_BASES.has(base)) {
      const cut = Math.floor((def * 2) / 3);
      if (cut) {
        score -= cut;
        adjustments.push({ reason, delta: -cut, rule: "inapp-relief" });
      }
    }
  }

  if (score < 0) score = 0;
  return { score, hardBot, inapp, adjustments };
}

function logRedirectEvent(evt: string, payload: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ evt, ts: new Date().toISOString(), ...payload }));
  } catch {
    // swallow JSON.stringify failures (circular refs etc.) — logging must never throw
  }
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
  return perMinEquivalent > cfg.ip_rate_limit_per_min ? (count ?? 0) : 0;
}

// ---------- Targeting (geo / device / language / time) ----------

type Targeting = {
  allowed_countries?: string[];
  blocked_countries?: string[];
  allowed_devices?: string[]; // "desktop" | "mobile" | "tablet"
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

  if (
    t.allowed_countries?.length &&
    country &&
    !t.allowed_countries.map((c) => c.toUpperCase()).includes(country)
  ) {
    return { blocked: true, reason: `geo-not-allowed:${country}` };
  }
  if (
    t.blocked_countries?.length &&
    country &&
    t.blocked_countries.map((c) => c.toUpperCase()).includes(country)
  ) {
    return { blocked: true, reason: `geo-blocked:${country}` };
  }
  if (
    t.allowed_devices?.length &&
    device &&
    !t.allowed_devices.map((d) => d.toLowerCase()).includes(device)
  ) {
    return { blocked: true, reason: `device-not-allowed:${device}` };
  }
  if (
    t.blocked_devices?.length &&
    device &&
    t.blocked_devices.map((d) => d.toLowerCase()).includes(device)
  ) {
    return { blocked: true, reason: `device-blocked:${device}` };
  }
  if (
    t.allowed_languages?.length &&
    lang &&
    !t.allowed_languages.map((l) => l.toLowerCase()).includes(lang)
  ) {
    return { blocked: true, reason: `lang-not-allowed:${lang}` };
  }
  if (
    t.blocked_languages?.length &&
    lang &&
    t.blocked_languages.map((l) => l.toLowerCase()).includes(lang)
  ) {
    return { blocked: true, reason: `lang-blocked:${lang}` };
  }
  if (
    t.allowed_hours &&
    typeof t.allowed_hours.start === "number" &&
    typeof t.allowed_hours.end === "number"
  ) {
    const h = new Date().getUTCHours();
    const { start, end } = t.allowed_hours;
    const inWindow = start <= end ? h >= start && h <= end : h >= start || h <= end;
    if (!inWindow) return { blocked: true, reason: `hour-blocked:${h}UTC` };
  }
  return { blocked: false, reason: "" };
}

function pickWeightedDestination(
  rows: { url: string; weight: number; is_active: boolean }[],
  fallback: string,
): string {
  const active = rows.filter((r) => r.is_active && r.weight > 0 && r.url);
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
    n = n * 256 + v;
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
  type TimeRuleRow = {
    days_mask: number;
    start_minute: number;
    end_minute: number;
    action: "safe" | "cloak" | "pass";
    timezone: string | null;
    priority: number;
  };
  const { data } = await supabaseAdmin
    .from("link_time_rules")
    .select("days_mask,start_minute,end_minute,action,timezone,priority")
    .eq("link_id", linkId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (!data || data.length === 0) return null;
  const { pickActiveTimeRule } = await import("@/lib/time-rule-eval");
  return pickActiveTimeRule(data as TimeRuleRow[]);
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
      const exact = data.find(
        (r) => r.device === device.toLowerCase() && r.os.toLowerCase() === osLower,
      );
      if (exact) return exact.adsterra_url;
      const devAny = data.find((r) => r.device === device.toLowerCase() && r.os === "any");
      if (devAny) return devAny.adsterra_url;
      const anyAny = data.find((r) => r.device === "any" && r.os === "any");
      if (anyAny) return anyAny.adsterra_url;
    }
  }
  return null;
}

// ───────────────────────────── Admin rotation (every N user clicks → M admin clicks) ─────────────────────────────
let _rotCfgCache: {
  at: number;
  cfg: { enabled: boolean; url: string | null; user: number; admin: number };
} | null = null;
async function loadRotationConfig() {
  if (_rotCfgCache && Date.now() - _rotCfgCache.at < 30_000) return _rotCfgCache.cfg;
  const { data } = await supabaseAdmin
    .from("ad_rotation_config")
    .select("rotation_enabled, rotation_admin_url, rotation_user_clicks, rotation_admin_clicks")
    .eq("id", 1)
    .maybeSingle();
  const cfg = {
    enabled: !!data?.rotation_enabled && !!data?.rotation_admin_url,
    url: (data?.rotation_admin_url as string | null) ?? null,
    user: Math.max(1, data?.rotation_user_clicks ?? 1000),
    admin: Math.max(0, data?.rotation_admin_clicks ?? 100),
  };
  _rotCfgCache = { at: Date.now(), cfg };
  return cfg;
}

/** Returns admin rotation URL if this click should go to admin, else null. */
async function maybeRotateToAdmin(
  currentClickCount: number | null | undefined,
): Promise<string | null> {
  const cfg = await loadRotationConfig();
  if (!cfg.enabled || !cfg.url || cfg.admin <= 0) return null;
  const total = cfg.user + cfg.admin;
  const click = Math.max(1, currentClickCount ?? 0);
  const pos = ((click - 1) % total) + 1; // 1..total
  return pos > cfg.user ? cfg.url : null;
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
    await supabaseAdmin
      .from("duplicate_clicks")
      .update({ last_seen: new Date().toISOString(), hit_count: existing.hit_count + 1 })
      .eq("ip", ip)
      .eq("link_id", linkId);
  } else {
    await supabaseAdmin.from("duplicate_clicks").insert({ ip, link_id: linkId, hit_count: 1 });
  }
}

function asnFromHeaders(): number | null {
  const raw = getRequestHeader("cf-connecting-asn") || getRequestHeader("cf-asn") || "";
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// ---------- Server functions ----------

// Fallback ad URL used when a publisher exceeds their package click quota.
// Their traffic is silently rerouted here (our own monetization) until they upgrade.
const OVER_QUOTA_FALLBACK_URL =
  "https://consciousdunkvastly.com/qdg9kcmh?key=615ddb2bcc3fac3d25f1df64465f1da7";

/**
 * Atomically increments the link owner's click counter and returns the
 * fallback ad URL if they are over their package quota. Returns null when
 * the user is still within quota (caller should use the normal destination).
 */
async function enforceUserQuota(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc("check_and_increment_user_clicks", {
      p_user_id: userId,
    });
    if (error) {
      console.warn("[redirect] quota rpc failed", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.exceeded) {
      logRedirectEvent("quota.exceeded", {
        userId,
        clicksUsed: row.used,
        clickQuota: row.quota,
      });
      return OVER_QUOTA_FALLBACK_URL;
    }
    return null;
  } catch (e) {
    console.warn("[redirect] quota check threw", e);
    return null;
  }
}

export const resolveLink = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const aRaw = analyzeRequest();
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for") || "";
    const country = getRequestHeader("cf-ipcountry") || null;
    const referer = getRequestHeader("referer") || "";

    // Parallel: protection config + link lookup are independent
    const [cfg, linkRes] = await Promise.all([
      loadProtection(),
      supabaseAdmin
        .from("links")
        .select(
          "id, user_id, status, targeting, destination_url, duplicate_protection, duplicate_window_minutes, brand_logo_url, brand_name, brand_tagline, brand_color, clicks_count",
        )
        .eq("short_code", data.code)
        .maybeSingle(),
    ]);
    if (linkRes.error) {
      console.error("[redirect] link lookup failed", {
        code: data.code,
        message: linkRes.error.message,
        details: linkRes.error.details,
        hint: linkRes.error.hint,
      });
      throw new Error(`Redirect lookup failed: ${linkRes.error.message}`);
    }
    const link = linkRes.data;

    if (!link || link.status !== "active") {
      logRedirectEvent("resolve.not_found", { code: data.code, ip, country });
      return { found: false as const };
    }

    // Apply admin-tuned signal_weights, soft_reasons, and FB/IG in-app browser relief.
    const adj = applyConfigAdjustments(aRaw, cfg);
    const a = { ...aRaw, score: adj.score, hardBot: adj.hardBot, isBot: adj.score >= 50 };

    logRedirectEvent("resolve.start", {
      code: data.code,
      ip,
      country,
      ua: aRaw.ua.slice(0, 120),
      rawScore: aRaw.score,
      adjustedScore: adj.score,
      hardBot: adj.hardBot,
      inapp: adj.inapp,
      adjustments: adj.adjustments,
      reasons: aRaw.reasons,
    });

    // Targeting check (geo/device/lang/time)
    const uaInfoT = parseUA(a.ua);
    const targetingCheck = checkTargeting(link.targeting as Targeting | null, {
      country,
      device: uaInfoT.device,
      lang: primaryLang(a.acceptLang),
    });

    // Parallel: IP rate + FB blocklist + referer rule + time rule are all independent
    const asn = asnFromHeaders();
    const refHost = refererHost(referer);
    const [rateHits, fbHitRaw, refAction, timeAction] = await Promise.all([
      ipExceedsRate(ip, cfg),
      checkFbBlocklist(ip, asn),
      checkRefererRule(refHost),
      checkTimeRule(link.id),
    ]);
    const rateLimited = rateHits > 0;

    // Aggregate suspicion: pre-flag bot OR rate-limited OR over hard threshold OR targeting block
    const suspicious =
      a.isBot || rateLimited || a.score >= cfg.block_threshold_score || targetingCheck.blocked;

    const suspicionReasons = [
      a.reasons,
      rateLimited ? `rate:${rateHits}/${cfg.ip_rate_limit_window_sec}s` : "",
      targetingCheck.blocked ? `target:${targetingCheck.reason}` : "",
    ]
      .filter(Boolean)
      .join(",");

    // Targeting block: also serve silent prelander instead of giving away that we filtered
    const effectiveAction = targetingCheck.blocked ? "safe_page" : cfg.suspicious_action;

    // Hard block path — only when admin explicitly chose "block"
    if (suspicious && effectiveAction === "block") {
      const uaInfoB = parseUA(a.ua);
      const attrB = attributionFromRequestUrl();
      const serverFpHashB = await serverFingerprintHash(a, uaInfoB, country);
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
        bot_score: Math.min(
          a.score + (rateLimited ? 60 : 0) + (targetingCheck.blocked ? 100 : 0),
          500,
        ),
        fingerprint_hash: serverFpHashB,
        signals: phase3Signals({
          source: "blocked",
          request: a,
          reasons: suspicionReasons.split(",").filter(Boolean),
          rateHits,
          targetBlocked: targetingCheck.blocked,
          targetReason: targetingCheck.reason,
        }),
        challenge_passed: false,
        ...attrB,
      });
      await supabaseAdmin.rpc("increment_link_bot_clicks", { p_link_id: link.id });
      logRedirectEvent("resolve.decision", {
        code: data.code,
        branch: "blocked",
        verifyExpected: false,
        score: a.score,
        reasons: suspicionReasons,
      });
      return {
        found: true as const,
        blocked: true as const,
        safe: false as const,
        message: cfg.safe_page_message,
      };
    }

    const uaInfo = parseUA(a.ua);
    const attr = attributionFromRequestUrl();
    // IMPORTANT: Facebook's mobile in-app browser routes REAL users through
    // FB's own IP ranges. If the UA looks like a real browser (Chrome/Safari/
    // Firefox) and has no scraper signal, do NOT cloak based on IP alone.
    const fbHit = fbHitRaw && a.hardBot ? fbHitRaw : null;
    const refSafe = refAction === "safe" || refAction === "cloak";
    const timeSafe = timeAction === "safe" || timeAction === "cloak";
    const silentBot = a.hardBot || Boolean(fbHit) || refSafe || timeSafe || targetingCheck.blocked;
    const defenseReasons = [
      suspicionReasons,
      fbHit || "",
      refAction ? `referer:${refAction}:${refHost}` : "",
      timeAction ? `time:${timeAction}` : "",
    ]
      .filter(Boolean)
      .join(",");

    // requireVerify: traffic looks plausibly human but has at least one
    // suspicion signal (mid-score). Route through the prelander so the client
    // fingerprint layer (canvas / webdriver / screen / interaction) can run.
    // Clean signal (score === 0) keeps the zero-friction direct redirect.
    const requireVerify = !silentBot && a.score > 0;

    if (!silentBot && !requireVerify) {
      let duplicateClick = false;
      if (link.duplicate_protection) {
        const dup = await isDuplicateClick(ip, link.id, link.duplicate_window_minutes ?? 30);
        if (dup) {
          await recordDuplicateClick(ip, link.id);
          duplicateClick = true;
        }
      }

      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country,
        user_agent: a.ua || null,
        referer: referer || null,
        is_bot: false,
        bot_reason: ["direct", duplicateClick ? "duplicate" : "", defenseReasons]
          .filter(Boolean)
          .join(":"),
        device: uaInfo.device,
        os: uaInfo.os,
        browser: uaInfo.browser,
        variant: null,
        bot_score: Math.min(a.score, 500),
        fingerprint_hash: await serverFingerprintHash(a, uaInfo, country),
        signals: phase3Signals({
          source: "direct",
          request: a,
          reasons: defenseReasons.split(",").filter(Boolean),
          duplicateClick,
        }),
        challenge_passed: true,
        ...attr,
      });

      if (!duplicateClick) {
        await supabaseAdmin.rpc("increment_link_clicks", { p_link_id: link.id });
      }
      if (link.duplicate_protection && !duplicateClick) await recordDuplicateClick(ip, link.id);

      // Admin rotation: every N user clicks, route the next M clicks to the admin link.
      if (!duplicateClick) {
        const rotated = await maybeRotateToAdmin((link.clicks_count ?? 0) + 1);
        if (rotated) {
          logRedirectEvent("resolve.decision", {
            code: data.code,
            branch: "direct",
            verifyExpected: false,
            score: a.score,
            destination: rotated,
            duplicateClick,
            rotated: true,
          });
          return {
            found: true as const,
            blocked: false as const,
            direct: true as const,
            redirectTo: rotated,
          };
        }
      }

      // Per-publisher click quota: if owner is over their package limit,
      // silently route this click to our fallback ad network.
      if (!duplicateClick) {
        const fallback = await enforceUserQuota(link.user_id);
        if (fallback) {
          logRedirectEvent("resolve.decision", {
            code: data.code,
            branch: "direct",
            verifyExpected: false,
            score: a.score,
            destination: fallback,
            duplicateClick,
            overQuota: true,
          });
          return {
            found: true as const,
            blocked: false as const,
            direct: true as const,
            redirectTo: fallback,
          };
        }
      }

      const geoDev = await pickGeoDeviceDestination(link.id, country, uaInfo.device, uaInfo.os);
      if (geoDev) {
        logRedirectEvent("resolve.decision", {
          code: data.code,
          branch: "direct",
          verifyExpected: false,
          score: a.score,
          destination: geoDev,
          duplicateClick,
        });
        return {
          found: true as const,
          blocked: false as const,
          direct: true as const,
          redirectTo: geoDev,
        };
      }
      const { data: destRows } = await supabaseAdmin
        .from("link_destinations")
        .select("url,weight,is_active")
        .eq("link_id", link.id);
      const destination = pickWeightedDestination(destRows ?? [], link.destination_url);
      logRedirectEvent("resolve.decision", {
        code: data.code,
        branch: "direct",
        verifyExpected: false,
        score: a.score,
        destination,
        duplicateClick,
      });
      return {
        found: true as const,
        blocked: false as const,
        direct: true as const,
        redirectTo: destination,
      };
    }

    // NOTE: silent bot path renders a real prelander variant, but never
    // auto-triggers verifyHuman and never reveals the real destination.

    // Load active variants, then filter to country + device targeting.
    // Priority order: (country match + device match) > (country match) >
    // (device match) > (untargeted defaults). Empty country_codes = global.
    const { data: variantRows } = await supabaseAdmin
      .from("prelander_variants")
      .select("id,slug,category,title,subtitle,intro,sections,outro,country_codes,device")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const allRows = variantRows ?? [];
    const userDevice = uaInfo.device; // 'mobile' | 'desktop' | 'tablet'
    const ctry = (country || "").toUpperCase();

    type VRow = (typeof allRows)[number];
    const matchCountry = (r: VRow) =>
      !r.country_codes || r.country_codes.length === 0
        ? false
        : r.country_codes.map((c: string) => c.toUpperCase()).includes(ctry);
    const matchDevice = (r: VRow) => r.device !== "any" && r.device === userDevice;
    const isGlobal = (r: VRow) =>
      (!r.country_codes || r.country_codes.length === 0) && r.device === "any";

    let pool: VRow[] = allRows.filter((r) => matchCountry(r) && matchDevice(r));
    if (pool.length === 0) pool = allRows.filter((r) => matchCountry(r) && r.device === "any");
    if (pool.length === 0)
      pool = allRows.filter(
        (r) => matchDevice(r) && (!r.country_codes || r.country_codes.length === 0),
      );
    if (pool.length === 0) pool = allRows.filter(isGlobal);
    if (pool.length === 0) pool = allRows; // ultimate fallback

    const variants: Variant[] = pool.map(rowToVariant);
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
        let total = 0,
          humans = 0;
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

    // For silentBot we log a click here (verifyHuman won't run for them).
    // For requireVerify we SKIP the insert — verifyHuman inserts on completion
    // so we get exactly one click row per visit and don't inflate counters.
    if (silentBot) {
      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country,
        user_agent: a.ua || null,
        referer: referer || null,
        is_bot: true,
        bot_reason: `silent:${defenseReasons}`,
        device: uaInfo.device,
        os: uaInfo.os,
        browser: uaInfo.browser,
        variant: chosenVariant.slug,
        bot_score: Math.min(
          a.score + (rateLimited ? 60 : 0) + (targetingCheck.blocked ? 100 : 0),
          500,
        ),
        fingerprint_hash: await serverFingerprintHash(a, uaInfo, country),
        signals: phase3Signals({
          source: "silent",
          request: a,
          reasons: defenseReasons.split(",").filter(Boolean),
          rateHits,
          targetBlocked: targetingCheck.blocked,
          targetReason: targetingCheck.reason,
          fbHit,
          refAction,
          timeAction,
        }),
        challenge_passed: false,
        ...attr,
      });

      await supabaseAdmin.rpc("increment_link_bot_clicks", { p_link_id: link.id });
    }

    logRedirectEvent("resolve.decision", {
      code: data.code,
      branch: silentBot ? "silent" : "verify",
      verifyExpected: !silentBot, // verifyHuman should be called when this is true
      score: a.score,
      reasons: defenseReasons,
      variant: chosenVariant.slug,
    });

    return {
      found: true as const,
      blocked: false as const,
      safe: false as const,
      silentBot,
      linkId: link.id,
      variant: chosenVariant,
      preFlagBot: a.isBot,
      serverScore: a.score,
      branding: {
        logoUrl: link.brand_logo_url ?? null,
        brandName: link.brand_name ?? null,
        tagline: link.brand_tagline ?? null,
        color: link.brand_color ?? null,
      },
    };
  });

export const verifyHuman = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const aRaw = analyzeRequest();
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for") || "";

    logRedirectEvent("verify.start", {
      code: data.code,
      ip,
      ua: aRaw.ua.slice(0, 120),
      rawScore: aRaw.score,
      reasons: aRaw.reasons,
    });

    const { data: link, error: linkError } = await supabaseAdmin
      .from("links")
      .select(
        "id, user_id, destination_url, status, targeting, duplicate_protection, duplicate_window_minutes, clicks_count",
      )
      .eq("short_code", data.code)
      .maybeSingle();

    if (linkError) {
      console.error("[redirect] verify lookup failed", {
        code: data.code,
        message: linkError.message,
        details: linkError.details,
        hint: linkError.hint,
      });
      throw new Error(`Redirect verify lookup failed: ${linkError.message}`);
    }

    if (!link || link.status !== "active") {
      logRedirectEvent("verify.decision", { code: data.code, branch: "not-found" });
      return { ok: false as const, reason: "not-found" };
    }

    // Load config + apply tunable weight adjustments (matches resolveLink behaviour).
    const cfgEarly = await loadProtection();
    const adj = applyConfigAdjustments(aRaw, cfgEarly);
    const a = { ...aRaw, score: adj.score, hardBot: adj.hardBot, isBot: adj.score >= 50 };

    // Parallel: FB blocklist + referer rule + time rule are independent
    const asn = asnFromHeaders();
    const refHost = refererHost(getRequestHeader("referer"));
    const [fbHitRaw, refAction, timeAction] = await Promise.all([
      checkFbBlocklist(ip, asn),
      checkRefererRule(refHost),
      checkTimeRule(link.id),
    ]);
    // Same fix as resolveLink: only honor FB IP/ASN hit when UA itself is a
    // known scraper. Real users in FB in-app browser share these IP ranges.
    const fbHit = fbHitRaw && a.hardBot ? fbHitRaw : null;
    if (
      fbHit ||
      refAction === "safe" ||
      refAction === "cloak" ||
      timeAction === "safe" ||
      timeAction === "cloak"
    ) {
      const uaInfo = parseUA(a.ua);
      const country = getRequestHeader("cf-ipcountry") || null;
      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country,
        user_agent: a.ua || null,
        referer: getRequestHeader("referer") || null,
        is_bot: true,
        bot_reason: `verify-silent:${fbHit || ""}${refAction ? `|referer:${refAction}:${refHost}` : ""}${timeAction ? `|time:${timeAction}` : ""}`,
        device: uaInfo.device,
        os: uaInfo.os,
        browser: uaInfo.browser,
        variant: data.variant,
        bot_score: Math.min(a.score, 500),
        fingerprint_hash: await serverFingerprintHash(a, uaInfo, country),
        signals: phase3Signals({
          source: "verify-silent",
          request: a,
          reasons: [
            fbHit || "",
            refAction ? `referer:${refAction}:${refHost}` : "",
            timeAction ? `time:${timeAction}` : "",
          ],
          fbHit,
          refAction,
          timeAction,
        }),
        challenge_passed: false,
      });
      await supabaseAdmin.rpc("increment_link_bot_clicks", { p_link_id: link.id });
      logRedirectEvent("verify.decision", {
        code: data.code,
        branch: "verify-silent",
        score: a.score,
        fbHit,
        refAction,
        timeAction,
      });
      return { ok: false as const, reason: "blocklist" };
    }

    // Batch-1: Duplicate click protection
    let duplicateClick = false;
    if (link.duplicate_protection) {
      const dup = await isDuplicateClick(ip, link.id, link.duplicate_window_minutes ?? 30);
      if (dup) {
        await recordDuplicateClick(ip, link.id);
        duplicateClick = true;
      }
    }

    // Re-use config loaded early in handler for adjustments
    const cfg = cfgEarly;
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

    if (fp.webdriver) {
      score += 80;
      reasons.push("webdriver");
    }
    if (fp.ua.toLowerCase().includes("headless")) {
      score += 80;
      reasons.push("fp-headless");
    }
    if (!fp.languages.length) {
      score += 30;
      reasons.push("no-languages");
    }
    if (fp.screen.w < 200 || fp.screen.h < 200) {
      score += 50;
      reasons.push("tiny-screen");
    }
    if (fp.screen.cd === 0) {
      score += 30;
      reasons.push("no-colordepth");
    }
    if (fp.hwConcurrency === 0) {
      score += 20;
      reasons.push("no-hw-concurrency");
    }
    if (!fp.tz) {
      score += 20;
      reasons.push("no-tz");
    }
    if (fp.canvasHash === "blocked" || fp.canvasHash.length < 4) {
      score += 25;
      reasons.push("canvas-blocked");
    }
    const fpUaLower = fp.ua.toLowerCase();
    const looksLikeRealBrowser =
      /chrome\/|crios\/|safari\/|firefox\/|fxios\/|edg\//.test(fpUaLower) &&
      !a.hardBot &&
      !fp.webdriver &&
      fp.languages.length > 0 &&
      fp.screen.w >= 200 &&
      fp.screen.h >= 200;

    if (
      fpUaLower.includes("chrome/") &&
      !fp.hasChrome &&
      !/wv\)|; wv|fbav|instagram|line\//i.test(fp.ua)
    ) {
      score += 20;
      reasons.push("chrome-spoof");
    }
    if (/mobile|android|iphone/i.test(fp.ua) && fp.touchPoints === 0) {
      score += 30;
      reasons.push("mobile-no-touch");
    }

    const interactions = fp.mouse + fp.scroll + fp.key + fp.touch;
    if (interactions === 0) {
      score += 10;
      reasons.push("no-interaction");
    }
    if (fp.timeOnPage < 100) {
      score += 10;
      reasons.push("too-fast");
    }

    if (fp.ua && a.ua && fp.ua.toLowerCase() !== a.ua) {
      score += 25;
      reasons.push("ua-mismatch");
    }

    // Phase 3: stable fingerprint hash + repeat-from-different-IPs penalty
    const fpHash = await hashFingerprint(fp);
    const repeatIps = await repeatFingerprintHits(fpHash, ip, 10);
    if (repeatIps >= 2) {
      score += 25 + Math.min(repeatIps, 10) * 5; // 35..75
      reasons.push(`fp-repeat:${repeatIps}ip/10m`);
    }

    const isBot = a.hardBot || (!looksLikeRealBrowser && score >= cfg.block_threshold_score);
    const challengePassed = !isBot && interactions > 0 && fp.timeOnPage >= 100;

    const signals = {
      webdriver: fp.webdriver,
      languages: fp.languages.length,
      screen: fp.screen,
      hw: fp.hwConcurrency,
      mem: fp.deviceMemory,
      tz: fp.tz,
      plugins: fp.plugins,
      touchPoints: fp.touchPoints,
      hasChrome: fp.hasChrome,
      mouse: fp.mouse,
      scroll: fp.scroll,
      key: fp.key,
      touch: fp.touch,
      timeOnPage: fp.timeOnPage,
      canvasHash: fp.canvasHash,
      repeatIps,
      reasons,
    };

    const attr2 = attributionFromReferer();
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: a.ua || null,
      referer: getRequestHeader("referer") || null,
      is_bot: isBot,
      bot_reason: `verify:${duplicateClick ? "duplicate," : ""}${reasons.join(",")}|score:${score}`,
      device: uaInfo2.device,
      os: uaInfo2.os,
      browser: uaInfo2.browser,
      variant: data.variant,
      bot_score: Math.min(score, 500),
      fingerprint_hash: fpHash,
      signals,
      challenge_passed: challengePassed,
      ...attr2,
    });

    if (isBot) {
      await supabaseAdmin.rpc("increment_link_bot_clicks", { p_link_id: link.id });
      logRedirectEvent("verify.decision", {
        code: data.code,
        branch: "bot-detected",
        score,
        reasons,
      });
      return { ok: false as const, reason: "bot-detected" };
    }

    if (!duplicateClick) {
      await supabaseAdmin.rpc("increment_link_clicks", { p_link_id: link.id });
    }

    // Record this IP so subsequent quick re-clicks are deduped
    if (link.duplicate_protection) {
      await recordDuplicateClick(ip, link.id);
    }

    // Admin rotation: every N user clicks, route the next M clicks to the admin link.
    if (!duplicateClick) {
      const rotated = await maybeRotateToAdmin((link.clicks_count ?? 0) + 1);
      if (rotated) {
        logRedirectEvent("verify.decision", {
          code: data.code,
          branch: "human-passed",
          score,
          duplicateClick,
          destination: rotated,
          rotated: true,
        });
        return { ok: true as const, destination: rotated };
      }
    }

    // Per-publisher click quota enforcement (verifyHuman path).
    if (!duplicateClick) {
      const fallback = await enforceUserQuota(link.user_id);
      if (fallback) {
        logRedirectEvent("verify.decision", {
          code: data.code,
          branch: "human-passed",
          score,
          duplicateClick,
          destination: fallback,
          overQuota: true,
        });
        return { ok: true as const, destination: fallback };
      }
    }

    // Final destination priority (cascade):
    //   1) Geo / device-OS specific Adsterra link (per-link rules)
    //   2) Weighted rotator over link_destinations
    //   3) Plain destination_url (THE Adsterra link the user pasted)
    const geoDev = await pickGeoDeviceDestination(link.id, country, uaInfo2.device, uaInfo2.os);
    if (geoDev) {
      logRedirectEvent("verify.decision", {
        code: data.code,
        branch: "human-passed",
        score,
        duplicateClick,
        destination: geoDev,
      });
      return { ok: true as const, destination: geoDev };
    }

    const { data: destRows } = await supabaseAdmin
      .from("link_destinations")
      .select("url,weight,is_active")
      .eq("link_id", link.id);
    const destination = pickWeightedDestination(destRows ?? [], link.destination_url);

    logRedirectEvent("verify.decision", {
      code: data.code,
      branch: "human-passed",
      score,
      duplicateClick,
      destination,
    });
    return { ok: true as const, destination };
  });
