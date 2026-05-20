import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { BLOG_POSTS, getPostBySlug, getRelatedPosts, type BlogPost } from "@/lib/blog-posts";
import { MarkdownContent } from "@/components/markdown-content";
import { BlogHeader, BlogFooterCta } from "./blog";
import { Breadcrumbs, buildBreadcrumbSchema } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/blog_/$slug")({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post, related: getRelatedPosts(params.slug) };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post ?? getPostBySlug(params.slug);
    if (!post) {
      return {
        meta: [{ title: "Post not found — LinkShield Blog" }],
      };
    }
    const url = `https://sleepox.com/blog/${post.slug}`;
    return {
      meta: [
        { title: `${post.title} | LinkShield Blog` },
        { name: "description", content: post.description },
        { name: "keywords", content: post.keywords.join(", ") },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: post.datePublished },
        { property: "article:section", content: post.category },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.datePublished,
            dateModified: post.datePublished,
            author: { "@type": "Organization", name: post.author, url: "https://sleepox.com" },
            publisher: {
              "@type": "Organization",
              name: "LinkShield",
              url: "https://sleepox.com",
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            keywords: post.keywords.join(", "),
            articleSection: post.category,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://sleepox.com/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://sleepox.com/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <BlogHeader />
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-bold">Post not found</h1>
        <p className="mt-4 text-muted-foreground">That article does not exist or has been moved.</p>
        <Link to="/blog" className="mt-6 inline-block">
          <Button>Back to blog</Button>
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <BlogHeader />
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post, related } = Route.useLoaderData();
  const prettyDate = new Date(post.datePublished).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <BlogHeader />

      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Breadcrumbs
          items={[
            { label: "Blog", to: "/blog" },
            { label: post.title, to: `/blog/${post.slug}` },
          ]}
          className="mb-8"
        />

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {post.category}
        </div>

        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> {prettyDate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {post.readingTime}
          </span>
          <span>By {post.author}</span>
        </div>

        <div className="my-10 h-px w-full bg-border/60" />

        <div className="mb-10 text-7xl">{post.heroEmoji}</div>

        <MarkdownContent source={post.content} />

        <div className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8">
          <h3 className="font-display text-xl font-bold tracking-tight">Try LinkShield free</h3>
          <p className="mt-2 text-muted-foreground">
            Bot-filtered short links with click tracking and click fraud protection — set up in 2 minutes.
          </p>
          <Link to="/signup" className="mt-4 inline-block">
            <Button className="shadow-glow">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h3 className="mb-6 font-display text-2xl font-bold tracking-tight">Keep reading</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((r: BlogPost) => (
                <Link
                  key={r.slug}
                  to="/blog/$slug"
                  params={{ slug: r.slug }}
                  className="group rounded-xl border border-border/60 bg-card/50 p-5 transition hover:border-primary/40 hover:bg-card"
                >
                  <div className="mb-3 text-2xl">{r.heroEmoji}</div>
                  <h4 className="font-display text-base font-semibold leading-snug group-hover:text-primary">
                    {r.title}
                  </h4>
                  <p className="mt-2 text-xs text-muted-foreground">{r.readingTime}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <BlogFooterCta />
    </div>
  );
}

// Generate static paths for prerendering
export const _staticPaths = BLOG_POSTS.map((p) => ({ slug: p.slug }));
