// Pre-lander variants + automatic A/B selection (epsilon-greedy bandit)
// Each variant is safe, evergreen content suitable for Facebook ad approval.

export type VariantId = "wellness" | "productivity" | "finance";

export type Variant = {
  id: VariantId;
  category: string;
  title: string;
  subtitle: string;
  intro: string;
  sections: { heading: string; body: string }[];
  outro: string;
};

export const VARIANTS: Record<VariantId, Variant> = {
  wellness: {
    id: "wellness",
    category: "Health & Wellness",
    title: "5 Simple Habits That Can Transform Your Daily Routine",
    subtitle: "Published today · 4 min read",
    intro:
      "Building a healthier, more productive routine doesn't require a complete life overhaul. Small, consistent habits — practiced daily — create the biggest long-term changes. Here are five evidence-backed habits anyone can start this week.",
    sections: [
      { heading: "1. Start your morning with water", body: "After 7-8 hours of sleep your body is mildly dehydrated. A glass of water before coffee kickstarts your metabolism and improves morning focus." },
      { heading: "2. Move for 10 minutes", body: "You don't need a gym. A brisk 10-minute walk or short stretching session boosts circulation and mood." },
      { heading: "3. Plan three priorities", body: "Pick the three most important tasks for the day. This reduces decision fatigue and helps you finish what truly matters." },
      { heading: "4. Take screen-free breaks", body: "Every 60-90 minutes, step away from screens for a few minutes. Your eyes, posture and concentration all benefit." },
      { heading: "5. Wind down with a routine", body: "A consistent evening routine signals your body it's time to rest. Dim lights, avoid heavy meals, and read instead of scrolling." },
    ],
    outro: "Try one habit this week. Once it sticks, add the next. Small steps compound into big results.",
  },
  productivity: {
    id: "productivity",
    category: "Work & Productivity",
    title: "How High Performers Stay Focused All Day Without Burnout",
    subtitle: "Published today · 5 min read",
    intro:
      "Productivity isn't about doing more — it's about doing the right things, consistently. Top performers across industries share a small set of focus habits that anyone can copy. Here's a practical breakdown.",
    sections: [
      { heading: "1. Protect the first 90 minutes", body: "Your willpower is highest right after waking. Spend the first 90 minutes on deep work — no meetings, no email, no social media." },
      { heading: "2. Use the two-minute rule", body: "If a task takes less than two minutes, do it immediately. Anything longer goes on the priority list." },
      { heading: "3. Batch shallow work", body: "Group emails, messages and admin into 1-2 windows per day instead of reacting to them all day long." },
      { heading: "4. Single-task with a timer", body: "A 25-minute focused block with no notifications beats 60 minutes of fragmented attention." },
      { heading: "5. End the day with a shutdown ritual", body: "Write tomorrow's top three tasks before you stop. Your brain stops looping at night and you start sharper the next morning." },
    ],
    outro: "Pick one technique this week and stack the rest as it becomes automatic.",
  },
  finance: {
    id: "finance",
    category: "Personal Finance",
    title: "7 Money Habits That Quietly Build Long-Term Wealth",
    subtitle: "Published today · 5 min read",
    intro:
      "You don't need a six-figure salary to build wealth — you need a few simple habits, repeated for years. These are the basics financial planners recommend, in plain language.",
    sections: [
      { heading: "1. Pay yourself first", body: "Move a fixed amount to savings the day your salary lands — before any spending decisions." },
      { heading: "2. Track where your money actually goes", body: "Most people overestimate income and underestimate spending. Two weeks of honest tracking changes habits faster than any budget app." },
      { heading: "3. Keep a 1-month emergency buffer", body: "Even a small buffer prevents one bad month from turning into months of debt." },
      { heading: "4. Avoid lifestyle inflation", body: "Every raise should partly go to savings before being absorbed into bigger expenses." },
      { heading: "5. Automate the boring stuff", body: "Set up automatic transfers for savings, bills, and investments. Decisions you don't have to make get made consistently." },
    ],
    outro: "Pick one habit and start this month. Wealth is built by what you do repeatedly, not what you do occasionally.",
  },
};

export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];

export type VariantStat = { id: VariantId; total: number; humans: number };

/**
 * Epsilon-greedy bandit:
 *  - cold start (any variant <30 clicks): explore equally
 *  - else: 80% pick best by pass-rate, 20% explore random
 */
export function pickVariant(stats: VariantStat[]): VariantId {
  const statsById = new Map(stats.map((s) => [s.id, s]));
  const minSampled = VARIANT_IDS.reduce(
    (m, id) => Math.min(m, statsById.get(id)?.total ?? 0),
    Infinity,
  );

  if (minSampled < 30) {
    return VARIANT_IDS[Math.floor(Math.random() * VARIANT_IDS.length)];
  }

  if (Math.random() < 0.2) {
    return VARIANT_IDS[Math.floor(Math.random() * VARIANT_IDS.length)];
  }

  let best: VariantId = VARIANT_IDS[0];
  let bestRate = -1;
  for (const id of VARIANT_IDS) {
    const s = statsById.get(id);
    const rate = s && s.total > 0 ? s.humans / s.total : 0;
    if (rate > bestRate) { bestRate = rate; best = id; }
  }
  return best;
}
