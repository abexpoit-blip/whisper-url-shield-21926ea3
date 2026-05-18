import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { parseUA } from "@/lib/ua";
import {
  VARIANTS, VARIANT_IDS, pickVariant, type VariantId,
} from "@/lib/variants";

const VariantSchema = z.enum(VARIANT_IDS as [VariantId, ...VariantId[]]);

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

// Datacenter / hosting ASN ranges are hard without paid APIs.
// Instead we score headers — real browsers send a consistent fingerprint.
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

  if (!ua) { score += 50; reasons.push("no-ua"); }
  for (const p of BOT_UA_PATTERNS) {
    if (ua.includes(p)) { score += 60; reasons.push(`ua:${p}`); break; }
  }

  // Real browsers always send Accept with text/html on top-level navigation
  if (!accept.includes("text/html")) { score += 25; reasons.push("no-html-accept"); }
  if (!acceptLang) { score += 20; reasons.push("no-accept-lang"); }
  if (!acceptEnc.includes("gzip") && !acceptEnc.includes("br")) {
    score += 15; reasons.push("no-compression");
  }

  // Modern Chromium/Firefox/Safari send sec-fetch-* on navigation
  const looksModern = /chrome\/|firefox\/|safari\//.test(ua);
  if (looksModern && !secFetchMode) { score += 15; reasons.push("no-sec-fetch"); }
  if (looksModern && !secFetchDest) { score += 10; reasons.push("no-sec-fetch-dest"); }

  // Chromium sends sec-ch-ua
  if (ua.includes("chrome/") && !secChUa) { score += 20; reasons.push("chrome-no-ch-ua"); }

  // Cloudflare signals (free, automatic on .lovable.app)
  if (cfVerifiedBot === "true") { score += 100; reasons.push("cf-verified-bot"); }
  if (cfBotMgmt) {
    const s = parseInt(cfBotMgmt, 10);
    if (!isNaN(s) && s < 30) { score += 40; reasons.push(`cf-bot-score:${s}`); }
  }
  if (cfThreatScore) {
    const s = parseInt(cfThreatScore, 10);
    if (!isNaN(s) && s > 30) { score += 30; reasons.push(`cf-threat:${s}`); }
  }

  // Direct hits with no referer from non-search engines = mildly suspicious for ad traffic
  if (!referer && secFetchSite === "none" && score === 0) {
    // not penalized by itself, just noted
    reasons.push("direct-nav");
  }

  return {
    ua,
    isBot: score >= 50,
    score,
    reasons: reasons.join(","),
    acceptLang,
    secChUaMobile,
    dnt,
  };
}

// ---------- Server functions ----------

const resolveLink = createServerFn({ method: "POST" })
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

    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, status")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") return { found: false as const };

    // ---- A/B variant selection (epsilon-greedy per link) ----
    // Winning metric = REAL conversion rate = successful human redirects
    // out of total verify attempts (bot-blocks count as failures).
    // We only look at verify rows (bot_reason starts with "verify:")
    // because those are the rows where a real outcome was decided.
    const { data: recent } = await supabaseAdmin
      .from("clicks")
      .select("variant,is_bot,bot_reason")
      .eq("link_id", link.id)
      .not("variant", "is", null)
      .like("bot_reason", "verify:%")
      .order("created_at", { ascending: false })
      .limit(1500);

    const statsMap = new Map<VariantId, { id: VariantId; total: number; humans: number }>();
    for (const id of VARIANT_IDS) statsMap.set(id, { id, total: 0, humans: 0 });
    for (const r of recent ?? []) {
      const v = r.variant as VariantId | null;
      if (!v || !statsMap.has(v)) continue;
      const e = statsMap.get(v)!;
      e.total += 1; // verify attempt
      if (!r.is_bot) e.humans += 1; // successful redirect
    }
    const chosenVariant = pickVariant([...statsMap.values()]);

    const uaInfo = parseUA(a.ua);
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: a.ua || null,
      referer: referer || null,
      is_bot: a.isBot,
      bot_reason: a.reasons || null,
      device: uaInfo.device,
      os: uaInfo.os,
      browser: uaInfo.browser,
      variant: chosenVariant,
    });

    if (a.isBot) {
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
      linkId: link.id,
      variant: chosenVariant,
      preFlagBot: a.isBot,
      serverScore: a.score,
    };
  });

