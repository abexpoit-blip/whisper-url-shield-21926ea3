import { createFileRoute } from "@tanstack/react-router";
import { Shield, Bot, BarChart3 } from "lucide-react";
import { PlatformLanding } from "@/components/platform-landing";
import { buildFaqSchema, type FaqItem } from "@/components/faq-section";

const FAQ: FaqItem[] = [
  {
    question: "How does LinkShield prevent Google Ads click fraud?",
    answer:
      "LinkShield identifies invalid clicks — competitor click fraud, bot traffic, datacenter IPs, and proxy clicks — and blocks them from your landing page so they don't waste your daily Google Ads budget.",
  },
  {
    question: "Will Google approve my LinkShield short links?",
    answer:
      "Yes. LinkShield uses clean branded short links and policy-compliant redirects accepted by Google Ads, Search, Display, and YouTube campaigns.",
  },
  {
    question: "Can I get a refund from Google for filtered clicks?",
    answer:
      "Google automatically credits invalid clicks they detect. LinkShield adds a second layer of protection that catches fraud Google misses, and our reports help you submit additional refund requests with evidence.",
  },
  {
    question: "Does this work with Google Ads conversion tracking and GA4?",
    answer:
      "Yes. LinkShield preserves GCLID, UTM parameters, and Google Analytics tracking so your Google Ads conversion tracking and GA4 funnels stay accurate.",
  },
  {
    question: "Is LinkShield better than Google's built-in invalid click detection?",
    answer:
      "It complements it. Google filters obvious bots after the click; LinkShield blocks suspicious traffic before it ever hits your landing page, so your conversion rate, quality score, and ROAS all improve.",
  },
];

export const Route = createFileRoute("/google-ads")({
  head: () => ({
    meta: [
      { title: "Google Ads Click Fraud Protection & URL Shortener — LinkShield" },
      {
        name: "description",
        content:
          "Stop Google Ads click fraud with LinkShield. Bot-filtered short links, invalid click protection, and live analytics for Google Search, Display, YouTube and Shopping campaigns.",
      },
      {
        name: "keywords",
        content:
          "google ads click fraud protection, google ads url shortener, google ads invalid clicks, ppc click fraud, google ads bot filter, competitor click fraud google, gclid tracking, google ads conversion protection, youtube ads short link, google shopping click fraud",
      },
      { property: "og:title", content: "Google Ads Click Fraud Protection & URL Shortener — LinkShield" },
      { property: "og:description", content: "Block invalid clicks, protect ad budget, and boost Google Ads ROAS." },
      { property: "og:url", content: "https://sleepox.com/google-ads" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/google-ads" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildFaqSchema(FAQ)) },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PlatformLanding
      platform="Google Ads"
      slug="google-ads"
      tagline="Click-fraud protection trusted by PPC agencies"
      heroTitle={
        <>
          End <span className="text-gradient">Google Ads click fraud</span> for good
        </>
      }
      heroSub="LinkShield blocks bot clicks, competitor sabotage, and invalid traffic on Google Search, Display, YouTube and Shopping campaigns — protecting your daily budget and lifting ROAS."
      painPoints={[
        "Competitors clicking your Google Ads to drain your daily budget",
        "Bot networks inflating CPC and ruining Quality Score",
        "Invalid clicks Google doesn't refund eating into your margin",
        "GCLID tracking broken by generic shorteners",
      ]}
      benefits={[
        { icon: Shield, title: "Invalid-click shield", desc: "Catch click fraud Google misses — competitor clicks, proxy traffic, and click farms." },
        { icon: Bot, title: "Bot & datacenter filter", desc: "Block automated traffic before it hits your Google Ads landing page." },
        { icon: BarChart3, title: "GCLID-safe tracking", desc: "Preserve GCLID, UTMs, and GA4 attribution while filtering fraud." },
      ]}
      faq={FAQ}
      accent="#4285F4"
    />
  );
}
