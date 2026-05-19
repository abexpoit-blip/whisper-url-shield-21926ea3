import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveLink, verifyHuman } from "@/lib/redirect.functions";
import type { Variant, VariantSection } from "@/lib/variants";

// ---------- Route ----------

export const Route = createFileRoute("/r/$code")({
  loader: async ({ params }) => {
    const r = await resolveLink({ data: { code: params.code } });
    if (!r.found) throw notFound();
    return r;
  },
  component: PreLanderPage,
  head: ({ loaderData }) => {
    // Pull title/description from the chosen variant so FB / WhatsApp /
    // Twitter share previews look like a legitimate article — NOT a redirect.
    // Intentionally NO `noindex` here: that's a giveaway flag to ad scanners.
    const v = loaderData && "variant" in loaderData ? loaderData.variant : null;
    const title = v?.title ?? "Daily Reads — Articles & Tips";
    const desc =
      v?.subtitle ||
      (v?.intro ? v.intro.slice(0, 155) : "Practical lifestyle, wellness and productivity tips for everyday readers.");
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "Daily Reads" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "author", content: "Daily Reads Editorial" },
      ],
    };
  },
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

  if ("direct" in loaderData && loaderData.direct && loaderData.redirectTo) {
    return <DirectRedirect destination={loaderData.redirectTo} />;
  }

  const variant = loaderData.variant!;
  // silentBot: render the same real article a human would see, but do NOT
  // auto-verify or expose the destination. Looks like a legit page to FB
  // ad-review crawlers — no "Article unavailable" giveaway.
  return <PreLanderInner code={code} variant={variant} silent={Boolean(loaderData.silentBot)} />;
}

function DirectRedirect({ destination }: { destination: string }) {
  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function PreLanderInner({ code, variant, silent }: { code: string; variant: Variant; silent: boolean }) {
  const verify = useServerFn(verifyHuman);
  const [status, setStatus] = useState<"verifying" | "redirecting" | "blocked">("verifying");
  const metrics = useRef({ mouse: 0, scroll: 0, key: 0, touch: 0, startedAt: Date.now() });
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
    if (silent) return;
    if (triggered.current) return;
    triggered.current = true;
    try {
      const fp = collectFingerprint(metrics.current);
      const res = await verify({ data: { code, variant: variant.slug, fp } });
      if (res.ok) {
        setStatus("redirecting");
        // Auto-redirect immediately — no click, no countdown. Don't waste paid traffic.
        window.location.replace(res.destination);
      } else {
        setStatus("blocked");
      }
    } catch {
      setStatus("blocked");
    }
  };

  useEffect(() => {
    if (silent) return;
    // Fire verify on mount. Small delay lets the page paint + collect a tick of signal.
    const t = window.setTimeout(() => { void runVerify(); }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silent]);

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

        {silent ? (
          <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Thanks for reading</h3>
            <p className="text-sm text-muted-foreground">
              Browse more articles on our homepage.
            </p>
          </div>
        ) : status === "blocked" ? (
          <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Thanks for reading</h3>
            <p className="text-sm text-muted-foreground">
              Browse more articles on our homepage.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex items-center justify-center py-4" aria-hidden="true">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-10">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground text-center">
          © Daily Reads · Wellness & lifestyle articles for everyday readers.
        </div>
      </footer>
    </div>
  );
}
