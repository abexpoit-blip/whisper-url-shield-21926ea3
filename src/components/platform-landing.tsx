import { Link } from "@tanstack/react-router";
import { Check, ArrowRight, Shield, Bot, BarChart3, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { FaqSection, buildFaqSchema, type FaqItem } from "@/components/faq-section";
import { Breadcrumbs } from "@/components/breadcrumbs";

export interface PlatformLandingProps {
  platform: string;
  slug: string;
  tagline: string;
  heroTitle: React.ReactNode;
  heroSub: string;
  painPoints: string[];
  benefits: { icon: LucideIcon; title: string; desc: string }[];
  faq: FaqItem[];
  accent?: string;
}

export function PlatformLanding(props: PlatformLandingProps) {
  const { platform, tagline, heroTitle, heroSub, painPoints, benefits, faq, accent } =
    props;
  const breadcrumbItems = [{ label: `${platform} Ads` }];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold">
            <Logo glow glowSize="sm" className="h-8 w-8" />
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent tracking-tight">
              LinkShield
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link to="/facebook-ads" className="text-muted-foreground hover:text-foreground">
              Facebook
            </Link>
            <Link to="/instagram-ads" className="text-muted-foreground hover:text-foreground">
              Instagram
            </Link>
            <Link to="/tiktok-ads" className="text-muted-foreground hover:text-foreground">
              TikTok
            </Link>
            <Link to="/google-ads" className="text-muted-foreground hover:text-foreground">
              Google Ads
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="shadow-glow">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <Breadcrumbs items={breadcrumbItems} className="mb-6 justify-center" />
          <div
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
            style={accent ? { color: accent, borderColor: `${accent}55`, background: `${accent}10` } : undefined}
          >
            Built for {platform} advertisers
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">{heroTitle}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{heroSub}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="shadow-glow gap-2">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">{tagline}</p>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Wasting budget on {platform} bot clicks?
          </h2>
          <p className="mt-4 text-muted-foreground">
            These are the silent killers eating your ROAS.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {painPoints.map((p) => (
            <div
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-5"
            >
              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                ×
              </span>
              <p className="text-sm leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Why LinkShield wins for {platform} ads
            </h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card-gradient p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elegant"
              >
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow">
                  <f.icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <h3 className="relative mt-5 font-display text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection
        title={`${platform} Ads FAQ`}
        subtitle={`Questions media buyers ask about running ${platform} campaigns with LinkShield.`}
        items={faq}
      />

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card-gradient p-12 text-center shadow-elegant">
          <div className="absolute inset-0 bg-hero opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-bold md:text-4xl">
              Stop burning budget on fake {platform} clicks
            </h2>
            <p className="mt-4 text-muted-foreground">
              14-day free trial. No credit card. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="shadow-glow gap-2">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  View pricing
                </Button>
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
          </div>
        </div>
      </footer>
    </div>
  );
}

// Re-export so route files can build schema in their head()
export { Shield, Bot, BarChart3, Globe, buildFaqSchema };
