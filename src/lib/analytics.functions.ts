import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Click = {
  id: string;
  link_id: string;
  country: string | null;
  ua: string | null;
  is_bot: boolean;
  routed_to: string;
  bot_reason?: string | null;
  created_at: string;
  user_agent?: string | null;
  variant?: string | null;
};

// CRITICAL: Display 80% of real bot count so users don't panic.
// Real numbers stay in DB; only DISPLAY is reduced.
const BOT_DISPLAY_RATIO = 0.8;
const hideBots = (real: number) => Math.floor(real * BOT_DISPLAY_RATIO);

async function selectClicks(supabase: any, linkIds: string[], sevenDaysAgo: string) {
  const legacy = await supabase
    .from("clicks")
    .select("id, link_id, country, user_agent, is_bot, bot_reason, variant, created_at")
    .in("link_id", linkIds)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50000);

  if (!legacy.error) {
    return {
      data: (legacy.data ?? []).map((c: Click) => ({
        ...c,
        ua: c.user_agent ?? null,
        routed_to: c.variant ?? (c.is_bot ? "safe" : "offer"),
      })),
      error: null,
    };
  }

  const modern = await supabase
    .from("clicks")
    .select("id, link_id, country, ua, is_bot, bot_reason, routed_to, created_at")
    .in("link_id", linkIds)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50000);
  return modern.error ? legacy : modern;
}

function deviceFromUA(ua: string | null): "Mobile" | "Desktop" | "Tablet" | "Other" {
  if (!ua) return "Other";
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return "Tablet";
  if (/mobi|android|iphone|ipod|phone|webos/.test(u)) return "Mobile";
  if (/windows|macintosh|linux|x11|cros/.test(u)) return "Desktop";
  return "Other";
}

function osFromUA(ua: string | null): { name: string; slug: string } {
  if (!ua) return { name: "Unknown", slug: "unknown" };
  const u = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(u)) return { name: "iOS", slug: "ios" };
  if (/android/.test(u)) return { name: "Android", slug: "android" };
  if (/windows nt/.test(u)) return { name: "Windows", slug: "windows" };
  if (/mac os x|macintosh/.test(u)) return { name: "macOS", slug: "macos" };
  if (/cros/.test(u)) return { name: "ChromeOS", slug: "googlechrome" };
  if (/linux|x11/.test(u)) return { name: "Linux", slug: "linux" };
  return { name: "Other", slug: "unknown" };
}

function browserFromUA(ua: string | null): { name: string; slug: string; color: string } {
  if (!ua) return { name: "Unknown", slug: "unknown", color: "94a3b8" };
  const u = ua.toLowerCase();
  if (u.includes("edg/")) return { name: "Edge", slug: "microsoftedge", color: "0078D4" };
  if (u.includes("opr/") || u.includes("opera")) return { name: "Opera", slug: "opera", color: "FF1B2D" };
  if (u.includes("samsungbrowser")) return { name: "Samsung Internet", slug: "samsung", color: "1428A0" };
  if (u.includes("ucbrowser")) return { name: "UC Browser", slug: "ucbrowser", color: "F8B500" };
  if (u.includes("brave")) return { name: "Brave", slug: "brave", color: "FB542B" };
  if (u.includes("firefox")) return { name: "Firefox", slug: "firefoxbrowser", color: "FF7139" };
  if (u.includes("fban") || u.includes("fbav")) return { name: "Facebook App", slug: "facebook", color: "1877F2" };
  if (u.includes("instagram")) return { name: "Instagram App", slug: "instagram", color: "E4405F" };
  if (u.includes("chrome")) return { name: "Chrome", slug: "googlechrome", color: "4285F4" };
  if (u.includes("safari")) return { name: "Safari", slug: "safari", color: "0FB5EE" };
  return { name: "Other", slug: "unknown", color: "94a3b8" };
}

const COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: "🇺🇸", name: "United States" }, GB: { flag: "🇬🇧", name: "United Kingdom" },
  DE: { flag: "🇩🇪", name: "Germany" },       FR: { flag: "🇫🇷", name: "France" },
  CA: { flag: "🇨🇦", name: "Canada" },        IN: { flag: "🇮🇳", name: "India" },
  BD: { flag: "🇧🇩", name: "Bangladesh" },    PK: { flag: "🇵🇰", name: "Pakistan" },
  JP: { flag: "🇯🇵", name: "Japan" },         CN: { flag: "🇨🇳", name: "China" },
  BR: { flag: "🇧🇷", name: "Brazil" },        AU: { flag: "🇦🇺", name: "Australia" },
  NL: { flag: "🇳🇱", name: "Netherlands" },   IT: { flag: "🇮🇹", name: "Italy" },
  ES: { flag: "🇪🇸", name: "Spain" },         MX: { flag: "🇲🇽", name: "Mexico" },
  RU: { flag: "🇷🇺", name: "Russia" },        ID: { flag: "🇮🇩", name: "Indonesia" },
  PH: { flag: "🇵🇭", name: "Philippines" },   NG: { flag: "🇳🇬", name: "Nigeria" },
  ZA: { flag: "🇿🇦", name: "South Africa" },  SE: { flag: "🇸🇪", name: "Sweden" },
  PL: { flag: "🇵🇱", name: "Poland" },        TR: { flag: "🇹🇷", name: "Turkey" },
  KR: { flag: "🇰🇷", name: "South Korea" },   VN: { flag: "🇻🇳", name: "Vietnam" },
  AE: { flag: "🇦🇪", name: "UAE" },           SA: { flag: "🇸🇦", name: "Saudi Arabia" },
  EG: { flag: "🇪🇬", name: "Egypt" },         AR: { flag: "🇦🇷", name: "Argentina" },
  CO: { flag: "🇨🇴", name: "Colombia" },      CL: { flag: "🇨🇱", name: "Chile" },
  TH: { flag: "🇹🇭", name: "Thailand" },      MY: { flag: "🇲🇾", name: "Malaysia" },
  SG: { flag: "🇸🇬", name: "Singapore" },     CH: { flag: "🇨🇭", name: "Switzerland" },
  BE: { flag: "🇧🇪", name: "Belgium" },       AT: { flag: "🇦🇹", name: "Austria" },
  PT: { flag: "🇵🇹", name: "Portugal" },      IE: { flag: "🇮🇪", name: "Ireland" },
  NO: { flag: "🇳🇴", name: "Norway" },        DK: { flag: "🇩🇰", name: "Denmark" },
  FI: { flag: "🇫🇮", name: "Finland" },       NZ: { flag: "🇳🇿", name: "New Zealand" },
};

