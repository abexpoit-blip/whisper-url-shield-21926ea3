import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { parseUA } from "@/lib/ua";
import { pickVariant, type Variant, type VariantSection } from "@/lib/variants";

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

  if (!ua) { score += 50; reasons.push("no-ua"); }
  for (const p of BOT_UA_PATTERNS) {
    if (ua.includes(p)) { score += 60; reasons.push(`ua:${p}`); break; }
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

  if (cfVerifiedBot === "true") { score += 100; reasons.push("cf-verified-bot"); }
  if (cfBotMgmt) {
    const s = parseInt(cfBotMgmt, 10);
    if (!isNaN(s) && s < 30) { score += 40; reasons.push(`cf-bot-score:${s}`); }
  }
  if (cfThreatScore) {
    const s = parseInt(cfThreatScore, 10);
    if (!isNaN(s) && s > 30) { score += 30; reasons.push(`cf-threat:${s}`); }
  }

  if (!referer && secFetchSite === "none" && score === 0) {
    reasons.push("direct-nav");
  }

  return {
    ua, isBot: score >= 50, score,
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

    const cfg = await loadProtection();

    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, status")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") return { found: false as const };

    // IP velocity check
    const rateHits = await ipExceedsRate(ip, cfg);
    const rateLimited = rateHits > 0;

    // Aggregate suspicion: pre-flag bot OR rate-limited OR over hard threshold
    const suspicious =
      a.isBot || rateLimited || a.score >= cfg.block_threshold_score;

    const suspicionReasons = [
      a.reasons,
      rateLimited ? `rate:${rateHits}/${cfg.ip_rate_limit_window_sec}s` : "",
    ].filter(Boolean).join(",");

    // Hard block path
    if (suspicious && cfg.suspicious_action === "block") {
      const uaInfoB = parseUA(a.ua);
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
      });
      return {
        found: true as const,
        blocked: true as const,
        safe: false as const,
        message: cfg.safe_page_message,
      };
    }

    // Safe page path — show innocuous content, never reveal destination
    if (suspicious && cfg.suspicious_action === "safe_page") {
      const uaInfoS = parseUA(a.ua);
      await supabaseAdmin.from("clicks").insert({
        link_id: link.id,
        ip_address: ip || null,
        country,
        user_agent: a.ua || null,
        referer: referer || null,
        is_bot: true,
        bot_reason: `safe:${suspicionReasons}`,
        device: uaInfoS.device,
        os: uaInfoS.os,
        browser: uaInfoS.browser,
        variant: null,
      });
      return {
        found: true as const,
        blocked: false as const,
        safe: true as const,
        message: cfg.safe_page_message,
      };
    }

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
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: a.ua || null,
      referer: referer || null,
      is_bot: a.isBot,
      bot_reason: suspicionReasons || null,
      device: uaInfo.device,
      os: uaInfo.os,
      browser: uaInfo.browser,
      variant: chosenVariant.slug,
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
      blocked: false as const,
      safe: false as const,
      linkId: link.id,
      variant: chosenVariant,
      preFlagBot: a.isBot,
      serverScore: a.score,
    };
  });

const verifyHuman = createServerFn({ method: "POST" })
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
      .select("id, destination_url, status")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") {
      return { ok: false as const, reason: "not-found" };
    }

    // Re-check protection at verification time (fresh IP velocity)
    const cfg = await loadProtection();
    const rateHits = await ipExceedsRate(ip, cfg);

    let score = a.score;
    const reasons: string[] = a.reasons ? [a.reasons] : [];
    if (rateHits > 0) {
      score += 60;
      reasons.push(`rate:${rateHits}/${cfg.ip_rate_limit_window_sec}s`);
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
    if (interactions < 2) { score += 50; reasons.push("no-interaction"); }
    if (fp.timeOnPage < 1500) { score += 30; reasons.push("too-fast"); }

    if (fp.ua && a.ua && fp.ua.toLowerCase() !== a.ua) {
      score += 25; reasons.push("ua-mismatch");
    }

    const isBot = score >= cfg.block_threshold_score;

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
      { title: "Daily Reads — Articles & Tips" },
      {
        name: "description",
        content: "Practical lifestyle, wellness and productivity tips for everyday readers.",
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
      const dataUrl = c.toDataURL();
      let h = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        h = ((h << 5) - h) + dataUrl.charCodeAt(i);
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

function SafePage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <span className="font-bold tracking-tight text-lg">Daily Reads</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Article unavailable</h1>
        <p className="text-muted-foreground">{message}</p>
      </main>
    </div>
  );
}

function BlockedPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-3">Access denied</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function PreLanderPage() {
  const { code } = Route.useParams();
  const loaderData = Route.useLoaderData();

  if (loaderData.blocked) return <BlockedPage message={loaderData.message} />;
  if (loaderData.safe) return <SafePage message={loaderData.message} />;

  const variant = loaderData.variant!;
  return <PreLanderInner code={code} variant={variant} />;
}

function PreLanderInner({ code, variant }: { code: string; variant: Variant }) {
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
      const res = await verify({ data: { code, variant: variant.slug, fp } });
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
          {variant.sections.map((s: VariantSection, i: number) => (
            <div key={`${s.heading}-${i}`}>
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
