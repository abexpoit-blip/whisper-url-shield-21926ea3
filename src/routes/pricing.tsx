import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — LinkShield" },
      { name: "description", content: "Simple, transparent pricing for agencies and media buyers." },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Starter",
    price: 9,
    desc: "Perfect for solo media buyers testing the waters.",
    features: ["50 short links/month", "Basic analytics", "Bot filtering", "Email support"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: 29,
    desc: "Most popular for active media buyers.",
    features: ["500 short links/month", "Advanced analytics", "Bot & fraud filter", "Click heatmap", "Priority support"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: 79,
    desc: "For agencies managing multiple clients.",
    features: ["5,000 short links/month", "All Pro features", "Custom domains", "Team accounts", "API access", "24/7 support"],
    cta: "Start free trial",
    highlight: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <Shield className="h-6 w-6 text-primary" /> LinkShield
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      <section className="bg-hero">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-muted-foreground">Pick the plan that fits your ad volume. Upgrade or cancel anytime.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border bg-card-gradient p-8 ${
                p.highlight ? "border-primary shadow-glow" : "border-border"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most popular
                </div>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold">${p.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <Link to="/signup" className="mt-6 block">
                <Button className="w-full gap-2" variant={p.highlight ? "default" : "outline"}>
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
