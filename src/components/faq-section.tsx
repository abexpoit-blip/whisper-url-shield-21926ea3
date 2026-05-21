import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-border">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className="py-5">
            <button
              className="flex w-full items-start justify-between gap-4 text-left"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="font-medium">{item.question}</span>
              <ChevronDown
                className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${isOpen ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    question: "What makes LinkShield different from Bitly or other shorteners?",
    answer:
      "Unlike basic shorteners, LinkShield is built specifically for ad campaigns. It filters out bot and datacenter clicks in real time, geo-targets traffic, and protects your Meta ad accounts — all while giving you live click analytics.",
  },
  {
    question: "How does bot filtering work?",
    answer:
      "LinkShield detects headless browsers, datacenter IPs, VPN farms, and known click-fraud patterns. Suspicious traffic is shown a safe landing page while real users are redirected to your offer instantly.",
  },
  {
    question: "Will this help my Facebook ad account stay safe?",
    answer:
      "Yes. By removing bot clicks and click-fraud traffic from your landing page, LinkShield reduces policy violations and improves your campaign quality score — which helps keep your ad accounts in good standing.",
  },
  {
    question: "Can I use my own custom domain?",
    answer:
      "Yes. Pro Monthly and Lifetime include custom domains, so you can run branded short links and rotate domains when a campaign needs extra protection.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Free includes 1 short link and 10,000 clicks per month, so you can test bot filtering, targeting, prelander variants, and analytics before upgrading.",
  },
  {
    question: "Which ad platforms are supported?",
    answer:
      "LinkShield works with Facebook, Instagram, TikTok, Google Ads, Snapchat, and any platform where you can use a short link.",
  },
];

export const PRICING_FAQ: FaqItem[] = [
  {
    question: "What plans are available?",
    answer:
      "Free gives 1 link and 10,000 monthly clicks. Pro Monthly is $5/month with 50 links and 1,000,000 monthly clicks. Lifetime is $50 one-time with unlimited links and unlimited clicks forever.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Free plan is free forever and includes 1 short link, 10,000 monthly clicks, bot filtering, targeting, prelander variants, duplicate-click protection, and basic analytics.",
  },
  {
    question: "What happens if I exceed my monthly link limit?",
    answer:
      "You can still view and manage existing links, but creating new ones will pause until your next billing cycle or until you upgrade your plan.",
  },
  {
    question: "What does Lifetime include?",
    answer:
      "Lifetime includes unlimited short links, unlimited clicks forever, all current and future features, custom domains, API access, advanced analytics, and lifetime priority support.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Paid plans use crypto checkout. A 2% network fee is added at deposit time, so $5 becomes $5.10 and $50 becomes $51.00 at checkout.",
  },
];

export function buildFaqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function FaqSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: FaqItem[];
}) {
  return (
    <section id="faq" className="border-t border-border/40 bg-card/30">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">{title}</h2>
          <p className="mt-4 text-muted-foreground">{subtitle}</p>
        </div>
        <div className="mt-12">
          <FaqAccordion items={items} />
        </div>
      </div>
    </section>
  );
}