export const getAnalyticsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: links, error: linkErr } = await supabase
      .from("links").select("id, short_code, title").eq("user_id", userId);
    if (linkErr) throw new Error(linkErr.message);

    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) return empty();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: clicksRaw, error: clickErr } = await selectClicks(supabase, linkIds, sevenDaysAgo);
    if (clickErr) throw new Error(clickErr.message);

    const clicks = (clicksRaw ?? []) as Click[];
    const now = Date.now();

    // --- KPIs (with bot hiding) ---
    const total = clicks.length;
    const realBots = clicks.filter((c) => c.is_bot).length;
    const humans = total - realBots;
    const displayBots = hideBots(realBots);
    const displayTotal = humans + displayBots;
    const last60s = clicks.filter((c) => now - new Date(c.created_at).getTime() < 60_000).length;
    const cps = (last60s / 60).toFixed(1);
    const last24h = clicks.filter((c) => now - new Date(c.created_at).getTime() < 86_400_000).length;
    const last24hHumans = clicks.filter((c) => !c.is_bot && now - new Date(c.created_at).getTime() < 86_400_000).length;

    // --- 24h series — humans only (cleaner chart) ---
    const hourBuckets = new Array(24).fill(0);
    clicks
      .filter((c) => !c.is_bot && now - new Date(c.created_at).getTime() < 86_400_000)
      .forEach((c) => {
        const hoursAgo = Math.floor((now - new Date(c.created_at).getTime()) / 3_600_000);
        if (hoursAgo >= 0 && hoursAgo < 24) hourBuckets[23 - hoursAgo]++;
      });

    // --- 7d x 24h heatmap ---
    const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    clicks.forEach((c) => {
      const t = new Date(c.created_at).getTime();
      const dayIdx = 6 - Math.floor((now - t) / 86_400_000);
      const hour = new Date(c.created_at).getUTCHours();
      if (dayIdx >= 0 && dayIdx < 7) heatmap[dayIdx][hour]++;
    });
    const heatMax = Math.max(1, ...heatmap.flat());

    // --- Top countries (with full name + ISO for flag CDN) ---
    const countryMap = new Map<string, { total: number; humans: number; bots: number }>();
    clicks.forEach((c) => {
      const k = (c.country ?? "??").toUpperCase();
      const cur = countryMap.get(k) ?? { total: 0, humans: 0, bots: 0 };
      cur.total++;
      if (c.is_bot) cur.bots++; else cur.humans++;
      countryMap.set(k, cur);
    });
    const topCountries = [...countryMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([code, v]) => {
        const meta = COUNTRIES[code] ?? { flag: "🌐", name: code };
        return {
          code, flag: meta.flag, name: meta.name,
          count: v.humans + hideBots(v.bots),
          humans: v.humans,
          bots: hideBots(v.bots),
          pct: displayTotal ? Math.round(((v.humans + hideBots(v.bots)) / displayTotal) * 1000) / 10 : 0,
        };
      });

    // --- Devices ---
    const deviceMap = new Map<string, number>();
    clicks.filter((c) => !c.is_bot).forEach((c) => {
      const d = deviceFromUA(c.ua);
      deviceMap.set(d, (deviceMap.get(d) ?? 0) + 1);
    });
    const totalHumansForDev = Math.max(1, humans);
    const devices = [...deviceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name, count,
        pct: Math.round((count / totalHumansForDev) * 1000) / 10,
      }));

    // --- Browsers (with brand slug + color) ---
    const browserMap = new Map<string, { count: number; slug: string; color: string }>();
    clicks.filter((c) => !c.is_bot).forEach((c) => {
      const b = browserFromUA(c.ua);
      const cur = browserMap.get(b.name) ?? { count: 0, slug: b.slug, color: b.color };
      cur.count++;
      browserMap.set(b.name, cur);
    });
    const browsers = [...browserMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => ({
        name, slug: v.slug, color: v.color,
        count: v.count,
        pct: Math.round((v.count / totalHumansForDev) * 1000) / 10,
      }));

    // --- Operating Systems ---
    const osMap = new Map<string, { count: number; slug: string }>();
    clicks.filter((c) => !c.is_bot).forEach((c) => {
      const o = osFromUA(c.ua);
      const cur = osMap.get(o.name) ?? { count: 0, slug: o.slug };
      cur.count++;
      osMap.set(o.name, cur);
    });
    const operatingSystems = [...osMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, v]) => ({
        name, slug: v.slug, count: v.count,
        pct: Math.round((v.count / totalHumansForDev) * 1000) / 10,
      }));

    // --- Bot reason breakdown (display reduced) ---
    const reasonMap = new Map<string, number>();
    clicks.filter((c) => c.is_bot).forEach((c) => {
      const r = (c.bot_reason ?? "unknown").split(":")[0];
      reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
    });
    const botReasons = [...reasonMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, real]) => ({
        name: friendlyReason(name),
        count: hideBots(real),
        pct: realBots ? Math.round((real / realBots) * 1000) / 10 : 0,
      }));

    // --- Top links ---
    const linkMap = new Map<string, { total: number; humans: number; bots: number }>();
    clicks.forEach((c) => {
      const cur = linkMap.get(c.link_id) ?? { total: 0, humans: 0, bots: 0 };
      cur.total++;
      if (c.is_bot) cur.bots++; else cur.humans++;
      linkMap.set(c.link_id, cur);
    });
    const linkLookup = new Map((links ?? []).map((l) => [l.id, l]));
    const topLinks = [...linkMap.entries()]
      .sort((a, b) => b[1].humans - a[1].humans)
      .slice(0, 6)
      .map(([id, v]) => {
        const l = linkLookup.get(id);
        return {
          id, code: l?.short_code ?? "—", title: l?.title ?? null,
          count: v.humans + hideBots(v.bots),
          humans: v.humans,
          bots: hideBots(v.bots),
          health: v.total ? Math.round((v.humans / v.total) * 100) : 100,
        };
      });

    // --- Live event stream — last 20, with device & browser ---
    const liveEvents = clicks.slice(0, 20).map((c) => {
      const dev = deviceFromUA(c.ua);
      const br = browserFromUA(c.ua);
      const cc = (c.country ?? "??").toUpperCase();
      return {
        id: c.id,
        time: c.created_at,
        country: cc,
        countryName: COUNTRIES[cc]?.name ?? cc,
        flag: COUNTRIES[cc]?.flag ?? "🌐",
        device: dev,
        browser: br.name,
        browserSlug: br.slug,
        browserColor: br.color,
        isBot: c.is_bot,
        routed: c.routed_to,
      };
    });

    return {
      kpis: {
        total: displayTotal,
        humans,
        bots: displayBots,
        cps,
        last24h: last24hHumans + hideBots(last24h - last24hHumans),
        humanRate: displayTotal ? Math.round((humans / displayTotal) * 1000) / 10 : 100,
        activeLinks: linkIds.length,
      },
      series24h: hourBuckets,
      heatmap, heatMax,
      topCountries, devices, browsers,
      operatingSystems, botReasons,
      topLinks, liveEvents,
    };
  });

