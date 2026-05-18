import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Zap, BarChart3, Bot, Globe, Lock, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <Shield className="h-6 w-6 text-primary" />
            <span>LinkShield</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Zap className="h-3.5 w-3.5" />
            Built for Facebook & Instagram advertisers
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Smart short links that <span className="text-gradient">protect your ads</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Stop wasting ad spend on bot clicks. LinkShield filters fake traffic, keeps your ad accounts safe, and boosts real CTR for Meta campaigns.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="shadow-glow gap-2">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline">See pricing</Button>
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {[
            { v: "40%", l: "Less wasted ad spend" },
            { v: "2.4x", l: "Higher real CTR" },
            { v: "85%", l: "Ad approval rate" },
            { v: "10K+", l: "Links protected" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl font-bold text-gradient md:text-4xl">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Everything you need to run safer ads</h2>
          <p className="mt-4 text-muted-foreground">
            Built specifically for agencies and media buyers running paid social.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Bot, title: "Bot & fraud filter", desc: "Detect datacenter IPs, headless browsers, and click-fraud farms in real time." },
            { icon: BarChart3, title: "Real-time analytics", desc: "Country, device, browser, referer — see exactly who's clicking your ads." },
            { icon: Shield, title: "Account protection", desc: "Keep your Meta ad accounts safe. Policy-compliant pre-landers built in." },
            { icon: Globe, title: "Custom domains", desc: "Brand your short links. Rotate domains so one burn doesn't kill your campaign." },
            { icon: Zap, title: "Lightning redirects", desc: "Sub-100ms global edge redirects. Your real users never wait." },
            { icon: Lock, title: "Click limits & expiry", desc: "Cap clicks, set expiry, pause links instantly when a campaign ends." },
          ].map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card-gradient p-6 transition-all hover:border-primary/40 hover:shadow-glow">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/40 bg-card/30">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How LinkShield works</h2>
            <p className="mt-4 text-muted-foreground">Three steps to safer, smarter ads.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Create short link", desc: "Paste your offer URL. Get a clean branded short link in seconds." },
              { step: "02", title: "Use in your ads", desc: "Drop the link in Facebook, Instagram, TikTok, or any ad platform." },
              { step: "03", title: "Bot filter does the rest", desc: "Bots see a safe page. Real users get sent to your offer. You get clean analytics." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="font-mono text-5xl font-bold text-primary/30">{s.step}</div>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            <Shield className="h-4 w-4 text-primary" />
            <span>© 2026 LinkShield. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