const verifyHuman = createServerFn({ method: "POST" })
  .inputValidator((input: {
    code: string;
    variant: VariantId;
    fp: {
      ua: string;
      webdriver: boolean;
      languages: string[];
      platform: string;
      hwConcurrency: number;
      deviceMemory: number;
      screen: { w: number; h: number; cd: number };
      tz: string;
      plugins: number;
      touchPoints: number;
      hasChrome: boolean;
      mouse: number;
      scroll: number;
      key: number;
      touch: number;
      timeOnPage: number;
      canvasHash: string;
    };
  }) =>
    z.object({
      code: z.string().min(1).max(32),
      variant: VariantSchema,
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
      .select("id, destination_url, status")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") {
      return { ok: false as const, reason: "not-found" };
    }

    let score = a.score;
    const reasons: string[] = a.reasons ? [a.reasons] : [];
    const fp = data.fp;

    // Hard fails
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

    // Chrome should have window.chrome
    if (fp.ua.toLowerCase().includes("chrome/") && !fp.hasChrome) {
      score += 40; reasons.push("chrome-spoof");
    }

    // Mobile UA should report touch points
    if (/mobile|android|iphone/i.test(fp.ua) && fp.touchPoints === 0) {
      score += 30; reasons.push("mobile-no-touch");
    }

    // Interaction requirement: at least one of mouse/scroll/key/touch must be non-trivial
    const interactions = fp.mouse + fp.scroll + fp.key + fp.touch;
    if (interactions < 2) { score += 50; reasons.push("no-interaction"); }
    if (fp.timeOnPage < 1500) { score += 30; reasons.push("too-fast"); }

    // UA mismatch between request header and JS-reported UA
    if (fp.ua && a.ua && fp.ua.toLowerCase() !== a.ua) {
      score += 25; reasons.push("ua-mismatch");
    }

    const isBot = score >= 60;

    const uaInfo2 = parseUA(a.ua);
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country: getRequestHeader("cf-ipcountry") || null,
      user_agent: a.ua || null,
      referer: getRequestHeader("referer") || null,
      is_bot: isBot,
      bot_reason: `verify:${reasons.join(",")}|score:${score}`,
      device: uaInfo2.device,
      os: uaInfo2.os,
      browser: uaInfo2.browser,
      variant: data.variant,
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

    // Verified human — count and reveal destination
    const { data: cur } = await supabaseAdmin
      .from("links").select("clicks_count").eq("id", link.id).single();
    if (cur) {
      await supabaseAdmin.from("links")
        .update({ clicks_count: cur.clicks_count + 1 })
        .eq("id", link.id);
    }

    return { ok: true as const, destination: link.destination_url };
  });

// ---------- Route ----------

export const Route = createFileRoute("/r/$code")({
  loader: async ({ params }) => {
    const r = await resolveLink({ data: { code: params.code } });
    if (!r.found) throw notFound();
    return r;
  },
  component: PreLanderPage,
  head: () => ({
    meta: [
      { title: "Health & Wellness Tips — Daily Reads" },
      {
        name: "description",
        content: "Practical lifestyle and wellness tips for everyday readers.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This article doesn't exist or has been removed.
        </p>
      </div>
    </div>
  ),
});

// ---------- Client-side fingerprint ----------

function collectFingerprint(metrics: {
  mouse: number; scroll: number; key: number; touch: number; startedAt: number;
}) {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    webdriver?: boolean;
  };
  const w = window as Window & { chrome?: unknown };

  // Lightweight canvas fingerprint (just to confirm canvas works)
  let canvasHash = "blocked";
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 100, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("dr-check", 2, 15);
      const data = c.toDataURL();
      let h = 0;
      for (let i = 0; i < data.length; i++) {
        h = ((h << 5) - h) + data.charCodeAt(i);
        h |= 0;
      }
      canvasHash = Math.abs(h).toString(16);
    }
  } catch {
    canvasHash = "blocked";
  }

  return {
    ua: navigator.userAgent || "",
    webdriver: Boolean(nav.webdriver),
    languages: Array.isArray(navigator.languages) ? [...navigator.languages] : [],
    platform: navigator.platform || "",
    hwConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: nav.deviceMemory || 0,
    screen: {
      w: screen.width || 0,
      h: screen.height || 0,
      cd: screen.colorDepth || 0,
    },
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    plugins: navigator.plugins ? navigator.plugins.length : 0,
    touchPoints: navigator.maxTouchPoints || 0,
    hasChrome: typeof w.chrome !== "undefined",
    mouse: metrics.mouse,
    scroll: metrics.scroll,
    key: metrics.key,
    touch: metrics.touch,
    timeOnPage: Date.now() - metrics.startedAt,
    canvasHash,
  };
}

