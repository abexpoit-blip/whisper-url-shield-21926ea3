import { createFileRoute } from "@tanstack/react-router";
import { Shield, Bot, BarChart3 } from "lucide-react";
import { PlatformLanding } from "@/components/platform-landing";
import { buildFaqSchema, type FaqItem } from "@/components/faq-section";
import { buildBreadcrumbSchema } from "@/components/breadcrumbs";

const FAQ: FaqItem[] = [
  {
    question: "Does LinkShield work with TikTok Ads Manager?",
    answer:
      "Yes. LinkShield short links work seamlessly with TikTok Ads Manager, Spark Ads, TikTok Shop, and organic TikTok bio links.",
  },
  {
    question: "How does it filter TikTok bot traffic?",
    answer:
      "LinkShield detects datacenter IPs, headless browsers, click-farm signatures, and incentivized traffic that often inflates TikTok ad spend — sending bots to a safe page while real users reach your offer.",
  },
  {
    question: "Will TikTok approve my LinkShield links?",
    answer:
      "Yes. LinkShield uses clean branded short links with policy-compliant pre-landers. Custom domains help avoid TikTok's generic-shortener restrictions.",
  },
  {
    question: "Can I track TikTok organic vs paid traffic separately?",
    answer:
      "Absolutely. Create separate short links for bio, organic videos, and paid ads — each with its own analytics dashboard showing real human clicks.",
  },
  {
    question: "Does LinkShield support TikTok Pixel tracking?",
    answer:
      "Yes. UTM parameters, click IDs, and TikTok Pixel data all pass through cleanly so your conversion tracking remains accurate.",
  },
];

export const Route = createFileRoute("/tiktok-ads")({
  head: () => ({
    meta: [
      { title: "TikTok Ads URL Shortener & Click Tracker — LinkShield" },
      {
        name: "description",
        content:
          "Bot-filtered TikTok short links for ads, bio and Spark Ads. Block click farms, protect your TikTok ad account, and track real conversions with branded short links.",
      },
      {
        name: "keywords",
        content:
          "tiktok ads url shortener, tiktok bio link, tiktok ad link cloaker, tiktok click fraud protection, tiktok ads bot filter, tiktok spark ads link, tiktok shop short link, tiktok pixel tracking, branded short links tiktok, tiktok ads ctr",
      },
      { property: "og:title", content: "TikTok Ads URL Shortener & Click Tracker — LinkShield" },
      { property: "og:description", content: "Bot-filtered short links built for TikTok Ads & bio." },
      { property: "og:url", content: "https://sleepox.com/tiktok-ads" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/tiktok-ads" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildFaqSchema(FAQ)) },
      { type: "application/ld+json", children: JSON.stringify(buildBreadcrumbSchema([{ label: "TikTok Ads" }])) },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PlatformLanding
      platform="TikTok"
      slug="tiktok-ads"
      tagline="Built for TikTok media buyers & dropshippers"
      heroTitle={
        <>
          Bot-proof <span className="text-gradient">TikTok Ads short links</span>
        </>
      }
      heroSub="LinkShield blocks click farms and bot traffic on TikTok Ads, Spark Ads, and bio links — so every dollar reaches a real viewer ready to convert."
      painPoints={[
        "Click farms inflating TikTok ad spend with traffic that never buys",
        "Generic shortener links flagged by TikTok and losing reach",
        "Can't separate bio traffic from paid TikTok ad clicks in analytics",
        "TikTok ad account at risk from non-compliant redirect chains",
      ]}
      benefits={[
        { icon: Bot, title: "Click farm filter", desc: "Detect incentivized-click traffic and bot patterns that target TikTok ads specifically." },
        { icon: Shield, title: "TikTok-safe redirects", desc: "Policy-compliant pre-landers and branded domains keep your TikTok ad account healthy." },
        { icon: BarChart3, title: "Bio + ads tracking", desc: "Split organic bio traffic, Spark Ads, and paid campaigns with separate analytics." },
      ]}
      faq={FAQ}
      accent="#ff0050"
    />
  );
}
