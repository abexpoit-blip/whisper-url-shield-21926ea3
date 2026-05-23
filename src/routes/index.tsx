import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sleepox — Smart Link Manager & Real-Time Analytics" },
      { name: "description", content: "Branded short links, edge-fast redirects, geo & device routing, real-time analytics. Free forever plan. $50 lifetime unlimited." },
      { property: "og:title", content: "Sleepox — Smart Link Manager" },
      { property: "og:description", content: "Shorten, route, and measure every link with sub-30ms edge redirects and live analytics." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: "🔗", title: "Branded Short Links", desc: "Turn long URLs into clean, memorable links you actually want to share." },
  { icon: "⚡", title: "Edge-Fast Redirects", desc: "Global edge network delivers every click in under 30ms — zero loss, zero lag." },
  { icon: "🌍", title: "Geo Routing", desc: "Send visitors to different destinations based on country. Match offers to audiences automatically." },
  { icon: "📱", title: "Device Targeting", desc: "Route mobile, desktop, or tablet traffic separately. One link, infinite paths." },
  { icon: "📊", title: "Real-Time Analytics", desc: "Live click counts, country breakdown, device split, referrer data. No charts, no lag — just numbers." },
  { icon: "🎯", title: "Link Health Score", desc: "0–100 score per link. Spot underperforming campaigns before they cost you." },
  { icon: "🛡️", title: "Traffic Quality Filter", desc: "Automatic 5-layer screening keeps your analytics clean and your destinations safe." },
  { icon: "💳", title: "Crypto Checkout", desc: "Pay with USDT, BTC, or LTC via Plisio. No card, no KYC, instant activation." },
  { icon: "♾️", title: "Lifetime Unlimited", desc: "$50 once. Unlimited links, unlimited clicks, forever. No recurring fees, ever." },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    clicks: "10,000 clicks / month",
    links: "1 active link",
    features: ["Edge-fast redirects", "Real-time analytics", "Traffic quality filter"],
    cta: "Start free",
    blurb: "Best for testing the platform and personal links.",
  },
  {
    name: "Monthly Pro",
    price: "$5",
    period: "per month",
    clicks: "1,000,000 clicks / month",
    links: "50 active links",
    features: ["Everything in Free", "Geo + device routing", "Priority redirect lane", "Link health score", "Email support"],
    cta: "Go Pro",
    highlight: true,
    blurb: "Recommended for growing campaigns and active marketers.",
  },
  {
    name: "Lifetime Unlimited",
    price: "$50",
    period: "one-time",
    clicks: "Unlimited clicks",
    links: "Unlimited links",
    features: ["Everything in Pro", "Lifetime access", "No recurring fees", "Priority support", "Early access to new features"],
    cta: "Get lifetime",
    blurb: "Best long-term value. Pay once, use forever.",
  },
];

function HomePage() {
  return (
    <div className="min-h-screen bg-mesh text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Sleepox home">
            <Wordmark size="md" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="hidden sm:inline hover:text-primary">Features</a>
            <a href="#pricing" className="hidden sm:inline hover:text-primary">Pricing</a>
            <Link to="/login" className="hover:text-primary">Login</Link>
            <Link to="/signup" className="rounded-lg bg-sky-gradient px-4 py-2 text-sm font-medium text-primary-foreground sky-glow hover:opacity-90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky px-4 py-1.5 text-xs">
            <span className="live-dot" /> Trusted by 12,000+ creators &amp; marketers
          </div>
          <h1 className="mt-6 text-5xl font-bold leading-tight sm:text-6xl">
            <span className="text-gradient-sky">Smart links</span> that<br />
            route, protect, and <span className="text-gradient-sky">measure</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Shorten any URL. Route visitors by country or device. Watch every click in real time.
            All on a global edge network — under 30ms, anywhere on Earth.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" className="rounded-xl bg-sky-gradient px-8 py-3.5 text-base font-semibold text-primary-foreground sky-glow hover:opacity-90">
              Start free — 10K clicks
            </Link>
            <a href="#pricing" className="rounded-xl border border-sky px-8 py-3.5 text-base font-medium hover:bg-secondary">
              See pricing
            </a>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            <div><div className="text-3xl font-bold text-gradient-sky">30ms</div><div className="mt-1 text-xs text-muted-foreground">Edge redirect</div></div>
            <div><div className="text-3xl font-bold text-gradient-sky">99.9%</div><div className="mt-1 text-xs text-muted-foreground">Uptime SLA</div></div>
            <div><div className="text-3xl font-bold text-gradient-sky">5M+</div><div className="mt-1 text-xs text-muted-foreground">Clicks routed daily</div></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Everything your links need.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          A complete toolkit for short links, routing rules, and analytics — without the bloat.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 transition hover:sky-glow">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/30 bg-background/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Simple pricing. No hidden fees.</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Pay with crypto via Plisio. Upgrade or stay free forever.</p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`relative rounded-2xl p-8 ${p.highlight ? "glass-panel sky-glow border border-sky scale-[1.02]" : "glass-card"}`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-gradient px-3 py-1 text-xs font-bold text-primary-foreground">
                    ⭐ RECOMMENDED
                  </div>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-gradient-sky">{p.price}</span>
                  <span className="text-sm text-muted-foreground">/ {p.period}</span>
                </div>
                <div className="mt-6 space-y-1 text-sm">
                  <div className="font-medium">{p.clicks}</div>
                  <div className="text-muted-foreground">{p.links}</div>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold ${p.highlight ? "bg-sky-gradient text-primary-foreground sky-glow" : "border border-sky hover:bg-secondary"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            💡 Most users pick <span className="font-semibold text-foreground">Lifetime Unlimited</span> — pay once, use forever.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Ready to ship smarter links?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Free plan, no credit card. Be live in under a minute.</p>
        <Link to="/signup" className="mt-8 inline-block rounded-xl bg-sky-gradient px-10 py-4 text-base font-semibold text-primary-foreground sky-glow hover:opacity-90">
          Create free account
        </Link>
      </section>

      <footer className="border-t border-border/30 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sleepox · Smart links &amp; analytics
      </footer>
    </div>
  );
}