function PreLanderPage() {
  const { code } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const variantId = (loaderData.variant ?? "wellness") as VariantId;
  const variant = VARIANTS[variantId];
  const verify = useServerFn(verifyHuman);
  const [status, setStatus] = useState<"reading" | "verifying" | "redirecting" | "blocked">("reading");
  const [countdown, setCountdown] = useState(3);
  const metrics = useRef({ mouse: 0, scroll: 0, key: 0, touch: 0, startedAt: Date.now() });
  const destRef = useRef<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const onMouse = () => { metrics.current.mouse += 1; };
    const onScroll = () => { metrics.current.scroll += 1; };
    const onKey = () => { metrics.current.key += 1; };
    const onTouch = () => { metrics.current.touch += 1; };
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  const runVerify = async () => {
    if (triggered.current) return;
    triggered.current = true;
    setStatus("verifying");
    try {
      const fp = collectFingerprint(metrics.current);
      const res = await verify({ data: { code, variant: variantId, fp } });
      if (res.ok) {
        destRef.current = res.destination;
        setStatus("redirecting");
      } else {
        setStatus("blocked");
      }
    } catch {
      setStatus("blocked");
    }
  };

  // Auto-trigger verify after the user has spent ~2.5s with at least some interaction
  useEffect(() => {
    const timer = window.setInterval(() => {
      const m = metrics.current;
      const interactions = m.mouse + m.scroll + m.key + m.touch;
      const elapsed = Date.now() - m.startedAt;
      if (elapsed > 2500 && interactions >= 2 && !triggered.current) {
        void runVerify();
      }
    }, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "redirecting" || !destRef.current) return;
    const t = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(t);
          window.location.replace(destRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <span className="font-bold tracking-tight text-lg">Daily Reads</span>
          <nav className="text-sm text-muted-foreground space-x-4 hidden sm:block">
            <span>Wellness</span><span>Lifestyle</span><span>Productivity</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <article className="max-w-none">
          <p className="text-sm uppercase tracking-wider text-primary mb-3">{variant.category}</p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
            {variant.title}
          </h1>
          <p className="text-muted-foreground mb-8">{variant.subtitle}</p>
          <p className="mb-4 leading-relaxed">{variant.intro}</p>
          {variant.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-xl font-semibold mt-8 mb-3">{s.heading}</h2>
              <p className="mb-4 leading-relaxed">{s.body}</p>
            </div>
          ))}
          <p className="leading-relaxed">{variant.outro}</p>
        </article>

        <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center">
          {status === "reading" && (
            <>
              <h3 className="text-lg font-semibold mb-2">Continue reading</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Scroll or interact with the page to load the next article.
              </p>
              <button
                onClick={runVerify}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Continue
              </button>
            </>
          )}
          {status === "verifying" && (
            <>
              <h3 className="text-lg font-semibold mb-2">Loading next article...</h3>
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </>
          )}
          {status === "redirecting" && (
            <>
              <h3 className="text-lg font-semibold mb-2">Continuing in {countdown}...</h3>
              <button
                onClick={() => destRef.current && window.location.replace(destRef.current)}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Continue now
              </button>
            </>
          )}
          {status === "blocked" && (
            <>
              <h3 className="text-lg font-semibold mb-2">Thanks for reading</h3>
              <p className="text-sm text-muted-foreground">
                Browse more articles on our homepage.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-10">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground text-center">
          © Daily Reads · Wellness & lifestyle articles for everyday readers.
        </div>
      </footer>
    </div>
  );
}
