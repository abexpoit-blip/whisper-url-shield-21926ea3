import { createFileRoute } from "@tanstack/react-router";
import { Shield, Bot, BarChart3 } from "lucide-react";
import { PlatformLanding } from "@/components/platform-landing";
import { buildFaqSchema, type FaqItem } from "@/components/faq-section";

const FAQ: FaqItem[] = [
  {
    question: "Can I use LinkShield in my Instagram bio or Stories swipe-up?",
    answer:
      "Yes. LinkShield short links work in Instagram bios, Stories link stickers, Reels link stickers, DMs, and paid Instagram ads.",
  },
  {
    question: "How does LinkShield improve Instagram ad performance?",
    answer:
      "By filtering bot and low-quality clicks before they hit your landing page, LinkShield helps Instagram's algorithm learn from real engagement — improving relevance score, lowering CPM, and increasing ROAS.",
  },
  {
    question: "Will my Instagram links look branded?",
    answer:
      "Yes. Pro and Agency plans support custom branded domains, so your Instagram links look like yourbrand.link/offer instead of a generic shortener.",
  },
  {
    question: "Does LinkShield track Instagram Stories and Reels clicks separately?",
    answer:
      "Yes. UTM parameters let you split traffic by placement — Stories, Reels, Feed, Explore — and see real human CTR for each.",
  },
  {
    question: "Is LinkShield safe for Instagram influencer marketing?",
    answer:
      "Absolutely. Influencer agencies use LinkShield to give each creator their own short link with separate analytics, so you can measure exactly which influencer drove real conversions vs bot traffic.",
  },
];

export const Route = createFileRoute("/instagram-ads")({
  head: () => ({
    meta: [
      { title: "Instagram Ads URL Shortener & Bio Link Tracker — LinkShield" },
      {
        name: "description",
        content:
          "Bot-filtered Instagram short links for ads, bio, Stories and Reels. Track real clicks, boost ROAS, and protect your Instagram ad account with branded short links and live analytics.",
      },
      {
        name: "keywords",
        content:
          "instagram ads url shortener, instagram bio link tracker, instagram short link, instagram ads click fraud, instagram stories link tracker, instagram reels short link, instagram influencer link tracking, instagram ad account protection, branded short links instagram, instagram swipe up tracker",
      },
      { property: "og:title", content: "Instagram Ads URL Shortener & Bio Link Tracker — LinkShield" },
      { property: "og:description", content: "Bot-filtered short links for Instagram ads, bio, Stories and Reels." },
      { property: "og:url", content: "https://sleepox.com/instagram-ads" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/instagram-ads" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildFaqSchema(FAQ)) },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PlatformLanding
      platform="Instagram"
      slug="instagram-ads"
      tagline="The #1 short-link tool for Instagram creators & agencies"
      heroTitle={
        <>
          Smart short links for <span className="text-gradient">Instagram ads & bio</span>
        </>
      }
      heroSub="Branded, bot-filtered short links for Instagram ads, Stories, Reels, and bio. Track every click, protect your account, and see which placements actually convert."
      painPoints={[
        "Instagram ad reports inflated by bot clicks that never convert",
        "Generic shortener links that don't match your brand and lose trust",
        "No way to tell which Stories, Reels, or influencer drove real conversions",
        "Account restrictions from redirect chains that trip Meta's policy filters",
      ]}
      benefits={[
        { icon: Bot, title: "Bot click filter", desc: "Block automated bot traffic before it reaches your Instagram landing page." },
        { icon: BarChart3, title: "Per-placement tracking", desc: "Split Stories vs Reels vs Feed vs influencer traffic in real time." },
        { icon: Shield, title: "Branded bio links", desc: "Use your own domain — yourbrand.link — for trust and higher Instagram CTR." },
      ]}
      faq={FAQ}
      accent="#dd2a7b"
    />
  );
}
