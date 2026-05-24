import { createFileRoute, Link } from "@tanstack/react-router";

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
  { name: "Free", price: "$0", period: "forever", clicks: "10,000 clicks / month", links: "1 active link",
    features: ["Edge-fast redirects", "Real-time analytics", "Traffic quality filter"], cta: "Start free",
    blurb: "Best for testing the platform and personal links." },
  { name: "Monthly Pro", price: "$5", period: "per month", clicks: "1,000,000 clicks / month", links: "50 active links",
    features: ["Everything in Free", "Geo + device routing", "Priority redirect lane", "Link health score", "Email support"],
    cta: "Go Pro", highlight: true, blurb: "Recommended for growing campaigns and active marketers." },
  { name: "Lifetime Unlimited", price: "$50", period: "one-time", clicks: "Unlimited clicks", links: "Unlimited links",
    features: ["Everything in Pro", "Lifetime access", "No recurring fees", "Priority support", "Early access to new features"],
    cta: "Get lifetime", blurb: "Best long-term value. Pay once, use forever." },
];

function HomePage() {
  return (
    <div className="min-h-screen w-full bg-[#050B1F] text-slate-200 font-sans overflow-x-hidden relative">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(#38BDF8 0.5px, transparent 0.5px)", backgroundSize: "32px 32px" }}
      />

      {/* Floating Nav Pill */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 sm:px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center gap-4 sm:gap-10 shadow-2xl">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-[#38BDF8] to-[#6366F1]" />
          <span className="text-white font-extrabold tracking-tight text-lg">Sleepox</span>
        </Link>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-[#38BDF8] transition-colors">Features</a>
          <a href="#pricing" className="hover:text-[#38BDF8] transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/login" className="text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/signup" className="px-4 sm:px-5 py-2 rounded-full bg-white/10 text-sm font-bold border border-white/20 hover:bg-white/20 transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Split Hero */}
      <section className="relative z-10 min-h-screen flex items-center pt-32 pb-20">
        <div className="max-w-7xl w-full mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left content */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-xs font-bold uppercase tracking-widest mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38BDF8] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38BDF8]" />
              </span>
              v2.0 Analytics Live
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] mb-8">
              Shorten the link,<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#38BDF8] via-[#0EA5E9] to-[#6366F1]">
                expand the reach.
              </span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl mb-10 leading-relaxed">
              The next-generation URL management platform. Branded short links, geo + device routing, and deep audience insights — under 30ms, anywhere on Earth.
            </p>

            <div className="flex p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl focus-within:border-[#38BDF8]/50 transition-all">
              <input
                type="text"
                placeholder="Paste your long URL here..."
                className="bg-transparent border-none outline-none px-3 sm:px-5 flex-1 text-white placeholder:text-slate-500 font-medium min-w-0"
              />
              <Link
                to="/signup"
                className="bg-gradient-to-r from-[#38BDF8] to-[#6366F1] px-5 sm:px-8 py-3 sm:py-4 rounded-xl font-extrabold text-white text-sm sm:text-base shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
              >
                Create Link
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-6 text-slate-500 text-sm">
              <div className="flex items-center gap-2">✓ No credit card</div>
              <div className="flex items-center gap-2">✓ 10K clicks free</div>
            </div>
          </div>

          {/* Right glass dashboard preview */}
          <div className="relative">
            <div className="absolute -inset-20 bg-gradient-to-tr from-[#38BDF8]/20 via-[#6366F1]/10 to-transparent blur-[100px] rounded-full" />

            <div className="relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-1">Live Performance</div>
                  <div className="text-2xl font-bold text-white tracking-tight">Dashboard</div>
                </div>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/40" />
                  <div className="w-3 h-3 rounded-full bg-[#0EA5E9]/20 border border-[#0EA5E9]/40" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-widest">Total Engagement</div>
                  <div className="text-3xl font-extrabold text-white">842.1k</div>
                  <div className="text-[10px] text-[#38BDF8] mt-1 font-bold">+12.4% vs last month</div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-widest">Top Source</div>
                  <div className="text-3xl font-extrabold text-white">Direct</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-medium">Global distribution</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-1 h-32 px-2">
                  {[
                    { h: 40, gradient: false },
                    { h: 65, gradient: false },
                    { h: 90, gradient: "sky" as const },
                    { h: 55, gradient: false },
                    { h: 75, gradient: false },
                    { h: 100, gradient: "indigo" as const },
                    { h: 45, gradient: false },
                  ].map((b, i) => (
                    <div
                      key={i}
                      className={
                        b.gradient === "sky"
                          ? "w-full bg-gradient-to-t from-[#38BDF8]/20 to-[#38BDF8] rounded-t-lg shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                          : b.gradient === "indigo"
                            ? "w-full bg-gradient-to-t from-[#6366F1]/20 to-[#6366F1] rounded-t-lg shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                            : "w-full bg-white/5 rounded-t-lg"
                      }
                      style={{ height: `${b.h}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between px-1 text-[10px] font-bold text-slate-600">
                  <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded bg-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8] text-xs font-bold">SL</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">sleepox.com/spring-sale</div>
                    <div className="text-[10px] text-slate-500">2,410 clicks · 4m ago</div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats ribbon */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-10 grid grid-cols-3 gap-4 sm:gap-6">
        {[
          { v: "30ms", l: "Edge redirect" },
          { v: "99.9%", l: "Uptime SLA" },
          { v: "5M+", l: "Clicks routed daily" },
        ].map((s) => (
          <div key={s.l} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#38BDF8] to-[#6366F1]">{s.v}</div>
            <div className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{s.l}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-center text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Everything your links need.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
          A complete toolkit for short links, routing rules, and analytics — without the bloat.
        </p>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-[#38BDF8]/30 hover:bg-white/[0.05] transition-all"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <h2 className="text-center text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Simple pricing. No hidden fees.</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">Pay with crypto via Plisio. Upgrade or stay free forever.</p>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={
                  p.highlight
                    ? "relative rounded-3xl p-8 bg-white/[0.05] backdrop-blur-2xl border border-[#38BDF8]/40 shadow-[0_0_60px_-10px_rgba(56,189,248,0.4)] scale-[1.02]"
                    : "relative rounded-3xl p-8 bg-white/[0.03] backdrop-blur-xl border border-white/10"
                }
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#38BDF8] to-[#6366F1] px-3 py-1 text-xs font-bold text-white shadow-lg">
                    ⭐ RECOMMENDED
                  </div>
                )}
                <h3 className="text-xl font-bold text-white">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{p.blurb}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#38BDF8] to-[#6366F1]">{p.price}</span>
                  <span className="text-sm text-slate-500">/ {p.period}</span>
                </div>
                <div className="mt-6 space-y-1 text-sm">
                  <div className="font-medium text-white">{p.clicks}</div>
                  <div className="text-slate-500">{p.links}</div>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-300">
                      <span className="mt-0.5 text-[#38BDF8]">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={
                    p.highlight
                      ? "mt-8 block rounded-xl py-3 text-center text-sm font-bold bg-gradient-to-r from-[#38BDF8] to-[#6366F1] text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02] transition-transform"
                      : "mt-8 block rounded-xl py-3 text-center text-sm font-bold border border-white/15 text-white hover:bg-white/5 transition-all"
                  }
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-slate-500">
            💡 Most users pick <span className="font-semibold text-white">Lifetime Unlimited</span> — pay once, use forever.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Ready to ship smarter links?</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">Free plan, no credit card. Be live in under a minute.</p>
        <Link
          to="/signup"
          className="mt-10 inline-block rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#6366F1] px-10 py-4 text-base font-bold text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02] transition-transform"
        >
          Create free account
        </Link>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Sleepox · Smart links &amp; analytics
      </footer>
    </div>
  );
}