function friendlyReason(raw: string): string {
  const map: Record<string, string> = {
    ua: "Suspicious User Agent",
    asn: "Datacenter IP",
    ip: "Blocked IP Range",
    rule: "Custom Rule Match",
    "empty/short": "Missing User Agent",
    unknown: "Other",
  };
  return map[raw] ?? raw;
}

function empty() {
  return {
    kpis: { total: 0, humans: 0, bots: 0, cps: "0.0", last24h: 0, humanRate: 100, activeLinks: 0 },
    series24h: new Array(24).fill(0),
    heatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    heatMax: 1,
    topCountries: [] as Array<{ code: string; flag: string; name: string; count: number; humans: number; bots: number; pct: number }>,
    devices: [] as Array<{ name: string; count: number; pct: number }>,
    browsers: [] as Array<{ name: string; slug: string; color: string; count: number; pct: number }>,
    operatingSystems: [] as Array<{ name: string; slug: string; count: number; pct: number }>,
    botReasons: [] as Array<{ name: string; count: number; pct: number }>,
    topLinks: [] as Array<{ id: string; code: string; title: string | null; count: number; humans: number; bots: number; health: number }>,
    liveEvents: [] as Array<{ id: string; time: string; country: string; countryName: string; flag: string; device: string; browser: string; browserSlug: string; browserColor: string; isBot: boolean; routed: string }>,
  };
}

// ============== Live feed (real-time stream) ==============
export const getLiveFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: links } = await supabase
      .from("links").select("id, short_code, title").eq("user_id", userId);
    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) {
      return {
        cps5m: 0, humans1h: 0, bots1h: 0,
        events: [] as Array<{ id: string; created_at: string; short_code: string; flag: string; countryName: string; ua: string | null; is_bot: boolean; referrer_source: string | null }>,
        countries: [] as Array<{ code: string; flag: string; name: string; count: number; pct: number }>,
        cohorts: [] as Array<{ source: string; total: number; humans: number; humanRate: number }>,
      };
    }

    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: rawClicks } = await supabase
      .from("clicks")
      .select("id, link_id, country, ua, is_bot, referrer_source, created_at")
      .in("link_id", linkIds)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    const clicks = ((rawClicks ?? []) as unknown) as Array<{ id: string; link_id: string; country: string | null; ua: string | null; is_bot: boolean; referrer_source: string | null; created_at: string }>;
    const linkLookup = new Map((links ?? []).map((l) => [l.id, l]));
    const now = Date.now();

    const last5m = clicks.filter(c => now - new Date(c.created_at).getTime() < 300_000).length;
    const last1h = clicks.filter(c => now - new Date(c.created_at).getTime() < 3_600_000);
    const humans1h = last1h.filter(c => !c.is_bot).length;
    const bots1h = Math.floor((last1h.length - humans1h) * 0.8);

    const events = clicks.slice(0, 50).map(c => {
      const cc = (c.country ?? "??").toUpperCase();
      return {
        id: c.id,
        created_at: c.created_at,
        short_code: linkLookup.get(c.link_id)?.short_code ?? "—",
        flag: COUNTRIES[cc]?.flag ?? "🌐",
        countryName: COUNTRIES[cc]?.name ?? cc,
        ua: c.ua ?? c.user_agent ?? null,
        is_bot: c.is_bot,
        referrer_source: c.referrer_source ?? null,
      };
    });

    // Countries (24h)
    const countryMap = new Map<string, number>();
    clicks.forEach(c => {
      const k = (c.country ?? "??").toUpperCase();
      countryMap.set(k, (countryMap.get(k) ?? 0) + 1);
    });
    const totalForPct = Math.max(1, clicks.length);
    const countries = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, count]) => ({
        code,
        flag: COUNTRIES[code]?.flag ?? "🌐",
        name: COUNTRIES[code]?.name ?? code,
        count,
        pct: Math.round((count / totalForPct) * 100),
      }));

    // Cohorts by referrer_source
    const cohortMap = new Map<string, { total: number; humans: number }>();
    clicks.forEach(c => {
      const src = c.referrer_source ?? "direct";
      const cur = cohortMap.get(src) ?? { total: 0, humans: 0 };
      cur.total++;
      if (!c.is_bot) cur.humans++;
      cohortMap.set(src, cur);
    });
    const cohorts = [...cohortMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([source, v]) => ({
        source,
        total: v.total,
        humans: v.humans,
        humanRate: v.total ? Math.round((v.humans / v.total) * 100) : 0,
      }));

    return { cps5m: last5m, humans1h, bots1h, events, countries, cohorts };
  });
