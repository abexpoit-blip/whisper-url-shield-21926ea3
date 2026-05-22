import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { supabase } from "@/integrations/supabase/client";
import { refreshSupabaseSessionOnce } from "@/lib/auth-session";
import { APP_BUILD_VERSION, versionedAssetUrl } from "@/lib/build-version";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or was moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#7c3aed" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "LinkShield" },
      { name: "google-site-verification", content: "dBmj6auZVrnDJBXhq6BuCQvyj0EMnH94zmy6Shz2V90" },
      { title: "LinkShield — Bot-Filtered URL Shortener for Facebook & Instagram Ads" },
      {
        name: "description",
        content:
          "LinkShield is a smart URL shortener and click fraud protection tool for Facebook, Instagram, TikTok, and Google Ads. Block bot clicks, geo-filter traffic, boost real CTR, and protect your ad spend with branded short links and live click analytics.",
      },
      {
        name: "keywords",
        content:
          "url shortener, link shortener, bot filter, click fraud protection, facebook ads link cloaker, instagram ads short link, tiktok ads tracker, google ads click protection, short url for ads, branded short links, link tracking, geo targeting links, anti bot clicks, ad click analytics, meta ads optimization, media buyer tools, ppc click fraud, ad spend protection, smart links, deep link, qr code generator, link rotator, ctr booster, conversion tracking links, sleepox, linkshield",
      },
      { name: "author", content: "LinkShield" },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "googlebot", content: "index, follow" },
      { property: "og:site_name", content: "LinkShield" },
      {
        property: "og:title",
        content: "LinkShield — Bot-Filtered URL Shortener for Facebook & Instagram Ads",
      },
      {
        property: "og:description",
        content:
          "Block bot clicks, geo-filter traffic, and boost real CTR with smart short links built for Facebook, Instagram, TikTok & Google Ads campaigns.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: "https://sleepox.com" },
      { name: "app-build-version", content: APP_BUILD_VERSION },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@linkshield" },
      {
        name: "twitter:title",
        content: "LinkShield — Bot-Filtered URL Shortener for Facebook & Instagram Ads",
      },
      {
        name: "twitter:description",
        content:
          "Block bot clicks, geo-filter traffic, and boost real CTR with smart short links for Meta, TikTok & Google Ads.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/60ce39b9-ef4c-44c7-9266-6c4831b3f9e4/id-preview-35a3a1ec--a5ab0c94-43e0-46fe-a916-25eab8563989.lovable.app-1779208529876.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/60ce39b9-ef4c-44c7-9266-6c4831b3f9e4/id-preview-35a3a1ec--a5ab0c94-43e0-46fe-a916-25eab8563989.lovable.app-1779208529876.png",
      },
    ],

    links: [
      { rel: "stylesheet", href: versionedAssetUrl(appCss) },
      { rel: "icon", type: "image/svg+xml", href: versionedAssetUrl("/favicon.svg") },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: versionedAssetUrl("/apple-touch-icon.png"),
      },
      { rel: "manifest", href: versionedAssetUrl("/manifest.json") },
      // iOS launch / startup splash screens
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1284x2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-828x1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-2048x2732.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1668x2388.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1640x2360.png",
        media:
          "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1620x2160.png",
        media:
          "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/splash/apple-splash-1488x2266.png",
        media:
          "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LinkShield",
          alternateName: "Sleepox LinkShield",
          url: "https://sleepox.com",
          logo: "https://sleepox.com/icon-512x512.png",
          sameAs: ["https://sleepox.com"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LinkShield",
          url: "https://sleepox.com",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://sleepox.com/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "LinkShield",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "Bot-filtered URL shortener and click fraud protection for Facebook, Instagram, TikTok, and Google Ads campaigns.",
          offers: {
            "@type": "Offer",
            price: "9",
            priceCurrency: "USD",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            ratingCount: "128",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    // Verify the persisted session points to a real user. If the user was
    // deleted server-side, the stored JWT is "valid" but every protected
    // server fn 401s with "User from sub claim in JWT does not exist".
    // Detect that case and clear the stale session.
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const { error } = await supabase.auth.getUser();
      if (error) {
        const accessToken = await refreshSupabaseSessionOnce();
        if (!accessToken) {
          router.invalidate();
          queryClient.clear();
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      router.invalidate();
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <ImpersonationBanner />
      <main>
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
