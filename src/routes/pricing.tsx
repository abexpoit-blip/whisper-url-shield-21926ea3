import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Check,
  ArrowRight,
  Sparkles,
  Rocket,
  Crown,
  Zap,
  Infinity as InfinityIcon,
  Link2,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaqSection, PRICING_FAQ, buildFaqSchema } from "@/components/faq-section";
import { Breadcrumbs, buildBreadcrumbSchema } from "@/components/breadcrumbs";
import { listAvailablePackages } from "@/lib/billing.functions";

const PRICING_CRUMBS = [{ label: "Pricing", to: "/pricing" }];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Free, $5/mo Pro, $50 Lifetime" },
      {
        name: "description",
        content:
          "Start free with 10K clicks. Pro at $5/mo gives 1M clicks + 50 links. Lifetime at $50 unlocks unlimited links & clicks forever. Pay in crypto, 2% network fee.",
      },
      { property: "og:title", content: "Pricing — Free, $5/mo Pro, $50 Lifetime" },
      {
        property: "og:description",
        content: "Bot-filtered short links + cloaking. From free to $50 lifetime, crypto only.",
      },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildFaqSchema(PRICING_FAQ)) },
      {
        type: "application/ld+json",
        children: JSON.stringify(buildBreadcrumbSchema(PRICING_CRUMBS)),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const list = useServerFn(listAvailablePackages);
  const { data: pkgs = [], isLoading } = useQuery({
    queryKey: ["pricing-packages-public"],
    queryFn: () => list(),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <Shield className="h-6 w-6 text-primary" /> LinkShield
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <Breadcrumbs items={PRICING_CRUMBS} className="mb-6 justify-center" />
          <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="mr-1 h-3 w-3" /> Simple, honest pricing
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">Pay once. Cloak forever.</h1>
          <p className="mt-4 text-muted-foreground">
            Start free. Scale on Pro at $5/mo. Or grab Lifetime at $50 — one payment, no renewals
            ever. All paid plans charged in crypto with a 2% network fee.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="min-h-[28rem] animate-pulse rounded-2xl border bg-card/70" />
            ))}
          {pkgs.map((p: any) => {
            const isLifetime = p.billing_period === "lifetime" || Number(p.price_onetime) > 0;
            const price = isLifetime ? Number(p.price_onetime) : Number(p.price_monthly);
            const isFree = price === 0 && !isLifetime;
            const isFeatured = !!p.is_featured;
            const highlight = isFeatured || isLifetime;
            const unlimitedClicks = p.click_limit == null;
            const unlimitedLinks = p.link_limit == null || p.link_limit >= 999999;
            const Icon = isLifetime ? Crown : isFree ? Zap : Rocket;
            const tagline = isLifetime
              ? "Every premium feature unlocked forever. One payment, zero renewals."
              : isFree
                ? "Start free, test cloaking, explore every core feature."
                : "For active media buyers running Meta, TikTok & Google ads at scale.";
            const total = (price * 1.02).toFixed(2);

            return (
              <div
                key={p.id}
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card-gradient p-8 transition-all hover:shadow-xl ${
                  highlight
                    ? "border-primary/60 shadow-glow shadow-primary/20"
                    : "border-border"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-medium text-white shadow-md">
                    <Crown className="mr-1 inline h-3 w-3" /> Best value
                  </div>
                )}
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                    isLifetime
                      ? "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground"
                      : isFree
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl font-bold">{p.name}</h2>
                <p className="mt-1 min-h-[3rem] text-sm text-muted-foreground">{tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">${price.toFixed(0)}</span>
                  <span className="text-muted-foreground">
                    /{isLifetime ? "lifetime" : "mo"}
                  </span>
                </div>
                {!isFree && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    ≈ <span className="font-medium text-foreground">${total}</span> total (incl. 2%
                    network fee)
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {unlimitedLinks ? <InfinityIcon className="h-3.5 w-3.5" /> : p.link_limit}
                      </div>
                      <div className="text-muted-foreground">
                        {unlimitedLinks ? "links" : p.link_limit === 1 ? "link" : "links"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {unlimitedClicks ? (
                          <InfinityIcon className="h-3.5 w-3.5" />
                        ) : Number(p.click_limit) >= 1000000 ? (
                          `${(Number(p.click_limit) / 1000000).toFixed(0)}M`
                        ) : (
                          `${(Number(p.click_limit) / 1000).toFixed(0)}K`
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {isLifetime ? "clicks · ever" : "clicks/mo"}
                      </div>
                    </div>
                  </div>
                </div>

                <Link to={isFree ? "/signup" : "/upgrade"} className="mt-6 block">
                  <Button
                    className={`w-full gap-2 ${
                      isLifetime
                        ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:opacity-95"
                        : ""
                    }`}
                    variant={isLifetime || !isFree ? "default" : "outline"}
                  >
                    {isFree ? "Start free" : isLifetime ? "Get lifetime" : "Upgrade now"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <div className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What's included
                </div>
                <ul className="mt-3 space-y-2.5 text-sm">
                  {(p.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          isLifetime
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Crypto payments only (BTC, LTC, USDT, USDT-TRC20) via Plisio. A 2% network fee is added
          at checkout to cover blockchain confirmation costs. Plans activate automatically once the
          transaction is confirmed on-chain.
        </p>
      </section>

      <FaqSection
        title="Pricing FAQ"
        subtitle="Common questions about plans, billing, and upgrades."
        items={PRICING_FAQ}
      />
    </div>
  );
}
