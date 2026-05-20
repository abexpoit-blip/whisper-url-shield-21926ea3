import { createFileRoute } from "@tanstack/react-router";
import { Shield, Bot, BarChart3 } from "lucide-react";
import { PlatformLanding } from "@/components/platform-landing";
import { buildFaqSchema, type FaqItem } from "@/components/faq-section";

const FAQ: FaqItem[] = [
  {
    question: "How does LinkShield protect my Facebook ad account?",
    answer:
      "LinkShield filters bot clicks and fraudulent traffic before they hit your landing page. This improves your campaign quality score, reduces policy violations, and helps keep your Meta ad account in good standing.",
  },
  {
    question: "Will Facebook flag my LinkShield short links?",
    answer:
      "No. LinkShield uses clean branded short links and policy-compliant pre-landers that Facebook accepts. You can also rotate multiple custom domains so a single flagged domain doesn't kill your whole campaign.",
  },
  {
    question: "Can I cloak my affiliate offers for Facebook ads?",
    answer:
      "LinkShield offers compliant link cloaking — bots see a safe page, real users go to your offer. We don't support black-hat cloaking that violates Facebook's policies.",
  },
  {
    question: "How much can I save on wasted Facebook ad spend?",
    answer:
      "Our customers typically cut 30–45% of wasted ad spend by blocking bot clicks and datacenter traffic that never converts.",
  },
  {
    question: "Does LinkShield work with Facebook Pixel and Conversions API?",
    answer:
      "Yes. LinkShield passes through all UTM parameters, pixel data, and click IDs so your Facebook Pixel and CAPI tracking stays intact.",
  },
];

export const Route = createFileRoute("/facebook-ads")({
  head: () => ({
    meta: [
      { title: "Facebook Ads URL Shortener & Click Fraud Protection — LinkShield" },
      {
        name: "description",
        content:
          "Bot-filtered short links for Facebook & Meta Ads. Block fake clicks, protect your ad account, boost CTR and save up to 40% of wasted Facebook ad spend with LinkShield.",
      },
      {
        name: "keywords",
        content:
          "facebook ads url shortener, facebook ad link cloaker, facebook click fraud protection, facebook ads bot filter, meta ads short link, facebook pixel safe shortener, facebook ad account protection, facebook ads tracking link, facebook ads ctr booster, branded short links facebook",
      },
      { property: "og:title", content: "Facebook Ads URL Shortener & Click Fraud Protection — LinkShield" },
      { property: "og:description", content: "Bot-filtered short links built for Facebook & Meta Ads campaigns." },
      { property: "og:url", content: "https://sleepox.com/facebook-ads" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/facebook-ads" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildFaqSchema(FAQ)) },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PlatformLanding
      platform="Facebook"
      slug="facebook-ads"
      tagline="Trusted by Facebook media buyers worldwide"
      heroTitle={
        <>
          The smartest <span className="text-gradient">Facebook Ads URL shortener</span>
        </>
      }
      heroSub="Bot-filtered short links built for Facebook & Meta Ads. Stop paying for fake clicks, protect your ad account, and boost real CTR — all without breaking Facebook's policies."
      painPoints={[
        "Bot farms clicking your ads and burning 30–50% of your daily budget",
        "Ad accounts getting flagged or restricted because of policy-tripping redirects",
        "Inflated CTR from datacenter traffic ruining your campaign learning phase",
        "Inaccurate analytics because Facebook reports include bot clicks",
      ]}
      benefits={[
        { icon: Bot, title: "Real-time bot filter", desc: "Detect headless browsers, VPN farms, and datacenter IPs the instant they click your Facebook ads." },
        { icon: Shield, title: "Account protection", desc: "Policy-compliant pre-landers and clean redirects keep your Meta ad accounts safe." },
        { icon: BarChart3, title: "Clean Facebook analytics", desc: "Filter bot clicks out of your reporting so your CTR, CPC, and ROAS reflect real humans." },
      ]}
      faq={FAQ}
      accent="#1877F2"
    />
  );
}
