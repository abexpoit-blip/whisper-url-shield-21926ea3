import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Zap, BarChart3, Bot, Globe, Lock, ArrowRight, Check, ShieldCheck, Activity, TrendingUp, MousePointerClick, Users, Gauge, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { FaqSection, HOMEPAGE_FAQ, buildFaqSchema } from "@/components/faq-section";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkShield — Bot-Filtered URL Shortener for Facebook, Instagram & TikTok Ads" },
      {
        name: "description",
        content:
          "Free smart URL shortener with bot filtering, geo targeting, and click fraud protection. Boost CTR, cut wasted ad spend, and protect Facebook, Instagram, TikTok & Google Ads accounts with branded short links and live analytics.",
      },
      {
        name: "keywords",
        content:
          "url shortener, bot filter short link, click fraud protection, facebook ads link cloaker, instagram ads short url, tiktok ads link tracker, google ads click protection, branded short links, link tracking, geo targeted links, ad spend protection, media buyer tools, ctr booster, smart links, link rotator, conversion tracking",
      },
      { property: "og:title", content: "LinkShield — Bot-Filtered URL Shortener for Facebook, Instagram & TikTok Ads" },
      {
        property: "og:description",
        content:
          "Smart short links with bot filtering, geo targeting and click fraud protection — built for Meta, TikTok and Google Ads.",
      },
      { property: "og:url", content: "https://sleepox.com/" },
      { name: "twitter:title", content: "LinkShield — Bot-Filtered URL Shortener for Ad Campaigns" },
      { name: "twitter:description", content: "Short links built for Facebook, Instagram, TikTok & Google Ads — block bots, boost CTR." },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(buildFaqSchema(HOMEPAGE_FAQ)),
      },
    ],
  }),

  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold">
            <Logo glow glowSize="sm" className="h-8 w-8" />
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent tracking-tight">LinkShield</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <Link to="/facebook-ads" className="text-muted-foreground hover:text-foreground">Facebook</Link>
            <Link to="/instagram-ads" className="text-muted-foreground hover:text-foreground">Instagram</Link>
            <Link to="/tiktok-ads" className="text-muted-foreground hover:text-foreground">TikTok</Link>
            <Link to="/google-ads" className="text-muted-foreground hover:text-foreground">Google Ads</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="shadow-glow">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — Bento Dashboard */}
      <section className="relative overflow-hidden bg-mesh">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-sky/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-0 grid-pattern opacity-40" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-20">
          {/* Top headline strip */}
          <div className="mx-auto max-w-3xl text-center mb-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky">
                Live · 12,402 bots blocked today
              </span>
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              The <span className="text-gradient-sky">command center</span> for protected ad traffic
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              Bot filtering, geo routing, click-fraud defense and real-time analytics — one dense dashboard built for media buyers.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="gap-2 rounded-xl shadow-glow">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="rounded-xl glass">See pricing</Button>
              </Link>
            </div>
          </div>

          {/* BENTO GRID */}
          <div className="grid grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)]">
            {/* Big chart tile */}
            <div className="col-span-12 md:col-span-8 row-span-2 glass rounded-3xl p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky">Traffic Analysis · 24h</p>
                  <h3 className="font-display text-xl font-bold mt-1">Real-time click stream</h3>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success border border-success/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Active
                </div>
              </div>
              {/* Layered bars */}
              <div className="flex h-40 items-end justify-between gap-1.5">
                {[40, 65, 50, 90, 75, 55, 45, 70, 85, 60, 78, 92].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col gap-0.5 items-stretch">
                    <div className="rounded-t-md bg-gradient-to-t from-sky to-primary-glow shadow-sky" style={{ height: `${h}%` }} />
                    <div className="rounded-b-md bg-destructive/40" style={{ height: `${Math.round(h * 0.15)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky" /> Real users</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-destructive/60" /> Bots blocked</span>
                </div>
                <span className="font-mono">+18.2% vs yesterday</span>
              </div>
            </div>

            {/* Security score */}
            <div className="col-span-6 md:col-span-4 glass rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky/30 blur-2xl" />
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky">
                <Shield className="h-3.5 w-3.5" /> Security Score
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold text-gradient-sky">99.8</span>
                <span className="text-lg font-bold text-muted-foreground">%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[99%] rounded-full bg-sky-gradient" />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">All systems nominal · checked 12s ago</p>
            </div>

            {/* Stat cards 1 */}
            <div className="col-span-6 md:col-span-2 glass rounded-3xl p-5">
              <Bot className="h-5 w-5 text-sky" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bots blocked</p>
              <p className="font-display text-2xl font-bold mt-1">12,402</p>
              <p className="text-[11px] text-success font-semibold mt-1">↑ 8.4%</p>
            </div>
            <div className="col-span-6 md:col-span-2 glass rounded-3xl p-5">
              <TrendingUp className="h-5 w-5 text-sky" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ad savings</p>
              <p className="font-display text-2xl font-bold text-gradient-sky mt-1">$3,240</p>
              <p className="text-[11px] text-success font-semibold mt-1">this week</p>
            </div>

            {/* World / geo tile */}
            <div className="col-span-12 md:col-span-4 glass rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky">Top Geographies</p>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { c: "United States", v: 42, n: "5,210" },
                  { c: "Bangladesh", v: 28, n: "3,480" },
                  { c: "India", v: 18, n: "2,240" },
                  { c: "Germany", v: 12, n: "1,470" },
                ].map((r) => (
                  <div key={r.c} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold">{r.c}</span>
                      <span className="font-mono text-muted-foreground">{r.n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-sky-gradient" style={{ width: `${r.v * 2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTR tile */}
            <div className="col-span-6 md:col-span-4 glass rounded-3xl p-6 relative">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky">CTR Boost</p>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="font-display text-4xl font-bold">2.4<span className="text-2xl">x</span></p>
                  <p className="text-[11px] text-muted-foreground mt-1">vs unfiltered links</p>
                </div>
                <div className="flex-1 flex items-end gap-1 h-16">
                  {[30, 45, 38, 55, 70, 62, 85, 92].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-sky/40 to-primary-glow" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Latency tile */}
            <div className="col-span-6 md:col-span-4 glass rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky">Edge latency</p>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="font-display text-4xl font-bold">87<span className="text-xl text-muted-foreground">ms</span></p>
                <p className="text-[11px] text-success font-semibold mt-1">↓ Under 100ms target</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center"><p className="text-muted-foreground">P50</p><p className="font-bold mt-0.5">62ms</p></div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center"><p className="text-muted-foreground">P95</p><p className="font-bold mt-0.5">112ms</p></div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center"><p className="text-muted-foreground">P99</p><p className="font-bold mt-0.5">198ms</p></div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky" /> No credit card required</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky" /> 14-day free trial</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-md">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {[
            { v: "40%", l: "Less wasted ad spend" },
            { v: "2.4x", l: "Higher real CTR" },
            { v: "85%", l: "Ad approval rate" },
            { v: "10K+", l: "Links protected" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl font-bold text-gradient-sky md:text-4xl">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features — Bento */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Everything in <span className="text-gradient-sky">one dense console</span></h2>
          <p className="mt-4 text-muted-foreground">Built for agencies and media buyers running paid social at scale.</p>
        </div>
        <div className="mt-12 grid grid-cols-12 gap-4 auto-rows-[minmax(180px,auto)]">
          {/* Big feature */}
          <div className="col-span-12 md:col-span-6 row-span-2 glass rounded-3xl p-7 relative overflow-hidden group hover:border-sky/40 transition">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky/20 blur-3xl group-hover:bg-sky/30 transition" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-sky-gradient shadow-glow">
              <Bot className="h-6 w-6 text-primary-foreground" strokeWidth={2.25} />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold">Bot & fraud filter</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Detect datacenter IPs, headless browsers, scraper bots and click-fraud farms in real time. ML-driven scoring keeps your CPM clean.</p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-[11px]">
              {["Datacenter IP", "Headless", "Repeat clicks", "VPN/Proxy", "Bot UA", "Click farms"].map((t) => (
                <span key={t} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-center font-medium">{t}</span>
              ))}
            </div>
          </div>

          {[
            { icon: BarChart3, title: "Real-time analytics", desc: "Country, device, browser, referer — see who's clicking." },
            { icon: Shield, title: "Account protection", desc: "Policy-compliant pre-landers built in." },
            { icon: Globe, title: "Custom domains", desc: "Brand your short links. Rotate to avoid burn." },
            { icon: Zap, title: "Edge redirects", desc: "Sub-100ms global. Real users never wait." },
            { icon: Lock, title: "Click limits & expiry", desc: "Cap clicks, set expiry, pause instantly." },
            { icon: Activity, title: "Live click stream", desc: "Watch every click as it happens, filter by source." },
          ].map((f) => (
            <div key={f.title} className="col-span-6 md:col-span-3 glass rounded-3xl p-5 group hover:border-sky/40 transition hover:-translate-y-0.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-gradient shadow-glow">
                <f.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/40 bg-card/30 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How LinkShield works</h2>
            <p className="mt-4 text-muted-foreground">Three steps to safer, smarter ads.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { step: "01", title: "Create short link", desc: "Paste your offer URL. Get a clean branded short link in seconds.", icon: Sparkles },
              { step: "02", title: "Use in your ads", desc: "Drop the link in Facebook, Instagram, TikTok, or any ad platform.", icon: Users },
              { step: "03", title: "Bot filter does the rest", desc: "Bots see a safe page. Real users get sent to your offer.", icon: ShieldCheck },
            ].map((s) => (
              <div key={s.step} className="glass rounded-2xl p-6 relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-4xl font-bold text-sky/40">{s.step}</span>
                  <s.icon className="h-5 w-5 text-sky" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection
        title="Frequently asked questions"
        subtitle="Everything you need to know about LinkShield and how it protects your ads."
        items={HOMEPAGE_FAQ}
      />

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card-gradient p-12 text-center shadow-elegant">
          <div className="absolute inset-0 bg-hero opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-bold md:text-4xl">Ready to protect your ad spend?</h2>
            <p className="mt-4 text-muted-foreground">Join hundreds of agencies running safer Facebook & Instagram ads.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="shadow-glow gap-2">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">View pricing</Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {["No credit card", "14-day free trial", "Cancel anytime"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Logo glow glowSize="sm" className="h-6 w-6" />
            <span>© 2026 LinkShield. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/facebook-ads">Facebook Ads</Link>
            <Link to="/instagram-ads">Instagram Ads</Link>
            <Link to="/tiktok-ads">TikTok Ads</Link>
            <Link to="/google-ads">Google Ads</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Sign in</Link>
            <span
              className="inline-block rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white shadow-glow"
            >
              Developed by Sleepox LLC
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
