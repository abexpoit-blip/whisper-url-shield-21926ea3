import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { Breadcrumbs, buildBreadcrumbSchema } from "@/components/breadcrumbs";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Click Fraud, Bot Filtering & Link Tracking | LinkShield" },
      {
        name: "description",
        content:
          "Guides and playbooks on click fraud protection, bot filtering, and link tracking for Facebook, Instagram, TikTok and Google Ads.",
      },
      {
        name: "keywords",
        content:
          "click fraud blog, bot filter guide, link tracking tutorial, facebook ads fraud, tiktok bot traffic, google ads invalid clicks, utm parameters, branded short links",
      },
      { property: "og:title", content: "LinkShield Blog — Click Fraud, Bots & Link Tracking" },
      { property: "og:description", content: "10 in-depth guides on protecting and measuring paid traffic." },
      { property: "og:url", content: "https://sleepox.com/blog" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/blog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "LinkShield Blog",
          url: "https://sleepox.com/blog",
          blogPost: BLOG_POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `https://sleepox.com/blog/${p.slug}`,
            datePublished: p.datePublished,
            author: { "@type": "Organization", name: p.author },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(buildBreadcrumbSchema([{ label: "Blog" }])),
      },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const byCategory = BLOG_POSTS.reduce<Record<string, typeof BLOG_POSTS>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <BlogHeader />
      <section className="border-b border-border/40 bg-hero">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <Breadcrumbs items={[{ label: "Blog" }]} className="mb-6 justify-center" />
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            LinkShield Blog
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Click fraud, bot filtering & link tracking
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Ten in-depth guides on protecting your ad spend, blocking bot traffic, and measuring every click with confidence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        {Object.entries(byCategory).map(([cat, posts]) => (
          <div key={cat} className="mb-14">
            <h2 className="mb-6 font-display text-2xl font-bold tracking-tight">{cat}</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card/50 p-6 transition hover:border-primary/40 hover:bg-card hover:shadow-glow"
                >
                  <div className="mb-4 text-3xl">{p.heroEmoji}</div>
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.readingTime}</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <BlogFooterCta />
    </div>
  );
}

export function BlogHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold">
          <Logo glow glowSize="sm" className="h-8 w-8" />
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent tracking-tight">
            LinkShield
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link to="/blog" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Blog
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
  );
}

export function BlogFooterCta() {
  return (
    <section className="border-t border-border/40 bg-hero">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Stop paying for fake clicks
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Start filtering bots and tracking every real click in under 2 minutes — free forever plan.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/signup">
            <Button size="lg" className="shadow-glow">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="ghost">
              See pricing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
